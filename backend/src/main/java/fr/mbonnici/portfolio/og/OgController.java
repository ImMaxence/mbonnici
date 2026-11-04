package fr.mbonnici.portfolio.og;

import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

/** Share pictures (og:image) of the published projects and notes, 1200 × 630 JPEG. */
@RestController
public class OgController {

    private final OgImageService service;

    public OgController(OgImageService service) {
        this.service = service;
    }

    @GetMapping("/api/og/projects/{slug}.jpg")
    public ResponseEntity<byte[]> project(@PathVariable String slug, @RequestParam(defaultValue = "fr") String lang,
            WebRequest request) {
        return respond(service.project(slug, lang), request);
    }

    @GetMapping("/api/og/notes/{slug}.jpg")
    public ResponseEntity<byte[]> note(@PathVariable String slug, @RequestParam(defaultValue = "fr") String lang,
            WebRequest request) {
        return respond(service.note(slug, lang), request);
    }

    private static ResponseEntity<byte[]> respond(OgImageService.Rendered r, WebRequest request) {
        String etag = "\"og-" + r.fingerprint() + "\"";
        if (request.checkNotModified(etag)) {
            return ResponseEntity.status(304).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .eTag(etag)
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .body(r.jpeg());
    }
}
