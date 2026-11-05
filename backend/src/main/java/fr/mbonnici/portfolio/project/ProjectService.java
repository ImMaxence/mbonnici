package fr.mbonnici.portfolio.project;

import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.common.NotFoundException;
import fr.mbonnici.portfolio.common.Slugs;
import fr.mbonnici.portfolio.media.Media;
import fr.mbonnici.portfolio.media.MediaDto;
import fr.mbonnici.portfolio.media.MediaRepository;
import fr.mbonnici.portfolio.project.ProjectDtos.Admin;
import fr.mbonnici.portfolio.project.ProjectDtos.Card;
import fr.mbonnici.portfolio.project.ProjectDtos.Detail;
import fr.mbonnici.portfolio.project.ProjectDtos.MediaItem;
import fr.mbonnici.portfolio.project.ProjectDtos.MediaRef;
import fr.mbonnici.portfolio.project.ProjectDtos.Upsert;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    public static final String CACHE = "projects";
    private static final Pattern HTTP_URL = Pattern.compile("^https?://[^\\s]+$");

    private final ProjectRepository projects;
    private final MediaRepository mediaRepository;

    public ProjectService(ProjectRepository projects, MediaRepository mediaRepository) {
        this.projects = projects;
        this.mediaRepository = mediaRepository;
    }

    // ── public ───────────────────────────────────────────────────────────────

    @Cacheable(value = CACHE, key = "'list'")
    @Transactional(readOnly = true)
    public List<Card> listPublished() {
        return projects.findAllByStatusOrderBySortOrderAscCreatedAtDesc(Project.Status.PUBLISHED)
                .stream().map(Card::from).toList();
    }

    @Cacheable(value = CACHE, key = "'detail:' + #slug")
    @Transactional(readOnly = true)
    public Detail getPublished(String slug) {
        Project p = projects.findBySlugAndStatus(slug, Project.Status.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Project"));
        List<Project> ordered = projects.findAllByStatusOrderBySortOrderAscCreatedAtDesc(Project.Status.PUBLISHED);
        int idx = -1;
        for (int i = 0; i < ordered.size(); i++) {
            if (ordered.get(i).getId().equals(p.getId())) {
                idx = i;
                break;
            }
        }
        Card previous = idx > 0 ? Card.from(ordered.get(idx - 1)) : null;
        Card next = idx >= 0 && idx < ordered.size() - 1 ? Card.from(ordered.get(idx + 1)) : null;
        if (next == null && ordered.size() > 1 && idx == ordered.size() - 1) {
            next = Card.from(ordered.get(0)); // loop back to the first project
        }
        return toDetail(p, previous, next);
    }

    @Cacheable(value = CACHE, key = "'id:' + #slug")
    @Transactional(readOnly = true)
    public Optional<UUID> findPublishedId(String slug) {
        return projects.findIdBySlugAndStatus(slug, Project.Status.PUBLISHED);
    }

    // ── admin ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Admin> listAll() {
        return projects.findAllByOrderBySortOrderAscCreatedAtDesc().stream().map(this::toAdmin).toList();
    }

    /** The public page of any project, draft included (back-office preview). */
    @Transactional(readOnly = true)
    public Detail preview(UUID id) {
        return toDetail(projects.findById(id).orElseThrow(() -> new NotFoundException("Project")), null, null);
    }

    @Transactional(readOnly = true)
    public Admin getAdmin(UUID id) {
        return toAdmin(projects.findById(id).orElseThrow(() -> new NotFoundException("Project")));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public Admin create(Upsert in) {
        String slug = resolveSlug(in, null);
        Project p = Project.create(slug);
        apply(p, in);
        return toAdmin(projects.save(p));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public Admin update(UUID id, Upsert in) {
        Project p = projects.findById(id).orElseThrow(() -> new NotFoundException("Project"));
        p.setSlug(resolveSlug(in, id));
        apply(p, in);
        p.touch();
        return toAdmin(projects.save(p));
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public void delete(UUID id) {
        if (!projects.existsById(id)) {
            throw new NotFoundException("Project");
        }
        projects.deleteById(id);
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public void reorder(List<UUID> ids) {
        int i = 0;
        for (UUID id : ids) {
            Project p = projects.findById(id).orElseThrow(() -> new NotFoundException("Project"));
            p.setSortOrder(i++);
        }
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public Admin setStatus(UUID id, Project.Status status) {
        Project p = projects.findById(id).orElseThrow(() -> new NotFoundException("Project"));
        p.setStatus(status);
        p.touch();
        return toAdmin(p);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String resolveSlug(Upsert in, UUID currentId) {
        String base = in.slug() != null && !in.slug().isBlank() ? in.slug() : in.title().filled().en();
        String slug = Slugs.slugify(base);
        if (slug.isEmpty()) {
            throw ApiException.badRequest("slug could not be derived from the title");
        }
        boolean taken = currentId == null ? projects.existsBySlug(slug) : projects.existsBySlugAndIdNot(slug, currentId);
        if (taken) {
            throw ApiException.conflict("slug already in use: " + slug);
        }
        return slug;
    }

    private void apply(Project p, Upsert in) {
        if (in.title().isBlank()) {
            throw ApiException.badRequest("title is required in at least one language");
        }
        p.setTitle(Localized.clean(in.title()));
        p.setTagline(Localized.clean(in.tagline()));
        p.setDescription(Localized.clean(in.description()));
        var cs = in.caseStudy();
        p.setContext(cs == null ? Localized.EMPTY : Localized.clean(cs.context()));
        p.setRole(cs == null ? Localized.EMPTY : Localized.clean(cs.role()));
        p.setChallenges(cs == null ? Localized.EMPTY : Localized.clean(cs.challenges()));
        p.setResults(cs == null ? Localized.EMPTY : Localized.clean(cs.results()));
        p.setStatus(in.status());
        p.setFeatured(Boolean.TRUE.equals(in.featured()));
        p.setSortOrder(in.sortOrder() == null ? 0 : in.sortOrder());
        p.setYear(in.year());
        p.setCategory(in.category());
        p.setDisplayMode(in.displayMode() == null ? Project.DisplayMode.BOTH : in.displayMode());
        p.setAccentColor(in.accentColor() == null || in.accentColor().isBlank() ? "#0a84ff" : in.accentColor().toLowerCase());
        p.setRepoUrl(checkedUrl(in.repoUrl(), "repoUrl"));
        p.setLiveUrl(checkedUrl(in.liveUrl(), "liveUrl"));
        p.setAllowIframe(Boolean.TRUE.equals(in.allowIframe()) && p.getLiveUrl() != null);
        p.setStack(clean(in.stack()));

        Media cover = in.coverMediaId() == null ? null
                : mediaRepository.findById(in.coverMediaId()).orElseThrow(() -> new NotFoundException("Cover media"));
        if (cover != null && cover.getContentType().startsWith("video/")) {
            throw ApiException.badRequest("the cover must be a picture (it is also the share image)");
        }
        p.setCoverMedia(cover);
        Media coverVideo = in.coverVideoMediaId() == null ? null
                : mediaRepository.findById(in.coverVideoMediaId()).orElseThrow(() -> new NotFoundException("Cover video"));
        if (coverVideo != null && !coverVideo.getContentType().startsWith("video/")) {
            throw ApiException.badRequest("coverVideoMediaId must be a video");
        }
        p.setCoverVideo(coverVideo);

        if (in.media() != null) {
            Map<UUID, Media> loaded = new LinkedHashMap<>();
            for (MediaRef ref : in.media()) {
                loaded.computeIfAbsent(ref.mediaId(),
                        id -> mediaRepository.findById(id).orElseThrow(() -> new NotFoundException("Media " + id)));
            }
            // Links are reconciled, not cleared and re-added: Hibernate inserts before it deletes, so
            // re-adding an image already linked would hit the (project_id, media_id) unique key.
            Map<UUID, ProjectMedia> existing = new LinkedHashMap<>();
            for (ProjectMedia pm : p.getMedia()) {
                existing.put(pm.getMedia().getId(), pm);
            }
            List<ProjectMedia> next = new ArrayList<>();
            int i = 0;
            for (MediaRef ref : in.media()) {
                if (next.stream().anyMatch(pm -> pm.getMedia().getId().equals(ref.mediaId()))) {
                    continue; // the same image twice
                }
                ProjectMedia kept = existing.remove(ref.mediaId());
                if (kept != null) {
                    kept.place(ref.kind(), i++);
                    next.add(kept);
                } else {
                    next.add(ProjectMedia.of(p, loaded.get(ref.mediaId()), ref.kind(), i++));
                }
            }
            p.getMedia().removeIf(pm -> existing.containsKey(pm.getMedia().getId()));
            for (ProjectMedia pm : next) {
                if (!p.getMedia().contains(pm)) {
                    p.getMedia().add(pm);
                }
            }
            p.getMedia().sort(java.util.Comparator.comparingInt(ProjectMedia::getSortOrder));
        }
    }

    private static String checkedUrl(String url, String field) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String trimmed = url.trim();
        if (!HTTP_URL.matcher(trimmed).matches()) {
            throw ApiException.badRequest(field + " must be an http(s) URL");
        }
        return trimmed;
    }

    private static List<String> clean(List<String> values) {
        if (values == null) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String v : values) {
            if (v != null && !v.isBlank() && !out.contains(v.trim())) {
                out.add(v.trim());
            }
        }
        return out;
    }

    private Detail toDetail(Project p, Card previous, Card next) {
        List<MediaDto> gallery = new ArrayList<>();
        List<MediaDto> mobile = new ArrayList<>();
        for (ProjectMedia pm : p.getMedia()) {
            (pm.getKind() == ProjectMedia.Kind.MOBILE ? mobile : gallery).add(MediaDto.from(pm.getMedia()));
        }
        return new Detail(p.getId(), p.getSlug(), p.getTitle().filled(), p.getTagline().filled(),
                p.getDescription().filled(), ProjectDtos.CaseStudy.from(p), p.getCategory(), p.getDisplayMode(), p.getAccentColor(), p.getYear(),
                List.copyOf(p.getStack()), p.isFeatured(), MediaDto.from(p.getCoverMedia()), MediaDto.from(p.getCoverVideo()),
                p.getLiveUrl(), p.getRepoUrl(), p.isAllowIframe(), gallery, mobile, p.getPublishedAt(), p.getUpdatedAt(),
                previous, next);
    }

    private Admin toAdmin(Project p) {
        List<MediaItem> items = p.getMedia().stream()
                .map(pm -> new MediaItem(MediaDto.from(pm.getMedia()), pm.getKind(), pm.getSortOrder()))
                .toList();
        Media cover = p.getCoverMedia();
        return new Admin(p.getId(), p.getSlug(), p.getTitle(), p.getTagline(), p.getDescription(),
                new ProjectDtos.CaseStudy(p.getContext(), p.getRole(), p.getChallenges(), p.getResults()), p.getStatus(),
                p.isFeatured(), p.getSortOrder(), p.getYear(), p.getCategory(), p.getDisplayMode(), p.getAccentColor(),
                cover == null ? null : cover.getId(), MediaDto.from(cover),
                p.getCoverVideo() == null ? null : p.getCoverVideo().getId(), MediaDto.from(p.getCoverVideo()),
                p.getRepoUrl(), p.getLiveUrl(),
                p.isAllowIframe(), List.copyOf(p.getStack()), items, p.getCreatedAt(),
                p.getUpdatedAt(), p.getPublishedAt());
    }
}
