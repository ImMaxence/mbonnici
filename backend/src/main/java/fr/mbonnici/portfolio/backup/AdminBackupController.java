package fr.mbonnici.portfolio.backup;

import fr.mbonnici.portfolio.backup.BackupRun.Trigger;
import fr.mbonnici.portfolio.backup.BackupService.Overview;
import fr.mbonnici.portfolio.backup.BackupService.RunDto;
import fr.mbonnici.portfolio.backup.BackupService.Settings;
import fr.mbonnici.portfolio.common.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/backups")
public class AdminBackupController {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);
    private static final String FILE_ID = "^[A-Za-z0-9_-]{10,128}$";

    public record SettingsInput(boolean autoEnabled, @Min(0) @Max(23) int hourUtc, @Min(1) @Max(100) int keepCount) {}

    private final BackupService service;
    private final DriveAuthService auth;

    public AdminBackupController(BackupService service, DriveAuthService auth) {
        this.service = service;
        this.auth = auth;
    }

    @GetMapping
    public Overview overview() {
        return service.overview();
    }

    @PutMapping("/settings")
    public Settings settings(@Valid @RequestBody SettingsInput in) {
        return service.updateSettings(new Settings(in.autoEnabled(), in.hourUtc(), in.keepCount()));
    }

    @PostMapping("/run")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, UUID> run() {
        return Map.of("runId", service.startBackup(Trigger.MANUAL));
    }

    @PostMapping("/restore/{fileId}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, UUID> restore(@PathVariable String fileId, @RequestParam(defaultValue = "false") boolean force) {
        checkFileId(fileId);
        return Map.of("runId", service.startRestoreFromDrive(fileId, force));
    }

    @DeleteMapping("/files/{fileId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String fileId) {
        checkFileId(fileId);
        service.deleteDriveFile(fileId);
    }

    /** Streams a Drive archive back to the browser (keep an offline copy). */
    @GetMapping("/files/{fileId}/download")
    public void download(@PathVariable String fileId, HttpServletResponse response) throws IOException {
        checkFileId(fileId);
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition", "attachment; filename=\"mbonnici-" + fileId + ".zip\"");
        service.downloadDriveFile(fileId, response.getOutputStream());
        response.flushBuffer();
    }

    /** Builds a fresh archive on the fly, no Drive needed. */
    @GetMapping("/export")
    public void export(HttpServletResponse response) throws IOException {
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"mbonnici-" + STAMP.format(Instant.now()) + ".zip\"");
        response.setHeader("Cache-Control", "no-store");
        service.writeArchive(response.getOutputStream());
        response.flushBuffer();
    }

    /** Restores from an uploaded archive (synchronous; the site is unavailable for a few seconds). */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public RunDto importArchive(@RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean force) throws IOException {
        if (file.isEmpty()) {
            throw ApiException.badRequest("file is required");
        }
        try (InputStream in = file.getInputStream()) {
            return service.restoreUploaded(in, force);
        }
    }

    @PostMapping("/disconnect")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect() {
        auth.disconnect();
    }

    private static void checkFileId(String id) {
        if (id == null || !id.matches(FILE_ID)) {
            throw ApiException.badRequest("invalid Drive file id");
        }
    }
}
