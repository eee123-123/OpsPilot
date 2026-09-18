package com.opspilot.api.identity.infrastructure;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class IdentityIdempotencyRepository {

    private final JdbcClient jdbcClient;

    public IdentityIdempotencyRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<IdempotencyRecord> find(UUID actorId, String operation, String key) {
        return jdbcClient.sql("""
                        SELECT request_fingerprint, target_user_id
                        FROM identity_idempotency
                        WHERE actor_user_id = :actorId AND operation = :operation AND idempotency_key = :key
                        """)
                .param("actorId", actorId)
                .param("operation", operation)
                .param("key", key)
                .query((resultSet, rowNumber) -> new IdempotencyRecord(
                        resultSet.getString("request_fingerprint"),
                        resultSet.getObject("target_user_id", UUID.class)))
                .optional();
    }

    public void save(
            UUID actorId,
            String operation,
            String key,
            String fingerprint,
            UUID targetUserId,
            Instant createdAt) {
        jdbcClient.sql("""
                        INSERT INTO identity_idempotency (
                            actor_user_id, operation, idempotency_key, request_fingerprint,
                            target_user_id, created_at
                        ) VALUES (:actorId, :operation, :key, :fingerprint, :targetUserId, :createdAt)
                        """)
                .param("actorId", actorId)
                .param("operation", operation)
                .param("key", key)
                .param("fingerprint", fingerprint)
                .param("targetUserId", targetUserId)
                .param("createdAt", OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC))
                .update();
    }

    public record IdempotencyRecord(String fingerprint, UUID targetUserId) {
    }
}
