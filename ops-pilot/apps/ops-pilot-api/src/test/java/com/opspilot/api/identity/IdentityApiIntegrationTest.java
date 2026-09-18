package com.opspilot.api.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:tc:pgvector:pg16:///ops_pilot",
            "spring.datasource.driver-class-name=org.testcontainers.jdbc.ContainerDatabaseDriver",
            "spring.datasource.username=test",
            "spring.datasource.password=test",
            "opspilot.identity.jwt-secret=integration-test-jwt-secret-at-least-32-bytes",
            "opspilot.identity.bootstrap-admin.username=admin",
            "opspilot.identity.bootstrap-admin.display-name=Integration Administrator",
            "opspilot.identity.bootstrap-admin.password=Admin-initial-2026!",
            "management.tracing.export.otlp.enabled=false"
        })
@Testcontainers(disabledWithoutDocker = true)
class IdentityApiIntegrationTest {

    private static final String ADMIN_INITIAL_PASSWORD = "Admin-initial-2026!";
    private static final String ADMIN_PASSWORD = "Admin-changed-2026!";

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private JwtEncoder jwtEncoder;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Test
    void completesIdentityLifecycleAndEnforcesTheRoleMatrix() throws Exception {
        HttpResult anonymous = get("/api/v1/users", null);
        assertProblem(anonymous, 401, "AUTHENTICATION_REQUIRED");
        assertThat(anonymous.requestId()).isNotBlank();

        HttpResult wrongPassword = login("admin", "wrong-password");
        assertProblem(wrongPassword, 401, "INVALID_CREDENTIALS");

        HttpResult initialLogin = login("admin", ADMIN_INITIAL_PASSWORD);
        assertThat(initialLogin.status()).isEqualTo(200);
        String initialToken = initialLogin.json().get("accessToken").asText();
        assertThat(initialLogin.json().get("user").get("mustChangePassword").asBoolean()).isTrue();

        HttpResult forcedChange = get("/api/v1/users", initialToken);
        assertProblem(forcedChange, 403, "PASSWORD_CHANGE_REQUIRED");

        HttpResult changed = post(
                "/api/v1/auth/change-password",
                Map.of("currentPassword", ADMIN_INITIAL_PASSWORD, "newPassword", ADMIN_PASSWORD),
                initialToken,
                null);
        assertThat(changed.status()).isEqualTo(200);
        String adminToken = changed.json().get("accessToken").asText();
        assertThat(changed.json().get("user").get("mustChangePassword").asBoolean()).isFalse();
        assertProblem(get("/api/v1/auth/me", initialToken), 401, "SESSION_INVALID");

        HttpResult adminUsers = get("/api/v1/users?page=0&size=20&sort=username,asc", adminToken);
        assertThat(adminUsers.status()).isEqualTo(200);
        assertThat(adminUsers.body()).doesNotContain("passwordHash", ADMIN_PASSWORD, ADMIN_INITIAL_PASSWORD);

        CreatedUser viewer = createUser(
                adminToken, "viewer", "Read Only", "Viewer-initial-2026!", List.of("VIEWER"), "create-viewer-001");
        CreatedUser operator = createUser(
                adminToken, "operator", "Operations", "Operator-initial-2026!", List.of("OPERATOR"),
                "create-operator-001");
        CreatedUser approver = createUser(
                adminToken, "approver", "Approver", "Approver-initial-2026!", List.of("APPROVER"),
                "create-approver-001");

        HttpResult createReplay = post(
                "/api/v1/users",
                createBody("viewer", "Read Only", "Viewer-initial-2026!", List.of("VIEWER")),
                adminToken,
                "create-viewer-001");
        assertThat(createReplay.status()).isEqualTo(201);
        assertThat(createReplay.json().get("id").asText()).isEqualTo(viewer.id().toString());
        assertProblem(
                post(
                        "/api/v1/users",
                        createBody("different", "Different", "Different-local-2026!", List.of("VIEWER")),
                        adminToken,
                        "create-viewer-001"),
                409,
                "IDEMPOTENCY_KEY_REUSED");

        String viewerToken = loginAndChangePassword(
                "viewer", "Viewer-initial-2026!", "Viewer-changed-2026!");
        String operatorToken = loginAndChangePassword(
                "operator", "Operator-initial-2026!", "Operator-changed-2026!");
        String approverToken = loginAndChangePassword(
                "approver", "Approver-initial-2026!", "Approver-changed-2026!");

        for (String token : List.of(viewerToken, operatorToken, approverToken)) {
            assertThat(get("/api/v1/auth/me", token).status()).isEqualTo(200);
            assertProblem(get("/api/v1/users", token), 403, "ACCESS_DENIED");
        }
        assertThat(get("/api/v1/users", adminToken).status()).isEqualTo(200);

        assertProblem(
                patch(
                        "/api/v1/users/" + changed.json().get("user").get("id").asText() + "/status",
                        Map.of("enabled", false), adminToken),
                400,
                "SELF_DISABLE_NOT_ALLOWED");
        assertProblem(
                put(
                        "/api/v1/users/" + changed.json().get("user").get("id").asText() + "/roles",
                        Map.of("roles", List.of("VIEWER")), adminToken),
                400,
                "SELF_ADMIN_REMOVAL_NOT_ALLOWED");

        assertThat(patch(
                "/api/v1/users/" + viewer.id() + "/status", Map.of("enabled", false), adminToken).status())
                .isEqualTo(200);
        assertProblem(get("/api/v1/auth/me", viewerToken), 401, "SESSION_INVALID");
        assertProblem(login("viewer", "Viewer-changed-2026!"), 401, "INVALID_CREDENTIALS");
        assertThat(patch(
                "/api/v1/users/" + viewer.id() + "/status", Map.of("enabled", true), adminToken).status())
                .isEqualTo(200);

        HttpResult reset = post(
                "/api/v1/users/" + viewer.id() + "/reset-password",
                Map.of("temporaryPassword", "Viewer-reset-2026!"),
                adminToken,
                "reset-viewer-001");
        assertThat(reset.status()).isEqualTo(200);
        assertProblem(get("/api/v1/auth/me", viewerToken), 401, "SESSION_INVALID");
        HttpResult resetReplay = post(
                "/api/v1/users/" + viewer.id() + "/reset-password",
                Map.of("temporaryPassword", "Viewer-reset-2026!"),
                adminToken,
                "reset-viewer-001");
        assertThat(resetReplay.status()).isEqualTo(200);
        assertThat(login("viewer", "Viewer-reset-2026!").json()
                .get("user").get("mustChangePassword").asBoolean()).isTrue();

        HttpResult promoteOperator = put(
                "/api/v1/users/" + operator.id() + "/roles",
                Map.of("roles", List.of("OPERATOR", "ADMIN")),
                adminToken);
        assertThat(promoteOperator.status()).isEqualTo(200);
        assertThat(get("/api/v1/users", operatorToken).status()).isEqualTo(200);

        assertThat(post("/api/v1/auth/logout", Map.of(), approverToken, null).status()).isEqualTo(204);
        assertProblem(get("/api/v1/auth/me", approverToken), 401, "SESSION_INVALID");

        assertProblem(get("/api/v1/users?page=-1", adminToken), 400, "INVALID_PAGE");
        assertProblem(get("/api/v1/users?sort=unknown,asc", adminToken), 400, "INVALID_SORT");
        assertProblem(get("/api/v1/auth/me", expiredToken(changed)), 401, "SESSION_INVALID");

        long auditCount = jdbcClient.sql("SELECT count(*) FROM audit_log").query(Long.class).single();
        long leakedPasswords = jdbcClient.sql("""
                        SELECT count(*) FROM audit_log
                        WHERE coalesce(before_value, '') LIKE '%-initial-2026!%'
                           OR coalesce(after_value, '') LIKE '%-initial-2026!%'
                        """)
                .query(Long.class)
                .single();
        assertThat(auditCount).isGreaterThanOrEqualTo(15);
        assertThat(leakedPasswords).isZero();
        assertThat(approver.id()).isNotNull();
    }

