package fr.mbonnici.portfolio.article;

import fr.mbonnici.portfolio.article.ArticleDtos.Card;
import fr.mbonnici.portfolio.article.ArticleDtos.Detail;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/articles")
public class ArticleController {

    private final ArticleService service;

    public ArticleController(ArticleService service) {
        this.service = service;
    }

    @GetMapping
    public List<Card> list() {
        return service.listPublished();
    }

    @GetMapping("/{slug}")
    public Detail get(@PathVariable String slug) {
        return service.getPublished(slug);
    }
}
