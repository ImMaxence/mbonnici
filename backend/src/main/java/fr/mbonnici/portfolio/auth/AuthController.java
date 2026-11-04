package fr.mbonnici.portfolio.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record MeResponse(boolean authenticated, String email, String name, String picture) {
        static final MeResponse ANONYMOUS = new MeResponse(false, null, null, null);
    }

    /** Always 200: the SPA calls this on boot to decide whether to show the back office. */
    @GetMapping("/me")
    public MeResponse me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return MeResponse.ANONYMOUS;
        }
        boolean admin = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(AdminOidcUserService.ROLE_ADMIN::equals);
        if (!admin) {
            return MeResponse.ANONYMOUS;
        }
        if (authentication.getPrincipal() instanceof OidcUser user) {
            return new MeResponse(true, user.getEmail(), user.getFullName(), user.getPicture());
        }
        return new MeResponse(true, authentication.getName(), authentication.getName(), null);
    }
}
