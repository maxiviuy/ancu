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
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Directorios de Subida
const uploadsDir = path.join(__dirname, '../uploads');
const prizeUploadsDir = path.join(uploadsDir, 'prizes');
const newsUploadsDir = path.join(uploadsDir, 'news');
const receiptUploadsDir = path.join(uploadsDir, 'receipts');
const authoritiesUploadsDir = path.join(uploadsDir, 'authorities');
const activitiesUploadsDir = path.join(uploadsDir, 'activities');
const partnersUploadsDir = path.join(uploadsDir, 'partners');
const documentsUploadsDir = path.join(uploadsDir, 'documents');

[prizeUploadsDir, newsUploadsDir, receiptUploadsDir, authoritiesUploadsDir, activitiesUploadsDir, partnersUploadsDir, documentsUploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer Storage para Fotos de Premios
const prizeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, prizeUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `prize_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadPrize = multer({
  storage: prizeStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, WebP).'));
  }
});

// Multer Storage para Fotos de Noticias
const newsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, newsUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `news_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadNews = multer({
  storage: newsStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, WebP).'));
  }
});

// Multer Storage para Fotos de Autoridades / Directivos
const authorityStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, authoritiesUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `auth_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadAuthority = multer({
  storage: authorityStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, WebP).'));
  }
});

// Multer Storage para Actividades y Cursos
const activityStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, activitiesUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `activity_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadActivity = multer({
  storage: activityStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, WebP).'));
  }
});

// Multer Storage para Logos de Convenios / Sponsors
const partnerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, partnersUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `partner_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadPartner = multer({
  storage: partnerStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, WebP).'));
  }
});

// Multer Storage para Documentos Oficiales (Estatutos, Normativas en PDF)
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, documentsUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `doc_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF o imágenes.'));
  }
});

// ----------------------------------------------------
// Inicialización de Mercado Pago SDK
// ----------------------------------------------------
const mpAccessToken = process.env.MP_ACCESS_TOKEN || '';
const mpPublicKey = process.env.MP_PUBLIC_KEY || '';
const mpWebhookSecret = process.env.MP_WEBHOOK_SECRET || '';

let mpClient = null;
let mpPreference = null;
let mpPayment = null;

if (mpAccessToken && mpAccessToken !== 'TU_MERCADO_PAGO_ACCESS_TOKEN') {
  try {
    mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });
    mpPreference = new Preference(mpClient);
    mpPayment = new Payment(mpClient);
    console.log('💳 Mercado Pago SDK inicializado con credenciales activas.');
  } catch (err) {
    console.warn('⚠️ Error al inicializar Mercado Pago SDK:', err.message);
  }
} else {
  console.log('ℹ️ Mercado Pago operando en modo preparado/simulado (a la espera de credenciales en producción).');
}

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
    const ticketsCount = await db.query('SELECT COUNT(*) FROM raffle_tickets');
    const newsCount = await db.query('SELECT COUNT(*) FROM news_articles');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      tickets: parseInt(ticketsCount.rows[0].count, 10),
      newsArticles: parseInt(newsCount.rows[0].count, 10),
      mercadoPagoMode: mpPreference ? 'LIVE' : 'SIMULATION_READY'
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ----------------------------------------------------
// 1. MÓDULO DE RIFAS Y MERCADO PAGO
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

    const checkRes = await client.query(`
      SELECT number, status, held_until 
      FROM raffle_tickets 
      WHERE raffle_id = $1 AND number = ANY($2::text[])
      FOR UPDATE;
    `, [raffleId, numbers]);

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

