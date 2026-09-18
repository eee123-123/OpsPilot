package com.opspilot.api.identity.application;

import com.opspilot.api.identity.audit.AuditService;
import com.opspilot.api.identity.domain.IdentityException;
import com.opspilot.api.identity.domain.PasswordPolicy;
import com.opspilot.api.identity.domain.RoleName;
import com.opspilot.api.identity.domain.UserAccount;
import com.opspilot.api.identity.domain.UserRepository;
import com.opspilot.api.identity.infrastructure.IdentityIdempotencyRepository;
import com.opspilot.api.identity.infrastructure.IdentityIdempotencyRepository.IdempotencyRecord;
import com.opspilot.api.identity.security.UserPrincipal;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserManagementService {

    private static final Pattern USERNAME_PATTERN = Pattern.compile("[a-z0-9][a-z0-9._-]{2,63}");
    private static final Pattern IDEMPOTENCY_KEY_PATTERN = Pattern.compile("[A-Za-z0-9._:-]{8,128}");

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected repository bean")
    private final UserRepository userRepository;
    private final IdentityIdempotencyRepository idempotencyRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final AuditService auditService;
    private final Clock clock;

    public UserManagementService(
            UserRepository userRepository,
            IdentityIdempotencyRepository idempotencyRepository,
            PasswordEncoder passwordEncoder,
            PasswordPolicy passwordPolicy,
            AuditService auditService,
            Clock clock) {
        this.userRepository = userRepository;
        this.idempotencyRepository = idempotencyRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.auditService = auditService;
        this.clock = clock;
    }

    public UserPage list(int page, int size, String query, String sort) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IdentityException("INVALID_PAGE", "Page must be >= 0 and size must be between 1 and 100");
        }
        SortOrder order = SortOrder.parse(sort);
        List<UserAccount> users = userRepository.findPage(
                Math.multiplyExact(page, size), size, query, order.property(), order.ascending());
        return new UserPage(users, page, size, userRepository.count(query));
    }

    @Transactional
    public UserAccount create(
            CreateUserCommand command, String idempotencyKey, UserPrincipal actor, String requestId) {
        validateIdempotencyKey(idempotencyKey);
        String username = normalizeUsername(command.username());
        validateUsername(username);
        validateDisplayName(command.displayName());
        validateRoles(command.roles());
        passwordPolicy.validate(command.temporaryPassword());
        String fingerprint = fingerprint(
                username, command.displayName().trim(), command.temporaryPassword(), sortedRoles(command.roles()));
        UserAccount replay = replayOrNull(actor.id(), "CREATE_USER", idempotencyKey, fingerprint);
        if (replay != null) {
            return replay;
        }
        if (userRepository.findByUsername(username).isPresent()) {
            throw new IdentityException("USERNAME_EXISTS", "Username already exists", HttpStatus.CONFLICT);
        }
        Instant now = Instant.now(clock);
        UserAccount user = new UserAccount(
                UUID.randomUUID(), username, command.displayName().trim(),
                passwordEncoder.encode(command.temporaryPassword()), true, true, 0, now, now, command.roles());
        userRepository.create(user);
        idempotencyRepository.save(actor.id(), "CREATE_USER", idempotencyKey, fingerprint, user.id(), now);
        auditService.record(
                "USER_CREATED", "SUCCESS", actor.id(), actor.username(), "USER", user.id().toString(),
                requestId, null, null, snapshot(user));
        return user;
    }

    @Transactional
    public UserAccount changeStatus(
            UUID userId, boolean enabled, UserPrincipal actor, String requestId) {
        UserAccount user = findRequired(userId);
        if (user.id().equals(actor.id()) && !enabled) {
            throw new IdentityException("SELF_DISABLE_NOT_ALLOWED", "You cannot disable your own account");
        }
        if (!enabled && user.enabled() && user.roles().contains(RoleName.ADMIN)
                && userRepository.countEnabledByRole(RoleName.ADMIN) <= 1) {
            throw new IdentityException("LAST_ADMIN_REQUIRED", "The last enabled administrator cannot be disabled");
        }
        if (user.enabled() == enabled) {
            return user;
        }
        userRepository.updateStatus(userId, enabled, Instant.now(clock));
        UserAccount updated = findRequired(userId);
        auditService.record(
                enabled ? "USER_ENABLED" : "USER_DISABLED", "SUCCESS",
                actor.id(), actor.username(), "USER", userId.toString(), requestId, null,
                snapshot(user), snapshot(updated));
        return updated;
    }

    @Transactional
    public UserAccount resetPassword(
            UUID userId,
            String temporaryPassword,
            String idempotencyKey,
            UserPrincipal actor,
            String requestId) {
        validateIdempotencyKey(idempotencyKey);
        passwordPolicy.validate(temporaryPassword);
        UserAccount user = findRequired(userId);
        String fingerprint = fingerprint(userId.toString(), temporaryPassword);
        UserAccount replay = replayOrNull(actor.id(), "RESET_PASSWORD", idempotencyKey, fingerprint);
        if (replay != null) {
            return replay;
        }
        userRepository.updatePassword(
                userId, passwordEncoder.encode(temporaryPassword), true, Instant.now(clock));
        UserAccount updated = findRequired(userId);
        idempotencyRepository.save(
                actor.id(), "RESET_PASSWORD", idempotencyKey, fingerprint, userId, Instant.now(clock));
        auditService.record(
                "PASSWORD_RESET", "SUCCESS", actor.id(), actor.username(), "USER",
                userId.toString(), requestId, null,
                Map.of("mustChangePassword", user.mustChangePassword()),
                Map.of("mustChangePassword", true));
        return updated;
    }

    @Transactional
    public UserAccount replaceRoles(
            UUID userId, Set<RoleName> roles, UserPrincipal actor, String requestId) {
        validateRoles(roles);
        UserAccount user = findRequired(userId);
        if (user.id().equals(actor.id()) && !roles.contains(RoleName.ADMIN)) {
            throw new IdentityException("SELF_ADMIN_REMOVAL_NOT_ALLOWED", "You cannot remove your own admin role");
        }
        if (user.enabled() && user.roles().contains(RoleName.ADMIN) && !roles.contains(RoleName.ADMIN)
                && userRepository.countEnabledByRole(RoleName.ADMIN) <= 1) {
            throw new IdentityException("LAST_ADMIN_REQUIRED", "The last enabled administrator must keep ADMIN");
        }
        if (user.roles().equals(roles)) {
            return user;
        }
        userRepository.replaceRoles(userId, Set.copyOf(roles), Instant.now(clock));
        UserAccount updated = findRequired(userId);
        auditService.record(
                "USER_ROLES_CHANGED", "SUCCESS", actor.id(), actor.username(), "USER",
                userId.toString(), requestId, null, snapshot(user), snapshot(updated));
        return updated;
    }

    public static String normalizeUsername(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private UserAccount replayOrNull(UUID actorId, String operation, String key, String fingerprint) {
        return idempotencyRepository.find(actorId, operation, key)
                .map(record -> validateReplay(record, fingerprint))
                .orElse(null);
    }

    private UserAccount validateReplay(IdempotencyRecord record, String fingerprint) {
        if (!record.fingerprint().equals(fingerprint)) {
            throw new IdentityException(
                    "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was already used for a different request",
                    HttpStatus.CONFLICT);
        }
        return findRequired(record.targetUserId());
    }

    private UserAccount findRequired(UUID id) {
        return userRepository.findById(id).orElseThrow(() -> new IdentityException(
                "USER_NOT_FOUND", "User does not exist", HttpStatus.NOT_FOUND));
    }

    private static void validateUsername(String username) {
        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw new IdentityException(
                    "INVALID_USERNAME", "Username must be 3-64 lowercase letters, digits, dot, underscore or hyphen");
        }
    }

    private static void validateDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank() || displayName.trim().length() > 100) {
            throw new IdentityException("INVALID_DISPLAY_NAME", "Display name must be 1-100 characters");
        }
    }

    private static void validateRoles(Set<RoleName> roles) {
        if (roles == null || roles.isEmpty()) {
            throw new IdentityException("ROLES_REQUIRED", "At least one role is required");
        }
    }

    private static void validateIdempotencyKey(String key) {
        if (key == null || !IDEMPOTENCY_KEY_PATTERN.matcher(key).matches()) {
            throw new IdentityException(
                    "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8-128 safe characters");
        }
    }

    private static String sortedRoles(Set<RoleName> roles) {
        return roles.stream().map(Enum::name).sorted().reduce((left, right) -> left + "," + right).orElse("");
    }

    private static String fingerprint(String... values) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String value : values) {
                digest.update(value.getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the Java platform", exception);
        }
    }

    private static Map<String, Object> snapshot(UserAccount user) {
        return Map.of(
                "username", user.username(),
                "displayName", user.displayName(),
                "enabled", user.enabled(),
                "mustChangePassword", user.mustChangePassword(),
                "roles", sortedRoles(user.roles()));
    }

    public record CreateUserCommand(
            String username, String displayName, String temporaryPassword, Set<RoleName> roles) {

        public CreateUserCommand {
            roles = roles == null ? null : Set.copyOf(roles);
        }
    }

    public record UserPage(List<UserAccount> users, int page, int size, long totalElements) {

        public UserPage {
            users = List.copyOf(users);
        }
    }

    private record SortOrder(String property, boolean ascending) {

        private static SortOrder parse(String value) {
            String normalized = value == null || value.isBlank() ? "username,asc" : value;
            String[] parts = normalized.split(",", -1);
            if (parts.length != 2
                    || !Set.of("username", "displayName", "createdAt", "enabled").contains(parts[0])
                    || !Set.of("asc", "desc").contains(parts[1].toLowerCase(Locale.ROOT))) {
                throw new IdentityException("INVALID_SORT", "Sort must be property,(asc|desc)");
            }
            return new SortOrder(parts[0], "asc".equalsIgnoreCase(parts[1]));
        }
    }
}
