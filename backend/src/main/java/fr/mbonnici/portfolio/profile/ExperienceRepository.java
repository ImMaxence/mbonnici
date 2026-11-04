package fr.mbonnici.portfolio.profile;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExperienceRepository extends JpaRepository<Experience, UUID> {
    List<Experience> findAllByOrderBySortOrderAscStartDateDesc();
}
