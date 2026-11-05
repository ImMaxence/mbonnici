package fr.mbonnici.portfolio.profile;

import fr.mbonnici.portfolio.profile.ProfileDtos.EducationDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.EducationInput;
import fr.mbonnici.portfolio.profile.ProfileDtos.ExperienceDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.ExperienceInput;
import fr.mbonnici.portfolio.profile.ProfileDtos.Profile;
import fr.mbonnici.portfolio.profile.ProfileDtos.ReorderInput;
import fr.mbonnici.portfolio.profile.ProfileDtos.SkillDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.SkillInput;
import fr.mbonnici.portfolio.profile.ProfileDtos.TestimonialDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.TestimonialInput;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/profile")
public class AdminProfileController {

    private final ProfileService service;

    public AdminProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    public Profile get() {
        return service.getRaw();
    }

    @PostMapping("/experiences")
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienceDto createExperience(@Valid @RequestBody ExperienceInput in) {
        return service.createExperience(in);
    }

    @PutMapping("/experiences/{id}")
    public ExperienceDto updateExperience(@PathVariable UUID id, @Valid @RequestBody ExperienceInput in) {
        return service.updateExperience(id, in);
    }

    @DeleteMapping("/experiences/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExperience(@PathVariable UUID id) {
        service.deleteExperience(id);
    }

    @PostMapping("/education")
    @ResponseStatus(HttpStatus.CREATED)
    public EducationDto createEducation(@Valid @RequestBody EducationInput in) {
        return service.createEducation(in);
    }

    @PutMapping("/education/{id}")
    public EducationDto updateEducation(@PathVariable UUID id, @Valid @RequestBody EducationInput in) {
        return service.updateEducation(id, in);
    }

    @DeleteMapping("/education/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEducation(@PathVariable UUID id) {
        service.deleteEducation(id);
    }

    @PostMapping("/skills")
    @ResponseStatus(HttpStatus.CREATED)
    public SkillDto createSkill(@Valid @RequestBody SkillInput in) {
        return service.createSkill(in);
    }

    @PutMapping("/skills/{id}")
    public SkillDto updateSkill(@PathVariable UUID id, @Valid @RequestBody SkillInput in) {
        return service.updateSkill(id, in);
    }

    @DeleteMapping("/skills/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSkill(@PathVariable UUID id) {
        service.deleteSkill(id);
    }

    @PutMapping("/experiences/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderExperiences(@Valid @RequestBody ReorderInput in) {
        service.reorderExperiences(in.ids());
    }

    @PutMapping("/education/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderEducation(@Valid @RequestBody ReorderInput in) {
        service.reorderEducation(in.ids());
    }

    @PostMapping("/testimonials")
    @ResponseStatus(HttpStatus.CREATED)
    public TestimonialDto createTestimonial(@Valid @RequestBody TestimonialInput in) {
        return service.createTestimonial(in);
    }

    @PutMapping("/testimonials/{id}")
    public TestimonialDto updateTestimonial(@PathVariable UUID id, @Valid @RequestBody TestimonialInput in) {
        return service.updateTestimonial(id, in);
    }

    @DeleteMapping("/testimonials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTestimonial(@PathVariable UUID id) {
        service.deleteTestimonial(id);
    }

    @PutMapping("/testimonials/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderTestimonials(@Valid @RequestBody ReorderInput in) {
        service.reorderTestimonials(in.ids());
    }

    @PutMapping("/skills/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderSkills(@Valid @RequestBody ReorderInput in) {
        service.reorderSkills(in.ids());
    }
}
