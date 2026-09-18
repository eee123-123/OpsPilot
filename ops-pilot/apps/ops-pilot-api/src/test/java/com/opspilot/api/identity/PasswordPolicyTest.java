package com.opspilot.api.identity;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.opspilot.api.identity.domain.IdentityException;
import com.opspilot.api.identity.domain.PasswordPolicy;
import org.junit.jupiter.api.Test;

class PasswordPolicyTest {

    private final PasswordPolicy passwordPolicy = new PasswordPolicy();

    @Test
    void acceptsAComplexPassword() {
        assertThatCode(() -> passwordPolicy.validate("Valid-password-2026!"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsMissingComplexityAndInvalidLength() {
        assertThatThrownBy(() -> passwordPolicy.validate(null)).isInstanceOf(IdentityException.class);
        assertThatThrownBy(() -> passwordPolicy.validate("short")).isInstanceOf(IdentityException.class);
        assertThatThrownBy(() -> passwordPolicy.validate("lowercase-only-password!"))
                .isInstanceOf(IdentityException.class);
        assertThatThrownBy(() -> passwordPolicy.validate("UPPERCASE-ONLY-2026!"))
                .isInstanceOf(IdentityException.class);
        assertThatThrownBy(() -> passwordPolicy.validate("No-digits-in-password!"))
                .isInstanceOf(IdentityException.class);
        assertThatThrownBy(() -> passwordPolicy.validate("NoSymbolsInPassword2026"))
                .isInstanceOf(IdentityException.class);
    }
}
