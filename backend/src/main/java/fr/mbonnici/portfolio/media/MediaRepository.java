package fr.mbonnici.portfolio.media;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<Media, UUID> {
    Optional<Media> findByObjectKey(String objectKey);

    Page<Media> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
