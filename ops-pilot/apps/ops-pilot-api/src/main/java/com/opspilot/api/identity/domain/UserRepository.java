package com.opspilot.api.identity.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface UserRepository {

    Optional<UserAccount> findById(UUID id);

    Optional<UserAccount> findByUsername(String username);

    List<UserAccount> findPage(int offset, int size, String query, String sortProperty, boolean ascending);

    long count(String query);

    long countEnabledByRole(RoleName role);

    void create(UserAccount user);

    void updateStatus(UUID id, boolean enabled, Instant updatedAt);

    void updatePassword(UUID id, String passwordHash, boolean mustChangePassword, Instant updatedAt);

    void replaceRoles(UUID id, Set<RoleName> roles, Instant updatedAt);

    void incrementTokenVersion(UUID id, Instant updatedAt);
}
