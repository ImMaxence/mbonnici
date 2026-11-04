package fr.mbonnici.portfolio.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

/** Resolves the caller's IP. Proxy headers are only honoured when {@code app.trust-proxy=true}. */
public final class ClientIp {

    private ClientIp() {}

    public static String resolve(HttpServletRequest request, boolean trustProxy) {
        if (trustProxy) {
            String cf = request.getHeader("CF-Connecting-IP");
            if (StringUtils.hasText(cf)) {
                return cf.trim();
            }
            String xff = request.getHeader("X-Forwarded-For");
            if (StringUtils.hasText(xff)) {
                int comma = xff.indexOf(',');
                return (comma > 0 ? xff.substring(0, comma) : xff).trim();
            }
            String real = request.getHeader("X-Real-IP");
            if (StringUtils.hasText(real)) {
                return real.trim();
            }
        }
        String addr = request.getRemoteAddr();
        return addr == null ? "unknown" : addr;
    }
}
