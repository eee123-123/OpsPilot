package com.opspilot.api.identity.security;

import com.opspilot.api.identity.domain.RoleName;
import com.opspilot.api.identity.domain.UserAccount;
import java.security.Principal;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public record UserPrincipal(
        UUID id,
        String username,
        String displayName,
        boolean mustChangePassword,
        Set<RoleName> roles) implements Principal {

    public UserPrincipal {
        roles = Set.copyOf(roles);
    }

    public static UserPrincipal from(UserAccount user) {
        return new UserPrincipal(
                user.id(), user.username(), user.displayName(), user.mustChangePassword(), user.roles());
    }

    public Collection<? extends GrantedAuthority> authorities() {
        return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
    }

    @Override
    public String getName() {
        return username;
    }
}
