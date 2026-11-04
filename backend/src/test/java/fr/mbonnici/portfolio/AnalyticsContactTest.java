package fr.mbonnici.portfolio;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AnalyticsContactTest extends AbstractIntegrationTest {

    private static final String EVENTS = """
            {"events": [
              {"type": "PAGE_VIEW", "path": "/fr", "locale": "fr", "theme": "dark", "style": "obsidian",
               "referrer": "https://www.linkedin.com/in/x", "viewportWidth": 1440},
              {"type": "PROJECT_VIEW", "path": "/fr/projets/localatscv", "projectSlug": "localatscv", "locale": "fr",
               "theme": "dark", "style": "obsidian", "viewportWidth": 390},
              {"type": "OUTBOUND_CLICK", "path": "/fr/projets/localatscv", "projectSlug": "localatscv", "locale": "fr"}
            ]}
            """;

    @Test
    void eventsAreAggregatedForTheAdmin() throws Exception {
        mvc.perform(post("/api/analytics/events").contentType(MediaType.APPLICATION_JSON).content(EVENTS)
                        .header("User-Agent", "Mozilla/5.0 (Macintosh)").header("Referer", "https://www.linkedin.com/"))
                .andExpect(status().isAccepted());

        mvc.perform(get("/api/admin/analytics/overview").param("days", "7").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(7))
                .andExpect(jsonPath("$.pageViews").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.visitors").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.projectViews").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.outboundClicks").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.topProjects[*].slug", hasItem("localatscv")))
                .andExpect(jsonPath("$.topProjects[0].title.fr").value("LocalATSCV"))
                .andExpect(jsonPath("$.referrers[*].key", hasItem("linkedin.com")))
                .andExpect(jsonPath("$.locales[*].key", hasItem("fr")))
                .andExpect(jsonPath("$.styles[*].key", hasItem("obsidian")))
                .andExpect(jsonPath("$.daily").isArray());
    }

    @Test
    void doNotTrackIsHonoured() throws Exception {
        String before = mvc.perform(get("/api/admin/analytics/overview").with(user("admin").roles("ADMIN")))
                .andReturn().getResponse().getContentAsString();
        int views = JsonPath.read(before, "$.pageViews");

        mvc.perform(post("/api/analytics/events").contentType(MediaType.APPLICATION_JSON).content(EVENTS).header("DNT", "1"))
                .andExpect(status().isAccepted());
        mvc.perform(post("/api/analytics/events").contentType(MediaType.APPLICATION_JSON).content(EVENTS).header("Sec-GPC", "1"))
                .andExpect(status().isAccepted());

        mvc.perform(get("/api/admin/analytics/overview").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.pageViews").value(views));
    }

    @Test
    void oversizedOrMalformedBatchesAreRejected() throws Exception {
        mvc.perform(post("/api/analytics/events").contentType(MediaType.APPLICATION_JSON).content("{\"events\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/analytics/events").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"events\":[{\"type\":\"NOPE\",\"path\":\"/\"}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void contactFormStoresMessagesAndDropsBots() throws Exception {
        String unreadBefore = mvc.perform(get("/api/admin/messages/unread-count").with(user("admin").roles("ADMIN")))
                .andReturn().getResponse().getContentAsString();
        int unread = JsonPath.read(unreadBefore, "$.unread");

        mvc.perform(post("/api/contact").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"name":"Jane Doe","email":"jane@example.com","message":"Bonjour, je souhaite échanger sur un projet.","locale":"fr"}
                        """))
                .andExpect(status().isAccepted());

        mvc.perform(post("/api/contact").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"name":"Bot","email":"bot@example.com","message":"buy cheap stuff now please","website":"http://spam"}
                        """))
                .andExpect(status().isAccepted());

        mvc.perform(post("/api/contact").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"name":"J","email":"not-an-email","message":"short"}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.email").exists())
                .andExpect(jsonPath("$.fields.message").exists());

        mvc.perform(get("/api/admin/messages/unread-count").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.unread").value(unread + 1));
        mvc.perform(get("/api/admin/messages").param("unread", "true").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Jane Doe"))
                .andExpect(jsonPath("$.items[0].read").value(false));
    }

    @Test
    void contactRequiresCsrf() throws Exception {
        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content("""
                        {"name":"Jane Doe","email":"jane@example.com","message":"Bonjour, je souhaite échanger sur un projet."}
                        """))
                .andExpect(status().isForbidden());
    }
}
