package fr.mbonnici.portfolio.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Dependency-free token-bucket rate limiting, keyed by (policy, client IP).
 * Runs before Spring Security so unauthenticated floods never reach the auth machinery.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final long IDLE_EVICTION_NANOS = 15L * 60 * 1_000_000_000L;
    private static final int HARD_CAP = 100_000;

    private record Policy(String name, int capacity, double refillPerSecond) {}

    private static final class Bucket {
        private double tokens;
        private long last;
        private final double capacity;
        private final double refillPerSecond;

        Bucket(double capacity, double refillPerSecond) {
            this.capacity = capacity;
            this.refillPerSecond = refillPerSecond;
            this.tokens = capacity;
            this.last = System.nanoTime();
        }

        synchronized boolean tryConsume() {
            refill();
            if (tokens >= 1d) {
                tokens -= 1d;
                return true;
            }
            return false;
        }

        synchronized long secondsUntilNextToken() {
            refill();
            if (tokens >= 1d) {
                return 0;
            }
            return (long) Math.ceil((1d - tokens) / refillPerSecond);
        }

        synchronized boolean idleSince(long nowNanos) {
            return nowNanos - last > IDLE_EVICTION_NANOS;
        }

        private void refill() {
            long now = System.nanoTime();
            double elapsed = (now - last) / 1_000_000_000d;
            if (elapsed > 0) {
                tokens = Math.min(capacity, tokens + elapsed * refillPerSecond);
                last = now;
            }
        }
    }

    private final AppProperties props;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final Policy api;
    private final Policy contact;
    private final Policy analytics;
    private final Policy upload;
    private final Policy auth;

    public RateLimitFilter(AppProperties props) {
        this.props = props;
        AppProperties.RateLimit rl = props.rateLimit();
        this.api = new Policy("api", rl.apiPerMinute(), rl.apiPerMinute() / 60d);
        this.contact = new Policy("contact", rl.contactPerHour(), rl.contactPerHour() / 3600d);
        this.analytics = new Policy("analytics", rl.analyticsPerMinute(), rl.analyticsPerMinute() / 60d);
        this.upload = new Policy("upload", rl.uploadPerMinute(), rl.uploadPerMinute() / 60d);
        this.auth = new Policy("auth", rl.authPerMinute(), rl.authPerMinute() / 60d);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !props.rateLimit().enabled() || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Policy policy = policyFor(request);
        String ip = ClientIp.resolve(request, props.trustProxy());
        Bucket bucket = buckets.computeIfAbsent(policy.name() + "|" + ip,
                k -> new Bucket(policy.capacity(), policy.refillPerSecond()));

        response.setHeader("X-RateLimit-Policy", policy.name());
        response.setHeader("X-RateLimit-Limit", Integer.toString(policy.capacity()));

        if (bucket.tryConsume()) {
            chain.doFilter(request, response);
            return;
        }

        long retry = Math.max(1, bucket.secondsUntilNextToken());
        log.debug("Rate limit hit: policy={} ip={} path={}", policy.name(), ip, request.getRequestURI());
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", Long.toString(retry));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded, retry in "
                + retry + "s\"}");
    }

    private Policy policyFor(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if (path.startsWith("/api/analytics/")) {
            return analytics;
        }
        if (path.equals("/api/contact") && "POST".equals(method)) {
            return contact;
        }
        if (path.startsWith("/api/admin/media") && "POST".equals(method)) {
            return upload;
        }
        if (path.startsWith("/api/auth/")) {
            return auth;
        }
        return api;
    }

    @Scheduled(fixedDelay = 60_000)
    void evictIdleBuckets() {
        long now = System.nanoTime();
        if (buckets.size() > HARD_CAP) {
            log.warn("Rate limit table exceeded {} entries, clearing", HARD_CAP);
            buckets.clear();
            return;
        }
        buckets.entrySet().removeIf(e -> e.getValue().idleSince(now));
    }
}
