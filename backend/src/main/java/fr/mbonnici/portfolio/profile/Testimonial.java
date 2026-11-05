package fr.mbonnici.portfolio.profile;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** A short quote from someone the owner worked with: who, their role, what they said, where. */
@Entity
@Table(name = "testimonial")
public class Testimonial {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String author;

    /** where the quote can be read (a LinkedIn recommendation, a review…) */
    private String url;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "role_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "role_en", nullable = false))
    private Localized role;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "quote_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "quote_en", nullable = false))
    private Localized quote;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected Testimonial() {}

    public static Testimonial create() {
        return new Testimonial();
    }

    public UUID getId() { return id; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public Localized getRole() { return role; }
    public void setRole(Localized role) { this.role = role; }
    public Localized getQuote() { return quote; }
    public void setQuote(Localized quote) { this.quote = quote; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
