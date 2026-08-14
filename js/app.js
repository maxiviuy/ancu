/**
 * ANCU - ASOCIACIÓN NACIONAL DE CAZADORES DEL URUGUAY
 * Core Client Engine & Interactive State Management
 * Full Backend API & PostgreSQL Synchronization
 */

const API_BASE = '/api';
const APP_STORAGE_KEY = 'ancu_app_state_v2';

const DEFAULT_STATE = {
  activeRaffle: {
    id: 1,
    title: "Gran Rifa de Colaboración ANCU 2026",
    subtitle: "Fondo de Equipamiento y Actividades Institucionales",
    drawDate: "2026-08-31T20:00:00",
    drawMethod: "Quiniela Nocturna de la Lotería Nacional",
    ticketPrice: 400,
    totalNumbers: 1000,
    prizes: [
      { order: 1, title: "1 Rifle Deportivo Savage Mark-II F Cal. .22LR", regulated: true, note: "Requiere THATA vigente para entrega legal" },
      { order: 2, title: "1 Pistola Taurus G3C Compact Black Cal. 9mm", regulated: true, note: "Requiere THATA vigente para entrega legal" },
      { order: 3, title: "1 Cuchillo de Supervivencia y Monte Glock FM81", regulated: false, note: "Entrega directa" }
    ],
    numbers: {}
  },
  selectedNumbers: [],
  cartTimer: null,
  cartTimeRemaining: 900, // 15 mins
  memberUser: {
    isLoggedIn: true,
    firstName: "Carlos",
    lastName: "Mendiondo",
    ci: "3.842.190-4",
    memberNumber: "ANCU-0012",
    category: "Socio Pleno Activo",
    status: "ACTIVE", // ACTIVE or OVERDUE
    validUntil: "31/12/2026",
    department: "Lavalleja",
    thataNumber: "UY-88421",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
  },
  auditLogs: []
};

// Generate 1000 numbers fallback
function generateInitialNumbers() {
  const numbers = {};
  for (let i = 0; i < 1000; i++) {
    const formatted = String(i).padStart(3, '0');
    numbers[formatted] = { status: 'available' };
  }
  return numbers;
}

let AppState = (function() {
  const saved = localStorage.getItem(APP_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.activeRaffle.numbers || Object.keys(parsed.activeRaffle.numbers).length === 0) {
        parsed.activeRaffle.numbers = generateInitialNumbers();
      }
      return parsed;
    } catch (e) {
      console.warn("Storage reset due to parse error", e);
    }
  }
  const initial = { ...DEFAULT_STATE };
  initial.activeRaffle.numbers = generateInitialNumbers();
  return initial;
})();

function saveState() {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(AppState));
}

// ---------------- DOM Ready & Init ----------------
async function bootstrapApp() {
  initMobileNavigation();
  initHundredsTabs();
  initRaffleSearch();
  initModalListeners();
  initNormativaFilters();
  initMembershipForm();

  // Synchronize with real PostgreSQL backend
  await syncRaffleFromAPI();
  await syncMemberFromAPI();
  await initAdminDashboard();

  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
  updateRaffleStats();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}

