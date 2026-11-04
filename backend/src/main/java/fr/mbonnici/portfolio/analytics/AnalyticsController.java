package fr.mbonnici.portfolio.analytics;

import fr.mbonnici.portfolio.analytics.AnalyticsService.Batch;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** First-party, cookieless beacon endpoint (CSRF-exempt, rate limited). */
@RestController
public class AnalyticsController {

    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @PostMapping("/api/analytics/events")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void collect(@Valid @RequestBody Batch batch, HttpServletRequest request) {
        service.record(batch, request);
    }
}
