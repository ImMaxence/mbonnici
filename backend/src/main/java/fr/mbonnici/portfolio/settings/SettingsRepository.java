package fr.mbonnici.portfolio.settings;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SettingsRepository extends JpaRepository<SiteSettings, Short> {
}
