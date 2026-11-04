package fr.mbonnici.portfolio.analytics;

import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.project.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    public record IncomingEvent(
            @NotNull AnalyticsEvent.Type type,
            @NotBlank @Size(max = 300) String path,
            @Size(max = 80) String projectSlug,
            @Size(max = 5) String locale,
            @Size(max = 10) String theme,
            @Size(max = 20) String style,
            @Size(max = 500) String referrer,
            Integer viewportWidth) {}

    public record Batch(@NotEmpty @Size(max = 20) List<@Valid IncomingEvent> events) {}

    public record DailyPoint(String date, long views, long visitors) {}
    public record ProjectStat(String slug, Localized title, long views, long clicks) {}
    public record KeyCount(String key, long count) {}

    public record Overview(
            int days,
            long pageViews,
            long pageViewsPrevious,
            long visitors,
            long visitorsPrevious,
            long projectViews,
            long outboundClicks,
            long contactSubmits,
            long cvDownloads,
            List<DailyPoint> daily,
            List<ProjectStat> topProjects,
            List<KeyCount> topPaths,
            List<KeyCount> locales,
            List<KeyCount> devices,
            List<KeyCount> themes,
            List<KeyCount> styles,
            List<KeyCount> referrers) {}

    private final AnalyticsRepository repository;
    private final ProjectService projects;
    private final VisitorHasher hasher;
    private final AppProperties props;
    private final String ownHost;

    public AnalyticsService(AnalyticsRepository repository, ProjectService projects, VisitorHasher hasher,
            AppProperties props) {
        this.repository = repository;
        this.projects = projects;
        this.hasher = hasher;
        this.props = props;
        this.ownHost = hostOf(props.url());
    }

    /** Returns the number of events stored (0 when the visitor opted out through DNT / GPC). */
    @Transactional
    public int record(Batch batch, HttpServletRequest request) {
        if ("1".equals(request.getHeader("DNT")) || "1".equals(request.getHeader("Sec-GPC"))) {
            return 0;
        }
        String visitor = hasher.hash(request);
        String ua = request.getHeader("User-Agent");
        List<AnalyticsEvent> toSave = new ArrayList<>();
        for (IncomingEvent in : batch.events()) {
            UUID projectId = in.projectSlug() == null ? null : projects.findPublishedId(in.projectSlug()).orElse(null);
            String device = device(ua, in.viewportWidth());
            String referrer = referrerHost(in.referrer());
            toSave.add(AnalyticsEvent.of(in.type(), truncate(in.path(), 300), projectId, lower(in.locale()),
                    lower(in.theme()), lower(in.style()), device, referrer, visitor));
        }
        repository.saveAll(toSave);
        return toSave.size();
    }

    @Transactional(readOnly = true)
    public Overview overview(int days) {
        int d = Math.clamp(days, 1, 365);
        Instant now = Instant.now();
        Instant since = now.minus(Duration.ofDays(d));
        Instant previous = since.minus(Duration.ofDays(d));

        List<DailyPoint> daily = repository.daily(since).stream()
                .map(r -> new DailyPoint((String) r[0], toLong(r[1]), toLong(r[2]))).toList();
        List<ProjectStat> top = repository.topProjects(since, 10).stream()
                .map(r -> new ProjectStat((String) r[0], Localized.of((String) r[1], (String) r[2]).filled(), toLong(r[3]),
                        toLong(r[4]))).toList();

        return new Overview(d,
                repository.countByType("PAGE_VIEW", since, now),
                repository.countByType("PAGE_VIEW", previous, since),
                repository.countVisitors(since, now),
                repository.countVisitors(previous, since),
                repository.countByType("PROJECT_VIEW", since, now),
                repository.countByType("OUTBOUND_CLICK", since, now),
                repository.countByType("CONTACT_SUBMIT", since, now),
                repository.countByType("CV_DOWNLOAD", since, now),
                daily, top,
                keyCounts(repository.topPaths(since, 10)),
                keyCounts(repository.byLocale(since)),
                keyCounts(repository.byDevice(since)),
                keyCounts(repository.byTheme(since)),
                keyCounts(repository.byStyle(since)),
                keyCounts(repository.byReferrer(since)));
    }

    /** Raw events are kept for a bounded period (default 400 days), then dropped. */
    @Scheduled(cron = "0 30 4 * * *")
    @Transactional
    public void purgeOldEvents() {
        Instant before = Instant.now().minus(Duration.ofDays(props.analytics().retentionDays()));
        int deleted = repository.purgeBefore(before);
        if (deleted > 0) {
            log.info("Purged {} analytics events older than {}", deleted, before);
        }
    }

    private static List<KeyCount> keyCounts(List<Object[]> rows) {
        return rows.stream().map(r -> new KeyCount(String.valueOf(r[0]), toLong(r[1]))).toList();
    }

    private static long toLong(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }

    private static String device(String ua, Integer viewportWidth) {
        if (viewportWidth != null) {
            return viewportWidth < 768 ? "mobile" : viewportWidth < 1100 ? "tablet" : "desktop";
        }
        if (ua == null) {
            return "unknown";
        }
        String u = ua.toLowerCase(Locale.ROOT);
        if (u.contains("ipad") || u.contains("tablet")) {
            return "tablet";
        }
        if (u.contains("mobi") || u.contains("android") || u.contains("iphone")) {
            return "mobile";
        }
        return "desktop";
    }

    private String referrerHost(String referrer) {
        String host = hostOf(referrer);
        if (host == null || host.equalsIgnoreCase(ownHost)) {
            return null;
        }
        return truncate(host, 200);
    }

    private static String hostOf(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            String host = URI.create(url.trim()).getHost();
            return host == null ? null : host.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String lower(String s) {
        return s == null || s.isBlank() ? null : s.trim().toLowerCase(Locale.ROOT);
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
