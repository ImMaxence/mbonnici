package fr.mbonnici.portfolio.errors;

import fr.mbonnici.portfolio.errors.ErrorLogService.Entry;
import fr.mbonnici.portfolio.errors.ErrorLogService.Source;
import fr.mbonnici.portfolio.errors.ErrorLogService.Summary;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
public class ErrorController {

    /** what a browser reports: no identifier, only the page path */
    public record ClientError(@NotBlank @Size(max = 2000) String message, @Size(max = 12_000) String stack,
            @Size(max = 300) String path) {}

    /** values of blocked-uri that are not URLs */
    private static final Set<String> KEYWORDS = Set.of("inline", "eval", "wasm-eval", "trusted-types-policy", "trusted-types-sink");

    private final ErrorLogService service;
    private final ObjectMapper mapper;

    public ErrorController(ErrorLogService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    /** JavaScript errors of the site (beacon, like the audience events: no cookie, CSRF-exempt, rate-limited) */
    @PostMapping("/api/analytics/errors")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void report(@Valid @RequestBody ClientError in, HttpServletRequest request) {
        if ("1".equals(request.getHeader("DNT")) || "1".equals(request.getHeader("Sec-GPC"))) {
            return;
        }
        String stack = in.stack() == null ? "" : in.stack();
        // noise that is not the site's: browser extensions, benign layout warnings
        if (stack.contains("-extension://") || in.message().startsWith("ResizeObserver loop")
                || in.message().contains("Script error")) {
            return;
        }
        String path = in.path() == null || !in.path().startsWith("/") ? null : in.path();
        if (path != null && path.startsWith("/admin")) {
            path = "/admin…";
        }
        service.record(Source.CLIENT, in.message(), stack.isBlank() ? null : stack, path);
    }

    /**
     * Content-Security-Policy violations, sent by the browsers themselves: the Reporting API
     * (application/reports+json, an array of {type: "csp-violation", body}) and the older report-uri
     * format (application/csp-report, {"csp-report": {...}}). Read as text since Spring does not see
     * the second one as JSON.
     */
    @PostMapping("/api/analytics/csp")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void csp(@RequestBody(required = false) String body, HttpServletRequest request) {
        if (body == null || body.isBlank() || body.length() > 64_000
                || "1".equals(request.getHeader("DNT")) || "1".equals(request.getHeader("Sec-GPC"))) {
            return;
        }
        JsonNode root;
        try {
            root = mapper.readTree(body);
        } catch (RuntimeException e) {
            return;
        }
        List<JsonNode> reports = new ArrayList<>();
        if (root.isArray()) {
            for (JsonNode r : root) {
                if ("csp-violation".equals(r.path("type").asString(""))) {
                    reports.add(r.path("body"));
                }
            }
        } else if (root.has("csp-report")) {
            reports.add(root.path("csp-report"));
        }
        reports.stream().limit(10).forEach(this::violation);
    }

    private void violation(JsonNode r) {
        String directive = text(r, "effectiveDirective", "effective-directive", "violated-directive").split(" ")[0];
        String blocked = text(r, "blockedURL", "blocked-uri");
        String source = text(r, "sourceFile", "source-file");
        if (directive.isEmpty() || foreign(blocked) || foreign(source)) {
            return;
        }
        String what = blocked.isEmpty() ? "?" : KEYWORDS.contains(blocked) ? blocked : withoutQuery(blocked);
        StringBuilder detail = new StringBuilder();
        if (!source.isEmpty()) {
            detail.append("at ").append(withoutQuery(source));
            String line = text(r, "lineNumber", "line-number");
            if (!line.isEmpty()) {
                detail.append(':').append(line);
                String column = text(r, "columnNumber", "column-number");
                if (!column.isEmpty()) {
                    detail.append(':').append(column);
                }
            }
        }
        String sample = text(r, "sample", "script-sample");
        if (!sample.isEmpty()) {
            detail.append(detail.isEmpty() ? "" : "\n").append("sample: ").append(sample);
        }
        if ("report".equals(text(r, "disposition"))) {
            detail.append(detail.isEmpty() ? "" : "\n").append("report only (not blocked)");
        }
        String path = null;
        try {
            String document = text(r, "documentURL", "document-uri");
            path = document.isEmpty() ? null : URI.create(document).getRawPath();
        } catch (IllegalArgumentException ignored) {
            // an unparsable page address: keep the violation without it
        }
        if (path != null && path.startsWith("/admin")) {
            path = "/admin…";
        }
        service.record(Source.CSP, "Blocked by the CSP (" + directive + "): " + what,
                detail.isEmpty() ? null : detail.toString(), path);
    }

    /** extensions and browser features inject their own resources: not the site's business */
    private static boolean foreign(String url) {
        return url.contains("-extension:") || url.startsWith("moz-") || url.startsWith("webkit-masked-url")
                || url.startsWith("about");
    }

    private static String withoutQuery(String url) {
        int cut = url.length();
        for (char c : new char[] {'?', '#'}) {
            int i = url.indexOf(c);
            if (i >= 0 && i < cut) {
                cut = i;
            }
        }
        return url.substring(0, Math.min(cut, 300));
    }

    private static String text(JsonNode node, String... names) {
        for (String name : names) {
            JsonNode v = node.path(name);
            if (!v.isMissingNode() && !v.isNull()) {
                String s = v.asString("").strip();
                if (!s.isEmpty()) {
                    return s.length() > 500 ? s.substring(0, 500) : s;
                }
            }
        }
        return "";
    }

    @GetMapping("/api/admin/errors")
    public List<Entry> list(@RequestParam(defaultValue = "false") boolean resolved) {
        return service.list(resolved);
    }

    @GetMapping("/api/admin/errors/summary")
    public Summary summary() {
        return service.summary();
    }

    @PutMapping("/api/admin/errors/{id}/resolved")
    public Map<String, Boolean> resolve(@PathVariable long id, @RequestParam(defaultValue = "true") boolean value) {
        return Map.of("ok", service.resolve(id, value));
    }

    @DeleteMapping("/api/admin/errors/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        service.delete(id);
    }

    @DeleteMapping("/api/admin/errors/resolved")
    public Map<String, Integer> deleteResolved() {
        return Map.of("deleted", service.deleteResolved());
    }
}
