package fr.mbonnici.portfolio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

class BackupTest extends AbstractIntegrationTest {

    private static final String NEW_PROJECT = """
            {"title": {"fr": "Projet temporaire", "en": "Temporary project"}, "status": "PUBLISHED",
             "category": "WEB", "sceneType": "ORBIT", "accentColor": "#112233", "stack": [], "tags": [], "media": []}
            """;

    @Test
    void backupEndpointsRequireAdmin() throws Exception {
        mvc.perform(get("/api/admin/backups")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/backups/export")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/system")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/backups/run").with(csrf())).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void overviewAndSettings() throws Exception {
        mvc.perform(get("/api/admin/backups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.drive.connected").value(false))
                .andExpect(jsonPath("$.settings.keepCount").value(14))
                .andExpect(jsonPath("$.schemaVersion").value("7"))
                .andExpect(jsonPath("$.running").value(false));

        mvc.perform(put("/api/admin/backups/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"autoEnabled\":true,\"hourUtc\":4,\"keepCount\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autoEnabled").value(true))
                .andExpect(jsonPath("$.hourUtc").value(4))
                .andExpect(jsonPath("$.keepCount").value(7));

        // Drive is not linked: a cloud backup cannot start
        mvc.perform(post("/api/admin/backups/run").with(csrf())).andExpect(status().isConflict());
        mvc.perform(post("/api/admin/backups/restore/abcdefghijklmnop").with(csrf())).andExpect(status().isConflict());
        mvc.perform(post("/api/admin/backups/restore/bad").with(csrf())).andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void systemInfoReportsResources() throws Exception {
        mvc.perform(get("/api/admin/system"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpu.cores").isNumber())
                .andExpect(jsonPath("$.memory.totalMb").isNumber())
                .andExpect(jsonPath("$.disk.totalMb").isNumber())
                .andExpect(jsonPath("$.data.databaseBytes").isNumber())
                .andExpect(jsonPath("$.data.mediaCount").isNumber());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void exportThenImportRestoresTheExactState() throws Exception {
        // a media object so the archive carries binary content
        BufferedImage img = new BufferedImage(12, 8, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(img, "png", png);
        String media = mvc.perform(multipart("/api/admin/media")
                        .file(new MockMultipartFile("file", "b.png", "image/png", png.toByteArray())).with(csrf()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String mediaUrl = JsonPath.read(media, "$.url");

        // snapshot A
        byte[] archive = mvc.perform(get("/api/admin/backups/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/zip"))
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andReturn().getResponse().getContentAsByteArray();

        Set<String> entries = new HashSet<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archive))) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                entries.add(e.getName());
            }
        }
        assertThat(entries).contains("manifest.json", "media-index.json", "db/project.csv", "db/site_settings.csv",
                "db/analytics_event.csv");
        assertThat(entries.stream().filter(n -> n.startsWith("media/")).count()).isGreaterThanOrEqualTo(1);

        // mutate: a project that exists only after the snapshot
        String created = mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(NEW_PROJECT)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String slug = JsonPath.read(created, "$.slug");
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$[*].slug", hasItem(slug)));

        // restore A: the temporary project is gone, media still served
        mvc.perform(multipart("/api/admin/backups/import")
                        .file(new MockMultipartFile("file", "a.zip", "application/zip", archive)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.kind").value("RESTORE"));
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$[*].slug", not(hasItem(slug))));
        mvc.perform(get("/api/projects/localatscv")).andExpect(status().isOk());
        mvc.perform(get(mediaUrl)).andExpect(status().isOk());
        mvc.perform(get("/api/settings")).andExpect(jsonPath("$.ownerName").value("Maxence Bonnici"));

        // history keeps the run
        mvc.perform(get("/api/admin/backups"))
                .andExpect(jsonPath("$.runs[0].kind").value("RESTORE"))
                .andExpect(jsonPath("$.runs[0].trigger").value("UPLOAD"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void stagedArchiveCanBeComparedThenMergedRowByRow() throws Exception {
        byte[] archive = mvc.perform(get("/api/admin/backups/export")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        // after the snapshot: one project removed, one project added
        String list = mvc.perform(get("/api/admin/projects")).andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(list, "$[?(@.slug == 'meowtrix')].id");
        String meowtrix = ids.getFirst();
        mvc.perform(delete("/api/admin/projects/" + meowtrix).with(csrf())).andExpect(status().isNoContent());
        String created = mvc.perform(post("/api/admin/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(NEW_PROJECT)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String extraSlug = JsonPath.read(created, "$.slug");

        // stage: nothing changes yet, the preview tells what differs
        String preview = mvc.perform(multipart("/api/admin/backups/stage")
                        .file(new MockMultipartFile("file", "a.zip", "application/zip", archive)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schemaMatches").value(true))
                .andReturn().getResponse().getContentAsString();
        String stageId = JsonPath.read(preview, "$.id");
        List<Integer> added = JsonPath.read(preview, "$.tables[?(@.table == 'project')].added");
        List<Integer> currentOnly = JsonPath.read(preview, "$.tables[?(@.table == 'project')].currentOnly");
        assertThat(added).containsExactly(1);
        assertThat(currentOnly).containsExactly(1);
        List<String> statuses = JsonPath.read(preview,
                "$.tables[?(@.table == 'project')].rows[?(@.id == '" + meowtrix + "')].status");
        assertThat(statuses).containsExactly("NEW");
        mvc.perform(get("/api/projects/meowtrix")).andExpect(status().isNotFound());

        // merge only the deleted project back: the project added since then stays
        mvc.perform(post("/api/admin/backups/stage/" + stageId + "/apply").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"MERGE\",\"rows\":{\"project\":[\"" + meowtrix + "\"]},\"analytics\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
        mvc.perform(get("/api/projects/meowtrix")).andExpect(status().isOk());
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$[*].slug", hasItem(extraSlug)));
        // a staged archive is consumed by apply
        mvc.perform(get("/api/admin/backups/stage/" + stageId)).andExpect(status().isNotFound());

        // replace mode: back to the exact snapshot
        String again = mvc.perform(multipart("/api/admin/backups/stage")
                        .file(new MockMultipartFile("file", "a.zip", "application/zip", archive)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String againId = JsonPath.read(again, "$.id");
        mvc.perform(post("/api/admin/backups/stage/" + againId + "/apply").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"REPLACE\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$[*].slug", not(hasItem(extraSlug))));
    }

    @Test
    void pgCsvRoundTripKeepsNullsQuotesAndNewlines() {
        byte[] csv = "id,a,b\n1,,\"\"\n2,\"x,\"\"y\"\"\nz\",plain\n".getBytes();
        var t = fr.mbonnici.portfolio.backup.PgCsv.parse(csv);
        assertThat(t.header()).containsExactly("id", "a", "b");
        assertThat(t.rows().get(0)).containsExactly("1", null, "");
        assertThat(t.rows().get(1)).containsExactly("2", "x,\"y\"\nz", "plain");
        var back = fr.mbonnici.portfolio.backup.PgCsv.parse(
                fr.mbonnici.portfolio.backup.PgCsv.write(t.header(), t.rows()));
        assertThat(back.rows()).isEqualTo(t.rows());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void importRejectsForeignArchives() throws Exception {
        ByteArrayOutputStream bogus = new ByteArrayOutputStream();
        try (var zip = new java.util.zip.ZipOutputStream(bogus)) {
            zip.putNextEntry(new ZipEntry("hello.txt"));
            zip.write("hi".getBytes());
            zip.closeEntry();
        }
        mvc.perform(multipart("/api/admin/backups/import")
                        .file(new MockMultipartFile("file", "x.zip", "application/zip", bogus.toByteArray())).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("manifest")));
    }
}
