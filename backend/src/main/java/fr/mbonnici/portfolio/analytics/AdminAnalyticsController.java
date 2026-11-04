package fr.mbonnici.portfolio.analytics;

import fr.mbonnici.portfolio.analytics.AnalyticsService.Overview;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/analytics")
public class AdminAnalyticsController {

    private final AnalyticsService service;
    private final VitalsService vitals;

    public AdminAnalyticsController(AnalyticsService service, VitalsService vitals) {
        this.service = service;
        this.vitals = vitals;
    }

    @GetMapping("/vitals")
    public VitalsService.Overview vitals(@RequestParam(defaultValue = "30") int days) {
        return vitals.overview(days);
    }

    @GetMapping("/overview")
    public Overview overview(@RequestParam(defaultValue = "30") int days) {
        return service.overview(days);
    }
}
