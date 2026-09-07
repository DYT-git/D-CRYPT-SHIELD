CREATE TABLE IF NOT EXISTS integration_outbox (
    id SERIAL PRIMARY KEY,
    case_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    transport_method TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
