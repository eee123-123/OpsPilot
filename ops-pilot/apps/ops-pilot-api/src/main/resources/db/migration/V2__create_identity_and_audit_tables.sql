CREATE TABLE role (
    id SMALLINT PRIMARY KEY,
    name VARCHAR(32) NOT NULL UNIQUE,
    CONSTRAINT ck_role_name CHECK (name IN ('VIEWER', 'OPERATOR', 'APPROVER', 'ADMIN'))
);

INSERT INTO role (id, name) VALUES
    (1, 'VIEWER'),
    (2, 'OPERATOR'),
    (3, 'APPROVER'),
    (4, 'ADMIN');

CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    token_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_app_user_username_normalized CHECK (username = lower(username)),
    CONSTRAINT ck_app_user_token_version CHECK (token_version >= 0)
);

CREATE TABLE user_role (
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role_id SMALLINT NOT NULL REFERENCES role(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_role_role_id ON user_role(role_id);

CREATE TABLE identity_idempotency (
    actor_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    operation VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    target_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (actor_user_id, operation, idempotency_key)
);

CREATE TABLE audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    outcome VARCHAR(16) NOT NULL,
    actor_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
    actor_username VARCHAR(64),
    target_type VARCHAR(64),
    target_id VARCHAR(128),
    request_id VARCHAR(64) NOT NULL,
    reason_code VARCHAR(64),
    before_value TEXT,
    after_value TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_audit_outcome CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED'))
);

CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
