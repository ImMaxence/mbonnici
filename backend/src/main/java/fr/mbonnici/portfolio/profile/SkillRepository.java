package fr.mbonnici.portfolio.profile;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillRepository extends JpaRepository<Skill, UUID> {
    List<Skill> findAllByOrderBySortOrderAscNameAsc();
}
