package fr.mbonnici.portfolio.media;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/media")
public class AdminMediaController {

    private final MediaService service;

    public AdminMediaController(MediaService service) {
        this.service = service;
    }

    public record PageDto<T>(List<T> items, int page, int size, long total) {
        static <T> PageDto<T> of(Page<T> p) {
            return new PageDto<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements());
        }
    }

    public record AltInput(@Size(max = 300) String fr, @Size(max = 300) String en) {}

    @GetMapping
    public PageDto<MediaDto> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "40") int size) {
        return PageDto.of(service.list(page, size));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MediaDto upload(@RequestPart("file") MultipartFile file,
            @RequestParam(value = "altFr", required = false) String altFr,
            @RequestParam(value = "altEn", required = false) String altEn) {
        return service.upload(file, Localized.of(altFr, altEn));
    }

    @PutMapping("/{id}")
    public MediaDto updateAlt(@PathVariable UUID id, @Valid @RequestBody AltInput in) {
        return service.updateAlt(id, Localized.of(in.fr(), in.en()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
