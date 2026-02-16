-- B2B Platform Seed Data - Lighting & Electrical Products

-- Insert admin user first
INSERT INTO users (email, password_hash, first_name, last_name, role, phone_number) VALUES
('admin@ledux.ro', '$2b$12$LJ3m4ks8Qx.H6x4Y5ZOmXeQKQh9N4JF6HkG5pN2mQXqZ8FS5ydRq', 'Admin', 'Ledux', 'admin', '0740000000')
ON CONFLICT (email) DO NOTHING;

-- Categories for Lighting & Electrical
INSERT INTO categories (id, parent_id, name, slug, description, sort_order, is_active) VALUES
-- Main categories
(1, NULL, 'Iluminat Interior', 'iluminat-interior', 'Corpuri de iluminat pentru interior', 1, true),
(2, NULL, 'Iluminat Exterior', 'iluminat-exterior', 'Corpuri de iluminat pentru exterior', 2, true),
(3, NULL, 'Iluminat Industrial', 'iluminat-industrial', 'Corpuri de iluminat industrial și hale', 3, true),
(4, NULL, 'Surse de Lumină', 'surse-de-lumina', 'Becuri, tuburi LED, module LED', 4, true),
(5, NULL, 'Materiale Electrice', 'materiale-electrice', 'Cabluri, întrerupătoare, prize, tablouri', 5, true),
(6, NULL, 'Automatizări & Smart', 'automatizari-smart', 'Controlere, senzori, sisteme smart', 6, true),
(7, NULL, 'Alimentatoare & Drivere', 'alimentatoare-drivere', 'Surse de alimentare, drivere LED', 7, true),
(8, NULL, 'Accesorii Iluminat', 'accesorii-iluminat', 'Șine, conectori, reflectori, difuzori', 8, true),
-- Subcategories - Iluminat Interior
(10, 1, 'Panouri LED', 'panouri-led', 'Panouri LED încastrate și aplicabile', 1, true),
(11, 1, 'Spoturi LED', 'spoturi-led', 'Spoturi LED încastrate, pe șină, aplicabile', 2, true),
(12, 1, 'Corpuri LED Lineare', 'corpuri-led-lineare', 'Profile LED, corpuri lineare', 3, true),
(13, 1, 'Downlight-uri', 'downlight-uri', 'Corpuri de iluminat downlight', 4, true),
(14, 1, 'Lustre & Pendule', 'lustre-pendule', 'Lustre, pendule, suspensii', 5, true),
(15, 1, 'Aplice Perete', 'aplice-perete', 'Aplice de perete decorative și funcționale', 6, true),
-- Subcategories - Iluminat Exterior
(20, 2, 'Proiectoare LED', 'proiectoare-led', 'Proiectoare LED exterior', 1, true),
(21, 2, 'Stâlpi Iluminat', 'stalpi-iluminat', 'Stâlpi și corpuri stradal', 2, true),
(22, 2, 'Aplice Exterior', 'aplice-exterior', 'Aplice de exterior IP65+', 3, true),
(23, 2, 'Iluminat Grădină', 'iluminat-gradina', 'Corpuri iluminat peisagistic', 4, true),
-- Subcategories - Industrial
(30, 3, 'Corpuri Etanșe LED', 'corpuri-etanse-led', 'Corpuri etanșe pentru hale, parcări', 1, true),
(31, 3, 'Hale & Depozite', 'hale-depozite', 'High-bay, low-bay industrial', 2, true),
(32, 3, 'Iluminat de Urgență', 'iluminat-urgenta', 'Corpuri de urgență și exit', 3, true),
-- Subcategories - Surse de lumină
(40, 4, 'Becuri LED', 'becuri-led', 'Becuri LED E27, E14, GU10', 1, true),
(41, 4, 'Tuburi LED', 'tuburi-led', 'Tuburi LED T8, T5', 2, true),
(42, 4, 'Benzi LED', 'benzi-led', 'Benzi LED flexibile', 3, true),
(43, 4, 'Module LED', 'module-led', 'Module LED pentru reclame', 4, true),
-- Subcategories - Materiale Electrice
(50, 5, 'Cabluri & Conductoare', 'cabluri-conductoare', 'Cabluri electrice, conductoare', 1, true),
(51, 5, 'Întrerupătoare & Prize', 'intrerupatoare-prize', 'Aparataj electric', 2, true),
(52, 5, 'Tablouri Electrice', 'tablouri-electrice', 'Tablouri de distribuție', 3, true),
(53, 5, 'Siguranțe & Protecții', 'sigurante-protectii', 'Disjunctoare, diferențiale', 4, true),
-- Subcategories - Automatizări
(60, 6, 'Senzori de Mișcare', 'senzori-miscare', 'Senzori PIR, microunde', 1, true),
(61, 6, 'Controlere LED', 'controlere-led', 'Controlere DALI, DMX, WiFi', 2, true),
(62, 6, 'Sisteme Smart Home', 'sisteme-smart-home', 'Controlere Zigbee, WiFi, KNX', 3, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description;

-- Reset sequence
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- Suppliers
INSERT INTO suppliers (id, name, code, email, phone, website, country, city, address, payment_terms, lead_time_days, rating, is_active, notes) VALUES
(1, 'Philips Lighting Romania', 'PHILIPS', 'orders@philips.ro', '021-123-4567', 'https://www.philips.ro', 'Romania', 'București', 'Bd. Iuliu Maniu 7', 'NET30', 5, 5.0, true, 'Distribuitor oficial Philips/Signify'),
(2, 'Osram / Ledvance', 'OSRAM', 'orders@ledvance.ro', '021-234-5678', 'https://www.ledvance.ro', 'Romania', 'București', 'Str. Industriei 10', 'NET30', 7, 4.8, true, 'Distribuitor Osram/Ledvance'),
(3, 'Elba SA', 'ELBA', 'comenzi@elba.ro', '0244-123-456', 'https://www.elba.ro', 'Romania', 'Timișoara', 'Str. Constructorilor 2', 'NET45', 10, 4.5, true, 'Producător român corpuri iluminat'),
(4, 'Gewiss Romania', 'GEWISS', 'sales@gewiss.ro', '021-345-6789', 'https://www.gewiss.com', 'Romania', 'București', 'Str. Telecomunicațiilor 15', 'NET30', 7, 4.7, true, 'Materiale electrice, corpuri iluminat'),
(5, 'Stellar Lighting', 'STELLAR', 'info@stellar.ro', '0256-789-012', 'https://www.stellar.ro', 'Romania', 'Arad', 'Zona Industrială Vest', 'NET15', 3, 4.0, true, 'Producător LED-uri'),
(6, 'Schrack Technik', 'SCHRACK', 'office@schrack.ro', '021-456-7890', 'https://www.schrack.ro', 'Romania', 'București', 'Bd. Biruinței 189', 'NET30', 5, 4.6, true, 'Distribuitor materiale electrice'),
(7, 'Lumen LED', 'LUMEN', 'comenzi@lumen.ro', '0740-123-456', 'https://www.lumen.ro', 'Romania', 'Cluj-Napoca', 'Str. Fabricii 5', 'NET15', 2, 4.3, true, 'Import benzi LED, alimentatoare')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('suppliers_id_seq', (SELECT MAX(id) FROM suppliers));

-- Warehouses
INSERT INTO warehouses (id, name, code, address, city, country, is_active) VALUES
(1, 'Depozit Principal', 'DEP-MAIN', 'Str. Depozitului 1', 'București', 'Romania', true),
(2, 'Depozit Secundar', 'DEP-SEC', 'Str. Industriei 5', 'Cluj-Napoca', 'Romania', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('warehouses_id_seq', (SELECT MAX(id) FROM warehouses));

-- Products - Panouri LED
INSERT INTO products (id, category_id, sku, name, description, short_description, base_price, currency_code, unit_of_measure, is_active, supplier_id, min_order_quantity) VALUES
(1, 10, 'PAN-LED-6060-40W', 'Panou LED 60x60 40W 4000K', 'Panou LED încastrat 595x595mm, 40W, 4000lm, 4000K alb neutru, driver inclus, UGR<19', 'Panou LED 60x60 40W alb neutru', 85.00, 'RON', 'buc', true, 1, 1),
(2, 10, 'PAN-LED-6060-36W', 'Panou LED 60x60 36W 6500K', 'Panou LED încastrat 595x595mm, 36W, 3600lm, 6500K alb rece, driver inclus', 'Panou LED 60x60 36W alb rece', 75.00, 'RON', 'buc', true, 3, 1),
(3, 10, 'PAN-LED-30120-40W', 'Panou LED 30x120 40W 4000K', 'Panou LED încastrat 295x1195mm, 40W, 4400lm, 4000K, UGR<19, cadru aluminiu', 'Panou LED 30x120 40W', 110.00, 'RON', 'buc', true, 1, 1),
(4, 10, 'PAN-LED-6060-DALI', 'Panou LED 60x60 40W DALI', 'Panou LED 595x595mm, 40W, 4000lm, 4000K, driver DALI dimmabil', 'Panou LED DALI dimmabil', 135.00, 'RON', 'buc', true, 1, 1),
-- Spoturi LED
(5, 11, 'SPOT-GU10-7W-WW', 'Spot LED GU10 7W 3000K', 'Spot LED GU10, 7W, 600lm, 3000K alb cald, unghi 38°', 'Spot LED GU10 7W', 12.50, 'RON', 'buc', true, 2, 10),
(6, 11, 'SPOT-INC-15W-NW', 'Spot LED Încastrat 15W 4000K', 'Spot LED încastrat rotund, 15W, 1200lm, 4000K, alb, Ø170mm', 'Spot LED încastrat 15W', 35.00, 'RON', 'buc', true, 5, 1),
(7, 11, 'SPOT-TRACK-30W', 'Spot LED pe Șină 30W 4000K', 'Spot LED pe șină monofazată, 30W, 2700lm, 4000K, negru, COB', 'Spot LED pe șină 30W', 95.00, 'RON', 'buc', true, 3, 1),
-- Corpuri lineare
(8, 12, 'LIN-LED-120-36W', 'Corp Linear LED 120cm 36W', 'Corp de iluminat linear LED, 120cm, 36W, 3600lm, 4000K, montaj aparent/suspendat', 'Corp linear LED 120cm', 65.00, 'RON', 'buc', true, 3, 1),
(9, 12, 'LIN-LED-150-50W', 'Corp Linear LED 150cm 50W', 'Corp de iluminat linear LED, 150cm, 50W, 5500lm, 4000K, IP44, baie/bucătărie', 'Corp linear LED 150cm', 85.00, 'RON', 'buc', true, 3, 1),
-- Proiectoare LED
(10, 20, 'PROJ-LED-50W', 'Proiector LED 50W IP65', 'Proiector LED exterior, 50W, 5000lm, 4000K, IP65, negru, SMD', 'Proiector LED 50W', 55.00, 'RON', 'buc', true, 5, 1),
(11, 20, 'PROJ-LED-100W', 'Proiector LED 100W IP65', 'Proiector LED exterior, 100W, 10000lm, 4000K, IP65, cu senzor', 'Proiector LED 100W cu senzor', 120.00, 'RON', 'buc', true, 5, 1),
(12, 20, 'PROJ-LED-200W', 'Proiector LED 200W IP66', 'Proiector LED industrial, 200W, 24000lm, 5000K, IP66, Osram chips', 'Proiector LED 200W industrial', 280.00, 'RON', 'buc', true, 2, 1),
-- Corpuri etanșe
(13, 30, 'ETAN-LED-120-36W', 'Corp Etanș LED 120cm 36W IP65', 'Corp de iluminat etanș LED, 120cm, 36W, 3600lm, 4000K, IP65, policarbonat', 'Corp etanș LED 120cm', 55.00, 'RON', 'buc', true, 3, 1),
(14, 30, 'ETAN-LED-150-50W', 'Corp Etanș LED 150cm 50W IP65', 'Corp de iluminat etanș LED, 150cm, 50W, 5000lm, 4000K, IP65', 'Corp etanș LED 150cm', 75.00, 'RON', 'buc', true, 3, 1),
-- High-bay
(15, 31, 'HB-LED-100W', 'High Bay LED 100W', 'Corp iluminat industrial high-bay LED, 100W, 14000lm, 5000K, IP65, unghi 90°', 'High Bay LED 100W', 250.00, 'RON', 'buc', true, 2, 1),
(16, 31, 'HB-LED-200W', 'High Bay LED 200W', 'Corp iluminat industrial high-bay LED, 200W, 28000lm, 5000K, IP65, driver Meanwell', 'High Bay LED 200W', 450.00, 'RON', 'buc', true, 2, 1),
-- Becuri LED
(17, 40, 'BEC-LED-E27-12W', 'Bec LED E27 12W 3000K', 'Bec LED A60, E27, 12W, 1055lm, 3000K, 15000h, CRI>80', 'Bec LED E27 12W', 6.50, 'RON', 'buc', true, 2, 20),
(18, 40, 'BEC-LED-GU10-5W', 'Bec LED GU10 5W 4000K', 'Bec LED GU10, 5W, 450lm, 4000K, unghi 36°, CRI>80', 'Bec LED GU10 5W', 8.00, 'RON', 'buc', true, 2, 10),
-- Tuburi LED
(19, 41, 'TUB-LED-T8-120', 'Tub LED T8 120cm 18W', 'Tub LED T8, 120cm, 18W, 1800lm, 4000K, sticlă, compatibil balast', 'Tub LED T8 120cm', 11.00, 'RON', 'buc', true, 2, 25),
(20, 41, 'TUB-LED-T8-150', 'Tub LED T8 150cm 24W', 'Tub LED T8, 150cm, 24W, 2600lm, 6500K, sticlă, alimentare unilaterală', 'Tub LED T8 150cm', 14.00, 'RON', 'buc', true, 2, 25),
-- Benzi LED
(21, 42, 'BAND-LED-WW-5M', 'Bandă LED 12V 3000K 5m', 'Bandă LED flexibilă, 12V, 3000K, 60LED/m, 4.8W/m, IP20, 5m/rolă', 'Bandă LED 12V WW 5m', 22.00, 'RON', 'rolă', true, 7, 5),
(22, 42, 'BAND-LED-NW-IP65', 'Bandă LED 24V 4000K IP65 5m', 'Bandă LED flexibilă, 24V, 4000K, 120LED/m, 14.4W/m, IP65, 5m/rolă', 'Bandă LED 24V NW IP65', 65.00, 'RON', 'rolă', true, 7, 5),
-- Cabluri
(23, 50, 'CABLU-CYABY-3x2.5', 'Cablu CYAbY-F 3x2.5mm²', 'Cablu electric CYAbY-F 3x2.5mm², 100m/colac', 'Cablu CYAbY 3x2.5', 320.00, 'RON', 'colac', true, 6, 1),
(24, 50, 'CABLU-FY-2.5', 'Conductor FY 2.5mm²', 'Conductor FY 2.5mm², H07V-U, 100m/colac', 'Conductor FY 2.5mm²', 95.00, 'RON', 'colac', true, 6, 1),
-- Întrerupătoare
(25, 51, 'INT-SIMP-ALB', 'Întrerupător Simplu Alb', 'Întrerupător simplu, montaj aparent, alb, 10A, IP20', 'Întrerupător simplu alb', 8.50, 'RON', 'buc', true, 4, 10),
(26, 51, 'PRIZA-SCHUKO-ALB', 'Priză Schuko Albă cu CP', 'Priză Schuko cu contact de protecție, alb, 16A, IP20', 'Priză Schuko cu CP', 9.50, 'RON', 'buc', true, 4, 10),
-- Siguranțe
(27, 53, 'DISJ-1P-16A', 'Disjunctor 1P 16A Curba C', 'Disjunctor monopolar 16A, curba C, 6kA, montaj DIN', 'Disjunctor 1P 16A', 18.00, 'RON', 'buc', true, 6, 5),
(28, 53, 'DIF-2P-40A-30mA', 'Diferențial 2P 40A 30mA', 'Dispozitiv diferențial 2P, 40A, 30mA, tip AC', 'Diferențial 2P 40A', 85.00, 'RON', 'buc', true, 6, 1),
-- Senzori
(29, 60, 'SENZ-PIR-360', 'Senzor de Mișcare PIR 360°', 'Senzor de mișcare PIR, montaj tavan, 360°, 6m, IP20, alb', 'Senzor PIR 360°', 25.00, 'RON', 'buc', true, 4, 5),
(30, 60, 'SENZ-MICRO-HF', 'Senzor Microunde HF', 'Senzor microunde, montaj tavan, 360°, 8m, IP20, detectare prin materiale', 'Senzor microunde HF', 45.00, 'RON', 'buc', true, 4, 1),
-- Alimentatoare
(31, 7, 'ALIM-LED-12V-100W', 'Alimentator LED 12V 100W', 'Alimentator LED, 12V DC, 100W, 8.3A, IP20, metal', 'Alimentator LED 12V 100W', 45.00, 'RON', 'buc', true, 7, 1),
(32, 7, 'ALIM-LED-24V-150W', 'Alimentator LED 24V 150W IP67', 'Alimentator LED, 24V DC, 150W, 6.25A, IP67, Meanwell', 'Alimentator LED 24V IP67', 120.00, 'RON', 'buc', true, 7, 1),
-- Iluminat urgență
(33, 32, 'URG-LED-EXIT', 'Corp Iluminat Urgență EXIT', 'Corp de urgență EXIT LED, 3W, autonomie 3h, IP20, pictogramă dubla față', 'Corp urgență EXIT', 45.00, 'RON', 'buc', true, 3, 1),
(34, 32, 'URG-LED-3W', 'Corp Iluminat Urgență 3W', 'Corp de urgență LED, 3W, autonomie 3h, IP65, montaj aparent', 'Corp urgență LED 3W', 38.00, 'RON', 'buc', true, 3, 1),
-- Controlere
(35, 61, 'CTRL-DALI-4CH', 'Controller DALI 4 Canale', 'Controller DALI cu 4 canale de ieșire, gateway, configurare prin app', 'Controller DALI 4CH', 180.00, 'RON', 'buc', true, 1, 1),
(36, 61, 'CTRL-WIFI-RGB', 'Controller WiFi RGB+W', 'Controller WiFi pentru benzi LED RGB+W, 24V, 4x6A, compatibil Tuya', 'Controller WiFi RGBW', 55.00, 'RON', 'buc', true, 7, 1)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, base_price = EXCLUDED.base_price, description = EXCLUDED.description;

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- Product Specifications
INSERT INTO product_specifications (product_id, wattage, lumens, color_temperature, cri, beam_angle, ip_rating, efficacy, dimmable, dimming_type, voltage_input, mounting_type, material, color, lifespan_hours, warranty_years, certification_ce, certification_rohs, energy_class, brand, manufacturer, country_of_origin) VALUES
(1, 40, 4000, 4000, 80, 120, 'IP20', 100, false, NULL, '220-240V', 'Recessed', 'Aluminium', 'White', 50000, 5, true, true, 'A+', 'Philips', 'Signify', 'Poland'),
(2, 36, 3600, 6500, 80, 120, 'IP20', 100, false, NULL, '220-240V', 'Recessed', 'Aluminium', 'White', 40000, 3, true, true, 'A+', 'Elba', 'Elba SA', 'Romania'),
(3, 40, 4400, 4000, 80, 120, 'IP20', 110, false, NULL, '220-240V', 'Recessed', 'Aluminium', 'White', 50000, 5, true, true, 'A+', 'Philips', 'Signify', 'Poland'),
(4, 40, 4000, 4000, 80, 120, 'IP20', 100, true, 'DALI', '220-240V', 'Recessed', 'Aluminium', 'White', 50000, 5, true, true, 'A+', 'Philips', 'Signify', 'Poland'),
(5, 7, 600, 3000, 80, 38, 'IP20', 85.7, false, NULL, '220-240V', 'Track', 'Plastic', 'White', 25000, 2, true, true, 'A+', 'Osram', 'Ledvance', 'China'),
(6, 15, 1200, 4000, 80, 60, 'IP20', 80, false, NULL, '220-240V', 'Recessed', 'Aluminium', 'White', 30000, 2, true, true, 'A', 'Stellar', 'Stellar Lighting', 'Romania'),
(7, 30, 2700, 4000, 90, 24, 'IP20', 90, false, NULL, '220-240V', 'Track', 'Aluminium', 'Black', 50000, 3, true, true, 'A+', 'Elba', 'Elba SA', 'Romania'),
(8, 36, 3600, 4000, 80, 120, 'IP20', 100, false, NULL, '220-240V', 'Surface', 'Steel', 'White', 40000, 3, true, true, 'A+', 'Elba', 'Elba SA', 'Romania'),
(9, 50, 5500, 4000, 80, 120, 'IP44', 110, false, NULL, '220-240V', 'Surface', 'Steel', 'White', 40000, 3, true, true, 'A+', 'Elba', 'Elba SA', 'Romania'),
(10, 50, 5000, 4000, 80, 120, 'IP65', 100, false, NULL, '220-240V', 'Wall', 'Aluminium', 'Black', 30000, 2, true, true, 'A', 'Stellar', 'Stellar Lighting', 'Romania'),
(11, 100, 10000, 4000, 80, 120, 'IP65', 100, false, NULL, '220-240V', 'Wall', 'Aluminium', 'Black', 30000, 2, true, true, 'A', 'Stellar', 'Stellar Lighting', 'Romania'),
(12, 200, 24000, 5000, 80, 90, 'IP66', 120, false, NULL, '220-240V', 'Wall', 'Aluminium', 'Grey', 50000, 5, true, true, 'A+', 'Osram', 'Ledvance', 'Germany'),
(13, 36, 3600, 4000, 80, 120, 'IP65', 100, false, NULL, '220-240V', 'Surface', 'Polycarbonate', 'White', 40000, 3, true, true, 'A+', 'Elba', 'Elba SA', 'Romania'),
(14, 50, 5000, 4000, 80, 120, 'IP65', 100, false, NULL, '220-240V', 'Surface', 'Polycarbonate', 'White', 40000, 3, true, true, 'A+', 'Elba', 'Elba SA', 'Romania'),
(15, 100, 14000, 5000, 80, 90, 'IP65', 140, false, NULL, '220-240V', 'Pendant', 'Aluminium', 'Grey', 50000, 5, true, true, 'A++', 'Osram', 'Ledvance', 'Germany'),
(16, 200, 28000, 5000, 80, 60, 'IP65', 140, true, '0-10V', '220-240V', 'Pendant', 'Aluminium', 'Grey', 50000, 5, true, true, 'A++', 'Osram', 'Ledvance', 'Germany'),
(17, 12, 1055, 3000, 80, 200, 'IP20', 87.9, false, NULL, '220-240V', NULL, 'Plastic', 'White', 15000, 2, true, true, 'A', 'Osram', 'Ledvance', 'China'),
(18, 5, 450, 4000, 80, 36, 'IP20', 90, false, NULL, '220-240V', NULL, 'Plastic', 'White', 15000, 2, true, true, 'A', 'Osram', 'Ledvance', 'China'),
(19, 18, 1800, 4000, 80, 160, 'IP20', 100, false, NULL, '220-240V', NULL, 'Glass', 'White', 30000, 2, true, true, 'A+', 'Osram', 'Ledvance', 'China'),
(20, 24, 2600, 6500, 80, 160, 'IP20', 108.3, false, NULL, '220-240V', NULL, 'Glass', 'White', 30000, 2, true, true, 'A+', 'Osram', 'Ledvance', 'China'),
(21, 4.8, NULL, 3000, 80, 120, 'IP20', NULL, false, NULL, '12V DC', NULL, 'Flexible PCB', NULL, 25000, 1, true, true, NULL, 'Lumen', 'Lumen LED', 'China'),
(22, 14.4, NULL, 4000, 80, 120, 'IP65', NULL, false, NULL, '24V DC', NULL, 'Flexible PCB', NULL, 25000, 2, true, true, NULL, 'Lumen', 'Lumen LED', 'China'),
(29, NULL, NULL, NULL, NULL, 360, 'IP20', NULL, NULL, NULL, '220-240V', 'Surface', 'Plastic', 'White', NULL, 2, true, true, NULL, 'Gewiss', 'Gewiss', 'Italy'),
(30, NULL, NULL, NULL, NULL, 360, 'IP20', NULL, NULL, NULL, '220-240V', 'Surface', 'Plastic', 'White', NULL, 2, true, true, NULL, 'Gewiss', 'Gewiss', 'Italy'),
(31, 100, NULL, NULL, NULL, NULL, 'IP20', NULL, NULL, NULL, '220-240V', NULL, 'Metal', NULL, 30000, 2, true, true, NULL, 'Lumen', 'Lumen LED', 'China'),
(32, 150, NULL, NULL, NULL, NULL, 'IP67', NULL, NULL, NULL, '220-240V', NULL, 'Metal', NULL, 50000, 5, true, true, NULL, 'Meanwell', 'Meanwell', 'Taiwan'),
(33, 3, NULL, NULL, NULL, NULL, 'IP20', NULL, NULL, NULL, '220-240V', 'Surface', 'Plastic', 'White', NULL, 2, true, true, NULL, 'Elba', 'Elba SA', 'Romania'),
(34, 3, NULL, NULL, NULL, NULL, 'IP65', NULL, NULL, NULL, '220-240V', 'Surface', 'Polycarbonate', 'White', NULL, 2, true, true, NULL, 'Elba', 'Elba SA', 'Romania'),
(35, NULL, NULL, NULL, NULL, NULL, 'IP20', NULL, NULL, 'DALI', '220-240V', 'DIN Rail', 'Plastic', NULL, NULL, 2, true, true, NULL, 'Philips', 'Signify', 'Netherlands'),
(36, NULL, NULL, NULL, NULL, NULL, 'IP20', NULL, NULL, 'WiFi', '24V DC', NULL, 'Plastic', 'White', NULL, 1, true, true, NULL, 'Lumen', 'Lumen LED', 'China')
ON CONFLICT (product_id) DO UPDATE SET wattage = EXCLUDED.wattage, lumens = EXCLUDED.lumens, brand = EXCLUDED.brand;

-- Stock levels
INSERT INTO stock_levels (product_id, warehouse_id, quantity, min_quantity, max_quantity) VALUES
(1, 1, 120, 20, 500), (2, 1, 85, 20, 500), (3, 1, 60, 10, 300), (4, 1, 30, 5, 200),
(5, 1, 500, 100, 2000), (6, 1, 200, 50, 1000), (7, 1, 45, 10, 200), (8, 1, 80, 15, 300),
(9, 1, 55, 10, 200), (10, 1, 150, 30, 500), (11, 1, 75, 15, 300), (12, 1, 25, 5, 100),
(13, 1, 100, 20, 400), (14, 1, 70, 15, 300), (15, 1, 20, 5, 80), (16, 1, 10, 3, 50),
(17, 1, 1000, 200, 5000), (18, 1, 800, 200, 3000), (19, 1, 600, 100, 2000), (20, 1, 400, 100, 2000),
(21, 1, 200, 50, 500), (22, 1, 100, 30, 300), (23, 1, 50, 10, 200), (24, 1, 80, 20, 300),
(25, 1, 300, 50, 1000), (26, 1, 300, 50, 1000), (27, 1, 200, 50, 500), (28, 1, 80, 20, 300),
(29, 1, 150, 30, 500), (30, 1, 60, 10, 200), (31, 1, 100, 20, 400), (32, 1, 40, 10, 200),
(33, 1, 120, 20, 400), (34, 1, 80, 15, 300), (35, 1, 15, 3, 50), (36, 1, 100, 20, 300)
ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Supplier stock cache (simulated supplier inventory)
INSERT INTO supplier_stock_cache (supplier_id, product_id, supplier_sku, supplier_product_name, quantity_available, supplier_price, lead_time_days, min_order_qty) VALUES
(1, 1, 'RC125B-W60L60-840', 'CoreLine RC125B 60x60 4000K', 500, 72.00, 5, 10),
(1, 3, 'RC125B-W30L120-840', 'CoreLine RC125B 30x120 4000K', 300, 95.00, 5, 10),
(1, 4, 'RC125B-W60L60-840-DALI', 'CoreLine RC125B DALI', 200, 115.00, 7, 5),
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

-- Volume discounts
INSERT INTO volume_discounts (product_id, min_quantity, max_quantity, discount_percentage) VALUES
(1, 10, 49, 5.00), (1, 50, 199, 10.00), (1, 200, NULL, 15.00),
(5, 50, 199, 8.00), (5, 200, 999, 12.00), (5, 1000, NULL, 18.00),
(10, 10, 49, 5.00), (10, 50, 199, 10.00), (10, 200, NULL, 15.00),
(17, 100, 499, 10.00), (17, 500, 1999, 15.00), (17, 2000, NULL, 22.00),
(19, 50, 199, 8.00), (19, 200, 999, 12.00), (19, 1000, NULL, 18.00),
(23, 5, 19, 3.00), (23, 20, 49, 5.00), (23, 50, NULL, 8.00),
(25, 50, 199, 5.00), (25, 200, 999, 10.00), (25, 1000, NULL, 15.00),
(27, 20, 99, 5.00), (27, 100, 499, 10.00), (27, 500, NULL, 15.00)
ON CONFLICT DO NOTHING;

-- Demo B2B customer
INSERT INTO b2b_customers (id, company_name, cui, reg_com, legal_address, delivery_address, contact_person, email, phone, bank_name, iban, tier, discount_percentage, credit_limit, credit_used, payment_terms_days, status) VALUES
(1, 'ElectroInstal SRL', 'RO12345678', 'J40/1234/2020', 'Str. Electricienilor 15, București', 'Str. Electricienilor 15, București', 'Ion Popescu', 'ion@electroinstal.ro', '0721-123-456', 'BCR', 'RO49RNCB0074029734720001', 'GOLD', 15.00, 100000, 35000, 30, 'ACTIVE'),
(2, 'LuminaPro SRL', 'RO87654321', 'J12/5678/2019', 'Str. Luminii 8, Cluj-Napoca', 'Str. Luminii 8, Cluj-Napoca', 'Maria Ionescu', 'maria@luminapro.ro', '0732-234-567', 'BRD', 'RO49BRDE0074029734720002', 'SILVER', 10.00, 50000, 12000, 30, 'ACTIVE'),
(3, 'ProElectric SA', 'RO11223344', 'J35/9012/2018', 'Bd. Energiei 22, Timișoara', 'Bd. Energiei 22, Timișoara', 'Alexandru Marin', 'alex@proelectric.ro', '0743-345-678', 'ING', 'RO49INGB0074029734720003', 'PLATINUM', 20.00, 200000, 85000, 45, 'ACTIVE'),
(4, 'LedTech SRL', 'RO55667788', 'J40/3456/2021', 'Str. Inovației 3, Iași', 'Str. Inovației 3, Iași', 'Elena Dumitrescu', 'elena@ledtech.ro', '0754-456-789', 'Raiffeisen', 'RO49RZBR0074029734720004', 'STANDARD', 0, 20000, 5000, 15, 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name;

SELECT setval('b2b_customers_id_seq', (SELECT MAX(id) FROM b2b_customers));

-- Demo B2B orders
INSERT INTO b2b_orders (id, order_number, customer_id, status, order_type, subtotal, discount_amount, vat_amount, total, payment_method, payment_status, shipping_address, notes) VALUES
(1, 'B2B-2026-0001', 1, 'DELIVERED', 'STANDARD', 8500, 1275, 1372.75, 8597.75, 'CREDIT', 'PAID', 'Str. Electricienilor 15, București', 'Comanda lunară panouri LED'),
(2, 'B2B-2026-0002', 3, 'PROCESSING', 'BULK', 25000, 5000, 3800, 23800, 'TRANSFER', 'UNPAID', 'Bd. Energiei 22, Timișoara', 'Proiect hală industrială'),
(3, 'B2B-2026-0003', 2, 'CONFIRMED', 'STANDARD', 3200, 320, 547.20, 3427.20, 'CREDIT', 'UNPAID', 'Str. Luminii 8, Cluj-Napoca', 'Reaprovizionare spoturi')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

SELECT setval('b2b_orders_id_seq', (SELECT MAX(id) FROM b2b_orders));