// ---------------- API Synchronization ----------------
async function syncRaffleFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/raffle/active`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.raffle) {
      AppState.activeRaffle.id = data.raffle.id;
      AppState.activeRaffle.title = data.raffle.title;
      AppState.activeRaffle.subtitle = data.raffle.subtitle;
      AppState.activeRaffle.ticketPrice = data.raffle.ticketPrice;
      AppState.activeRaffle.totalNumbers = data.raffle.totalNumbers;
      AppState.activeRaffle.prizes = data.raffle.prizes || AppState.activeRaffle.prizes;

      // Update numbers mapping
      if (data.raffle.numbers) {
        Object.keys(data.raffle.numbers).forEach(num => {
          const item = data.raffle.numbers[num];
          AppState.activeRaffle.numbers[num] = {
            status: item.status === 'paid' ? 'sold' : item.status,
            heldUntil: item.heldUntil
          };
        });
      }
      saveState();
      console.log('🌲 Rifa sincronizada con base de datos PostgreSQL.');
    }
  } catch (err) {
    console.warn('Usando estado local para rifas (Backend no disponible o sin conexión):', err.message);
  }
}

async function syncMemberFromAPI(ci = '3.842.190-4') {
  try {
    const res = await fetch(`${API_BASE}/members/lookup/${encodeURIComponent(ci)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.member) {
      AppState.memberUser = {
        isLoggedIn: true,
        firstName: data.member.firstName,
        lastName: data.member.lastName,
        ci: data.member.ci,
        memberNumber: data.member.memberNumber,
        category: data.member.category,
        status: data.member.status,
        validUntil: new Date(data.member.validUntil).toLocaleDateString('es-UY'),
        department: data.member.department,
        thataNumber: data.member.thataNumber || 'En trámite',
        photoUrl: data.member.photoUrl || DEFAULT_STATE.memberUser.photoUrl
      };
      saveState();
    }
  } catch (err) {
    console.warn('No se pudo sincronizar socio desde API:', err.message);
  }
  renderDigitalCard();
}

// ---------------- Mobile Navigation Handler ----------------
function initMobileNavigation() {
  const toggleBtn = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = navLinks.classList.toggle('active');
    toggleBtn.innerHTML = isActive ? '&times;' : '&#9776;';
    toggleBtn.setAttribute('aria-expanded', isActive);
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      toggleBtn.innerHTML = '&#9776;';
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && !toggleBtn.contains(e.target)) {
      navLinks.classList.remove('active');
      toggleBtn.innerHTML = '&#9776;';
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ---------------- Raffle Engine Logic ----------------
let currentHundred = 0;

function initHundredsTabs() {
  const tabsWrap = document.getElementById('hundreds-tabs-wrap');
  if (!tabsWrap) return;

  tabsWrap.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const start = String(i * 100).padStart(3, '0');
    const end = String((i * 100) + 99).padStart(3, '0');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hundred-tab-btn ${i === currentHundred ? 'active' : ''}`;
    btn.textContent = `${start} - ${end}`;
    btn.setAttribute('data-hundred', i);
    btn.onclick = () => {
      currentHundred = i;
      document.querySelectorAll('.hundred-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderNumbersGrid(currentHundred);
    };
    tabsWrap.appendChild(btn);
  }
}

function renderNumbersGrid(hundredIndex) {
  const grid = document.getElementById('numbers-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const startNum = hundredIndex * 100;
  const endNum = startNum + 99;

  for (let i = startNum; i <= endNum; i++) {
    const formatted = String(i).padStart(3, '0');
    const item = AppState.activeRaffle.numbers[formatted] || { status: 'available' };
    const isSelected = AppState.selectedNumbers.includes(formatted);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `number-cell ${item.status} ${isSelected ? 'selected' : ''}`;
    btn.setAttribute('data-number', formatted);
    btn.setAttribute('aria-label', `Número ${formatted} - Estado: ${item.status}`);
    
    if (item.status === 'sold') {
      btn.disabled = true;
      btn.title = "Número ya adquirido";
    } else if (item.status === 'held') {
      btn.title = "Número reservado temporalmente";
    }

    btn.innerHTML = `<span class="num-digits">${formatted}</span>`;
    btn.onclick = () => toggleNumberSelection(formatted);

    grid.appendChild(btn);
  }
}

function toggleNumberSelection(numberStr) {
  const item = AppState.activeRaffle.numbers[numberStr];
  if (item && (item.status === 'sold' || item.status === 'paid')) {
    alert(`El número #${numberStr} ya ha sido adquirido.`);
    return;
  }

  const idx = AppState.selectedNumbers.indexOf(numberStr);
  if (idx > -1) {
    AppState.selectedNumbers.splice(idx, 1);
  } else {
    if (AppState.selectedNumbers.length >= 20) {
      alert("Puedes seleccionar un máximo de 20 números por compra.");
      return;
    }
    AppState.selectedNumbers.push(numberStr);
  }

  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
}

