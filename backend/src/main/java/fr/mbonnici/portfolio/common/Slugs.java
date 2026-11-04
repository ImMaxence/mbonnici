package fr.mbonnici.portfolio.common;

import java.text.Normalizer;
import java.util.Locale;

public final class Slugs {

    private Slugs() {}

    public static String slugify(String input) {
        if (input == null) {
            return "";
        }
        String s = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
        return s.length() > 80 ? s.substring(0, 80).replaceAll("-+$", "") : s;
    }
}
