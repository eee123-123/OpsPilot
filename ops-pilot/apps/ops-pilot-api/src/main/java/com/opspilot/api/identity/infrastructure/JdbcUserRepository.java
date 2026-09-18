package com.opspilot.api.identity.infrastructure;

import com.opspilot.api.identity.domain.RoleName;
import com.opspilot.api.identity.domain.UserAccount;
import com.opspilot.api.identity.domain.UserRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcUserRepository implements UserRepository {

    private static final String USER_COLUMNS = """
            SELECT id, username, display_name, password_hash, enabled, must_change_password,
                   token_version, created_at, updated_at
            FROM app_user
            """;

    private final JdbcClient jdbcClient;

    public JdbcUserRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @Override
    public Optional<UserAccount> findById(UUID id) {
        return jdbcClient.sql(USER_COLUMNS + " WHERE id = :id")
                .param("id", id)
                .query(this::mapUser)
                .optional()
                .map(this::withRoles);
    }

    @Override
    public Optional<UserAccount> findByUsername(String username) {
        return jdbcClient.sql(USER_COLUMNS + " WHERE username = :username")
                .param("username", username.toLowerCase(Locale.ROOT))
                .query(this::mapUser)
                .optional()
                .map(this::withRoles);
    }

    @Override
    public List<UserAccount> findPage(
            int offset, int size, String query, String sortProperty, boolean ascending) {
        String sortColumn = switch (sortProperty) {
            case "displayName" -> "display_name";
            case "createdAt" -> "created_at";
            case "enabled" -> "enabled";
            default -> "username";
        };
        String direction = ascending ? " ASC" : " DESC";
        String search = normalizeSearch(query);
        return jdbcClient.sql(USER_COLUMNS
                        + " WHERE (:query = '' OR username LIKE :pattern OR lower(display_name) LIKE :pattern)"
                        + " ORDER BY " + sortColumn + direction + ", id ASC LIMIT :size OFFSET :offset")
                .param("query", search)
                .param("pattern", "%" + search + "%")
                .param("size", size)
                .param("offset", offset)
                .query(this::mapUser)
                .list()
                .stream()
                .map(this::withRoles)
                .toList();
    }

    @Override
    public long count(String query) {
        String search = normalizeSearch(query);
        return jdbcClient.sql("""
                        SELECT count(*) FROM app_user
                        WHERE (:query = '' OR username LIKE :pattern OR lower(display_name) LIKE :pattern)
                        """)
                .param("query", search)
                .param("pattern", "%" + search + "%")
                .query(Long.class)
                .single();
    }

    @Override
    public long countEnabledByRole(RoleName role) {
        return jdbcClient.sql("""
                        SELECT count(*) FROM app_user u
                        JOIN user_role ur ON ur.user_id = u.id
                        JOIN role r ON r.id = ur.role_id
                        WHERE u.enabled = TRUE AND r.name = :roleName
                        """)
                .param("roleName", role.name())
                .query(Long.class)
                .single();
    }

    @Override
    public void create(UserAccount user) {
        jdbcClient.sql("""
                        INSERT INTO app_user (
                            id, username, display_name, password_hash, enabled, must_change_password,
                            token_version, created_at, updated_at
                        ) VALUES (
                            :id, :username, :displayName, :passwordHash, :enabled, :mustChangePassword,
                            :tokenVersion, :createdAt, :updatedAt
                        )
                        """)
                .param("id", user.id())
                .param("username", user.username())
                .param("displayName", user.displayName())
                .param("passwordHash", user.passwordHash())
                .param("enabled", user.enabled())
                .param("mustChangePassword", user.mustChangePassword())
                .param("tokenVersion", user.tokenVersion())
                .param("createdAt", databaseTime(user.createdAt()))
                .param("updatedAt", databaseTime(user.updatedAt()))
                .update();
        insertRoles(user.id(), user.roles());
    }

    @Override
    public void updateStatus(UUID id, boolean enabled, Instant updatedAt) {
        requireSingleUpdate(jdbcClient.sql("""
                        UPDATE app_user
                        SET enabled = :enabled, token_version = token_version + 1, updated_at = :updatedAt
                        WHERE id = :id
                        """)
                .param("enabled", enabled)
                .param("updatedAt", databaseTime(updatedAt))
                .param("id", id)
                .update());
    }

    @Override
    public void updatePassword(UUID id, String passwordHash, boolean mustChangePassword, Instant updatedAt) {
        requireSingleUpdate(jdbcClient.sql("""
                        UPDATE app_user
                        SET password_hash = :passwordHash, must_change_password = :mustChangePassword,
                            token_version = token_version + 1, updated_at = :updatedAt
                        WHERE id = :id
                        """)
                .param("passwordHash", passwordHash)
                .param("mustChangePassword", mustChangePassword)
                .param("updatedAt", databaseTime(updatedAt))
                .param("id", id)
                .update());
    }

    @Override
    public void replaceRoles(UUID id, Set<RoleName> roles, Instant updatedAt) {
        jdbcClient.sql("DELETE FROM user_role WHERE user_id = :id")
                .param("id", id)
                .update();
        insertRoles(id, roles);
        requireSingleUpdate(jdbcClient.sql("UPDATE app_user SET updated_at = :updatedAt WHERE id = :id")
                .param("updatedAt", databaseTime(updatedAt))
                .param("id", id)
                .update());
    }

    @Override
    public void incrementTokenVersion(UUID id, Instant updatedAt) {
        requireSingleUpdate(jdbcClient.sql("""
                        UPDATE app_user
                        SET token_version = token_version + 1, updated_at = :updatedAt
                        WHERE id = :id
                        """)
                .param("updatedAt", databaseTime(updatedAt))
                .param("id", id)
                .update());
    }

    private void insertRoles(UUID userId, Set<RoleName> roles) {
        for (RoleName role : roles) {
            jdbcClient.sql("""
                            INSERT INTO user_role (user_id, role_id)
                            SELECT :userId, id FROM role WHERE name = :roleName
                            """)
                    .param("userId", userId)
                    .param("roleName", role.name())
                    .update();
        }
    }

    private UserAccount mapUser(ResultSet resultSet, int rowNumber) throws SQLException {
        return new UserAccount(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("username"),
                resultSet.getString("display_name"),
                resultSet.getString("password_hash"),
                resultSet.getBoolean("enabled"),
                resultSet.getBoolean("must_change_password"),
                resultSet.getLong("token_version"),
                resultSet.getObject("created_at", OffsetDateTime.class).toInstant(),
                resultSet.getObject("updated_at", OffsetDateTime.class).toInstant(),
                Set.of());
    }

    private UserAccount withRoles(UserAccount user) {
        Set<RoleName> roles = jdbcClient.sql("""
                        SELECT r.name FROM role r
                        JOIN user_role ur ON ur.role_id = r.id
                        WHERE ur.user_id = :userId
                        ORDER BY r.id
                        """)
                .param("userId", user.id())
                .query(String.class)
                .list()
                .stream()
                .map(RoleName::valueOf)
                .collect(Collectors.toUnmodifiableSet());
        return new UserAccount(
                user.id(), user.username(), user.displayName(), user.passwordHash(), user.enabled(),
                user.mustChangePassword(), user.tokenVersion(), user.createdAt(), user.updatedAt(), roles);
    }

    private static String normalizeSearch(String query) {
        return query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
    }

    private static void requireSingleUpdate(int updatedRows) {
        if (updatedRows != 1) {
            throw new IllegalStateException("Expected exactly one user row to be updated");
        }
    }

    private static OffsetDateTime databaseTime(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
