package fr.mbonnici.portfolio.insights;

import fr.mbonnici.portfolio.project.ProjectDtos.Card;
import fr.mbonnici.portfolio.project.ProjectService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Live facts about the published projects, refreshed in the background and kept in memory:
 * <ul>
 *   <li>whether the live site answers, and how fast (every 5 minutes);</li>
 *   <li>GitHub stars, last push and languages of the repository (every 6 hours, conditional
 *       requests with ETags so unchanged repositories do not count against the API quota).</li>
 * </ul>
 * Nothing is stored in the database; after a restart the first round runs within a minute.
 */
@Service
public class InsightsService {

    private static final Logger log = LoggerFactory.getLogger(InsightsService.class);
    private static final Pattern GITHUB = Pattern.compile("^https://github\\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\\.git)?/?$");
    private static final String AGENT = "mbonnici.fr-insights (+https://mbonnici.fr)";

    public record SiteStatus(boolean up, Integer status, Long latencyMs, Instant checkedAt) {}

    public record Language(String name, double share) {}

    public record RepoStats(String fullName, int stars, int forks, Instant pushedAt, List<Language> languages,
            Instant fetchedAt) {}

    public record Insight(SiteStatus site, RepoStats repo) {}

    /** one hour of checks: share of successful checks (0..1) and mean response time */
    public record Hour(Instant hour, double up, Integer latencyMs, int checks) {}

    /** a project's site over the last day and week (back-office dashboard) */
    public record SiteHistory(String slug, String title, String url, SiteStatus current, Double uptime24h, Double uptime7d,
            Integer latency24h, Instant lastDown, List<Hour> hours) {}

    private record Cached(RepoStats stats, String etag, String languagesEtag) {}

    private final ProjectService projects;
    private final ObjectMapper mapper;
    private final JdbcTemplate jdbc;
    private final boolean enabled;
    private final String githubToken;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final Map<String, SiteStatus> sites = new ConcurrentHashMap<>();
    private final Map<String, Cached> repos = new ConcurrentHashMap<>();

    public InsightsService(ProjectService projects, ObjectMapper mapper, JdbcTemplate jdbc,
            @Value("${app.insights.enabled:true}") boolean enabled,
            @Value("${app.insights.github-token:}") String githubToken) {
        this.projects = projects;
        this.mapper = mapper;
        this.jdbc = jdbc;
        this.enabled = enabled;
        this.githubToken = githubToken == null ? "" : githubToken.trim();
    }

    /** slug → what is known about the project (only published projects, only known facts). */
    public Map<String, Insight> all() {
        Map<String, Insight> out = new LinkedHashMap<>();
        for (Card c : projects.listPublished()) {
            SiteStatus site = c.liveUrl() == null ? null : sites.get(c.liveUrl());
            String repo = repoName(c.repoUrl());
            Cached cached = repo == null ? null : repos.get(repo);
            if (site != null || cached != null) {
                out.put(c.slug(), new Insight(site, cached == null ? null : cached.stats()));
            }
        }
        return out;
    }

    // ── live sites ───────────────────────────────────────────────────────────

    @Scheduled(initialDelayString = "PT20S", fixedDelayString = "${app.insights.status-interval:PT5M}")
    public void checkSites() {
        if (!enabled) {
            return;
        }
        for (Card c : projects.listPublished()) {
            if (c.liveUrl() != null) {
                SiteStatus s = check(c.liveUrl());
                sites.put(c.liveUrl(), s);
                record(c, s);
            }
        }
    }

    private void record(Card c, SiteStatus s) {
        try {
            jdbc.update("insert into site_check (project_id, checked_at, up, status, latency_ms) values (?, ?, ?, ?, ?)",
                    c.id(), java.sql.Timestamp.from(s.checkedAt()), s.up(), s.status(),
                    s.latencyMs() == null ? null : s.latencyMs().intValue());
        } catch (RuntimeException e) {
            log.debug("Site check not stored: {}", e.getMessage());
        }
    }

    /** The published projects with a live site: status now, uptime and response time per hour. */
    public List<SiteHistory> history() {
        List<SiteHistory> out = new ArrayList<>();
        for (Card c : projects.listPublished()) {
            if (c.liveUrl() == null) {
                continue;
            }
            List<Hour> hours = jdbc.query("""
                    select date_trunc('hour', checked_at) as h, avg(case when up then 1.0 else 0 end), avg(latency_ms) filter (where up), count(*)
                    from site_check where project_id = ? and checked_at >= now() - interval '24 hours'
                    group by 1 order by 1""",
                    (rs, i) -> new Hour(rs.getTimestamp(1).toInstant(), rs.getDouble(2),
                            rs.getObject(3) == null ? null : (int) Math.round(rs.getDouble(3)), rs.getInt(4)), c.id());
            Double day = ratio(c, "24 hours");
            Double week = ratio(c, "7 days");
            Integer latency = jdbc.queryForObject("""
                    select round(avg(latency_ms)) from site_check
                    where project_id = ? and up and checked_at >= now() - interval '24 hours'""", Integer.class, c.id());
            java.sql.Timestamp down = jdbc.queryForObject(
                    "select max(checked_at) from site_check where project_id = ? and not up", java.sql.Timestamp.class, c.id());
            out.add(new SiteHistory(c.slug(), c.title().fr(), c.liveUrl(), sites.get(c.liveUrl()), day, week, latency,
                    down == null ? null : down.toInstant(), hours));
        }
        return out;
    }

