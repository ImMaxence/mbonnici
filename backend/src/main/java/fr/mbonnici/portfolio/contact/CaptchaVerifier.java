package fr.mbonnici.portfolio.contact;

import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.errors.ErrorLogService;
import fr.mbonnici.portfolio.errors.ErrorLogService.Source;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Checks the reCAPTCHA checkbox token of the contact form with Google. Only a verdict about the visitor
 * refuses a message: when Google cannot answer or rejects this site's own secret key, the message
 * goes through (the honeypot and the rate limit still apply) and the problem lands in the journal.
 */
@Service
public class CaptchaVerifier {

    private static final Logger log = LoggerFactory.getLogger(CaptchaVerifier.class);
    private static final String WHERE = "POST /api/contact";
    /** Google's error codes that are about this site's configuration, not about the visitor */
    private static final Set<String> OUR_FAULT = Set.of("missing-input-secret", "invalid-input-secret", "bad-request");

    private final AppProperties.Captcha config;
    private final ObjectMapper mapper;
    private final ErrorLogService errors;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    public CaptchaVerifier(AppProperties props, ObjectMapper mapper, ErrorLogService errors) {
        this.config = props.captcha();
        this.mapper = mapper;
        this.errors = errors;
    }

    /** the key the contact page needs, null when the captcha is off */
    public String siteKey() {
        return config.enabled() ? config.siteKey() : null;
    }

    public boolean accepts(String token) {
        if (!config.enabled()) {
            return true;
        }
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            return verdict(mapper.readTree(ask(token).body()));
        } catch (IOException | RuntimeException e) {
            log.warn("reCAPTCHA could not be reached, letting the message through: {}", e.toString());
            errors.recordServer(e, WHERE);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return true;
        }
    }

    private HttpResponse<String> ask(String token) throws IOException, InterruptedException {
        String form = "secret=" + encode(config.secretKey()) + "&response=" + encode(token);
        HttpRequest request = HttpRequest.newBuilder(URI.create(config.verifyUrl()))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private boolean verdict(JsonNode answer) {
        if (answer.path("success").asBoolean(false)) {
            return true;
        }
        String codes = answer.path("error-codes").toString();
        for (JsonNode code : answer.path("error-codes")) {
            if (OUR_FAULT.contains(code.asString(""))) {
                log.error("reCAPTCHA refused this site's request, letting the message through: {}", codes);
                errors.record(Source.SERVER, "reCAPTCHA refused the site's secret key: " + codes, null, WHERE);
                return true;
            }
        }
        log.info("reCAPTCHA token refused: {}", codes);
        return false;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
