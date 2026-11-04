package fr.mbonnici.portfolio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import fr.mbonnici.portfolio.auth.AdminOidcUserService;
import fr.mbonnici.portfolio.backup.BackupSettingsRepository;
import fr.mbonnici.portfolio.config.AppProperties;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/** ADMIN_EMAIL: a required list separated by ";", and only those verified Google accounts get in. */
class AdminAccessTest {

    @Test
    void adminEmailIsAListSeparatedBySemicolons() {
        assertEquals(List.of("first@gmail.com", "second@gmail.com", "third@gmail.com"),
                AppProperties.parseAdminEmails(List.of(" First@Gmail.com; second@gmail.com ;;third@gmail.com; ")));
        // Spring splits a "," list before: both separators work, duplicates are dropped
        assertEquals(List.of("first@gmail.com", "second@gmail.com"),
                AppProperties.parseAdminEmails(List.of("first@gmail.com", "second@gmail.com;first@gmail.com")));
    }

    @Test
    void theApplicationRefusesToStartWithoutAValidAdminEmail() {
        assertThrows(IllegalStateException.class, () -> AppProperties.parseAdminEmails(null));
        assertThrows(IllegalStateException.class, () -> AppProperties.parseAdminEmails(List.of()));
        assertThrows(IllegalStateException.class, () -> AppProperties.parseAdminEmails(List.of(" ; ")));
        // what Spring leaves when the environment variable is missing
        assertThrows(IllegalStateException.class, () -> AppProperties.parseAdminEmails(List.of("${ADMIN_EMAIL}")));
        assertThrows(IllegalStateException.class, () -> AppProperties.parseAdminEmails(List.of("first@gmail.com;not-an-address")));
    }

    @Test
    void onlyTheListedAccountsWithAVerifiedEmailGetIn() {
        AppProperties props = new AppProperties("https://mbonnici.fr", List.of("first@gmail.com;Second@Gmail.com"),
                true, null, null, null, false);
        AdminOidcUserService service = new AdminOidcUserService(props, mock(BackupSettingsRepository.class));

        OidcUser admin = service.loadUser(request("second@gmail.com", true));
        assertTrue(admin.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(AdminOidcUserService.ROLE_ADMIN)));
        assertTrue(service.loadUser(request("FIRST@gmail.com", true)).getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(AdminOidcUserService.ROLE_ADMIN)));

        assertThrows(OAuth2AuthenticationException.class, () -> service.loadUser(request("someone@gmail.com", true)));
        // an address Google has not verified could belong to anybody
        assertThrows(OAuth2AuthenticationException.class, () -> service.loadUser(request("first@gmail.com", false)));
    }

    /** a Google sign-in as it reaches the service, built from the ID token alone (no user-info call) */
    private static OidcUserRequest request(String email, boolean verified) {
        ClientRegistration registration = ClientRegistration.withRegistrationId("google")
                .clientId("client-id")
                .clientSecret("client-secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/api/auth/oauth2/code/{registrationId}")
                .scope("openid", "email", "profile")
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .tokenUri("https://oauth2.googleapis.com/token")
                .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                .userNameAttributeName("sub")
                .build();
        Instant now = Instant.now();
        OAuth2AccessToken access = new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER, "access-token", now,
                now.plusSeconds(300), Set.of("openid", "email", "profile"));
        OidcIdToken id = OidcIdToken.withTokenValue("id-token")
                .issuer("https://accounts.google.com")
                .subject("1234567890")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("email", email)
                .claim("email_verified", verified)
                .build();
        return new OidcUserRequest(registration, access, id);
    }
}
