package com.opspilot.api.identity.domain;

import org.springframework.http.HttpStatus;

public class IdentityException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;

    public IdentityException(String errorCode, String message) {
        this(errorCode, message, HttpStatus.BAD_REQUEST);
    }

    public IdentityException(String errorCode, String message, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public String errorCode() {
        return errorCode;
    }

    public HttpStatus status() {
        return status;
    }
}
