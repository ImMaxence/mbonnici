package fr.mbonnici.portfolio.backup;

import fr.mbonnici.portfolio.backup.BackupRun.Trigger;
import fr.mbonnici.portfolio.backup.BackupService.RunDto;
import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.storage.StorageService;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Two-step restore: an archive is first <em>staged</em> (kept on disk for an hour) and compared with
 * the live data, row by row; the admin then either replaces everything or merges only the rows they
 * picked.
 */
@Service
public class RestoreStagingService {

    private static final Logger log = LoggerFactory.getLogger(RestoreStagingService.class);
    private static final Duration TTL = Duration.ofHours(1);
    private static final int MAX_STAGED = 3;
    private static final String MEDIA_KEY = DatabaseDump.MEDIA_KEY;

    /** Tables offered for selection, in display order. */
    static final List<String> VISIBLE = List.of("site_settings", "project", "experience", "education", "skill",
            "testimonial", "media", "contact_message", "analytics_event");
    /** Columns that change on every save and would make every row look modified. */
    private static final Set<String> VOLATILE = Set.of("updated_at");

    public enum Mode { REPLACE, MERGE }

    public enum RowStatus { NEW, CONFLICT, CHANGED, CURRENT_ONLY, SAME }

    public record RowDiff(String id, String label, String detail, RowStatus status, List<String> changes) {}

    public record TableDiff(String table, int archive, int current, int added, int changed, int same, int currentOnly,
            int conflicts, List<RowDiff> rows) {}

    public record Preview(String id, String source, BackupManifest manifest, String currentSchema, boolean schemaMatches,
            Instant expiresAt, List<TableDiff> tables, int mediaObjects, long mediaBytes) {}

    public record ApplyRequest(Mode mode, Map<String, List<String>> rows, Boolean analytics, Boolean force) {

        boolean importAnalytics() {
            return Boolean.TRUE.equals(analytics);
        }

        boolean forced() {
            return Boolean.TRUE.equals(force);
        }
    }

    private record Staged(String id, Path file, String source, Trigger trigger, BackupManifest manifest,
            Map<String, PgCsv.Table> tables, Map<String, String> mediaTypes, Set<String> mediaKeys, long mediaBytes,
            Instant createdAt) {}

    private final BackupService backups;
    private final DatabaseDump dump;
    private final ArchiveMerger merger;
    private final StorageService storage;
    private final ObjectMapper mapper;
    private final fr.mbonnici.portfolio.media.MediaService media;
    private final Map<String, Staged> staged = new ConcurrentHashMap<>();

    public RestoreStagingService(BackupService backups, DatabaseDump dump, ArchiveMerger merger, StorageService storage,
            ObjectMapper mapper, fr.mbonnici.portfolio.media.MediaService media) {
        this.backups = backups;
        this.dump = dump;
        this.merger = merger;
        this.storage = storage;
        this.mapper = mapper;
        this.media = media;
    }

    // ── staging ──────────────────────────────────────────────────────────────

