package fr.mbonnici.portfolio.auth;

import fr.mbonnici.portfolio.backup.BackupSettings;
import fr.mbonnici.portfolio.backup.BackupSettingsRepository;
import fr.mbonnici.portfolio.backup.DriveAuthService;
import fr.mbonnici.portfolio.config.AppProperties;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Google sign-in is the only way in, and only the configured e-mail address(es) are let through.
 * Anyone else gets an OAuth2 error and never obtains a session. The same check guards the
 * {@code google-drive} registration used to link Drive for backups.
 */
@Service
public class AdminOidcUserService extends OidcUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminOidcUserService.class);
    public static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final Set<String> allowedEmails;
    private final BackupSettingsRepository backupSettings;

    public AdminOidcUserService(AppProperties props, BackupSettingsRepository backupSettings) {
        this.backupSettings = backupSettings;
        this.allowedEmails = props.adminEmails().stream()
                .filter(StringUtils::hasText)
                .map(e -> e.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
        OidcUser user = super.loadUser(userRequest);
        String email = user.getEmail();
        boolean verified = Boolean.TRUE.equals(user.getEmailVerified());

        if (!StringUtils.hasText(email) || !verified || !allowedEmails.contains(email.toLowerCase(Locale.ROOT))) {
            log.warn("Rejected sign-in attempt for {} (verified={})", email, verified);
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("not_allowed", "This Google account is not allowed to administer this site.", null));
        }

        String registration = userRequest.getClientRegistration().getRegistrationId();
        if (DriveAuthService.REGISTRATION_ID.equals(registration)) {
            // remember which principal holds the Drive refresh token (scheduled backups use it)
            BackupSettings s = backupSettings.get();
            s.setGooglePrincipal(user.getName());
            s.setGoogleEmail(email);
            s.touch();
            backupSettings.save(s);
            log.info("Google Drive linked for {}", email);
        }

        Set<GrantedAuthority> authorities = new HashSet<>(user.getAuthorities());
        authorities.add(new SimpleGrantedAuthority(ROLE_ADMIN));
        log.info("Admin signed in: {} ({})", email, registration);
        return new DefaultOidcUser(authorities, user.getIdToken(), user.getUserInfo());
    }
}
