package fr.mbonnici.portfolio.settings;

import fr.mbonnici.portfolio.settings.SettingsDtos.PublicSettings;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SettingsController {

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping("/api/settings")
    public PublicSettings get() {
        return service.get();
    }
}
