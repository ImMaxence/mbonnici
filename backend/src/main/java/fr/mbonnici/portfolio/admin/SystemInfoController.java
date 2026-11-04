package fr.mbonnici.portfolio.admin;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Live resource usage as seen from the backend container: CPU, memory, disk of the filesystem the
 * container runs on, plus what the application itself occupies (database and media).
 */
@RestController
public class SystemInfoController {

    public record Cpu(double processLoad, double systemLoad, int cores) {}

    public record Memory(long totalMb, long usedMb, long freeMb, long jvmHeapUsedMb, long jvmHeapMaxMb) {}

    public record Disk(String path, long totalMb, long usedMb, long freeMb) {}

    public record Data(long databaseBytes, long mediaBytes, long mediaCount, long analyticsEvents) {}

    public record SystemInfo(Cpu cpu, Memory memory, Disk disk, Data data, long uptimeSeconds, Instant sampledAt) {}

    private final JdbcTemplate jdbc;

    public SystemInfoController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/admin/system")
    public SystemInfo info() {
        var os = (com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
        Cpu cpu = new Cpu(clamp(os.getProcessCpuLoad()), clamp(os.getCpuLoad()), os.getAvailableProcessors());

        long total = os.getTotalMemorySize();
        long free = os.getFreeMemorySize();
        Runtime rt = Runtime.getRuntime();
        Memory memory = new Memory(mb(total), mb(total - free), mb(free), mb(rt.totalMemory() - rt.freeMemory()),
                mb(rt.maxMemory()));

        Disk disk = disk();

        long db = queryLong("select pg_database_size(current_database())");
        long mediaBytes = queryLong("select coalesce(sum(size_bytes), 0) from media");
        long mediaCount = queryLong("select count(*) from media");
        long events = queryLong("select count(*) from analytics_event");
        Data data = new Data(db, mediaBytes, mediaCount, events);

        return new SystemInfo(cpu, memory, disk, data, ManagementFactory.getRuntimeMXBean().getUptime() / 1000,
                Instant.now());
    }

    private Disk disk() {
        Path root = Paths.get(System.getProperty("user.dir")).toAbsolutePath().getRoot();
        if (root == null) {
            root = Paths.get("/");
        }
        try {
            FileStore store = Files.getFileStore(root);
            long total = store.getTotalSpace();
            long usable = store.getUsableSpace();
            return new Disk(root.toString(), mb(total), mb(total - usable), mb(usable));
        } catch (IOException e) {
            return new Disk(root.toString(), 0, 0, 0);
        }
    }

    private long queryLong(String sql) {
        try {
            Long v = jdbc.queryForObject(sql, Long.class);
            return v == null ? 0 : v;
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static double clamp(double v) {
        return v < 0 || Double.isNaN(v) ? 0 : Math.min(1, v);
    }

    private static long mb(long bytes) {
        return bytes / (1024 * 1024);
    }
}
