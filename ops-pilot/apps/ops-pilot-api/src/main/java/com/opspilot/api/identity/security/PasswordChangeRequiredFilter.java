package com.opspilot.api.identity.security;

import com.opspilot.api.identity.audit.AuditService;
import com.opspilot.api.web.ProblemResponseWriter;
import com.opspilot.api.web.RequestIdFilter;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {

    private static final Set<String> ALLOWED_PATHS = Set.of(
            "/api/v1/auth/me",
            "/api/v1/auth/change-password",
            "/api/v1/auth/logout");

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected response writer")
    private final ProblemResponseWriter problemWriter;
    private final AuditService auditService;

    public PasswordChangeRequiredFilter(ProblemResponseWriter problemWriter, AuditService auditService) {
        this.problemWriter = problemWriter;
        this.auditService = auditService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof UserPrincipal principal
                && principal.mustChangePassword()
                && request.getRequestURI().startsWith("/api/v1/")
                && !ALLOWED_PATHS.contains(request.getRequestURI())) {
            String requestId = RequestIdFilter.currentRequestId(request);
            auditService.record(
                    "AUTHORIZATION_FAILURE", "DENIED", principal.id(), principal.username(),
                    "API", request.getRequestURI(), requestId, "PASSWORD_CHANGE_REQUIRED", null, null);
            problemWriter.write(
                    request, response, 403, "Forbidden",
                    "Password must be changed before using this operation", "PASSWORD_CHANGE_REQUIRED");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
