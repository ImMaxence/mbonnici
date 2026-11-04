package fr.mbonnici.portfolio.analytics;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnalyticsRepository extends JpaRepository<AnalyticsEvent, Long> {

    @Query(value = "select count(*) from analytics_event where type = :type and created_at >= :since and created_at < :until",
            nativeQuery = true)
    long countByType(@Param("type") String type, @Param("since") Instant since, @Param("until") Instant until);

    @Query(value = "select count(distinct visitor_hash) from analytics_event where created_at >= :since and created_at < :until",
            nativeQuery = true)
    long countVisitors(@Param("since") Instant since, @Param("until") Instant until);

    @Query(value = """
            select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
                   count(*) filter (where type = 'PAGE_VIEW') as views,
                   count(distinct visitor_hash) as visitors
            from analytics_event
            where created_at >= :since
            group by 1
            order by 1
            """, nativeQuery = true)
    List<Object[]> daily(@Param("since") Instant since);

    @Query(value = """
            select p.slug, p.title_fr, p.title_en,
                   count(*) filter (where e.type = 'PROJECT_VIEW') as views,
                   count(*) filter (where e.type = 'OUTBOUND_CLICK') as clicks
            from analytics_event e
            join project p on p.id = e.project_id
            where e.created_at >= :since
            group by p.slug, p.title_fr, p.title_en
            order by views desc, clicks desc
            limit :limit
            """, nativeQuery = true)
    List<Object[]> topProjects(@Param("since") Instant since, @Param("limit") int limit);

    @Query(value = """
            select path, count(*) as c from analytics_event
            where type = 'PAGE_VIEW' and created_at >= :since
            group by path order by c desc limit :limit
            """, nativeQuery = true)
    List<Object[]> topPaths(@Param("since") Instant since, @Param("limit") int limit);

    @Query(value = """
            select coalesce(locale, '?'), count(*) as c from analytics_event
            where type = 'PAGE_VIEW' and created_at >= :since group by 1 order by c desc limit 10
            """, nativeQuery = true)
    List<Object[]> byLocale(@Param("since") Instant since);

    @Query(value = """
            select coalesce(device, '?'), count(*) as c from analytics_event
            where type = 'PAGE_VIEW' and created_at >= :since group by 1 order by c desc limit 10
            """, nativeQuery = true)
    List<Object[]> byDevice(@Param("since") Instant since);

    @Query(value = """
            select coalesce(theme, '?'), count(*) as c from analytics_event
            where type = 'PAGE_VIEW' and created_at >= :since group by 1 order by c desc limit 10
            """, nativeQuery = true)
    List<Object[]> byTheme(@Param("since") Instant since);

    @Query(value = """
            select coalesce(style, '?'), count(*) as c from analytics_event
            where type = 'PAGE_VIEW' and created_at >= :since group by 1 order by c desc limit 10
            """, nativeQuery = true)
    List<Object[]> byStyle(@Param("since") Instant since);

    @Query(value = """
            select referrer_host, count(*) as c from analytics_event
            where type = 'PAGE_VIEW' and referrer_host is not null and created_at >= :since
            group by 1 order by c desc limit 10
            """, nativeQuery = true)
    List<Object[]> byReferrer(@Param("since") Instant since);

    @Modifying
    @Query(value = "delete from analytics_event where created_at < :before", nativeQuery = true)
    int purgeBefore(@Param("before") Instant before);
}
