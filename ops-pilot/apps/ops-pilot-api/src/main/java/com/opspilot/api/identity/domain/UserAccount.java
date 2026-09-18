package com.opspilot.api.identity.domain;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record UserAccount(
        UUID id,
        String username,
        String displayName,
        String passwordHash,
        boolean enabled,
        boolean mustChangePassword,
        long tokenVersion,
        Instant createdAt,
        Instant updatedAt,
        Set<RoleName> roles) {

    public UserAccount {
        roles = Set.copyOf(roles);
    }
}
