package com.opspilot.api.web;

import com.opspilot.api.identity.domain.IdentityException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IdentityException.class)
    ResponseEntity<ProblemDetail> handleIdentity(IdentityException exception, HttpServletRequest request) {
        return problem(exception.status(), exception.errorCode(), exception.getMessage(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleValidation(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        String detail = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", detail, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ProblemDetail> handleConstraint(
            ConstraintViolationException exception, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", exception.getMessage(), request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> handleConflict(
            DataIntegrityViolationException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "RESOURCE_CONFLICT", "Resource already exists", request);
    }

    private ResponseEntity<ProblemDetail> problem(
            HttpStatus status, String errorCode, String detail, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(status.getReasonPhrase());
        problem.setType(URI.create(
                "https://ops-pilot.local/problems/" + errorCode.toLowerCase(Locale.ROOT)));
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", errorCode);
        problem.setProperty("requestId", RequestIdFilter.currentRequestId(request));
        return ResponseEntity.status(status).body(problem);
    }
}
