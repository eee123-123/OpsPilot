package com.opspilot.api.identity.audit;

import java.time.Instant;
import java.util.UUID;

public record AuditEvent(
        String eventType,
        String outcome,
        UUID actorUserId,
        String actorUsername,
        String targetType,
        String targetId,
        String requestId,
        String reasonCode,
        String beforeValue,
        String afterValue,
        Instant occurredAt) {
}
