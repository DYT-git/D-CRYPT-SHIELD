-- ============================================================
-- VASP Attribution Engine — Phase 4 Entity Model
-- Migration: 002_entities.sql
-- SAFE: vasp_labels is preserved as-is. New tables add normalization.
-- ============================================================

-- -----------------------------------------------------------
-- TABLE: entities
-- Normalized entity registry. One row = one logical organization.
-- e.g. "Binance" as a legal entity, not an address.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS entities (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,           -- e.g. "Binance", "Tornado Cash"
    entity_type     VARCHAR(100) NOT NULL,           -- "exchange", "mixer", "defi_protocol",
                                                    -- "bridge", "payment_processor", "other"
    jurisdiction    VARCHAR(100),                    -- e.g. "Cayman Islands", "USA"
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

-- -----------------------------------------------------------
-- TABLE: entity_addresses
-- Maps known blockchain addresses to their owning entity.
-- One entity (e.g. Binance) can have many rows here.
-- DOES NOT replace vasp_labels: vasp_labels remains the
-- authoritative label cache; this adds attribution semantics.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS entity_addresses (
    id              BIGSERIAL PRIMARY KEY,
    entity_id       BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    address         VARCHAR(255) NOT NULL,
    chain           VARCHAR(50) NOT NULL,

    -- Attribution semantics: what TYPE of address is this?
    -- Ordered roughly by attribution strength (highest first):
    -- deposit_address   — A unique per-user deposit address (strongest)
    -- hot_wallet        — VASP infrastructure wallet
    -- cold_wallet       — Known cold storage
    -- service_wallet    — Fee/operational wallet
    -- exchange_controlled — General exchange-owned address
    -- entity_associated — Confirmed association, exact role unknown
    -- cluster_associated — Derived from heuristic/WCC clustering (weakest)
    address_type    VARCHAR(50) NOT NULL DEFAULT 'entity_associated',

    -- Source provenance: where did this label come from?
    source          VARCHAR(255),                    -- e.g. "Chainalysis", "OSINT", "OFAC"
    source_type     VARCHAR(50),                     -- "intelligence_vendor", "osint",
                                                    -- "regulatory", "manual", "heuristic"
    reliability     DECIMAL(3,2) DEFAULT 0.80,       -- 0.00 - 1.00

    -- Freshness tracking for stale-label penalties
    first_observed  TIMESTAMPTZ,
    last_verified   TIMESTAMPTZ DEFAULT NOW(),

    -- Human notes for investigators
    notes           TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_addresses_addr_chain ON entity_addresses(address, chain);
CREATE INDEX IF NOT EXISTS idx_entity_addresses_entity_id ON entity_addresses(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_addresses_chain ON entity_addresses(chain);

-- -----------------------------------------------------------
-- SEED: Populate entities from existing vasp_labels
-- Maps existing vasp_name values to normalized entity rows.
-- vasp_labels is NOT modified; this is a read-only migration.
-- -----------------------------------------------------------

-- Step 1: Create entity rows for each distinct vasp_name
INSERT INTO entities (name, entity_type, notes)
SELECT DISTINCT
    vasp_name,
    vasp_type,
    'Auto-migrated from vasp_labels on Phase 4 upgrade'
FROM vasp_labels
ON CONFLICT (name) DO NOTHING;

-- Step 2: Create entity_address rows linking each vasp_labels row
-- to its matching entity. Uses vasp_labels.confidence to derive reliability.
INSERT INTO entity_addresses (
    entity_id, address, chain, address_type,
    source, source_type, reliability,
    first_observed, last_verified, notes
)
SELECT
    e.id,
    vl.address,
    vl.chain,
    -- Map vasp_type to a meaningful address_type
    CASE
        WHEN vl.vasp_type = 'exchange'          THEN 'hot_wallet'
        WHEN vl.vasp_type = 'mixer'             THEN 'service_wallet'
        WHEN vl.vasp_type = 'defi_bridge'       THEN 'service_wallet'
        WHEN vl.vasp_type = 'dex'               THEN 'service_wallet'
        WHEN vl.vasp_type = 'hot_wallet'        THEN 'hot_wallet'
        WHEN vl.vasp_type = 'cold_wallet'       THEN 'cold_wallet'
        ELSE 'entity_associated'
    END,
    vl.source,
    -- Map source strings to source_type categories
    CASE
        WHEN vl.source = 'etherscan_tag'        THEN 'osint'
        WHEN vl.source = 'ofac'                 THEN 'regulatory'
        WHEN vl.source = 'manual_review'        THEN 'manual'
        WHEN vl.source = 'osint'                THEN 'osint'
        WHEN vl.source = 'test'                 THEN 'manual'
        ELSE 'osint'
    END,
    -- Convert 0-100 confidence to 0.00-1.00 reliability
    LEAST(vl.confidence / 100.0, 1.0),
    vl.created_at,
    vl.updated_at,
    'Auto-migrated from vasp_labels'
FROM vasp_labels vl
JOIN entities e ON e.name = vl.vasp_name
ON CONFLICT (address, chain) DO NOTHING;

-- -----------------------------------------------------------
-- Verify the migration
-- -----------------------------------------------------------
SELECT
    'entities seeded:' AS metric,
    COUNT(*)::TEXT AS value
FROM entities
UNION ALL
SELECT
    'entity_addresses seeded:',
    COUNT(*)::TEXT
FROM entity_addresses
UNION ALL
SELECT
    'vasp_labels preserved (unchanged):',
    COUNT(*)::TEXT
FROM vasp_labels;
