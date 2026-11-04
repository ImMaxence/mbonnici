package fr.mbonnici.portfolio.common;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Embeddable;

/** A pair of French / English texts. Mapped as two columns via {@code @AttributeOverride}. */
@Embeddable
public record Localized(String fr, String en) {

    public static final Localized EMPTY = new Localized("", "");

    public static Localized of(String fr, String en) {
        return new Localized(fr == null ? "" : fr, en == null ? "" : en);
    }

    public String get(String lang) {
        return "en".equalsIgnoreCase(lang) ? en : fr;
    }

    @JsonIgnore
    public boolean isBlank() {
        return (fr == null || fr.isBlank()) && (en == null || en.isBlank());
    }

    /**
     * As typed, never null: texts are stored per language as written (an empty translation stays
     * empty, so the back office can point it out); the fallback happens when reading ({@link #filled}).
     */
    public static Localized clean(Localized l) {
        return l == null ? EMPTY : of(l.fr(), l.en());
    }

    /** Falls back to the other language when one is missing so the site never shows an empty label. */
    public Localized filled() {
        String f = fr == null || fr.isBlank() ? en : fr;
        String e = en == null || en.isBlank() ? fr : en;
        return new Localized(f == null ? "" : f, e == null ? "" : e);
    }
}