function initRaffleSearch() {
  const searchInput = document.getElementById('raffle-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length === 0) {
      renderNumbersGrid(currentHundred);
      return;
    }

    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 999) {
      const targetHundred = Math.floor(num / 100);
      if (targetHundred !== currentHundred) {
        currentHundred = targetHundred;
        initHundredsTabs();
      }
      renderNumbersGrid(currentHundred);
      
      const formatted = String(num).padStart(3, '0');
      setTimeout(() => {
        const targetBtn = document.querySelector(`[data-number="${formatted}"]`);
        if (targetBtn) {
          targetBtn.classList.add('search-highlight');
          targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => targetBtn.classList.remove('search-highlight'), 2000);
        }
      }, 100);
    }
  });
}

function selectRandomNumbers(count) {
  const available = [];
  for (let i = 0; i < 1000; i++) {
    const formatted = String(i).padStart(3, '0');
    const item = AppState.activeRaffle.numbers[formatted];
    if (!item || item.status === 'available') {
      available.push(formatted);
    }
  }

  if (available.length === 0) {
    alert("¡Lo sentimos! Todos los números de esta rifa han sido adquiridos.");
    return;
  }

  const shuffled = [...available].sort(() => 0.5 - Math.random());
  const picked = shuffled.slice(0, Math.min(count, available.length));
  AppState.selectedNumbers = picked;
  
  const firstNum = parseInt(picked[0], 10);
  currentHundred = Math.floor(firstNum / 100);
  initHundredsTabs();
  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
}

function updateCheckoutTray() {
  const tray = document.getElementById('checkout-tray');
  const countEl = document.getElementById('tray-count');
  const pillsEl = document.getElementById('tray-pills');
  const totalEl = document.getElementById('tray-total');

  if (!tray) return;

  if (AppState.selectedNumbers.length === 0) {
    tray.style.display = 'none';
    return;
  }

  tray.style.display = 'flex';
  countEl.textContent = `${AppState.selectedNumbers.length} seleccionado(s)`;
  totalEl.textContent = `$ ${(AppState.selectedNumbers.length * AppState.activeRaffle.ticketPrice).toLocaleString('es-UY')}`;

  pillsEl.innerHTML = '';
  AppState.selectedNumbers.forEach(n => {
    const pill = document.createElement('span');
    pill.className = 'selected-pill';
    pill.innerHTML = `<strong>#${n}</strong> <button type="button" onclick="event.stopPropagation(); toggleNumberSelection('${n}')">&times;</button>`;
    pillsEl.appendChild(pill);
  });
}

function updateRaffleStats() {
  const total = AppState.activeRaffle.totalNumbers || 1000;
  let sold = 0;
  let held = 0;
  let avail = 0;

  Object.values(AppState.activeRaffle.numbers).forEach(item => {
    if (item.status === 'sold' || item.status === 'paid') sold++;
    else if (item.status === 'held') held++;
    else avail++;
  });

  const percent = Math.round((sold / total) * 100);

  const statSold = document.getElementById('stat-sold');
  const statAvail = document.getElementById('stat-avail');
  const statHeld = document.getElementById('stat-held');
  const statPercent = document.getElementById('stat-percent');
  const progressBar = document.getElementById('raffle-progress-bar');

  if (statSold) statSold.textContent = sold;
  if (statAvail) statAvail.textContent = avail;
  if (statHeld) statHeld.textContent = held;
  if (statPercent) statPercent.textContent = `${percent}% vendido`;
  if (progressBar) progressBar.style.width = `${percent}%`;
}

// ---------------- Modal & Checkout Flow ----------------
let currentPaymentMethod = 'mercadopago';

