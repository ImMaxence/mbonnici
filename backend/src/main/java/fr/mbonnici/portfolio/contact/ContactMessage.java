package fr.mbonnici.portfolio.contact;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "contact_message")
public class ContactMessage {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String message;

    private String locale;

    @Column(name = "visitor_hash")
    private String visitorHash;

    @Column(nullable = false)
    private boolean read;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected ContactMessage() {}

    public static ContactMessage create(String name, String email, String message, String locale, String visitorHash) {
        ContactMessage m = new ContactMessage();
        m.name = name;
        m.email = email;
        m.message = message;
        m.locale = locale;
        m.visitorHash = visitorHash;
        return m;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getMessage() { return message; }
    public String getLocale() { return locale; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public Instant getCreatedAt() { return createdAt; }
}
