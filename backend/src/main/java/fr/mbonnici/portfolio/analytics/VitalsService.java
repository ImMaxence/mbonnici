package fr.mbonnici.portfolio.analytics;

import fr.mbonnici.portfolio.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Core Web Vitals measured in visitors' browsers (real-user monitoring). A sample is a metric name,
 * a value, the page path and the device class: no identifier, no hash, no cookie. Visitors who ask
 * not to be tracked (DNT / GPC) send nothing.
 */
@Service
public class VitalsService {

    private static final Logger log = LoggerFactory.getLogger(VitalsService.class);

    public enum Metric {
        // thresholds from web.dev: good ≤ first, poor > second
        LCP(2500, 4000, 60_000), INP(200, 500, 60_000), CLS(0.1, 0.25, 10), FCP(1800, 3000, 60_000), TTFB(800, 1800, 60_000);

        final double good;
        final double poor;
        final double max;

        Metric(double good, double poor, double max) {
            this.good = good;
            this.poor = poor;
            this.max = max;
        }
    }

    public record Sample(@NotNull Metric name, @NotNull Double value) {}

    public record Beacon(@NotBlank @Size(max = 300) String path, Integer viewportWidth,
            @NotEmpty @Size(max = 8) List<@Valid Sample> metrics) {}

    /** p75 and rating shares of one metric */
    public record Stat(Metric metric, long samples, Double p75, double good, double needsImprovement, double poor,
            double goodThreshold, double poorThreshold) {}

    public record PageStat(String path, long samples, Double lcp, Double inp, Double cls) {}

    public record Overview(int days, List<Stat> metrics, Map<String, List<Stat>> byDevice, List<PageStat> pages) {}

    private final JdbcTemplate jdbc;
    private final AppProperties props;

    public VitalsService(JdbcTemplate jdbc, AppProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    public int record(Beacon beacon, HttpServletRequest request) {
        if ("1".equals(request.getHeader("DNT")) || "1".equals(request.getHeader("Sec-GPC"))) {
            return 0;
        }
        String path = beacon.path().length() > 300 ? beacon.path().substring(0, 300) : beacon.path();
        if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) {
            return 0;
        }
        String device = beacon.viewportWidth() == null ? null
                : beacon.viewportWidth() < 768 ? "mobile" : beacon.viewportWidth() < 1100 ? "tablet" : "desktop";
        int n = 0;
        for (Sample s : beacon.metrics()) {
            double v = s.value();
            if (!Double.isFinite(v) || v < 0 || v > s.name().max) {
                continue;
            }
            jdbc.update("insert into web_vital (metric, value, path, device) values (?, ?, ?, ?)", s.name().name(), v, path, device);
            n++;
        }
        return n;
    }

    public Overview overview(int days) {
        int d = Math.clamp(days, 1, 365);
        Timestamp since = Timestamp.from(Instant.now().minus(Duration.ofDays(d)));
        List<Stat> metrics = new ArrayList<>();
        for (Metric m : Metric.values()) {
            metrics.add(stat(m, since, null));
        }
        Map<String, List<Stat>> byDevice = new LinkedHashMap<>();
        for (String device : List.of("mobile", "desktop")) {
            List<Stat> stats = new ArrayList<>();
            for (Metric m : List.of(Metric.LCP, Metric.INP, Metric.CLS)) {
                stats.add(stat(m, since, device));
            }
            byDevice.put(device, stats);
        }
        List<PageStat> pages = jdbc.query("""
                select path, count(*) as n,
                       percentile_cont(0.75) within group (order by value) filter (where metric = 'LCP') as lcp,
                       percentile_cont(0.75) within group (order by value) filter (where metric = 'INP') as inp,
                       percentile_cont(0.75) within group (order by value) filter (where metric = 'CLS') as cls
                from web_vital where created_at >= ?
                group by path order by n desc limit 8
                """, (rs, i) -> new PageStat(rs.getString(1), rs.getLong(2), nullable(rs.getObject(3)),
                nullable(rs.getObject(4)), nullable(rs.getObject(5))), since);
        return new Overview(d, metrics, byDevice, pages);
    }

    private Stat stat(Metric m, Timestamp since, String device) {
        String where = "metric = ? and created_at >= ?" + (device == null ? "" : " and device = ?");
        Object[] args = device == null ? new Object[] {m.name(), since} : new Object[] {m.name(), since, device};
        return jdbc.queryForObject("""
                select count(*),
                       percentile_cont(0.75) within group (order by value),
                       count(*) filter (where value <= %s),
                       count(*) filter (where value > %s)
                from web_vital where %s
                """.formatted(m.good, m.poor, where), (rs, i) -> {
            long n = rs.getLong(1);
            double good = n == 0 ? 0 : rs.getLong(3) / (double) n;
            double poor = n == 0 ? 0 : rs.getLong(4) / (double) n;
            return new Stat(m, n, n == 0 ? null : rs.getDouble(2), round(good), round(Math.max(0, 1 - good - poor)), round(poor),
                    m.good, m.poor);
        }, args);
    }

    private static Double nullable(Object o) {
        return o instanceof Number n ? n.doubleValue() : null;
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }

    /** Same retention as the analytics events. */
    @Scheduled(cron = "0 40 4 * * *")
    public void purge() {
        Timestamp before = Timestamp.from(Instant.now().minus(Duration.ofDays(props.analytics().retentionDays())));
        int deleted = jdbc.update("delete from web_vital where created_at < ?", before);
        if (deleted > 0) {
            log.info("Purged {} web vitals older than {}", deleted, before);
        }
    }
}
