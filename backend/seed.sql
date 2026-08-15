-- ==========================================================
-- ANCU - Datos Iniciales y Siembra
-- ==========================================================

-- 0. Administradores Iniciales
INSERT INTO admin_users (username, email, password_hash, full_name, role)
VALUES 
    ('admin', 'admin@ancu.uy', 'ancu2026admin', 'Comisión Directiva ANCU', 'SUPERADMIN'),
    ('superadmin', 'superadmin@ancu.uy', 'Astro2026!Admin', 'Super Administrador ANCU', 'SUPERADMIN'),
    ('editor', 'editor@ancu.uy', 'ancu2026editor', 'Redacción y Prensa ANCU', 'EDITOR'),
    ('tesoreria', 'tesoreria@ancu.uy', 'tesoreria2026', 'Tesorería Central ANCU', 'TREASURY')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

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

-- 7. Artículos y Noticias Iniciales (CMS)
INSERT INTO news_articles (title, slug, category, author, publish_date, image_url, excerpt, content, is_featured, status)
VALUES 
    (
        'Posición de ANCU ante las propuestas de modificación de la Ley de Fauna',
        'posicion-ancu-modificacion-ley-fauna-2026',
        'Comunicados',
        'Comisión Directiva ANCU',
        '2026-08-12',
        'assets/hero_uruguay_monte.jpg',
        'La Comisión Directiva expone los fundamentos técnicos y de conservación para mantener la figura de libre caza sobre especies exóticas plaga y agilizar los permisos deportivos.',
        'La Asociación Nacional de Cazadores del Uruguay (ANCU) hace pública su posición institucional frente a los recientes debates parlamentarios sobre la regulación de fauna exótica y especies invasoras.\n\nReiteramos la necesidad de fundamentar las políticas públicas en evidencia científica, reconociendo el rol de los cazadores deportivos y de control como actores fundamentales en el monitoreo y contención del jabalí, ciervo axis y capincho en predios productivos.\n\nExhortamos a las autoridades de DINABISE y del Ministerio de Ganadería a continuar la mesa de diálogo técnico para asegurar normativas claras, seguras y aplicables.',
        true,
        'PUBLISHED'
    ),
    (
        'ANCU coopera en muestreo sanitario de jabalíes junto a la Facultad de Veterinaria',
        'ancu-muestreo-sanitario-jabalies-veterinaria',
        'Conservación',
        'Secretaría Técnica ANCU',
        '2026-08-10',
        'assets/reunion_institucional_ancu.jpg',
        'Un equipo conjunto integrado por biólogos, veterinarios y cazadores de ANCU recolectó muestras en predios del centro y este del país para monitorear enfermedades zoonóticas en poblaciones de jabalí.',
        'En el marco del convenio de cooperación científica, socios acreditados de ANCU participaron en las jornadas de campo para la recolección de muestras biológicas y control de triquinosis y brucelosis porcina.\n\nEste esfuerzo voluntario permite mantener actualizados los mapas epidemiológicos del Uruguay y ratifica el compromiso ético de nuestra comunidad con la salud pública.',
        false,
        'PUBLISHED'
    ),
    (
        'Apertura de la Temporada de Caza Deportiva 2026: Guía Rápida de Especies y Cupos',
        'guia-rapida-apertura-temporada-caza-2026',
        'Resoluciones DINABISE',
        'Área Legal y Reglamentaria',
        '2026-08-01',
        'assets/hero_uruguay_monte.jpg',
        'Resumen detallado de los decretos ministeriales vigentes, cupos diarios de transporte, calibres mínimos autorizados y vigencia de permisos.',
        'Recordamos a todos los socios y cazadores del país los aspectos clave de la normativa 2026:\n\n1. Jabalí (Sus scrofa): Caza libre en todo el territorio nacional con permiso del propietario.\n2. Ciervo Axis: Habilitado bajo cupos departamentales autorizados por DINABISE.\n3. Obligatoriedad de portar THATA vigente y constancia de consentimiento predial.\n\nDescargue el formulario oficial desde nuestro portal.',
        false,
        'PUBLISHED'
    )
ON CONFLICT (slug) DO NOTHING;

