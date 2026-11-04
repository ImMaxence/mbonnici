package fr.mbonnici.portfolio.backup;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BackupRunRepository extends JpaRepository<BackupRun, UUID> {

    List<BackupRun> findTop30ByOrderByStartedAtDesc();

    Optional<BackupRun> findFirstByKindAndStatusAndTriggerOrderByStartedAtDesc(BackupRun.Kind kind, BackupRun.Status status,
            BackupRun.Trigger trigger);

    long countByStatusAndStartedAtAfter(BackupRun.Status status, Instant after);
}
