/**
 * ANCU - ASOCIACIÓN NACIONAL DE CAZADORES DEL URUGUAY
 * Core Client Engine & Interactive State Management
 * Powered by Astro · astroseguridad.lat · info@ancu.uy
 */

// ---------------- State & Storage Initialization ----------------
const APP_STORAGE_KEY = 'ancu_app_state_v2';

const DEFAULT_STATE = {
  activeRaffle: {
    id: "1",
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
  cartTimeRemaining: 900, // 15 minutes (in seconds)
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

// Populate 1000 clean available numbers for the raffle template
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
function bootstrapApp() {
  initMobileNavigation();
  initRaffleGrid();
  initHundredsTabs();
  initRaffleSearch();
  initModalListeners();
  initMemberPortal();
  initNormativaFilters();
  initAdminDashboard();
  updateRaffleStats();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
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

  // Close when clicking any nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      toggleBtn.innerHTML = '&#9776;';
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // Close when clicking outside
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

function initRaffleGrid() {
  const grid = document.getElementById('numbers-grid');
  if (!grid) return;
  renderNumbersGrid(currentHundred);
}

function initHundredsTabs() {
  const tabsWrap = document.getElementById('hundreds-tabs-wrap');
  if (!tabsWrap) return;

  tabsWrap.innerHTML = '';
  for (let h = 0; h < 10; h++) {
    const start = String(h * 100).padStart(3, '0');
    const end = String(h * 100 + 99).padStart(3, '0');
    const btn = document.createElement('button');
    btn.className = `hundred-tab-btn ${h === currentHundred ? 'active' : ''}`;
    btn.textContent = `${start} - ${end}`;
    btn.addEventListener('click', () => {
      currentHundred = h;
      document.querySelectorAll('.hundred-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderNumbersGrid(h);
    });
    tabsWrap.appendChild(btn);
  }
}

function renderNumbersGrid(hundredIndex) {
  const grid = document.getElementById('numbers-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const start = hundredIndex * 100;
  const end = start + 99;

  for (let i = start; i <= end; i++) {
    const numStr = String(i).padStart(3, '0');
    const data = AppState.activeRaffle.numbers[numStr] || { status: 'available' };
    const isSelected = AppState.selectedNumbers.includes(numStr);

    const cell = document.createElement('div');
    cell.className = `num-cell ${data.status} ${isSelected ? 'selected' : ''}`;
    cell.textContent = numStr;
    cell.id = `cell-${numStr}`;

    if (data.status === 'available' || isSelected) {
      cell.addEventListener('click', () => toggleNumberSelection(numStr));
    } else if (data.status === 'held') {
      cell.title = "Número reservado temporalmente en proceso de pago";
    } else if (data.status === 'sold') {
      cell.title = "Número vendido";
    }

    grid.appendChild(cell);
  }
}

function toggleNumberSelection(numStr) {
  const idx = AppState.selectedNumbers.indexOf(numStr);
  if (idx > -1) {
    AppState.selectedNumbers.splice(idx, 1);
  } else {
    // Check limit (e.g., max 10 per transaction)
    if (AppState.selectedNumbers.length >= 10) {
      alert("Puedes seleccionar un máximo de 10 números por compra.");
      return;
    }
    AppState.selectedNumbers.push(numStr);
  }
  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
}

function initRaffleSearch() {
  const searchInput = document.getElementById('raffle-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 0 && !isNaN(query)) {
      const num = parseInt(query, 10);
      if (num >= 0 && num <= 999) {
        const targetHundred = Math.floor(num / 100);
        if (targetHundred !== currentHundred) {
          currentHundred = targetHundred;
          initHundredsTabs();
          renderNumbersGrid(currentHundred);
        }
        const numStr = String(num).padStart(3, '0');
        const targetCell = document.getElementById(`cell-${numStr}`);
        if (targetCell) {
          targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCell.style.outline = '3px solid var(--bronze-light)';
          setTimeout(() => { if (targetCell) targetCell.style.outline = ''; }, 2000);
        }
      }
    }
  });
}

function selectRandomNumbers(count) {
  const available = Object.keys(AppState.activeRaffle.numbers).filter(n => AppState.activeRaffle.numbers[n].status === 'available');
  if (available.length < count) {
    alert("No hay suficientes números disponibles.");
    return;
  }
  
  // Shuffle & pick
  const shuffled = available.sort(() => 0.5 - Math.random());
  const picked = shuffled.slice(0, count);
  AppState.selectedNumbers = picked;
  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
  
  // Jump to first picked number's hundred
  const firstNum = parseInt(picked[0], 10);
  currentHundred = Math.floor(firstNum / 100);
  initHundredsTabs();
  renderNumbersGrid(currentHundred);
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
  const total = AppState.activeRaffle.totalNumbers;
  let sold = 0;
  let held = 0;
  let avail = 0;

  Object.values(AppState.activeRaffle.numbers).forEach(item => {
    if (item.status === 'sold') sold++;
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

function openCheckoutModal() {
  if (AppState.selectedNumbers.length === 0) {
    alert("Por favor selecciona al menos un número.");
    return;
  }

  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  // Set numbers list in modal
  const modalNumbersList = document.getElementById('modal-selected-numbers');
  const modalTotal = document.getElementById('modal-total-price');
  if (modalNumbersList) modalNumbersList.textContent = AppState.selectedNumbers.join(', ');
  if (modalTotal) modalTotal.textContent = `$ ${(AppState.selectedNumbers.length * AppState.activeRaffle.ticketPrice).toLocaleString('es-UY')}`;

  // Start 15-minute reservation timer
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
      alert("El tiempo de reserva de 15 minutos ha expirado. Por favor vuelve a seleccionar tus números.");
      closeModal('checkout-modal');
      AppState.selectedNumbers = [];
      renderNumbersGrid(currentHundred);
      updateCheckoutTray();
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

function submitCheckout(e) {
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

  // Generate unique order reference
  const orderRef = 'ANCU-ORD-' + Math.floor(100000 + Math.random() * 900000);
  const ticketCode = 'TKT-' + Math.random().toString(36).substring(2, 10).toUpperCase();

  // Mark numbers as sold / pending depending on method
  const statusToSet = currentPaymentMethod === 'mercadopago' ? 'sold' : 'held';

  AppState.selectedNumbers.forEach(n => {
    AppState.activeRaffle.numbers[n] = {
      status: statusToSet,
      buyer: name,
      ci: ci,
      phone: phone,
      email: email,
      orderRef: orderRef,
      ticketCode: ticketCode,
      paymentMethod: currentPaymentMethod,
      date: new Date().toISOString()
    };
  });

  // Audit log
  AppState.auditLogs.unshift({
    time: new Date().toLocaleDateString('es-UY') + ' ' + new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
    user: name + ` (CI: ${ci})`,
    action: `Compra de rifa [${AppState.selectedNumbers.join(', ')}] vía ${currentPaymentMethod.toUpperCase()} (Ref: ${orderRef})`
  });

  saveState();
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
function initMemberPortal() {
  const cardWrap = document.getElementById('digital-member-card');
  if (!cardWrap) return;
  renderDigitalCard();
}

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

function payMembershipFeeMP() {
  alert("Iniciando pasarela de Mercado Pago para abono de Cuota Social ANCU ($600 UYU)...");
  setTimeout(() => {
    AppState.memberUser.status = 'ACTIVE';
    AppState.auditLogs.unshift({
      time: new Date().toLocaleDateString('es-UY') + ' ' + new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
      user: AppState.memberUser.firstName + ' ' + AppState.memberUser.lastName,
      action: "Pago de Cuota Social Mensual vía Mercado Pago ($600 UYU) - Recibo #REC-884"
    });
    saveState();
    renderDigitalCard();
    alert("¡Pago procesado con éxito! Tu cuota ha sido actualizada y tu carnet digital se encuentra AL DÍA.");
  }, 1000);
}

// ---------------- Regulations Center (Normativa) ----------------
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

function generateFieldPermitPDF() {
  const landowner = prompt("Ingrese Nombre Completo del Propietario del Campo:", "Carlos Mendiondo");
  if (!landowner) return;
  const padron = prompt("Ingrese Nº de Padrón y Localidad:", "Padrón 4182 - 3ª Sección de Lavalleja");
  const hunter = prompt("Ingrese Nombre del Cazador Habilitado:", AppState.memberUser.firstName + ' ' + AppState.memberUser.lastName);
  const ci = prompt("Ingrese C.I. del Cazador:", AppState.memberUser.ci);

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Formulario Oficial de Autorización de Predio - ANCU</title>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
        .logo { font-size: 18px; font-weight: bold; text-transform: uppercase; }
        .title { font-size: 16px; font-weight: bold; margin-top: 20px; text-decoration: underline; }
        .content { margin: 30px 0; text-align: justify; font-size: 14px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
        .sign-box { width: 45%; text-align: center; border-top: 1px solid #000; padding-top: 8px; font-size: 13px; }
        .footer { font-size: 11px; text-align: center; margin-top: 50px; color: #555; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Asociación Nacional de Cazadores del Uruguay (ANCU)</div>
        <div>Modelo Oficial de Consentimiento Expreso de Propietario de Predio Rural</div>
        <div style="font-size:12px; margin-top:4px;">En cumplimiento de la Ley de Fauna Nº 9.481 y Decreto 164/996</div>
      </div>

      <div class="title" style="text-align:center;">CONSTANCIA Y AUTORIZACIÓN DE INGRESO A PREDIO RURAL</div>

      <div class="content">
        <p>Por la presente, quien suscribe <strong>${landowner}</strong>, en mi carácter de propietario/arrendatario legal del inmueble rural empadronado bajo el <strong>${padron}</strong>, autorizo expresamente el ingreso al mismo con fines de práctica de caza deportiva / control de especies plaga (Jabalí - Dec. 138/020) a:</p>
        
        <p><strong>Sr./Sra.:</strong> ${hunter}<br>
        <strong>Cédula de Identidad:</strong> ${ci}<br>
        <strong>Socio ANCU Nº:</strong> ${AppState.memberUser.memberNumber}</p>

        <p>El autorizado se compromete formalmente a respetar los alambrados, tranqueras, hacienda y personal del establecimiento, portando en todo momento su guía de armas vigente, THATA y constancia de autorización, operando a más de 3 km de escuelas y centros poblados de acuerdo a la normativa vigente.</p>

        <p>Válido para la temporada 2026.</p>
      </div>

      <div class="signatures">
        <div class="sign-box">
          Firma del Propietario / Arrendatario<br>
          C.I.: _______________________<br>
          Aclaración: ${landowner}
        </div>
        <div class="sign-box">
          Firma del Cazador Autorizado<br>
          C.I.: ${ci}<br>
          Aclaración: ${hunter}
        </div>
      </div>

      <div class="footer">
        Documento extendido con el aval de la Asociación Nacional de Cazadores del Uruguay (ANCU) · ancu.uy · info@ancu.uy
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ---------------- Admin Backoffice ----------------
function initAdminDashboard() {
  const auditList = document.getElementById('admin-audit-logs');
  if (auditList) {
    auditList.innerHTML = AppState.auditLogs.map(l => `
      <div style="padding:10px 14px; border-bottom:1px solid var(--border-subtle); font-size:0.85rem; display:flex; justify-content:space-between;">
        <span><strong>${l.time}</strong> · <span style="color:var(--bronze-light);">${l.user}:</span> ${l.action}</span>
      </div>
    `).join('');
  }
}

function exportRaffleParticipantsCSV() {
  const numbers = AppState.activeRaffle.numbers;
  let csv = "Numero,Estado,Comprador,Cedula,Telefono,Email,Referencia,TicketCode\n";

  Object.keys(numbers).forEach(k => {
    const item = numbers[k];
    if (item.status === 'sold' || item.status === 'held') {
      csv += `"${k}","${item.status}","${item.buyer || ''}","${item.ci || ''}","${item.phone || ''}","${item.email || ''}","${item.orderRef || ''}","${item.ticketCode || ''}"\n`;
    }
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `participantes_rifa_ancu_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
