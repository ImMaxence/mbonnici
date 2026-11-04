package fr.mbonnici.portfolio.profile;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "education")
public class Education {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String school;

    @Column(name = "school_url")
    private String schoolUrl;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "degree_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "degree_en", nullable = false))
    private Localized degree;

    private String location;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected Education() {}

    public static Education create() {
        return new Education();
    }

    public UUID getId() { return id; }
    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }
    public String getSchoolUrl() { return schoolUrl; }
    public void setSchoolUrl(String schoolUrl) { this.schoolUrl = schoolUrl; }
    public Localized getDegree() { return degree; }
    public void setDegree(Localized degree) { this.degree = degree; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
