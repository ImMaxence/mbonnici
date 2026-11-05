package fr.mbonnici.portfolio.admin;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Live resource usage: CPU and memory of the application and of the server (sampled by
 * {@link SystemSampler}), disk of the filesystem the container runs on, plus what the application
 * stores (database and media).
 */
@RestController
public class SystemInfoController {

    public record Cpu(double processLoad, double systemLoad, int cores) {}

    /** usedMb is the whole server, appMb what the application (backend container) holds */
    public record Memory(long totalMb, long usedMb, long freeMb, long appMb, long jvmHeapUsedMb, long jvmHeapMaxMb) {}

    public record Disk(String path, long totalMb, long usedMb, long freeMb) {}

    public record Data(long databaseBytes, long mediaBytes, long mediaCount, long analyticsEvents) {}

    public record SystemInfo(Cpu cpu, Memory memory, Disk disk, Data data, long uptimeSeconds, Instant sampledAt) {}

    private final JdbcTemplate jdbc;
    private final SystemSampler sampler;

    public SystemInfoController(JdbcTemplate jdbc, SystemSampler sampler) {
        this.jdbc = jdbc;
        this.sampler = sampler;
    }

    /** the CPU and memory samples (one every 2 s, 15 minutes kept) taken after {@code since} */
    @GetMapping("/api/admin/system/live")
    public List<SystemSampler.Sample> live(@RequestParam(defaultValue = "0") long since) {
        return sampler.since(since);
    }

    @GetMapping("/api/admin/system")
    public SystemInfo info() {
        SystemSampler.Sample s = sampler.latest();
        if (s == null) {
            sampler.sample();
            s = sampler.latest();
        }
        Runtime rt = Runtime.getRuntime();
        long heap = mb(rt.totalMemory() - rt.freeMemory());
        Cpu cpu = s == null ? new Cpu(0, 0, sampler.cores()) : new Cpu(s.appCpu(), s.serverCpu(), sampler.cores());
        Memory memory = s == null
                ? new Memory(0, 0, 0, 0, heap, mb(rt.maxMemory()))
                : new Memory(s.serverTotalMb(), s.serverMemMb(), s.serverTotalMb() - s.serverMemMb(), s.appMemMb(), heap,
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

    private static long mb(long bytes) {
        return bytes / (1024 * 1024);
    }
}
