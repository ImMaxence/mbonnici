package fr.mbonnici.portfolio.auth;

import fr.mbonnici.portfolio.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import fr.mbonnici.portfolio.common.ApiException;

/**
 * Sign-in options for the login page, plus a <b>local-only</b> shortcut that opens an admin session
 * without Google. The shortcut needs {@code DEV_LOGIN=true} <em>and</em> an {@code APP_URL} on
 * localhost / 127.0.0.1, so a production deployment can never expose it by accident.
 */
@RestController
@RequestMapping("/api/auth")
public class DevLoginController {

    private static final Logger log = LoggerFactory.getLogger(DevLoginController.class);
    private static final Set<String> LOCAL_HOSTS = Set.of("localhost", "127.0.0.1", "[::1]");

    private final AppProperties props;
    private final boolean googleConfigured;
    private final SecurityContextRepository contexts = new HttpSessionSecurityContextRepository();

    public DevLoginController(AppProperties props,
            @org.springframework.beans.factory.annotation.Value("${spring.security.oauth2.client.registration.google.client-id:}") String clientId) {
        this.props = props;
        this.googleConfigured = clientId != null && !clientId.isBlank() && !clientId.equals("not-configured");
    }

    public record Providers(boolean google, boolean devLogin) {}

    @GetMapping("/providers")
    public Providers providers() {
        return new Providers(googleConfigured, devLoginAllowed());
    }

    @GetMapping("/dev-login")
    public void devLogin(HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (!devLoginAllowed()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "not found");
        }
        String email = props.adminEmails().isEmpty() ? "admin@localhost" : props.adminEmails().getFirst();
        var auth = UsernamePasswordAuthenticationToken.authenticated(email, null,
                List.of(new SimpleGrantedAuthority(AdminOidcUserService.ROLE_ADMIN)));
        auth.setDetails(Map.of("devLogin", true));
        // fresh session id, like a real sign-in
        request.getSession(true);
        request.changeSessionId();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        log.warn("DEV LOGIN used: local admin session opened for {}", email);
        response.sendRedirect(props.url() + "/admin");
    }

    private boolean devLoginAllowed() {
        if (!props.devLogin()) {
            return false;
        }
        try {
            return LOCAL_HOSTS.contains(URI.create(props.url()).getHost());
        } catch (RuntimeException e) {
            return false;
        }
    }
}
