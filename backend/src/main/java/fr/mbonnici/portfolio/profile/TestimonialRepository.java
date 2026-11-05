package fr.mbonnici.portfolio.profile;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestimonialRepository extends JpaRepository<Testimonial, UUID> {
    List<Testimonial> findAllByOrderBySortOrderAscAuthorAsc();
}
