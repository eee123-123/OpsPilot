package com.opspilot.api.identity.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("opspilot.identity")
public record IdentityProperties(
        @NotBlank @Size(min = 32) String jwtSecret,
        @NotBlank String jwtIssuer,
        @NotNull Duration accessTokenTtl,
        @Valid @NotNull BootstrapAdmin bootstrapAdmin) {

    public record BootstrapAdmin(
            @NotBlank String username,
            @NotBlank String displayName,
            @NotBlank String password) {
    }
}
