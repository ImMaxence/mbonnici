package fr.mbonnici.portfolio.backup;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Reader / writer for the CSV dialect of PostgreSQL {@code COPY … WITH (FORMAT csv, HEADER true)}:
 * comma separated, {@code "} quoting with doubled quotes, an unquoted empty field is NULL while
 * {@code ""} is the empty string, and quoted fields may span lines.
 */
public final class PgCsv {

    /** A parsed table: column names and rows (a {@code null} cell is SQL NULL). */
    public record Table(List<String> header, List<List<String>> rows) {

        public int column(String name) {
            return header.indexOf(name);
        }

        public String get(List<String> row, String column) {
            int i = column(column);
            return i < 0 || i >= row.size() ? null : row.get(i);
        }
    }

    private PgCsv() {}

    public static Table parse(byte[] bytes) {
        String s = new String(bytes, StandardCharsets.UTF_8);
        List<List<String>> records = new ArrayList<>();
        List<String> current = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        boolean wasQuoted = false;
        boolean any = false;
        int n = s.length();
        for (int i = 0; i < n; i++) {
            char c = s.charAt(i);
            any = true;
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < n && s.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field.append(c);
                }
            } else if (c == '"') {
                quoted = true;
                wasQuoted = true;
            } else if (c == ',') {
                current.add(cell(field, wasQuoted));
                field.setLength(0);
                wasQuoted = false;
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < n && s.charAt(i + 1) == '\n') {
                    i++;
                }
                current.add(cell(field, wasQuoted));
                records.add(current);
                current = new ArrayList<>();
                field.setLength(0);
                wasQuoted = false;
                any = false;
            } else {
                field.append(c);
            }
        }
        if (any) {
            current.add(cell(field, wasQuoted));
            records.add(current);
        }
        if (records.isEmpty()) {
            return new Table(List.of(), List.of());
        }
        List<String> header = records.getFirst();
        return new Table(List.copyOf(header), records.subList(1, records.size()));
    }

    private static String cell(StringBuilder field, boolean quoted) {
        return field.isEmpty() && !quoted ? null : field.toString();
    }

    /** Serialises rows back to the same dialect (every non-null value quoted). */
    public static byte[] write(List<String> header, Collection<List<String>> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", header)).append('\n');
        for (List<String> row : rows) {
            for (int i = 0; i < row.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                String v = row.get(i);
                if (v != null) {
                    sb.append('"').append(v.replace("\"", "\"\"")).append('"');
                }
            }
            sb.append('\n');
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream(sb.length() + 16);
        out.writeBytes(sb.toString().getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }
}
