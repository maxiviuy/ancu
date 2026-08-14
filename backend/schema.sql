-- ==========================================================
-- ANCU - Base de Datos PostgreSQL
-- Asociación Nacional de Cazadores del Uruguay
-- ==========================================================

-- 0. Tabla de Administradores del Sistema
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ADMIN', -- 'SUPERADMIN', 'ADMIN', 'TREASURY'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Tabla de Rifas
CREATE TABLE IF NOT EXISTS raffles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    draw_date TIMESTAMPTZ NOT NULL,
    draw_method VARCHAR(255) NOT NULL,
    ticket_price NUMERIC(10,2) NOT NULL DEFAULT 400.00,
    total_numbers INTEGER NOT NULL DEFAULT 1000,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DRAFT', 'CLOSED', 'FINISHED'
    banner_image_url TEXT,
    winning_number_1 VARCHAR(10),
    winning_number_2 VARCHAR(10),
    winning_number_3 VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campos adicionales asegurados en raffles
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS banner_image_url TEXT;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winning_number_1 VARCHAR(10);
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winning_number_2 VARCHAR(10);
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winning_number_3 VARCHAR(10);
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Premios de Rifa
CREATE TABLE IF NOT EXISTS raffle_prizes (
    id SERIAL PRIMARY KEY,
    raffle_id INTEGER REFERENCES raffles(id) ON DELETE CASCADE,
    prize_order INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    estimated_value NUMERIC(10,2) DEFAULT 0.00,
    regulated BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT
);

-- Campos adicionales asegurados en raffle_prizes
ALTER TABLE raffle_prizes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE raffle_prizes ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE raffle_prizes ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2) DEFAULT 0.00;

-- 3. Números y Boletos de la Rifa
CREATE TABLE IF NOT EXISTS raffle_tickets (
    id SERIAL PRIMARY KEY,
    raffle_id INTEGER REFERENCES raffles(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available', -- 'available', 'held', 'paid'
    buyer_name VARCHAR(255),
    buyer_phone VARCHAR(50),
    buyer_email VARCHAR(255),
    buyer_ci VARCHAR(50),
    buyer_dept VARCHAR(100),
    payment_method VARCHAR(50), -- 'MERCADOPAGO', 'BROU', 'PREX', 'EFECTIVO'
    payment_ref VARCHAR(255),
    receipt_url TEXT,
    held_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_raffle_number UNIQUE (raffle_id, number)
);

CREATE INDEX IF NOT EXISTS idx_tickets_raffle_status ON raffle_tickets (raffle_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_held_until ON raffle_tickets (held_until) WHERE status = 'held';

-- 4. Padrón Oficial de Socios
CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    member_number VARCHAR(50) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    ci VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Lavalleja',
    thata_number VARCHAR(50),
    category VARCHAR(50) NOT NULL DEFAULT 'Socio Pleno Activo',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'OVERDUE', 'PENDING_APPROVAL'
    valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_ci ON members (ci);
CREATE INDEX IF NOT EXISTS idx_members_status ON members (status);

-- 5. Cuotas Sociales
CREATE TABLE IF NOT EXISTS membership_fees (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL DEFAULT 600.00,
    period VARCHAR(50) NOT NULL, -- Ej: '2026-08'
    status VARCHAR(20) NOT NULL DEFAULT 'PAID', -- 'PAID', 'PENDING'
    payment_method VARCHAR(50),
    payment_ref VARCHAR(255),
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Comprobantes de Pago y Transferencias
CREATE TABLE IF NOT EXISTS payment_receipts (
    id SERIAL PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL, -- 'RAFFLE' o 'MEMBERSHIP'
    reference_id VARCHAR(255) NOT NULL, -- Números de rifa (ej '124, 125') o Cédula socio
    payer_name VARCHAR(255) NOT NULL,
    payer_phone VARCHAR(50) NOT NULL,
    payer_ci VARCHAR(50),
    bank_origin VARCHAR(50) NOT NULL DEFAULT 'BROU', -- 'BROU', 'PREX'
    receipt_url TEXT,
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_receipts_status ON payment_receipts (status);

-- 7. Registro de Auditoría para Escribano
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
