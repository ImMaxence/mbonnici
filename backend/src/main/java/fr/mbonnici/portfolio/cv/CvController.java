package fr.mbonnici.portfolio.cv;

import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

@RestController
public class CvController {

    private final CvService service;

    public CvController(CvService service) {
        this.service = service;
    }

    /** The CV as a PDF, made from the site content ({@code lang} = fr | en). */
    @GetMapping("/api/cv")
    public ResponseEntity<byte[]> cv(@RequestParam(defaultValue = "fr") String lang,
            @RequestParam(defaultValue = "false") boolean download, WebRequest request) {
        CvService.Rendered r = service.render(lang);
        String etag = "\"cv-" + r.fingerprint() + "\"";
        if (request.checkNotModified(etag)) {
            return ResponseEntity.status(304).build();
        }
        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(r.fileName()).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .eTag(etag)
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(r.pdf());
    }
}