    public Preview stageUpload(InputStream in, String fileName) throws IOException {
        Path tmp = Files.createTempFile("mbonnici-stage-", ".zip");
        try {
            Files.copy(in, tmp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return preview(stage(tmp, fileName == null ? "archive.zip" : fileName, Trigger.UPLOAD));
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(tmp);
            throw e;
        }
    }

    public Preview stageDrive(String fileId, String name) throws IOException {
        Path tmp = Files.createTempFile("mbonnici-stage-", ".zip");
        try {
            try (OutputStream out = Files.newOutputStream(tmp)) {
                backups.downloadDriveFile(fileId, out);
            }
            return preview(stage(tmp, name == null ? fileId : name, Trigger.MANUAL));
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(tmp);
            throw e;
        }
    }

    public Preview preview(String id) {
        return preview(get(id));
    }

    public void discard(String id) {
        Staged s = staged.remove(id);
        if (s != null) {
            deleteQuietly(s.file());
        }
    }

    private Staged stage(Path file, String source, Trigger trigger) throws IOException {
        BackupManifest manifest = null;
        Map<String, PgCsv.Table> tables = new LinkedHashMap<>();
        Map<String, String> types = Map.of();
        Set<String> keys = new HashSet<>();
        long bytes = 0;
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(file), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                String name = e.getName();
                if (name.equals("manifest.json")) {
                    manifest = mapper.readValue(zip.readAllBytes(), BackupManifest.class);
                } else if (name.startsWith("db/") && name.endsWith(".csv")) {
                    tables.put(name.substring(3, name.length() - 4), PgCsv.parse(zip.readAllBytes()));
                } else if (name.equals("media-index.json")) {
                    types = mapper.readValue(zip.readAllBytes(),
                            mapper.getTypeFactory().constructMapType(Map.class, String.class, String.class));
                } else if (name.startsWith("media/") && !e.isDirectory()) {
                    String key = name.substring(6);
                    if (!key.matches(MEDIA_KEY)) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, "archive contains an invalid media key: " + key);
                    }
                    keys.add(key);
                    bytes += zip.transferTo(OutputStream.nullOutputStream());
                }
                zip.closeEntry();
            }
        } catch (java.util.zip.ZipException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "not a valid zip archive");
        }
        if (manifest == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "not a mbonnici backup archive (manifest missing)");
        }
        if (manifest.format() != BackupManifest.FORMAT) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "unsupported archive format " + manifest.format());
        }
        for (String table : DatabaseDump.TABLES) {
            if (!tables.containsKey(table)) {
                if (!DatabaseDump.OPTIONAL.contains(table)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "archive is missing table " + table);
                }
                // made before this table existed: nothing in it
                try {
                    tables.put(table, new PgCsv.Table(PgCsv.parse(dump.dumpTable(table)).header(), List.of()));
                } catch (java.sql.SQLException ex) {
                    throw new IOException("cannot read table " + table, ex);
                }
            }
        }
        evictIfFull();
        Staged s = new Staged(UUID.randomUUID().toString(), file, source, trigger, manifest, tables, types, keys, bytes,
                Instant.now());
        staged.put(s.id(), s);
        return s;
    }

    // ── comparison ───────────────────────────────────────────────────────────

    private Preview preview(Staged s) {
        String current = backups.schemaVersion();
        List<TableDiff> diffs = new ArrayList<>();
        Map<String, PgCsv.Table> live = new HashMap<>();
        for (String table : DatabaseDump.TABLES) {
            try {
                live.put(table, PgCsv.parse(dump.dumpTable(table)));
            } catch (Exception e) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "cannot read table " + table + ": " + e.getMessage());
            }
        }
        for (String table : VISIBLE) {
            diffs.add(diff(table, s.tables().get(table), live.get(table), s.tables(), live));
        }
        return new Preview(s.id(), s.source(), s.manifest(), current, Objects.equals(current, s.manifest().schemaVersion()),
                s.createdAt().plus(TTL), diffs, s.mediaKeys().size(), s.mediaBytes());
    }

    private TableDiff diff(String table, PgCsv.Table archive, PgCsv.Table live, Map<String, PgCsv.Table> archiveAll,
            Map<String, PgCsv.Table> liveAll) {
        Map<String, List<String>> a = byId(archive);
        Map<String, List<String>> b = byId(live);
        Map<String, String> linksA = table.equals("project") ? linkSignatures(archiveAll.get("project_media")) : Map.of();
        Map<String, String> linksB = table.equals("project") ? linkSignatures(liveAll.get("project_media")) : Map.of();
        String uniqueCol = switch (table) {
            case "project" -> "slug";
            case "media" -> "object_key";
            default -> null;
        };
        Map<String, String> liveUnique = new HashMap<>();
        if (uniqueCol != null) {
            for (List<String> row : live.rows()) {
                liveUnique.put(live.get(row, uniqueCol), live.get(row, "id"));
            }
        }

        List<RowDiff> rows = new ArrayList<>();
        int added = 0;
        int changed = 0;
        int same = 0;
        int conflicts = 0;
        for (Map.Entry<String, List<String>> e : a.entrySet()) {
            String id = e.getKey();
            List<String> row = e.getValue();
            List<String> other = b.get(id);
            RowStatus status;
            List<String> changes = List.of();
            if (other == null) {
                String clash = uniqueCol == null ? null : liveUnique.get(archive.get(row, uniqueCol));
                if (clash != null && !clash.equals(id)) {
                    status = RowStatus.CONFLICT;
                    conflicts++;
                } else {
                    status = RowStatus.NEW;
                    added++;
                }
            } else {
                changes = changedColumns(archive, row, live, other);
                if (table.equals("project") && !Objects.equals(linksA.getOrDefault(id, ""), linksB.getOrDefault(id, ""))) {
                    changes = new ArrayList<>(changes);
                    changes.add("gallery");
                }
                if (changes.isEmpty()) {
                    status = RowStatus.SAME;
                    same++;
                } else {
                    status = RowStatus.CHANGED;
                    changed++;
                }
            }
            rows.add(new RowDiff(id, label(table, archive, row), detail(table, archive, row), status, changes));
        }
        int currentOnly = 0;
        for (Map.Entry<String, List<String>> e : b.entrySet()) {
            if (!a.containsKey(e.getKey())) {
                currentOnly++;
                rows.add(new RowDiff(e.getKey(), label(table, live, e.getValue()), detail(table, live, e.getValue()),
                        RowStatus.CURRENT_ONLY, List.of()));
            }
        }
        rows.sort(Comparator.comparing(RowDiff::status).thenComparing(r -> r.label() == null ? "" : r.label()));
        // analytics: thousands of anonymous rows, counts only
        boolean bulk = table.equals("analytics_event");
        return new TableDiff(table, a.size(), b.size(), added, changed, same, currentOnly, conflicts, bulk ? null : rows);
    }

    private static Map<String, List<String>> byId(PgCsv.Table t) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        int id = t.column("id");
        if (id < 0) {
            return out;
        }
        for (List<String> row : t.rows()) {
            out.put(row.get(id), row);
        }
        return out;
    }

    private static List<String> changedColumns(PgCsv.Table ta, List<String> a, PgCsv.Table tb, List<String> b) {
        List<String> out = new ArrayList<>();
        for (String col : ta.header()) {
            if (col.equals("id") || VOLATILE.contains(col) || tb.column(col) < 0) {
                continue;
            }
            if (!Objects.equals(ta.get(a, col), tb.get(b, col))) {
                out.add(col);
            }
        }
        return out;
    }

    /** project id → sorted "media:kind:order" list, so a changed gallery shows up as a change. */
    private static Map<String, String> linkSignatures(PgCsv.Table links) {
        Map<String, List<String>> acc = new HashMap<>();
        for (List<String> r : links.rows()) {
            acc.computeIfAbsent(links.get(r, "project_id"), k -> new ArrayList<>())
                    .add(links.get(r, "media_id") + ":" + links.get(r, "kind") + ":" + links.get(r, "sort_order"));
        }
        Map<String, String> out = new HashMap<>();
        acc.forEach((k, v) -> out.put(k, v.stream().sorted().toList().toString()));
        return out;
    }

    private static String label(String table, PgCsv.Table t, List<String> r) {
        return switch (table) {
            case "site_settings" -> t.get(r, "owner_name");
            case "project" -> t.get(r, "title_fr");
            case "experience" -> t.get(r, "company") + " — " + t.get(r, "role_fr");
            case "education" -> t.get(r, "school");
            case "skill" -> t.get(r, "name");
            case "testimonial" -> t.get(r, "author");
            case "media" -> Objects.requireNonNullElse(t.get(r, "original_filename"), t.get(r, "object_key"));
            case "contact_message" -> t.get(r, "name") + " <" + t.get(r, "email") + ">";
            default -> t.get(r, "id");
        };
    }

    private static String detail(String table, PgCsv.Table t, List<String> r) {
        return switch (table) {
            case "site_settings" -> t.get(r, "headline_fr");
            case "project" -> "/" + t.get(r, "slug") + " · " + t.get(r, "status");
            case "experience" -> t.get(r, "start_date") + " → " + Objects.requireNonNullElse(t.get(r, "end_date"), "…");
            case "education" -> t.get(r, "degree_fr");
            case "skill" -> t.get(r, "category") + " · " + t.get(r, "level");
            case "testimonial" -> {
                String q = Objects.requireNonNullElse(t.get(r, "quote_fr"), "");
                yield q.length() > 90 ? q.substring(0, 90) + "…" : q;
            }
            case "media" -> t.get(r, "content_type") + " · " + t.get(r, "width") + "×" + t.get(r, "height");
            case "contact_message" -> {
                String msg = Objects.requireNonNullElse(t.get(r, "message"), "");
                yield t.get(r, "created_at") + " · " + (msg.length() > 90 ? msg.substring(0, 90) + "…" : msg);
            }
            default -> null;
        };
    }

    // ── apply ────────────────────────────────────────────────────────────────

    public RunDto apply(String id, ApplyRequest req) {
        Staged s = get(id);
        Mode mode = req.mode() == null ? Mode.MERGE : req.mode();
        String current = backups.schemaVersion();
        if (!req.forced() && current != null && !current.equals(s.manifest().schemaVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "archive schema " + s.manifest().schemaVersion()
                    + " differs from the running schema " + current + " (use force to override)");
        }
        RunDto run = backups.exclusive(s.trigger(), s.source(), () -> mode == Mode.REPLACE ? replace(s, req.forced()) : merge(s, req));
        discard(id);
        // pictures restored without their responsive copies get them back in the background
        media.backfillVariants();
        return run;
    }

    private String replace(Staged s, boolean force) throws IOException {
        try (InputStream in = Files.newInputStream(s.file())) {
            BackupManifest m = backups.restoreArchive(in, force);
            return "full restore: " + m.mediaCount() + " media, schema " + m.schemaVersion();
        }
    }

    private String merge(Staged s, ApplyRequest req) throws Exception {
        Map<String, Set<String>> ids = new HashMap<>();
        Map<String, List<String>> asked = req.rows() == null ? Map.of() : req.rows();
        for (String table : ArchiveMerger.ORDER) {
            Set<String> known = byId(s.tables().get(table)).keySet();
            Set<String> chosen = new HashSet<>();
            for (String v : asked.getOrDefault(table, List.of())) {
                if (known.contains(v)) {
                    chosen.add(v);
                }
            }
            ids.put(table, chosen);
        }

        // a project brings its images (cover + gallery) when they are not on the live site yet
        Set<String> liveMedia = byId(PgCsv.parse(dump.dumpTable("media"))).keySet();
        PgCsv.Table projects = s.tables().get("project");
        PgCsv.Table links = s.tables().get("project_media");
        Set<String> needed = new HashSet<>();
        for (List<String> p : projects.rows()) {
            if (ids.get("project").contains(projects.get(p, "id")) && projects.get(p, "cover_media_id") != null) {
                needed.add(projects.get(p, "cover_media_id"));
            }
        }
        PgCsv.Table settingsTable = s.tables().get("site_settings");
        for (List<String> r : settingsTable.rows()) {
            if (ids.get("site_settings").contains(settingsTable.get(r, "id")) && settingsTable.get(r, "avatar_media_id") != null) {
                needed.add(settingsTable.get(r, "avatar_media_id"));
            }
        }
        for (List<String> l : links.rows()) {
            if (ids.get("project").contains(links.get(l, "project_id"))) {
                needed.add(links.get(l, "media_id"));
            }
        }
        Set<String> archiveMedia = byId(s.tables().get("media")).keySet();
        for (String m : needed) {
            if (!liveMedia.contains(m) && archiveMedia.contains(m)) {
                ids.get("media").add(m);
            }
        }

        int total = ids.values().stream().mapToInt(Set::size).sum();
        if (total == 0 && !req.importAnalytics()) {
            throw ApiException.badRequest("nothing selected");
        }
        Map<String, Integer> written = merger.merge(s.tables(), new ArchiveMerger.Plan(ids, req.importAnalytics()));

        // copy the binary of every merged image
        Set<String> keys = new HashSet<>();
        PgCsv.Table media = s.tables().get("media");
        for (List<String> r : media.rows()) {
            if (ids.get("media").contains(media.get(r, "id"))) {
                keys.add(media.get(r, "object_key"));
            }
        }
        // the settings bring their resume PDFs
        for (List<String> r : settingsTable.rows()) {
            if (ids.get("site_settings").contains(settingsTable.get(r, "id"))) {
                for (String column : List.of("cv_fr_key", "cv_en_key")) {
                    String key = settingsTable.get(r, column);
                    if (key != null && key.matches(MEDIA_KEY)) {
                        keys.add(key);
                    }
                }
            }
        }
        int objects = keys.isEmpty() ? 0 : copyObjects(s, keys);
        log.info("Merged archive {}: {} rows, {} objects", s.source(), written, objects);
        return "merge: " + written.entrySet().stream().map(e -> e.getKey() + " " + e.getValue()).toList()
                + (objects > 0 ? ", " + objects + " images" : "");
    }

    private int copyObjects(Staged s, Set<String> keys) throws IOException {
        int n = 0;
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(s.file()), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                String name = e.getName();
                // the original and its responsive copies
                if (name.startsWith("media/") && keys.contains(name.substring(6).replaceFirst("-w\\d{3,4}(\\.[a-z0-9]+)$", "$1"))) {
                    String key = name.substring(6);
                    storage.put(key, s.mediaTypes().getOrDefault(key, "application/octet-stream"), zip.readAllBytes());
                    n++;
                }
                zip.closeEntry();
            }
        }
        return n;
    }

    // ── housekeeping ─────────────────────────────────────────────────────────

    private Staged get(String id) {
        Staged s = id == null ? null : staged.get(id);
        if (s == null || s.createdAt().plus(TTL).isBefore(Instant.now())) {
            if (s != null) {
                discard(id);
            }
            throw new ApiException(HttpStatus.NOT_FOUND, "staged archive expired, upload it again");
        }
        return s;
    }

    private void evictIfFull() {
        while (staged.size() >= MAX_STAGED) {
            staged.values().stream().min(Comparator.comparing(Staged::createdAt)).ifPresent(s -> discard(s.id()));
        }
    }

    @Scheduled(fixedDelay = 600_000)
    public void expire() {
        Instant limit = Instant.now().minus(TTL);
        staged.values().stream().filter(s -> s.createdAt().isBefore(limit)).map(Staged::id).toList().forEach(this::discard);
    }

    @PreDestroy
    void cleanup() {
        List.copyOf(staged.keySet()).forEach(this::discard);
    }

    private static void deleteQuietly(Path p) {
        try {
            Files.deleteIfExists(p);
        } catch (IOException ignored) {
            // temp file, best effort
        }
    }
}
