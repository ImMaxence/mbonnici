package fr.mbonnici.portfolio;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * Runs against a real servlet container: the MockMvc {@code csrf()} post-processor swaps the token
 * repository for the whole context, so the cookie contract is verified here in isolation.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import({TestcontainersConfiguration.class, TestStorageConfiguration.class})
class CsrfCookieTest {

    @LocalServerPort
    int port;

    @Test
    void readableCsrfCookieIsIssuedOnFirstGet() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> res = client.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/settings")).GET().build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(res.statusCode()).isEqualTo(200);
        List<String> cookies = res.headers().allValues("Set-Cookie");
        assertThat(cookies).anySatisfy(c -> {
            assertThat(c).startsWith("XSRF-TOKEN=");
            assertThat(c).contains("Path=/");
            assertThat(c).contains("SameSite=Lax");
            assertThat(c).doesNotContain("HttpOnly");
        });
        // no session is created for anonymous visitors
        assertThat(cookies).noneMatch(c -> c.startsWith("PSESSION="));
    }
}
