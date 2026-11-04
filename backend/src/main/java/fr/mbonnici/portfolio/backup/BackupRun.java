package fr.mbonnici.portfolio.backup;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** One backup or restore execution, kept as history for the back office. */
@Entity
@Table(name = "backup_run")
public class BackupRun {

    public enum Kind { BACKUP, RESTORE }
    public enum Trigger { MANUAL, SCHEDULED, DOWNLOAD, UPLOAD }
    public enum Status { RUNNING, SUCCESS, FAILED }

    @Id
    @GeneratedValue
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Trigger trigger;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.RUNNING;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "drive_file_id")
    private String driveFileId;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    private String message;

    protected BackupRun() {}

    public static BackupRun start(Kind kind, Trigger trigger) {
        BackupRun r = new BackupRun();
        r.kind = kind;
        r.trigger = trigger;
        return r;
    }

    public void succeed(String fileName, String driveFileId, Long sizeBytes, String message) {
        this.status = Status.SUCCESS;
        this.fileName = fileName;
        this.driveFileId = driveFileId;
        this.sizeBytes = sizeBytes;
        this.message = message;
        this.finishedAt = Instant.now();
    }

    public void fail(String message) {
        this.status = Status.FAILED;
        this.message = message == null ? "unknown error" : message.substring(0, Math.min(500, message.length()));
        this.finishedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Kind getKind() { return kind; }
    public Trigger getTrigger() { return trigger; }
    public Status getStatus() { return status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public String getFileName() { return fileName; }
    public String getDriveFileId() { return driveFileId; }
    public Long getSizeBytes() { return sizeBytes; }
    public String getMessage() { return message; }
}
