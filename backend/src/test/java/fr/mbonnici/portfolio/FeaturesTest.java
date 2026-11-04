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

/** Case studies and previews, the resume, web vitals, archived messages, responsive images, share pictures, errors. */
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
    void theUploadedResumeIsServedInTheOtherLanguageWhenNeeded() throws Exception {
        // nothing uploaded: no file, no button
        mvc.perform(get("/api/cv").param("lang", "fr")).andExpect(status().isNotFound());
        mvc.perform(get("/api/settings")).andExpect(jsonPath("$.cv.fr").doesNotExist());
        // PDF only
        mvc.perform(multipart("/api/admin/cv/fr").file(new MockMultipartFile("file", "cv.png", "image/png", png(10, 10))).with(csrf()))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/admin/cv/de").file(new MockMultipartFile("file", "cv.pdf", "application/pdf", pdf("x"))).with(csrf()))
                .andExpect(status().isBadRequest());

        byte[] fr = pdf("français");
        mvc.perform(multipart("/api/admin/cv/fr").file(new MockMultipartFile("file", "Mon CV.pdf", "application/pdf", fr)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fr.size").value(fr.length))
                .andExpect(jsonPath("$.en").doesNotExist());
        mvc.perform(get("/api/settings")).andExpect(jsonPath("$.cv.fr.size").value(fr.length));
        // an English visitor gets the French file while there is no English one
        var res = mvc.perform(get("/api/cv").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString("CV-Maxence-Bonnici.pdf")))
                .andExpect(header().string("X-Robots-Tag", containsString("noindex")))
                .andReturn().getResponse();
        org.junit.jupiter.api.Assertions.assertArrayEquals(fr, res.getContentAsByteArray());
        mvc.perform(get("/api/cv").param("lang", "en").header("If-None-Match", res.getHeader("ETag")))
                .andExpect(status().isNotModified());

        byte[] en = pdf("english");
        mvc.perform(multipart("/api/admin/cv/en").file(new MockMultipartFile("file", "resume.pdf", "application/pdf", en)).with(csrf()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/cv").param("lang", "en").param("download", "true"))
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("Content-Disposition", containsString("Resume-Maxence-Bonnici.pdf")))
                .andExpect(content().bytes(en));
        mvc.perform(get("/api/cv").param("lang", "fr")).andExpect(content().bytes(fr));

        // removed: the other language stands in, then nothing
        mvc.perform(delete("/api/admin/cv/fr").with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.fr").doesNotExist());
        mvc.perform(get("/api/cv").param("lang", "fr")).andExpect(content().bytes(en));
        mvc.perform(delete("/api/admin/cv/en").with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/cv").param("lang", "fr")).andExpect(status().isNotFound());
        // personal: kept out of search engines
        mvc.perform(get("/robots.txt")).andExpect(content().string(not(containsString("/api/cv"))));
    }

    private static byte[] pdf(String text) {
        return ("%PDF-1.7\n% " + text + "\n%%EOF\n").getBytes(java.nio.charset.StandardCharsets.UTF_8);
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
    void sharePicturesAreJpegForPublishedPagesOnly() throws Exception {
        var res = mvc.perform(get("/api/og/projects/localatscv.jpg").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andReturn().getResponse();
        byte[] jpeg = res.getContentAsByteArray();
        assertTrue(jpeg.length > 5_000, "a real picture");
        assertEquals((byte) 0xFF, jpeg[0]);
        assertEquals((byte) 0xD8, jpeg[1]);
        var img = ImageIO.read(new java.io.ByteArrayInputStream(jpeg));
        assertEquals(1200, img.getWidth());
        assertEquals(630, img.getHeight());
        mvc.perform(get("/api/og/projects/localatscv.jpg").param("lang", "en").header("If-None-Match", res.getHeader("ETag")))
                .andExpect(status().isNotModified());
        // drafts and unknown slugs have none
        mvc.perform(get("/api/og/projects/nailsbyanastasie.jpg")).andExpect(status().isNotFound());
        mvc.perform(get("/robots.txt")).andExpect(content().string(containsString("Allow: /api/og/")));
    }

    @Test
    void errorsAreLoggedGroupedAndResolvable() throws Exception {
        String report = """
                {"message": "TypeError: x is undefined", "stack": "TypeError: x is undefined\\n    at main.js:1:2042", "path": "/fr/projets"}
                """;
        mvc.perform(post("/api/analytics/errors").contentType(MediaType.APPLICATION_JSON).content(report)).andExpect(status().isAccepted());
        mvc.perform(post("/api/analytics/errors").contentType(MediaType.APPLICATION_JSON)
                        .content(report.replace("1:2042", "1:2077"))).andExpect(status().isAccepted());
        // opted out, or an extension's error: not logged
        mvc.perform(post("/api/analytics/errors").header("DNT", "1").contentType(MediaType.APPLICATION_JSON)
                        .content(report.replace("x is", "y is"))).andExpect(status().isAccepted());
        mvc.perform(post("/api/analytics/errors").contentType(MediaType.APPLICATION_JSON).content("""
                        {"message": "boom", "stack": "at chrome-extension://abc/content.js:1:1", "path": "/fr"}
                        """)).andExpect(status().isAccepted());

        String open = mvc.perform(get("/api/admin/errors"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Integer> counts = JsonPath.read(open, "$[?(@.message == 'TypeError: x is undefined')].occurrences");
        assertEquals(List.of(2), counts, "same error, other column: one entry");
        assertEquals(List.of(), JsonPath.read(open, "$[?(@.message == 'TypeError: y is undefined')]"));
        assertEquals(List.of(), JsonPath.read(open, "$[?(@.message == 'boom')]"));
        Integer id = JsonPath.<List<Integer>>read(open, "$[?(@.message == 'TypeError: x is undefined')].id").getFirst();

        mvc.perform(get("/api/admin/errors/summary")).andExpect(jsonPath("$.open").value(greaterThanOrEqualTo(1)));
        mvc.perform(put("/api/admin/errors/" + id + "/resolved").with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/admin/errors").param("resolved", "true")).andExpect(jsonPath("$[*].id", hasItem(id)));
        mvc.perform(delete("/api/admin/errors/resolved").with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/admin/errors").param("resolved", "true")).andExpect(jsonPath("$[*].id", not(hasItem(id))));
    }

    @Test
    void cspViolationsReachTheJournalInBothFormats() throws Exception {
        // Reporting API (current browsers)
        mvc.perform(post("/api/analytics/csp").contentType("application/reports+json").content("""
                        [{"type": "csp-violation", "age": 10, "url": "https://mbonnici.fr/fr/contact",
                          "body": {"documentURL": "https://mbonnici.fr/fr/contact?x=1", "blockedURL": "https://cdn.example.com/lib.js?v=3",
                                   "effectiveDirective": "script-src-elem", "disposition": "enforce",
                                   "sourceFile": "https://mbonnici.fr/main-ABC.js", "lineNumber": 1, "columnNumber": 812}},
                         {"type": "deprecation", "body": {"message": "ignored"}}]
                        """))
                .andExpect(status().isNoContent());
        // report-uri (older browsers): the same violation elsewhere in the bundle → the same entry
        mvc.perform(post("/api/analytics/csp").contentType("application/csp-report").content("""
                        {"csp-report": {"document-uri": "https://mbonnici.fr/fr/projets", "blocked-uri": "https://cdn.example.com/lib.js",
                                        "violated-directive": "script-src-elem", "effective-directive": "script-src-elem",
                                        "source-file": "https://mbonnici.fr/main-ABC.js", "line-number": 1, "column-number": 990}}
                        """))
                .andExpect(status().isNoContent());
        // inline code, an extension's resource, garbage
        mvc.perform(post("/api/analytics/csp").contentType("application/csp-report").content("""
                        {"csp-report": {"document-uri": "https://mbonnici.fr/admin/projects", "blocked-uri": "inline",
                                        "violated-directive": "style-src-elem", "script-sample": ".x{color:red}"}}
                        """))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/analytics/csp").contentType("application/csp-report").content("""
                        {"csp-report": {"document-uri": "https://mbonnici.fr/fr", "blocked-uri": "chrome-extension://abc/inject.js",
                                        "violated-directive": "script-src-elem"}}
                        """))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/analytics/csp").contentType("application/csp-report").content("not json"))
                .andExpect(status().isNoContent());

        String open = mvc.perform(get("/api/admin/errors")).andReturn().getResponse().getContentAsString();
        String lib = "Blocked by the CSP (script-src-elem): https://cdn.example.com/lib.js";
        assertEquals(List.of(2), JsonPath.read(open, "$[?(@.message == '" + lib + "')].occurrences"));
        assertEquals(List.of("CSP"), JsonPath.read(open, "$[?(@.message == '" + lib + "')].source"));
        assertEquals(List.of("/admin…"), JsonPath.read(open, "$[?(@.message == 'Blocked by the CSP (style-src-elem): inline')].path"));
        assertEquals(List.of(), JsonPath.read(open, "$[?(@.message =~ /.*extension.*/)]"));
    }

    @Test
    void cvDownloadsAndSiteHistoryShowOnTheDashboard() throws Exception {
        mvc.perform(post("/api/analytics/events").contentType(MediaType.APPLICATION_JSON).content("""
                        {"events": [{"type": "CV_DOWNLOAD", "path": "/fr/a-propos", "locale": "fr"}]}
                        """))
                .andExpect(status().isAccepted());
        mvc.perform(get("/api/admin/analytics/overview").param("days", "7"))
                .andExpect(jsonPath("$.cvDownloads").value(greaterThanOrEqualTo(1)));
        // the checks are off in tests: every live site is listed, without history yet
        mvc.perform(get("/api/admin/insights/sites"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].slug", hasItem("localatscv")))
                .andExpect(jsonPath("$[0].hours").isArray());
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
