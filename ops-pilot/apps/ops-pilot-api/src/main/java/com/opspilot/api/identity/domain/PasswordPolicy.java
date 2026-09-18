package com.opspilot.api.identity.domain;

import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public final class PasswordPolicy {

    private static final Pattern UPPER = Pattern.compile("[A-Z]");
    private static final Pattern LOWER = Pattern.compile("[a-z]");
    private static final Pattern DIGIT = Pattern.compile("[0-9]");
    private static final Pattern SYMBOL = Pattern.compile("[^A-Za-z0-9]");

    public void validate(String password) {
        if (password == null || password.length() < 12 || password.length() > 128
                || !UPPER.matcher(password).find()
                || !LOWER.matcher(password).find()
                || !DIGIT.matcher(password).find()
                || !SYMBOL.matcher(password).find()) {
            throw new IdentityException(
                    "PASSWORD_POLICY_VIOLATION",
                    "Password must be 12-128 characters and include upper, lower, digit and symbol");
        }
    }
}
