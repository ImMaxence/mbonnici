package fr.mbonnici.portfolio.backup;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BackupSettingsRepository extends JpaRepository<BackupSettings, Short> {

    default BackupSettings get() {
        return findById((short) 1).orElseThrow(() -> new IllegalStateException("backup_settings row missing"));
    }
}
