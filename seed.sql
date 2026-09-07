INSERT INTO vasp_labels (address, chain, vasp_name, vasp_type, confidence, source, risk_level) VALUES
('0x6197394644ad18cb8ebb17a6ca5c46f137a4cb67', 'ethereum', 'Binance', 'exchange', 99.0, 'osint', 'low'),
('0x28c6c06298d514db089934071355e5743bf21d60', 'ethereum', 'Binance', 'exchange', 99.0, 'osint', 'low'),
('0x7762a4a35da76c8c56c2d15fbaf304875c742e94', 'ethereum', 'Huobi', 'exchange', 99.0, 'osint', 'low'),
('0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe', 'ethereum', 'Tornado Cash', 'mixer', 100.0, 'ofac', 'critical'),
('0x0d0707963952f2fba59dd06f2b425ace40b492fe', 'ethereum', 'Gate.io', 'exchange', 95.0, 'osint', 'low'),
('0x8894e0a0c962cb723c1976a4421c95949be2d4e3', 'ethereum', 'Kraken', 'exchange', 99.0, 'osint', 'low'),
('0xe3950207a974b62dbba4cb6d6cc9ff4d4dd2d46e', 'ethereum', 'KuCoin', 'exchange', 95.0, 'osint', 'low'),
('0xf16e9b0d03470827a95cdfd0cb8a8a3b46969b91', 'bnb', 'Binance', 'exchange', 99.0, 'osint', 'low'),
('0x1403bf6ce9bd502844de3fbda2160d23c8fcff50', 'bnb', 'PancakeSwap', 'dex', 95.0, 'osint', 'low'),
('0xccea73a0d4b5eaa5125ce656f471abf065901fda', 'bnb', 'Test Exchange', 'exchange', 90.0, 'test', 'low')
ON CONFLICT (address, chain) DO UPDATE SET vasp_name = EXCLUDED.vasp_name;
