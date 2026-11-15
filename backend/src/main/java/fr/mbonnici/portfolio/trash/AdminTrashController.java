package fr.mbonnici.portfolio.trash;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The back office's bin: what was deleted in the last 30 days, to put back or to empty. */
@RestController
@RequestMapping("/api/admin/trash")
public class AdminTrashController {

    private final TrashService service;

    public AdminTrashController(TrashService service) {
        this.service = service;
    }

    @GetMapping
    public List<TrashService.Item> list() {
        return service.list();
    }

    @PostMapping("/{id}/restore")
    public TrashService.Restored restore(@PathVariable UUID id) {
        return service.restore(id);
    }

    /** a deleted picture is no longer served on the site: the bin shows it from here */
    @GetMapping("/{id}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable UUID id) {
        return service.preview(id)
                .map(o -> ResponseEntity.ok()
                        .cacheControl(CacheControl.noStore())
                        .contentType(MediaType.parseMediaType(o.contentType() == null ? "image/webp" : o.contentType()))
                        .body(o.bytes()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void purge(@PathVariable UUID id) {
        service.purge(id);
    }

    @DeleteMapping
    public Map<String, Integer> purgeAll() {
        return Map.of("deleted", service.purgeAll());
    }
}
