package fr.mbonnici.portfolio.config;

import fr.mbonnici.portfolio.auth.AdminOidcUserService;
import fr.mbonnici.portfolio.backup.DriveAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.AuthorizedClientServiceOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.JdbcOAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    public static final String SESSION_COOKIE = "PSESSION";
    public static final String CSRF_COOKIE = "XSRF-TOKEN";
    public static final String AUTHORIZATION_BASE = "/api/auth/oauth2/authorization";

    /** OAuth2 clients (access + refresh tokens) live in the database so scheduled jobs can use Drive. */
    @Bean
    OAuth2AuthorizedClientService authorizedClientService(JdbcOperations jdbc, ClientRegistrationRepository registrations) {
        return new JdbcOAuth2AuthorizedClientService(jdbc, registrations);
    }

    @Bean
    OAuth2AuthorizedClientManager authorizedClientManager(ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientService clients) {
        var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, clients);
        manager.setAuthorizedClientProvider(OAuth2AuthorizedClientProviderBuilder.builder().refreshToken().build());
        return manager;
    }

    /** The Drive connection asks Google for offline access so a refresh token is issued. */
    @Bean
    OAuth2AuthorizationRequestResolver authorizationRequestResolver(ClientRegistrationRepository registrations) {
        var resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, AUTHORIZATION_BASE);
        resolver.setAuthorizationRequestCustomizer(builder -> builder.attributes(attrs -> {
            if (DriveAuthService.REGISTRATION_ID.equals(attrs.get(OAuth2ParameterNames.REGISTRATION_ID))) {
                builder.additionalParameters(params -> {
                    params.put("access_type", "offline");
                    params.put("prompt", "consent");
                });
            }
        }));
        return resolver;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, AdminOidcUserService oidcUserService,
            OAuth2AuthorizationRequestResolver resolver, AppProperties props) throws Exception {

        var apiRequests = PathPatternRequestMatcher.withDefaults().matcher("/api/**");

        AuthenticationSuccessHandler onSuccess = (HttpServletRequest request, HttpServletResponse response,
                Authentication authentication) -> {
            boolean drive = authentication instanceof OAuth2AuthenticationToken token
                    && DriveAuthService.REGISTRATION_ID.equals(token.getAuthorizedClientRegistrationId());
            response.sendRedirect(props.url() + (drive ? "/admin/backups?connected=1" : "/admin"));
        };
        var onFailure = new SimpleUrlAuthenticationFailureHandler(props.url() + "/admin/login?error=not_allowed");

        var csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepository.setCookieName(CSRF_COOKIE);
        csrfRepository.setCookieCustomizer(cookie -> cookie.sameSite("Lax"));

        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfRepository)
                        .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                        // anonymous, cookieless beacon endpoint: nothing to forge
                        .ignoringRequestMatchers("/api/analytics/**"))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/actuator/health", "/api/actuator/health/**").permitAll()
                        .requestMatchers("/api/actuator/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .oauth2Login(oauth -> oauth
                        .authorizationEndpoint(a -> a.authorizationRequestResolver(resolver))
                        .redirectionEndpoint(r -> r.baseUri("/api/auth/oauth2/code/*"))
                        .userInfoEndpoint(u -> u.oidcUserService(oidcUserService))
                        .successHandler(onSuccess)
                        .failureHandler(onFailure))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT))
                        .invalidateHttpSession(true)
                        .deleteCookies(SESSION_COOKIE, CSRF_COOKIE))
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED), apiRequests))
                .sessionManagement(session -> session.sessionFixation(f -> f.newSession()))
                .headers(headers -> headers
                        .contentTypeOptions(Customizer.withDefaults())
                        .frameOptions(frame -> frame.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .permissionsPolicyHeader(p -> p.policy("camera=(), microphone=(), geolocation=(), payment=(), usb=()"))
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000)));

        return http.build();
    }
}
