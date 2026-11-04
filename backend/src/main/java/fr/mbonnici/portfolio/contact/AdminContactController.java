package fr.mbonnici.portfolio.contact;

import fr.mbonnici.portfolio.common.NotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/messages")
public class AdminContactController {

    public record MessageDto(UUID id, String name, String email, String message, String locale, boolean read,
            boolean archived, Instant createdAt) {
        static MessageDto from(ContactMessage m) {
            return new MessageDto(m.getId(), m.getName(), m.getEmail(), m.getMessage(), m.getLocale(), m.isRead(),
                    m.isArchived(), m.getCreatedAt());
        }
    }

    public record PageDto(List<MessageDto> items, int page, int size, long total) {}

    private final ContactRepository repository;

    public AdminContactController(ContactRepository repository) {
        this.repository = repository;
    }

    /**
     * @param archived the archive instead of the inbox
     * @param q        text searched in the name, e-mail and message (case-insensitive)
     */
    @GetMapping
    public PageDto list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean unread, @RequestParam(defaultValue = "false") boolean archived,
            @RequestParam(defaultValue = "") String q) {
        PageRequest pr = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100));
        String text = q.strip().toLowerCase(java.util.Locale.ROOT);
        if (text.length() > 100) {
            text = text.substring(0, 100);
        }
        String pattern = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Page<ContactMessage> p = repository.search(archived, unread, pattern, pr);
        return new PageDto(p.getContent().stream().map(MessageDto::from).toList(), p.getNumber(), p.getSize(),
                p.getTotalElements());
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount() {
        return Map.of("unread", repository.countByReadFalseAndArchivedFalse(), "archived", repository.countByArchivedTrue());
    }

    /** archived messages leave the inbox (and count as read) */
    @PutMapping("/{id}/archived")
    @Transactional
    public MessageDto setArchived(@PathVariable UUID id, @RequestParam(defaultValue = "true") boolean value) {
        ContactMessage m = repository.findById(id).orElseThrow(() -> new NotFoundException("Message"));
        m.setArchived(value);
        if (value) {
            m.setRead(true);
        }
        return MessageDto.from(m);
    }

    @PutMapping("/{id}/read")
    @Transactional
    public MessageDto setRead(@PathVariable UUID id, @RequestParam(defaultValue = "true") boolean value) {
        ContactMessage m = repository.findById(id).orElseThrow(() -> new NotFoundException("Message"));
        m.setRead(value);
        return MessageDto.from(m);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        if (!repository.existsById(id)) {
            throw new NotFoundException("Message");
        }
        repository.deleteById(id);
    }
}
