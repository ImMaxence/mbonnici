package fr.mbonnici.portfolio;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

@WithMockUser(roles = "ADMIN")
class AdminProjectTest extends AbstractIntegrationTest {

    private static final String NEW_PROJECT = """
            {
              "title": {"fr": "Mon nouveau projet", "en": "My new project"},
              "tagline": {"fr": "Accroche", "en": "Tagline"},
              "description": {"fr": "Desc **fr**", "en": "Desc **en**"},
              "status": "DRAFT",
              "featured": true,
              "sortOrder": 99,
              "year": 2026,
              "category": "WEB",
              "sceneType": "HELIX",
              "accentColor": "#ABCDEF",
              "repoUrl": "https://github.com/ImMaxence/x",
              "liveUrl": "https://x.mbonnici.fr",
              "allowIframe": true,
              "stack": ["Angular", "Spring Boot", "Angular"],
              "tags": ["test"],
              "media": []
            }
            """;

    @Test
    void createPublishUpdateDeleteLifecycle() throws Exception {
        String created = mvc.perform(post("/api/admin/projects").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(NEW_PROJECT))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value("my-new-project"))
                .andExpect(jsonPath("$.accentColor").value("#abcdef"))
                .andExpect(jsonPath("$.stack.length()").value(2))
                .andExpect(jsonPath("$.publishedAt").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");

        mvc.perform(get("/api/projects"))
                .andExpect(jsonPath("$[*].slug", not(hasItem("my-new-project"))));

        mvc.perform(put("/api/admin/projects/" + id + "/status").with(csrf()).param("status", "PUBLISHED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.publishedAt").exists());

        mvc.perform(get("/api/projects"))
                .andExpect(jsonPath("$[*].slug", hasItem("my-new-project")));
        mvc.perform(get("/api/projects/my-new-project"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sceneType").value("HELIX"));

        // slug collision with a seeded project
        String collide = NEW_PROJECT.replace("\"status\": \"DRAFT\"", "\"status\": \"PUBLISHED\", \"slug\": \"localatscv\"");
        mvc.perform(put("/api/admin/projects/" + id).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(collide))
                .andExpect(status().isConflict());

        // invalid colour and URL are rejected with field detail
        String badColour = NEW_PROJECT.replace("#ABCDEF", "red");
        mvc.perform(put("/api/admin/projects/" + id).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(badColour))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.accentColor").exists());
        String badUrl = NEW_PROJECT.replace("https://x.mbonnici.fr", "javascript:alert(1)");
        mvc.perform(put("/api/admin/projects/" + id).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(badUrl))
                .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/admin/projects/" + id).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/projects/" + id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/projects/my-new-project")).andExpect(status().isNotFound());
    }

    @Test
    void reorderChangesPublicOrder() throws Exception {
        String list = mvc.perform(get("/api/admin/projects")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        java.util.List<String> ids = JsonPath.read(list, "$[*].id");
        java.util.List<String> slugs = JsonPath.read(list, "$[*].slug");

        // move the last one first
        java.util.List<String> reordered = new java.util.ArrayList<>(ids);
        String last = reordered.remove(reordered.size() - 1);
        reordered.add(0, last);
        String body = "{\"ids\":[" + reordered.stream().map(s -> "\"" + s + "\"").reduce((a, b) -> a + "," + b).orElse("")
                + "]}";
        mvc.perform(put("/api/admin/projects/reorder").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/projects"))
                .andExpect(jsonPath("$[0].slug").value(slugs.get(slugs.size() - 1)));

        // restore the seeded order
        String restore = "{\"ids\":[" + ids.stream().map(s -> "\"" + s + "\"").reduce((a, b) -> a + "," + b).orElse("") + "]}";
        mvc.perform(put("/api/admin/projects/reorder").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(restore))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/projects")).andExpect(jsonPath("$[0].slug").value(slugs.get(0)));
    }
}
