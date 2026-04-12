-- =============================================================================
-- AI Gate — registry tool (PostgreSQL 14+)
-- Mục đích: lưu định nghĩa tool, JSON Schema đầu vào, RBAC theo role JWT,
--           trạng thái bật/tắt. Ứng dụng có thể đọc bảng này thay cho map cứng
--           trong RbacService / InputValidationService.
-- =============================================================================

BEGIN;

-- Trạng thái tool: chỉ role được gán mới gọi được tool ACTIVE.
CREATE TABLE IF NOT EXISTS ai_tool (
    id              BIGSERIAL PRIMARY KEY,
    tool_name       VARCHAR(128) NOT NULL,
    version         VARCHAR(32)  NOT NULL DEFAULT '1.0',
    description     TEXT,
    -- JSON Schema (object) cho arguments — khớp Bedrock toolSpec.inputSchema.json
    input_schema_json JSONB,
    status          VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'DISABLED', 'DEPRECATED')),
    -- Gợi ý map tới handler trong code (bean name / key), có thể NULL
    handler_key     VARCHAR(128),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_tool_name_version UNIQUE (tool_name, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_name ON ai_tool (tool_name);
CREATE INDEX IF NOT EXISTS idx_ai_tool_status ON ai_tool (status);

COMMENT ON TABLE ai_tool IS 'Đăng ký tool thực thi qua POST /internal/tool/execute';
COMMENT ON COLUMN ai_tool.tool_name IS 'Trùng field tool trong ExecuteRequest; trùng toolSpec.name (Bedrock)';
COMMENT ON COLUMN ai_tool.input_schema_json IS 'JSON Schema validate arguments; dùng chung cho LLM + Gate';

-- Role JWT (claim "roles": ["user","admin"]) được phép gọi tool.
CREATE TABLE IF NOT EXISTS ai_tool_role (
    id          BIGSERIAL PRIMARY KEY,
    tool_id     BIGINT NOT NULL REFERENCES ai_tool (id) ON DELETE CASCADE,
    role_name   VARCHAR(64) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_tool_role UNIQUE (tool_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_role_role ON ai_tool_role (role_name);

COMMENT ON TABLE ai_tool_role IS 'RBAC: mapping tool_id ↔ role_name (JWT)';

-- Ghi nhận thay đổi cấu hình (tùy chọn — audit admin)
CREATE TABLE IF NOT EXISTS ai_tool_config_audit (
    id           BIGSERIAL PRIMARY KEY,
    tool_id      BIGINT REFERENCES ai_tool (id) ON DELETE SET NULL,
    action       VARCHAR(32) NOT NULL, -- INSERT, UPDATE, DISABLE, ROLE_ADD, ...
    changed_by   VARCHAR(128),
    detail_json  JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_config_audit_tool ON ai_tool_config_audit (tool_id);

-- Cập nhật updated_at khi sửa ai_tool (trigger đơn giản)
CREATE OR REPLACE FUNCTION ai_tool_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ai_tool_updated ON ai_tool;
CREATE TRIGGER tr_ai_tool_updated
    BEFORE UPDATE ON ai_tool
    FOR EACH ROW
    EXECUTE PROCEDURE ai_tool_touch_updated_at();

COMMIT;

-- -----------------------------------------------------------------------------
-- Dữ liệu mẫu (khớp RbacService + GetTodayTransactionsToolHandler hiện tại)
-- -----------------------------------------------------------------------------
BEGIN;

INSERT INTO ai_tool (tool_name, version, description, input_schema_json, status, handler_key)
VALUES (
    'get_today_transactions',
    '1.0',
    'Lấy tổng giao dịch theo ngày',
    '{
      "type": "object",
      "properties": {
        "date": { "type": "string", "format": "date", "description": "YYYY-MM-DD" }
      },
      "required": ["date"]
    }'::jsonb,
    'ACTIVE',
    'getTodayTransactions'
)
ON CONFLICT (tool_name, version) DO NOTHING;

INSERT INTO ai_tool_role (tool_id, role_name)
SELECT t.id, r.role_name
FROM ai_tool t
CROSS JOIN (VALUES ('user'), ('admin')) AS r(role_name)
WHERE t.tool_name = 'get_today_transactions' AND t.version = '1.0'
ON CONFLICT (tool_id, role_name) DO NOTHING;

COMMIT;
