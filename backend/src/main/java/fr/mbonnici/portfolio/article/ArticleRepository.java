package fr.mbonnici.portfolio.article;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArticleRepository extends JpaRepository<Article, UUID> {

    @EntityGraph(attributePaths = "coverMedia")
    List<Article> findAllByStatusOrderByPublishedAtDesc(Article.Status status);

    @EntityGraph(attributePaths = "coverMedia")
    List<Article> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "coverMedia")
    Optional<Article> findBySlugAndStatus(String slug, Article.Status status);

    boolean existsBySlug(String slug);

    boolean existsByStatus(Article.Status status);

    boolean existsBySlugAndIdNot(String slug, UUID id);
}
