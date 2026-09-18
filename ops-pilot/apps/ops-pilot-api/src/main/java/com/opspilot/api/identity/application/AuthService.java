package com.opspilot.api.identity.application;

import com.opspilot.api.identity.audit.AuditService;
import com.opspilot.api.identity.domain.IdentityException;
import com.opspilot.api.identity.domain.PasswordPolicy;
import com.opspilot.api.identity.domain.UserAccount;
import com.opspilot.api.identity.domain.UserRepository;
import com.opspilot.api.identity.security.JwtService;
import com.opspilot.api.identity.security.UserPrincipal;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected repository bean")
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final Clock clock;
    private final String dummyPasswordHash;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PasswordPolicy passwordPolicy,
            JwtService jwtService,
            AuditService auditService,
            Clock clock) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.clock = clock;
        this.dummyPasswordHash = passwordEncoder.encode("Dummy-password-not-used-2026!");
    }

    public LoginResult login(String username, String password, String requestId) {
        String normalizedUsername = UserManagementService.normalizeUsername(username);
        Optional<UserAccount> candidate = userRepository.findByUsername(normalizedUsername);
        String passwordHash = candidate.map(UserAccount::passwordHash).orElse(dummyPasswordHash);
        boolean passwordMatches = passwordEncoder.matches(password, passwordHash);
        if (candidate.isEmpty() || !passwordMatches || !candidate.get().enabled()) {
            auditService.recordAuthenticationFailure(normalizedUsername, requestId, "INVALID_CREDENTIALS");
            throw new IdentityException(
                    "INVALID_CREDENTIALS", "Username or password is incorrect", HttpStatus.UNAUTHORIZED);
        }
        UserAccount user = candidate.get();
        JwtService.IssuedToken token = jwtService.issue(user);
        auditService.record(
                "LOGIN", "SUCCESS", user.id(), user.username(), "SESSION", user.id().toString(),
                requestId, null, null, Map.of("expiresAt", token.expiresAt().toString()));
        return new LoginResult(token, UserPrincipal.from(user));
    }

    @Transactional
    public void logout(UserPrincipal principal, String requestId) {
        userRepository.incrementTokenVersion(principal.id(), Instant.now(clock));
        auditService.record(
                "LOGOUT", "SUCCESS", principal.id(), principal.username(), "SESSION",
                principal.id().toString(), requestId, null, null, null);
    }

    @Transactional
    public LoginResult changePassword(
            UserPrincipal principal, String currentPassword, String newPassword, String requestId) {
        UserAccount user = userRepository.findById(principal.id())
                .orElseThrow(() -> new IdentityException(
                        "USER_NOT_FOUND", "User does not exist", HttpStatus.NOT_FOUND));
        if (!passwordEncoder.matches(currentPassword, user.passwordHash())) {
            auditService.recordFailure(
                    "PASSWORD_CHANGE", user.id(), user.username(), "USER",
                    user.id().toString(), requestId, "CURRENT_PASSWORD_INVALID");
            throw new IdentityException(
                    "CURRENT_PASSWORD_INVALID", "Current password is incorrect", HttpStatus.UNAUTHORIZED);
        }
        passwordPolicy.validate(newPassword);
        if (passwordEncoder.matches(newPassword, user.passwordHash())) {
            throw new IdentityException(
                    "PASSWORD_REUSE_NOT_ALLOWED", "New password must be different from the current password");
        }
        userRepository.updatePassword(user.id(), passwordEncoder.encode(newPassword), false, Instant.now(clock));
        UserAccount updated = userRepository.findById(user.id()).orElseThrow();
        auditService.record(
                "PASSWORD_CHANGE", "SUCCESS", user.id(), user.username(), "USER",
                user.id().toString(), requestId, null,
                Map.of("mustChangePassword", user.mustChangePassword()),
                Map.of("mustChangePassword", false));
        return new LoginResult(jwtService.issue(updated), UserPrincipal.from(updated));
    }

    public record LoginResult(JwtService.IssuedToken token, UserPrincipal principal) {
    }
}
