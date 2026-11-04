package fr.mbonnici.portfolio.common;

import java.time.Instant;
import java.util.Map;

/** Uniform JSON error body. */
public record ApiError(
        int status,
        String error,
        String message,
        Map<String, String> fields,
        String path,
        Instant timestamp) {

    public static ApiError of(int status, String error, String message, String path) {
        return new ApiError(status, error, message, null, path, Instant.now());
    }
}
