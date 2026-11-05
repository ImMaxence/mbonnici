package fr.mbonnici.portfolio.media;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MediaRepository extends JpaRepository<Media, UUID> {
    Optional<Media> findByObjectKey(String objectKey);

    Page<Media> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** media referenced by nothing: no project (cover, video, gallery) or header picture */
    @Query(value = """
            select m.id from media m
            where not exists (select 1 from project p where p.cover_media_id = m.id or p.cover_video_media_id = m.id)
              and not exists (select 1 from project_media pm where pm.media_id = m.id)
              and not exists (select 1 from site_settings s where s.avatar_media_id = m.id)
            order by m.created_at desc
            """, nativeQuery = true)
    List<UUID> findUnusedIds();
}
