package com.opspilot.api.identity.web;

import com.opspilot.api.identity.application.AuthService;
import com.opspilot.api.identity.application.AuthService.LoginResult;
import com.opspilot.api.identity.domain.RoleName;
import com.opspilot.api.identity.security.UserPrincipal;
import com.opspilot.api.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        LoginResult result = authService.login(
                request.username(), request.password(), RequestIdFilter.currentRequestId(servletRequest));
        return LoginResponse.from(result);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(
            @AuthenticationPrincipal UserPrincipal principal, HttpServletRequest servletRequest) {
        authService.logout(principal, RequestIdFilter.currentRequestId(servletRequest));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    CurrentUserResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return CurrentUserResponse.from(principal);
    }

    @PostMapping("/change-password")
    LoginResponse changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest servletRequest) {
        LoginResult result = authService.changePassword(
                principal,
                request.currentPassword(),
                request.newPassword(),
                RequestIdFilter.currentRequestId(servletRequest));
        return LoginResponse.from(result);
    }

    public record LoginRequest(
            @NotBlank @Size(max = 64) String username,
            @NotBlank @Size(max = 128) String password) {
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(max = 128) String newPassword) {
    }

    public record LoginResponse(
            String accessToken,
            String tokenType,
            Instant expiresAt,
            CurrentUserResponse user) {

        static LoginResponse from(LoginResult result) {
            return new LoginResponse(
                    result.token().value(), "Bearer", result.token().expiresAt(),
                    CurrentUserResponse.from(result.principal()));
        }
    }

    public record CurrentUserResponse(
            UUID id,
            String username,
            String displayName,
            boolean mustChangePassword,
            List<RoleName> roles) {

        public CurrentUserResponse {
            roles = List.copyOf(roles);
        }

        static CurrentUserResponse from(UserPrincipal principal) {
            return new CurrentUserResponse(
                    principal.id(), principal.username(), principal.displayName(), principal.mustChangePassword(),
                    principal.roles().stream().sorted().toList());
        }
    }
}