// Crear Preferencia de Mercado Pago (Checkout Pro) para Boletos de Rifa
app.post('/api/raffle/create-preference', async (req, res) => {
  try {
    const { raffleId = 1, numbers, buyerName, buyerPhone, buyerEmail, buyerCi, buyerDept } = req.body;

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Lista de números no válida.' });
    }

    const raffleRes = await db.query('SELECT title, ticket_price FROM raffles WHERE id = $1', [raffleId]);
    const raffle = raffleRes.rows[0] || { title: 'Gran Rifa ANCU 2026', ticket_price: 400.00 };
    const ticketPrice = parseFloat(raffle.ticket_price);
    const totalAmount = numbers.length * ticketPrice;
    const externalReference = `RAFFLE_${raffleId}_${buyerCi || 'NOCI'}_${Date.now()}`;

    // Si Mercado Pago está configurado con Access Token real:
    if (mpPreference) {
      const preferenceData = {
        items: [
          {
            id: `raffle-${raffleId}`,
            title: `${raffle.title} - Números: ${numbers.join(', ')}`,
            description: `Adquisición de ${numbers.length} boleto(s) oficiales de rifa ANCU`,
            quantity: 1,
            currency_id: 'UYU',
            unit_price: totalAmount
          }
        ],
        payer: {
          name: buyerName,
          email: buyerEmail,
          identification: {
            type: 'CI',
            number: buyerCi
          }
        },
        external_reference: externalReference,
        metadata: {
          target_type: 'RAFFLE',
          raffle_id: raffleId,
          numbers: numbers,
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          buyer_email: buyerEmail,
          buyer_ci: buyerCi,
          buyer_dept: buyerDept
        },
        back_urls: {
          success: 'https://ancu.uy/rifas.html?mp_status=approved',
          pending: 'https://ancu.uy/rifas.html?mp_status=pending',
          failure: 'https://ancu.uy/rifas.html?mp_status=failure'
        },
        notification_url: 'https://ancu.uy/api/webhooks/mercadopago',
        auto_return: 'approved'
      };

      const preferenceResult = await mpPreference.create({ body: preferenceData });

      return res.json({
        success: true,
        mode: 'LIVE',
        preferenceId: preferenceResult.id,
        initPoint: preferenceResult.init_point,
        sandboxInitPoint: preferenceResult.sandbox_init_point,
        externalReference,
        totalAmount
      });
    }

    // Modo Simulación/Preparado (Retorna enlace seguro con simulación)
    const simulatedRef = `MP-SIM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    res.json({
      success: true,
      mode: 'SIMULATION',
      preferenceId: `pref_sim_${Date.now()}`,
      initPoint: null,
      externalReference: simulatedRef,
      totalAmount,
      message: 'Mercado Pago preparado. Configura MP_ACCESS_TOKEN en el archivo .env del VPS para abrir Checkout Pro en vivo.'
    });
  } catch (err) {
    console.error('Error creating MP preference:', err);
    res.status(500).json({ error: 'Error al generar preferencia de pago de Mercado Pago.' });
  }
});

// Confirmación de compra / Checkout Híbrido (Mercado Pago o Transferencias)
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
      paymentMethod,
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
      const generatedOrderRef = paymentRef || `MP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

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
        message: '¡Pago con Mercado Pago acreditado! Tus números han sido confirmados oficialmente.'
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

// Webhook IPN de Mercado Pago
app.post('/api/webhooks/mercadopago', async (req, res) => {
  try {
    const { type, data, action } = req.body;
    const paymentId = (data && data.id) || req.query['data.id'] || req.query.id;

    console.log(`[Webhook MP] Evento recibido: ${type || action}, ID: ${paymentId}`);

    if (mpPayment && paymentId) {
      const paymentInfo = await mpPayment.get({ id: paymentId });
      if (paymentInfo && paymentInfo.status === 'approved') {
        const metadata = paymentInfo.metadata || {};
        const client = await db.getClient();
        try {
          await client.query('BEGIN');

          if (metadata.target_type === 'RAFFLE' && Array.isArray(metadata.numbers)) {
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
            `, [metadata.buyer_name, metadata.buyer_phone, metadata.buyer_email, metadata.buyer_ci, metadata.buyer_dept, `MP-${paymentId}`, metadata.raffle_id || 1, metadata.numbers]);
          } else if (metadata.target_type === 'MEMBERSHIP' && metadata.member_ci) {
            await client.query(`
              UPDATE members 
              SET status = 'ACTIVE', valid_until = CURRENT_DATE + INTERVAL '1 year', updated_at = NOW()
              WHERE ci = $1;
            `, [metadata.member_ci]);
          }

          await client.query(`
            INSERT INTO audit_logs (action, details, ip_address)
            VALUES ($1, $2, $3);
          `, ['MP_WEBHOOK_PAYMENT_APPROVED', { paymentId, status: paymentInfo.status, amount: paymentInfo.transaction_amount, metadata }, req.ip]);

          await client.query('COMMIT');
          console.log(`[Webhook MP] Pago ${paymentId} confirmado e impactado en base de datos.`);
        } catch (dbErr) {
          await client.query('ROLLBACK');
          console.error('[Webhook MP] Error al impactar en BD:', dbErr);
        } finally {
          client.release();
        }
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Error processing Mercado Pago Webhook:', err);
    res.status(200).send('ERROR_HANDLED');
  }
});

// ----------------------------------------------------
// 2. MÓDULO DE NOTICIAS Y COMUNICADOS (CMS)
// ----------------------------------------------------

// Listar noticias públicas
app.get('/api/news', async (req, res) => {
  try {
    const { category, featured } = req.query;
    let query = `SELECT * FROM news_articles WHERE status = 'PUBLISHED'`;
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (featured === 'true') {
      query += ` AND is_featured = true`;
    }

    query += ` ORDER BY is_featured DESC, publish_date DESC, id DESC LIMIT 20;`;

    const newsRes = await db.query(query, params);
    res.json({ articles: newsRes.rows });
  } catch (err) {
    console.error('Error fetching news articles:', err);
    res.status(500).json({ error: 'Error al consultar noticias.' });
  }
});

// Obtener detalle de una noticia específica
app.get('/api/news/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isNumeric = /^\d+$/.test(idOrSlug);

    let articleRes;
    if (isNumeric) {
      articleRes = await db.query('SELECT * FROM news_articles WHERE id = $1 LIMIT 1;', [parseInt(idOrSlug, 10)]);
    } else {
      articleRes = await db.query('SELECT * FROM news_articles WHERE slug = $1 LIMIT 1;', [idOrSlug]);
    }

    if (articleRes.rowCount === 0) {
      return res.status(404).json({ error: 'Artículo de noticia no encontrado.' });
    }

    const article = articleRes.rows[0];

    // Incrementar contador de vistas
    await db.query('UPDATE news_articles SET views_count = views_count + 1 WHERE id = $1;', [article.id]);

    res.json({ article });
  } catch (err) {
    console.error('Error fetching single news article:', err);
    res.status(500).json({ error: 'Error al consultar el artículo.' });
  }
});

// ----------------------------------------------------
// 3. MÓDULO DE SOCIOS Y PADRÓN ("MI ANCU")
// ----------------------------------------------------

// Consultar socio por cédula o número de socio
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
// 4. MÓDULO DE ADMINISTRACIÓN (BACKOFFICE / ROLES)
// ----------------------------------------------------

// Login de Administrador / Editor / Tesorería
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

// Listar usuarios administrativos
app.get('/api/admin/users', async (req, res) => {
  try {
    const usersRes = await db.query(`
      SELECT id, username, email, full_name, role, created_at 
      FROM admin_users 
      ORDER BY id ASC;
    `);
    res.json({ users: usersRes.rows });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Error al consultar usuarios del sistema.' });
  }
});

// Crear nuevo usuario administrador o editor
app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, email, password, fullName, role = 'EDITOR' } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    const existingRes = await db.query(`
      SELECT id FROM admin_users 
      WHERE username = $1 OR email = $2;
    `, [cleanUsername, cleanEmail]);

    if (existingRes.rowCount > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario o correo electrónico.' });
    }

    const insertRes = await db.query(`
      INSERT INTO admin_users (username, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, full_name, role, created_at;
    `, [cleanUsername, cleanEmail, password, fullName.trim(), role]);

    const newUser = insertRes.rows[0];

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['ADMIN_USER_CREATED', { userId: newUser.id, username: newUser.username, role: newUser.role }, req.ip]);

    res.json({
      success: true,
      message: `¡Usuario ${newUser.full_name} (${newUser.role}) creado exitosamente!`,
      user: newUser
    });
  } catch (err) {
    console.error('Error creating admin user:', err);
    res.status(500).json({ error: 'Error al crear usuario.' });
  }
});

// Modificar usuario administrador
app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, fullName, role } = req.body;

    let updateQuery;
    let params;

    if (password && password.trim() !== '') {
      updateQuery = `
        UPDATE admin_users 
        SET email = COALESCE($1, email),
            full_name = COALESCE($2, full_name),
            role = COALESCE($3, role),
            password_hash = $4
        WHERE id = $5
        RETURNING id, username, email, full_name, role, created_at;
      `;
      params = [email ? email.trim().toLowerCase() : null, fullName ? fullName.trim() : null, role, password, id];
    } else {
      updateQuery = `
        UPDATE admin_users 
        SET email = COALESCE($1, email),
            full_name = COALESCE($2, full_name),
            role = COALESCE($3, role)
        WHERE id = $4
        RETURNING id, username, email, full_name, role, created_at;
      `;
      params = [email ? email.trim().toLowerCase() : null, fullName ? fullName.trim() : null, role, id];
    }

    const updateRes = await db.query(updateQuery, params);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['ADMIN_USER_UPDATED', { userId: id, role }, req.ip]);

    res.json({
      success: true,
      message: 'Usuario actualizado con éxito.',
      user: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating admin user:', err);
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// Eliminar usuario administrador
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id, 10) === 1) {
      return res.status(403).json({ error: 'No es posible eliminar al Super Administrador principal.' });
    }

    const deleteRes = await db.query('DELETE FROM admin_users WHERE id = $1 RETURNING username;', [id]);

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['ADMIN_USER_DELETED', { userId: id, username: deleteRes.rows[0].username }, req.ip]);

    res.json({
      success: true,
      message: 'Usuario eliminado con éxito.'
    });
  } catch (err) {
    console.error('Error deleting admin user:', err);
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
});

// Subida de Fotografías de Premios
app.post('/api/admin/upload-prize-image', uploadPrize.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de imagen válido.' });
    }
    const imageUrl = `/uploads/prizes/${req.file.filename}`;
    res.json({ success: true, imageUrl, filename: req.file.filename, size: req.file.size });
  } catch (err) {
    console.error('Error uploading prize image:', err);
    res.status(500).json({ error: 'Error al procesar la subida de imagen de premio.' });
  }
});

// Subida de Fotografías de Noticias
app.post('/api/admin/upload-news-image', uploadNews.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de imagen válido.' });
    }
    const imageUrl = `/uploads/news/${req.file.filename}`;
    res.json({ success: true, imageUrl, filename: req.file.filename, size: req.file.size });
  } catch (err) {
    console.error('Error uploading news image:', err);
    res.status(500).json({ error: 'Error al procesar la subida de imagen de noticia.' });
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

    const newsRes = await db.query(`
      SELECT COUNT(*) as total_news FROM news_articles;
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
      totalNews: parseInt(newsRes.rows[0].total_news, 10),
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

    if (status === 'ACTIVE') {
      await client.query("UPDATE raffles SET status = 'CLOSED' WHERE status = 'ACTIVE';");
    }

    const newRaffleRes = await client.query(`
      INSERT INTO raffles (title, subtitle, draw_date, draw_method, ticket_price, total_numbers, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [title, subtitle || null, drawDate, drawMethod, ticketPrice, totalNumbers, status]);

    const newRaffle = newRaffleRes.rows[0];

    if (Array.isArray(prizes) && prizes.length > 0) {
      for (const [idx, p] of prizes.entries()) {
        await client.query(`
          INSERT INTO raffle_prizes (raffle_id, prize_order, title, description, image_url, estimated_value, regulated, note)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, [newRaffle.id, idx + 1, p.title, p.description || null, p.imageUrl || null, p.estimatedValue || 0, p.regulated || false, p.note || null]);
      }
    } else {
      await client.query(`
        INSERT INTO raffle_prizes (raffle_id, prize_order, title, description, regulated, note)
        VALUES 
          ($1, 1, '1º Premio Principal', 'Descripción del primer premio', true, 'Requiere THATA'),
          ($1, 2, '2º Premio', 'Descripción del segundo premio', true, 'Requiere THATA'),
          ($1, 3, '3º Premio', 'Descripción del tercer premio', false, 'Entrega directa');
      `, [newRaffle.id]);
    }

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
    const { title, subtitle, drawDate, drawMethod, ticketPrice, status, bannerImageUrl } = req.body;

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

// Modificar premios de una rifa
app.put('/api/admin/raffles/:id/prizes', async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { prizes } = req.body;

    if (!Array.isArray(prizes)) {
      return res.status(400).json({ error: 'El formato de premios debe ser una lista.' });
    }

    await client.query('BEGIN');
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

// ----------------------------------------------------
// 5. CMS ADMIN: GESTOR DE NOTICIAS Y COMUNICADOS
// ----------------------------------------------------

// Listar todas las noticias para administración (incluye borradores)
app.get('/api/admin/news', async (req, res) => {
  try {
    const newsRes = await db.query(`
      SELECT * FROM news_articles 
      ORDER BY id DESC;
    `);
    res.json({ articles: newsRes.rows });
  } catch (err) {
    console.error('Error fetching admin news:', err);
    res.status(500).json({ error: 'Error al consultar noticias administrativas.' });
  }
});

// Helper para crear slug URL-friendly
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
}

// Crear nueva noticia / comunicado
app.post('/api/admin/news', async (req, res) => {
  try {
    const {
      title,
      category = 'Comunicados',
      author = 'Secretaría de Prensa ANCU',
      publishDate,
      imageUrl,
      excerpt,
      content,
      isFeatured = false,
      status = 'PUBLISHED'
    } = req.body;

    if (!title || !excerpt || !content) {
      return res.status(400).json({ error: 'Título, resumen y contenido son obligatorios.' });
    }

    const slug = generateSlug(title);
    const dateVal = publishDate || new Date().toISOString().slice(0, 10);

    // Si se marca como destacada, desmarcar otras destacadas si se desea
    if (isFeatured) {
      await db.query('UPDATE news_articles SET is_featured = false WHERE is_featured = true;');
    }

    const insertRes = await db.query(`
      INSERT INTO news_articles (title, slug, category, author, publish_date, image_url, excerpt, content, is_featured, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `, [title, slug, category, author, dateVal, imageUrl || null, excerpt, content, isFeatured, status]);

    const article = insertRes.rows[0];

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['NEWS_CREATED', { articleId: article.id, title: article.title, category: article.category }, req.ip]);

    res.json({
      success: true,
      message: '¡Artículo de noticia publicado con éxito!',
      article
    });
  } catch (err) {
    console.error('Error creating news article:', err);
    res.status(500).json({ error: 'Error al publicar noticia.' });
  }
});

// Modificar noticia existente
app.put('/api/admin/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      author,
      publishDate,
      imageUrl,
      excerpt,
      content,
      isFeatured,
      status
    } = req.body;

    if (isFeatured) {
      await db.query('UPDATE news_articles SET is_featured = false WHERE id != $1;', [id]);
    }

    const updateRes = await db.query(`
      UPDATE news_articles 
      SET title = COALESCE($1, title),
          category = COALESCE($2, category),
          author = COALESCE($3, author),
          publish_date = COALESCE($4, publish_date),
          image_url = COALESCE($5, image_url),
          excerpt = COALESCE($6, excerpt),
          content = COALESCE($7, content),
          is_featured = COALESCE($8, is_featured),
          status = COALESCE($9, status),
          updated_at = NOW()
      WHERE id = $10
      RETURNING *;
    `, [title, category, author, publishDate, imageUrl, excerpt, content, isFeatured, status, id]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['NEWS_UPDATED', { articleId: id, title }, req.ip]);

    res.json({
      success: true,
      message: 'Artículo actualizado con éxito.',
      article: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating news article:', err);
    res.status(500).json({ error: 'Error al actualizar noticia.' });
  }
});

// Eliminar noticia
app.delete('/api/admin/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleteRes = await db.query('DELETE FROM news_articles WHERE id = $1 RETURNING title;', [id]);

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['NEWS_DELETED', { articleId: id, title: deleteRes.rows[0].title }, req.ip]);

    res.json({
      success: true,
      message: 'Artículo eliminado con éxito.'
    });
  } catch (err) {
    console.error('Error deleting news article:', err);
    res.status(500).json({ error: 'Error al eliminar noticia.' });
  }
});

// ----------------------------------------------------
// 6. ADMINISTRACIÓN DE COMPROBANTES Y CSV
// ----------------------------------------------------

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

    let csv = '\uFEFF';
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

// ====================================================
// 7. MÓDULO DE GOBERNANZA Y AUTORIDADES (DIRECTIVA)
// ====================================================

// Listar autoridades públicas
app.get('/api/authorities', async (req, res) => {
  try {
    const authRes = await db.query(`
      SELECT id, name, role_title, bio, photo_url, mandate_period, display_order, status 
      FROM authorities 
      WHERE status = 'ACTIVE' 
      ORDER BY display_order ASC, id ASC;
    `);

    const mandateRes = await db.query(`
      SELECT setting_value FROM institutional_settings WHERE setting_key = 'mandate_period' LIMIT 1;
    `);
    const mandatePeriod = mandateRes.rows[0]?.setting_value || '2024 – 2027';

    res.json({
      mandatePeriod,
      authorities: authRes.rows
    });
  } catch (err) {
    console.error('Error fetching public authorities:', err);
    res.status(500).json({ error: 'Error al consultar autoridades.' });
  }
});

// Listar todas las autoridades para Backoffice
app.get('/api/admin/authorities', async (req, res) => {
  try {
    const authRes = await db.query(`
      SELECT * FROM authorities ORDER BY display_order ASC, id ASC;
    `);
    res.json({ authorities: authRes.rows });
  } catch (err) {
    console.error('Error fetching admin authorities:', err);
    res.status(500).json({ error: 'Error al consultar autoridades.' });
  }
});

// Crear autoridad (con subida de foto opcional)
app.post('/api/admin/authorities', uploadAuthority.single('photo'), async (req, res) => {
  try {
    const { name, role_title, bio, mandate_period, display_order, status, photo_url } = req.body;
    let finalPhotoUrl = photo_url || null;

    if (req.file) {
      finalPhotoUrl = `/uploads/authorities/${req.file.filename}`;
    }

    if (!name || !role_title) {
      return res.status(400).json({ error: 'Nombre y cargo son requeridos.' });
    }

    const insertRes = await db.query(`
      INSERT INTO authorities (name, role_title, bio, photo_url, mandate_period, display_order, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [
      name,
      role_title,
      bio || '',
      finalPhotoUrl || 'assets/logo.png',
      mandate_period || '2024 – 2027',
      parseInt(display_order, 10) || 1,
      status || 'ACTIVE'
    ]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['AUTHORITY_CREATED', { authorityId: insertRes.rows[0].id, name, role_title }, req.ip]);

    res.json({
      success: true,
      message: 'Autoridad creada exitosamente.',
      authority: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Error creating authority:', err);
    res.status(500).json({ error: 'Error al guardar autoridad.' });
  }
});

// Modificar autoridad (con subida de foto opcional)
app.put('/api/admin/authorities/:id', uploadAuthority.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role_title, bio, mandate_period, display_order, status, photo_url } = req.body;

    const existingRes = await db.query('SELECT * FROM authorities WHERE id = $1', [id]);
    if (existingRes.rowCount === 0) {
      return res.status(404).json({ error: 'Autoridad no encontrada.' });
    }
    const current = existingRes.rows[0];

    let finalPhotoUrl = current.photo_url;
    if (req.file) {
      finalPhotoUrl = `/uploads/authorities/${req.file.filename}`;
    } else if (photo_url !== undefined && photo_url !== '') {
      finalPhotoUrl = photo_url;
    }

    const updateRes = await db.query(`
      UPDATE authorities 
      SET name = $1,
          role_title = $2,
          bio = $3,
          photo_url = $4,
          mandate_period = $5,
          display_order = $6,
          status = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *;
    `, [
      name || current.name,
      role_title || current.role_title,
      bio !== undefined ? bio : current.bio,
      finalPhotoUrl,
      mandate_period || current.mandate_period,
      display_order !== undefined ? parseInt(display_order, 10) : current.display_order,
      status || current.status,
      id
    ]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['AUTHORITY_UPDATED', { authorityId: id, name: updateRes.rows[0].name }, req.ip]);

    res.json({
      success: true,
      message: 'Autoridad actualizada con éxito.',
      authority: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating authority:', err);
    res.status(500).json({ error: 'Error al actualizar autoridad.' });
  }
});

// Eliminar autoridad
app.delete('/api/admin/authorities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delRes = await db.query('DELETE FROM authorities WHERE id = $1 RETURNING name;', [id]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: 'Autoridad no encontrada.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['AUTHORITY_DELETED', { authorityId: id, name: delRes.rows[0].name }, req.ip]);

    res.json({ success: true, message: 'Autoridad eliminada con éxito.' });
  } catch (err) {
    console.error('Error deleting authority:', err);
    res.status(500).json({ error: 'Error al eliminar autoridad.' });
  }
});

// ====================================================
// 8. MÓDULO DE CONFIGURACIONES INSTITUCIONALES GLOBALES
// ====================================================

// Obtener configuraciones públicas
app.get('/api/settings', async (req, res) => {
  try {
    const settingsRes = await db.query(`SELECT setting_key, setting_value, category, label FROM institutional_settings;`);
    const map = {};
    settingsRes.rows.forEach(r => {
      map[r.setting_key] = r.setting_value;
    });
    res.json({ settings: map, raw: settingsRes.rows });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Error al consultar configuraciones.' });
  }
});

// Obtener configuraciones para Backoffice
app.get('/api/admin/settings', async (req, res) => {
  try {
    const settingsRes = await db.query(`SELECT * FROM institutional_settings ORDER BY category ASC, setting_key ASC;`);
    res.json({ settings: settingsRes.rows });
  } catch (err) {
    console.error('Error fetching admin settings:', err);
    res.status(500).json({ error: 'Error al consultar configuraciones.' });
  }
});

// Guardar/Actualizar configuraciones por clave o en lote
app.put('/api/admin/settings', async (req, res) => {
  try {
    const { settings } = req.body; // Array de { setting_key, setting_value } o objeto key-value
    if (!settings) {
      return res.status(400).json({ error: 'No se enviaron datos de configuración.' });
    }

    const entries = Array.isArray(settings) ? settings : Object.entries(settings).map(([k, v]) => ({ setting_key: k, setting_value: v }));

    for (const item of entries) {
      if (item.setting_key) {
        await db.query(`
          INSERT INTO institutional_settings (setting_key, setting_value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (setting_key) DO UPDATE 
          SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
        `, [item.setting_key, String(item.setting_value || '')]);
      }
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['SETTINGS_UPDATED', { updatedKeys: entries.map(e => e.setting_key) }, req.ip]);

    res.json({ success: true, message: 'Configuraciones institucionales actualizadas con éxito.' });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Error al guardar configuraciones.' });
  }
});

// Subir PDF oficial de Estatuto o Documento
app.post('/api/admin/settings/upload-statute', uploadDocument.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó ningún archivo PDF.' });
    }

    const docUrl = `/uploads/documents/${req.file.filename}`;

    await db.query(`
      INSERT INTO institutional_settings (setting_key, setting_value, category, label, updated_at)
      VALUES ('statute_pdf_url', $1, 'STATUTE', 'Ruta al Documento PDF del Estatuto', NOW())
      ON CONFLICT (setting_key) DO UPDATE 
      SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
    `, [docUrl]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['STATUTE_UPLOADED', { documentUrl: docUrl, originalName: req.file.originalname }, req.ip]);

    res.json({
      success: true,
      message: 'Documento PDF de estatuto subido con éxito.',
      documentUrl: docUrl
    });
  } catch (err) {
    console.error('Error uploading statute doc:', err);
    res.status(500).json({ error: 'Error al subir archivo.' });
  }
});

// ====================================================
// 9. MÓDULO DE ACTIVIDADES, CURSOS Y EVENTOS
// ====================================================

// Listar actividades públicas
app.get('/api/activities', async (req, res) => {
  try {
    const actRes = await db.query(`
      SELECT * FROM activities 
      ORDER BY event_date ASC, id ASC;
    `);
    res.json({ activities: actRes.rows });
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Error al consultar actividades.' });
  }
});

// Listar actividades para Backoffice
app.get('/api/admin/activities', async (req, res) => {
  try {
    const actRes = await db.query(`SELECT * FROM activities ORDER BY event_date DESC, id DESC;`);
    res.json({ activities: actRes.rows });
  } catch (err) {
    console.error('Error fetching admin activities:', err);
    res.status(500).json({ error: 'Error al consultar actividades.' });
  }
});

// Crear actividad
app.post('/api/admin/activities', uploadActivity.single('image'), async (req, res) => {
  try {
    const { title, category, event_date, event_time, location, department, description, price_members, price_general, capacity, registration_status, image_url } = req.body;

    let finalImageUrl = image_url || null;
    if (req.file) {
      finalImageUrl = `/uploads/activities/${req.file.filename}`;
    }

    if (!title || !event_date || !location) {
      return res.status(400).json({ error: 'Título, fecha y ubicación son obligatorios.' });
    }

    const insRes = await db.query(`
      INSERT INTO activities (title, category, event_date, event_time, location, department, description, price_members, price_general, capacity, registration_status, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `, [
      title,
      category || 'Capacitación',
      event_date,
      event_time || '09:00',
      location,
      department || 'Lavalleja',
      description || '',
      parseFloat(price_members) || 0.00,
      parseFloat(price_general) || 0.00,
      parseInt(capacity, 10) || 30,
      registration_status || 'OPEN',
      finalImageUrl || 'assets/hero_uruguay_monte.jpg'
    ]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['ACTIVITY_CREATED', { activityId: insRes.rows[0].id, title }, req.ip]);

    res.json({
      success: true,
      message: 'Actividad creada con éxito.',
      activity: insRes.rows[0]
    });
  } catch (err) {
    console.error('Error creating activity:', err);
    res.status(500).json({ error: 'Error al guardar actividad.' });
  }
});

// Modificar actividad
app.put('/api/admin/activities/:id', uploadActivity.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, event_date, event_time, location, department, description, price_members, price_general, capacity, registration_status, image_url } = req.body;

    const existRes = await db.query('SELECT * FROM activities WHERE id = $1', [id]);
    if (existRes.rowCount === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }
    const current = existRes.rows[0];

    let finalImageUrl = current.image_url;
    if (req.file) {
      finalImageUrl = `/uploads/activities/${req.file.filename}`;
    } else if (image_url !== undefined && image_url !== '') {
      finalImageUrl = image_url;
    }

    const updRes = await db.query(`
      UPDATE activities 
      SET title = $1,
          category = $2,
          event_date = $3,
          event_time = $4,
          location = $5,
          department = $6,
          description = $7,
          price_members = $8,
          price_general = $9,
          capacity = $10,
          registration_status = $11,
          image_url = $12,
          updated_at = NOW()
      WHERE id = $13
      RETURNING *;
    `, [
      title || current.title,
      category || current.category,
      event_date || current.event_date,
      event_time || current.event_time,
      location || current.location,
      department || current.department,
      description !== undefined ? description : current.description,
      price_members !== undefined ? parseFloat(price_members) : current.price_members,
      price_general !== undefined ? parseFloat(price_general) : current.price_general,
      capacity !== undefined ? parseInt(capacity, 10) : current.capacity,
      registration_status || current.registration_status,
      finalImageUrl,
      id
    ]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['ACTIVITY_UPDATED', { activityId: id, title: updRes.rows[0].title }, req.ip]);

    res.json({
      success: true,
      message: 'Actividad actualizada con éxito.',
      activity: updRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating activity:', err);
    res.status(500).json({ error: 'Error al actualizar actividad.' });
  }
});

// Eliminar actividad
app.delete('/api/admin/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delRes = await db.query('DELETE FROM activities WHERE id = $1 RETURNING title;', [id]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['ACTIVITY_DELETED', { activityId: id, title: delRes.rows[0].title }, req.ip]);

    res.json({ success: true, message: 'Actividad eliminada con éxito.' });
  } catch (err) {
    console.error('Error deleting activity:', err);
    res.status(500).json({ error: 'Error al eliminar actividad.' });
  }
});

// ====================================================
// 10. MÓDULO DE BENEFICIOS Y CONVENIOS COMERCIALES
// ====================================================

// Listar convenios públicos
app.get('/api/benefits', async (req, res) => {
  try {
    const benRes = await db.query(`
      SELECT * FROM commercial_benefits 
      WHERE is_active = true 
      ORDER BY display_order ASC, id ASC;
    `);
    res.json({ benefits: benRes.rows });
  } catch (err) {
    console.error('Error fetching public benefits:', err);
    res.status(500).json({ error: 'Error al consultar convenios.' });
  }
});

// Listar convenios para Backoffice
app.get('/api/admin/benefits', async (req, res) => {
  try {
    const benRes = await db.query(`SELECT * FROM commercial_benefits ORDER BY display_order ASC, id ASC;`);
    res.json({ benefits: benRes.rows });
  } catch (err) {
    console.error('Error fetching admin benefits:', err);
    res.status(500).json({ error: 'Error al consultar convenios.' });
  }
});

// Crear convenio comercial
app.post('/api/admin/benefits', uploadPartner.single('logo'), async (req, res) => {
  try {
    const { partner_name, discount_text, category, website_url, address, department, display_order, is_active, logo_url } = req.body;

    let finalLogoUrl = logo_url || null;
    if (req.file) {
      finalLogoUrl = `/uploads/partners/${req.file.filename}`;
    }

    if (!partner_name || !discount_text) {
      return res.status(400).json({ error: 'Comercio y beneficio son requeridos.' });
    }

    const insRes = await db.query(`
      INSERT INTO commercial_benefits (partner_name, discount_text, category, logo_url, website_url, address, department, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `, [
      partner_name,
      discount_text,
      category || 'Armerías',
      finalLogoUrl || 'assets/logo.png',
      website_url || '',
      address || '',
      department || 'Montevideo',
      parseInt(display_order, 10) || 1,
      is_active !== 'false' && is_active !== false
    ]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['BENEFIT_CREATED', { benefitId: insRes.rows[0].id, partner_name }, req.ip]);

    res.json({
      success: true,
      message: 'Convenio comercial creado con éxito.',
      benefit: insRes.rows[0]
    });
  } catch (err) {
    console.error('Error creating benefit:', err);
    res.status(500).json({ error: 'Error al guardar convenio comercial.' });
  }
});

// Modificar convenio comercial
app.put('/api/admin/benefits/:id', uploadPartner.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { partner_name, discount_text, category, website_url, address, department, display_order, is_active, logo_url } = req.body;

    const existRes = await db.query('SELECT * FROM commercial_benefits WHERE id = $1', [id]);
    if (existRes.rowCount === 0) {
      return res.status(404).json({ error: 'Convenio no encontrado.' });
    }
    const current = existRes.rows[0];

    let finalLogoUrl = current.logo_url;
    if (req.file) {
      finalLogoUrl = `/uploads/partners/${req.file.filename}`;
    } else if (logo_url !== undefined && logo_url !== '') {
      finalLogoUrl = logo_url;
    }

    const updRes = await db.query(`
      UPDATE commercial_benefits 
      SET partner_name = $1,
          discount_text = $2,
          category = $3,
          logo_url = $4,
          website_url = $5,
          address = $6,
          department = $7,
          display_order = $8,
          is_active = $9
      WHERE id = $10
      RETURNING *;
    `, [
      partner_name || current.partner_name,
      discount_text || current.discount_text,
      category || current.category,
      finalLogoUrl,
      website_url !== undefined ? website_url : current.website_url,
      address !== undefined ? address : current.address,
      department || current.department,
      display_order !== undefined ? parseInt(display_order, 10) : current.display_order,
      is_active !== undefined ? (is_active !== 'false' && is_active !== false) : current.is_active,
      id
    ]);

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['BENEFIT_UPDATED', { benefitId: id, partner_name: updRes.rows[0].partner_name }, req.ip]);

    res.json({
      success: true,
      message: 'Convenio actualizado con éxito.',
      benefit: updRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating benefit:', err);
    res.status(500).json({ error: 'Error al actualizar convenio.' });
  }
});

// Eliminar convenio comercial
app.delete('/api/admin/benefits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delRes = await db.query('DELETE FROM commercial_benefits WHERE id = $1 RETURNING partner_name;', [id]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: 'Convenio no encontrado.' });
    }

    await db.query(`
      INSERT INTO audit_logs (action, details, ip_address)
      VALUES ($1, $2, $3);
    `, ['BENEFIT_DELETED', { benefitId: id, partner_name: delRes.rows[0].partner_name }, req.ip]);

    res.json({ success: true, message: 'Convenio eliminado con éxito.' });
  } catch (err) {
    console.error('Error deleting benefit:', err);
    res.status(500).json({ error: 'Error al eliminar convenio.' });
  }
});

// Iniciar Servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌲 Servidor Backend ANCU activo en el puerto ${PORT}`);
  console.log(`📊 Conexión a PostgreSQL: ${process.env.DB_NAME || 'ancu_db'} en ${process.env.DB_HOST || 'localhost'}`);
});
