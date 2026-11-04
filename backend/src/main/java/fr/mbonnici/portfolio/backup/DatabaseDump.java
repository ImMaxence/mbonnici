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
                    copy.copyIn("COPY " + table + " FROM STDIN WITH (FORMAT csv, HEADER true)",
                            new ByteArrayInputStream(csv));
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
