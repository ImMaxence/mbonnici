package fr.mbonnici.portfolio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import fr.mbonnici.portfolio.media.VideoEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

/** v1.7.0: testimonials, the booking link, short videos in the library, project.sceneType gone. */
class TestimonialsVideoTest extends AbstractIntegrationTest {

    @Autowired
    VideoEncoder encoder;

    @Test
    @WithMockUser(roles = "ADMIN")
    void testimonialsAreManagedAndPublished() throws Exception {
        String created = mvc.perform(post("/api/admin/profile/testimonials").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"author": "Camille Martin", "url": "https://www.linkedin.com/in/camille",
                                 "role": {"fr": "Tech lead, Agence Démo", "en": ""},
                                 "quote": {"fr": "Rigoureux et rapide", "en": ""}, "sortOrder": 0}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.author").value("Camille Martin"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");

        // public: the empty English falls back to the French
        mvc.perform(get("/api/profile").header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.testimonials[0].quote.en").value("Rigoureux et rapide"));
        // back office: as stored
        mvc.perform(get("/api/admin/profile"))
                .andExpect(jsonPath("$.testimonials[0].quote.en").value(""));

        mvc.perform(put("/api/admin/profile/testimonials/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"author": "Camille Martin", "url": "javascript:alert(1)", "quote": {"fr": "x", "en": ""}, "sortOrder": 0}
                                """))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/profile/testimonials").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"author": "Sans citation", "quote": {"fr": "", "en": ""}, "sortOrder": 0}
                                """))
                .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/admin/profile/testimonials/" + id).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/profile")).andExpect(jsonPath("$.testimonials.length()").value(0));
    }

    @Test
    void testimonialsNeedAnAdmin() throws Exception {
        mvc.perform(post("/api/admin/profile/testimonials").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void theBookingLinkIsAnHttpsUrl() throws Exception {
        String base = """
                {"ownerName":"Maxence Bonnici","headline":{"fr":"Développeur Full Stack Java & Angular","en":"Full Stack Developer, Java & Angular"},
                 "bio":{"fr":"","en":""},"availability":"LISTENING","legalName":"Maxence Bonnici"%s}
                """;
        mvc.perform(put("/api/admin/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(base.formatted(",\"bookingUrl\":\"http://cal.com/x\"")))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/admin/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(base.formatted(",\"bookingUrl\":\"https://cal.com/maxence\"")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/settings")).andExpect(jsonPath("$.bookingUrl").value("https://cal.com/maxence"));
        mvc.perform(put("/api/admin/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(base.formatted("")))
                .andExpect(status().isOk());
    }

    /** the first bytes of an MP4 file: an ftyp box with a video brand */
    private static byte[] mp4() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(new byte[] {0, 0, 0, 0x20});
        out.writeBytes("ftypisom".getBytes(StandardCharsets.US_ASCII));
        out.writeBytes(new byte[] {0, 0, 2, 0});
        out.writeBytes("isomiso2avc1mp41".getBytes(StandardCharsets.US_ASCII));
        out.writeBytes(new byte[2048]);
        return out.toByteArray();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void withoutFfmpegAVideoIsStoredAsSentAndServedInRanges() throws Exception {
        Assumptions.assumeFalse(encoder.available(), "ffmpeg is installed: videos are re-encoded (see the next test)");
        // without its size (read by the back office's browser) it is refused
        mvc.perform(multipart("/api/admin/media").file(new MockMultipartFile("file", "loop.mp4", "video/mp4", mp4())).with(csrf()))
                .andExpect(status().isBadRequest());
        // an extension that does not match
        mvc.perform(multipart("/api/admin/media").file(new MockMultipartFile("file", "loop.webm", "video/webm", mp4()))
                        .param("width", "1206").param("height", "2622").with(csrf()))
                .andExpect(status().isBadRequest());

        String uploaded = mvc.perform(multipart("/api/admin/media")
                        .file(new MockMultipartFile("file", "loop.mp4", "video/mp4", mp4()))
                        .param("width", "1206").param("height", "2622").with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contentType").value("video/mp4"))
                .andExpect(jsonPath("$.width").value(1206))
                .andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(uploaded, "$.url");
        String id = JsonPath.read(uploaded, "$.id");

        mvc.perform(get(url)).andExpect(status().isOk()).andExpect(header().string("Accept-Ranges", "bytes"));
        mvc.perform(get(url).header("Range", "bytes=0-15"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string("Content-Range", "bytes 0-15/" + mp4().length));

        // a cover is the share picture too: a video is refused there
        mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": {"fr": "Avec vidéo", "en": "With video"}, "status": "DRAFT", "category": "WEB",
                                 "accentColor": "#112233", "stack": [], "coverMediaId": "%s", "media": []}
                                """.formatted(id)))
                .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/admin/media/" + id).with(csrf())).andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void withFfmpegAVideoIsReEncodedSmallAndPlaysInTheBrowserFrame() throws Exception {
        Assumptions.assumeTrue(encoder.available(), "ffmpeg is not installed here");
        // a 3-second 1920 × 1080 test pattern with sound, as WebM
        Path dir = Files.createTempDirectory("video-test-");
        Path webm = dir.resolve("pattern.webm");
        Process p = new ProcessBuilder("ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30",
                "-f", "lavfi", "-i", "sine=frequency=440", "-t", "3", "-c:v", "libvpx-vp9", "-b:v", "2M", "-c:a", "libopus",
                webm.toString()).redirectErrorStream(true).start();
        p.getInputStream().readAllBytes();
        org.junit.jupiter.api.Assertions.assertEquals(0, p.waitFor());
        byte[] source = Files.readAllBytes(webm);

        String uploaded = mvc.perform(multipart("/api/admin/media")
                        .file(new MockMultipartFile("file", "pattern.webm", "video/webm", source)).with(csrf()))
                .andExpect(status().isCreated())
                // H.264 MP4, scaled to 1280 wide, with a blurred first frame
                .andExpect(jsonPath("$.contentType").value("video/mp4"))
                .andExpect(jsonPath("$.width").value(1280))
                .andExpect(jsonPath("$.height").value(720))
                .andExpect(jsonPath("$.blurDataUrl").value(org.hamcrest.Matchers.startsWith("data:image/png;base64,")))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(uploaded, "$.id");
        String url = JsonPath.read(uploaded, "$.url");
        byte[] mp4 = mvc.perform(get(url)).andReturn().getResponse().getContentAsByteArray();
        mvc.perform(get(url).header("Range", "bytes=0-15")).andExpect(status().isPartialContent())
                .andExpect(header().string("Accept-Ranges", "bytes"));
        // "faststart": the moov index comes before the media data
        String head = new String(mp4, 0, Math.min(mp4.length, 4096), StandardCharsets.ISO_8859_1);
        org.junit.jupiter.api.Assertions.assertTrue(head.indexOf("moov") >= 0 && head.indexOf("moov") < head.indexOf("mdat") || !head.contains("mdat"));

        // the browser-frame loop of a project; a picture is refused there
        String png = mvc.perform(multipart("/api/admin/media").file(new MockMultipartFile("file", "c.png", "image/png", png())).with(csrf()))
                .andReturn().getResponse().getContentAsString();
        String pngId = JsonPath.read(png, "$.id");
        String project = """
                {"title": {"fr": "Vidéo navigateur", "en": "Browser video"}, "status": "DRAFT", "category": "WEB",
                 "accentColor": "#112233", "stack": [], "coverMediaId": "%s", "coverVideoMediaId": "%s", "media": []}
                """;
        mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(project.formatted(pngId, pngId)))
                .andExpect(status().isBadRequest());
        String created = mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(project.formatted(pngId, id)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coverVideo.contentType").value("video/mp4"))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(delete("/api/admin/projects/" + JsonPath.read(created, "$.id")).with(csrf()));
        mvc.perform(delete("/api/admin/media/" + id).with(csrf()));
        mvc.perform(delete("/api/admin/media/" + pngId).with(csrf()));
    }

    private static byte[] png() throws java.io.IOException {
        var img = new java.awt.image.BufferedImage(32, 20, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void projectsNoLongerCarryASceneType() throws Exception {
        mvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sceneType").doesNotExist());
    }
}
