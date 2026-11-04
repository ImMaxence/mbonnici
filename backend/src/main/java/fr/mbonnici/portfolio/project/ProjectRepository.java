package fr.mbonnici.portfolio.project;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    @EntityGraph(attributePaths = "coverMedia")
    List<Project> findAllByStatusOrderBySortOrderAscCreatedAtDesc(Project.Status status);

    @EntityGraph(attributePaths = "coverMedia")
    List<Project> findAllByOrderBySortOrderAscCreatedAtDesc();

    Optional<Project> findBySlugAndStatus(String slug, Project.Status status);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    @Query("select p.id from Project p where p.slug = :slug and p.status = :status")
    Optional<UUID> findIdBySlugAndStatus(@Param("slug") String slug, @Param("status") Project.Status status);
}
