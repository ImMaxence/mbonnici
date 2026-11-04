package fr.mbonnici.portfolio.article;

import fr.mbonnici.portfolio.article.ArticleDtos.Admin;
import fr.mbonnici.portfolio.article.ArticleDtos.Card;
import fr.mbonnici.portfolio.article.ArticleDtos.Detail;
import fr.mbonnici.portfolio.article.ArticleDtos.Minutes;
import fr.mbonnici.portfolio.article.ArticleDtos.Upsert;
import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.common.NotFoundException;
import fr.mbonnici.portfolio.common.Slugs;
import fr.mbonnici.portfolio.media.MediaDto;
import fr.mbonnici.portfolio.media.MediaRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ArticleService {

    public static final String CACHE = "articles";

    private final ArticleRepository articles;
    private final MediaRepository media;

    public ArticleService(ArticleRepository articles, MediaRepository media) {
        this.articles = articles;
        this.media = media;
    }

    // ── public ───────────────────────────────────────────────────────────────

    @Cacheable(value = CACHE, key = "'list'")
    @Transactional(readOnly = true)
    public List<Card> listPublished() {
        return articles.findAllByStatusOrderByPublishedAtDesc(Article.Status.PUBLISHED).stream().map(Card::from).toList();
    }

    @Cacheable(value = CACHE, key = "'detail:' + #slug")
    @Transactional(readOnly = true)
    public Detail getPublished(String slug) {
        Article a = articles.findBySlugAndStatus(slug, Article.Status.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Article"));
        List<Article> ordered = articles.findAllByStatusOrderByPublishedAtDesc(Article.Status.PUBLISHED);
        int idx = -1;
        for (int i = 0; i < ordered.size(); i++) {
            if (ordered.get(i).getId().equals(a.getId())) {
                idx = i;
                break;
            }
        }
        // newer note first, older note next
        Card newer = idx > 0 ? Card.from(ordered.get(idx - 1)) : null;
        Card older = idx >= 0 && idx < ordered.size() - 1 ? Card.from(ordered.get(idx + 1)) : null;
        return toDetail(a, newer, older);
    }

    // ── admin ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Admin> listAll() {
        return articles.findAllByOrderByCreatedAtDesc().stream().map(Admin::from).toList();
    }

    @Transactional(readOnly = true)
    public Admin getAdmin(UUID id) {
        return Admin.from(find(id));
    }

    @Transactional(readOnly = true)
    public Detail preview(UUID id) {
        return toDetail(find(id), null, null);
    }

    @CacheEvict(value = {CACHE, "settings"}, allEntries = true)
    @Transactional
    public Admin create(Upsert in) {
        Article a = Article.create(resolveSlug(in, null));
        apply(a, in);
        return Admin.from(articles.save(a));
    }

    @CacheEvict(value = {CACHE, "settings"}, allEntries = true)
    @Transactional
    public Admin update(UUID id, Upsert in) {
        Article a = find(id);
        a.setSlug(resolveSlug(in, id));
        apply(a, in);
        a.touch();
        return Admin.from(articles.save(a));
    }

    @CacheEvict(value = {CACHE, "settings"}, allEntries = true)
    @Transactional
    public Admin setStatus(UUID id, Article.Status status) {
        Article a = find(id);
        a.setStatus(status, null);
        a.touch();
        return Admin.from(a);
    }

    @CacheEvict(value = {CACHE, "settings"}, allEntries = true)
    @Transactional
    public void delete(UUID id) {
        articles.delete(find(id));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Article find(UUID id) {
        return articles.findById(id).orElseThrow(() -> new NotFoundException("Article"));
    }

    private String resolveSlug(Upsert in, UUID currentId) {
        String base = in.slug() != null && !in.slug().isBlank() ? in.slug() : in.title().filled().fr();
        String slug = Slugs.slugify(base);
        if (slug.isEmpty()) {
            throw ApiException.badRequest("slug could not be derived from the title");
        }
        boolean taken = currentId == null ? articles.existsBySlug(slug) : articles.existsBySlugAndIdNot(slug, currentId);
        if (taken) {
            throw ApiException.conflict("slug already in use: " + slug);
        }
        return slug;
    }

    private void apply(Article a, Upsert in) {
        if (in.title().isBlank()) {
            throw ApiException.badRequest("title is required in at least one language");
        }
        a.setTitle(Localized.clean(in.title()));
        a.setSummary(Localized.clean(in.summary()));
        a.setBody(Localized.clean(in.body()));
        a.setStatus(in.status(), in.publishedAt());
        List<String> tags = new ArrayList<>();
        if (in.tags() != null) {
            for (String t : in.tags()) {
                if (t != null && !t.isBlank() && !tags.contains(t.trim())) {
                    tags.add(t.trim());
                }
            }
        }
        a.setTags(tags);
        a.setCoverMedia(in.coverMediaId() == null ? null
                : media.findById(in.coverMediaId()).orElseThrow(() -> new NotFoundException("Cover media")));
    }

    private static Detail toDetail(Article a, Card newer, Card older) {
        Localized body = a.getBody().filled();
        return new Detail(a.getId(), a.getSlug(), a.getTitle().filled(), a.getSummary().filled(), body,
                List.copyOf(a.getTags()), MediaDto.from(a.getCoverMedia()), a.getPublishedAt(), a.getUpdatedAt(),
                Minutes.of(body), newer, older);
    }
}
