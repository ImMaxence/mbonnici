package fr.mbonnici.portfolio.project;

import fr.mbonnici.portfolio.media.Media;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "project_media")
public class ProjectMedia {

    /** GALLERY: wide screenshots; MOBILE: portrait shots shown inside the iPhone simulator. */
    public enum Kind { GALLERY, MOBILE }

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "media_id", nullable = false)
    private Media media;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind = Kind.GALLERY;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected ProjectMedia() {}

    public static ProjectMedia of(Project project, Media media, Kind kind, int sortOrder) {
        ProjectMedia pm = new ProjectMedia();
        pm.project = project;
        pm.media = media;
        pm.kind = kind == null ? Kind.GALLERY : kind;
        pm.sortOrder = sortOrder;
        return pm;
    }

    public UUID getId() { return id; }
    public Project getProject() { return project; }
    public Media getMedia() { return media; }
    public Kind getKind() { return kind; }
    public int getSortOrder() { return sortOrder; }
}
