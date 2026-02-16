-- Fix suppliers insert with correct column names
INSERT INTO suppliers (id, name, code, email, phone_number, website, country, city, address, payment_terms_days, lead_time_days, is_active) VALUES
(1, 'Philips Lighting Romania', 'PHILIPS', 'orders@philips.ro', '021-123-4567', 'https://www.philips.ro', 'Romania', 'București', 'Bd. Iuliu Maniu 7', 30, 5, true),
(2, 'Osram / Ledvance', 'OSRAM', 'orders@ledvance.ro', '021-234-5678', 'https://www.ledvance.ro', 'Romania', 'București', 'Str. Industriei 10', 30, 7, true),
(3, 'Elba SA', 'ELBA', 'comenzi@elba.ro', '0244-123-456', 'https://www.elba.ro', 'Romania', 'Timișoara', 'Str. Constructorilor 2', 45, 10, true),
(4, 'Gewiss Romania', 'GEWISS', 'sales@gewiss.ro', '021-345-6789', 'https://www.gewiss.com', 'Romania', 'București', 'Str. Telecomunicațiilor 15', 30, 7, true),
(5, 'Stellar Lighting', 'STELLAR', 'info@stellar.ro', '0256-789-012', 'https://www.stellar.ro', 'Romania', 'Arad', 'Zona Industrială Vest', 15, 3, true),
(6, 'Schrack Technik', 'SCHRACK', 'office@schrack.ro', '021-456-7890', 'https://www.schrack.ro', 'Romania', 'București', 'Bd. Biruinței 189', 30, 5, true),
(7, 'Lumen LED', 'LUMEN', 'comenzi@lumen.ro', '0740-123-456', 'https://www.lumen.ro', 'Romania', 'Cluj-Napoca', 'Str. Fabricii 5', 15, 2, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone_number = EXCLUDED.phone_number;

SELECT setval('suppliers_id_seq', (SELECT MAX(id) FROM suppliers));

-- Fix stock levels with correct column names
INSERT INTO stock_levels (product_id, warehouse_id, quantity_on_hand, quantity_available, reorder_point, reorder_quantity) VALUES
(1, 1, 120, 120, 20, 50), (2, 1, 85, 85, 20, 50), (3, 1, 60, 60, 10, 30), (4, 1, 30, 30, 5, 20),
(5, 1, 500, 500, 100, 200), (6, 1, 200, 200, 50, 100), (7, 1, 45, 45, 10, 20), (8, 1, 80, 80, 15, 30),
(9, 1, 55, 55, 10, 20), (10, 1, 150, 150, 30, 50), (11, 1, 75, 75, 15, 30), (12, 1, 25, 25, 5, 10),
(13, 1, 100, 100, 20, 40), (14, 1, 70, 70, 15, 30), (15, 1, 20, 20, 5, 10), (16, 1, 10, 10, 3, 5),
(17, 1, 1000, 1000, 200, 500), (18, 1, 800, 800, 200, 300), (19, 1, 600, 600, 100, 200), (20, 1, 400, 400, 100, 200),
(21, 1, 200, 200, 50, 100), (22, 1, 100, 100, 30, 50), (23, 1, 50, 50, 10, 20), (24, 1, 80, 80, 20, 30),
(25, 1, 300, 300, 50, 100), (26, 1, 300, 300, 50, 100), (27, 1, 200, 200, 50, 50), (28, 1, 80, 80, 20, 30),
(29, 1, 150, 150, 30, 50), (30, 1, 60, 60, 10, 20), (31, 1, 100, 100, 20, 40), (32, 1, 40, 40, 10, 20),
(33, 1, 120, 120, 20, 40), (34, 1, 80, 80, 15, 30), (35, 1, 15, 15, 3, 5), (36, 1, 100, 100, 20, 30)
ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, quantity_available = EXCLUDED.quantity_available;

-- Now supplier stock cache should work
INSERT INTO supplier_stock_cache (supplier_id, product_id, supplier_sku, supplier_product_name, quantity_available, supplier_price, lead_time_days, min_order_qty) VALUES
(1, 1, 'RC125B-W60L60-840', 'CoreLine RC125B 60x60 4000K', 500, 72.00, 5, 10),
(1, 3, 'RC125B-W30L120-840', 'CoreLine RC125B 30x120 4000K', 300, 95.00, 5, 10),
(1, 4, 'RC125B-W60L60-DALI', 'CoreLine RC125B DALI', 200, 115.00, 7, 5),
(2, 5, 'LEDVANCE-GU10-7W', 'PARATHOM GU10 7W 830', 2000, 9.80, 3, 50),
(2, 12, 'FL-PFM-200W', 'Floodlight Performance 200W', 100, 240.00, 7, 5),
(2, 15, 'HB-LED-100W-P', 'High Bay LED Value 100W', 150, 210.00, 7, 5),
(2, 16, 'HB-LED-200W-P', 'High Bay LED Value 200W', 80, 380.00, 10, 3),
(2, 17, 'LED-CLA-E27-12W', 'LED CLA A60 12W 830', 5000, 5.20, 3, 100),
(2, 18, 'LED-GU10-5W', 'LED Value GU10 5W 840', 3000, 6.40, 3, 100),
(2, 19, 'LED-T8-120-18W', 'SubstiTUBE T8 120cm 18W', 4000, 8.80, 3, 50),
(2, 20, 'LED-T8-150-24W', 'SubstiTUBE T8 150cm 24W', 3000, 11.00, 3, 50),
(3, 2, 'ELBA-PAN-6060-36W', 'Panou LED ELBA 60x60 36W CW', 400, 62.00, 3, 10),
(3, 8, 'ELBA-LIN-120-36W', 'Corp Linear ELBA 120cm 36W', 350, 52.00, 5, 10),
(3, 13, 'ELBA-ETAN-120-36W', 'Corp Etanș ELBA 120cm 36W', 500, 42.00, 3, 10),
(3, 14, 'ELBA-ETAN-150-50W', 'Corp Etanș ELBA 150cm 50W', 300, 58.00, 5, 10),
(3, 33, 'ELBA-URG-EXIT', 'Corp Urgență EXIT ELBA', 600, 35.00, 3, 5),
(5, 10, 'STL-PROJ-50W', 'Proiector Stellar 50W IP65', 800, 42.00, 2, 10),
(5, 11, 'STL-PROJ-100W-S', 'Proiector Stellar 100W Senzor', 400, 95.00, 2, 5),
(6, 23, 'SCH-CYABY-3x2.5', 'CYAbY-F 3x2.5 100m', 200, 285.00, 5, 5),
(6, 27, 'SCH-MCB-1P-16A', 'Disjunctor 1P C16 6kA', 1000, 14.50, 3, 20),
(6, 28, 'SCH-RCCB-2P-40A', 'Diferențial 2P 40A 30mA', 300, 72.00, 5, 5),
(7, 21, 'LUM-LED-STRIP-WW', 'Bandă LED 12V 3000K 60L/m 5m', 1000, 17.00, 2, 10),
(7, 22, 'LUM-LED-STRIP-NW-65', 'Bandă LED 24V 4000K IP65 5m', 500, 52.00, 2, 10),
(7, 31, 'LUM-PSU-12V-100W', 'Alimentator LED 12V 100W', 600, 35.00, 2, 5),
(7, 32, 'MW-HLG-150H-24', 'Meanwell HLG-150H-24 IP67', 200, 98.00, 5, 5),
(7, 36, 'LUM-CTRL-WIFI-RGBW', 'Controller WiFi RGBW 24V', 400, 42.00, 2, 10)
ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET quantity_available = EXCLUDED.quantity_available, supplier_price = EXCLUDED.supplier_price;

-- Volume discounts with required start_date
INSERT INTO volume_discounts (product_id, min_quantity, max_quantity, discount_percentage, start_date, currency_code) VALUES
(1, 10, 49, 5.00, '2026-01-01', 'RON'), (1, 50, 199, 10.00, '2026-01-01', 'RON'), (1, 200, NULL, 15.00, '2026-01-01', 'RON'),
(5, 50, 199, 8.00, '2026-01-01', 'RON'), (5, 200, 999, 12.00, '2026-01-01', 'RON'), (5, 1000, NULL, 18.00, '2026-01-01', 'RON'),
(10, 10, 49, 5.00, '2026-01-01', 'RON'), (10, 50, 199, 10.00, '2026-01-01', 'RON'), (10, 200, NULL, 15.00, '2026-01-01', 'RON'),
(17, 100, 499, 10.00, '2026-01-01', 'RON'), (17, 500, 1999, 15.00, '2026-01-01', 'RON'), (17, 2000, NULL, 22.00, '2026-01-01', 'RON')
ON CONFLICT DO NOTHING;

