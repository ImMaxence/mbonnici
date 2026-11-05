package fr.mbonnici.portfolio.profile;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ProfileDtos {

    private ProfileDtos() {}

    public record ExperienceDto(UUID id, String company, String companyUrl, Localized role, Localized description,
            String location, Experience.ContractType contractType, LocalDate startDate, LocalDate endDate,
            List<String> skills, int sortOrder) {
        static ExperienceDto from(Experience e) {
            return new ExperienceDto(e.getId(), e.getCompany(), e.getCompanyUrl(), e.getRole().filled(),
                    e.getDescription().filled(), e.getLocation(), e.getContractType(), e.getStartDate(), e.getEndDate(),
                    List.copyOf(e.getSkills()), e.getSortOrder());
        }

        /** as stored (back office): an empty language stays empty, so it can be spotted and translated */
        static ExperienceDto raw(Experience e) {
            return new ExperienceDto(e.getId(), e.getCompany(), e.getCompanyUrl(), e.getRole(), e.getDescription(),
                    e.getLocation(), e.getContractType(), e.getStartDate(), e.getEndDate(), List.copyOf(e.getSkills()),
                    e.getSortOrder());
        }
    }

    public record EducationDto(UUID id, String school, String schoolUrl, Localized degree, String location,
            LocalDate startDate, LocalDate endDate, int sortOrder) {
        static EducationDto from(Education e) {
            return new EducationDto(e.getId(), e.getSchool(), e.getSchoolUrl(), e.getDegree().filled(), e.getLocation(),
                    e.getStartDate(), e.getEndDate(), e.getSortOrder());
        }

        static EducationDto raw(Education e) {
            return new EducationDto(e.getId(), e.getSchool(), e.getSchoolUrl(), e.getDegree(), e.getLocation(),
                    e.getStartDate(), e.getEndDate(), e.getSortOrder());
        }
    }

    public record SkillDto(UUID id, String name, Skill.Category category, int level, int sortOrder) {
        static SkillDto from(Skill s) {
            return new SkillDto(s.getId(), s.getName(), s.getCategory(), s.getLevel(), s.getSortOrder());
        }
    }

    public record TestimonialDto(UUID id, String author, String url, Localized role, Localized quote, int sortOrder) {
        static TestimonialDto from(Testimonial t) {
            return new TestimonialDto(t.getId(), t.getAuthor(), t.getUrl(), t.getRole().filled(), t.getQuote().filled(),
                    t.getSortOrder());
        }

        static TestimonialDto raw(Testimonial t) {
            return new TestimonialDto(t.getId(), t.getAuthor(), t.getUrl(), t.getRole(), t.getQuote(), t.getSortOrder());
        }
    }

    public record Profile(List<ExperienceDto> experiences, List<EducationDto> education, List<SkillDto> skills,
            List<TestimonialDto> testimonials) {}

    public record ExperienceInput(
            @NotBlank @Size(max = 120) String company,
            @Size(max = 300) String companyUrl,
            @NotNull Localized role,
            Localized description,
            @Size(max = 120) String location,
            @NotNull Experience.ContractType contractType,
            @NotNull LocalDate startDate,
            LocalDate endDate,
            @Size(max = 30) List<@Size(max = 60) String> skills,
            int sortOrder) {}

    public record EducationInput(
            @NotBlank @Size(max = 160) String school,
            @Size(max = 300) String schoolUrl,
            @NotNull Localized degree,
            @Size(max = 120) String location,
            @NotNull LocalDate startDate,
            LocalDate endDate,
            int sortOrder) {}

    public record TestimonialInput(
            @NotBlank @Size(max = 120) String author,
            @Size(max = 300) String url,
            Localized role,
            @NotNull Localized quote,
            int sortOrder) {}

    public record SkillInput(
            @NotBlank @Size(max = 60) String name,
            @NotNull Skill.Category category,
            @Min(1) @Max(5) int level,
            int sortOrder) {}

    public record ReorderInput(@NotNull List<UUID> ids) {}
}