    private CreatedUser createUser(
            String adminToken,
            String username,
            String displayName,
            String password,
            List<String> roles,
            String idempotencyKey) throws Exception {
        HttpResult result = post(
                "/api/v1/users", createBody(username, displayName, password, roles),
                adminToken, idempotencyKey);
        assertThat(result.status()).isEqualTo(201);
        return new CreatedUser(UUID.fromString(result.json().get("id").asText()), username);
    }

    private static Map<String, Object> createBody(
            String username, String displayName, String password, List<String> roles) {
        return Map.of(
                "username", username,
                "displayName", displayName,
                "temporaryPassword", password,
                "roles", roles);
    }

    private String loginAndChangePassword(String username, String initialPassword, String newPassword)
            throws Exception {
        HttpResult login = login(username, initialPassword);
        assertThat(login.status()).isEqualTo(200);
        HttpResult changed = post(
                "/api/v1/auth/change-password",
                Map.of("currentPassword", initialPassword, "newPassword", newPassword),
                login.json().get("accessToken").asText(),
                null);
        assertThat(changed.status()).isEqualTo(200);
        return changed.json().get("accessToken").asText();
    }

    private String expiredToken(HttpResult changedAdminLogin) {
        JsonNode user = changedAdminLogin.json().get("user");
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("ops-pilot")
                .issuedAt(now.minusSeconds(120))
                .expiresAt(now.minusSeconds(60))
                .subject(user.get("id").asText())
                .claim("username", "admin")
                .claim("ver", 1)
                .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(), claims)).getTokenValue();
    }

    private HttpResult login(String username, String password) throws Exception {
        return post("/api/v1/auth/login", Map.of("username", username, "password", password), null, null);
    }

    private HttpResult get(String path, String token) throws Exception {
        return send("GET", path, null, token, null);
    }

    private HttpResult post(String path, Object body, String token, String idempotencyKey) throws Exception {
        return send("POST", path, body, token, idempotencyKey);
    }

    private HttpResult patch(String path, Object body, String token) throws Exception {
        return send("PATCH", path, body, token, null);
    }

    private HttpResult put(String path, Object body, String token) throws Exception {
        return send("PUT", path, body, token, null);
    }

    private HttpResult send(String method, String path, Object body, String token, String idempotencyKey)
            throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json")
                .header("X-Request-ID", "integration-request-001");
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        if (idempotencyKey != null) {
            builder.header("Idempotency-Key", idempotencyKey);
        }
        String jsonBody = body == null ? "" : objectMapper.writeValueAsString(body);
        if (body != null) {
            builder.header("Content-Type", "application/json");
        }
        builder.method(method, body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(jsonBody));
        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        return new HttpResult(
                response.statusCode(), response.body(), response.headers().firstValue("X-Request-ID").orElse(null));
    }

    private static void assertProblem(HttpResult result, int status, String errorCode) {
        assertThat(result.status()).isEqualTo(status);
        assertThat(result.json().get("errorCode").asText()).isEqualTo(errorCode);
        assertThat(result.json().get("requestId").asText()).isNotBlank();
    }

    private record CreatedUser(UUID id, String username) {
    }

    private record HttpResult(int status, String body, String requestId) {

        private JsonNode json() {
            try {
                return tools.jackson.databind.json.JsonMapper.builder().build().readTree(body);
            } catch (tools.jackson.core.JacksonException exception) {
                throw new IllegalStateException("Response was not JSON: " + body, exception);
            }
        }
    }
}
