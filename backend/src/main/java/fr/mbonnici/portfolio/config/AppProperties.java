package fr.mbonnici.portfolio.config;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Application settings bound from the {@code app.*} namespace (see application.yml). */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String url,
        /** ADMIN_EMAIL: the Google account(s) allowed in the back office, required (see {@link #parseAdminEmails}) */
        List<String> adminEmails,
        @DefaultValue("false") boolean trustProxy,
        Analytics analytics,
        Storage storage,
        RateLimit rateLimit,
        /** local only: GET /api/auth/dev-login signs in without Google (refused unless app.url is localhost) */
        @DefaultValue("false") boolean devLogin) {

    public AppProperties {
        adminEmails = parseAdminEmails(adminEmails);
    }

    /**
     * ADMIN_EMAIL holds one or more addresses separated by ";" (a "," works too: Spring already
     * splits on it). There is no default: the application refuses to start without at least one
     * address, so nobody is ever admin by accident.
     */
    public static List<String> parseAdminEmails(List<String> raw) {
        List<String> emails = (raw == null ? List.<String>of() : raw).stream()
                .flatMap(v -> Arrays.stream(v.split("[;,]")))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
        if (emails.isEmpty() || emails.stream().anyMatch(e -> e.contains("${"))) {
            throw new IllegalStateException(
                    "ADMIN_EMAIL is not set: give the Google address(es) allowed in the back office, separated by ';'");
        }
        for (String e : emails) {
            if (!e.matches("[^@\\s]+@[^@\\s]+")) {
                throw new IllegalStateException("ADMIN_EMAIL: '" + e + "' is not an e-mail address");
            }
        }
        return emails;
    }

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
