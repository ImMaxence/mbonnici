package fr.mbonnici.portfolio.profile;

import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.common.NotFoundException;
import fr.mbonnici.portfolio.profile.ProfileDtos.EducationDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.EducationInput;
import fr.mbonnici.portfolio.profile.ProfileDtos.ExperienceDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.ExperienceInput;
import fr.mbonnici.portfolio.profile.ProfileDtos.Profile;
import fr.mbonnici.portfolio.profile.ProfileDtos.SkillDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.SkillInput;
import java.util.List;
import java.util.UUID;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    public static final String CACHE = "profile";

    private final ExperienceRepository experiences;
    private final EducationRepository education;
    private final SkillRepository skills;

    public ProfileService(ExperienceRepository experiences, EducationRepository education, SkillRepository skills) {
        this.experiences = experiences;
        this.education = education;
        this.skills = skills;
    }

    @Cacheable(CACHE)
    @Transactional(readOnly = true)
    public Profile get() {
        return new Profile(
                experiences.findAllByOrderBySortOrderAscStartDateDesc().stream().map(ExperienceDto::from).toList(),
                education.findAllByOrderBySortOrderAscStartDateDesc().stream().map(EducationDto::from).toList(),
                skills.findAllByOrderBySortOrderAscNameAsc().stream().map(SkillDto::from).toList());
    }

    // ── experiences ──────────────────────────────────────────────────────────

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public ExperienceDto createExperience(ExperienceInput in) {
        return ExperienceDto.from(experiences.save(applyExperience(Experience.create(), in)));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public ExperienceDto updateExperience(UUID id, ExperienceInput in) {
        Experience e = experiences.findById(id).orElseThrow(() -> new NotFoundException("Experience"));
        return ExperienceDto.from(experiences.save(applyExperience(e, in)));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public void deleteExperience(UUID id) {
        if (!experiences.existsById(id)) {
            throw new NotFoundException("Experience");
        }
        experiences.deleteById(id);
    }

    private static Experience applyExperience(Experience e, ExperienceInput in) {
        if (in.role().isBlank()) {
            throw ApiException.badRequest("role is required");
        }
        if (in.endDate() != null && in.endDate().isBefore(in.startDate())) {
            throw ApiException.badRequest("endDate must be after startDate");
        }
        e.setCompany(in.company().trim());
        e.setCompanyUrl(blankToNull(in.companyUrl()));
        e.setRole(in.role().filled());
        e.setDescription(in.description() == null ? Localized.EMPTY : in.description().filled());
        e.setLocation(blankToNull(in.location()));
        e.setContractType(in.contractType());
        e.setStartDate(in.startDate());
        e.setEndDate(in.endDate());
        e.setSkills(in.skills() == null ? List.of() : in.skills().stream().map(String::trim).filter(s -> !s.isEmpty()).toList());
        e.setSortOrder(in.sortOrder());
        return e;
    }

    // ── education ────────────────────────────────────────────────────────────

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public EducationDto createEducation(EducationInput in) {
        return EducationDto.from(education.save(applyEducation(Education.create(), in)));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public EducationDto updateEducation(UUID id, EducationInput in) {
        Education e = education.findById(id).orElseThrow(() -> new NotFoundException("Education"));
        return EducationDto.from(education.save(applyEducation(e, in)));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public void deleteEducation(UUID id) {
        if (!education.existsById(id)) {
            throw new NotFoundException("Education");
        }
        education.deleteById(id);
    }

    private static Education applyEducation(Education e, EducationInput in) {
        if (in.degree().isBlank()) {
            throw ApiException.badRequest("degree is required");
        }
        e.setSchool(in.school().trim());
        e.setSchoolUrl(blankToNull(in.schoolUrl()));
        e.setDegree(in.degree().filled());
        e.setLocation(blankToNull(in.location()));
        e.setStartDate(in.startDate());
        e.setEndDate(in.endDate());
        e.setSortOrder(in.sortOrder());
        return e;
    }

    // ── skills ───────────────────────────────────────────────────────────────

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public SkillDto createSkill(SkillInput in) {
        return SkillDto.from(skills.save(applySkill(Skill.create(), in)));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public SkillDto updateSkill(UUID id, SkillInput in) {
        Skill s = skills.findById(id).orElseThrow(() -> new NotFoundException("Skill"));
        return SkillDto.from(skills.save(applySkill(s, in)));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public void deleteSkill(UUID id) {
        if (!skills.existsById(id)) {
            throw new NotFoundException("Skill");
        }
        skills.deleteById(id);
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public void reorderSkills(List<UUID> ids) {
        int i = 0;
        for (UUID id : ids) {
            Skill s = skills.findById(id).orElseThrow(() -> new NotFoundException("Skill"));
            s.setSortOrder(i++);
        }
    }

    private static Skill applySkill(Skill s, SkillInput in) {
        s.setName(in.name().trim());
        s.setCategory(in.category());
        s.setLevel((short) in.level());
        s.setSortOrder(in.sortOrder());
        return s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
