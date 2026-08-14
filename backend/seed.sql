-- ==========================================================
-- ANCU - Datos Iniciales y Siembra
-- ==========================================================

-- 0. Administradores Iniciales
INSERT INTO admin_users (username, email, password_hash, full_name, role)
VALUES 
    ('admin', 'admin@ancu.uy', 'ancu2026admin', 'Comisión Directiva ANCU', 'SUPERADMIN'),
    ('tesoreria', 'tesoreria@ancu.uy', 'tesoreria2026', 'Tesorería Central ANCU', 'TREASURY')
ON CONFLICT (username) DO NOTHING;

-- 1. Insertar Rifa Activa 2026
INSERT INTO raffles (id, title, subtitle, draw_date, draw_method, ticket_price, total_numbers, status)
VALUES (
    1,
    'Gran Rifa de Colaboración ANCU 2026',
    'Fondo de Equipamiento, Asesoría Jurídica y Actividades Institucionales',
    '2026-08-31 20:00:00-03',
    'Quiniela Nocturna de la Lotería Nacional',
    400.00,
    1000,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- 2. Premios Oficiales con Fotografías y Descripciones
DELETE FROM raffle_prizes WHERE raffle_id = 1;

INSERT INTO raffle_prizes (raffle_id, prize_order, title, description, image_url, estimated_value, regulated, note)
VALUES 
    (1, 1, 'Rifle Deportivo Savage Mark-II F', 'Calibre .22LR, cerrojo de precisión, culata sintética ergonómica de alta resistencia y cargador extraíble de 10 tiros.', 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=600&auto=format&fit=crop&q=80', 750.00, true, 'Requiere THATA vigente y registro legal ante SMA/ANCU.'),
    (1, 2, 'Pistola Taurus G3C Compact Black', 'Calibre 9mm Parabellum, acabado Black Tenifer anticorrosión, 3 cargadores incluidos y miras ajustables de tres puntos.', 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=600&auto=format&fit=crop&q=80', 680.00, true, 'Requiere THATA vigente y registro legal ante SMA/ANCU.'),
    (1, 3, 'Cuchillo de Monte Glock FM81 con Sierra', 'Acero al carbono fosfatado, sierra dorsal, empuñadura de polímero militar y vaina rígida con clip de retención rápida.', 'https://images.unsplash.com/photo-1593487568720-92097fb460fb?w=600&auto=format&fit=crop&q=80', 160.00, false, 'Entrega directa a domicilio en todo el Uruguay.')
ON CONFLICT DO NOTHING;

-- 3. Generar los 1000 números de la rifa (000 al 999)
INSERT INTO raffle_tickets (raffle_id, number, status)
SELECT 1, LPAD(i::text, 3, '0'), 'available'
FROM generate_series(0, 999) AS i
ON CONFLICT (raffle_id, number) DO NOTHING;

-- 4. Sembrar algunos números vendidos/reservados para realismo
UPDATE raffle_tickets 
SET status = 'paid', buyer_name = 'Federico Silva', buyer_phone = '099 123 456', buyer_email = 'fsilva@cazadores.uy', buyer_ci = '4.521.890-2', buyer_dept = 'Lavalleja', payment_method = 'MERCADOPAGO', updated_at = NOW()
WHERE raffle_id = 1 AND number IN ('014', '042', '124', '350', '777');

UPDATE raffle_tickets 
SET status = 'held', buyer_name = 'Juan Ignacio Pérez', buyer_phone = '098 765 432', buyer_email = 'juan.perez@correo.uy', buyer_ci = '3.612.984-1', buyer_dept = 'Tacuarembó', payment_method = 'BROU', held_until = NOW() + INTERVAL '15 minutes', updated_at = NOW()
WHERE raffle_id = 1 AND number IN ('089', '420');

-- 5. Socios iniciales
INSERT INTO members (member_number, first_name, last_name, ci, phone, email, department, thata_number, category, status, valid_until, photo_url)
VALUES 
    ('ANCU-0001', 'Directorio', 'General', '1.111.111-1', '099 000 111', 'info@ancu.uy', 'Lavalleja', 'UY-00001', 'Comisión Directiva', 'ACTIVE', '2027-12-31', 'assets/logo.png'),
    ('ANCU-0012', 'Carlos', 'Mendiondo', '3.842.190-4', '099 888 777', 'carlos.mendiondo@correo.uy', 'Lavalleja', 'UY-88421', 'Socio Pleno Activo', 'ACTIVE', '2026-12-31', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'),
    ('ANCU-0045', 'Martín', 'Larrosa', '4.321.678-9', '091 234 567', 'martin.larrosa@gmail.com', 'Maldonado', 'UY-91204', 'Socio Pleno', 'ACTIVE', '2026-11-30', NULL),
    ('ANCU-0089', 'Gonzalo', 'Ribeiro', '2.987.654-3', '094 555 444', 'gribeiro@campo.uy', 'Rocha', 'UY-45120', 'Socio Adherente', 'OVERDUE', '2026-06-30', NULL)
ON CONFLICT (ci) DO NOTHING;

-- 6. Comprobantes de prueba en bandeja administrativa
INSERT INTO payment_receipts (target_type, reference_id, payer_name, payer_phone, payer_ci, bank_origin, amount, status, notes)
VALUES 
    ('RAFFLE', '089, 420', 'Juan Ignacio Pérez', '098 765 432', '3.612.984-1', 'BROU', 800.00, 'PENDING', 'Transferencia caja de ahorro BROU por 2 boletos'),
    ('MEMBERSHIP', '3.842.190-4', 'Carlos Mendiondo', '099 888 777', '3.842.190-4', 'PREX', 600.00, 'APPROVED', 'Cuota Agosto 2026 aprobada')
ON CONFLICT DO NOTHING;

-- 7. Log de Auditoría Inicial
INSERT INTO audit_logs (action, details, ip_address)
VALUES ('SYSTEM_INIT', '{"message": "Sistema inicializado con base de datos PostgreSQL y 1000 números cargados"}'::jsonb, '127.0.0.1');