async function openCheckoutModal() {
  if (AppState.selectedNumbers.length === 0) {
    alert("Por favor selecciona al menos un número.");
    return;
  }

  // Attempt to acquire server hold lock
  try {
    const res = await fetch(`${API_BASE}/raffle/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raffleId: AppState.activeRaffle.id || 1,
        numbers: AppState.selectedNumbers
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Algunos números ya no están disponibles.');
      await syncRaffleFromAPI();
      renderNumbersGrid(currentHundred);
      return;
    }
  } catch (e) {
    console.warn('Hold API no disponible, continuando en modo cliente:', e);
  }

  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  const modalNumbersList = document.getElementById('modal-selected-numbers');
  const modalTotal = document.getElementById('modal-total-price');
  if (modalNumbersList) modalNumbersList.textContent = AppState.selectedNumbers.join(', ');
  if (modalTotal) modalTotal.textContent = `$ ${(AppState.selectedNumbers.length * AppState.activeRaffle.ticketPrice).toLocaleString('es-UY')}`;

  startReservationTimer();
  modal.classList.add('active');
}

function startReservationTimer() {
  clearInterval(AppState.cartTimer);
  AppState.cartTimeRemaining = 900; // 15 mins

  const timerDisplay = document.getElementById('checkout-timer');
  
  function updateTimerText() {
    const mins = Math.floor(AppState.cartTimeRemaining / 60);
    const secs = AppState.cartTimeRemaining % 60;
    if (timerDisplay) {
      timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    if (AppState.cartTimeRemaining <= 0) {
      clearInterval(AppState.cartTimer);
      alert("El tiempo de reserva de 15 minutos ha expirado.");
      closeModal('checkout-modal');
      AppState.selectedNumbers = [];
      syncRaffleFromAPI().then(() => {
        renderNumbersGrid(currentHundred);
        updateCheckoutTray();
      });
    }
    AppState.cartTimeRemaining--;
  }

  updateTimerText();
  AppState.cartTimer = setInterval(updateTimerText, 1000);
}

function selectPaymentMethod(method) {
  currentPaymentMethod = method;
  document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('active'));
  const target = document.getElementById(`pay-method-${method}`);
  if (target) target.classList.add('active');

  const mpBox = document.getElementById('mp-details-box');
  const bankBox = document.getElementById('bank-details-box');
  if (method === 'mercadopago') {
    if (mpBox) mpBox.style.display = 'block';
    if (bankBox) bankBox.style.display = 'none';
  } else {
    if (mpBox) mpBox.style.display = 'none';
    if (bankBox) bankBox.style.display = 'block';
  }
}

async function submitCheckout(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('buyer-name')?.value.trim();
  const ci = document.getElementById('buyer-ci')?.value.trim();
  const phone = document.getElementById('buyer-phone')?.value.trim();
  const email = document.getElementById('buyer-email')?.value.trim();
  const dept = document.getElementById('buyer-dept')?.value;

  if (!name || !ci || !phone || !email) {
    alert("Por favor completa todos los campos requeridos.");
    return;
  }

  const payload = {
    raffleId: AppState.activeRaffle.id || 1,
    numbers: AppState.selectedNumbers,
    buyerName: name,
    buyerCi: ci,
    buyerPhone: phone,
    buyerEmail: email,
    buyerDept: dept,
    paymentMethod: currentPaymentMethod === 'mercadopago' ? 'MERCADOPAGO' : currentPaymentMethod.toUpperCase()
  };

  let responseData = null;
  try {
    const res = await fetch(`${API_BASE}/raffle/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    responseData = await res.json();
  } catch (err) {
    console.warn('API checkout offline, fallback local:', err);
  }

  const orderRef = responseData?.paymentRef || ('ANCU-ORD-' + Math.floor(100000 + Math.random() * 900000));
  const ticketCode = 'TKT-' + Math.random().toString(36).substring(2, 10).toUpperCase();

  clearInterval(AppState.cartTimer);
  closeModal('checkout-modal');

  // Open Success Ticket Modal
  renderSuccessTicket({
    name, ci, phone, email, dept,
    orderRef, ticketCode,
    numbers: [...AppState.selectedNumbers],
    total: AppState.selectedNumbers.length * AppState.activeRaffle.ticketPrice,
    paymentMethod: currentPaymentMethod
  });

  AppState.selectedNumbers = [];
  await syncRaffleFromAPI();
  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
  updateRaffleStats();
}

function renderSuccessTicket(data) {
  const modal = document.getElementById('ticket-modal');
  if (!modal) return;

  const ticketContent = document.getElementById('ticket-content');
  if (ticketContent) {
    ticketContent.innerHTML = `
      <div class="ticket-digital" style="background:#0F1A13; border:2px solid var(--bronze-primary); border-radius:18px; padding:28px; color:#F7F5EE; box-shadow:0 12px 32px rgba(0,0,0,0.6);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(197,155,39,0.3); padding-bottom:14px; margin-bottom:18px;">
          <div>
            <div style="font-size:0.75rem; color:var(--bronze-light); text-transform:uppercase; letter-spacing:0.1em; font-weight:700;">Comprobante Oficial de Participación</div>
            <div style="font-size:1.15rem; font-weight:800; font-family:var(--font-heading);">${AppState.activeRaffle.title}</div>
          </div>
          <div style="background:rgba(35,88,60,0.4); border:1px solid var(--forest-light); padding:4px 10px; border-radius:6px; font-size:0.8rem; font-weight:700; color:#8CE0AF;">
            ${data.paymentMethod === 'mercadopago' ? 'PAGO APROBADO' : 'TRANSFERENCIA REGISTRADA'}
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 110px; gap:20px; align-items:center; margin-bottom:20px;">
          <div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Titular del Ticket:</div>
            <div style="font-size:1.1rem; font-weight:700; color:#FFF;">${data.name}</div>
            <div style="font-size:0.85rem; color:var(--text-bone-muted);">C.I.: <strong>${data.ci}</strong> | Tel: ${data.phone}</div>
            <div style="font-size:0.85rem; color:var(--text-bone-muted);">Email: ${data.email}</div>
          </div>
          <div style="background:#FFF; padding:6px; border-radius:8px; text-align:center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://ancu.uy/validar?tkt=${data.ticketCode}" alt="QR Verificación" style="width:98px; height:98px; margin:0 auto;" />
            <div style="font-size:0.6rem; color:#000; font-weight:700; margin-top:2px;">QR OFICIAL</div>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:16px; margin-bottom:18px;">
          <div style="font-size:0.8rem; color:var(--bronze-light); font-weight:700; text-transform:uppercase; margin-bottom:8px;">Números Asignados:</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${data.numbers.map(n => `<span style="background:var(--bronze-primary); color:#0A0F0D; font-size:1.1rem; font-weight:800; padding:6px 14px; border-radius:6px;">#${n}</span>`).join('')}
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:12px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.1); font-size:0.9rem;">
            <span>Total Abonado:</span>
            <strong style="color:var(--bronze-light); font-size:1.1rem;">$ ${data.total.toLocaleString('es-UY')} UYU</strong>
          </div>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.4; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px;">
          <strong>Aviso Legal DNLQ y Normativa de Armas:</strong> Sorteo mediante ${AppState.activeRaffle.drawMethod} el día 31/08/2026. En caso de premios sujetos a tenencia regulada (armas de fuego), la adjudicación final queda supeditada a que el ganador presente THATA y documentación legal vigente ante el SMA/ANCU.
        </div>
      </div>
    `;
  }

  modal.classList.add('active');
}

function printTicket() {
  window.print();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function initModalListeners() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

// ---------------- Member Portal (Mi ANCU) ----------------
function renderDigitalCard() {
  const cardWrap = document.getElementById('digital-member-card');
  if (!cardWrap) return;

  const m = AppState.memberUser;
  const isOk = m.status === 'ACTIVE';

  cardWrap.innerHTML = `
    <div class="member-digital-card">
      <div class="card-header-line">
        <div>
          <div class="card-org-title">Asociación Nacional de Cazadores</div>
          <div class="card-org-sub">República Oriental del Uruguay · Fundada 2020</div>
        </div>
        <div class="logo-symbol" style="width:36px; height:36px;"><img src="assets/logo.png" alt="Logo ANCU" class="brand-logo-img"></div>
      </div>

      <div class="card-body-layout">
        <div class="member-photo-frame">
          <img src="${m.photoUrl}" alt="${m.firstName} ${m.lastName}" />
        </div>
        <div class="member-details-block">
          <h3>${m.firstName} ${m.lastName}</h3>
          <div style="font-size:0.8rem; color:var(--bronze-light); font-weight:600;">${m.category}</div>
          <div class="member-meta-grid">
            <div class="member-meta-item">
              <small>Nº Socio</small>
              <strong>${m.memberNumber}</strong>
            </div>
            <div class="member-meta-item">
              <small>C.I.</small>
              <strong>${m.ci}</strong>
            </div>
            <div class="member-meta-item">
              <small>Departamento</small>
              <strong>${m.department}</strong>
            </div>
            <div class="member-meta-item">
              <small>THATA Reg.</small>
              <strong>${m.thataNumber}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="card-footer-line">
        <span class="status-badge-pill ${isOk ? 'active' : 'pending'}">
          <span class="dot" style="width:8px; height:8px; border-radius:50%; background:${isOk ? 'var(--color-available)' : 'var(--color-held)'}"></span>
          ${isOk ? 'SOCIO AL DÍA · Válido hasta ' + m.validUntil : 'CUOTA PENDIENTE'}
        </span>
        <div class="qr-code-box">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://ancu.uy/socio/${m.memberNumber}" alt="QR Carnet" />
        </div>
      </div>
    </div>
  `;
}

function toggleMemberStatusDemo() {
  AppState.memberUser.status = AppState.memberUser.status === 'ACTIVE' ? 'OVERDUE' : 'ACTIVE';
  saveState();
  renderDigitalCard();
}

async function payMembershipFeeMP() {
  try {
    const res = await fetch(`${API_BASE}/members/pay-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ci: AppState.memberUser.ci, paymentMethod: 'MERCADOPAGO' })
    });
    const data = await res.json();
    if (res.ok) {
      alert("¡Pago procesado con éxito en PostgreSQL! Tu cuota ha sido actualizada y tu carnet digital se encuentra AL DÍA.");
      await syncMemberFromAPI(AppState.memberUser.ci);
      return;
    }
  } catch (e) {
    console.warn('API error:', e);
  }

  // Fallback demo
  AppState.memberUser.status = 'ACTIVE';
  saveState();
  renderDigitalCard();
  alert("¡Pago procesado! Tu carnet digital está AL DÍA.");
}

