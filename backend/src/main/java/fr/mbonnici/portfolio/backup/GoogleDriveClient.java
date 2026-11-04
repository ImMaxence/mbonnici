package fr.mbonnici.portfolio.backup;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Minimal Google Drive v3 client (files created by this app only — {@code drive.file} scope).
 * Plain REST through Spring's RestClient: no Google SDK, resumable chunked uploads for large archives.
 */
@Component
public class GoogleDriveClient {

    private static final String API = "https://www.googleapis.com/drive/v3";
    private static final String UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
    private static final String FOLDER_MIME = "application/vnd.google-apps.folder";
    private static final int CHUNK = 16 * 1024 * 1024; // multiple of 256 KiB as Drive requires
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};

    public record DriveFile(String id, String name, Long size, Instant createdTime) {}

    public record Account(String email, String displayName, Long quotaLimit, Long quotaUsage) {}

    private final RestClient http = RestClient.builder().build();

    public Account about(String token) {
        Map<String, Object> res = http.get()
                .uri(API + "/about?fields=user(emailAddress,displayName),storageQuota(limit,usage)")
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .retrieve()
                .body(MAP);
        Map<?, ?> user = res == null ? Map.of() : (Map<?, ?>) res.getOrDefault("user", Map.of());
        Map<?, ?> quota = res == null ? Map.of() : (Map<?, ?>) res.getOrDefault("storageQuota", Map.of());
        return new Account(str(user.get("emailAddress")), str(user.get("displayName")), num(quota.get("limit")),
                num(quota.get("usage")));
    }

    public String findOrCreateFolder(String token, String name) {
        String q = "name = '" + name.replace("'", "\\'") + "' and mimeType = '" + FOLDER_MIME + "' and trashed = false";
        Map<String, Object> found = http.get()
                .uri(API + "/files?q={q}&fields=files(id,name)&spaces=drive", q)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .retrieve()
                .body(MAP);
        List<?> files = found == null ? List.of() : (List<?>) found.getOrDefault("files", List.of());
        if (!files.isEmpty()) {
            return str(((Map<?, ?>) files.get(0)).get("id"));
        }
        Map<String, Object> created = http.post()
                .uri(API + "/files?fields=id")
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", name, "mimeType", FOLDER_MIME))
                .retrieve()
                .body(MAP);
        return str(created == null ? null : created.get("id"));
    }

    public List<DriveFile> list(String token, String folderId) {
        String q = "'" + folderId + "' in parents and trashed = false";
        Map<String, Object> res = http.get()
                .uri(API + "/files?q={q}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=100", q)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .retrieve()
                .body(MAP);
        List<DriveFile> out = new ArrayList<>();
        List<?> files = res == null ? List.of() : (List<?>) res.getOrDefault("files", List.of());
        for (Object o : files) {
            Map<?, ?> f = (Map<?, ?>) o;
            out.add(new DriveFile(str(f.get("id")), str(f.get("name")), num(f.get("size")), instant(f.get("createdTime"))));
        }
        return out;
    }

    /** Resumable upload in 16 MiB chunks; returns the created file. */
    public DriveFile upload(String token, String folderId, String name, Path file) throws IOException {
        long size = Files.size(file);
        var init = http.post()
                .uri(UPLOAD + "?uploadType=resumable&fields=id,name,size,createdTime")
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .header("X-Upload-Content-Type", "application/zip")
                .header("X-Upload-Content-Length", Long.toString(size))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", name, "parents", List.of(folderId), "mimeType", "application/zip"))
                .retrieve()
                .toBodilessEntity();
        String session = init.getHeaders().getFirst(HttpHeaders.LOCATION);
        if (session == null) {
            throw new IOException("Drive did not return a resumable upload session");
        }

        byte[] buffer = new byte[CHUNK];
        long offset = 0;
        try (InputStream in = Files.newInputStream(file)) {
            while (offset < size) {
                int wanted = (int) Math.min(CHUNK, size - offset);
                int read = in.readNBytes(buffer, 0, wanted);
                if (read <= 0) {
                    throw new IOException("Unexpected end of archive at offset " + offset);
                }
                byte[] chunk = read == buffer.length ? buffer : Arrays.copyOf(buffer, read);
                long end = offset + read - 1;
                final long chunkStart = offset;
                DriveFile done = http.put()
                        .uri(session)
                        .header("Content-Range", "bytes " + chunkStart + "-" + end + "/" + size)
                        .contentType(MediaType.APPLICATION_OCTET_STREAM)
                        .body(chunk)
                        .exchange((request, response) -> {
                            int code = response.getStatusCode().value();
                            if (code == 308) {
                                return null; // resume incomplete: keep going
                            }
                            if (code == 200 || code == 201) {
                                Map<String, Object> body = response.bodyTo(MAP);
                                return new DriveFile(str(body.get("id")), str(body.get("name")), num(body.get("size")),
                                        instant(body.get("createdTime")));
                            }
                            throw new IOException("Drive upload failed with HTTP " + code);
                        });
                offset = end + 1;
                if (done != null) {
                    return done;
                }
            }
        }
        throw new IOException("Drive upload ended without a completion response");
    }

    public void download(String token, String fileId, OutputStream out) {
        http.get()
                .uri(API + "/files/{id}?alt=media", fileId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .exchange((request, response) -> {
                    if (!response.getStatusCode().is2xxSuccessful()) {
                        throw new IOException("Drive download failed with HTTP " + response.getStatusCode().value());
                    }
                    try (InputStream in = response.getBody()) {
                        in.transferTo(out);
                    }
                    return null;
                });
    }

    public void delete(String token, String fileId) {
        http.delete()
                .uri(API + "/files/{id}", fileId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .retrieve()
                .toBodilessEntity();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static Long num(Object o) {
        if (o == null) return null;
        try {
            return Long.parseLong(o.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Instant instant(Object o) {
        try {
            return o == null ? null : Instant.parse(o.toString());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
