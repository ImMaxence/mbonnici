package fr.mbonnici.portfolio.errors;

import fr.mbonnici.portfolio.errors.ErrorLogService.Entry;
import fr.mbonnici.portfolio.errors.ErrorLogService.Source;
import fr.mbonnici.portfolio.errors.ErrorLogService.Summary;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
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

@RestController
public class ErrorController {

    /** what a browser reports: no identifier, only the page path */
    public record ClientError(@NotBlank @Size(max = 2000) String message, @Size(max = 12_000) String stack,
            @Size(max = 300) String path) {}

    private final ErrorLogService service;

    public ErrorController(ErrorLogService service) {
        this.service = service;
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
