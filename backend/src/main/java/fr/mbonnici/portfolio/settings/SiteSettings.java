package fr.mbonnici.portfolio.settings;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Single-row table (id = 1) holding everything editable about the site owner. */
@Entity
@Table(name = "site_settings")
public class SiteSettings {

    public enum Availability { OPEN, LISTENING, BUSY }

    @Id
    private Short id = 1;

    @Column(name = "owner_name", nullable = false)
    private String ownerName;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "headline_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "headline_en", nullable = false))
    private Localized headline;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "bio_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "bio_en", nullable = false))
    private Localized bio;

    private String location;

    @Column(name = "public_email")
    private String publicEmail;

    @Column(name = "github_url")
    private String githubUrl;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Availability availability = Availability.OPEN;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "seo_title_fr"))
    @AttributeOverride(name = "en", column = @Column(name = "seo_title_en"))
    private Localized seoTitle;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "seo_description_fr"))
    @AttributeOverride(name = "en", column = @Column(name = "seo_description_en"))
    private Localized seoDescription;

    @Column(name = "legal_name")
    private String legalName;

    @Column(name = "legal_address")
    private String legalAddress;

    @Column(name = "legal_host")
    private String legalHost;

    @Column(name = "legal_contact_email")
    private String legalContactEmail;

    /** picture shown next to the name in the site header (initial letter when empty) */
    @jakarta.persistence.ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @jakarta.persistence.JoinColumn(name = "avatar_media_id")
    private fr.mbonnici.portfolio.media.Media avatar;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected SiteSettings() {}

    public Short getId() { return id; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public Localized getHeadline() { return headline; }
    public void setHeadline(Localized headline) { this.headline = headline; }
    public Localized getBio() { return bio; }
    public void setBio(Localized bio) { this.bio = bio; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getPublicEmail() { return publicEmail; }
    public void setPublicEmail(String publicEmail) { this.publicEmail = publicEmail; }
    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }
    public String getLinkedinUrl() { return linkedinUrl; }
    public void setLinkedinUrl(String linkedinUrl) { this.linkedinUrl = linkedinUrl; }
    public Availability getAvailability() { return availability; }
    public void setAvailability(Availability availability) { this.availability = availability; }
    public Localized getSeoTitle() { return seoTitle; }
    public void setSeoTitle(Localized seoTitle) { this.seoTitle = seoTitle; }
    public Localized getSeoDescription() { return seoDescription; }
    public void setSeoDescription(Localized seoDescription) { this.seoDescription = seoDescription; }
    public String getLegalName() { return legalName; }
    public void setLegalName(String legalName) { this.legalName = legalName; }
    public String getLegalAddress() { return legalAddress; }
    public void setLegalAddress(String legalAddress) { this.legalAddress = legalAddress; }
    public String getLegalHost() { return legalHost; }
    public void setLegalHost(String legalHost) { this.legalHost = legalHost; }
    public String getLegalContactEmail() { return legalContactEmail; }
    public void setLegalContactEmail(String legalContactEmail) { this.legalContactEmail = legalContactEmail; }
    public fr.mbonnici.portfolio.media.Media getAvatar() { return avatar; }
    public void setAvatar(fr.mbonnici.portfolio.media.Media avatar) { this.avatar = avatar; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void touch() { this.updatedAt = Instant.now(); }
}
