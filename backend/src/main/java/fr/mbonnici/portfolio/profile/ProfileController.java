package fr.mbonnici.portfolio.profile;

import fr.mbonnici.portfolio.profile.ProfileDtos.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping("/api/profile")
    public Profile get() {
        return service.get();
    }
}
