package com.opspilot.api.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Request-ID";
    public static final String ATTRIBUTE_NAME = "opspilot.requestId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String supplied = request.getHeader(HEADER_NAME);
        String requestId = normalizeOrCreate(supplied);
        request.setAttribute(ATTRIBUTE_NAME, requestId);
        response.setHeader(HEADER_NAME, requestId);
        filterChain.doFilter(request, response);
    }

    public static String currentRequestId(HttpServletRequest request) {
        Object value = request.getAttribute(ATTRIBUTE_NAME);
        return value instanceof String requestId ? requestId : "unknown";
    }

    private static String normalizeOrCreate(String supplied) {
        if (supplied != null) {
            try {
                return UUID.fromString(supplied).toString();
            } catch (IllegalArgumentException exception) {
                // Untrusted request identifiers are replaced instead of reflected into a response header.
            }
        }
        return UUID.randomUUID().toString();
    }
}
