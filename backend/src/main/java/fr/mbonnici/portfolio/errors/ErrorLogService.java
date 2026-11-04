package fr.mbonnici.portfolio.errors;

import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Errors of the site, read in the back office (Journal): JavaScript errors reported by visitors'
 * browsers and unexpected errors of the API. Identical errors are grouped by fingerprint (source,
 * message, first frames of the stack), with a counter and the first / last time seen. Nothing
 * identifies a visitor: no IP, no user agent, only the page path.
 */
@Service
public class ErrorLogService {

    private static final Logger log = LoggerFactory.getLogger(ErrorLogService.class);
    private static final int MAX_MESSAGE = 500;
    private static final int MAX_DETAIL = 6000;
    /** a busy error stops being counted after this many occurrences a day, the row stays */
    private static final int MAX_ROWS = 500;

    public enum Source { CLIENT, SERVER }

    public record Entry(long id, Source source, String message, String detail, String path, int occurrences,
            Instant firstSeen, Instant lastSeen, boolean resolved) {}

    public record Summary(long open, long last24h) {}

    private final JdbcTemplate jdbc;

    public ErrorLogService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Never throws: logging an error must not cause another one. */
    public void record(Source source, String message, String detail, String path) {
        try {
            String m = cut(message == null || message.isBlank() ? "(no message)" : message.strip(), MAX_MESSAGE);
            String d = detail == null ? null : cut(detail, MAX_DETAIL);
            String p = path == null ? null : cut(path, 300);
            String fp = fingerprint(source, m, d);
            int updated = jdbc.update("""
                    update error_log set occurrences = least(occurrences + 1, 1000000), last_seen = now(), resolved = false,
                           detail = coalesce(?, detail), path = coalesce(?, path)
                    where fingerprint = ?""", d, p, fp);
            if (updated == 0) {
                Long rows = jdbc.queryForObject("select count(*) from error_log", Long.class);
                if (rows != null && rows >= MAX_ROWS) {
                    return; // flood: keep what we have
                }
                jdbc.update("insert into error_log (fingerprint, source, message, detail, path) values (?, ?, ?, ?, ?) "
                        + "on conflict (fingerprint) do update set occurrences = error_log.occurrences + 1, last_seen = now()",
                        fp, source.name(), m, d, p);
            }
        } catch (RuntimeException e) {
            log.warn("Could not record an error: {}", e.getMessage());
        }
    }

    public void recordServer(Throwable ex, String path) {
        StringBuilder detail = new StringBuilder(ex.getClass().getName());
        StackTraceElement[] frames = ex.getStackTrace();
        for (int i = 0; i < Math.min(frames.length, 30); i++) {
            detail.append("\n  at ").append(frames[i]);
        }
        Throwable cause = ex.getCause();
        if (cause != null && cause != ex) {
            detail.append("\nCaused by: ").append(cause);
        }
        record(Source.SERVER, ex.getClass().getSimpleName() + ": " + ex.getMessage(), detail.toString(), path);
    }

    public List<Entry> list(boolean resolved) {
        return jdbc.query("""
                select id, source, message, detail, path, occurrences, first_seen, last_seen, resolved
                from error_log where resolved = ? order by last_seen desc limit 200""",
                (rs, i) -> new Entry(rs.getLong(1), Source.valueOf(rs.getString(2)), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getInt(6), rs.getTimestamp(7).toInstant(), rs.getTimestamp(8).toInstant(),
                        rs.getBoolean(9)), resolved);
    }

    public Summary summary() {
        Timestamp day = Timestamp.from(Instant.now().minus(Duration.ofDays(1)));
        Long open = jdbc.queryForObject("select count(*) from error_log where not resolved", Long.class);
        Long recent = jdbc.queryForObject("select count(*) from error_log where not resolved and last_seen >= ?", Long.class, day);
        return new Summary(open == null ? 0 : open, recent == null ? 0 : recent);
    }

    public boolean resolve(long id, boolean value) {
        return jdbc.update("update error_log set resolved = ? where id = ?", value, id) > 0;
    }

    public boolean delete(long id) {
        return jdbc.update("delete from error_log where id = ?", id) > 0;
    }

    public int deleteResolved() {
        return jdbc.update("delete from error_log where resolved");
    }

    /** resolved errors older than 30 days and anything not seen for 90 days go */
    @Scheduled(cron = "0 50 4 * * *")
    public void purge() {
        jdbc.update("delete from error_log where (resolved and last_seen < now() - interval '30 days') "
                + "or last_seen < now() - interval '90 days'");
    }

    private static String fingerprint(Source source, String message, String detail) {
        // numbers and ids in messages vary between occurrences of the same error
        String m = message.replaceAll("[0-9a-f]{8}-[0-9a-f-]{27}", "<id>").replaceAll("\\d+", "#");
        String head = detail == null ? "" : detail.lines().limit(4).reduce("", (a, b) -> a + "\n" + b.strip());
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update((source + "|" + m + "|" + head.replaceAll(":\\d+(:\\d+)?", "")).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(md.digest(), 0, 16);
        } catch (Exception e) {
            return Integer.toHexString((source + m + head).hashCode());
        }
    }

    private static String cut(String s, int max) {
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
