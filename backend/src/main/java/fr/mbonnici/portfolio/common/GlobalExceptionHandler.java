package fr.mbonnici.portfolio.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final fr.mbonnici.portfolio.errors.ErrorLogService errors;

    public GlobalExceptionHandler(fr.mbonnici.portfolio.errors.ErrorLogService errors) {
        this.errors = errors;
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApi(ApiException ex, HttpServletRequest req) {
        if (ex.status().is5xxServerError()) {
            errors.recordServer(ex, req.getRequestURI());
        }
        return build(ex.status(), ex.getMessage(), null, req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        return build(HttpStatus.BAD_REQUEST, "Validation failed", fields, req);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraint(ConstraintViolationException ex, HttpServletRequest req) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(v -> fields.put(v.getPropertyPath().toString(), v.getMessage()));
        return build(HttpStatus.BAD_REQUEST, "Validation failed", fields, req);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> handleUnreadable(Exception ex, HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "Malformed request", null, req);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleTooLarge(MaxUploadSizeExceededException ex, HttpServletRequest req) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "File too large", null, req);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex, HttpServletRequest req) {
        return build(HttpStatus.NOT_FOUND, "Not found", null, req);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleOther(Exception ex, HttpServletRequest req) {
        // Spring's own refusals (wrong method, an Accept it cannot satisfy, missing parameter…) are the
        // client's doing: they keep their status and stay out of the journal
        if (ex instanceof ErrorResponse refused && refused.getStatusCode().is4xxClientError()) {
            HttpStatus status = HttpStatus.valueOf(refused.getStatusCode().value());
            return ResponseEntity.status(status).headers(refused.getHeaders())
                    .body(body(status, status.getReasonPhrase(), null, req));
        }
        log.error("Unhandled error on {} {}", req.getMethod(), req.getRequestURI(), ex);
        // kept for the back office's error log (Journal)
        errors.recordServer(ex, req.getMethod() + " " + req.getRequestURI());
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error", null, req);
    }

    private static ResponseEntity<ApiError> build(HttpStatus status, String message, Map<String, String> fields,
            HttpServletRequest req) {
        return ResponseEntity.status(status).body(body(status, message, fields, req));
    }

    private static ApiError body(HttpStatus status, String message, Map<String, String> fields, HttpServletRequest req) {
        return new ApiError(status.value(), status.getReasonPhrase(), message, fields, req.getRequestURI(), Instant.now());
    }
}
