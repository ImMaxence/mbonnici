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

    public AdminAnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public Overview overview(@RequestParam(defaultValue = "30") int days) {
        return service.overview(days);
    }
}
