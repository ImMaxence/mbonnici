package fr.mbonnici.portfolio.profile;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "experience")
public class Experience {

    public enum ContractType { CDI, CDD, ALTERNANCE, STAGE, FREELANCE }

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String company;

    @Column(name = "company_url")
    private String companyUrl;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "role_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "role_en", nullable = false))
    private Localized role;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "description_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "description_en", nullable = false))
    private Localized description;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(name = "contract_type", nullable = false)
    private ContractType contractType = ContractType.CDI;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> skills = new ArrayList<>();

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected Experience() {}

    public static Experience create() {
        return new Experience();
    }

    public UUID getId() { return id; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getCompanyUrl() { return companyUrl; }
    public void setCompanyUrl(String companyUrl) { this.companyUrl = companyUrl; }
    public Localized getRole() { return role; }
    public void setRole(Localized role) { this.role = role; }
    public Localized getDescription() { return description; }
    public void setDescription(Localized description) { this.description = description; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public ContractType getContractType() { return contractType; }
    public void setContractType(ContractType contractType) { this.contractType = contractType; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public List<String> getSkills() { return skills; }
    public void setSkills(List<String> skills) { this.skills = skills == null ? new ArrayList<>() : new ArrayList<>(skills); }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
