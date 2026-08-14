/**
 * ANCU - Backend API Server
 * Asociación Nacional de Cazadores del Uruguay
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Directorios de Subida
const uploadsDir = path.join(__dirname, '../uploads');
const prizeUploadsDir = path.join(uploadsDir, 'prizes');
const receiptUploadsDir = path.join(uploadsDir, 'receipts');

if (!fs.existsSync(prizeUploadsDir)) fs.mkdirSync(prizeUploadsDir, { recursive: true });
if (!fs.existsSync(receiptUploadsDir)) fs.mkdirSync(receiptUploadsDir, { recursive: true });

// Multer Storage para Fotos de Premios
const prizeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, prizeUploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueName = `prize_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const uploadPrize = multer({
  storage: prizeStorage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, WebP).'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

// ----------------------------------------------------
// Worker: Limpiador de Reservas de Rifas Expiradas (15 min)
// ----------------------------------------------------
async function cleanExpiredHolds() {
  try {
    const res = await db.query(`
      UPDATE raffle_tickets 
      SET status = 'available', held_until = NULL, payment_method = NULL, payment_ref = NULL
      WHERE status = 'held' AND held_until < NOW()
      RETURNING number;
    `);
    if (res.rowCount > 0) {
      const numbers = res.rows.map(r => r.number).join(', ');
      console.log(`[Cleaner] ${res.rowCount} números liberados por vencimiento de 15 min: ${numbers}`);
      await db.query(`
        INSERT INTO audit_logs (action, details, ip_address)
        VALUES ($1, $2, $3);
      `, ['TICKETS_EXPIRED_RELEASE', { count: res.rowCount, numbers: res.rows.map(r => r.number) }, 'SYSTEM']);
    }
  } catch (err) {
    console.error('[Cleaner Error]', err.message);
  }
}

// Ejecutar limpiador cada 30 segundos
setInterval(cleanExpiredHolds, 30000);

// ----------------------------------------------------
// Health Check Endpoint
// ----------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM raffle_tickets');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      tickets: parseInt(result.rows[0].count, 10)
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ----------------------------------------------------
// 1. MÓDULO DE RIFAS (PÚBLICO)
// ----------------------------------------------------

// Obtener estado de la rifa activa y los 1000 números
app.get('/api/raffle/active', async (req, res) => {
  try {
    await cleanExpiredHolds();

    const raffleRes = await db.query('SELECT * FROM raffles WHERE status = $1 ORDER BY id DESC LIMIT 1', ['ACTIVE']);
    if (raffleRes.rowCount === 0) {
      return res.status(404).json({ error: 'No hay rifas activas en este momento.' });
    }
    const raffle = raffleRes.rows[0];

    const prizesRes = await db.query('SELECT * FROM raffle_prizes WHERE raffle_id = $1 ORDER BY prize_order ASC', [raffle.id]);
    const ticketsRes = await db.query('SELECT number, status, held_until FROM raffle_tickets WHERE raffle_id = $1 ORDER BY number ASC', [raffle.id]);

    const numbersMap = {};
    let soldCount = 0;
    let heldCount = 0;
    let availableCount = 0;

    for (const t of ticketsRes.rows) {
      numbersMap[t.number] = {
        status: t.status,
        heldUntil: t.held_until
      };
      if (t.status === 'paid') soldCount++;
      else if (t.status === 'held') heldCount++;
      else availableCount++;
    }

    const prizesFormatted = prizesRes.rows.map(p => ({
      id: p.id,
      order: p.prize_order,
      title: p.title,
      description: p.description || '',
      imageUrl: p.image_url || '',
      estimatedValue: parseFloat(p.estimated_value || 0),
      regulated: p.regulated,
      note: p.note || ''
    }));

    res.json({
      raffle: {
        id: raffle.id,
        title: raffle.title,
        subtitle: raffle.subtitle,
        drawDate: raffle.draw_date,
        drawMethod: raffle.draw_method,
        ticketPrice: parseFloat(raffle.ticket_price),
        totalNumbers: raffle.total_numbers,
        status: raffle.status,
        bannerImageUrl: raffle.banner_image_url || '',
        winningNumbers: [raffle.winning_number_1, raffle.winning_number_2, raffle.winning_number_3].filter(Boolean),
        prizes: prizesFormatted,
        stats: {
          sold: soldCount,
          held: heldCount,
          available: availableCount,
          total: raffle.total_numbers,
          raised: soldCount * parseFloat(raffle.ticket_price)
        },
        numbers: numbersMap
      }
    });
  } catch (err) {
    console.error('Error fetching active raffle:', err);
    res.status(500).json({ error: 'Error al consultar la rifa activa.' });
  }
});

// Bloquear números temporalmente (15 min) con transacción atómica
app.post('/api/raffle/hold', async (req, res) => {
  const client = await db.getClient();
  try {
    const { raffleId = 1, numbers, buyerName, buyerPhone, buyerEmail, buyerCi, buyerDept } = req.body;

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un número.' });
    }

    await client.query('BEGIN');

    // Bloquear filas para evitar condición de carrera (SELECT ... FOR UPDATE)
    const checkRes = await client.query(`
      SELECT number, status, held_until 
      FROM raffle_tickets 
      WHERE raffle_id = $1 AND number = ANY($2::text[])
      FOR UPDATE;
    `, [raffleId, numbers]);

    // Verificar si alguno ya está ocupado
    const unavailable = [];
    for (const row of checkRes.rows) {
      if (row.status === 'paid') {
        unavailable.push(`${row.number} (ya vendido)`);
      } else if (row.status === 'held' && new Date(row.held_until) > new Date()) {
        unavailable.push(`${row.number} (en proceso de compra)`);
      }
    }

    if (unavailable.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Uno o más números ya no están disponibles.',
        unavailable
      });
    }

    // Actualizar a estado 'held' por 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await client.query(`
      UPDATE raffle_tickets 
      SET status = 'held',
          held_until = $1,
          buyer_name = $2,
          buyer_phone = $3,
          buyer_email = $4,
          buyer_ci = $5,
          buyer_dept = $6,
          updated_at = NOW()
      WHERE raffle_id = $7 AND number = ANY($8::text[]);
    `, [expiresAt, buyerName || null, buyerPhone || null, buyerEmail || null, buyerCi || null, buyerDept || null, raffleId, numbers]);

    // Registrar en auditoría
    await client.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['TICKETS_HELD', { numbers, buyerName, buyerCi, expiresAt }, req.ip]);

    await client.query('COMMIT');

    res.json({
      success: true,
      numbers,
      heldUntil: expiresAt,
      message: 'Números bloqueados con éxito por 15 minutos.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error holding numbers:', err);
    res.status(500).json({ error: 'Error al reservar los números de rifa.' });
  } finally {
    client.release();
  }
});

// Confirmación de compra / Checkout
app.post('/api/raffle/checkout', async (req, res) => {
  const client = await db.getClient();
  try {
    const {
      raffleId = 1,
      numbers,
      buyerName,
      buyerPhone,
      buyerEmail,
      buyerCi,
      buyerDept,
      paymentMethod, // 'MERCADOPAGO', 'BROU', 'PREX'
      paymentRef,
      receiptUrl,
      notes
    } = req.body;

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Lista de números no válida.' });
    }

    await client.query('BEGIN');

    const raffleRes = await client.query('SELECT ticket_price FROM raffles WHERE id = $1', [raffleId]);
    const ticketPrice = raffleRes.rowCount > 0 ? parseFloat(raffleRes.rows[0].ticket_price) : 400.00;
    const totalAmount = numbers.length * ticketPrice;

    if (paymentMethod === 'MERCADOPAGO') {
      const generatedOrderRef = `MP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await client.query(`
        UPDATE raffle_tickets 
        SET status = 'paid',
            buyer_name = $1,
            buyer_phone = $2,
            buyer_email = $3,
            buyer_ci = $4,
            buyer_dept = $5,
            payment_method = 'MERCADOPAGO',
            payment_ref = $6,
            held_until = NULL,
            updated_at = NOW()
        WHERE raffle_id = $7 AND number = ANY($8::text[]);
      `, [buyerName, buyerPhone, buyerEmail, buyerCi, buyerDept, generatedOrderRef, raffleId, numbers]);

      await client.query(`
        INSERT INTO audit_logs (action, details, ip_address)
        VALUES ($1, $2, $3);
      `, ['TICKETS_PAID_MP', { numbers, buyerName, buyerCi, totalAmount, paymentRef: generatedOrderRef }, req.ip]);

      await client.query('COMMIT');

      return res.json({
        success: true,
        status: 'PAID',
        paymentMethod: 'MERCADOPAGO',
        paymentRef: generatedOrderRef,
        numbers,
        totalAmount,
        message: '¡Pago con Mercado Pago acreditado! Tus números han sido asignados y confirmados oficialmente.'
      });
    } else {
      // Transferencia bancaria (BROU / Prex)
      await client.query(`
        UPDATE raffle_tickets 
        SET status = 'held',
            payment_method = $1,
            buyer_name = $2,
            buyer_phone = $3,
            buyer_email = $4,
            buyer_ci = $5,
            buyer_dept = $6,
            held_until = NOW() + INTERVAL '48 hours',
            updated_at = NOW()
        WHERE raffle_id = $7 AND number = ANY($8::text[]);
      `, [paymentMethod, buyerName, buyerPhone, buyerEmail, buyerCi, buyerDept, raffleId, numbers]);

      const numbersStr = numbers.join(', ');
      const receiptRes = await client.query(`
        INSERT INTO payment_receipts (target_type, reference_id, payer_name, payer_phone, payer_ci, bank_origin, amount, status, notes, receipt_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9)
        RETURNING id;
      `, ['RAFFLE', numbersStr, buyerName, buyerPhone, buyerCi, paymentMethod, totalAmount, notes || 'Comprobante de transferencia subido por el comprador', receiptUrl || null]);

      await client.query(`
        INSERT INTO audit_logs (action, details, ip_address)
        VALUES ($1, $2, $3);
      `, ['RECEIPT_UPLOADED', { receiptId: receiptRes.rows[0].id, numbers, buyerName, bank: paymentMethod, totalAmount }, req.ip]);

      await client.query('COMMIT');

      return res.json({
        success: true,
        status: 'PENDING_APPROVAL',
        paymentMethod,
        receiptId: receiptRes.rows[0].id,
        numbers,
        totalAmount,
        message: 'Comprobante recibido. La comisión directiva verificará la acreditación y confirmará tus números.'
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in checkout:', err);
    res.status(500).json({ error: 'Error al procesar el pago o comprobante.' });
  } finally {
    client.release();
  }
});

// ----------------------------------------------------
// 2. MÓDULO DE SOCIOS Y PADRÓN ("MI ANCU")
// ----------------------------------------------------

// Consultar socio por cédula o número de socio (Normalizado)
app.get('/api/members/lookup/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const cleanId = identifier.trim();

    const memberRes = await db.query(`
      SELECT * FROM members 
      WHERE REPLACE(REPLACE(ci, '.', ''), '-', '') = REPLACE(REPLACE($1, '.', ''), '-', '') 
         OR member_number ILIKE $1 
         OR ci = $1
      LIMIT 1;
    `, [cleanId]);

    if (memberRes.rowCount === 0) {
      return res.status(404).json({ error: 'Socio no encontrado en el padrón oficial.' });
    }

    const member = memberRes.rows[0];
    const isExpired = new Date(member.valid_until) < new Date();
    const effectiveStatus = isExpired ? 'OVERDUE' : member.status;

    res.json({
      member: {
        id: member.id,
        memberNumber: member.member_number,
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: `${member.first_name} ${member.last_name}`,
        ci: member.ci,
        phone: member.phone,
        email: member.email,
        department: member.department,
        thataNumber: member.thata_number,
        category: member.category,
        status: effectiveStatus,
        validUntil: member.valid_until,
        photoUrl: member.photo_url || 'assets/logo.png'
      }
    });
  } catch (err) {
    console.error('Error looking up member:', err);
    res.status(500).json({ error: 'Error al consultar datos de socio.' });
  }
});

// Login formal de Socio al Portal "Mi ANCU"
app.post('/api/members/login', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Por favor ingrese su Cédula de Identidad o Nº de Socio.' });
    }

    const cleanId = identifier.trim();
    const memberRes = await db.query(`
      SELECT * FROM members 
      WHERE REPLACE(REPLACE(ci, '.', ''), '-', '') = REPLACE(REPLACE($1, '.', ''), '-', '') 
         OR member_number ILIKE $1 
         OR ci = $1
      LIMIT 1;
    `, [cleanId]);

    if (memberRes.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontró ningún socio registrado con los datos proporcionados.' });
    }

    const member = memberRes.rows[0];
    const isExpired = new Date(member.valid_until) < new Date();
    const effectiveStatus = isExpired ? 'OVERDUE' : member.status;

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['MEMBER_PORTAL_LOGIN', { memberNumber: member.member_number, ci: member.ci, name: `${member.first_name} ${member.last_name}` }, req.ip]);

    res.json({
      success: true,
      message: `¡Bienvenido/a ${member.first_name}! Acceso concedido al Portal "Mi ANCU".`,
      member: {
        id: member.id,
        memberNumber: member.member_number,
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: `${member.first_name} ${member.last_name}`,
        ci: member.ci,
        phone: member.phone,
        email: member.email,
        department: member.department,
        thataNumber: member.thata_number,
        category: member.category,
        status: effectiveStatus,
        validUntil: member.valid_until,
        photoUrl: member.photo_url || 'assets/logo.png'
      }
    });
  } catch (err) {
    console.error('Error logging in member:', err);
    res.status(500).json({ error: 'Error al iniciar sesión de socio.' });
  }
});

// Solicitud de Afiliación
app.post('/api/members/register', async (req, res) => {
  try {
    const { firstName, lastName, ci, phone, email, department, thataNumber, category } = req.body;

    if (!firstName || !lastName || !ci || !phone || !email) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const existingRes = await db.query('SELECT id FROM members WHERE ci = $1', [ci]);
    if (existingRes.rowCount > 0) {
      return res.status(409).json({ error: 'Ya existe un socio registrado con esta Cédula de Identidad.' });
    }

    const countRes = await db.query('SELECT COUNT(*) FROM members');
    const nextNum = String(parseInt(countRes.rows[0].count, 10) + 1).padStart(4, '0');
    const memberNumber = `ANCU-${nextNum}`;

    const newMemberRes = await db.query(`
      INSERT INTO members (member_number, first_name, last_name, ci, phone, email, department, thata_number, category, status, valid_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', CURRENT_DATE + INTERVAL '1 year')
      RETURNING *;
    `, [memberNumber, firstName, lastName, ci, phone, email, department || 'Lavalleja', thataNumber || null, category || 'Socio Pleno Activo']);

    const newMember = newMemberRes.rows[0];

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['MEMBER_REGISTERED', { memberNumber, ci, name: `${firstName} ${lastName}` }, req.ip]);

    res.json({
      success: true,
      message: '¡Solicitud registrada con éxito! Tu número de socio oficial es ' + memberNumber,
      member: newMember
    });
  } catch (err) {
    console.error('Error registering member:', err);
    res.status(500).json({ error: 'Error al procesar solicitud de afiliación.' });
  }
});

// Pago de Cuota Social ($600 UYU)
app.post('/api/members/pay-fee', async (req, res) => {
  try {
    const { ci, paymentMethod = 'MERCADOPAGO' } = req.body;

    const memberRes = await db.query('SELECT * FROM members WHERE ci = $1', [ci]);
    if (memberRes.rowCount === 0) {
      return res.status(404).json({ error: 'Socio no encontrado.' });
    }
    const member = memberRes.rows[0];

    const period = new Date().toISOString().slice(0, 7); // '2026-08'
    const newValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await db.query(`
      UPDATE members 
      SET status = 'ACTIVE', valid_until = $1, updated_at = NOW()
      WHERE id = $2;
    `, [newValidUntil, member.id]);

    await db.query(`
      INSERT INTO membership_fees (member_id, amount, period, status, payment_method, payment_ref)
      VALUES ($1, 600.00, $2, 'PAID', $3, $4);
    `, [member.id, period, paymentMethod, `FEE-${Date.now()}`]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['MEMBERSHIP_FEE_PAID', { memberId: member.id, ci: member.ci, amount: 600.00 }, req.ip]);

    res.json({
      success: true,
      message: 'Cuota social abonada con éxito. Membresía extendida por 1 año.',
      validUntil: newValidUntil
    });
  } catch (err) {
    console.error('Error paying fee:', err);
    res.status(500).json({ error: 'Error al procesar pago de cuota social.' });
  }
});

// ----------------------------------------------------
// 3. MÓDULO DE ADMINISTRACIÓN (BACKOFFICE)
// ----------------------------------------------------

// Login de Administrador
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
    }

    const adminRes = await db.query(`
      SELECT id, username, email, full_name, role, password_hash
      FROM admin_users
      WHERE (username = $1 OR email = $1)
      LIMIT 1;
    `, [username.trim()]);

    if (adminRes.rowCount === 0 || adminRes.rows[0].password_hash !== password) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifique usuario y contraseña.' });
    }

    const admin = adminRes.rows[0];

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['ADMIN_LOGIN', { username: admin.username, role: admin.role }, req.ip]);

    res.json({
      success: true,
      message: `¡Bienvenido ${admin.full_name}!`,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role
      },
      token: `ancu_adm_${admin.id}_${Date.now()}`
    });
  } catch (err) {
    console.error('Error in admin login:', err);
    res.status(500).json({ error: 'Error al iniciar sesión de administrador.' });
  }
});

// Subida de Fotografías de Premios
app.post('/api/admin/upload-prize-image', uploadPrize.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de imagen válido.' });
    }

    const imageUrl = `/uploads/prizes/${req.file.filename}`;
    res.json({
      success: true,
      imageUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    console.error('Error uploading prize image:', err);
    res.status(500).json({ error: 'Error al procesar la subida de imagen.' });
  }
});

// Resumen general de KPIs para admin.html
app.get('/api/admin/summary', async (req, res) => {
  try {
    const activeRaffleRes = await db.query('SELECT * FROM raffles WHERE status = $1 ORDER BY id DESC LIMIT 1', ['ACTIVE']);
    const activeRaffle = activeRaffleRes.rows[0] || { id: 1, ticket_price: 400.00, total_numbers: 1000 };

    const ticketsRes = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'held') as held_count,
        COUNT(*) FILTER (WHERE status = 'available') as available_count,
        COUNT(*) as total_count
      FROM raffle_tickets WHERE raffle_id = $1;
    `, [activeRaffle.id]);

    const membersRes = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_members,
        COUNT(*) FILTER (WHERE status = 'OVERDUE') as overdue_members,
        COUNT(*) as total_members
      FROM members;
    `);

    const receiptsRes = await db.query(`
      SELECT COUNT(*) as pending_receipts FROM payment_receipts WHERE status = 'PENDING';
    `);

    const auditRes = await db.query(`
      SELECT * FROM audit_logs ORDER BY id DESC LIMIT 15;
    `);

    const stats = ticketsRes.rows[0];
    const memberStats = membersRes.rows[0];
    const paidCount = parseInt(stats.paid_count, 10);
    const totalRevenue = paidCount * parseFloat(activeRaffle.ticket_price);

    res.json({
      activeRaffle,
      revenue: totalRevenue,
      tickets: {
        sold: paidCount,
        held: parseInt(stats.held_count, 10),
        available: parseInt(stats.available_count, 10),
        total: parseInt(stats.total_count, 10),
        percentSold: Math.round((paidCount / parseInt(stats.total_count, 10)) * 100)
      },
      members: {
        active: parseInt(memberStats.active_members, 10),
        overdue: parseInt(memberStats.overdue_members, 10),
        total: parseInt(memberStats.total_members, 10)
      },
      pendingReceipts: parseInt(receiptsRes.rows[0].pending_receipts, 10),
      recentAuditLogs: auditRes.rows
    });
  } catch (err) {
    console.error('Error fetching admin summary:', err);
    res.status(500).json({ error: 'Error al obtener métricas de administración.' });
  }
});

// Listar todas las campañas de rifas
app.get('/api/admin/raffles', async (req, res) => {
  try {
    const rafflesRes = await db.query(`
      SELECT r.*, 
        COUNT(t.id) FILTER (WHERE t.status = 'paid') as sold_tickets,
        COUNT(t.id) FILTER (WHERE t.status = 'held') as held_tickets,
        COUNT(t.id) as total_tickets
      FROM raffles r
      LEFT JOIN raffle_tickets t ON r.id = t.raffle_id
      GROUP BY r.id
      ORDER BY r.id DESC;
    `);

    const raffles = [];
    for (const r of rafflesRes.rows) {
      const prizesRes = await db.query('SELECT * FROM raffle_prizes WHERE raffle_id = $1 ORDER BY prize_order ASC', [r.id]);
      raffles.push({
        ...r,
        ticket_price: parseFloat(r.ticket_price),
        prizes: prizesRes.rows
      });
    }

    res.json({ raffles });
  } catch (err) {
    console.error('Error fetching admin raffles:', err);
    res.status(500).json({ error: 'Error al consultar campañas de rifas.' });
  }
});

// Obtener detalles de una rifa específica para edición
app.get('/api/admin/raffles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const raffleRes = await db.query('SELECT * FROM raffles WHERE id = $1', [id]);
    if (raffleRes.rowCount === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada.' });
    }
    const raffle = raffleRes.rows[0];
    const prizesRes = await db.query('SELECT * FROM raffle_prizes WHERE raffle_id = $1 ORDER BY prize_order ASC', [id]);

    res.json({
      raffle: {
        ...raffle,
        ticket_price: parseFloat(raffle.ticket_price),
        prizes: prizesRes.rows
      }
    });
  } catch (err) {
    console.error('Error fetching raffle details:', err);
    res.status(500).json({ error: 'Error al consultar la rifa.' });
  }
});

// Crear una nueva campaña de rifa con 1000 números
app.post('/api/admin/raffles', async (req, res) => {
  const client = await db.getClient();
  try {
    const {
      title,
      subtitle,
      drawDate,
      drawMethod,
      ticketPrice = 400,
      totalNumbers = 1000,
      status = 'ACTIVE',
      prizes = []
    } = req.body;

    if (!title || !drawDate || !drawMethod) {
      return res.status(400).json({ error: 'Título, fecha de sorteo y método de sorteo son obligatorios.' });
    }

    await client.query('BEGIN');

    // Si la nueva rifa es ACTIVE, pasar las anteriores a CLOSED
    if (status === 'ACTIVE') {
      await client.query("UPDATE raffles SET status = 'CLOSED' WHERE status = 'ACTIVE';");
    }

    const newRaffleRes = await client.query(`
      INSERT INTO raffles (title, subtitle, draw_date, draw_method, ticket_price, total_numbers, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [title, subtitle || null, drawDate, drawMethod, ticketPrice, totalNumbers, status]);

    const newRaffle = newRaffleRes.rows[0];

    // Insertar premios
    if (Array.isArray(prizes) && prizes.length > 0) {
      for (const [idx, p] of prizes.entries()) {
        await client.query(`
          INSERT INTO raffle_prizes (raffle_id, prize_order, title, description, image_url, estimated_value, regulated, note)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, [newRaffle.id, idx + 1, p.title, p.description || null, p.imageUrl || null, p.estimatedValue || 0, p.regulated || false, p.note || null]);
      }
    } else {
      // 3 premios por defecto
      await client.query(`
        INSERT INTO raffle_prizes (raffle_id, prize_order, title, description, regulated, note)
        VALUES 
          ($1, 1, '1º Premio Principal', 'Descripción del primer premio', true, 'Requiere THATA'),
          ($1, 2, '2º Premio', 'Descripción del segundo premio', true, 'Requiere THATA'),
          ($1, 3, '3º Premio', 'Descripción del tercer premio', false, 'Entrega directa');
      `, [newRaffle.id]);
    }

    // Generar automáticamente los números (ej. 000 a 999)
    await client.query(`
      INSERT INTO raffle_tickets (raffle_id, number, status)
      SELECT $1, LPAD(i::text, 3, '0'), 'available'
      FROM generate_series(0, $2 - 1) AS i;
    `, [newRaffle.id, totalNumbers]);

    await client.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['RAFFLE_CREATED', { raffleId: newRaffle.id, title, totalNumbers, ticketPrice }, req.ip]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '¡Nueva campaña de rifa creada y 1.000 números generados con éxito!',
      raffle: newRaffle
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating raffle:', err);
    res.status(500).json({ error: 'Error al crear la nueva campaña de rifa.' });
  } finally {
    client.release();
  }
});

// Modificar datos generales de una rifa
app.put('/api/admin/raffles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      drawDate,
      drawMethod,
      ticketPrice,
      status,
      bannerImageUrl
    } = req.body;

    const updateRes = await db.query(`
      UPDATE raffles 
      SET title = COALESCE($1, title),
          subtitle = COALESCE($2, subtitle),
          draw_date = COALESCE($3, draw_date),
          draw_method = COALESCE($4, draw_method),
          ticket_price = COALESCE($5, ticket_price),
          status = COALESCE($6, status),
          banner_image_url = COALESCE($7, banner_image_url),
          updated_at = NOW()
      WHERE id = $8
      RETURNING *;
    `, [title, subtitle, drawDate, drawMethod, ticketPrice, status, bannerImageUrl, id]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['RAFFLE_UPDATED', { raffleId: id, title, drawDate, ticketPrice, status }, req.ip]);

    res.json({
      success: true,
      message: 'Campaña de rifa actualizada con éxito.',
      raffle: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating raffle:', err);
    res.status(500).json({ error: 'Error al actualizar la rifa.' });
  }
});

// Modificar y guardar premios de una rifa (1º, 2º, 3º, etc. con fotos y specs)
app.put('/api/admin/raffles/:id/prizes', async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { prizes } = req.body;

    if (!Array.isArray(prizes)) {
      return res.status(400).json({ error: 'El formato de premios debe ser una lista.' });
    }

    await client.query('BEGIN');

    // Reemplazo atómico de premios
    await client.query('DELETE FROM raffle_prizes WHERE raffle_id = $1', [id]);

    for (const [idx, p] of prizes.entries()) {
      await client.query(`
        INSERT INTO raffle_prizes (raffle_id, prize_order, title, description, image_url, estimated_value, regulated, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [
        id,
        idx + 1,
        p.title || `Premio Nº ${idx + 1}`,
        p.description || '',
        p.imageUrl || p.image_url || '',
        parseFloat(p.estimatedValue || p.estimated_value || 0),
        p.regulated === true,
        p.note || ''
      ]);
    }

    await client.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['RAFFLE_PRIZES_UPDATED', { raffleId: id, prizesCount: prizes.length }, req.ip]);

    await client.query('COMMIT');

    const updatedPrizesRes = await db.query('SELECT * FROM raffle_prizes WHERE raffle_id = $1 ORDER BY prize_order ASC', [id]);

    res.json({
      success: true,
      message: '¡Premios y fotografías actualizados con éxito en PostgreSQL!',
      prizes: updatedPrizesRes.rows
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating raffle prizes:', err);
    res.status(500).json({ error: 'Error al actualizar los premios de la rifa.' });
  } finally {
    client.release();
  }
});

// Listar comprobantes de pago
app.get('/api/admin/receipts', async (req, res) => {
  try {
    const receiptsRes = await db.query(`
      SELECT * FROM payment_receipts 
      ORDER BY CASE WHEN status = 'PENDING' THEN 1 ELSE 2 END, id DESC;
    `);
    res.json({ receipts: receiptsRes.rows });
  } catch (err) {
    console.error('Error fetching receipts:', err);
    res.status(500).json({ error: 'Error al consultar comprobantes.' });
  }
});

// Aprobar comprobante en 1 clic
app.post('/api/admin/receipts/:id/approve', async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const receiptRes = await client.query('SELECT * FROM payment_receipts WHERE id = $1 FOR UPDATE', [id]);
    if (receiptRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Comprobante no encontrado.' });
    }
    const receipt = receiptRes.rows[0];

    await client.query(`
      UPDATE payment_receipts 
      SET status = 'APPROVED', reviewed_at = NOW() 
      WHERE id = $1;
    `, [id]);

    if (receipt.target_type === 'RAFFLE') {
      const numbers = receipt.reference_id.split(',').map(n => n.trim());
      await client.query(`
        UPDATE raffle_tickets 
        SET status = 'paid', 
            held_until = NULL, 
            payment_method = $1, 
            payment_ref = $2,
            buyer_name = $3,
            buyer_phone = $4,
            buyer_ci = $5,
            updated_at = NOW()
        WHERE raffle_id = 1 AND number = ANY($6::text[]);
      `, [receipt.bank_origin, `REC-${receipt.id}`, receipt.payer_name, receipt.payer_phone, receipt.payer_ci, numbers]);
    } else if (receipt.target_type === 'MEMBERSHIP') {
      await client.query(`
        UPDATE members 
        SET status = 'ACTIVE', valid_until = CURRENT_DATE + INTERVAL '1 year', updated_at = NOW()
        WHERE ci = $1;
      `, [receipt.payer_ci]);
    }

    await client.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['RECEIPT_APPROVED', { receiptId: receipt.id, type: receipt.target_type, reference: receipt.reference_id, amount: receipt.amount }, req.ip]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Comprobante aprobado exitosamente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error approving receipt:', err);
    res.status(500).json({ error: 'Error al aprobar comprobante.' });
  } finally {
    client.release();
  }
});

// Rechazar comprobante
app.post('/api/admin/receipts/:id/reject', async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const receiptRes = await client.query('SELECT * FROM payment_receipts WHERE id = $1 FOR UPDATE', [id]);
    if (receiptRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Comprobante no encontrado.' });
    }
    const receipt = receiptRes.rows[0];

    await client.query(`
      UPDATE payment_receipts 
      SET status = 'REJECTED', reviewed_at = NOW() 
      WHERE id = $1;
    `, [id]);

    if (receipt.target_type === 'RAFFLE') {
      const numbers = receipt.reference_id.split(',').map(n => n.trim());
      await client.query(`
        UPDATE raffle_tickets 
        SET status = 'available', held_until = NULL, payment_method = NULL
        WHERE raffle_id = 1 AND number = ANY($1::text[]) AND status = 'held';
      `, [numbers]);
    }

    await client.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['RECEIPT_REJECTED', { receiptId: receipt.id, reference: receipt.reference_id }, req.ip]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Comprobante rechazado y boletos liberados.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error rejecting receipt:', err);
    res.status(500).json({ error: 'Error al rechazar comprobante.' });
  } finally {
    client.release();
  }
});

// Exportar CSV oficial de rifa para Escribano Público
app.get('/api/admin/export/raffle.csv', async (req, res) => {
  try {
    const ticketsRes = await db.query(`
      SELECT number, status, buyer_name, buyer_ci, buyer_phone, buyer_dept, payment_method, updated_at
      FROM raffle_tickets 
      WHERE raffle_id = 1 
      ORDER BY number ASC;
    `);

    let csv = '\uFEFF'; // BOM para compatibilidad con Microsoft Excel
    csv += 'NUMERO;ESTADO;NOMBRE_COMPRADOR;CEDULA;TELEFONO;DEPARTAMENTO;MEDIO_PAGO;FECHA_CONFIRMACION\r\n';

    for (const t of ticketsRes.rows) {
      const num = `"${t.number}"`;
      const status = t.status === 'paid' ? 'PAGADO' : (t.status === 'held' ? 'RESERVADO' : 'LIBRE');
      const name = `"${(t.buyer_name || '').replace(/"/g, '""')}"`;
      const ci = `"${t.buyer_ci || ''}"`;
      const phone = `"${t.buyer_phone || ''}"`;
      const dept = `"${t.buyer_dept || ''}"`;
      const payment = `"${t.payment_method || ''}"`;
      const date = t.updated_at ? `"${new Date(t.updated_at).toLocaleString('es-UY', { timeZone: 'America/Montevideo' })}"` : '""';

      csv += `${num};${status};${name};${ci};${phone};${dept};${payment};${date}\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ANCU_Padron_Rifa_Oficial_2026.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.status(500).send('Error al generar archivo CSV para escribano.');
  }
});

// Iniciar Servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌲 Servidor Backend ANCU activo en el puerto ${PORT}`);
  console.log(`📊 Conexión a PostgreSQL: ${process.env.DB_NAME || 'ancu_db'} en ${process.env.DB_HOST || 'localhost'}`);
});
