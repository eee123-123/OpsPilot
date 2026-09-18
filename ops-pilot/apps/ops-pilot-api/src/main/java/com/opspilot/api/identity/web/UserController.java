package com.opspilot.api.identity.web;

import com.opspilot.api.identity.application.UserManagementService;
import com.opspilot.api.identity.application.UserManagementService.CreateUserCommand;
import com.opspilot.api.identity.application.UserManagementService.UserPage;
import com.opspilot.api.identity.domain.RoleName;
import com.opspilot.api.identity.domain.UserAccount;
import com.opspilot.api.identity.security.UserPrincipal;
import com.opspilot.api.web.RequestIdFilter;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected service bean")
    private final UserManagementService userManagementService;

    public UserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @GetMapping
    UserPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "username,asc") String sort) {
        return UserPageResponse.from(userManagementService.list(page, size, query, sort));
    }

    @PostMapping
    ResponseEntity<UserResponse> create(
            @Valid @RequestBody CreateUserRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest) {
        UserAccount user = userManagementService.create(
                new CreateUserCommand(
                        request.username(), request.displayName(), request.temporaryPassword(), request.roles()),
                idempotencyKey,
                principal,
                RequestIdFilter.currentRequestId(servletRequest));
        return ResponseEntity.created(URI.create("/api/v1/users/" + user.id()))
                .body(UserResponse.from(user));
    }

    @PatchMapping("/{id}/status")
    UserResponse changeStatus(
            @PathVariable UUID id,
            @Valid @RequestBody ChangeStatusRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest) {
        return UserResponse.from(userManagementService.changeStatus(
                id, request.enabled(), principal, RequestIdFilter.currentRequestId(servletRequest)));
    }

    @PostMapping("/{id}/reset-password")
    UserResponse resetPassword(
            @PathVariable UUID id,
            @Valid @RequestBody ResetPasswordRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest) {
        return UserResponse.from(userManagementService.resetPassword(
                id,
                request.temporaryPassword(),
                idempotencyKey,
                principal,
                RequestIdFilter.currentRequestId(servletRequest)));
    }

    @PutMapping("/{id}/roles")
    UserResponse replaceRoles(
            @PathVariable UUID id,
            @Valid @RequestBody ReplaceRolesRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest) {
        return UserResponse.from(userManagementService.replaceRoles(
                id, request.roles(), principal, RequestIdFilter.currentRequestId(servletRequest)));
    }

    public record CreateUserRequest(
            @NotBlank @Size(max = 64) String username,
            @NotBlank @Size(max = 100) String displayName,
            @NotBlank @Size(max = 128) String temporaryPassword,
            @NotEmpty Set<@NotNull RoleName> roles) {

        public CreateUserRequest {
            roles = roles == null ? null : Set.copyOf(roles);
        }
    }

    public record ChangeStatusRequest(boolean enabled) {
    }

    public record ResetPasswordRequest(@NotBlank @Size(max = 128) String temporaryPassword) {
    }

    public record ReplaceRolesRequest(@NotEmpty Set<@NotNull RoleName> roles) {

        public ReplaceRolesRequest {
            roles = roles == null ? null : Set.copyOf(roles);
        }
    }

    public record UserResponse(
            UUID id,
            String username,
            String displayName,
            boolean enabled,
            boolean mustChangePassword,
            List<RoleName> roles,
            Instant createdAt,
            Instant updatedAt) {

        public UserResponse {
            roles = List.copyOf(roles);
        }

        static UserResponse from(UserAccount user) {
            return new UserResponse(
                    user.id(), user.username(), user.displayName(), user.enabled(), user.mustChangePassword(),
                    user.roles().stream().sorted().toList(), user.createdAt(), user.updatedAt());
        }
    }

    public record UserPageResponse(
            List<UserResponse> content,
            int page,
            int size,
            long totalElements,
            int totalPages) {

        public UserPageResponse {
            content = List.copyOf(content);
        }

        static UserPageResponse from(UserPage userPage) {
            int totalPages = Math.toIntExact(
                    (userPage.totalElements() + userPage.size() - 1) / userPage.size());
            return new UserPageResponse(
                    userPage.users().stream().map(UserResponse::from).toList(),
                    userPage.page(), userPage.size(), userPage.totalElements(), totalPages);
        }
    }
}