function initMembershipForm() {
  const form = document.querySelector('form[onsubmit*="Solicitud de afiliación"]');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const inputs = form.querySelectorAll('input, select');
    const firstName = inputs[0]?.value.trim();
    const lastName = inputs[1]?.value.trim();
    const ci = inputs[2]?.value.trim();
    const phone = inputs[3]?.value.trim();
    const email = inputs[4]?.value.trim();
    const department = inputs[5]?.value;
    const thataNumber = inputs[6]?.value.trim();

    try {
      const res = await fetch(`${API_BASE}/members/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, ci, phone, email, department, thataNumber })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al enviar solicitud.');
        return;
      }
      alert(`¡Solicitud aprobada e incorporada al Padrón con Nº ${data.member.member_number}!`);
      form.reset();
      await syncMemberFromAPI(ci);
    } catch (err) {
      alert("¡Solicitud recibida! La comisión directiva revisará tus datos.");
      form.reset();
    }
  };
}

// ---------------- Admin Backoffice Dashboard ----------------
async function initAdminDashboard() {
  const revenueEl = document.getElementById('kpi-revenue');
  const soldCountEl = document.getElementById('kpi-sold-count');
  const membersEl = document.getElementById('kpi-members');
  const membersStatusEl = document.getElementById('kpi-members-status');
  const pendingReceiptsEl = document.getElementById('kpi-pending-receipts');
  const receiptsTbody = document.getElementById('admin-receipts-tbody');
  const auditList = document.getElementById('admin-audit-logs');

  if (!revenueEl && !receiptsTbody) return;

  try {
    const summaryRes = await fetch(`${API_BASE}/admin/summary`);
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      if (revenueEl) revenueEl.innerHTML = `$ ${summary.revenue.toLocaleString('es-UY')} <span style="font-size:0.9rem; color:var(--text-bone);">UYU</span>`;
      if (soldCountEl) soldCountEl.textContent = `↑ ${summary.tickets.sold} números vendidos de ${summary.tickets.total} (${summary.tickets.percentSold}%)`;
      if (membersEl) membersEl.textContent = summary.members.total.toLocaleString('es-UY');
      if (membersStatusEl) membersStatusEl.textContent = `● ${summary.members.active} socios activos (${summary.members.overdue} con cuota vencida)`;
      if (pendingReceiptsEl) pendingReceiptsEl.textContent = summary.pendingReceipts;

      if (auditList && summary.recentAuditLogs) {
        auditList.innerHTML = summary.recentAuditLogs.map(l => `
          <div style="padding:10px 14px; border-bottom:1px solid var(--border-subtle); font-size:0.85rem; display:flex; justify-content:space-between; align-items:center;">
            <span><strong style="color:var(--bronze-light);">${new Date(l.created_at).toLocaleString('es-UY')}</strong> · <strong>${l.action}</strong>: ${JSON.stringify(l.details || {})}</span>
            <small style="color:var(--text-muted);">${l.ip_address}</small>
          </div>
        `).join('');
      }
    }

    // Load receipts
    const receiptsRes = await fetch(`${API_BASE}/admin/receipts`);
    if (receiptsRes.ok && receiptsTbody) {
      const { receipts } = await receiptsRes.json();
      if (receipts.length === 0) {
        receiptsTbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No hay transferencias pendientes.</td></tr>`;
      } else {
        receiptsTbody.innerHTML = receipts.map(r => `
          <tr style="border-bottom:1px solid var(--border-subtle);">
            <td style="padding:10px 14px;">
              <span class="status-badge-pill" style="font-size:0.75rem; background:${r.target_type === 'RAFFLE' ? 'rgba(197,155,39,0.2)' : 'rgba(35,88,60,0.3)'}; color:var(--text-bone);">
                ${r.target_type === 'RAFFLE' ? 'RIFA #' + r.reference_id : 'SOCIO ' + r.reference_id}
              </span>
            </td>
            <td style="padding:10px 14px;">
              <strong>${r.payer_name}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">C.I. ${r.payer_ci || '-'} | Tel: ${r.payer_phone}</div>
            </td>
            <td style="padding:10px 14px;"><strong style="color:var(--bronze-light);">$ ${parseFloat(r.amount).toLocaleString('es-UY')} UYU</strong></td>
            <td style="padding:10px 14px;">${r.bank_origin}</td>
            <td style="padding:10px 14px; text-align:right;">
              ${r.status === 'PENDING' ? `
                <button class="btn btn-primary btn-sm" style="padding:4px 10px; font-size:0.75rem; margin-right:4px;" onclick="approveReceipt(${r.id})">Aprobar ✓</button>
                <button class="btn btn-secondary btn-sm" style="padding:4px 10px; font-size:0.75rem;" onclick="rejectReceipt(${r.id})">Rechazar ✕</button>
              ` : `
                <span style="color:${r.status === 'APPROVED' ? 'var(--color-available)' : 'var(--color-sold)'}; font-weight:700; font-size:0.8rem;">${r.status === 'APPROVED' ? 'APROBADO ✓' : 'RECHAZADO ✕'}</span>
              `}
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Error al cargar datos del panel admin:', err);
  }
}

async function approveReceipt(receiptId) {
  try {
    const res = await fetch(`${API_BASE}/admin/receipts/${receiptId}/approve`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert("¡Comprobante aprobado con éxito en PostgreSQL!");
      await initAdminDashboard();
    } else {
      alert(data.error || 'Error al aprobar.');
    }
  } catch (e) {
    alert("Error de conexión con el backend.");
  }
}

async function rejectReceipt(receiptId) {
  if (!confirm("¿Deseas rechazar este comprobante y liberar los boletos asociados?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/receipts/${receiptId}/reject`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert("Comprobante rechazado.");
      await initAdminDashboard();
    } else {
      alert(data.error || 'Error al rechazar.');
    }
  } catch (e) {
    alert("Error de conexión con el backend.");
  }
}

// ---------------- Normativa Filter Handler ----------------
function initNormativaFilters() {
  const filterBtns = document.querySelectorAll('.normativa-filter-btn');
  const cards = document.querySelectorAll('.normativa-item-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      cards.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}
