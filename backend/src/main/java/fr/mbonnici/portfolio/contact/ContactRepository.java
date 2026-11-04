package fr.mbonnici.portfolio.contact;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContactRepository extends JpaRepository<ContactMessage, UUID> {
    Page<ContactMessage> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Inbox or archive, optionally unread only, optionally matching a text in the name, e-mail or
     * message ({@code pattern} is "%text%" in lower case, or "%" for everything).
     */
    @Query("""
            select m from ContactMessage m
            where m.archived = :archived
              and (:unread = false or m.read = false)
              and (lower(m.name) like :pattern or lower(m.email) like :pattern or lower(m.message) like :pattern)
            order by m.createdAt desc
            """)
    Page<ContactMessage> search(@Param("archived") boolean archived, @Param("unread") boolean unread,
            @Param("pattern") String pattern, Pageable pageable);

    long countByReadFalseAndArchivedFalse();

    long countByArchivedTrue();
}
