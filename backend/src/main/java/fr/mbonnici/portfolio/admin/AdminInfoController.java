package fr.mbonnici.portfolio.admin;

import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.storage.StorageService;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.Arrays;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringBootVersion;
import org.springframework.boot.info.BuildProperties;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Versions and health of every tier, shown on the back-office dashboard. */
@RestController
public class AdminInfoController {

    public record Backend(String version, String buildTime, String gitSha, String javaVersion,
            String springBootVersion, long uptimeSeconds, Instant startedAt, String profiles) {}

    public record Database(String status, String version) {}

    public record Storage(String status, String description) {}

    public record SystemInfo(String os, long memoryUsedMb, long memoryMaxMb, int processors) {}

    public record Info(Backend backend, Database database, Storage storage, SystemInfo system) {}

    private final ObjectProvider<BuildProperties> build;
    private final JdbcTemplate jdbc;
    private final StorageService storage;
    private final AppProperties props;
    private final Environment env;

    public AdminInfoController(ObjectProvider<BuildProperties> build, JdbcTemplate jdbc, StorageService storage,
            AppProperties props, Environment env) {
        this.build = build;
        this.jdbc = jdbc;
        this.storage = storage;
        this.props = props;
        this.env = env;
    }

    @GetMapping("/api/admin/info")
    public Info info() {
        BuildProperties bp = build.getIfAvailable();
        var runtime = ManagementFactory.getRuntimeMXBean();
        Backend backend = new Backend(
                bp == null ? "dev" : bp.getVersion(),
                bp == null || bp.getTime() == null ? null : bp.getTime().toString(),
                props.gitSha().isBlank() ? null : props.gitSha(),
                Runtime.version().toString(),
                SpringBootVersion.getVersion(),
                runtime.getUptime() / 1000,
                Instant.ofEpochMilli(runtime.getStartTime()),
                String.join(",", env.getActiveProfiles().length == 0 ? env.getDefaultProfiles() : env.getActiveProfiles()));

        Database db;
        try {
            String version = jdbc.queryForObject("select version()", String.class);
            db = new Database("ok", version == null ? null : Arrays.stream(version.split(" ")).limit(2)
                    .reduce((a, b) -> a + " " + b).orElse(version));
        } catch (Exception e) {
            db = new Database("error: " + e.getClass().getSimpleName(), null);
        }

        Storage st = new Storage(storage.health(), storage.describe());

        Runtime rt = Runtime.getRuntime();
        SystemInfo sys = new SystemInfo(System.getProperty("os.name") + " " + System.getProperty("os.arch"),
                (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024), rt.maxMemory() / (1024 * 1024),
                rt.availableProcessors());

        return new Info(backend, db, st, sys);
    }
}
