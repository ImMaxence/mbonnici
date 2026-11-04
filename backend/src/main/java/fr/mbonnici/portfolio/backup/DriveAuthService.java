package fr.mbonnici.portfolio.backup;

import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bridges the persisted {@code google-drive} authorisation (refresh token in the database) and
 * short-lived access tokens: scheduled backups run without anyone being logged in.
 */
@Service
public class DriveAuthService {

    public static final String REGISTRATION_ID = "google-drive";
    private static final Logger log = LoggerFactory.getLogger(DriveAuthService.class);

    private final OAuth2AuthorizedClientManager manager;
    private final OAuth2AuthorizedClientService clients;
    private final BackupSettingsRepository settings;

    public DriveAuthService(OAuth2AuthorizedClientManager manager, OAuth2AuthorizedClientService clients,
            BackupSettingsRepository settings) {
        this.manager = manager;
        this.clients = clients;
        this.settings = settings;
    }

    public boolean connected() {
        String principal = settings.get().getGooglePrincipal();
        if (principal == null) {
            return false;
        }
        OAuth2AuthorizedClient client = clients.loadAuthorizedClient(REGISTRATION_ID, principal);
        return client != null && client.getRefreshToken() != null;
    }

    /** A valid access token, refreshed through the stored refresh token when needed. */
    public Optional<String> accessToken() {
        String principal = settings.get().getGooglePrincipal();
        if (principal == null) {
            return Optional.empty();
        }
        try {
            OAuth2AuthorizedClient client = manager.authorize(
                    OAuth2AuthorizeRequest.withClientRegistrationId(REGISTRATION_ID).principal(principal).build());
            return Optional.ofNullable(client).map(c -> c.getAccessToken().getTokenValue());
        } catch (RuntimeException e) {
            log.warn("Google Drive token refresh failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    @Transactional
    public void disconnect() {
        BackupSettings s = settings.get();
        if (s.getGooglePrincipal() != null) {
            clients.removeAuthorizedClient(REGISTRATION_ID, s.getGooglePrincipal());
        }
        s.setGooglePrincipal(null);
        s.setGoogleEmail(null);
        s.setDriveFolderId(null);
        s.setAutoEnabled(false);
        s.touch();
        settings.save(s);
    }
}
