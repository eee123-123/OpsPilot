package com.opspilot.api.identity.security;

import com.opspilot.api.identity.audit.AuditService;
import com.opspilot.api.identity.domain.UserAccount;
import com.opspilot.api.identity.domain.UserRepository;
import com.opspilot.api.web.ProblemResponseWriter;
import com.opspilot.api.web.RequestIdFilter;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.Objects;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected repository bean")
    private final UserRepository userRepository;
    private final AuditService auditService;
    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected response writer")
    private final ProblemResponseWriter problemWriter;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UserRepository userRepository,
            AuditService auditService,
            ProblemResponseWriter problemWriter) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.problemWriter = problemWriter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            authenticate(request, authorization.substring(BEARER_PREFIX.length()));
            filterChain.doFilter(request, response);
        } catch (JwtException | IllegalArgumentException exception) {
            SecurityContextHolder.clearContext();
            String requestId = RequestIdFilter.currentRequestId(request);
            auditService.recordAuthenticationFailure("unknown", requestId, "SESSION_INVALID");
            problemWriter.write(
                    request, response, 401, "Unauthorized", "Session is invalid or expired", "SESSION_INVALID");
        }
    }

    private void authenticate(HttpServletRequest request, String token) {
        Jwt jwt = jwtService.decode(token);
        String subject = Objects.requireNonNull(jwt.getSubject(), "JWT subject is required");
        Optional<UserAccount> optionalUser = userRepository.findById(java.util.UUID.fromString(subject));
        UserAccount user = optionalUser.orElseThrow(() -> new IllegalArgumentException("Unknown user"));
        Number tokenVersion = jwt.getClaim("ver");
        String tokenUsername = jwt.getClaimAsString("username");
        if (!user.enabled()
                || tokenVersion == null
                || tokenVersion.longValue() != user.tokenVersion()
                || !user.username().equals(tokenUsername)) {
            throw new IllegalArgumentException("Token no longer represents the current user state");
        }
        UserPrincipal principal = UserPrincipal.from(user);
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
