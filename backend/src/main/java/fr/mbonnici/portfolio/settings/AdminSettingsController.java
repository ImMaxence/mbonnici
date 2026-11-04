package fr.mbonnici.portfolio.settings;

import fr.mbonnici.portfolio.settings.SettingsDtos.PublicSettings;
import fr.mbonnici.portfolio.settings.SettingsDtos.UpdateSettings;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/settings")
public class AdminSettingsController {

    private final SettingsService service;

    public AdminSettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping
    public PublicSettings get() {
        return service.getRaw();
    }

    @PutMapping
    public PublicSettings update(@Valid @RequestBody UpdateSettings body) {
        return service.update(body);
    }
}
