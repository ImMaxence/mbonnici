package fr.mbonnici.portfolio.insights;

import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InsightsController {

    private final InsightsService service;

    public InsightsController(InsightsService service) {
        this.service = service;
    }

    /** slug → live status of the site and GitHub figures, for the published projects. */
    @GetMapping("/api/insights")
    public ResponseEntity<Map<String, InsightsService.Insight>> all() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic())
                .body(service.all());
    }
}
