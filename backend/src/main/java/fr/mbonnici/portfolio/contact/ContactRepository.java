package fr.mbonnici.portfolio.contact;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContactRepository extends JpaRepository<ContactMessage, UUID> {
    Page<ContactMessage> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ContactMessage> findAllByReadFalseOrderByCreatedAtDesc(Pageable pageable);

    long countByReadFalse();
}
