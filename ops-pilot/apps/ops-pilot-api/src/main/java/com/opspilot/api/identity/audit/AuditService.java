package com.opspilot.api.identity.audit;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
public class AuditService {

    private final JdbcClient jdbcClient;
    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected mapper bean")
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public AuditService(JdbcClient jdbcClient, ObjectMapper objectMapper, Clock clock) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public void record(
            String eventType,
            String outcome,
            UUID actorUserId,
            String actorUsername,
            String targetType,
            String targetId,
            String requestId,
            String reasonCode,
            Object beforeValue,
            Object afterValue) {
        AuditEvent event = new AuditEvent(
                eventType, outcome, actorUserId, actorUsername, targetType, targetId,
                requestId, reasonCode, serialize(beforeValue), serialize(afterValue), Instant.now(clock));
        jdbcClient.sql("""
                        INSERT INTO audit_log (
                            event_type, outcome, actor_user_id, actor_username, target_type, target_id,
                            request_id, reason_code, before_value, after_value, occurred_at
                        ) VALUES (
                            :eventType, :outcome, :actorUserId, :actorUsername, :targetType, :targetId,
                            :requestId, :reasonCode, :beforeValue, :afterValue, :occurredAt
                        )
                        """)
                .param("eventType", event.eventType())
                .param("outcome", event.outcome())
                .param("actorUserId", event.actorUserId())
                .param("actorUsername", event.actorUsername())
                .param("targetType", event.targetType())
                .param("targetId", event.targetId())
                .param("requestId", event.requestId())
                .param("reasonCode", event.reasonCode())
                .param("beforeValue", event.beforeValue())
                .param("afterValue", event.afterValue())
                .param("occurredAt", OffsetDateTime.ofInstant(event.occurredAt(), ZoneOffset.UTC))
                .update();
    }

    public void recordAuthenticationFailure(String username, String requestId, String reasonCode) {
        record(
                "AUTHENTICATION_FAILURE", "FAILURE", null, username, "SESSION", null,
                requestId, reasonCode, null, Map.of("username", username));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(
            String eventType,
            UUID actorUserId,
            String actorUsername,
            String targetType,
            String targetId,
            String requestId,
            String reasonCode) {
        record(
                eventType, "FAILURE", actorUserId, actorUsername, targetType, targetId,
                requestId, reasonCode, null, null);
    }

    private String serialize(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Unable to serialize audit value", exception);
        }
    }
}
