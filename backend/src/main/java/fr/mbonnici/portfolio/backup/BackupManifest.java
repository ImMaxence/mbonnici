package fr.mbonnici.portfolio.backup;

import java.time.Instant;

/** First entry of every archive: identifies the format and the schema it was taken from. */
public record BackupManifest(
        int format,
        String appVersion,
        String schemaVersion,
        Instant createdAt,
        int tables,
        int mediaCount,
        long mediaBytes) {

    public static final int FORMAT = 1;
}
