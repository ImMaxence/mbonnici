package fr.mbonnici.portfolio.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Application settings bound from the {@code app.*} namespace (see application.yml / .env). */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String url,
        List<String> adminEmails,
        @DefaultValue("false") boolean trustProxy,
        Analytics analytics,
        Storage storage,
        RateLimit rateLimit,
        /** local only: GET /api/auth/dev-login signs in without Google (refused unless app.url is localhost) */
        @DefaultValue("false") boolean devLogin) {

    public record Analytics(String saltSecret, @DefaultValue("400") int retentionDays) {}

    public record Storage(
            String endpoint,
            @DefaultValue("us-east-1") String region,
            String bucket,
            String accessKey,
            String secretKey,
            @DefaultValue("true") boolean pathStyle) {}

    public record RateLimit(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("240") int apiPerMinute,
            @DefaultValue("5") int contactPerHour,
            @DefaultValue("60") int analyticsPerMinute,
            @DefaultValue("30") int uploadPerMinute,
            @DefaultValue("20") int authPerMinute) {}
}
