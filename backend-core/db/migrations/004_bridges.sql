-- Migration 004: Create bridges registry

CREATE TABLE IF NOT EXISTS bridges (
    id SERIAL PRIMARY KEY,
    address VARCHAR(255) UNIQUE NOT NULL,
    chain VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    protocol VARCHAR(100) NOT NULL
);

-- Seed existing known bridges from bfs.go hardcoded map
INSERT INTO bridges (address, chain, name, protocol) VALUES
('0xa0c68c638235ee32657e8f720a23cec1bfc77c77', 'ethereum', 'Polygon Bridge', 'Polygon PoS'),
('0x99c9fc46f92e8a1c0de1b1f3f31af08a58f00000', 'ethereum', 'Optimism Bridge', 'Optimism Gateway'),
('0x401F6c983eA34274ec46f84D70b31C151321188b', 'ethereum', 'Arbitrum Bridge', 'Arbitrum Inbox'),
('0x3ee18B2214AFF97000D974cf647E7C347E8fa585', 'ethereum', 'Wormhole Bridge', 'Wormhole')
ON CONFLICT (address) DO NOTHING;