-- 8. Comisión Directiva y Autoridades Institucionales
INSERT INTO authorities (id, name, role_title, bio, photo_url, mandate_period, display_order, status)
VALUES 
    (1, 'Julio M. Graña', 'Presidente', 'Representante legal ante ministerios, DINABISE y comisiones técnicas nacionales.', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80', '2024 – 2027', 1, 'ACTIVE'),
    (2, 'Fernando Etcheverry', 'Vicepresidente', 'Coordinación de delegados departamentales y asuntos del interior.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', '2024 – 2027', 2, 'ACTIVE'),
    (3, 'Martín Larrosa', 'Secretario General', 'Actas institucionales, padrón social y comunicaciones públicas oficiales.', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80', '2024 – 2027', 3, 'ACTIVE'),
    (4, 'Ignacio Benítez', 'Tesorero', 'Administración financiera, rendición de cuentas y recaudación de rifas.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', '2024 – 2027', 4, 'ACTIVE'),
    (5, 'Dra. Valeria Silvera', 'Vocal de Conservación', 'Enlace científico y programas de muestreo de fauna con la Universidad.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', '2024 – 2027', 5, 'ACTIVE'),
    (6, 'Rodrigo Cabrera', 'Vocal de Seguridad y Tiro', 'Instructor de tiro habilitado y organizador de cursos de seguridad y balística.', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80', '2024 – 2027', 6, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 9. Configuración y Parámetros Institucionales Globales
INSERT INTO institutional_settings (setting_key, setting_value, category, label)
VALUES 
    ('mandate_period', '2024 – 2027', 'GOVERNANCE', 'Período de Mandato de la Comisión Directiva'),
    ('top_announcement_text', 'Temporada Oficial 2026 Habilitada', 'ANNOUNCEMENT', 'Texto de la Barra Superior de Avisos'),
    ('membership_fee_amount', '600', 'FINANCIAL', 'Valor de Cuota Social Mensual ($ UYU)'),
    ('brou_account_info', 'Caja de Ahorro BROU: 001558921-00001 (Titular: ANCU - Asoc. Nac. Cazadores)', 'FINANCIAL', 'Cuenta BROU para Transferencias'),
    ('prex_account_info', 'Cuenta Prex: 1234-5678-9012 (Titular: ANCU)', 'FINANCIAL', 'Cuenta Prex para Transferencias'),
    ('contact_email', 'info@ancu.uy', 'CONTACT', 'Correo Electrónico de Contacto Oficial'),
    ('contact_phone', '099 123 456', 'CONTACT', 'Teléfono / WhatsApp de Guardia y Secretaría'),
    ('statute_summary', 'Estatuto oficial aprobado y registrado ante el Ministerio de Educación y Cultura (MEC). Rige el funcionamiento democrático, la defensa de la caza ética y los derechos de los asociados.', 'STATUTE', 'Resumen del Estatuto Social'),
    ('statute_pdf_url', 'assets/estatutos_ancu_oficial.pdf', 'STATUTE', 'Ruta al Documento PDF del Estatuto')
ON CONFLICT (setting_key) DO NOTHING;

-- 10. Calendario Inicial de Actividades
INSERT INTO activities (id, title, category, event_date, event_time, location, department, description, price_members, price_general, capacity, registration_status, image_url)
VALUES 
    (
        1,
        'Curso de Seguridad, Balística y Manejo Defensivo',
        'Capacitación',
        '2026-09-12',
        '09:00 a 16:00 hs',
        'Polígono de Tiro Departamental',
        'Lavalleja',
        'Jornada teórico-práctica con instructores habilitados por el SMA. Prácticas de tiro con arma corta y larga, protocolos de seguridad y primeros auxilios de campo.',
        0.00,
        950.00,
        25,
        'OPEN',
        'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=600&auto=format&fit=crop&q=80'
    ),
    (
        2,
        'Jornada de Muestreo de Fauna y Monitoreo con la Facultad de Ciencias',
        'Muestreo Científico',
        '2026-09-26',
        '07:30 hs',
        'Establecimiento El Ombú (Ruta 8 km 140)',
        'Lavalleja',
        'Relevamiento biológico y toma voluntaria de muestras de jabalí en cooperación con investigadores universitarios.',
        0.00,
        0.00,
        40,
        'OPEN',
        'assets/hero_uruguay_monte.jpg'
    ),
    (
        3,
        'Asamblea General Ordinaria de Socios 2026',
        'Asamblea',
        '2026-10-18',
        '19:00 hs',
        'Sede Social Central (Minas)',
        'Lavalleja',
        'Rendición de memoria y balance anual, informe de tesorería y tratamiento de temas institucionales con la Comisión Directiva.',
        0.00,
        0.00,
        100,
        'OPEN',
        'assets/reunion_institucional_ancu.jpg'
    )
ON CONFLICT (id) DO NOTHING;

-- 11. Directorio Inicial de Beneficios Comerciales
INSERT INTO commercial_benefits (id, partner_name, discount_text, category, logo_url, website_url, address, department, display_order, is_active)
VALUES 
    (1, 'Armería El Cazador', '15% de descuento en municiones y accesorios de caza', 'Armerías', 'assets/logo.png', 'https://ancu.uy', '18 de Julio 1420', 'Montevideo', 1, true),
    (2, 'Outdoor & Camping Uruguay', '20% de descuento en indumentaria técnica, carpas y óptica', 'Camping y Óptica', 'assets/logo.png', 'https://ancu.uy', 'Av. Sarandí 680', 'Rivera', 2, true),
    (3, 'Armería y Cuchillería del Este', '10% de descuento en armamento deportivo y cuchillería artesanal', 'Armerías', 'assets/logo.png', 'https://ancu.uy', 'Treinta y Tres 450', 'Lavalleja', 3, true),
    (4, 'Centro de Capacitación Táctica SMA', 'Bonificación del 50% en aranceles de cursos de tiro', 'Capacitación', 'assets/logo.png', 'https://ancu.uy', 'Polígono Nacional', 'Canelones', 4, true)
ON CONFLICT (id) DO NOTHING;

-- 12. Log de Auditoría Inicial
INSERT INTO audit_logs (action, details, ip_address)
VALUES ('SYSTEM_INIT', '{"message": "Sistema inicializado con base de datos PostgreSQL, autoridades, configuraciones y CMS cargados"}'::jsonb, '127.0.0.1');
