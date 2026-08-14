-- ==========================================================
-- ANCU - Datos Iniciales y Siembra
-- ==========================================================

-- 1. Insertar Rifa Activa 2026
INSERT INTO raffles (id, title, subtitle, draw_date, draw_method, ticket_price, total_numbers, status)
VALUES (
    1,
    'Gran Rifa de Colaboración ANCU 2026',
    'Fondo de Equipamiento y Actividades Institucionales',
    '2026-08-31 20:00:00-03',
    'Quiniela Nocturna de la Lotería Nacional',
    400.00,
    1000,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- 2. Premios Oficiales
INSERT INTO raffle_prizes (raffle_id, prize_order, title, regulated, note)
VALUES 
    (1, 1, '1 Rifle Deportivo Savage Mark-II F Cal. .22LR', true, 'Requiere THATA vigente para entrega legal'),
    (1, 2, '1 Pistola Taurus G3C Compact Black Cal. 9mm', true, 'Requiere THATA vigente para entrega legal'),
    (1, 3, '1 Cuchillo de Supervivencia y Monte Glock FM81', false, 'Entrega directa')
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
