package fr.mbonnici.portfolio.project;

import fr.mbonnici.portfolio.project.ProjectDtos.Admin;
import fr.mbonnici.portfolio.project.ProjectDtos.Reorder;
import fr.mbonnici.portfolio.project.ProjectDtos.Upsert;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/projects")
public class AdminProjectController {

    private final ProjectService service;

    public AdminProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<Admin> list() {
        return service.listAll();
    }

    @GetMapping("/{id}")
    public Admin get(@PathVariable UUID id) {
        return service.getAdmin(id);
    }

    /** the public page as it will look, drafts included */
    @GetMapping("/{id}/preview")
    public ProjectDtos.Detail preview(@PathVariable UUID id) {
        return service.preview(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Admin create(@Valid @RequestBody Upsert body) {
        return service.create(body);
    }

    @PutMapping("/{id}")
    public Admin update(@PathVariable UUID id, @Valid @RequestBody Upsert body) {
        return service.update(id, body);
    }

    @PutMapping("/{id}/status")
    public Admin setStatus(@PathVariable UUID id, @RequestParam Project.Status status) {
        return service.setStatus(id, status);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @PutMapping("/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@Valid @RequestBody Reorder body) {
        service.reorder(body.ids());
    }
}
