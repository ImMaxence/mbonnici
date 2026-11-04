package fr.mbonnici.portfolio.cv;

import fr.mbonnici.portfolio.common.NotFoundException;
import fr.mbonnici.portfolio.settings.SettingsDtos.Cv;
import java.io.IOException;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class CvController {

    private final CvService service;

    public CvController(CvService service) {
        this.service = service;
    }

    /**
     * The uploaded resume ({@code lang} = fr | en, the other language when that one is missing).
     * Revalidated on every request (a new upload shows at once) and kept out of search engines:
     * a resume carries personal details.
     */
    @GetMapping("/api/cv")
    public ResponseEntity<byte[]> cv(@RequestParam(defaultValue = "fr") String lang,
            @RequestParam(defaultValue = "false") boolean download, WebRequest request) {
        CvService.Download d = service.download(lang).orElseThrow(() -> new NotFoundException("Resume"));
        String etag = "\"cv-" + Integer.toHexString(d.key().hashCode()) + "\"";
        if (request.checkNotModified(etag)) {
            return ResponseEntity.status(304).build();
        }
        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(d.fileName()).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .eTag(etag)
                .cacheControl(CacheControl.noCache().cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("X-Robots-Tag", "noindex, nofollow")
                .body(d.pdf());
    }

    @GetMapping("/api/admin/cv")
    public Cv status() {
        return service.status();
    }

    @PostMapping(value = "/api/admin/cv/{lang}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Cv upload(@PathVariable String lang, @RequestPart("file") MultipartFile file) throws IOException {
        // checked before reading: the multipart limit is high for backup archives
        if (file.getSize() > CvService.MAX_BYTES) {
            throw fr.mbonnici.portfolio.common.ApiException.badRequest("the resume is larger than 10 MB");
        }
        return service.upload(lang, file.getBytes());
    }

    @DeleteMapping("/api/admin/cv/{lang}")
    public Cv remove(@PathVariable String lang) {
        return service.remove(lang);
    }
}
