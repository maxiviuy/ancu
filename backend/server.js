/**
 * ANCU - Backend API Server
 * Asociación Nacional de Cazadores del Uruguay
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Ejecutar cada 30 segundos
setInterval(cleanExpiredHolds, 30000);

// ----------------------------------------------------
// Rutas de Salud
// ----------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await db.query('SELECT NOW() as now, COUNT(*) as total_tickets FROM raffle_tickets');
    res.json({
      status: 'OK',
      timestamp: dbRes.rows[0].now,
      database: 'Connected',
      tickets: parseInt(dbRes.rows[0].total_tickets, 10)
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ----------------------------------------------------
// 1. MÓDULO DE RIFAS
// ----------------------------------------------------

// Obtener estado de la rifa activa y los 1000 números
app.get('/api/raffle/active', async (req, res) => {
  try {
    // Primero limpiar expirados
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
        prizes: prizesRes.rows,
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

    const unavailable = [];
    const now = new Date();

    for (const row of checkRes.rows) {
      if (row.status === 'paid') {
        unavailable.push(`${row.number} (ya vendido)`);
      } else if (row.status === 'held' && row.held_until && new Date(row.held_until) > now) {
        unavailable.push(`${row.number} (bloqueado por otro usuario)`);
      }
    }

    if (unavailable.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Los siguientes números ya no están disponibles: ${unavailable.join(', ')}. Por favor elija otros números.`
      });
    }

    // Actualizar números a 'held' con 15 minutos de reserva
    const heldUntil = new Date(Date.now() + 15 * 60 * 1000);

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
    `, [heldUntil, buyerName || null, buyerPhone || null, buyerEmail || null, buyerCi || null, buyerDept || null, raffleId, numbers]);

    await client.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['TICKETS_HELD', { numbers, buyerName, heldUntil }, req.ip]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${numbers.length} número(s) reservados por 15 minutos.`,
      numbers,
      heldUntil
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error holding numbers:', err);
    res.status(500).json({ error: 'Error al reservar números de rifa.' });
  } finally {
    client.release();
  }
});

// Checkout de Rifa (Mercado Pago o Comprobante BROU/Prex)
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
      receiptUrl,
      notes 
    } = req.body;

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'No se enviaron números para procesar.' });
    }

    await client.query('BEGIN');

    const totalAmount = numbers.length * 400.00;

    if (paymentMethod === 'MERCADOPAGO') {
      // Modo automático Mercado Pago
      const paymentRef = `MP-${Date.now()}-${Math.floor(Math.random()*1000)}`;

      await client.query(`
        UPDATE raffle_tickets 
        SET status = 'paid', 
            payment_method = 'MERCADOPAGO', 
            payment_ref = $1, 
            buyer_name = $2, 
            buyer_phone = $3, 
            buyer_email = $4, 
            buyer_ci = $5, 
            buyer_dept = $6,
            held_until = NULL,
            updated_at = NOW()
        WHERE raffle_id = $7 AND number = ANY($8::text[]);
      `, [paymentRef, buyerName, buyerPhone, buyerEmail, buyerCi, buyerDept, raffleId, numbers]);

      await client.query(`
        INSERT INTO audit_logs (action, details, ip_address)
        VALUES ($1, $2, $3);
      `, ['TICKETS_PAID_MP', { numbers, buyerName, totalAmount, paymentRef }, req.ip]);

      await client.query('COMMIT');

      return res.json({
        success: true,
        status: 'PAID',
        paymentMethod: 'MERCADOPAGO',
        paymentRef,
        numbers,
        totalAmount,
        message: '¡Pago acreditado con éxito! Tus boletos están confirmados.'
      });
    } else {
      // Transferencia Manual (BROU / Prex) -> Creación de Comprobante
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

// Consultar socio por cédula o número de socio
app.get('/api/members/lookup/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const cleanId = identifier.trim();

    const memberRes = await db.query(`
      SELECT * FROM members 
      WHERE ci = $1 OR member_number = $1
      LIMIT 1;
    `, [cleanId]);

    if (memberRes.rowCount === 0) {
      return res.status(404).json({ error: 'Socio no encontrado en el padrón oficial.' });
    }

    const member = memberRes.rows[0];

    // Verificar si la fecha de vigencia expiró
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

// Solicitud de Afiliación
app.post('/api/members/register', async (req, res) => {
  try {
    const { firstName, lastName, ci, phone, email, department, thataNumber } = req.body;

    if (!firstName || !lastName || !ci || !phone || !email) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para la solicitud.' });
    }

    // Verificar si ya existe
    const existsRes = await db.query('SELECT id, member_number FROM members WHERE ci = $1', [ci.trim()]);
    if (existsRes.rowCount > 0) {
      return res.status(409).json({ error: 'Ya existe un socio o solicitud con esta cédula de identidad.' });
    }

    const memberCountRes = await db.query('SELECT COUNT(*) as count FROM members');
    const nextNum = parseInt(memberCountRes.rows[0].count, 10) + 1;
    const memberNumber = `ANCU-${String(nextNum).padStart(4, '0')}`;

    const insertRes = await db.query(`
      INSERT INTO members (member_number, first_name, last_name, ci, phone, email, department, thata_number, category, status, valid_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Socio Pleno', 'ACTIVE', CURRENT_DATE + INTERVAL '1 year')
      RETURNING *;
    `, [memberNumber, firstName.trim(), lastName.trim(), ci.trim(), phone.trim(), email.trim(), department || 'Lavalleja', thataNumber || null]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['MEMBER_REGISTERED', { memberNumber, ci, name: `${firstName} ${lastName}` }, req.ip]);

    res.json({
      success: true,
      message: '¡Solicitud de afiliación registrada con éxito en el padrón!',
      member: insertRes.rows[0]
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

    // Actualizar validez y estado del socio
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

// Resumen general de KPIs para admin.html
app.get('/api/admin/summary', async (req, res) => {
  try {
    const ticketsRes = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'held') as held_count,
        COUNT(*) FILTER (WHERE status = 'available') as available_count,
        COUNT(*) as total_count
      FROM raffle_tickets WHERE raffle_id = 1;
    `);

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
    const totalRevenue = paidCount * 400.00;

    res.json({
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

    // Marcar comprobante como APPROVED
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

    // Liberar números de rifa si estaban retenidos
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
