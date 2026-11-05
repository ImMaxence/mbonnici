package fr.mbonnici.portfolio;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

class PublicApiTest extends AbstractIntegrationTest {

    @Test
    void settingsAreSeeded() throws Exception {
        mvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerName").value("Maxence Bonnici"))
                .andExpect(jsonPath("$.headline.fr").value(containsString("Full Stack")))
                .andExpect(jsonPath("$.headline.en").value(containsString("Full Stack")))
                .andExpect(jsonPath("$.legal.name").value("Maxence Bonnici"));
    }

    @Test
    void publishedProjectsOnly() throws Exception {
        mvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(11))))
                .andExpect(jsonPath("$[0].slug").value("localatscv"))
                .andExpect(jsonPath("$[*].slug", not(hasItem("nailsbyanastasie"))))
                .andExpect(jsonPath("$[0].title.fr").value("LocalATSCV"))
                .andExpect(jsonPath("$[0].stack", hasItem("TypeScript")));

        mvc.perform(get("/api/projects").param("featured", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].featured", everyItem(is(true))));
    }

    @Test
    void projectDetailWithNeighbours() throws Exception {
        mvc.perform(get("/api/projects/localatscv"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description.en").value(containsString("ATS")))
                // the live site forbids framing (frame-ancestors), so the live preview is off (migration V4)
                .andExpect(jsonPath("$.allowIframe").value(false))
                .andExpect(jsonPath("$.displayMode").value("BOTH"))
                .andExpect(jsonPath("$.tagline.fr").value(not(endsWith("."))))
                .andExpect(jsonPath("$.previous").doesNotExist())
                .andExpect(jsonPath("$.next.slug").value("localcutvideo"))
                .andExpect(jsonPath("$.gallery").isArray());

        mvc.perform(get("/api/projects/mern-irc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previous.slug").value("redditech"))
                .andExpect(jsonPath("$.next.slug").value("localatscv"));
    }

    @Test
    void draftOrUnknownProjectIs404Json() throws Exception {
        mvc.perform(get("/api/projects/nailsbyanastasie"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Project not found"));
        mvc.perform(get("/api/projects/does-not-exist")).andExpect(status().isNotFound());
    }

    @Test
    void profileIsSeeded() throws Exception {
        mvc.perform(get("/api/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.experiences[0].company").value("Sopra Steria"))
                .andExpect(jsonPath("$.experiences[0].endDate").doesNotExist())
                .andExpect(jsonPath("$.education[0].school").value(containsString("EPITECH")))
                .andExpect(jsonPath("$.skills", hasSize(greaterThanOrEqualTo(20))));
    }

    @Test
    void seoFeeds() throws Exception {
        mvc.perform(get("/sitemap.xml"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/xml"))
                .andExpect(content().string(containsString("hreflang=\"fr\"")))
                .andExpect(content().string(containsString("http://localhost:4200/en/projects/localatscv")))
                .andExpect(content().string(containsString("http://localhost:4200/fr/projets/localatscv")))
                .andExpect(content().string(not(containsString("nailsbyanastasie"))));

        mvc.perform(get("/robots.txt"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("GPTBot")))
                .andExpect(content().string(containsString("Disallow: /admin")))
                .andExpect(content().string(containsString("Sitemap: http://localhost:4200/sitemap.xml")));

        mvc.perform(get("/llms.txt"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("text/markdown")))
                .andExpect(content().string(containsString("# Maxence Bonnici")))
                .andExpect(content().string(containsString("LocalATSCV")))
                .andExpect(content().string(containsString("Sopra Steria")));

        mvc.perform(get("/llms-full.txt"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Most companies run every application")));
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/api/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
