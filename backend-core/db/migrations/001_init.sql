-- ============================================================
-- VASP Attribution Engine - PostgreSQL Schema
-- Migration: 001_init.sql
-- Runs automatically on first docker compose up
-- ============================================================

-- -----------------------------------------------------------
-- TABLE: vasp_labels
-- The core Attribution Database. Stores known VASP addresses.
-- This is our internal "Chainalysis" — seeded via OSINT.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vasp_labels (
    id              BIGSERIAL PRIMARY KEY,
    address         VARCHAR(255) NOT NULL,
    chain           VARCHAR(50) NOT NULL,        -- e.g. 'ethereum', 'bitcoin', 'tron'
    vasp_name       VARCHAR(255) NOT NULL,        -- e.g. 'Binance', 'WazirX', 'Coinbase'
    vasp_type       VARCHAR(100) NOT NULL,        -- e.g. 'exchange', 'mixer', 'defi_bridge', 'hot_wallet'
    confidence      DECIMAL(5,2) DEFAULT 100.00,  -- How confident we are in this label (0-100)
    source          VARCHAR(255),                 -- e.g. 'etherscan_tag', 'osint', 'manual_review'
    risk_level      VARCHAR(20) DEFAULT 'low',    -- 'low', 'medium', 'high', 'critical'
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vasp_labels_address_chain ON vasp_labels(address, chain);
CREATE INDEX IF NOT EXISTS idx_vasp_labels_vasp_name ON vasp_labels(vasp_name);
CREATE INDEX IF NOT EXISTS idx_vasp_labels_chain ON vasp_labels(chain);

-- -----------------------------------------------------------
-- TABLE: investigation_cases
-- Stores each case submitted by an LEA via the SAHYOG mock API.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS investigation_cases (
    id              BIGSERIAL PRIMARY KEY,
    case_id         VARCHAR(100) UNIQUE NOT NULL,  -- External case reference from SAHYOG
    suspect_address VARCHAR(255) NOT NULL,
    chain           VARCHAR(50) NOT NULL,
    status          VARCHAR(50) DEFAULT 'pending', -- 'pending', 'tracing', 'completed', 'failed'
    submitted_by    VARCHAR(255),                  -- LEA officer or system
    result_vasp     VARCHAR(255),                  -- The identified VASP (filled after tracing)
    confidence      DECIMAL(5,2),                  -- Confidence score of the attribution
    hops_traced     INTEGER DEFAULT 0,
    report_url      TEXT,                          -- Link to the generated PDF report
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cases_status ON investigation_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_suspect ON investigation_cases(suspect_address);

-- -----------------------------------------------------------
-- TABLE: transaction_traces
-- Stores each hop found during the BFS traversal.
-- Gives a full audit trail of the money path.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaction_traces (
    id              BIGSERIAL PRIMARY KEY,
    case_id         VARCHAR(100) NOT NULL REFERENCES investigation_cases(case_id),
    hop_number      INTEGER NOT NULL,
    from_address    VARCHAR(255) NOT NULL,
    to_address      VARCHAR(255) NOT NULL,
    tx_hash         VARCHAR(255),
    amount          DECIMAL(30,10),
    token_symbol    VARCHAR(50),                   -- e.g. 'ETH', 'USDT', 'BTC'
    chain           VARCHAR(50) NOT NULL,
    timestamp       TIMESTAMPTZ,
    is_vasp_hit     BOOLEAN DEFAULT FALSE,         -- TRUE if to_address is a known VASP
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_traces_case_id ON transaction_traces(case_id);

-- -----------------------------------------------------------
-- TABLE: api_keys
-- For managing access to our mock-SAHYOG REST API.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
    id              BIGSERIAL PRIMARY KEY,
    key_hash        VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,         -- e.g. 'SAHYOG Portal', 'Test LEA'
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- SEED DATA: Known VASP Addresses (OSINT-sourced)
-- A starting dataset of publicly known exchange hot wallets.
-- -----------------------------------------------------------
INSERT INTO vasp_labels (address, chain, vasp_name, vasp_type, confidence, source, risk_level) VALUES
-- Binance (Ethereum)
('0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE', 'ethereum', 'Binance', 'exchange', 99.00, 'etherscan_tag', 'low'),
('0xD551234Ae421e3BCBA99A0Da6d736074f22192FF', 'ethereum', 'Binance', 'exchange', 99.00, 'etherscan_tag', 'low'),
('0x564286362092D8e7936f0549571a803B203aAceD', 'ethereum', 'Binance', 'exchange', 99.00, 'etherscan_tag', 'low'),
-- Coinbase (Ethereum)
('0x503828976D22510aad0201ac7EC88293211D23Da', 'ethereum', 'Coinbase', 'exchange', 99.00, 'etherscan_tag', 'low'),
('0xddfAbCdc4D8FfC6d5beaf154f18B778f892A0740', 'ethereum', 'Coinbase', 'exchange', 99.00, 'etherscan_tag', 'low'),
-- Kraken (Ethereum)
('0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2', 'ethereum', 'Kraken', 'exchange', 95.00, 'etherscan_tag', 'low'),
-- Binance (Tron)
('TF5Bn4cJCT6GqbAac1HQJM6Xm6aCJQmPEm', 'tron', 'Binance', 'exchange', 95.00, 'osint', 'low'),
-- WazirX (Ethereum) 
('0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06', 'ethereum', 'WazirX', 'exchange', 90.00, 'osint', 'low')
ON CONFLICT (address, chain) DO NOTHING;

-- Done
SELECT 'Schema initialized successfully.' AS status;
