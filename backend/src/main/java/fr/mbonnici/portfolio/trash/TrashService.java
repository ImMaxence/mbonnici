package fr.mbonnici.portfolio.trash;

import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.common.NotFoundException;
import fr.mbonnici.portfolio.media.Media;
import fr.mbonnici.portfolio.profile.ProfileService;
import fr.mbonnici.portfolio.storage.StorageService;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The back office's bin. Before a project, a media, a profile entry, a message or a resume is
 * deleted, its rows (and the rows that go with it, such as the pictures of a project) are copied
 * here as JSON, with the links the deletion cuts (a project cover, the header picture, the visits
 * of a project) and the bucket objects it would have erased. A restore puts the rows back with
 * their own ids, through {@code jsonb_populate_recordset}, so it follows the current schema; links
 * to something deleted since are dropped. After {@link #KEEP} the item and its objects go for good.
 */
@Service
public class TrashService {

    private static final Logger log = LoggerFactory.getLogger(TrashService.class);

    public static final Duration KEEP = Duration.ofDays(30);

    public enum Kind { PROJECT, MEDIA, EXPERIENCE, EDUCATION, SKILL, NEWS, MESSAGE, CV }

    /** tables a snapshot may hold rows of (they become SQL identifiers) */
    private static final List<String> TABLES = List.of("media", "project", "project_media", "experience", "education",
            "skill", "testimonial", "contact_message");

    /** one row of the bin, for the back office */
    public record Item(UUID id, Kind kind, String label, String detail, int count, Instant deletedAt, Instant expiresAt,
            String preview) {}

    /** what a restore brought back: the kind and, for a project or a media, its id */
    public record Restored(Kind kind, UUID id) {}

    private final JdbcTemplate jdbc;
    private final StorageService storage;
    private final CacheManager caches;

    public TrashService(JdbcTemplate jdbc, StorageService storage, CacheManager caches) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.caches = caches;
    }

    // ── putting things in ────────────────────────────────────────────────────

    /** What a deletion takes away: built by the service that deletes, saved by {@link #put}. */
    public static final class Snapshot {
        private final Kind kind;
        private final String label;
        private final String detail;
        private final List<Query> rows = new ArrayList<>();
        private final List<Query> links = new ArrayList<>();
        private final List<String> keys = new ArrayList<>();

        private record Query(String name, String sql, Object[] args) {}

        public Snapshot(Kind kind, String label, String detail) {
            this.kind = kind;
            this.label = label == null ? "" : label;
            this.detail = detail;
        }

        /** the rows of {@code table} matching {@code where} (on alias {@code t}) */
        public Snapshot rows(String table, String where, Object... args) {
            if (!TABLES.contains(table)) {
                throw new IllegalArgumentException("not a bin table: " + table);
            }
            rows.add(new Query(table, "select * from " + table + " t where " + where, args));
            return this;
        }

        /** a list of objects to put back by hand on restore, e.g. {@code select id from project where …} */
        public Snapshot link(String name, String select, Object... args) {
            if (!name.matches("[a-z_]+")) {
                throw new IllegalArgumentException("bad link name: " + name);
            }
            links.add(new Query(name, select, args));
            return this;
        }

        /** bucket objects to keep until the item is emptied */
        public Snapshot keys(List<String> objectKeys) {
            keys.addAll(objectKeys);
            return this;
        }
    }

    /** Saves the snapshot; call it in the deleting transaction, before the delete. */
    @Transactional
    public UUID put(Snapshot s) {
        StringBuilder payload = new StringBuilder("{\"rows\":{");
        payload.append(s.rows.stream().map(q -> "\"" + q.name() + "\":" + json(q)).collect(Collectors.joining(",")));
        payload.append("},\"links\":{");
        payload.append(s.links.stream().map(q -> "\"" + q.name() + "\":" + json(q)).collect(Collectors.joining(",")));
        payload.append("},\"keys\":[");
        payload.append(s.keys.stream().map(TrashService::jsonString).collect(Collectors.joining(",")));
        payload.append("]}");
        return jdbc.queryForObject("insert into trash_item (kind, label, detail, payload) values (?, ?, ?, ?::jsonb) returning id",
                UUID.class, s.kind.name(), s.label, s.detail, payload.toString());
    }

    private String json(Snapshot.Query q) {
        return jdbc.queryForObject("select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)::text from (" + q.sql() + ") x",
                String.class, q.args());
    }

    private static String jsonString(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    // ── reading ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Item> list() {
        return jdbc.query("""
                select ti.id, ti.kind, ti.label, ti.detail, ti.deleted_at,
                       coalesce(jsonb_array_length(ti.payload #> '{rows,media}'), 0) as media_count,
                       (select m.object_key from media m
                         where m.id = (ti.payload #>> '{rows,project,0,cover_media_id}')::uuid) as cover_key,
                       ti.payload #>> '{rows,media,0,content_type}' as media_type
                from trash_item ti
                order by ti.deleted_at desc
                """, (rs, i) -> {
            Kind kind = Kind.valueOf(rs.getString("kind"));
            UUID id = rs.getObject("id", UUID.class);
            Instant deleted = rs.getTimestamp("deleted_at").toInstant();
            int mediaCount = rs.getInt("media_count");
            String preview = null;
            if (kind == Kind.PROJECT && rs.getString("cover_key") != null) {
                preview = "/api/media/" + rs.getString("cover_key");
            } else if (kind == Kind.MEDIA && rs.getString("media_type") != null && rs.getString("media_type").startsWith("image/")) {
                preview = "/api/admin/trash/" + id + "/preview";
            }
            return new Item(id, kind, rs.getString("label"), rs.getString("detail"), kind == Kind.MEDIA ? mediaCount : 1,
                    deleted, deleted.plus(KEEP), preview);
        });
    }

    /** the first picture of a media item, its smallest copy when there is one */
    @Transactional(readOnly = true)
    public Optional<StorageService.StoredObject> preview(UUID id) {
        List<Map<String, Object>> found = jdbc.queryForList("""
                select ti.payload #>> '{rows,media,0,object_key}' as object_key,
                       ti.payload #>> '{rows,media,0,content_type}' as content_type,
                       coalesce(ti.payload #> '{rows,media,0,variant_widths}' @> '[640]'::jsonb, false) as has_640
                from trash_item ti where ti.id = ? and ti.kind = 'MEDIA'
                """, id);
        if (found.isEmpty() || found.get(0).get("object_key") == null) {
            return Optional.empty();
        }
        String key = (String) found.get(0).get("object_key");
        String type = (String) found.get(0).get("content_type");
        if (type == null || !type.startsWith("image/")) {
            return Optional.empty();
        }
        if (Boolean.TRUE.equals(found.get(0).get("has_640"))) {
            Optional<StorageService.StoredObject> small = storage.get(Media.variantKey(key, 640));
            if (small.isPresent()) {
                return small;
            }
        }
        return storage.get(key);
    }

    // ── restoring ────────────────────────────────────────────────────────────

    @Transactional
    public Restored restore(UUID id) {
        Kind kind = jdbc.query("select kind from trash_item where id = ? for update", (rs, i) -> Kind.valueOf(rs.getString(1)), id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Trash item"));
        UUID restored = switch (kind) {
            case PROJECT -> restoreProject(id);
            case MEDIA -> restoreMedia(id);
            case EXPERIENCE -> restoreSingle(id, "experience");
            case EDUCATION -> restoreSingle(id, "education");
            case SKILL -> restoreSingle(id, "skill");
            case NEWS -> restoreSingle(id, "testimonial");
            case MESSAGE -> restoreSingle(id, "contact_message");
            case CV -> {
                restoreCv(id);
                yield null;
            }
        };
        jdbc.update("delete from trash_item where id = ?", id);
        clearCaches();
        return new Restored(kind, restored);
    }

    private UUID restoreProject(UUID item) {
        String slug = field(item, "{rows,project,0,slug}");
        UUID projectId = UUID.fromString(field(item, "{rows,project,0,id}"));
        if (exists("select 1 from project where id = ?", projectId)) {
            throw ApiException.conflict("trash.back · this project is already back");
        }
        if (exists("select 1 from project where slug = ?", slug)) {
            throw ApiException.conflict("trash.slug · another project already uses the address " + slug);
        }
        // its pictures may have been deleted since: the cover and the video are then left empty
        insertRows(item, "project", Map.of(
                "cover_media_id", "(select m.id from media m where m.id = r.cover_media_id)",
                "cover_video_media_id", "(select m.id from media m where m.id = r.cover_video_media_id)"), null);
        insertRows(item, "project_media", Map.of(), PROJECT_MEDIA_STILL_VALID);
        // the visits counted for it before the deletion
        jdbc.update("""
                update analytics_event e set project_id = ?
                from trash_item ti
                where ti.id = ? and e.project_id is null
                  and e.id in (select (l ->> 'id')::bigint from jsonb_array_elements(ti.payload #> '{links,analytics}') l)
                """, projectId, item);
        return projectId;
    }

    private UUID restoreMedia(UUID item) {
        if (exists("""
                select 1 from media m, trash_item ti, jsonb_populate_recordset(null::media, ti.payload #> '{rows,media}') r
                where ti.id = ? and (m.id = r.id or m.object_key = r.object_key)
                """, item)) {
            throw ApiException.conflict("trash.back · this media is already back");
        }
        insertRows(item, "media", Map.of(), null);
        insertRows(item, "project_media", Map.of(), PROJECT_MEDIA_STILL_VALID);
        // covers, videos and the header picture it was, unless something else took the place since
        for (String column : List.of("cover_media_id", "cover_video_media_id")) {
            String link = column.equals("cover_media_id") ? "covers" : "videos";
            jdbc.update("update project p set " + column + " = (l ->> 'media_id')::uuid "
                    + "from trash_item ti, jsonb_array_elements(ti.payload #> '{links," + link + "}') l "
                    + "where ti.id = ? and p.id = (l ->> 'id')::uuid and p." + column + " is null", item);
        }
        jdbc.update("""
                update site_settings s set avatar_media_id = (l ->> 'media_id')::uuid
                from trash_item ti, jsonb_array_elements(ti.payload #> '{links,avatar}') l
                where ti.id = ? and s.avatar_media_id is null
                """, item);
        String first = field(item, "{rows,media,0,id}");
        return first == null ? null : UUID.fromString(first);
    }

    /** the gallery links whose project and media both exist, and that are not there already */
    private static final String PROJECT_MEDIA_STILL_VALID = """
            exists (select 1 from project p where p.id = r.project_id)
            and exists (select 1 from media m where m.id = r.media_id)
            and not exists (select 1 from project_media x where x.id = r.id or (x.project_id = r.project_id and x.media_id = r.media_id))
            """;

    private UUID restoreSingle(UUID item, String table) {
        UUID rowId = UUID.fromString(field(item, "{rows," + table + ",0,id}"));
        if (exists("select 1 from " + table + " where id = ?", rowId)) {
            throw ApiException.conflict("trash.back · this entry is already back");
        }
        String twin = switch (table) {
            case "skill" -> twin(item, "select name from skill", "{rows,skill,0,name}", null);
            case "experience" -> twin(item, "select company from experience where start_date = ?::date",
                    "{rows,experience,0,company}", field(item, "{rows,experience,0,start_date}"));
            case "education" -> twin(item, "select school from education where start_date = ?::date",
                    "{rows,education,0,school}", field(item, "{rows,education,0,start_date}"));
            default -> null;
        };
        if (twin != null) {
            throw ApiException.conflict("trash.twin · " + twin + " was added again since");
        }
        insertRows(item, table, Map.of(), null);
        return rowId;
    }

    /** the name of an entry that was created again since the deletion (same rule as the profile's duplicates) */
    private String twin(UUID item, String existing, String path, String startDate) {
        String mine = field(item, path);
        String key = ProfileService.sameKey(mine);
        List<String> names = startDate == null ? jdbc.queryForList(existing, String.class)
                : jdbc.queryForList(existing, String.class, startDate);
        return names.stream().anyMatch(n -> ProfileService.sameKey(n).equals(key)) ? mine : null;
    }

    private void restoreCv(UUID item) {
        String lang = jdbc.queryForObject("select detail from trash_item where id = ?", String.class, item);
        if (!"fr".equals(lang) && !"en".equals(lang)) {
            throw ApiException.badRequest("this resume has no language");
        }
        int updated = jdbc.update("update site_settings s set cv_" + lang + "_key = l ->> 'key', cv_" + lang + "_size = (l ->> 'size')::int, "
                + "cv_" + lang + "_at = (l ->> 'at')::timestamptz "
                + "from trash_item ti, jsonb_array_elements(ti.payload #> '{links,cv}') l "
                + "where ti.id = ? and s.cv_" + lang + "_key is null", item);
        if (updated == 0) {
            throw ApiException.conflict("trash.cv · a resume is online for this language");
        }
    }

    /**
     * Inserts the rows saved for {@code table}, with the columns both the snapshot and the table
     * have today (a column added since takes its default).
     *
     * @param overrides SQL expressions on alias {@code r} replacing some columns
     * @param where     extra condition on {@code r}, or null
     */
    private void insertRows(UUID item, String table, Map<String, String> overrides, String where) {
        if (!TABLES.contains(table)) {
            throw new IllegalArgumentException(table);
        }
        String path = "{rows," + table + "}";
        List<String> saved = jdbc.queryForList("""
                select distinct k from trash_item ti,
                  jsonb_array_elements(coalesce(ti.payload #> ?::text[], '[]'::jsonb)) e, jsonb_object_keys(e) k
                where ti.id = ?
                """, String.class, path, item);
        List<String> columns = jdbc.queryForList("""
                select column_name from information_schema.columns
                where table_schema = current_schema() and table_name = ? order by ordinal_position
                """, String.class, table).stream().filter(saved::contains).toList();
        if (columns.isEmpty()) {
            return;
        }
        String select = columns.stream().map(c -> overrides.getOrDefault(c, "r." + c)).collect(Collectors.joining(", "));
        jdbc.update("insert into " + table + " (" + String.join(", ", columns) + ") select " + select
                + " from trash_item ti, jsonb_populate_recordset(null::" + table + ", ti.payload #> ?::text[]) r"
                + " where ti.id = ?" + (where == null ? "" : " and " + where), path, item);
    }

    private String field(UUID item, String path) {
        return jdbc.queryForObject("select payload #>> ?::text[] from trash_item where id = ?", String.class, path, item);
    }

    private boolean exists(String sql, Object... args) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select exists (" + sql + ")", Boolean.class, args));
    }

    // ── emptying ─────────────────────────────────────────────────────────────

    /** Deletes one item for good, with its bucket objects. */
    @Transactional
    public void purge(UUID id) {
        if (purgeWhere("id = ?", id) == 0) {
            throw new NotFoundException("Trash item");
        }
    }

    /** Empties the bin; returns how many items went. */
    @Transactional
    public int purgeAll() {
        return purgeWhere("true");
    }

    /** Every night: what has been in the bin for more than 30 days. */
    @Scheduled(cron = "0 45 4 * * *")
    @Transactional
    public void purgeExpired() {
        int n = purgeWhere("deleted_at < ?", java.sql.Timestamp.from(Instant.now().minus(KEEP)));
        if (n > 0) {
            log.info("Emptied {} item(s) older than {} days from the bin", n, KEEP.toDays());
        }
    }

    private int purgeWhere(String where, Object... args) {
        List<String> keys = jdbc.queryForList("select jsonb_array_elements_text(payload -> 'keys') from trash_item where " + where,
                String.class, args);
        int n = jdbc.update("delete from trash_item where " + where, args);
        // an object a media or a resume uses again (restored from a backup since) stays
        Map<String, Boolean> used = keys.stream().distinct().collect(Collectors.toMap(Function.identity(), this::inUse,
                (a, b) -> a, LinkedHashMap::new));
        used.forEach((key, inUse) -> {
            if (!inUse) {
                try {
                    storage.delete(key);
                } catch (RuntimeException e) {
                    log.warn("Object {} could not be deleted from storage: {}", key, e.getMessage());
                }
            }
        });
        return n;
    }

    private boolean inUse(String key) {
        String original = key.replaceFirst("-w\\d{3,4}(\\.[a-z0-9]+)$", "$1");
        return exists("select 1 from media where object_key = ?", original)
                || exists("select 1 from site_settings where cv_fr_key = ? or cv_en_key = ?", key, key)
                || exists("select 1 from trash_item where payload -> 'keys' @> jsonb_build_array(?::text)", key);
    }


    private void clearCaches() {
        for (String name : caches.getCacheNames()) {
            Cache cache = caches.getCache(name);
            if (cache != null) {
                cache.clear();
            }
        }
    }
}
