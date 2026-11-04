package fr.mbonnici.portfolio.backup;

import java.io.ByteArrayInputStream;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.postgresql.PGConnection;
import org.postgresql.copy.CopyManager;
import org.springframework.stereotype.Component;

/**
 * Logical, binary-free PostgreSQL dump: every content table is exported with {@code COPY … TO STDOUT}
 * as CSV and restored with {@code COPY … FROM STDIN} inside one transaction. The schema itself is
 * owned by Flyway, so a restore targets the same migration version (checked by the manifest).
 */
@Component
public class DatabaseDump {

    /** FK-safe order (parents first). Tokens, backup history and settings are deliberately excluded. */
    public static final List<String> TABLES = List.of(
            "media", "site_settings", "project", "project_media", "experience", "education", "skill",
            "contact_message", "analytics_event");

    /** Tables added after the first archive format: older archives may not have them (restored empty). */
    public static final java.util.Set<String> OPTIONAL = java.util.Set.of();

    /** Object keys inside an archive: an original or one of its responsive copies ("-w640"). */
    public static final String MEDIA_KEY = "^\\d{4}/\\d{2}/[0-9a-f-]{36}(-w\\d{3,4})?\\.[a-z0-9]{3,4}$";

    private final DataSource dataSource;

    public DatabaseDump(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public interface EntrySink {
        OutputStream open(String table) throws IOException;

        void close() throws IOException;
    }

    /** Writes one CSV per table through the sink (used to feed zip entries). */
    public void dump(EntrySink sink) throws SQLException, IOException {
        try (Connection c = dataSource.getConnection()) {
            CopyManager copy = c.unwrap(PGConnection.class).getCopyAPI();
            for (String table : TABLES) {
                OutputStream out = sink.open(table);
                copy.copyOut("COPY " + table + " TO STDOUT WITH (FORMAT csv, HEADER true)", new NonClosing(out));
                sink.close();
            }
        }
    }

    /** Current content of one table, in the same CSV dialect as an archive entry. */
    public byte[] dumpTable(String table) throws SQLException, IOException {
        if (!TABLES.contains(table)) {
            throw new IllegalArgumentException("unknown table " + table);
        }
        try (Connection c = dataSource.getConnection()) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            c.unwrap(PGConnection.class).getCopyAPI()
                    .copyOut("COPY " + table + " TO STDOUT WITH (FORMAT csv, HEADER true)", out);
            return out.toByteArray();
        }
    }

    /** Replaces all content with the given CSV payloads (table → csv bytes) atomically. */
    public void restore(Map<String, byte[]> csvByTable) throws SQLException, IOException {
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            try {
                CopyManager copy = c.unwrap(PGConnection.class).getCopyAPI();
                try (Statement st = c.createStatement()) {
                    st.execute("TRUNCATE " + String.join(", ", TABLES) + " RESTART IDENTITY CASCADE");
                }
                for (String table : TABLES) {
                    byte[] csv = csvByTable.get(table);
                    if (csv == null || csv.length == 0) {
                        continue;
                    }
                    // only the columns both sides know: an archive made before a migration added a
                    // column restores with that column's default
                    PgCsv.Table t = PgCsv.parse(csv);
                    List<String> live = columns(c, table);
                    List<Integer> keep = new java.util.ArrayList<>();
                    List<String> cols = new java.util.ArrayList<>();
                    for (int i = 0; i < t.header().size(); i++) {
                        if (live.contains(t.header().get(i))) {
                            keep.add(i);
                            cols.add(t.header().get(i));
                        }
                    }
                    if (cols.isEmpty()) {
                        continue;
                    }
                    List<List<String>> rows = t.rows().stream()
                            .map(r -> keep.stream().map(i -> i < r.size() ? r.get(i) : null).toList())
                            .toList();
                    String list = cols.stream().map(col -> "\"" + col.replace("\"", "") + "\"")
                            .collect(java.util.stream.Collectors.joining(", "));
                    copy.copyIn("COPY " + table + " (" + list + ") FROM STDIN WITH (FORMAT csv, HEADER true)",
                            new ByteArrayInputStream(PgCsv.write(cols, rows)));
                }
                try (Statement st = c.createStatement()) {
                    st.execute("SELECT setval(pg_get_serial_sequence('analytics_event', 'id'), "
                            + "COALESCE((SELECT max(id) FROM analytics_event), 1))");
                }
                c.commit();
            } catch (SQLException | IOException | RuntimeException e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        }
    }

    private static List<String> columns(Connection c, String table) throws SQLException {
        List<String> out = new java.util.ArrayList<>();
        try (var ps = c.prepareStatement("SELECT column_name FROM information_schema.columns "
                + "WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position")) {
            ps.setString(1, table);
            try (var rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
        }
        return out;
    }

    /** Keeps the zip stream open when the copy API is done with an entry. */
    private static final class NonClosing extends FilterOutputStream {
        NonClosing(OutputStream out) {
            super(out);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            out.write(b, off, len);
        }

        @Override
        public void close() throws IOException {
            out.flush();
        }
    }
}
