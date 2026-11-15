package fr.mbonnici.portfolio;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import fr.mbonnici.portfolio.storage.StorageService;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

/** v1.13.0: what the back office deletes goes to the bin and can be put back, or emptied for good. */
@WithMockUser(roles = "ADMIN")
class TrashTest extends AbstractIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    StorageService storage;

    @Test
    void aDeletedProjectComesBackWithItsPicturesAndVisits() throws Exception {
        String cover = upload("cover.png");
        String shot = upload("shot.png");
        String slug = "bin-" + UUID.randomUUID().toString().substring(0, 8);
        String id = JsonPath.read(mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug": "%s", "title": {"fr": "Projet corbeille", "en": "Bin project"}, "status": "PUBLISHED",
                                 "category": "WEB", "stack": ["Angular", "Java"], "coverMediaId": "%s",
                                 "media": [{"mediaId": "%s", "kind": "GALLERY", "sortOrder": 0}]}
                                """.formatted(slug, cover, shot)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
        jdbc.update("insert into analytics_event (type, path, project_id, visitor_hash) values ('PROJECT_VIEW', ?, ?::uuid, 'x')",
                "/fr/projets/" + slug, id);

        mvc.perform(delete("/api/admin/projects/" + id).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/projects/" + slug)).andExpect(status().isNotFound());
        String item = itemId("PROJECT", "Projet corbeille");
        mvc.perform(get("/api/admin/trash"))
                .andExpect(jsonPath("$[?(@.id == '" + item + "')].detail").value(hasItem(slug)))
                .andExpect(jsonPath("$[?(@.id == '" + item + "')].preview").value(hasItem(org.hamcrest.Matchers.startsWith("/api/media/"))));

        mvc.perform(post("/api/admin/trash/" + item + "/restore").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("PROJECT"))
                .andExpect(jsonPath("$.id").value(id));
        mvc.perform(get("/api/projects/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cover.id").value(cover))
                .andExpect(jsonPath("$.gallery[0].id").value(shot))
                .andExpect(jsonPath("$.stack[1]").value("Java"));
        assertEquals(1, jdbc.queryForObject("select count(*) from analytics_event where project_id = ?::uuid", Integer.class, id));
        mvc.perform(get("/api/admin/trash")).andExpect(jsonPath("$[*].id", not(hasItem(item))));
        // once back, it is not in the bin any more
        mvc.perform(post("/api/admin/trash/" + item + "/restore").with(csrf())).andExpect(status().isNotFound());

        mvc.perform(delete("/api/admin/projects/" + id).with(csrf())).andExpect(status().isNoContent());
        purgeLatest("PROJECT", "Projet corbeille");
    }

    @Test
    void aProjectWhoseAddressIsTakenAgainIsNotRestored() throws Exception {
        String slug = "bin-" + UUID.randomUUID().toString().substring(0, 8);
        String body = """
                {"slug": "%s", "title": {"fr": "%s", "en": ""}, "status": "DRAFT", "category": "WEB"}
                """;
        String first = JsonPath.read(mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted(slug, "Premier"))).andReturn().getResponse().getContentAsString(), "$.id");
        mvc.perform(delete("/api/admin/projects/" + first).with(csrf())).andExpect(status().isNoContent());
        String second = JsonPath.read(mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted(slug, "Second"))).andReturn().getResponse().getContentAsString(), "$.id");

        String item = itemId("PROJECT", "Premier");
        mvc.perform(post("/api/admin/trash/" + item + "/restore").with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("trash.slug")));
        mvc.perform(delete("/api/admin/projects/" + second).with(csrf()));
        purgeLatest("PROJECT", "Second");
        mvc.perform(post("/api/admin/trash/" + item + "/restore").with(csrf())).andExpect(status().isOk());
        mvc.perform(delete("/api/admin/projects/" + first).with(csrf()));
        purgeLatest("PROJECT", "Premier");
    }

    @Test
    void aDeletedCoverIsPutBackAndItsFilesStayUntilTheBinIsEmptied() throws Exception {
        String cover = upload("cover-bin.png");
        String key = jdbc.queryForObject("select object_key from media where id = ?::uuid", String.class, cover);
        String project = JsonPath.read(mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": {"fr": "Couverture corbeille", "en": ""}, "status": "DRAFT", "category": "WEB", "coverMediaId": "%s"}
                                """.formatted(cover)))
                .andReturn().getResponse().getContentAsString(), "$.id");

        mvc.perform(delete("/api/admin/media/" + cover).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/media/" + key)).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/projects/" + project)).andExpect(jsonPath("$.coverMediaId").doesNotExist());
        assertTrue(storage.get(key).isPresent(), "the file waits in the bucket");

        String item = itemId("MEDIA", "cover-bin.png");
        mvc.perform(get("/api/admin/trash/" + item + "/preview")).andExpect(status().isOk());
        mvc.perform(post("/api/admin/trash/" + item + "/restore").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(cover));
        mvc.perform(get("/api/media/" + key)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/projects/" + project)).andExpect(jsonPath("$.coverMediaId").value(cover));

        // deleted again, then for good: the files go too
        mvc.perform(delete("/api/admin/projects/" + project).with(csrf()));
        purgeLatest("PROJECT", "Couverture corbeille");
        mvc.perform(delete("/api/admin/media/" + cover).with(csrf())).andExpect(status().isNoContent());
        String again = itemId("MEDIA", "cover-bin.png");
        mvc.perform(delete("/api/admin/trash/" + again).with(csrf())).andExpect(status().isNoContent());
        assertFalse(storage.get(key).isPresent(), "emptied: the file is gone");
    }

    @Test
    void profileEntriesMessagesAndResumesComeBack() throws Exception {
        String skill = JsonPath.read(mvc.perform(post("/api/admin/profile/skills").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Corbeille-Lang\", \"category\": \"LANGUAGE\", \"level\": 3, \"sortOrder\": 99}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
        mvc.perform(delete("/api/admin/profile/skills/" + skill).with(csrf())).andExpect(status().isNoContent());
        // typed again in the meantime: restoring would make a duplicate
        String twin = JsonPath.read(mvc.perform(post("/api/admin/profile/skills").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"corbeille-lang\", \"category\": \"TOOL\", \"level\": 3, \"sortOrder\": 99}"))
                .andReturn().getResponse().getContentAsString(), "$.id");
        String skillItem = itemId("SKILL", "Corbeille-Lang");
        mvc.perform(post("/api/admin/trash/" + skillItem + "/restore").with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("trash.twin")));
        mvc.perform(delete("/api/admin/profile/skills/" + twin).with(csrf()));
        mvc.perform(post("/api/admin/trash/" + skillItem + "/restore").with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/profile")).andExpect(jsonPath("$.skills[*].name", hasItem("Corbeille-Lang")));

        String news = JsonPath.read(mvc.perform(post("/api/admin/profile/testimonials").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"author": "Outil corbeille", "url": "https://github.com/x/y", "role": {"fr": "Projet GitHub", "en": ""},
                                 "quote": {"fr": "Résumé", "en": ""}, "sortOrder": 0}
                                """))
                .andReturn().getResponse().getContentAsString(), "$.id");
        mvc.perform(delete("/api/admin/profile/testimonials/" + news).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/profile")).andExpect(jsonPath("$.testimonials[*].id", not(hasItem(news))));
        mvc.perform(post("/api/admin/trash/" + itemId("NEWS", "Outil corbeille") + "/restore").with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/profile")).andExpect(jsonPath("$.testimonials[*].id", hasItem(news)));

        UUID message = jdbc.queryForObject("insert into contact_message (name, email, message) values ('Corbeille Dupont', 'c@example.com', 'Bonjour') returning id", UUID.class);
        mvc.perform(delete("/api/admin/messages/" + message).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(post("/api/admin/trash/" + itemId("MESSAGE", "Corbeille Dupont") + "/restore").with(csrf())).andExpect(status().isOk());
        assertEquals("Bonjour", jdbc.queryForObject("select message from contact_message where id = ?", String.class, message));

        mvc.perform(multipart("/api/admin/cv/en").file(new MockMultipartFile("file", "cv.pdf", "application/pdf",
                "%PDF-1.4 test".getBytes(StandardCharsets.US_ASCII))).with(csrf())).andExpect(status().isOk());
        String cvKey = jdbc.queryForObject("select cv_en_key from site_settings", String.class);
        mvc.perform(delete("/api/admin/cv/en").with(csrf())).andExpect(status().isOk());
        assertTrue(storage.get(cvKey).isPresent());
        String cvItem = latest("CV");
        mvc.perform(post("/api/admin/trash/" + cvItem + "/restore").with(csrf())).andExpect(status().isOk());
        assertEquals(cvKey, jdbc.queryForObject("select cv_en_key from site_settings", String.class));
        mvc.perform(get("/api/cv").param("lang", "en")).andExpect(status().isOk());

        mvc.perform(delete("/api/admin/profile/skills/" + skill).with(csrf()));
        mvc.perform(delete("/api/admin/profile/testimonials/" + news).with(csrf()));
        mvc.perform(delete("/api/admin/cv/en").with(csrf()));
    }

    @Test
    void theNightlyCleanupEmptiesWhatIsOlderThan30Days() throws Exception {
        String media = upload("old.png");
        String key = jdbc.queryForObject("select object_key from media where id = ?::uuid", String.class, media);
        mvc.perform(delete("/api/admin/media/" + media).with(csrf())).andExpect(status().isNoContent());
        String item = itemId("MEDIA", "old.png");
        jdbc.update("update trash_item set deleted_at = now() - interval '31 days' where id = ?::uuid", item);
        purgeExpired.purgeExpired();
        mvc.perform(get("/api/admin/trash")).andExpect(jsonPath("$[*].id", not(hasItem(item))));
        assertFalse(storage.get(key).isPresent());
    }

    @Autowired
    fr.mbonnici.portfolio.trash.TrashService purgeExpired;

    // ── helpers ──────────────────────────────────────────────────────────────

    private String upload(String name) throws Exception {
        return JsonPath.read(mvc.perform(multipart("/api/admin/media")
                        .file(new MockMultipartFile("file", name, "image/png", png())).with(csrf()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
    }

    /** the newest bin item of that kind and label */
    private String itemId(String kind, String label) {
        List<String> ids = jdbc.queryForList("select id::text from trash_item where kind = ? and label = ? order by deleted_at desc limit 1",
                String.class, kind, label);
        assertFalse(ids.isEmpty(), "no " + kind + " \"" + label + "\" in the bin");
        return ids.get(0);
    }

    private String latest(String kind) {
        return jdbc.queryForObject("select id::text from trash_item where kind = ? order by deleted_at desc limit 1", String.class, kind);
    }

    private void purgeLatest(String kind, String label) throws Exception {
        mvc.perform(delete("/api/admin/trash/" + itemId(kind, label)).with(csrf())).andExpect(status().isNoContent());
    }

    private static byte[] png() throws Exception {
        BufferedImage img = new BufferedImage(320, 200, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(230, 90, 40));
        g.fillRect(0, 0, 320, 200);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }
}
