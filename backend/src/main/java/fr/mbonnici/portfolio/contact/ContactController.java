package fr.mbonnici.portfolio.contact;

import fr.mbonnici.portfolio.analytics.VisitorHasher;
import fr.mbonnici.portfolio.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ContactController {

    private static final Logger log = LoggerFactory.getLogger(ContactController.class);

    public record ContactInput(
            @NotBlank @Size(min = 2, max = 80) String name,
            @NotBlank @Email @Size(max = 200) String email,
            @NotBlank @Size(min = 10, max = 4000) String message,
            @Size(max = 5) String locale,
            /** Honeypot: humans never see this field, bots fill it. */
            @Size(max = 200) String website,
            /** reCAPTCHA token, required once the site has its keys */
            @Size(max = 6000) String captcha) {}

    private final ContactRepository repository;
    private final VisitorHasher hasher;
    private final CaptchaVerifier captcha;

    public ContactController(ContactRepository repository, VisitorHasher hasher, CaptchaVerifier captcha) {
        this.repository = repository;
        this.hasher = hasher;
        this.captcha = captcha;
    }

    /** Rate limited by {@code RateLimitFilter} (contact policy). */
    @PostMapping("/api/contact")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void submit(@Valid @RequestBody ContactInput in, HttpServletRequest request) {
        if (in.website() != null && !in.website().isBlank()) {
            log.info("Contact honeypot triggered, dropping message");
            return;
        }
        if (!captcha.accepts(in.captcha())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Captcha refused");
        }
        repository.save(ContactMessage.create(in.name().trim(), in.email().trim(), in.message().trim(),
                in.locale() == null ? null : in.locale().toLowerCase(), hasher.hash(request)));
    }
}
