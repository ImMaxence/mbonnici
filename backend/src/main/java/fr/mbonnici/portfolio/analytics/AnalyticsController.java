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
    private final VitalsService vitals;

    public AnalyticsController(AnalyticsService service, VitalsService vitals) {
        this.service = service;
        this.vitals = vitals;
    }

    /** Core Web Vitals of one page view (sent with navigator.sendBeacon when the page is hidden). */
    @PostMapping("/api/analytics/vitals")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void vitals(@Valid @RequestBody VitalsService.Beacon beacon, HttpServletRequest request) {
        vitals.record(beacon, request);
    }

    @PostMapping("/api/analytics/events")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void collect(@Valid @RequestBody Batch batch, HttpServletRequest request) {
        service.record(batch, request);
    }
}
