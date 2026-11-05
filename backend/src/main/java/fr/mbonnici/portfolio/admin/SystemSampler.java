package fr.mbonnici.portfolio.admin;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Samples CPU and memory every two seconds, for the application (the backend container) and for the
 * whole server, and keeps the last fifteen minutes in memory for the dashboard's live charts.
 *
 * <p>On Linux the figures come straight from the kernel: {@code /proc/stat} and {@code /proc/meminfo}
 * describe the host (a container sees the host's values there), the container's own cgroup gives what
 * the application uses (the Java process plus the {@code cwebp} conversions it starts). Anywhere else
 * (a developer machine without Docker) the JVM's operating-system bean is used instead.
 */
@Component
public class SystemSampler {

    /** One measurement: loads are 0..1 of the whole server, memory in MB. */
    public record Sample(long t, double appCpu, double serverCpu, long appMemMb, long serverMemMb, long serverTotalMb) {}

    static final int CAPACITY = 450; // 15 minutes at one sample every 2 s

    private static final Path PROC_STAT = Path.of("/proc/stat");
    private static final Path MEMINFO = Path.of("/proc/meminfo");
    private static final Path CG2_CPU = Path.of("/sys/fs/cgroup/cpu.stat");
    private static final Path CG2_MEM = Path.of("/sys/fs/cgroup/memory.current");
    private static final Path CG2_MEM_STAT = Path.of("/sys/fs/cgroup/memory.stat");
    private static final Path CG1_CPU = Path.of("/sys/fs/cgroup/cpuacct/cpuacct.usage");
    private static final Path CG1_MEM = Path.of("/sys/fs/cgroup/memory/memory.usage_in_bytes");
    private static final Path CG1_MEM_STAT = Path.of("/sys/fs/cgroup/memory/memory.stat");
    private static final Path SELF_STATUS = Path.of("/proc/self/status");

    private final ArrayDeque<Sample> samples = new ArrayDeque<>(CAPACITY);
    private final com.sun.management.OperatingSystemMXBean os =
            (com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();

    // previous readings, to turn cumulative counters into loads
    private long[] lastHostCpu; // {busy, total} in jiffies
    private long lastAppCpuNanos = -1;
    private long lastAppWallNanos;
    private int hostCores;

    public SystemSampler() {
        sample(); // primes the counters so the first scheduled sample already has a load
    }

    @Scheduled(fixedRate = 2_000)
    public void sample() {
        Sample s;
        try {
            long now = System.currentTimeMillis();
            double serverCpu = serverCpu();
            double appCpu = appCpu();
            long[] mem = serverMemory();
            long appMem = appMemory();
            s = new Sample(now, appCpu, serverCpu, mb(appMem), mb(mem[1]), mb(mem[0]));
        } catch (RuntimeException e) { // an unexpected /proc format must not break the scheduler
            return;
        }
        synchronized (samples) {
            if (samples.size() == CAPACITY) {
                samples.removeFirst();
            }
            samples.addLast(s);
        }
    }

    /** samples taken strictly after {@code since} (epoch milliseconds), oldest first */
    public List<Sample> since(long since) {
        synchronized (samples) {
            List<Sample> out = new ArrayList<>();
            for (Sample s : samples) {
                if (s.t() > since) {
                    out.add(s);
                }
            }
            return out;
        }
    }

    public Sample latest() {
        synchronized (samples) {
            return samples.peekLast();
        }
    }

    /** logical processors of the server (not the container's limit) */
    public int cores() {
        return hostCores > 0 ? hostCores : os.getAvailableProcessors();
    }

    // ── CPU ───────────────────────────────────────────────────────────────

    private double serverCpu() {
        List<String> lines = read(PROC_STAT);
        if (lines.isEmpty() || !lines.getFirst().startsWith("cpu ")) {
            return clamp(os.getCpuLoad());
        }
        hostCores = (int) lines.stream().filter(l -> l.matches("^cpu\\d+ .*")).count();
        String[] f = lines.getFirst().trim().split("\\s+");
        long total = 0;
        for (int i = 1; i < f.length && i <= 8; i++) { // user nice system idle iowait irq softirq steal
            total += Long.parseLong(f[i]);
        }
        long idle = Long.parseLong(f[4]) + (f.length > 5 ? Long.parseLong(f[5]) : 0);
        long[] now = {total - idle, total};
        long[] before = lastHostCpu;
        lastHostCpu = now;
        if (before == null || now[1] <= before[1]) {
            return 0;
        }
        return clamp((double) (now[0] - before[0]) / (now[1] - before[1]));
    }

    private double appCpu() {
        long used = cgroupCpuNanos();
        if (used < 0) {
            return clamp(os.getProcessCpuLoad());
        }
        long wall = System.nanoTime();
        long prevUsed = lastAppCpuNanos;
        long prevWall = lastAppWallNanos;
        lastAppCpuNanos = used;
        lastAppWallNanos = wall;
        if (prevUsed < 0 || wall <= prevWall) {
            return 0;
        }
        return clamp((double) (used - prevUsed) / ((double) (wall - prevWall) * cores()));
    }

    /** CPU time used by this container since it started, in nanoseconds, or -1 without cgroups */
    private static long cgroupCpuNanos() {
        for (String l : read(CG2_CPU)) {
            if (l.startsWith("usage_usec ")) {
                return Long.parseLong(l.substring(11).trim()) * 1_000;
            }
        }
        List<String> v1 = read(CG1_CPU);
        return v1.isEmpty() ? -1 : Long.parseLong(v1.getFirst().trim());
    }

    // ── memory ────────────────────────────────────────────────────────────

    /** {total, used} of the server in bytes; "used" leaves out reclaimable caches, like free(1) */
    private long[] serverMemory() {
        long total = -1;
        long available = -1;
        for (String l : read(MEMINFO)) {
            if (l.startsWith("MemTotal:")) {
                total = kb(l);
            } else if (l.startsWith("MemAvailable:")) {
                available = kb(l);
            }
        }
        if (total > 0 && available >= 0) {
            return new long[] {total, total - available};
        }
        long t = os.getTotalMemorySize();
        return new long[] {t, t - os.getFreeMemorySize()};
    }

    /** what the application holds in memory, in bytes (page cache it could give back excluded) */
    private static long appMemory() {
        long v2 = cgroupMemory(CG2_MEM, CG2_MEM_STAT, "inactive_file ");
        if (v2 >= 0) {
            return v2;
        }
        long v1 = cgroupMemory(CG1_MEM, CG1_MEM_STAT, "total_inactive_file ");
        if (v1 >= 0) {
            return v1;
        }
        for (String l : read(SELF_STATUS)) {
            if (l.startsWith("VmRSS:")) {
                return kb(l);
            }
        }
        Runtime rt = Runtime.getRuntime();
        return rt.totalMemory();
    }

    private static long cgroupMemory(Path usage, Path stat, String inactiveKey) {
        List<String> u = read(usage);
        if (u.isEmpty() || u.getFirst().isBlank() || "max".equals(u.getFirst().trim())) {
            return -1;
        }
        long used = Long.parseLong(u.getFirst().trim());
        for (String l : read(stat)) {
            if (l.startsWith(inactiveKey)) {
                used -= Long.parseLong(l.substring(inactiveKey.length()).trim());
                break;
            }
        }
        return Math.max(0, used);
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private static List<String> read(Path p) {
        try {
            return Files.isReadable(p) ? Files.readAllLines(p) : List.of();
        } catch (IOException | RuntimeException e) {
            return List.of();
        }
    }

    /** "MemTotal:  16314536 kB" → bytes */
    private static long kb(String line) {
        String[] f = line.trim().split("\\s+");
        return f.length > 1 ? Long.parseLong(f[1]) * 1024 : 0;
    }

    private static double clamp(double v) {
        return v < 0 || Double.isNaN(v) ? 0 : Math.min(1, v);
    }

    private static long mb(long bytes) {
        return bytes / (1024 * 1024);
    }
}
