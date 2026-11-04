package fr.mbonnici.portfolio;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

/** v1.4.0: case studies and previews, notes, CV, web vitals, archived messages, responsive images. */
@WithMockUser(roles = "ADMIN")
class FeaturesTest extends AbstractIntegrationTest {

    @Autowired
    fr.mbonnici.portfolio.media.WebpEncoder webp;

    @Test
    void caseStudyAndDraftPreview() throws Exception {
        String created = mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"title": {"fr": "Étude de cas", "en": "Case study"}, "status": "DRAFT", "category": "WEB",
                         "caseStudy": {"context": {"fr": "Le contexte", "en": "The context"}, "role": {"fr": "Seul", "en": ""},
                                       "challenges": {"fr": "", "en": ""}, "results": {"fr": "-40 % de temps", "en": "-40% time"}}}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.caseStudy.context.fr").value("Le contexte"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");
        String slug = JsonPath.read(created, "$.slug");

        // a draft is not public, but the back office can preview its page
        mvc.perform(get("/api/projects/" + slug)).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/projects/" + id + "/preview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caseStudy.role.en").value("Seul"))
                .andExpect(jsonPath("$.caseStudy.results.fr").value("-40 % de temps"));

        mvc.perform(put("/api/admin/projects/" + id + "/status").with(csrf()).param("status", "PUBLISHED")).andExpect(status().isOk());
        mvc.perform(get("/api/projects/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caseStudy.context.en").value("The context"));
        mvc.perform(delete("/api/admin/projects/" + id).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/projects/" + id + "/preview").with(csrf())).andExpect(status().isNotFound());
    }

    @Test
    void notesArePublishedWithFeedAndSitemap() throws Exception {
        String created = mvc.perform(post("/api/admin/articles").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"title": {"fr": "Héberger soi-même", "en": "Self-hosting"},
                         "summary": {"fr": "Coolify, Cloudflare et SeaweedFS", "en": "Coolify, Cloudflare and SeaweedFS"},
                         "body": {"fr": "## Pourquoi\\n\\nParce que.", "en": "## Why\\n\\nBecause."},
                         "status": "DRAFT", "tags": ["devops", "devops", " coolify "]}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value("heberger-soi-meme"))
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");

        mvc.perform(get("/api/articles/heberger-soi-meme")).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/articles/" + id + "/preview")).andExpect(status().isOk())
                .andExpect(jsonPath("$.body.en").value(containsString("Because")));

        mvc.perform(put("/api/admin/articles/" + id + "/status").with(csrf()).param("status", "PUBLISHED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publishedAt").exists());
        mvc.perform(get("/api/articles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].slug", hasItem("heberger-soi-meme")))
                .andExpect(jsonPath("$[0].minutes.fr").value(1));
        mvc.perform(get("/api/articles/heberger-soi-meme"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title.en").value("Self-hosting"));

        mvc.perform(get("/en/rss.xml"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/rss+xml"))
                .andExpect(content().string(containsString("<title>Self-hosting</title>")))
                .andExpect(content().string(containsString("/en/notes/heberger-soi-meme</link>")));
        mvc.perform(get("/fr/rss.xml"))
                .andExpect(content().string(containsString("<title>Héberger soi-même</title>")));
        mvc.perform(get("/sitemap.xml"))
                .andExpect(content().string(containsString("/fr/notes/heberger-soi-meme")))
                .andExpect(content().string(containsString("/en/notes</loc>")));
        mvc.perform(get("/llms.txt")).andExpect(content().string(containsString("## Notes")));

        mvc.perform(delete("/api/admin/articles/" + id).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/articles")).andExpect(jsonPath("$[*].slug", not(hasItem("heberger-soi-meme"))));
    }

    @Test
    void cvIsAPdfMadeFromTheContent() throws Exception {
        var res = mvc.perform(get("/api/cv").param("lang", "fr"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString("maxence-bonnici-cv.pdf")))
                .andReturn().getResponse();
        byte[] pdf = res.getContentAsByteArray();
        assertTrue(pdf.length > 10_000, "a real document");
        assertEquals("%PDF", new String(pdf, 0, 4));
        String etag = res.getHeader("ETag");
        mvc.perform(get("/api/cv").param("lang", "fr").header("If-None-Match", etag)).andExpect(status().isNotModified());

        mvc.perform(get("/api/cv").param("lang", "en").param("download", "true"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("Content-Disposition", containsString("maxence-bonnici-resume.pdf")));
    }

    @Test
    void webVitalsAreCollectedAnonymously() throws Exception {
        String beacon = """
                {"path": "/fr/projets", "viewportWidth": 390,
                 "metrics": [{"name": "LCP", "value": 1800}, {"name": "CLS", "value": 0.02}, {"name": "INP", "value": 999999}]}
                """;
        // no CSRF token: a cookieless beacon, like the analytics events
        mvc.perform(post("/api/analytics/vitals").contentType(MediaType.APPLICATION_JSON).content(beacon))
                .andExpect(status().isAccepted());
        // opted out: nothing stored
        mvc.perform(post("/api/analytics/vitals").header("DNT", "1").contentType(MediaType.APPLICATION_JSON).content(beacon))
                .andExpect(status().isAccepted());
        mvc.perform(post("/api/analytics/vitals").contentType(MediaType.APPLICATION_JSON).content("""
                        {"path": "/fr", "metrics": [{"name": "NOPE", "value": 1}]}
                        """))
                .andExpect(status().isBadRequest());

        String overview = mvc.perform(get("/api/admin/analytics/vitals").param("days", "7"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Integer> lcpSamples = JsonPath.read(overview, "$.metrics[?(@.metric == 'LCP')].samples");
        assertTrue(lcpSamples.getFirst() >= 1);
        // the absurd INP was dropped
        List<Integer> inpSamples = JsonPath.read(overview, "$.metrics[?(@.metric == 'INP')].samples");
        assertEquals(0, inpSamples.getFirst());
        mvc.perform(get("/api/admin/analytics/vitals"))
                .andExpect(jsonPath("$.pages[*].path", hasItem("/fr/projets")))
                .andExpect(jsonPath("$.byDevice.mobile[0].samples").value(greaterThanOrEqualTo(1)));
    }

    @Test
    void messagesCanBeArchivedAndSearched() throws Exception {
        mvc.perform(post("/api/contact").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"name":"Ada Lovelace","email":"ada@example.com","message":"Bonjour, une question sur Kryptonews svp","locale":"fr"}
                        """))
                .andExpect(status().isAccepted());
        String found = mvc.perform(get("/api/admin/messages").param("q", "KRYPTO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Ada Lovelace"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(found, "$.items[0].id");
        mvc.perform(get("/api/admin/messages").param("q", "100%_")).andExpect(jsonPath("$.total").value(0));

        mvc.perform(put("/api/admin/messages/" + id + "/archived").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true))
                .andExpect(jsonPath("$.read").value(true));
        mvc.perform(get("/api/admin/messages").param("q", "krypto")).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/admin/messages").param("archived", "true").param("q", "ada@"))
                .andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get("/api/admin/messages/unread-count")).andExpect(jsonPath("$.archived").value(greaterThanOrEqualTo(1)));
        mvc.perform(put("/api/admin/messages/" + id + "/archived").with(csrf()).param("value", "false"))
                .andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    void responsiveCopiesFocalPointAndCleanup() throws Exception {
        String uploaded = mvc.perform(multipart("/api/admin/media")
                        .file(new MockMultipartFile("file", "wide.png", "image/png", png(2000, 1200))).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.focalX").value(0.5))
                .andExpect(jsonPath("$.focalY").value(0.0))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(uploaded, "$.id");
        String url = JsonPath.read(uploaded, "$.url");

        if (webp.available()) {
            String srcset = JsonPath.read(uploaded, "$.srcset");
            assertTrue(srcset.contains("-w640.webp 640w") && srcset.contains("-w1920.webp 1920w") && srcset.endsWith(" 2000w"), srcset);
            String small = url.replace(".webp", "-w640.webp");
            mvc.perform(get(small)).andExpect(status().isOk()).andExpect(content().contentType("image/webp"))
                    .andExpect(header().string("ETag", containsString("-w640")));
            // a width that was not made is not served
            mvc.perform(get(url.replace(".webp", "-w800.webp"))).andExpect(status().isNotFound());
        }

        mvc.perform(put("/api/admin/media/" + id + "/focal").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"x\": 0.25, \"y\": 0.8}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.focalX").value(0.25))
                .andExpect(jsonPath("$.focalY").value(0.8));
        mvc.perform(put("/api/admin/media/" + id + "/focal").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"x\": 2, \"y\": 0}"))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/admin/media/unused")).andExpect(jsonPath("$.ids", hasItem(id)));
        mvc.perform(delete("/api/admin/media/unused").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(greaterThanOrEqualTo(1)));
        mvc.perform(get(url)).andExpect(status().isNotFound());
        if (webp.available()) {
            mvc.perform(get(url.replace(".webp", "-w640.webp"))).andExpect(status().isNotFound());
        }
    }

    @Test
    void savingAProjectAgainKeepsItsImages() throws Exception {
        String a = JsonPath.read(mvc.perform(multipart("/api/admin/media")
                        .file(new MockMultipartFile("file", "a.png", "image/png", png(320, 200))).with(csrf()))
                .andReturn().getResponse().getContentAsString(), "$.id");
        String b = JsonPath.read(mvc.perform(multipart("/api/admin/media")
                        .file(new MockMultipartFile("file", "b.png", "image/png", png(200, 400))).with(csrf()))
                .andReturn().getResponse().getContentAsString(), "$.id");
        String body = """
                {"title": {"fr": "Galerie", "en": "Gallery"}, "status": "DRAFT", "category": "WEB",
                 "media": [{"mediaId": "%s", "kind": "GALLERY", "sortOrder": 0}, {"mediaId": "%s", "kind": "MOBILE", "sortOrder": 1}]}
                """;
        String id = JsonPath.read(mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body.formatted(a, b)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
        // the same images again, swapped and with other roles: used to fail on the unique key
        mvc.perform(put("/api/admin/projects/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body.formatted(b, a).replace("\"MOBILE\"", "\"X\"").replace("\"GALLERY\"", "\"MOBILE\"").replace("\"X\"", "\"GALLERY\"")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.media[0].media.id").value(b))
                .andExpect(jsonPath("$.media[0].kind").value("MOBILE"))
                .andExpect(jsonPath("$.media[1].media.id").value(a))
                .andExpect(jsonPath("$.media.length()").value(2));
        // and once more with one image removed
        mvc.perform(put("/api/admin/projects/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"title": {"fr": "Galerie", "en": "Gallery"}, "status": "DRAFT", "category": "WEB",
                         "media": [{"mediaId": "%s", "kind": "GALLERY", "sortOrder": 0}]}
                        """.formatted(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.media.length()").value(1));
        mvc.perform(delete("/api/admin/projects/" + id).with(csrf())).andExpect(status().isNoContent());
    }

    @Test
    void backOfficeSeesTextsAsStored() throws Exception {
        String created = mvc.perform(post("/api/admin/profile/education").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"school": "École", "degree": {"fr": "Diplôme", "en": ""}, "startDate": "2020-09-01", "sortOrder": 50}
                        """))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");
        // public: the French text stands in; back office: the English one is still empty (to translate)
        mvc.perform(get("/api/profile")).andExpect(jsonPath("$.education[?(@.id == '" + id + "')].degree.en").value(hasItem("Diplôme")));
        mvc.perform(get("/api/admin/profile")).andExpect(jsonPath("$.education[?(@.id == '" + id + "')].degree.en").value(hasItem("")));
        mvc.perform(delete("/api/admin/profile/education/" + id).with(csrf())).andExpect(status().is2xxSuccessful());
    }

    @Test
    void insightsAnswerEvenWhenDisabled() throws Exception {
        mvc.perform(get("/api/insights")).andExpect(status().isOk()).andExpect(jsonPath("$").isMap());
    }

    private static byte[] png(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(40, 60, 230));
        g.fillRect(0, 0, w, h);
        g.setColor(Color.WHITE);
        g.fillOval(w / 4, h / 4, w / 2, h / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }
}
