package fr.mbonnici.portfolio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class RateLimitTest extends AbstractIntegrationTest {

    @Test
    void contactEndpointIsThrottledPerIp() throws Exception {
        // test profile: contact-per-hour = 10 ; a dedicated IP so other tests are unaffected
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/contact").with(csrf()).with(r -> {
                        r.setRemoteAddr("10.9.9.9");
                        return r;
                    }).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(header().string("X-RateLimit-Policy", "contact"));
        }
        mvc.perform(post("/api/contact").with(csrf()).with(r -> {
                    r.setRemoteAddr("10.9.9.9");
                    return r;
                }).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.status").value(429));

        // another client is not affected
        mvc.perform(post("/api/contact").with(csrf()).with(r -> {
                    r.setRemoteAddr("10.9.9.10");
                    return r;
                }).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void proxyHeadersAreIgnoredUnlessTrusted() throws Exception {
        // trust-proxy=false in tests: spoofing X-Forwarded-For must not create a fresh bucket
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/contact").with(csrf()).with(r -> {
                        r.setRemoteAddr("10.7.7.7");
                        return r;
                    }).header("X-Forwarded-For", "1.2.3." + i)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/contact").with(csrf()).with(r -> {
                    r.setRemoteAddr("10.7.7.7");
                    return r;
                }).header("X-Forwarded-For", "9.9.9.9")
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void readEndpointsAdvertiseTheirPolicy() throws Exception {
        mvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-RateLimit-Policy", "api"))
                .andExpect(header().exists("X-RateLimit-Limit"));
    }
}
