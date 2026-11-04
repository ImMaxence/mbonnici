package fr.mbonnici.portfolio.analytics;

import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.config.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

/**
 * Cookieless, privacy-preserving visitor identifier: SHA-256(secret, day, ip, user-agent).
 * The daily rotation makes it impossible to follow someone across days, and the raw IP is never stored.
 */
@Component
public class VisitorHasher {

    private final AppProperties props;

    public VisitorHasher(AppProperties props) {
        this.props = props;
    }

    public String hash(HttpServletRequest request) {
        String ip = ClientIp.resolve(request, props.trustProxy());
        String ua = request.getHeader("User-Agent");
        String day = LocalDate.now(ZoneOffset.UTC).toString();
        String input = props.analytics().saltSecret() + ':' + day + ':' + ip + ':' + (ua == null ? "" : ua);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
