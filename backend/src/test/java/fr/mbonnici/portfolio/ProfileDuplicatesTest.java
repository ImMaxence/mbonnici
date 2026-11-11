package fr.mbonnici.portfolio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

/** The same skill, job or course can't be added twice (the back office warns first; this is the net). */
class ProfileDuplicatesTest extends AbstractIntegrationTest {

    private static String skill(String name) {
        return """
                {"name": "%s", "category": "TOOL", "level": 3, "sortOrder": 0}
                """.formatted(name);
    }

    private static String experience(String company, String start) {
        return """
                {"company": "%s", "role": {"fr": "Développeur", "en": ""}, "description": {"fr": "", "en": ""},
                 "contractType": "CDI", "startDate": "%s", "skills": [], "sortOrder": 0}
                """.formatted(company, start);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void aSkillNameIsUnique() throws Exception {
        // "Java" is in the test content: case, accents and spaces don't make another skill
        mvc.perform(post("/api/admin/profile/skills").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(skill("  jáva ")))
                .andExpect(status().isConflict());

        String created = mvc.perform(post("/api/admin/profile/skills").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(skill("Dup Test++")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");
        try {
            // like "C" and "C++": symbols keep two names apart
            String other = mvc.perform(post("/api/admin/profile/skills").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(skill("Dup Test")))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            mvc.perform(delete("/api/admin/profile/skills/" + JsonPath.read(other, "$.id")).with(csrf())).andExpect(status().isNoContent());
            // saving it unchanged is not a duplicate of itself
            mvc.perform(put("/api/admin/profile/skills/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(skill("Dup Test++")))
                    .andExpect(status().isOk());
            // renaming it to an existing one is
            mvc.perform(put("/api/admin/profile/skills/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(skill("TYPESCRIPT")))
                    .andExpect(status().isConflict());
        } finally {
            mvc.perform(delete("/api/admin/profile/skills/" + id).with(csrf())).andExpect(status().isNoContent());
        }
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void theSameJobStartingTheSameDayIsADuplicate() throws Exception {
        String created = mvc.perform(post("/api/admin/profile/experiences").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(experience("Dup Corp", "2020-01-06")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");
        String laterId = null;
        try {
            mvc.perform(post("/api/admin/profile/experiences").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(experience(" dup  corp ", "2020-01-06")))
                    .andExpect(status().isConflict());
            mvc.perform(put("/api/admin/profile/experiences/" + id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(experience("Dup Corp", "2020-01-06")))
                    .andExpect(status().isOk());
            // back at the same company later on: another experience
            String later = mvc.perform(post("/api/admin/profile/experiences").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(experience("Dup Corp", "2022-09-01")))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            laterId = JsonPath.read(later, "$.id");
        } finally {
            mvc.perform(delete("/api/admin/profile/experiences/" + id).with(csrf())).andExpect(status().isNoContent());
            if (laterId != null) {
                mvc.perform(delete("/api/admin/profile/experiences/" + laterId).with(csrf())).andExpect(status().isNoContent());
            }
        }
    }
}
