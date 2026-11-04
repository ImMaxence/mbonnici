package fr.mbonnici.portfolio.contact;

import fr.mbonnici.portfolio.analytics.VisitorHasher;
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
            @Size(max = 200) String website) {}

    private final ContactRepository repository;
    private final VisitorHasher hasher;
    private final ContactNotifier notifier;

    public ContactController(ContactRepository repository, VisitorHasher hasher, ContactNotifier notifier) {
        this.repository = repository;
        this.hasher = hasher;
        this.notifier = notifier;
    }

    /** Rate limited by {@code RateLimitFilter} (contact policy). */
    @PostMapping("/api/contact")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void submit(@Valid @RequestBody ContactInput in, HttpServletRequest request) {
        if (in.website() != null && !in.website().isBlank()) {
            log.info("Contact honeypot triggered, dropping message");
            return;
        }
        ContactMessage saved = repository.save(ContactMessage.create(in.name().trim(), in.email().trim(), in.message().trim(),
                in.locale() == null ? null : in.locale().toLowerCase(), hasher.hash(request)));
        notifier.messageReceived(saved);
    }
}
