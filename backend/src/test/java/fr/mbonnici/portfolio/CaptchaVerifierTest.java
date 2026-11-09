package fr.mbonnici.portfolio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sun.net.httpserver.HttpServer;
import fr.mbonnici.portfolio.analytics.VisitorHasher;
import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.contact.CaptchaVerifier;
import fr.mbonnici.portfolio.contact.ContactController;
import fr.mbonnici.portfolio.contact.ContactController.ContactInput;
import fr.mbonnici.portfolio.contact.ContactMessage;
import fr.mbonnici.portfolio.contact.ContactRepository;
import fr.mbonnici.portfolio.errors.ErrorLogService;
import fr.mbonnici.portfolio.errors.ErrorLogService.Source;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import tools.jackson.databind.ObjectMapper;

/** What Google answers against what the contact form does, with a local stand-in for siteverify. */
class CaptchaVerifierTest {

    private final ErrorLogService errors = mock(ErrorLogService.class);
    private final AtomicReference<String> answer = new AtomicReference<>();
    private final AtomicReference<String> received = new AtomicReference<>();
    private HttpServer google;

    @BeforeEach
    void startGoogle() throws Exception {
        google = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        google.createContext("/siteverify", exchange -> {
            received.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = answer.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        google.start();
    }

    @AfterEach
    void stopGoogle() {
        google.stop(0);
    }

    private CaptchaVerifier verifier(String site, String secret, String url) {
        AppProperties props = new AppProperties("https://mbonnici.fr", List.of("a@b.fr"), false, null, null, null, false,
                new AppProperties.Captcha(site, secret, url));
        return new CaptchaVerifier(props, new ObjectMapper(), errors);
    }

    private CaptchaVerifier verifier() {
        return verifier("site", "s3cret&", "http://127.0.0.1:" + google.getAddress().getPort() + "/siteverify");
    }

    @Test
    void withoutBothKeysThereIsNoCaptcha() {
        CaptchaVerifier noKeys = verifier("", "", "http://unused.invalid");
        assertNull(noKeys.siteKey());
        assertTrue(noKeys.accepts(null));
        assertNull(verifier("site", "", "http://unused.invalid").siteKey());
    }

    @Test
    void aTickedBoxPasses() {
        answer.set("""
                {"success": true, "challenge_ts": "2026-11-09T18:00:00Z", "hostname": "mbonnici.fr"}""");
        assertTrue(verifier().accepts("a token"));
        assertEquals("secret=s3cret%26&response=a+token", received.get());
    }

    @Test
    void aTokenIsRequiredOnceTheKeysAreSet() {
        assertFalse(verifier().accepts(null));
        assertFalse(verifier().accepts(" "));
    }

    @Test
    void anInvalidOrReusedTokenIsRefused() {
        answer.set("""
                {"success": false, "error-codes": ["timeout-or-duplicate"]}""");
        assertFalse(verifier().accepts("token"));
        verify(errors, never()).record(any(), any(), any(), any());
    }

    @Test
    void aWrongSecretKeyLetsTheMessageThroughAndReachesTheJournal() {
        answer.set("""
                {"success": false, "error-codes": ["invalid-input-secret"]}""");
        assertTrue(verifier().accepts("token"));
        verify(errors).record(eq(Source.SERVER), anyString(), any(), eq("POST /api/contact"));
    }

    @Test
    void googleBeingDownLetsTheMessageThroughAndReachesTheJournal() {
        answer.set("<html>503</html>");
        assertTrue(verifier().accepts("token"));
        verify(errors).recordServer(any(), eq("POST /api/contact"));
    }

    @Test
    void aRefusedCaptchaKeepsTheMessageOut() {
        ContactRepository repository = mock(ContactRepository.class);
        CaptchaVerifier captcha = mock(CaptchaVerifier.class);
        ContactController controller = new ContactController(repository, mock(VisitorHasher.class), captcha);
        ContactInput input = new ContactInput("Jane Doe", "jane@example.com", "Bonjour, un projet à vous proposer", "fr", null, "bad");

        when(captcha.accepts("bad")).thenReturn(false);
        ApiException refused = assertThrows(ApiException.class, () -> controller.submit(input, new MockHttpServletRequest()));
        assertEquals(HttpStatus.UNPROCESSABLE_CONTENT, refused.status());
        verify(repository, never()).save(any(ContactMessage.class));

        when(captcha.accepts("bad")).thenReturn(true);
        controller.submit(input, new MockHttpServletRequest());
        verify(repository).save(any(ContactMessage.class));
    }
}
