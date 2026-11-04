package fr.mbonnici.portfolio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

class SecurityTest extends AbstractIntegrationTest {

    @Test
    void adminApiRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/admin/projects")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/info")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/analytics/overview")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/actuator/env")).andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousMeIsNotAuthenticated() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void adminCanReadAdminApi() throws Exception {
        mvc.perform(get("/api/admin/projects")).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.email").value("admin@example.com"));
        mvc.perform(get("/api/admin/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.backend.springBootVersion").isNotEmpty())
                .andExpect(jsonPath("$.database.status").value("ok"))
                .andExpect(jsonPath("$.storage.status").value("ok"));
    }

    @Test
    @WithMockUser(roles = "USER")
    void nonAdminIsForbidden() throws Exception {
        mvc.perform(get("/api/admin/projects")).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/me")).andExpect(jsonPath("$.authenticated").value(false));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void mutationsRequireCsrfToken() throws Exception {
        String body = """
                {"ownerName":"X","headline":{"fr":"a","en":"b"},"bio":{"fr":"","en":""},"availability":"OPEN"}
                """;
        mvc.perform(put("/api/admin/settings").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerName").value("X"));
        // restore
        String restore = """
                {"ownerName":"Maxence Bonnici","headline":{"fr":"Développeur Full Stack Java & Angular","en":"Full Stack Developer, Java & Angular"},
                 "bio":{"fr":"","en":""},"availability":"LISTENING","legalName":"Maxence Bonnici"}
                """;
        mvc.perform(put("/api/admin/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(restore))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void logoutReturnsNoContent() throws Exception {
        mvc.perform(post("/api/auth/logout").with(csrf())).andExpect(status().isNoContent());
    }

    @Test
    void securityHeaders() throws Exception {
        mvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().exists("Referrer-Policy"))
                .andExpect(header().exists("Permissions-Policy"));
    }
}
