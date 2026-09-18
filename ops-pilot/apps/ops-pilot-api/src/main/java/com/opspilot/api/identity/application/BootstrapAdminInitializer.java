package com.opspilot.api.identity.application;

import com.opspilot.api.identity.config.IdentityProperties;
import com.opspilot.api.identity.domain.PasswordPolicy;
import com.opspilot.api.identity.domain.RoleName;
import com.opspilot.api.identity.domain.UserAccount;
import com.opspilot.api.identity.domain.UserRepository;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(
        prefix = "opspilot.identity",
        name = "bootstrap-enabled",
        havingValue = "true",
        matchIfMissing = true)
public class BootstrapAdminInitializer implements ApplicationRunner {

    private final IdentityProperties properties;
    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected repository bean")
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final Clock clock;

    public BootstrapAdminInitializer(
            IdentityProperties properties,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PasswordPolicy passwordPolicy,
            Clock clock) {
        this.properties = properties;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        IdentityProperties.BootstrapAdmin admin = properties.bootstrapAdmin();
        String username = UserManagementService.normalizeUsername(admin.username());
        if (userRepository.findByUsername(username).isPresent()) {
            return;
        }
        passwordPolicy.validate(admin.password());
        Instant now = Instant.now(clock);
        userRepository.create(new UserAccount(
                UUID.randomUUID(), username, admin.displayName().trim(), passwordEncoder.encode(admin.password()),
                true, true, 0, now, now, Set.of(RoleName.ADMIN)));
    }
}
