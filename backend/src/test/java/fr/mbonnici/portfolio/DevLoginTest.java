package fr.mbonnici.portfolio;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/** The local sign-in shortcut is off unless DEV_LOGIN=true and APP_URL is localhost. */
class DevLoginTest extends AbstractIntegrationTest {

    @Test
    void devLoginIsDisabledByDefault() throws Exception {
        mvc.perform(get("/api/auth/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.devLogin").value(false));
        mvc.perform(get("/api/auth/dev-login")).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/projects")).andExpect(status().isUnauthorized());
    }
}
