package fr.mbonnici.portfolio.analytics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "analytics_event")
public class AnalyticsEvent {

    public enum Type { PAGE_VIEW, PROJECT_VIEW, OUTBOUND_CLICK, CONTACT_SUBMIT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(nullable = false)
    private String path;

    @Column(name = "project_id")
    private UUID projectId;

    private String locale;
    private String theme;
    private String style;
    private String device;

    @Column(name = "referrer_host")
    private String referrerHost;

    @Column(name = "visitor_hash", nullable = false)
    private String visitorHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected AnalyticsEvent() {}

    public static AnalyticsEvent of(Type type, String path, UUID projectId, String locale, String theme, String style,
            String device, String referrerHost, String visitorHash) {
        AnalyticsEvent e = new AnalyticsEvent();
        e.type = type;
        e.path = path;
        e.projectId = projectId;
        e.locale = locale;
        e.theme = theme;
        e.style = style;
        e.device = device;
        e.referrerHost = referrerHost;
        e.visitorHash = visitorHash;
        return e;
    }

    public Long getId() { return id; }
    public Type getType() { return type; }
    public String getPath() { return path; }
    public UUID getProjectId() { return projectId; }
    public Instant getCreatedAt() { return createdAt; }
}
