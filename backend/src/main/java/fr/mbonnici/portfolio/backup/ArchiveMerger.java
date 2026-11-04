package fr.mbonnici.portfolio.backup;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.postgresql.PGConnection;
import org.postgresql.copy.CopyManager;
import org.springframework.stereotype.Component;

/**
 * Selective restore: upserts chosen rows of an archive into the live database, in one transaction,
 * without touching anything that was not selected. Rows are matched on their primary key; a project
 * brings its gallery links with it.
 */
@Component
public class ArchiveMerger {

    /** Upsert order (parents first). project_media and analytics_event are handled separately. */
    static final List<String> ORDER = List.of("site_settings", "media", "project", "experience", "education", "skill",
            "contact_message");

    /**
     * @param ids       table → primary keys to insert or overwrite
     * @param analytics also import the analytics events that are missing from the live database
     */
    public record Plan(Map<String, Set<String>> ids, boolean analytics) {

        Set<String> of(String table) {
            return ids.getOrDefault(table, Set.of());
        }
    }

    private final DataSource dataSource;

    public ArchiveMerger(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /** @return number of rows written per table */
    public Map<String, Integer> merge(Map<String, PgCsv.Table> archive, Plan plan) throws SQLException, IOException {
        Map<String, Integer> written = new LinkedHashMap<>();
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            try {
                CopyManager copy = c.unwrap(PGConnection.class).getCopyAPI();
                for (String table : ORDER) {
                    Set<String> ids = plan.of(table);
                    PgCsv.Table t = archive.get(table);
                    if (ids.isEmpty() || t == null) {
                        continue;
                    }
                    List<List<String>> rows = select(t, ids);
                    if (rows.isEmpty()) {
                        continue;
                    }
                    List<String> cols = stage(c, copy, table, t, rows);
                    beforeUpsert(c, table);
                    try (Statement st = c.createStatement()) {
                        written.put(table, st.executeUpdate(upsert(table, cols)));
                    }
                }

                Set<String> projects = plan.of("project");
                PgCsv.Table links = archive.get("project_media");
                if (!projects.isEmpty() && links != null) {
                    written.put("project_media", replaceLinks(c, copy, links, projects));
                }

                PgCsv.Table events = archive.get("analytics_event");
                if (plan.analytics() && events != null && !events.rows().isEmpty()) {
                    written.put("analytics_event", importEvents(c, copy, events));
                }
                c.commit();
            } catch (SQLException | IOException | RuntimeException e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        }
        return written;
    }

    private static List<List<String>> select(PgCsv.Table t, Set<String> ids) {
        int id = t.column("id");
        return t.rows().stream().filter(r -> id >= 0 && ids.contains(r.get(id))).toList();
    }

    /** Copies rows into a temporary clone of the table; returns the columns shared by archive and schema. */
    private List<String> stage(Connection c, CopyManager copy, String table, PgCsv.Table t, List<List<String>> rows)
            throws SQLException, IOException {
        List<String> live = columns(c, table);
        List<Integer> keep = new ArrayList<>();
        List<String> cols = new ArrayList<>();
        for (int i = 0; i < t.header().size(); i++) {
            if (live.contains(t.header().get(i))) {
                keep.add(i);
                cols.add(t.header().get(i));
            }
        }
        List<List<String>> projected = rows.stream()
                .map(r -> keep.stream().map(i -> i < r.size() ? r.get(i) : null).toList())
                .toList();
        try (Statement st = c.createStatement()) {
            st.execute("CREATE TEMP TABLE tmp_" + table + " (LIKE " + table + " INCLUDING DEFAULTS) ON COMMIT DROP");
        }
        copy.copyIn("COPY tmp_" + table + " (" + quoted(cols) + ") FROM STDIN WITH (FORMAT csv, HEADER true)",
                new ByteArrayInputStream(PgCsv.write(cols, projected)));
        return cols;
    }

    /** Unique keys other than the id: the archived row wins over a different live row with the same key. */
    private static void beforeUpsert(Connection c, String table) throws SQLException {
        try (Statement st = c.createStatement()) {
            switch (table) {
                case "project" -> {
                    st.execute("UPDATE tmp_project t SET cover_media_id = NULL WHERE cover_media_id IS NOT NULL "
                            + "AND NOT EXISTS (SELECT 1 FROM media m WHERE m.id = t.cover_media_id)");
                    st.execute("DELETE FROM project p USING tmp_project t WHERE p.slug = t.slug AND p.id <> t.id");
                }
                case "media" -> st.execute(
                        "DELETE FROM media m USING tmp_media t WHERE m.object_key = t.object_key AND m.id <> t.id");
                default -> {
                    // no secondary unique key
                }
            }
        }
    }

    private static String upsert(String table, List<String> cols) {
        String list = quoted(cols);
        String set = cols.stream().filter(col -> !col.equals("id"))
                .map(col -> "\"" + col + "\" = EXCLUDED.\"" + col + "\"")
                .collect(Collectors.joining(", "));
        return "INSERT INTO " + table + " (" + list + ") SELECT " + list + " FROM tmp_" + table
                + " ON CONFLICT (id) DO " + (set.isEmpty() ? "NOTHING" : "UPDATE SET " + set);
    }

    /** A restored project gets exactly its archived gallery (links to missing images are skipped). */
    private int replaceLinks(Connection c, CopyManager copy, PgCsv.Table links, Set<String> projects)
            throws SQLException, IOException {
        int project = links.column("project_id");
        List<List<String>> rows = links.rows().stream().filter(r -> projects.contains(r.get(project))).toList();
        try (PreparedStatement ps = c.prepareStatement("DELETE FROM project_media WHERE project_id = ANY (?)")) {
            Array arr = c.createArrayOf("uuid", projects.toArray());
            ps.setArray(1, arr);
            ps.executeUpdate();
        }
        if (rows.isEmpty()) {
            return 0;
        }
        List<String> cols = stage(c, copy, "project_media", links, rows);
        String list = quoted(cols);
        try (Statement st = c.createStatement()) {
            return st.executeUpdate("INSERT INTO project_media (" + list + ") SELECT " + list + " FROM tmp_project_media t "
                    + "WHERE EXISTS (SELECT 1 FROM media m WHERE m.id = t.media_id) "
                    + "AND EXISTS (SELECT 1 FROM project p WHERE p.id = t.project_id) ON CONFLICT DO NOTHING");
        }
    }

    /** Adds the events the live database does not have yet (existing ids are left untouched). */
    private int importEvents(Connection c, CopyManager copy, PgCsv.Table events) throws SQLException, IOException {
        List<String> cols = stage(c, copy, "analytics_event", events, events.rows());
        String list = quoted(cols);
        try (Statement st = c.createStatement()) {
            st.execute("UPDATE tmp_analytics_event t SET project_id = NULL WHERE project_id IS NOT NULL "
                    + "AND NOT EXISTS (SELECT 1 FROM project p WHERE p.id = t.project_id)");
            int n = st.executeUpdate("INSERT INTO analytics_event (" + list + ") SELECT " + list
                    + " FROM tmp_analytics_event ON CONFLICT (id) DO NOTHING");
            st.execute("SELECT setval(pg_get_serial_sequence('analytics_event', 'id'), "
                    + "COALESCE((SELECT max(id) FROM analytics_event), 1))");
            return n;
        }
    }

    private static List<String> columns(Connection c, String table) throws SQLException {
        List<String> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT column_name FROM information_schema.columns "
                + "WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
        }
        return out;
    }

    private static String quoted(List<String> cols) {
        return cols.stream().map(col -> "\"" + col.replace("\"", "") + "\"").collect(Collectors.joining(", "));
    }
}
