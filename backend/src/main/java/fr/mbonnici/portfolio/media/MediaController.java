package fr.mbonnici.portfolio.media;

import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

/** Streams images from object storage with long-lived caching (keys are unique, content never changes). */
@RestController
public class MediaController {

    private final MediaService service;

    public MediaController(MediaService service) {
        this.service = service;
    }

    @GetMapping("/api/media/{*key}")
    public ResponseEntity<byte[]> get(@PathVariable String key, WebRequest request) {
        String objectKey = key.startsWith("/") ? key.substring(1) : key;
        return service.serve(objectKey)
                .map(served -> {
                    String etag = "\"" + served.media().getId() + served.variant() + "\"";
                    if (request.checkNotModified(etag)) {
                        return ResponseEntity.status(304).<byte[]>build();
                    }
                    return ResponseEntity.ok()
                            .eTag(etag)
                            .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                            .contentType(MediaType.parseMediaType(served.contentType()))
                            .header("X-Content-Type-Options", "nosniff")
                            // Even if an SVG slipped through, it cannot run scripts in this origin.
                            .header("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'")
                            .header("Content-Disposition", "inline")
                            .body(served.bytes());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
