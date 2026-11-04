package fr.mbonnici.portfolio.backup;

import fr.mbonnici.portfolio.backup.BackupRun.Kind;
import fr.mbonnici.portfolio.backup.BackupRun.Status;
import fr.mbonnici.portfolio.backup.BackupRun.Trigger;
import fr.mbonnici.portfolio.backup.GoogleDriveClient.Account;
import fr.mbonnici.portfolio.backup.GoogleDriveClient.DriveFile;
import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.storage.StorageService;
import fr.mbonnici.portfolio.storage.StorageService.StoredKey;
import fr.mbonnici.portfolio.storage.StorageService.StoredObject;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Builds and restores portable archives (manifest + CSV dump of every content table + every object
 * of the media bucket) and ships them to Google Drive, on demand or every day.
 */
@Service
public class BackupService {

    public static final String FOLDER_NAME = "mbonnici.fr backups";
    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);

    public record Settings(boolean autoEnabled, int hourUtc, int keepCount) {}

    public record RunDto(UUID id, Kind kind, Trigger trigger, Status status, Instant startedAt, Instant finishedAt,
            String fileName, String driveFileId, Long sizeBytes, String message) {
        static RunDto from(BackupRun r) {
            return new RunDto(r.getId(), r.getKind(), r.getTrigger(), r.getStatus(), r.getStartedAt(), r.getFinishedAt(),
                    r.getFileName(), r.getDriveFileId(), r.getSizeBytes(), r.getMessage());
        }
    }

    public record DriveState(boolean connected, String email, String displayName, Long quotaLimit, Long quotaUsage,
            String folderId, String error) {}

    public record Overview(DriveState drive, Settings settings, boolean running, String schemaVersion,
            List<RunDto> runs, List<DriveFile> files) {}

    private final DatabaseDump dump;
    private final StorageService storage;
    private final DriveAuthService auth;
    private final GoogleDriveClient drive;
    private final BackupRunRepository runs;
    private final BackupSettingsRepository settings;
    private final ObjectMapper mapper;
    private final ObjectProvider<BuildProperties> build;
    private final CacheManager cacheManager;
    private final JdbcTemplate jdbc;

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "backup");
        t.setDaemon(true);
        return t;
    });
    private final AtomicBoolean busy = new AtomicBoolean();

    public BackupService(DatabaseDump dump, StorageService storage, DriveAuthService auth, GoogleDriveClient drive,
            BackupRunRepository runs, BackupSettingsRepository settings, ObjectMapper mapper,
            ObjectProvider<BuildProperties> build, CacheManager cacheManager, JdbcTemplate jdbc) {
        this.dump = dump;
        this.storage = storage;
        this.auth = auth;
        this.drive = drive;
        this.runs = runs;
        this.settings = settings;
        this.mapper = mapper;
        this.build = build;
        this.cacheManager = cacheManager;
        this.jdbc = jdbc;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    // ── status ───────────────────────────────────────────────────────────────

    public Overview overview() {
        BackupSettings s = settings.get();
        DriveState state;
        List<DriveFile> files = List.of();
        if (auth.connected()) {
            Optional<String> token = auth.accessToken();
            if (token.isPresent()) {
                try {
                    Account a = drive.about(token.get());
                    String folder = ensureFolder(token.get(), s);
                    files = drive.list(token.get(), folder);
                    state = new DriveState(true, a.email(), a.displayName(), a.quotaLimit(), a.quotaUsage(), folder, null);
                } catch (RuntimeException e) {
                    state = new DriveState(true, s.getGoogleEmail(), null, null, null, s.getDriveFolderId(),
                            "Drive API error: " + e.getMessage());
                }
            } else {
                state = new DriveState(false, s.getGoogleEmail(), null, null, null, null, "token refresh failed, reconnect");
            }
        } else {
            state = new DriveState(false, null, null, null, null, null, null);
        }
        return new Overview(state, new Settings(s.isAutoEnabled(), s.getHourUtc(), s.getKeepCount()), busy.get(),
                schemaVersion(), runs.findTop30ByOrderByStartedAtDesc().stream().map(RunDto::from).toList(), files);
    }

    public Settings updateSettings(Settings in) {
        BackupSettings s = settings.get();
        s.setAutoEnabled(in.autoEnabled());
        s.setHourUtc((short) Math.clamp(in.hourUtc(), 0, 23));
        s.setKeepCount((short) Math.clamp(in.keepCount(), 1, 100));
        s.touch();
        settings.save(s);
        return new Settings(s.isAutoEnabled(), s.getHourUtc(), s.getKeepCount());
    }

    // ── backup to Drive ──────────────────────────────────────────────────────

    public UUID startBackup(Trigger trigger) {
        if (!auth.connected()) {
            throw new ApiException(HttpStatus.CONFLICT, "Google Drive is not connected");
        }
        if (!busy.compareAndSet(false, true)) {
            throw new ApiException(HttpStatus.CONFLICT, "a backup or restore is already running");
        }
        BackupRun run = runs.save(BackupRun.start(Kind.BACKUP, trigger));
        executor.submit(() -> doBackup(run.getId()));
        return run.getId();
    }

    private void doBackup(UUID runId) {
        BackupRun run = runs.findById(runId).orElseThrow();
        Path tmp = null;
        try {
            String token = auth.accessToken().orElseThrow(() -> new IllegalStateException("Google Drive token unavailable"));
            BackupSettings s = settings.get();
            String folder = ensureFolder(token, s);
            String name = "mbonnici-" + STAMP.format(Instant.now()) + ".zip";
            tmp = Files.createTempFile("mbonnici-backup-", ".zip");
            try (OutputStream out = Files.newOutputStream(tmp)) {
                writeArchive(out);
            }
            long size = Files.size(tmp);
            DriveFile file = drive.upload(token, folder, name, tmp);
            run.succeed(name, file.id(), size, null);
            runs.save(run);
            applyRetention(token, folder, s.getKeepCount());
            log.info("Backup {} uploaded to Drive ({} bytes)", name, size);
        } catch (Exception e) {
            log.error("Backup failed", e);
            run.fail(e.getMessage());
            runs.save(run);
        } finally {
            deleteQuietly(tmp);
            busy.set(false);
        }
    }

    private void applyRetention(String token, String folder, int keep) {
        try {
            List<DriveFile> files = drive.list(token, folder);
            for (int i = keep; i < files.size(); i++) {
                drive.delete(token, files.get(i).id());
                log.info("Retention: deleted old backup {}", files.get(i).name());
            }
        } catch (RuntimeException e) {
            log.warn("Retention clean-up failed: {}", e.getMessage());
        }
    }

    private String ensureFolder(String token, BackupSettings s) {
        if (s.getDriveFolderId() != null) {
            return s.getDriveFolderId();
        }
        String id = drive.findOrCreateFolder(token, FOLDER_NAME);
        s.setDriveFolderId(id);
        settings.save(s);
        return id;
    }

    /** Runs every hour: fires the daily backup once at the configured UTC hour. */
    @Scheduled(cron = "0 7 * * * *")
    public void scheduled() {
        BackupSettings s = settings.get();
        if (!s.isAutoEnabled() || !auth.connected()) {
            return;
        }
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        if (now.getHour() != s.getHourUtc()) {
            return;
        }
        LocalDate today = now.toLocalDate();
        boolean doneToday = runs.findFirstByKindAndStatusAndTriggerOrderByStartedAtDesc(Kind.BACKUP, Status.SUCCESS, Trigger.SCHEDULED)
                .map(r -> r.getStartedAt().atZone(ZoneOffset.UTC).toLocalDate().equals(today))
                .orElse(false);
        if (doneToday) {
            return;
        }
        try {
            startBackup(Trigger.SCHEDULED);
        } catch (ApiException e) {
            log.warn("Scheduled backup skipped: {}", e.getMessage());
        }
    }

    // ── restore ──────────────────────────────────────────────────────────────

    public UUID startRestoreFromDrive(String fileId, boolean force) {
        if (!auth.connected()) {
            throw new ApiException(HttpStatus.CONFLICT, "Google Drive is not connected");
        }
        if (!busy.compareAndSet(false, true)) {
            throw new ApiException(HttpStatus.CONFLICT, "a backup or restore is already running");
        }
        BackupRun run = runs.save(BackupRun.start(Kind.RESTORE, Trigger.MANUAL));
        executor.submit(() -> {
            Path tmp = null;
            try {
                String token = auth.accessToken().orElseThrow(() -> new IllegalStateException("Google Drive token unavailable"));
                tmp = Files.createTempFile("mbonnici-restore-", ".zip");
                try (OutputStream out = Files.newOutputStream(tmp)) {
                    drive.download(token, fileId, out);
                }
                try (InputStream in = Files.newInputStream(tmp)) {
                    BackupManifest m = restoreArchive(in, force);
                    run.succeed(fileId, fileId, Files.size(tmp), "restored " + m.mediaCount() + " media, schema " + m.schemaVersion());
                }
                runs.save(run);
            } catch (Exception e) {
                log.error("Restore failed", e);
                run.fail(e.getMessage());
                runs.save(run);
            } finally {
                deleteQuietly(tmp);
                busy.set(false);
            }
        });
        return run.getId();
    }

    /** Synchronous restore from an uploaded archive (used by the import endpoint). */
    public RunDto restoreUploaded(InputStream in, boolean force) {
        if (!busy.compareAndSet(false, true)) {
            throw new ApiException(HttpStatus.CONFLICT, "a backup or restore is already running");
        }
        BackupRun run = runs.save(BackupRun.start(Kind.RESTORE, Trigger.UPLOAD));
        try {
            BackupManifest m = restoreArchive(in, force);
            run.succeed(null, null, null, "restored " + m.mediaCount() + " media, schema " + m.schemaVersion());
        } catch (ApiException e) {
            run.fail(e.getMessage());
            runs.save(run);
            throw e;
        } catch (Exception e) {
            log.error("Restore failed", e);
            run.fail(e.getMessage());
            runs.save(run);
            throw new ApiException(HttpStatus.BAD_REQUEST, "restore failed: " + e.getMessage());
        } finally {
            busy.set(false);
        }
        return RunDto.from(runs.save(run));
    }

    public void deleteDriveFile(String fileId) {
        String token = auth.accessToken().orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Google Drive is not connected"));
        drive.delete(token, fileId);
    }

    public void downloadDriveFile(String fileId, OutputStream out) {
        String token = auth.accessToken().orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Google Drive is not connected"));
        drive.download(token, fileId, out);
    }

    // ── archive format ───────────────────────────────────────────────────────

    /** Streams a complete archive: manifest, media index, CSV dump per table, then every media object. */
    public void writeArchive(OutputStream out) throws IOException {
        List<StoredKey> keys = storage.list();
        long mediaBytes = keys.stream().mapToLong(StoredKey::size).sum();
        BackupManifest manifest = new BackupManifest(BackupManifest.FORMAT, appVersion(), schemaVersion(), Instant.now(),
                DatabaseDump.TABLES.size(), keys.size(), mediaBytes);

        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            zip.putNextEntry(new ZipEntry("manifest.json"));
            zip.write(mapper.writeValueAsBytes(manifest));
            zip.closeEntry();

            try {
                dump.dump(new DatabaseDump.EntrySink() {
                    @Override
                    public OutputStream open(String table) throws IOException {
                        zip.putNextEntry(new ZipEntry("db/" + table + ".csv"));
                        return zip;
                    }

                    @Override
                    public void close() throws IOException {
                        zip.closeEntry();
                    }
                });
            } catch (java.sql.SQLException e) {
                throw new IOException("database dump failed: " + e.getMessage(), e);
            }

            Map<String, String> index = new LinkedHashMap<>();
            for (StoredKey key : keys) {
                Optional<StoredObject> obj = storage.get(key.key());
                if (obj.isEmpty()) {
                    continue;
                }
                index.put(key.key(), obj.get().contentType() == null ? "application/octet-stream" : obj.get().contentType());
                zip.putNextEntry(new ZipEntry("media/" + key.key()));
                zip.write(obj.get().bytes());
                zip.closeEntry();
            }
            zip.putNextEntry(new ZipEntry("media-index.json"));
            zip.write(mapper.writeValueAsBytes(index));
            zip.closeEntry();
        }
    }

    /** Reads an archive produced by {@link #writeArchive}: database first (atomically), then media. */
    public BackupManifest restoreArchive(InputStream in, boolean force) throws IOException {
        BackupManifest manifest = null;
        Map<String, byte[]> csv = new LinkedHashMap<>();
        Map<String, byte[]> media = new LinkedHashMap<>();
        Map<String, String> index = Map.of();

        try (ZipInputStream zip = new ZipInputStream(in, StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (name.equals("manifest.json")) {
                    manifest = mapper.readValue(zip.readAllBytes(), BackupManifest.class);
                } else if (name.startsWith("db/") && name.endsWith(".csv")) {
                    csv.put(name.substring(3, name.length() - 4), zip.readAllBytes());
                } else if (name.equals("media-index.json")) {
                    index = mapper.readValue(zip.readAllBytes(), mapper.getTypeFactory().constructMapType(Map.class, String.class, String.class));
                } else if (name.startsWith("media/") && !entry.isDirectory()) {
                    String key = name.substring(6);
                    if (!key.matches("^\\d{4}/\\d{2}/[0-9a-f-]{36}\\.[a-z0-9]{3,4}$")) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, "archive contains an invalid media key: " + key);
                    }
                    media.put(key, zip.readAllBytes());
                }
                zip.closeEntry();
            }
        }
        if (manifest == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "not a mbonnici backup archive (manifest missing)");
        }
        if (manifest.format() != BackupManifest.FORMAT) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "unsupported archive format " + manifest.format());
        }
        String current = schemaVersion();
        if (!force && current != null && !current.equals(manifest.schemaVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "archive schema " + manifest.schemaVersion()
                    + " differs from the running schema " + current + " (use force to override)");
        }
        for (String table : DatabaseDump.TABLES) {
            if (!csv.containsKey(table)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "archive is missing table " + table);
            }
        }

        try {
            dump.restore(csv);
        } catch (java.sql.SQLException e) {
            throw new IOException("database restore failed: " + e.getMessage(), e);
        }
        for (Map.Entry<String, byte[]> m : media.entrySet()) {
            storage.put(m.getKey(), index.getOrDefault(m.getKey(), "application/octet-stream"), m.getValue());
        }
        clearCaches();
        log.info("Restored archive from {} ({} media)", manifest.createdAt(), media.size());
        return manifest;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    public String schemaVersion() {
        try {
            List<String> v = jdbc.queryForList(
                    "select version from flyway_schema_history where success order by installed_rank desc limit 1", String.class);
            return v.isEmpty() ? null : v.get(0);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private String appVersion() {
        BuildProperties bp = build.getIfAvailable();
        return bp == null ? "dev" : bp.getVersion();
    }

    private void clearCaches() {
        for (String name : cacheManager.getCacheNames()) {
            Cache cache = cacheManager.getCache(name);
            if (cache != null) {
                cache.clear();
            }
        }
    }

    private static void deleteQuietly(Path p) {
        if (p == null) {
            return;
        }
        try {
            Files.deleteIfExists(p);
        } catch (IOException ignored) {
            // temp file, best effort
        }
    }

    public List<DriveFile> emptyFiles() {
        return new ArrayList<>();
    }
}
