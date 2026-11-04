package fr.mbonnici.portfolio.project;

import fr.mbonnici.portfolio.project.ProjectDtos.Card;
import fr.mbonnici.portfolio.project.ProjectDtos.Detail;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<Card> list(@RequestParam(required = false) Boolean featured) {
        List<Card> all = service.listPublished();
        return Boolean.TRUE.equals(featured) ? all.stream().filter(Card::featured).toList() : all;
    }

    @GetMapping("/{slug}")
    public Detail get(@PathVariable String slug) {
        return service.getPublished(slug);
    }
}
