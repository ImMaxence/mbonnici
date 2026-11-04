package fr.mbonnici.portfolio.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "skill")
public class Skill {

    public enum Category { LANGUAGE, FRAMEWORK, DATABASE, DEVOPS, TOOL, PRACTICE }

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category = Category.TOOL;

    @Column(nullable = false)
    private short level = 3;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected Skill() {}

    public static Skill create() {
        return new Skill();
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public short getLevel() { return level; }
    public void setLevel(short level) { this.level = level; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
