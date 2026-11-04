package fr.mbonnici.portfolio.backup;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Single-row table: schedule, retention and the Google account linked for Drive uploads. */
@Entity
@Table(name = "backup_settings")
public class BackupSettings {

    @Id
    private Short id = 1;

    @Column(name = "auto_enabled", nullable = false)
    private boolean autoEnabled;

    @Column(name = "hour_utc", nullable = false)
    private short hourUtc = 3;

    @Column(name = "keep_count", nullable = false)
    private short keepCount = 14;

    @Column(name = "google_principal")
    private String googlePrincipal;

    @Column(name = "google_email")
    private String googleEmail;

    @Column(name = "drive_folder_id")
    private String driveFolderId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected BackupSettings() {}

    public Short getId() { return id; }
    public boolean isAutoEnabled() { return autoEnabled; }
    public void setAutoEnabled(boolean autoEnabled) { this.autoEnabled = autoEnabled; }
    public short getHourUtc() { return hourUtc; }
    public void setHourUtc(short hourUtc) { this.hourUtc = hourUtc; }
    public short getKeepCount() { return keepCount; }
    public void setKeepCount(short keepCount) { this.keepCount = keepCount; }
    public String getGooglePrincipal() { return googlePrincipal; }
    public void setGooglePrincipal(String googlePrincipal) { this.googlePrincipal = googlePrincipal; }
    public String getGoogleEmail() { return googleEmail; }
    public void setGoogleEmail(String googleEmail) { this.googleEmail = googleEmail; }
    public String getDriveFolderId() { return driveFolderId; }
    public void setDriveFolderId(String driveFolderId) { this.driveFolderId = driveFolderId; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void touch() { this.updatedAt = Instant.now(); }
}