    private Double ratio(Card c, String interval) {
        return jdbc.queryForObject("select avg(case when up then 1.0 else 0 end) from site_check where project_id = ? "
                + "and checked_at >= now() - interval '" + interval + "'", Double.class, c.id());
    }

    /** checks are kept 30 days */
    @Scheduled(cron = "0 55 4 * * *")
    public void purgeChecks() {
        jdbc.update("delete from site_check where checked_at < now() - interval '30 days'");
    }

    SiteStatus check(String url) {
        long start = System.nanoTime();
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", AGENT)
                    .GET()
                    .build();
            HttpResponse<Void> res = http.send(req, HttpResponse.BodyHandlers.discarding());
            long ms = Duration.ofNanos(System.nanoTime() - start).toMillis();
            int code = res.statusCode();
            // a protected site (401 / 403) still answers; 5xx or no answer means down
            boolean up = code < 400 || code == 401 || code == 403;
            return new SiteStatus(up, code, ms, Instant.now());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new SiteStatus(false, null, null, Instant.now());
        } catch (Exception e) {
            log.debug("Status check of {} failed: {}", url, e.getMessage());
            return new SiteStatus(false, null, null, Instant.now());
        }
    }

    // ── GitHub ───────────────────────────────────────────────────────────────

    @Scheduled(initialDelayString = "PT30S", fixedDelayString = "${app.insights.github-interval:PT6H}")
    public void refreshRepositories() {
        if (!enabled) {
            return;
        }
        for (Card c : projects.listPublished()) {
            String repo = repoName(c.repoUrl());
            if (repo != null) {
                try {
                    refresh(repo);
                } catch (Exception e) {
                    log.debug("GitHub stats of {} failed: {}", repo, e.getMessage());
                }
            }
        }
    }

    private void refresh(String repo) throws Exception {
        Cached previous = repos.get(repo);
        HttpResponse<String> res = github("https://api.github.com/repos/" + repo, previous == null ? null : previous.etag());
        if (res.statusCode() == 304 && previous != null) {
            repos.put(repo, new Cached(withFetched(previous.stats()), previous.etag(), previous.languagesEtag()));
            return;
        }
        if (res.statusCode() != 200) {
            log.debug("GitHub answered {} for {}", res.statusCode(), repo);
            return;
        }
        JsonNode r = mapper.readTree(res.body());
        HttpResponse<String> langs = github("https://api.github.com/repos/" + repo + "/languages",
                previous == null ? null : previous.languagesEtag());
        List<Language> languages = previous == null ? List.of() : previous.stats().languages();
        if (langs.statusCode() == 200) {
            languages = shares(mapper.readTree(langs.body()));
        }
        Instant pushed = null;
        String pushedAt = r.path("pushed_at").asString("");
        if (!pushedAt.isBlank()) {
            pushed = Instant.parse(pushedAt);
        }
        RepoStats stats = new RepoStats(r.path("full_name").asString(repo), r.path("stargazers_count").asInt(0),
                r.path("forks_count").asInt(0), pushed, languages, Instant.now());
        repos.put(repo, new Cached(stats, res.headers().firstValue("ETag").orElse(null),
                langs.headers().firstValue("ETag").orElse(previous == null ? null : previous.languagesEtag())));
    }

    private HttpResponse<String> github(String url, String etag) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", AGENT)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28");
        if (etag != null) {
            b.header("If-None-Match", etag);
        }
        if (!githubToken.isEmpty()) {
            b.header("Authorization", "Bearer " + githubToken);
        }
        return http.send(b.GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    /** byte counts per language → the four biggest shares (0..1) */
    private static List<Language> shares(JsonNode langs) {
        Map<String, Long> bytes = new LinkedHashMap<>();
        langs.properties().forEach(e -> bytes.put(e.getKey(), e.getValue().asLong(0)));
        long total = bytes.values().stream().mapToLong(Long::longValue).sum();
        if (total == 0) {
            return List.of();
        }
        List<Language> out = new ArrayList<>();
        bytes.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(4)
                .forEach(e -> out.add(new Language(e.getKey(), Math.round(e.getValue() * 1000.0 / total) / 1000.0)));
        return out;
    }

    private static RepoStats withFetched(RepoStats s) {
        return new RepoStats(s.fullName(), s.stars(), s.forks(), s.pushedAt(), s.languages(), Instant.now());
    }

    /** "owner/repo" for a github.com URL, else null */
    static String repoName(String url) {
        if (url == null) {
            return null;
        }
        Matcher m = GITHUB.matcher(url.trim());
        return m.matches() ? m.group(1) + "/" + m.group(2) : null;
    }
}
