package fr.mbonnici.portfolio;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

class MediaTest extends AbstractIntegrationTest {

    private static byte[] png(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        var g = img.createGraphics();
        g.setColor(new Color(240, 88, 43));
        g.fillRect(0, 0, w, h);
        g.setColor(Color.WHITE);
        g.fillOval(4, 4, w / 2, h / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void uploadServeAndDelete() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "shot.png", "image/png", png(64, 40));
        String created = mvc.perform(multipart("/api/admin/media").file(file).param("altFr", "Capture").param("altEn", "Shot")
                        .with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(64))
                .andExpect(jsonPath("$.height").value(40))
                .andExpect(jsonPath("$.contentType").value("image/png"))
                .andExpect(jsonPath("$.blurDataUrl", startsWith("data:image/png;base64,")))
                .andExpect(jsonPath("$.url", startsWith("/api/media/")))
                .andExpect(jsonPath("$.alt.en").value("Shot"))
                .andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(created, "$.url");
        String id = JsonPath.read(created, "$.id");

        // public, cacheable, sandboxed
        String etag = mvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string("Cache-Control", containsString("immutable")))
                .andExpect(header().string("Content-Security-Policy", containsString("sandbox")))
                .andExpect(header().exists("ETag"))
                .andReturn().getResponse().getHeader("ETag");
        mvc.perform(get(url).header("If-None-Match", etag)).andExpect(status().isNotModified());

        mvc.perform(get("/api/admin/media")).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.items[*].id", org.hamcrest.Matchers.hasItem(id)));

        mvc.perform(delete("/api/admin/media/" + id).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get(url)).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsNonImagesAndScriptedSvg() throws Exception {
        MockMultipartFile fake = new MockMultipartFile("file", "evil.png", "image/png",
                "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/admin/media").file(fake).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("unsupported")));

        MockMultipartFile badSvg = new MockMultipartFile("file", "x.svg", "image/svg+xml",
                "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/admin/media").file(badSvg).with(csrf()))
                .andExpect(status().isBadRequest());

        MockMultipartFile okSvg = new MockMultipartFile("file", "ok.svg", "image/svg+xml",
                "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='4'/></svg>"
                        .getBytes(StandardCharsets.UTF_8));
        String created = mvc.perform(multipart("/api/admin/media").file(okSvg).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contentType").value("image/svg+xml"))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(delete("/api/admin/media/" + JsonPath.read(created, "$.id")).with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void anonymousCannotUpload() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "shot.png", "image/png", png(8, 8));
        mvc.perform(multipart("/api/admin/media").file(file).with(csrf())).andExpect(status().isUnauthorized());
    }

    @Test
    void unknownOrMalformedKeysAre404() throws Exception {
        mvc.perform(get("/api/media/2026/11/00000000-0000-0000-0000-000000000000.png")).andExpect(status().isNotFound());
        mvc.perform(get("/api/media/../../etc/passwd")).andExpect(status().is4xxClientError());
    }
}
