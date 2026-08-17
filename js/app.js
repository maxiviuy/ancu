/**
 * ANCU - Portal Oficial y Plataforma Digital
 * Asociación Nacional de Cazadores del Uruguay
 */

const API_BASE = '/api';

// ---------------- Application State ----------------
const DEFAULT_STATE = {
  activeRaffle: {
    id: 1,
    title: "Gran Rifa de Colaboración ANCU 2026",
    subtitle: "Fondo de Equipamiento y Actividades Institucionales",
    ticketPrice: 400,
    totalNumbers: 1000,
    drawDate: "2026-08-31T20:00:00-03:00",
    drawMethod: "Quiniela Nocturna de la Lotería Nacional",
    prizes: [
      {
        order: 1,
        title: "Visor Térmico Sytong XS03-35LRF con Telémetro Láser",
        description: "Sensor térmico de alta sensibilidad 384x288 px, lente de 35mm F1.0, telémetro láser integrado hasta 1.200 metros, aumento óptico 2.8x y digital hasta 8x, pantalla AMOLED 1024x768, grabación de foto/video, conectividad WiFi y protección IP66.",
        imageUrl: "/uploads/prizes/prize_visor_sytong_xs03.png",
        estimatedValue: 1450,
        regulated: false,
        note: "Entrega directa y garantía oficial en todo el Uruguay."
      },
      {
        order: 2,
        title: "Arco Compuesto Profesional Diamond EDGE",
        description: "Velocidad de salida hasta 310 FPS, peso ultra ligero 3.5 lbs (1.59 kg), distancia entre ejes 31\" (78.7 cm), longitud de ataque 6.25\" - 31\", potencia regulable de 5 a 70 lbs, modos Diamond Draw y Bowtech Draw, acabado Realtree Edge.",
        imageUrl: "/uploads/prizes/prize_arco_diamond_edge.png",
        estimatedValue: 650,
        regulated: false,
        note: "Entrega directa con accesorios completos en todo el país."
      },
      {
        order: 3,
        title: "Cuchillo Criollo Schmieden Acero Inoxidable con Vaina",
        description: "Hoja de acero inoxidable de alta retención de filo y tenacidad, cabo artesanal combinado en maderas nobles y virolas de bronce, incluye vaina tradicional de cuero vacuno repujado con broches y pasacinto reforzado.",
        imageUrl: "/uploads/prizes/prize_cuchillo_schmieden.png",
        estimatedValue: 180,
        regulated: false,
        note: "Entrega directa a domicilio en todo el país."
      }
    ],
    numbers: {}
  },
  selectedNumbers: [],
  cartTimer: null,
  cartTimeRemaining: 900, // 15 mins in seconds
  memberUser: {
    isLoggedIn: false,
    firstName: "Carlos",
    lastName: "Mendiondo",
    ci: "3.842.190-4",
    memberNumber: "ANCU-0012",
    category: "Socio Pleno Activo",
    status: "ACTIVE",
    validUntil: "31/12/2026",
    department: "Lavalleja",
    thataNumber: "UY-88421",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
  },
  adminUser: null,
  adminPrizesDraft: [],
  adminAuthorities: [],
  adminMembers: [],
  adminActivities: [],
  adminBenefits: [],
  adminUsers: [],
  articles: [],
  featuredArticle: null
};

// Cargar o inicializar estado persistente
let AppState = { ...DEFAULT_STATE };
try {
  const saved = localStorage.getItem('ancu_portal_state');
  if (saved) {
    const parsed = JSON.parse(saved);
    AppState = { ...DEFAULT_STATE, ...parsed };
  }
} catch (e) {
  console.warn('Usando estado por defecto:', e);
}

function saveState() {
  try {
    localStorage.setItem('ancu_portal_state', JSON.stringify({
      selectedNumbers: AppState.selectedNumbers,
      memberUser: AppState.memberUser,
      adminUser: AppState.adminUser
    }));
  } catch (e) {}
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
      AppState.activeRaffle.drawDate = data.raffle.drawDate;
      AppState.activeRaffle.drawMethod = data.raffle.drawMethod;
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

      // Update UI elements in rifas.html if present
      const titleEl = document.getElementById('raffle-public-title');
      const subtitleEl = document.getElementById('raffle-public-subtitle');
      const priceEl = document.getElementById('raffle-public-price');
      const tagEl = document.getElementById('raffle-public-tag');
      const totalEl = document.getElementById('stat-total');

      if (titleEl) titleEl.textContent = data.raffle.title;
      if (subtitleEl) {
        const formattedDate = new Date(data.raffle.drawDate).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' });
        subtitleEl.innerHTML = `${data.raffle.subtitle || 'Fondo de equipamiento y actividades institucionales.'} Sortea por la <strong>${data.raffle.drawMethod}</strong> el ${formattedDate}.`;
      }
      if (priceEl) priceEl.innerHTML = `$ ${data.raffle.ticketPrice} <span style="font-size:1rem; color:var(--text-bone);">UYU</span>`;
      if (tagEl) tagEl.textContent = `Rifa Oficial · Sorteo ${new Date(data.raffle.drawDate).getFullYear()}`;
      if (totalEl) totalEl.textContent = data.raffle.totalNumbers.toLocaleString('es-UY');

      // Update KPI stats if present
      if (data.raffle.stats) {
        const availEl = document.getElementById('stat-avail');
        const heldEl = document.getElementById('stat-held');
        const soldEl = document.getElementById('stat-sold');
        if (availEl) availEl.textContent = data.raffle.stats.available.toLocaleString('es-UY');
        if (heldEl) heldEl.textContent = data.raffle.stats.held.toLocaleString('es-UY');
        if (soldEl) soldEl.textContent = data.raffle.stats.sold.toLocaleString('es-UY');

        // Progress bar in index.html
        const totalNum = data.raffle.totalNumbers || 1000;
        const soldCount = data.raffle.stats.sold || 0;
        const heldCount = data.raffle.stats.held || 0;
        const takenPercent = Math.round(((soldCount + heldCount) / totalNum) * 100);
        
        const statPercentEl = document.getElementById('stat-percent');
        const progressBarEl = document.getElementById('raffle-progress-bar');
        if (statPercentEl) statPercentEl.textContent = `${takenPercent}% Asignado (${data.raffle.stats.available} Libres)`;
        if (progressBarEl) progressBarEl.style.width = `${Math.max(takenPercent, 4)}%`;
      }

      renderPublicPrizes();
      renderHomeRafflePrizes();
      saveState();
      console.log('🌲 Rifa y premios sincronizados con PostgreSQL.');
    }
  } catch (err) {
    console.warn('Usando estado local para rifas (Backend offline):', err.message);
    renderPublicPrizes();
    renderHomeRafflePrizes();
  }
}

function renderHomeRafflePrizes() {
  const container = document.getElementById('home-raffle-prizes');
  if (!container) return;

  const prizes = AppState.activeRaffle.prizes;
  if (!Array.isArray(prizes) || prizes.length === 0) return;

  container.innerHTML = prizes.map((p, idx) => {
    const badgeLabel = `${p.order || idx + 1}º PREMIO`;
    const imgUrl = p.imageUrl || 'assets/logo.png';
    const fallbackEmoji = idx === 0 ? '🔭' : (idx === 1 ? '🏹' : '🔪');
    
    return `
      <div class="prize-mini-card">
        <span class="prize-mini-badge">${badgeLabel}</span>
        <div class="prize-mini-img-wrap">
          <img src="${imgUrl}" alt="${p.title}" class="prize-mini-img" onerror="this.src='assets/logo.png';" />
        </div>
        <div class="prize-mini-title" title="${p.title}">${p.title}</div>
        ${p.estimatedValue ? `<div class="prize-mini-val">Ref. USD $${Number(p.estimatedValue).toLocaleString('es-UY')}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderPublicPrizes() {
  const prizesContainer = document.getElementById('prizes-container');
  if (!prizesContainer) return;

  const prizes = AppState.activeRaffle.prizes;
  if (!Array.isArray(prizes) || prizes.length === 0) {
    prizesContainer.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-muted); grid-column: 1 / -1;">No hay premios configurados actualmente.</div>`;
    return;
  }

  prizesContainer.innerHTML = prizes.map((p, idx) => {
    const badgeClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : 'bronze');
    const badgeLabel = `${p.order || idx + 1}º PREMIO`;
    const imgUrl = p.imageUrl || 'assets/logo.png';
    const hasPhoto = Boolean(p.imageUrl);

    const legalTag = p.regulated
      ? `<div class="prize-card-legal warning">⚠️ ${p.note || 'Requiere THATA vigente y registro legal ante SMA/ANCU.'}</div>`
      : `<div class="prize-card-legal ok">✓ ${p.note || 'Entrega directa a domicilio en todo el país.'}</div>`;

    return `
      <div class="prize-card">
        <div class="prize-card-img-wrap">
          <span class="prize-card-badge ${badgeClass}">${badgeLabel}</span>
          <img src="${imgUrl}" alt="${p.title}" class="prize-card-img" style="${hasPhoto ? '' : 'object-fit:contain; padding:24px; background:#0B120E;'}" onerror="this.src='assets/logo.png'; this.style.objectFit='contain'; this.style.padding='24px';" />
        </div>
        <div class="prize-card-body">
          <h3 class="prize-card-title">${p.title}</h3>
          <p class="prize-card-desc">${p.description || ''}</p>
          ${p.estimatedValue ? `<div class="prize-card-meta">Valor comercial ref: USD $${Number(p.estimatedValue).toLocaleString('es-UY')}</div>` : ''}
          ${legalTag}
        </div>
      </div>
    `;
  }).join('');
}

// ---------------- Public News (CMS) ----------------
async function syncNewsFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/news`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.articles)) {
      AppState.articles = data.articles;
      AppState.featuredArticle = data.articles.find(a => a.is_featured) || data.articles[0] || null;
      renderPublicNews();
      syncHomeNews();
    }
  } catch (err) {
    console.warn('Error al sincronizar noticias:', err.message);
  }
}

function renderPublicNews(categoryFilter = 'all') {
  const grid = document.getElementById('public-news-grid');
  const featTitle = document.getElementById('featured-news-title');
  const featExcerpt = document.getElementById('featured-news-excerpt');
  const featTag = document.getElementById('featured-news-tag');
  const featBanner = document.getElementById('featured-news-banner');

  if (featBanner && AppState.featuredArticle) {
    const f = AppState.featuredArticle;
    if (featTitle) featTitle.textContent = f.title;
    if (featExcerpt) featExcerpt.textContent = f.excerpt;
    if (featTag) featTag.textContent = `${f.category.toUpperCase()} · ${new Date(f.publish_date).toLocaleDateString('es-UY', { month: 'short', year: 'numeric' })}`;
  }

  if (!grid) return;

  const filtered = categoryFilter === 'all' 
    ? AppState.articles 
    : AppState.articles.filter(a => a.category === categoryFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted); grid-column:1 / -1;">No hay artículos en esta categoría actualmente.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(a => {
    const dateStr = new Date(a.publish_date).toLocaleDateString('es-UY', { day: '2-digit', month: 'long', year: 'numeric' });
    const imgUrl = a.image_url || 'assets/logo.png';
    const hasPhoto = Boolean(a.image_url);

    return `
      <article class="news-card" id="noticia-${a.id}">
        <div class="news-img-wrap" style="height:190px; background:#0B120E; position:relative; overflow:hidden;">
          <img src="${imgUrl}" alt="${a.title}" style="width:100%; height:100%; object-fit:${hasPhoto ? 'cover' : 'contain'}; padding:${hasPhoto ? '0' : '20px'};" onerror="this.src='assets/logo.png'; this.style.objectFit='contain'; this.style.padding='20px';" />
          <span class="news-tag">${a.category}</span>
        </div>
        <div class="news-body" style="display:flex; flex-direction:column; flex:1; padding:20px;">
          <span class="news-date">${dateStr}</span>
          <h3 class="news-title" style="cursor:pointer;" onclick="openArticleDetail(${a.id})">${a.title}</h3>
          <p class="news-excerpt">${a.excerpt}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:14px; border-top:1px solid var(--border-subtle);">
            <span style="font-size:0.78rem; color:var(--text-muted);">${a.author || 'Secretaría ANCU'}</span>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 10px;" onclick="openArticleDetail(${a.id})">Leer Más &rarr;</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function filterNewsCategory(category, btnEl) {
  document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderPublicNews(category);
}

function openFeaturedArticle() {
  if (AppState.featuredArticle) {
    openArticleDetail(AppState.featuredArticle.id);
  }
}

function openArticleDetail(idOrSlug) {
  const article = AppState.articles.find(a => a.id == idOrSlug || a.slug === idOrSlug);
  if (!article) return;

  const modal = document.getElementById('article-detail-modal');
  const titleEl = document.getElementById('detail-modal-title');
  const catEl = document.getElementById('detail-modal-category');
  const metaEl = document.getElementById('detail-modal-meta');
  const contentEl = document.getElementById('detail-modal-content');
  const imgWrap = document.getElementById('detail-modal-img-wrap');
  const imgEl = document.getElementById('detail-modal-img');

  if (titleEl) titleEl.textContent = article.title;
  if (catEl) catEl.textContent = article.category;
  if (metaEl) {
    const d = new Date(article.publish_date).toLocaleDateString('es-UY', { day: '2-digit', month: 'long', year: 'numeric' });
    metaEl.textContent = `${d} · Autor: ${article.author} · ${article.views_count || 1} lecturas`;
  }
  if (contentEl) contentEl.textContent = article.content;

  if (article.image_url && imgEl && imgWrap) {
    imgEl.src = article.image_url;
    imgWrap.style.display = 'block';
  } else if (imgWrap) {
    imgWrap.style.display = 'none';
  }

  if (modal) modal.classList.add('active');
}

function syncHomeNews() {
  const homeGrid = document.querySelector('.news-grid');
  // If we are on index.html and have a news grid without #public-news-grid
  if (homeGrid && !document.getElementById('public-news-grid') && AppState.articles.length > 0) {
    homeGrid.innerHTML = AppState.articles.slice(0, 3).map(a => {
      const dateStr = new Date(a.publish_date).toLocaleDateString('es-UY', { day: '2-digit', month: 'long', year: 'numeric' });
      const imgUrl = a.image_url || 'assets/logo.png';
      return `
        <article class="news-card">
          <div class="news-img-wrap">
            <img src="${imgUrl}" alt="${a.title}" onerror="this.src='assets/logo.png';" />
            <span class="news-tag">${a.category}</span>
          </div>
          <div class="news-body">
            <span class="news-date">${dateStr}</span>
            <h3 class="news-title"><a href="noticias.html#noticia-${a.id}" style="color:inherit; text-decoration:none;">${a.title}</a></h3>
            <p class="news-excerpt">${a.excerpt}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
              <span style="font-size:0.8rem; color:var(--text-muted);">${a.author}</span>
              <a href="noticias.html" class="btn btn-secondary btn-sm">Leer &rarr;</a>
            </div>
          </div>
        </article>
      `;
    }).join('');
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

// ---------------- Raffle Grid & Hundreds Tabs ----------------
let currentHundred = 0; // 0 to 9

function initRaffleGrid() {
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
    btn.className = `number-cell num-cell ${item.status} ${isSelected ? 'selected' : ''}`;
    btn.setAttribute('data-number', formatted);
    btn.setAttribute('aria-label', `Número ${formatted} - Estado: ${item.status}`);
    
    if (item.status === 'sold' || item.status === 'paid') {
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

function selectRandomNumbers(count) {
  const available = [];
  for (let i = 0; i < AppState.activeRaffle.totalNumbers; i++) {
    const formatted = String(i).padStart(3, '0');
    const item = AppState.activeRaffle.numbers[formatted];
    if (!item || (item.status !== 'sold' && item.status !== 'paid' && item.status !== 'held')) {
      if (!AppState.selectedNumbers.includes(formatted)) {
        available.push(formatted);
      }
    }
  }

  if (available.length === 0) {
    alert("No hay números libres disponibles.");
    return;
  }

  const toPick = Math.min(count, available.length, 20 - AppState.selectedNumbers.length);
  for (let k = 0; k < toPick; k++) {
    const randIdx = Math.floor(Math.random() * available.length);
    const chosen = available.splice(randIdx, 1)[0];
    AppState.selectedNumbers.push(chosen);
  }

  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
}

function searchRaffleNumber() {
  const input = document.getElementById('raffle-search-input');
  if (!input) return;

  const raw = input.value.trim();
  if (raw === '') return;

  const num = parseInt(raw, 10);
  if (isNaN(num) || num < 0 || num > 999) {
    alert("Por favor ingresa un número válido entre 000 y 999.");
    return;
  }

  const formatted = String(num).padStart(3, '0');
  const hundred = Math.floor(num / 100);

  currentHundred = hundred;
  initRaffleGrid();
  renderNumbersGrid(currentHundred);

  setTimeout(() => {
    const targetBtn = document.querySelector(`.number-cell[data-number="${formatted}"]`);
    if (targetBtn) {
      targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetBtn.style.animation = 'pulse 0.6s 3';
    }
  }, 100);
}

function updateCheckoutTray() {
  const tray = document.getElementById('checkout-tray');
  const countBadge = document.getElementById('selected-count');
  const chipsWrap = document.getElementById('selected-chips');
  const totalPrice = document.getElementById('total-price');

  if (!tray) return;

  const total = AppState.selectedNumbers.length * AppState.activeRaffle.ticketPrice;

  if (countBadge) countBadge.textContent = AppState.selectedNumbers.length;
  if (totalPrice) totalPrice.textContent = `$ ${total.toLocaleString('es-UY')}`;

  if (chipsWrap) {
    chipsWrap.innerHTML = AppState.selectedNumbers.map(n => `
      <span class="selected-chip">
        #${n}
        <button type="button" onclick="event.stopPropagation(); toggleNumberSelection('${n}')">&times;</button>
      </span>
    `).join('');
  }

  if (AppState.selectedNumbers.length > 0) {
    tray.classList.add('visible');
  } else {
    tray.classList.remove('visible');
  }
}

// ---------------- Checkout & Mercado Pago Integration ----------------
let currentPaymentMethod = 'mercadopago';

async function openCheckoutModal() {
  if (AppState.selectedNumbers.length === 0) {
    alert("Selecciona al menos un número para continuar.");
    return;
  }

  // Hold tickets in PostgreSQL backend
  try {
    const res = await fetch(`${API_BASE}/raffle/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raffleId: AppState.activeRaffle.id || 1,
        numbers: AppState.selectedNumbers
      })
    });
    if (!res.ok) {
      const errData = await res.json();
      alert(errData.error || 'Algunos números ya no están disponibles.');
      await syncRaffleFromAPI();
      renderNumbersGrid(currentHundred);
      return;
    }
  } catch (err) {
    console.warn('API Hold offline, continuing local demo:', err);
  }

  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  const modalNumbers = document.getElementById('modal-selected-numbers');
  const modalTotal = document.getElementById('modal-total-amount');

  if (modalNumbers) {
    modalNumbers.innerHTML = AppState.selectedNumbers.map(n => `<span class="selected-chip" style="margin:2px;">#${n}</span>`).join(' ');
  }
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

  // Si elige Mercado Pago, intentamos generar preferencia oficial
  if (currentPaymentMethod === 'mercadopago') {
    try {
      const prefRes = await fetch(`${API_BASE}/raffle/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raffleId: AppState.activeRaffle.id || 1,
          numbers: AppState.selectedNumbers,
          buyerName: name,
          buyerPhone: phone,
          buyerEmail: email,
          buyerCi: ci,
          buyerDept: dept
        })
      });
      const prefData = await prefRes.json();

      if (prefData.mode === 'LIVE' && prefData.initPoint) {
        // Redirigir al Checkout Pro oficial de Mercado Pago
        window.location.href = prefData.initPoint;
        return;
      }
    } catch (prefErr) {
      console.warn('Fallback a checkout simulado:', prefErr);
    }
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
    paymentMethod: currentPaymentMethod,
    isPaid: currentPaymentMethod === 'mercadopago'
  });

  AppState.selectedNumbers = [];
  await syncRaffleFromAPI();
  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
}

function renderSuccessTicket(data) {
  const modal = document.getElementById('success-ticket-modal');
  const body = document.getElementById('success-ticket-body');
  if (!modal || !body) return;

  const dateStr = new Date().toLocaleDateString('es-UY');
  const numbersFormatted = data.numbers.map(n => `<span style="display:inline-block; background:var(--bronze-primary); color:#000; font-weight:800; padding:3px 8px; border-radius:4px; margin:2px;">#${n}</span>`).join(' ');

  body.innerHTML = `
    <div class="ticket-certificate" id="printable-ticket">
      <div class="ticket-header">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="font-family:var(--font-heading); font-size:1.1rem; color:var(--text-bone); margin-bottom:2px;">
              Asociación Nacional de Cazadores del Uruguay
            </h3>
            <span style="font-size:0.75rem; color:var(--bronze-light); text-transform:uppercase; letter-spacing:0.05em;">
              Comprobante Oficial de Adquisición de Boletos
            </span>
          </div>
          <div class="logo-symbol" style="width:40px; height:40px;"><img src="assets/logo.png" alt="Logo ANCU" class="brand-logo-img"></div>
        </div>
      </div>

      <div class="ticket-body" style="padding:20px; background:rgba(0,0,0,0.25); border-radius:var(--radius-md); margin:16px 0;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; font-size:0.85rem;">
          <div><strong style="color:var(--text-muted);">Titular:</strong> <span style="color:var(--text-bone);">${data.name}</span></div>
          <div><strong style="color:var(--text-muted);">C.I.:</strong> <span style="color:var(--text-bone);">${data.ci}</span></div>
          <div><strong style="color:var(--text-muted);">Teléfono:</strong> <span style="color:var(--text-bone);">${data.phone}</span></div>
          <div><strong style="color:var(--text-muted);">Departamento:</strong> <span style="color:var(--text-bone);">${data.dept || 'Lavalleja'}</span></div>
          <div><strong style="color:var(--text-muted);">Nº Operación:</strong> <span style="color:var(--bronze-light); font-family:monospace;">${data.orderRef}</span></div>
          <div><strong style="color:var(--text-muted);">Fecha:</strong> <span>${dateStr}</span></div>
        </div>

        <div style="margin-top:16px; padding-top:12px; border-top:1px dashed var(--border-medium);">
          <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:6px;">Números Asignados:</div>
          <div style="font-size:1.1rem;">${numbersFormatted}</div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-subtle);">
          <div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Monto Total:</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--bronze-light);">$ ${data.total.toLocaleString('es-UY')} UYU</div>
          </div>
          <div>
            <span class="status-badge-pill ${data.isPaid ? 'active' : 'pending'}">
              ${data.isPaid ? '● Pago Acreditado (Mercado Pago)' : '⏳ Pendiente de Acreditación (Transferencia)'}
            </span>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
        <div>🔒 Sorteo fiscalizado ante Escribano Público. DNLQ Decreto-Ley 14.841.</div>
        <div style="width:50px; height:50px; background:#fff; padding:2px; border-radius:4px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(data.orderRef)}" alt="QR Verificación" style="width:100%; height:100%;" />
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function printTicket() {
  window.print();
}

async function checkMercadoPagoReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const mpStatus = urlParams.get('mp_status') || urlParams.get('collection_status') || urlParams.get('status');
  const paymentId = urlParams.get('payment_id') || urlParams.get('collection_id');
  const externalRef = urlParams.get('external_reference');

  if (mpStatus === 'approved' || mpStatus === 'success') {
    try {
      const res = await fetch(`${API_BASE}/raffle/payment-status?payment_id=${paymentId || ''}&external_reference=${externalRef || ''}`);
      if (res.ok) {
        const data = await res.json();
        renderSuccessTicket({
          name: data.buyer_name || 'Comprador Registrado',
          ci: data.buyer_ci || 'C.I. Confirmada',
          phone: data.buyer_phone || '',
          email: data.buyer_email || '',
          dept: data.buyer_dept || 'Uruguay',
          orderRef: data.payment_ref || `MP-${paymentId || Date.now()}`,
          ticketCode: `ANCU-${data.numbers && data.numbers.length ? data.numbers.join('-') : 'TKT'}`,
          numbers: data.numbers && data.numbers.length > 0 ? data.numbers : [],
          total: data.totalAmount || (data.numbers?.length ? data.numbers.length * 400 : 400),
          paymentMethod: 'mercadopago',
          isPaid: true
        });
      }
    } catch (e) {
      console.warn('Error checking returned payment:', e);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (mpStatus === 'failure') {
    alert("El pago no fue completado o fue cancelado en Mercado Pago. Tus números continúan disponibles.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
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
async function handleMemberLogin(event) {
  if (event) event.preventDefault();
  const userInputEl = document.getElementById('login-username-input') || document.getElementById('login-identifier-input');
  const passInputEl = document.getElementById('login-password-input');
  if (!userInputEl) return;

  const username = userInputEl.value.trim();
  const password = passInputEl ? passInputEl.value.trim() : '';

  if (!username) {
    alert("Por favor ingrese su Usuario (Nº de Socio) o Cédula de Identidad.");
    return;
  }

  const btn = document.getElementById('btn-login-member');
  if (btn) btn.textContent = 'Verificando credenciales...';

  try {
    const res = await fetch(`${API_BASE}/members/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Credenciales inválidas. Verifique su número de socio y cédula.');
      if (btn) btn.textContent = 'Ingresar al Portal "Mi ANCU" →';
      return;
    }

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
      thataNumber: data.member.thataNumber || 'Habilitado',
      photoUrl: data.member.photoUrl || DEFAULT_STATE.memberUser.photoUrl
    };
    saveState();

    alert(data.message || `¡Bienvenido/a ${data.member.firstName}!`);
    renderDigitalCard();
    updateSessionBar();

    const cardEl = document.getElementById('digital-member-card');
    if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.warn('Error de login API, intentando sincronización:', err);
    await syncMemberFromAPI(username);
  } finally {
    if (btn) btn.textContent = 'Ingresar al Portal "Mi ANCU" →';
  }
}

function quickLoginMember(num, pass) {
  const userInputEl = document.getElementById('login-username-input') || document.getElementById('login-identifier-input');
  const passInputEl = document.getElementById('login-password-input');
  if (userInputEl) userInputEl.value = num;
  if (passInputEl) passInputEl.value = pass;
  handleMemberLogin();
}

function logoutMember() {
  if (confirm("¿Deseas cerrar la sesión activa del socio?")) {
    AppState.memberUser.isLoggedIn = false;
    saveState();
    updateSessionBar();
    const userInputEl = document.getElementById('login-username-input') || document.getElementById('login-identifier-input');
    const passInputEl = document.getElementById('login-password-input');
    if (userInputEl) userInputEl.value = '';
    if (passInputEl) passInputEl.value = '';
    const cardWrap = document.getElementById('digital-member-card');
    if (cardWrap) {
      cardWrap.innerHTML = `
        <div style="background:var(--bg-card); border:2px dashed var(--border-bronze); border-radius:var(--radius-xl); padding:40px; text-align:center; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:12px;">🪪</div>
          <h3 style="color:var(--text-bone); font-size:1.15rem; margin-bottom:6px;">Credencial Digital No Cargada</h3>
          <p style="font-size:0.85rem;">Ingresá tu cédula arriba para consultar tu estado en el padrón oficial de ANCU.</p>
        </div>
      `;
    }
  }
}

function updateSessionBar() {
  const sessionBar = document.getElementById('active-session-bar');
  const userLabel = document.getElementById('session-user-label');
  const descEl = document.getElementById('fee-status-description');

  if (!sessionBar) return;

  const m = AppState.memberUser;
  if (m && m.isLoggedIn) {
    sessionBar.style.display = 'flex';
    if (userLabel) {
      userLabel.innerHTML = `Sesión activa: <strong>${m.firstName} ${m.lastName}</strong> (${m.memberNumber}) · C.I. ${m.ci}`;
    }
    if (descEl) {
      const isOk = m.status === 'ACTIVE';
      descEl.innerHTML = isOk 
        ? `<span style="color:var(--color-available); font-weight:700;">🟢 Tu cuota se encuentra AL DÍA</span> hasta el ${m.validUntil}.`
        : `<span style="color:var(--color-held); font-weight:700;">🟠 Cuota social pendiente de abono.</span> Podés regularizarla ahora con Mercado Pago.`;
    }
  } else {
    sessionBar.style.display = 'none';
  }
}

function printMemberCard() {
  window.print();
}

function renderDigitalCard() {
  const cardWrap = document.getElementById('digital-member-card');
  if (!cardWrap) return;

  const m = AppState.memberUser;
  if (!m || !m.isLoggedIn) {
    cardWrap.innerHTML = `
      <div style="background:var(--bg-card); border:2px dashed var(--border-bronze); border-radius:var(--radius-xl); padding:40px; text-align:center; color:var(--text-muted);">
        <div style="font-size:2.5rem; margin-bottom:12px;">🪪</div>
        <h3 style="color:var(--text-bone); font-size:1.15rem; margin-bottom:6px;">Credencial Digital Bloqueada</h3>
        <p style="font-size:0.85rem;">Ingresá tu cédula arriba para autenticarte y acceder a tu carnet oficial.</p>
      </div>
    `;
    updateSessionBar();
    return;
  }

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
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://ancu.uy/validar-socio?ci=${encodeURIComponent(m.ci)}" alt="QR Carnet" />
        </div>
      </div>
    </div>
  `;
  updateSessionBar();
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
      alert("¡Pago procesado con éxito! Tu cuota ha sido actualizada y tu carnet digital se encuentra AL DÍA.");
      await syncMemberFromAPI(AppState.memberUser.ci);
      return;
    }
  } catch (e) {
    console.warn('API error:', e);
  }

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

// ---------------- Admin Backoffice (Rifas, Noticias CMS & Roles) ----------------
function setAdminCredentials(user, pass) {
  const u = document.getElementById('admin-user-input');
  const p = document.getElementById('admin-pass-input');
  if (u) u.value = user;
  if (p) p.value = pass;
}

async function handleAdminLogin(event) {
  if (event) event.preventDefault();
  const u = document.getElementById('admin-user-input')?.value.trim();
  const p = document.getElementById('admin-pass-input')?.value;

  if (!u || !p) {
    alert("Por favor ingrese usuario y contraseña.");
    return;
  }

  const btn = document.getElementById('btn-admin-submit');
  if (btn) btn.textContent = 'Autenticando...';

  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Credenciales incorrectas.');
      if (btn) btn.textContent = 'Ingresar al Panel de Control →';
      return;
    }

    AppState.adminUser = data.admin;
    saveState();
    checkAdminAuthView();
    await initAdminDashboard();
  } catch (err) {
    console.error('Error in admin login:', err);
    alert('Error al conectar con el servidor.');
  } finally {
    if (btn) btn.textContent = 'Ingresar al Panel de Control →';
  }
}

function handleAdminLogout() {
  AppState.adminUser = null;
  saveState();
  sessionStorage.clear();
  checkAdminAuthView();
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

  const btn = document.getElementById(`tab-btn-${tabName}`);
  const content = document.getElementById(`admin-tab-${tabName}`);

  if (btn) btn.classList.add('active');
  if (content) content.style.display = 'block';

  if (tabName === 'authorities') loadAdminAuthorities();
  if (tabName === 'members') loadAdminMembers();
  if (tabName === 'settings') loadAdminSettings();
  if (tabName === 'activities') loadAdminActivities();
  if (tabName === 'benefits') loadAdminBenefits();
  if (tabName === 'users') loadAdminUsers();
  if (tabName === 'news') loadAdminNews();
}

function checkAdminAuthView() {
  const loginScreen = document.getElementById('admin-login-screen');
  const dashboardView = document.getElementById('admin-dashboard-view');
  const roleBadge = document.getElementById('admin-role-badge');
  const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
  const superadminOnlyTabs = document.querySelectorAll('.superadmin-only-tab');

  if (!loginScreen || !dashboardView) return;

  if (AppState.adminUser) {
    loginScreen.style.display = 'none';
    dashboardView.style.display = 'block';

    const role = AppState.adminUser.role;
    if (roleBadge) {
      const roleLabel = role === 'EDITOR' 
        ? '✍️ Editor de Prensa & Rifas' 
        : (role === 'TREASURY' ? '💰 Tesorería' : (role === 'SUPERADMIN' ? '👑 Super Administrador' : '🛡️ Administrador'));
      roleBadge.textContent = `Sesión: ${AppState.adminUser.fullName} (${AppState.adminUser.username}) · Rol: ${roleLabel}`;
    }

    // Role-based visibility
    if (role === 'EDITOR') {
      adminOnlyTabs.forEach(t => t.style.display = 'none');
      superadminOnlyTabs.forEach(t => t.style.display = 'none');
    } else if (role === 'SUPERADMIN') {
      adminOnlyTabs.forEach(t => t.style.display = 'inline-flex');
      superadminOnlyTabs.forEach(t => t.style.display = 'inline-flex');
    } else {
      adminOnlyTabs.forEach(t => t.style.display = 'inline-flex');
      superadminOnlyTabs.forEach(t => t.style.display = 'none');
    }
  } else {
    loginScreen.style.display = 'flex';
    dashboardView.style.display = 'none';
  }
}

async function initAdminDashboard() {
  const revenueEl = document.getElementById('kpi-revenue');
  const soldCountEl = document.getElementById('kpi-sold-count');
  const membersEl = document.getElementById('kpi-members');
  const membersStatusEl = document.getElementById('kpi-members-status');
  const newsCountEl = document.getElementById('kpi-news-count');
  const drawDateEl = document.getElementById('kpi-draw-date');
  const drawMethodEl = document.getElementById('kpi-draw-method');
  const receiptsTbody = document.getElementById('admin-receipts-tbody');
  const auditList = document.getElementById('admin-audit-logs');

  checkAdminAuthView();
  if (!AppState.adminUser) return;

  try {
    const summaryRes = await fetch(`${API_BASE}/admin/summary`);
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      if (revenueEl) revenueEl.innerHTML = `$ ${summary.revenue.toLocaleString('es-UY')} <span style="font-size:0.9rem; color:var(--text-bone);">UYU</span>`;
      if (soldCountEl) soldCountEl.textContent = `↑ ${summary.tickets.sold} números vendidos de ${summary.tickets.total} (${summary.tickets.percentSold}%)`;
      if (membersEl) membersEl.textContent = summary.members.total.toLocaleString('es-UY');
      if (membersStatusEl) membersStatusEl.textContent = `● ${summary.members.active} socios activos (${summary.members.overdue} con cuota vencida)`;
      if (newsCountEl) newsCountEl.textContent = summary.totalNews || 0;

      if (summary.activeRaffle) {
        const d = new Date(summary.activeRaffle.draw_date);
        if (drawDateEl) drawDateEl.textContent = d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });
        if (drawMethodEl) drawMethodEl.textContent = summary.activeRaffle.draw_method || 'Lotería Nacional';

        // Populate Raffle Form
        const titleInput = document.getElementById('raffle-title-input');
        const subInput = document.getElementById('raffle-subtitle-input');
        const dateInput = document.getElementById('raffle-date-input');
        const priceInput = document.getElementById('raffle-price-input');
        const statusSelect = document.getElementById('raffle-status-select');
        const methodInput = document.getElementById('raffle-method-input');

        if (titleInput) titleInput.value = summary.activeRaffle.title || '';
        if (subInput) subInput.value = summary.activeRaffle.subtitle || '';
        if (dateInput && summary.activeRaffle.draw_date) {
          const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          dateInput.value = localIso;
        }
        if (priceInput) priceInput.value = parseFloat(summary.activeRaffle.ticket_price) || 400;
        if (statusSelect) statusSelect.value = summary.activeRaffle.status || 'ACTIVE';
        if (methodInput) methodInput.value = summary.activeRaffle.draw_method || '';
      }

      if (auditList && summary.recentAuditLogs) {
        auditList.innerHTML = summary.recentAuditLogs.map(l => `
          <div style="padding:10px 14px; border-bottom:1px solid var(--border-subtle); font-size:0.85rem; display:flex; justify-content:space-between; align-items:center;">
            <span><strong style="color:var(--bronze-light);">${new Date(l.created_at).toLocaleString('es-UY')}</strong> · <strong>${l.action}</strong>: ${JSON.stringify(l.details || {})}</span>
            <small style="color:var(--text-muted);">${l.ip_address}</small>
          </div>
        `).join('');
      }
    }

    // Load Raffles list and Prizes
    const rafflesRes = await fetch(`${API_BASE}/admin/raffles`);
    if (rafflesRes.ok) {
      const { raffles } = await rafflesRes.json();
      const listEl = document.getElementById('admin-raffles-list');
      if (listEl && Array.isArray(raffles)) {
        listEl.innerHTML = raffles.map(r => `
          <div style="background:rgba(0,0,0,0.3); border:1px solid ${r.status === 'ACTIVE' ? 'var(--border-bronze)' : 'var(--border-subtle)'}; padding:12px; border-radius:var(--radius-md); font-size:0.85rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:${r.status === 'ACTIVE' ? 'var(--bronze-light)' : 'var(--text-bone)'};">${r.title}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">Sorteo: ${new Date(r.draw_date).toLocaleDateString('es-UY')} · $ ${r.ticket_price} UYU</div>
            </div>
            <div>
              <span class="status-badge-pill ${r.status === 'ACTIVE' ? 'active' : 'pending'}" style="font-size:0.72rem;">${r.status}</span>
            </div>
          </div>
        `).join('');
      }

      const activeRaffle = raffles.find(r => r.status === 'ACTIVE') || raffles[0];
      if (activeRaffle && Array.isArray(activeRaffle.prizes)) {
        AppState.adminPrizesDraft = activeRaffle.prizes.map((p, idx) => ({
          order: p.prize_order || idx + 1,
          title: p.title || '',
          description: p.description || '',
          imageUrl: p.image_url || '',
          estimatedValue: parseFloat(p.estimated_value || 0),
          regulated: p.regulated === true,
          note: p.note || ''
        }));
        renderAdminPrizesEditor();
      }
    }

    // Load News Articles into Admin CMS
    await loadAdminNews();

    // Load Admin Users if SuperAdmin
    await loadAdminUsers();

    // Load Governance, Settings, Activities and Benefits
    await loadAdminAuthorities();
    await loadAdminMembers();
    await loadAdminSettings();
    await loadAdminActivities();
    await loadAdminBenefits();

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

// ---------------- Admin News CMS Functions ----------------
async function loadAdminNews() {
  const tbody = document.getElementById('admin-news-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/news`);
    if (!res.ok) return;
    const { articles } = await res.json();

    if (!Array.isArray(articles) || articles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:24px; text-align:center; color:var(--text-muted);">No hay noticias redactadas todavía.</td></tr>`;
      return;
    }

    tbody.innerHTML = articles.map(a => `
      <tr style="border-bottom:1px solid var(--border-subtle);">
        <td style="padding:12px 16px;">
          <img src="${a.image_url || 'assets/logo.png'}" style="width:50px; height:38px; object-fit:cover; border-radius:4px; border:1px solid var(--border-bronze); background:#000;" onerror="this.src='assets/logo.png';">
        </td>
        <td style="padding:12px 16px;">
          <strong style="color:var(--text-bone); font-size:0.92rem;">${a.title}</strong>
          ${a.is_featured ? '<span style="display:inline-block; background:rgba(197,155,39,0.2); color:var(--bronze-light); font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; margin-left:6px;">⭐ DESTACADA</span>' : ''}
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${a.excerpt.slice(0, 85)}...</div>
        </td>
        <td style="padding:12px 16px;">
          <span style="display:inline-block; font-size:0.75rem; background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:4px; color:var(--bronze-light); font-weight:600;">${a.category}</span>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${a.author}</div>
        </td>
        <td style="padding:12px 16px; font-size:0.8rem;">
          ${new Date(a.publish_date).toLocaleDateString('es-UY')}
        </td>
        <td style="padding:12px 16px;">
          <span class="status-badge-pill ${a.status === 'PUBLISHED' ? 'active' : 'pending'}" style="font-size:0.72rem;">
            ${a.status === 'PUBLISHED' ? 'PUBLICADA' : 'BORRADOR'}
          </span>
        </td>
        <td style="padding:12px 16px; text-align:right;">
          <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; margin-right:4px;" onclick="editArticle(${a.id})">Editar ✏️</button>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; color:#F87171;" onclick="deleteArticle(${a.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading admin news:', err);
  }
}

function openNewArticleModal() {
  document.getElementById('news-modal-id').value = '';
  document.getElementById('news-modal-title').value = '';
  document.getElementById('news-modal-category').value = 'Comunicados';
  document.getElementById('news-modal-author').value = AppState.adminUser?.fullName || 'Comisión Directiva ANCU';
  document.getElementById('news-modal-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('news-modal-image-url').value = '';
  document.getElementById('news-modal-preview-img').src = 'assets/logo.png';
  document.getElementById('news-modal-excerpt').value = '';
  document.getElementById('news-modal-content').value = '';
  document.getElementById('news-modal-featured').checked = false;
  document.getElementById('news-modal-header-title').textContent = '✍️ Redactar Noticia o Comunicado Oficial';

  openModal('news-editor-modal');
}

async function editArticle(articleId) {
  try {
    const res = await fetch(`${API_BASE}/news/${articleId}`);
    if (!res.ok) return;
    const { article } = await res.json();

    document.getElementById('news-modal-id').value = article.id;
    document.getElementById('news-modal-title').value = article.title;
    document.getElementById('news-modal-category').value = article.category;
    document.getElementById('news-modal-author').value = article.author;
    document.getElementById('news-modal-date').value = new Date(article.publish_date).toISOString().slice(0, 10);
    document.getElementById('news-modal-image-url').value = article.image_url || '';
    document.getElementById('news-modal-preview-img').src = article.image_url || 'assets/logo.png';
    document.getElementById('news-modal-excerpt').value = article.excerpt;
    document.getElementById('news-modal-content').value = article.content;
    document.getElementById('news-modal-featured').checked = article.is_featured === true;
    document.getElementById('news-modal-header-title').textContent = '✏️ Editar Noticia o Comunicado';

    openModal('news-editor-modal');
  } catch (err) {
    alert('Error al cargar datos del artículo para editar.');
  }
}

async function handleNewsImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(`${API_BASE}/admin/upload-news-image`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al subir la imagen.');
      return;
    }

    document.getElementById('news-modal-image-url').value = data.imageUrl;
    document.getElementById('news-modal-preview-img').src = data.imageUrl;
    alert("¡Fotografía de portada subida con éxito!");
  } catch (err) {
    console.error('Error uploading news image:', err);
    alert('Error de conexión al subir la imagen.');
  }
}

async function saveArticleForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('news-modal-id').value;
  const title = document.getElementById('news-modal-title').value.trim();
  const category = document.getElementById('news-modal-category').value;
  const author = document.getElementById('news-modal-author').value.trim();
  const publishDate = document.getElementById('news-modal-date').value;
  const imageUrl = document.getElementById('news-modal-image-url').value.trim();
  const excerpt = document.getElementById('news-modal-excerpt').value.trim();
  const content = document.getElementById('news-modal-content').value.trim();
  const isFeatured = document.getElementById('news-modal-featured').checked;

  if (!title || !excerpt || !content) {
    alert("Complete todos los campos obligatorios.");
    return;
  }

  const payload = {
    title, category, author, publishDate, imageUrl, excerpt, content, isFeatured, status: 'PUBLISHED'
  };

  try {
    const url = id ? `${API_BASE}/admin/news/${id}` : `${API_BASE}/admin/news`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al guardar la noticia.');
      return;
    }

    alert(id ? "¡Artículo actualizado con éxito!" : "🎉 ¡Noticia publicada con éxito en el portal!");
    closeModal('news-editor-modal');
    await loadAdminNews();
    await syncNewsFromAPI();
  } catch (err) {
    console.error('Error saving news:', err);
    alert('Error al conectar con el servidor.');
  }
}

async function deleteArticle(articleId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este artículo del portal?")) return;

  try {
    const res = await fetch(`${API_BASE}/admin/news/${articleId}`, { method: 'DELETE' });
    if (res.ok) {
      alert("Artículo eliminado.");
      await loadAdminNews();
      await syncNewsFromAPI();
    } else {
      alert("Error al eliminar el artículo.");
    }
  } catch (err) {
    alert("Error de conexión con el backend.");
  }
}

// ---------------- Admin User Management Functions ----------------
async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users`);
    if (!res.ok) return;
    const { users } = await res.json();
    AppState.adminUsers = users || [];

    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">No hay usuarios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isSuper = u.role === 'SUPERADMIN';
      const roleBadge = u.role === 'EDITOR' 
        ? '<span class="status-badge-pill" style="background:rgba(59,130,246,0.2); color:#93C5FD; font-size:0.75rem;">✍️ EDITOR</span>'
        : (u.role === 'TREASURY' 
          ? '<span class="status-badge-pill" style="background:rgba(245,158,11,0.2); color:#FDE68A; font-size:0.75rem;">💰 TESORERÍA</span>' 
          : '<span class="status-badge-pill" style="background:rgba(197,155,39,0.2); color:var(--bronze-light); font-weight:800; font-size:0.75rem;">👑 SUPERADMIN</span>');

      return `
        <tr style="border-bottom:1px solid var(--border-subtle);">
          <td style="padding:12px 16px;">
            <strong style="color:var(--text-bone); font-size:0.92rem;">${u.full_name}</strong>
          </td>
          <td style="padding:12px 16px; font-family:monospace; color:var(--bronze-light);">
            ${u.username}
          </td>
          <td style="padding:12px 16px; font-size:0.82rem; color:var(--text-muted);">
            ${u.email}
          </td>
          <td style="padding:12px 16px;">
            ${roleBadge}
          </td>
          <td style="padding:12px 16px; font-size:0.8rem; color:var(--text-muted);">
            ${new Date(u.created_at).toLocaleDateString('es-UY')}
          </td>
          <td style="padding:12px 16px; text-align:right;">
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; margin-right:4px; cursor:pointer;" onclick="editUser(${u.id})">Editar ✏️</button>
            ${u.id !== 1 ? `<button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; color:#F87171; cursor:pointer;" onclick="deleteUser(${u.id})">🗑️</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading admin users:', err);
  }
}

function openNewUserModal() {
  document.getElementById('user-modal-id').value = '';
  document.getElementById('user-modal-fullname').value = '';
  document.getElementById('user-modal-username').value = '';
  document.getElementById('user-modal-username').disabled = false;
  document.getElementById('user-modal-email').value = '';
  document.getElementById('user-modal-role').value = 'EDITOR';
  document.getElementById('user-modal-password').value = '';
  document.getElementById('user-modal-password').required = true;
  document.getElementById('user-modal-password-label').textContent = 'Contraseña';
  document.getElementById('user-modal-password-hint').textContent = 'Mínimo 6 caracteres.';
  document.getElementById('user-modal-header-title').textContent = '✨ Crear Cuenta de Acceso';

  openModal('user-editor-modal');
}

async function editUser(userId) {
  let u = (AppState.adminUsers || []).find(item => item.id == userId);
  if (!u) {
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      if (res.ok) {
        const data = await res.json();
        AppState.adminUsers = data.users || [];
        u = AppState.adminUsers.find(item => item.id == userId);
      }
    } catch (e) {
      console.error('Error buscando usuario:', e);
    }
  }

  if (!u) {
    alert("No se pudo cargar el usuario #" + userId);
    return;
  }

  const idEl = document.getElementById('user-modal-id');
  const nameEl = document.getElementById('user-modal-fullname');
  const usernameEl = document.getElementById('user-modal-username');
  const emailEl = document.getElementById('user-modal-email');
  const roleEl = document.getElementById('user-modal-role');
  const passEl = document.getElementById('user-modal-password');
  const passLabelEl = document.getElementById('user-modal-password-label');
  const passHintEl = document.getElementById('user-modal-password-hint');
  const headTitleEl = document.getElementById('user-modal-header-title');

  if (idEl) idEl.value = u.id;
  if (nameEl) nameEl.value = u.full_name || '';
  if (usernameEl) {
    usernameEl.value = u.username || '';
    usernameEl.disabled = true; // username immutable
  }
  if (emailEl) emailEl.value = u.email || '';
  if (roleEl) roleEl.value = u.role || 'EDITOR';
  if (passEl) {
    passEl.value = '';
    passEl.required = false;
  }
  if (passLabelEl) passLabelEl.textContent = 'Nueva Contraseña (Opcional)';
  if (passHintEl) passHintEl.textContent = 'Dejar en blanco para mantener la contraseña actual.';
  if (headTitleEl) headTitleEl.textContent = '✏️ Modificar Usuario y Permisos';

  openModal('user-editor-modal');
}

async function saveUserForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('user-modal-id').value;
  const fullName = document.getElementById('user-modal-fullname').value.trim();
  const username = document.getElementById('user-modal-username').value.trim();
  const email = document.getElementById('user-modal-email').value.trim();
  const role = document.getElementById('user-modal-role').value;
  const password = document.getElementById('user-modal-password').value;

  if (!fullName || !email || (!id && (!username || !password))) {
    alert("Por favor complete todos los campos obligatorios.");
    return;
  }

  const payload = { fullName, username, email, role, password };

  try {
    const url = id ? `${API_BASE}/admin/users/${id}` : `${API_BASE}/admin/users`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al guardar el usuario.');
      return;
    }

    alert(data.message || 'Usuario guardado exitosamente.');
    closeModal('user-editor-modal');
    await loadAdminUsers();
  } catch (err) {
    console.error('Error saving user:', err);
    alert('Error al conectar con el servidor.');
  }
}

async function deleteUser(userId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este usuario de acceso?")) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert("Usuario eliminado con éxito.");
      await loadAdminUsers();
    } else {
      alert(data.error || "Error al eliminar usuario.");
    }
  } catch (err) {
    alert("Error de conexión con el backend.");
  }
}

// ---------------- Admin Prize Editor ----------------
function renderAdminPrizesEditor() {
  const container = document.getElementById('prizes-editor-container');
  if (!container) return;

  if (AppState.adminPrizesDraft.length === 0) {
    AppState.adminPrizesDraft = [
      { order: 1, title: '1º Premio Principal', description: '', imageUrl: '', estimatedValue: 0, regulated: true, note: 'Requiere THATA' },
      { order: 2, title: '2º Premio', description: '', imageUrl: '', estimatedValue: 0, regulated: true, note: 'Requiere THATA' },
      { order: 3, title: '3º Premio', description: '', imageUrl: '', estimatedValue: 0, regulated: false, note: 'Entrega directa' }
    ];
  }

  container.innerHTML = AppState.adminPrizesDraft.map((p, idx) => {
    const previewImg = p.imageUrl || 'assets/logo.png';
    return `
      <div class="admin-prize-row" data-index="${idx}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <span style="font-weight:800; color:var(--bronze-light); font-size:0.9rem;">
            🏆 PREMIO Nº ${idx + 1}
          </span>
          ${idx >= 3 ? `<button type="button" class="btn btn-secondary btn-sm" style="color:#F87171;" onclick="removePrizeRow(${idx})">Eliminar ✕</button>` : ''}
        </div>

        <div style="display:grid; grid-template-columns: 140px 1fr; gap:18px;">
          <div>
            <img src="${previewImg}" id="prize-img-preview-${idx}" class="admin-prize-preview-img" alt="Foto Premio" onerror="this.src='assets/logo.png';" />
            <label class="btn btn-secondary btn-sm" style="width:100%; margin-top:8px; font-size:0.75rem; cursor:pointer;">
              📷 Subir Foto
              <input type="file" accept="image/*" style="display:none;" onchange="handlePrizeImageUpload(event, ${idx})">
            </label>
          </div>

          <div>
            <div class="grid-2" style="margin-bottom:10px;">
              <div class="form-group">
                <label class="form-label" style="font-size:0.78rem;">Título del Premio</label>
                <input type="text" class="form-control prize-input-title" value="${p.title}" oninput="AppState.adminPrizesDraft[${idx}].title = this.value" placeholder="Ej: Rifle Deportivo Savage" required>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:0.78rem;">Valor Comercial Estimado (USD)</label>
                <input type="number" class="form-control prize-input-val" value="${p.estimatedValue || 0}" oninput="AppState.adminPrizesDraft[${idx}].estimatedValue = parseFloat(this.value) || 0" placeholder="750">
              </div>
            </div>

            <div class="form-group" style="margin-bottom:10px;">
              <label class="form-label" style="font-size:0.78rem;">Descripción Técnica y Accesorios</label>
              <textarea class="form-control prize-input-desc" rows="2" oninput="AppState.adminPrizesDraft[${idx}].description = this.value" placeholder="Calibre, acabados, miras, accesorios incluidos...">${p.description || ''}</textarea>
            </div>

            <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
              <label style="font-size:0.8rem; color:var(--text-bone); display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" ${p.regulated ? 'checked' : ''} onchange="AppState.adminPrizesDraft[${idx}].regulated = this.checked">
                Requiere THATA vigente (Arma de Fuego)
              </label>

              <div style="flex:1; min-width:200px;">
                <input type="text" class="form-control" style="font-size:0.8rem; padding:6px 10px;" value="${p.note || ''}" oninput="AppState.adminPrizesDraft[${idx}].note = this.value" placeholder="Nota de entrega (ej. Entrega directa en todo el país)">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function handlePrizeImageUpload(event, index) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(`${API_BASE}/admin/upload-prize-image`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al subir la imagen.');
      return;
    }

    AppState.adminPrizesDraft[index].imageUrl = data.imageUrl;
    const preview = document.getElementById(`prize-img-preview-${index}`);
    if (preview) preview.src = data.imageUrl;

    alert(`¡Fotografía subida con éxito para el Premio Nº ${index + 1}!`);
  } catch (err) {
    console.error('Error uploading image:', err);
    alert('Error al conectar con el servidor para subir la imagen.');
  }
}

function addNewPrizeRow() {
  const nextOrder = AppState.adminPrizesDraft.length + 1;
  AppState.adminPrizesDraft.push({
    order: nextOrder,
    title: `Premio Especial Nº ${nextOrder}`,
    description: '',
    imageUrl: '',
    estimatedValue: 100,
    regulated: false,
    note: 'Entrega directa'
  });
  renderAdminPrizesEditor();
}

function removePrizeRow(index) {
  if (confirm(`¿Deseas eliminar el Premio Nº ${index + 1}?`)) {
    AppState.adminPrizesDraft.splice(index, 1);
    renderAdminPrizesEditor();
  }
}

async function saveRaffleConfig(event) {
  if (event) event.preventDefault();

  const title = document.getElementById('raffle-title-input')?.value.trim();
  const subtitle = document.getElementById('raffle-subtitle-input')?.value.trim();
  const dateVal = document.getElementById('raffle-date-input')?.value;
  const priceVal = parseFloat(document.getElementById('raffle-price-input')?.value) || 400;
  const status = document.getElementById('raffle-status-select')?.value || 'ACTIVE';
  const method = document.getElementById('raffle-method-input')?.value.trim() || 'Quiniela Nocturna de la Lotería Nacional';

  if (!title || !dateVal) {
    alert("Por favor complete los campos obligatorios del sorteo.");
    return;
  }

  const btn = document.getElementById('btn-save-raffle');
  if (btn) btn.textContent = 'Guardando en PostgreSQL...';

  try {
    // 1. Guardar Rifa
    const raffleRes = await fetch(`${API_BASE}/admin/raffles/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subtitle,
        drawDate: new Date(dateVal).toISOString(),
        drawMethod: method,
        ticketPrice: priceVal,
        status
      })
    });

    if (!raffleRes.ok) throw new Error('Error al actualizar cabecera de la rifa.');

    // 2. Guardar Premios
    const prizesRes = await fetch(`${API_BASE}/admin/raffles/1/prizes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prizes: AppState.adminPrizesDraft })
    });

    if (!prizesRes.ok) throw new Error('Error al actualizar los premios.');

    alert("🎉 ¡Campaña de Rifa, Premios y Fotografías guardados con éxito en PostgreSQL y publicados en vivo!");
    await initAdminDashboard();
    await syncRaffleFromAPI();
  } catch (err) {
    console.error('Error saving raffle config:', err);
    alert('Error al guardar los cambios: ' + err.message);
  } finally {
    if (btn) btn.textContent = '💾 Guardar y Publicar en Vivo →';
  }
}

function openNewRaffleModal() {
  openModal('new-raffle-modal');
}

async function handleCreateNewRaffle(event) {
  if (event) event.preventDefault();

  const title = document.getElementById('new-raffle-title')?.value.trim();
  const subtitle = document.getElementById('new-raffle-subtitle')?.value.trim();
  const drawDate = document.getElementById('new-raffle-date')?.value;
  const ticketPrice = parseFloat(document.getElementById('new-raffle-price')?.value) || 400;
  const drawMethod = document.getElementById('new-raffle-method')?.value.trim();

  if (!title || !drawDate || !drawMethod) {
    alert("Complete todos los campos del nuevo sorteo.");
    return;
  }

  const btn = document.getElementById('btn-create-raffle-submit');
  if (btn) btn.textContent = 'Creando sorteo...';

  try {
    const res = await fetch(`${API_BASE}/admin/raffles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subtitle,
        drawDate: new Date(drawDate).toISOString(),
        drawMethod,
        ticketPrice,
        totalNumbers: 1000,
        status: 'ACTIVE'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al crear la nueva rifa.');
      return;
    }

    alert(`🎉 ${data.message}`);
    closeModal('new-raffle-modal');
    await initAdminDashboard();
    await syncRaffleFromAPI();
  } catch (err) {
    console.error('Error creating raffle:', err);
    alert('Error al conectar con el servidor.');
  } finally {
    if (btn) btn.textContent = 'Crear y Generar 1.000 Números →';
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

// ====================================================
// PADRÓN DE SOCIOS (ADMIN BACKOFFICE)
// ====================================================

let adminMemberPhotoFile = null;
let memberSearchTimer = null;

function debounceMemberSearch() {
  clearTimeout(memberSearchTimer);
  memberSearchTimer = setTimeout(() => {
    loadAdminMembers();
  }, 300);
}

async function loadAdminMembers() {
  const tbody = document.getElementById('admin-members-tbody');
  if (!tbody) return;

  const q = document.getElementById('admin-member-search-input')?.value.trim() || '';
  const statusFilter = document.getElementById('admin-member-status-filter')?.value || 'ALL';

  try {
    const url = new URL(`${API_BASE}/admin/members`, window.location.origin);
    if (q) url.searchParams.set('q', q);
    if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter);

    const res = await fetch(url);
    if (!res.ok) return;
    const { members } = await res.json();
    AppState.adminMembers = members || [];

    if (AppState.adminMembers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:28px; text-align:center; color:var(--text-muted);">No se encontraron socios registrados con los criterios seleccionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = AppState.adminMembers.map(m => {
      const isOverdue = m.effectiveStatus === 'OVERDUE' || (new Date(m.valid_until) < new Date());
      const statusPill = isOverdue
        ? `<span class="status-badge-pill" style="background:rgba(239,68,68,0.2); color:#FCA5A5; font-size:0.75rem;">🔴 VENCIDA</span>`
        : (m.status === 'ACTIVE' 
            ? `<span class="status-badge-pill" style="background:rgba(16,185,129,0.2); color:#6EE7B7; font-size:0.75rem;">🟢 ACTIVO</span>` 
            : `<span class="status-badge-pill" style="background:rgba(245,158,11,0.2); color:#FCD34D; font-size:0.75rem;">🟡 ${m.status}</span>`);

      const validStr = m.valid_until ? new Date(m.valid_until).toLocaleDateString('es-UY') : '-';

      return `
        <tr style="border-bottom:1px solid var(--border-subtle);">
          <td style="padding:12px 16px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:38px; height:38px; border-radius:50%; overflow:hidden; border:1.5px solid var(--border-bronze); background:#000; flex-shrink:0;">
                <img src="${m.photo_url || 'assets/logo.png'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='assets/logo.png';" alt="${m.first_name}" />
              </div>
              <div>
                <strong style="color:var(--text-bone); font-size:0.92rem;">${m.first_name} ${m.last_name}</strong>
              </div>
            </div>
          </td>
          <td style="padding:12px 16px;"><strong style="color:var(--bronze-light); font-family:monospace;">${m.member_number || 'S/N'}</strong></td>
          <td style="padding:12px 16px; font-family:monospace; color:var(--text-bone);">${m.ci}</td>
          <td style="padding:12px 16px;">
            <div style="font-size:0.82rem; color:var(--text-bone);">${m.phone}</div>
            <small style="color:var(--text-muted); font-size:0.75rem;">${m.email}</small>
          </td>
          <td style="padding:12px 16px;">
            <div>${m.department}</div>
            <small style="color:var(--text-muted); font-size:0.75rem;">THATA: ${m.thata_number || 'No especificado'}</small>
          </td>
          <td style="padding:12px 16px;"><span style="font-size:0.8rem; color:var(--text-bone);">${m.category}</span></td>
          <td style="padding:12px 16px;">
            <div>${statusPill}</div>
            <small style="color:var(--text-muted); font-size:0.72rem; display:block; margin-top:2px;">Hasta: ${validStr}</small>
          </td>
          <td style="padding:12px 16px; text-align:right;">
            <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="editMember(${m.id})">✏️</button>
            <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.75rem; color:#F87171;" onclick="deleteMember(${m.id})">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading admin members:', err);
  }
}

function openNewMemberModal() {
  adminMemberPhotoFile = null;
  document.getElementById('member-modal-id').value = '';
  document.getElementById('member-modal-first-name').value = '';
  document.getElementById('member-modal-last-name').value = '';
  document.getElementById('member-modal-ci').value = '';
  document.getElementById('member-modal-number').value = '';
  document.getElementById('member-modal-phone').value = '';
  document.getElementById('member-modal-email').value = '';
  document.getElementById('member-modal-dept').value = 'Lavalleja';
  document.getElementById('member-modal-thata').value = '';
  document.getElementById('member-modal-category').value = 'Socio Pleno Activo';
  document.getElementById('member-modal-status').value = 'ACTIVE';

  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  document.getElementById('member-modal-valid').value = nextYear.toISOString().slice(0, 10);

  document.getElementById('member-modal-photo-url').value = '';
  document.getElementById('member-modal-preview-img').src = 'assets/logo.png';
  document.getElementById('member-modal-header-title').textContent = '🪪 Alta de Nuevo Socio Oficial';

  openModal('member-editor-modal');
}

async function editMember(id) {
  let m = (AppState.adminMembers || []).find(item => item.id == id);
  if (!m) {
    try {
      const res = await fetch(`${API_BASE}/admin/members`);
      if (res.ok) {
        const data = await res.json();
        AppState.adminMembers = data.members || [];
        m = AppState.adminMembers.find(item => item.id == id);
      }
    } catch (e) {
      console.error('Error fetching member:', e);
    }
  }

  if (!m) {
    alert("No se pudo cargar la información del socio #" + id);
    return;
  }

  adminMemberPhotoFile = null;
  document.getElementById('member-modal-id').value = m.id;
  document.getElementById('member-modal-first-name').value = m.first_name || '';
  document.getElementById('member-modal-last-name').value = m.last_name || '';
  document.getElementById('member-modal-ci').value = m.ci || '';
  document.getElementById('member-modal-number').value = m.member_number || '';
  document.getElementById('member-modal-phone').value = m.phone || '';
  document.getElementById('member-modal-email').value = m.email || '';
  document.getElementById('member-modal-dept').value = m.department || 'Lavalleja';
  document.getElementById('member-modal-thata').value = m.thata_number || '';
  document.getElementById('member-modal-category').value = m.category || 'Socio Pleno Activo';
  document.getElementById('member-modal-status').value = m.status || 'ACTIVE';

  if (m.valid_until) {
    document.getElementById('member-modal-valid').value = new Date(m.valid_until).toISOString().slice(0, 10);
  } else {
    document.getElementById('member-modal-valid').value = '';
  }

  document.getElementById('member-modal-photo-url').value = m.photo_url || '';
  document.getElementById('member-modal-preview-img').src = m.photo_url || 'assets/logo.png';
  document.getElementById('member-modal-header-title').textContent = `✏️ Modificar Socio: ${m.first_name} ${m.last_name} (${m.member_number || ''})`;

  openModal('member-editor-modal');
}

function handleMemberPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  adminMemberPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('member-modal-preview-img').src = e.target.result;
    document.getElementById('member-modal-photo-url').value = '';
  };
  reader.readAsDataURL(file);
}

async function saveMemberForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('member-modal-id').value;
  const firstName = document.getElementById('member-modal-first-name').value.trim();
  const lastName = document.getElementById('member-modal-last-name').value.trim();
  const ci = document.getElementById('member-modal-ci').value.trim();
  const memberNumber = document.getElementById('member-modal-number').value.trim();
  const phone = document.getElementById('member-modal-phone').value.trim();
  const email = document.getElementById('member-modal-email').value.trim();
  const department = document.getElementById('member-modal-dept').value;
  const thataNumber = document.getElementById('member-modal-thata').value.trim();
  const category = document.getElementById('member-modal-category').value;
  const status = document.getElementById('member-modal-status').value;
  const validUntil = document.getElementById('member-modal-valid').value;
  const photoUrl = document.getElementById('member-modal-photo-url').value.trim();

  if (!firstName || !lastName || !ci || !phone || !email) {
    alert("Por favor complete los campos obligatorios (*).");
    return;
  }

  const formData = new FormData();
  formData.append('firstName', firstName);
  formData.append('lastName', lastName);
  formData.append('ci', ci);
  if (memberNumber) formData.append('memberNumber', memberNumber);
  formData.append('phone', phone);
  formData.append('email', email);
  formData.append('department', department);
  formData.append('thataNumber', thataNumber);
  formData.append('category', category);
  formData.append('status', status);
  if (validUntil) formData.append('validUntil', validUntil);
  if (photoUrl) formData.append('photoUrl', photoUrl);
  if (adminMemberPhotoFile) formData.append('photo', adminMemberPhotoFile);

  const btn = document.getElementById('btn-save-member-submit');
  if (btn) btn.textContent = 'Guardando en Base de Datos...';

  try {
    const url = id ? `${API_BASE}/admin/members/${id}` : `${API_BASE}/admin/members`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, { method, body: formData });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al guardar socio.');
      return;
    }

    alert(data.message || 'Socio guardado exitosamente en PostgreSQL.');
    closeModal('member-editor-modal');
    await loadAdminMembers();
  } catch (err) {
    console.error('Error saving member:', err);
    alert('Error al conectar con el servidor.');
  } finally {
    if (btn) btn.textContent = 'Guardar Socio Oficial →';
  }
}

async function deleteMember(id) {
  if (!confirm("¿Estás seguro de que deseas eliminar este socio del padrón oficial?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/members/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || "Socio eliminado.");
      await loadAdminMembers();
    } else {
      alert(data.error || "Error al eliminar.");
    }
  } catch (err) {
    alert("Error de conexión con el backend.");
  }
}

// ====================================================
// GOBERNANZA & AUTORIDADES (ADMIN & PUBLIC)
// ====================================================

let adminAuthorityPhotoFile = null;

async function loadAdminAuthorities() {
  const container = document.getElementById('admin-authorities-grid');
  const mandateInput = document.getElementById('admin-mandate-period-input');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/admin/authorities`);
    if (!res.ok) return;
    const { authorities } = await res.json();
    AppState.adminAuthorities = authorities || [];

    // Check mandate
    const setRes = await fetch(`${API_BASE}/settings`);
    if (setRes.ok) {
      const { settings } = await setRes.json();
      if (mandateInput && settings.mandate_period) {
        mandateInput.value = settings.mandate_period;
      }
    }

    if (!AppState.adminAuthorities || AppState.adminAuthorities.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">No hay directivos registrados. Haz click en "Agregar Directivo".</div>`;
      return;
    }

    container.innerHTML = AppState.adminAuthorities.map(a => `
      <div class="pillar-card" style="text-align:center; position:relative; background:var(--bg-card); border:1px solid ${a.status === 'ACTIVE' ? 'var(--border-bronze)' : 'var(--border-subtle)'};">
        <div style="position:absolute; top:12px; right:12px; display:flex; gap:6px;">
          <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; cursor:pointer;" onclick="editAuthority(${a.id})">✏️</button>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; color:#F87171; cursor:pointer;" onclick="deleteAuthority(${a.id})">🗑️</button>
        </div>

        <div style="width:84px; height:84px; border-radius:50%; margin:0 auto 14px auto; overflow:hidden; border:2px solid var(--border-bronze); background:#000;">
          <img src="${a.photo_url || 'assets/logo.png'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='assets/logo.png';" alt="${a.name}" />
        </div>

        <span style="font-size:0.75rem; font-weight:700; color:var(--bronze-light); text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:4px;">
          ${a.role_title}
        </span>
        <h4 style="font-size:1.15rem; font-weight:700; color:var(--text-bone); margin-bottom:6px;">
          ${a.name}
        </h4>
        <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin-bottom:10px;">
          ${a.bio || 'Sin descripción ingresada.'}
        </p>
        <div style="font-size:0.72rem; color:var(--text-muted);">
          Mandato: <strong>${a.mandate_period}</strong> · Orden: <strong>#${a.display_order}</strong> · <span style="color:${a.status === 'ACTIVE' ? 'var(--color-available)' : 'var(--text-muted)'};">${a.status === 'ACTIVE' ? 'Activo' : 'Histórico'}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading authorities in admin:', err);
  }
}

function openNewAuthorityModal() {
  adminAuthorityPhotoFile = null;
  document.getElementById('authority-modal-id').value = '';
  document.getElementById('authority-modal-name').value = '';
  document.getElementById('authority-modal-role').value = '';
  document.getElementById('authority-modal-mandate').value = document.getElementById('admin-mandate-period-input')?.value || '2026 – 2028';
  document.getElementById('authority-modal-order').value = '1';
  document.getElementById('authority-modal-status').value = 'ACTIVE';
  document.getElementById('authority-modal-bio').value = '';
  document.getElementById('authority-modal-photo-url').value = '';
  document.getElementById('authority-modal-preview-img').src = 'assets/logo.png';
  document.getElementById('authority-modal-header-title').textContent = '✨ Agregar Miembro de Comisión Directiva';

  openModal('authority-editor-modal');
}

async function editAuthority(id) {
  let a = (AppState.adminAuthorities || []).find(item => item.id == id);
  if (!a) {
    try {
      const res = await fetch(`${API_BASE}/admin/authorities`);
      if (res.ok) {
        const data = await res.json();
        AppState.adminAuthorities = data.authorities || [];
        a = AppState.adminAuthorities.find(item => item.id == id);
      }
    } catch (e) {
      console.error('Error buscando autoridad:', e);
    }
  }

  if (!a) {
    alert("No se pudo cargar la información de la autoridad #" + id);
    return;
  }

  adminAuthorityPhotoFile = null;
  const idEl = document.getElementById('authority-modal-id');
  const nameEl = document.getElementById('authority-modal-name');
  const roleEl = document.getElementById('authority-modal-role');
  const bioEl = document.getElementById('authority-modal-bio');
  const photoUrlEl = document.getElementById('authority-modal-photo-url');
  const previewImgEl = document.getElementById('authority-modal-preview-img');
  const mandateEl = document.getElementById('authority-modal-mandate');
  const orderEl = document.getElementById('authority-modal-order');
  const statusEl = document.getElementById('authority-modal-status');
  const titleEl = document.getElementById('authority-modal-header-title');

  if (idEl) idEl.value = a.id;
  if (nameEl) nameEl.value = a.name || '';
  if (roleEl) roleEl.value = a.role_title || '';
  if (bioEl) bioEl.value = a.bio || '';
  if (photoUrlEl) photoUrlEl.value = a.photo_url || '';
  if (previewImgEl) previewImgEl.src = a.photo_url || 'assets/logo.png';
  if (mandateEl) mandateEl.value = a.mandate_period || '2026 – 2028';
  if (orderEl) orderEl.value = a.display_order || 1;
  if (statusEl) statusEl.value = a.status || 'ACTIVE';
  if (titleEl) titleEl.textContent = '✏️ Modificar Autoridad Institucional';

  openModal('authority-editor-modal');
}

function handleAuthorityPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  adminAuthorityPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('authority-modal-preview-img').src = e.target.result;
    document.getElementById('authority-modal-photo-url').value = '';
  };
  reader.readAsDataURL(file);
}

async function saveAuthorityForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('authority-modal-id').value;
  const name = document.getElementById('authority-modal-name').value.trim();
  const roleTitle = document.getElementById('authority-modal-role').value.trim();
  const bio = document.getElementById('authority-modal-bio').value.trim();
  const mandatePeriod = document.getElementById('authority-modal-mandate').value.trim();
  const displayOrder = document.getElementById('authority-modal-order').value;
  const status = document.getElementById('authority-modal-status').value;
  const photoUrl = document.getElementById('authority-modal-photo-url').value.trim();

  if (!name || !roleTitle) {
    alert("Por favor ingrese el nombre y el cargo de la autoridad.");
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('role_title', roleTitle);
  formData.append('bio', bio);
  formData.append('mandate_period', mandatePeriod);
  formData.append('display_order', displayOrder);
  formData.append('status', status);
  if (photoUrl) formData.append('photo_url', photoUrl);
  if (adminAuthorityPhotoFile) formData.append('photo', adminAuthorityPhotoFile);

  const btn = document.getElementById('btn-save-authority-submit');
  if (btn) btn.textContent = 'Guardando...';

  try {
    const url = id ? `${API_BASE}/admin/authorities/${id}` : `${API_BASE}/admin/authorities`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, { method, body: formData });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al guardar autoridad.');
      return;
    }

    alert(data.message || 'Autoridad guardada exitosamente.');
    closeModal('authority-editor-modal');
    await loadAdminAuthorities();
  } catch (err) {
    console.error('Error saving authority:', err);
    alert('Error al conectar con el servidor.');
  } finally {
    if (btn) btn.textContent = 'Guardar Autoridad →';
  }
}

async function deleteAuthority(id) {
  if (!confirm("¿Deseas eliminar este directivo de la nómina oficial?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/authorities/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert("Autoridad eliminada con éxito.");
      await loadAdminAuthorities();
    } else {
      alert(data.error || "Error al eliminar.");
    }
  } catch (err) {
    alert("Error de conexión con el backend.");
  }
}

async function saveMandatePeriod() {
  const period = document.getElementById('admin-mandate-period-input')?.value.trim();
  if (!period) return;
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: [{ setting_key: 'mandate_period', setting_value: period }] })
    });
    if (res.ok) {
      alert("Período de mandato actualizado exitosamente.");
      await loadAdminAuthorities();
    } else {
      alert("Error al actualizar el período.");
    }
  } catch (err) {
    alert("Error al conectar con el servidor.");
  }
}

function openStatuteModal() {
  openModal('statute-upload-modal');
}

async function handleStatuteUploadSubmit(event) {
  if (event) event.preventDefault();
  const fileInput = document.getElementById('statute-file-input');
  if (!fileInput || !fileInput.files[0]) {
    alert("Seleccione un archivo PDF.");
    return;
  }

  const formData = new FormData();
  formData.append('document', fileInput.files[0]);

  const btn = document.getElementById('btn-upload-statute-submit');
  if (btn) btn.textContent = 'Subiendo documento...';

  try {
    const res = await fetch(`${API_BASE}/admin/settings/upload-statute`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ ${data.message}`);
      closeModal('statute-upload-modal');
      fileInput.value = '';
    } else {
      alert(data.error || 'Error al subir el estatuto.');
    }
  } catch (err) {
    console.error('Error uploading statute:', err);
    alert('Error de conexión con el backend.');
  } finally {
    if (btn) btn.textContent = 'Subir y Actualizar Documento →';
  }
}

// ====================================================
// CONFIGURACIÓN INSTITUCIONAL GLOBAL (ADMIN & PUBLIC)
// ====================================================

async function loadAdminSettings() {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`);
    if (!res.ok) return;
    const { settings } = await res.json();

    const map = {};
    settings.forEach(s => map[s.setting_key] = s.setting_value);

    const topAnn = document.getElementById('setting-top-announcement');
    const fee = document.getElementById('setting-membership-fee');
    const statSum = document.getElementById('setting-statute-summary');
    const brou = document.getElementById('setting-brou-account');
    const prex = document.getElementById('setting-prex-account');
    const email = document.getElementById('setting-contact-email');
    const phone = document.getElementById('setting-contact-phone');

    if (topAnn && map.top_announcement_text) topAnn.value = map.top_announcement_text;
    if (fee && map.membership_fee_amount) fee.value = map.membership_fee_amount;
    if (statSum && map.statute_summary) statSum.value = map.statute_summary;
    if (brou && map.brou_account_info) brou.value = map.brou_account_info;
    if (prex && map.prex_account_info) prex.value = map.prex_account_info;
    if (email && map.contact_email) email.value = map.contact_email;
    if (phone && map.contact_phone) phone.value = map.contact_phone;
  } catch (err) {
    console.error('Error loading admin settings:', err);
  }
}

async function saveInstitutionalSettingsForm(event) {
  if (event) event.preventDefault();

  const topAnnouncement = document.getElementById('setting-top-announcement')?.value.trim();
  const membershipFee = document.getElementById('setting-membership-fee')?.value.trim();
  const statuteSummary = document.getElementById('setting-statute-summary')?.value.trim();
  const brouAccount = document.getElementById('setting-brou-account')?.value.trim();
  const prexAccount = document.getElementById('setting-prex-account')?.value.trim();
  const contactEmail = document.getElementById('setting-contact-email')?.value.trim();
  const contactPhone = document.getElementById('setting-contact-phone')?.value.trim();

  const payload = [
    { setting_key: 'top_announcement_text', setting_value: topAnnouncement },
    { setting_key: 'membership_fee_amount', setting_value: membershipFee },
    { setting_key: 'statute_summary', setting_value: statuteSummary },
    { setting_key: 'brou_account_info', setting_value: brouAccount },
    { setting_key: 'prex_account_info', setting_value: prexAccount },
    { setting_key: 'contact_email', setting_value: contactEmail },
    { setting_key: 'contact_phone', setting_value: contactPhone }
  ];

  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: payload })
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Parámetros institucionales guardados y sincronizados en vivo.");
      await loadAdminSettings();
    } else {
      alert(data.error || 'Error al guardar configuraciones.');
    }
  } catch (err) {
    console.error('Error saving settings:', err);
    alert('Error al conectar con el servidor.');
  }
}

// ====================================================
// ACTIVIDADES & CURSOS (ADMIN & PUBLIC)
// ====================================================

let adminActivityImageFile = null;

async function loadAdminActivities() {
  const tbody = document.getElementById('admin-activities-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/activities`);
    if (!res.ok) return;
    const { activities } = await res.json();
    AppState.adminActivities = activities || [];

    if (!AppState.adminActivities || AppState.adminActivities.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">No hay actividades registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = AppState.adminActivities.map(act => {
      const d = new Date(act.event_date);
      const dateStr = d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });
      const statusBadge = act.registration_status === 'OPEN'
        ? '<span class="status-badge-pill active" style="font-size:0.72rem;">🟢 Abiertas</span>'
        : (act.registration_status === 'FULL'
          ? '<span class="status-badge-pill" style="background:rgba(245,158,11,0.2); color:#FBBF24; font-size:0.72rem;">🟠 Agotado</span>'
          : '<span class="status-badge-pill" style="background:rgba(239,68,68,0.2); color:#F87171; font-size:0.72rem;">🔴 Finalizado</span>');

      return `
        <tr style="border-bottom:1px solid var(--border-subtle);">
          <td style="padding:12px 16px;">
            <strong style="color:var(--text-bone); font-size:0.92rem;">${act.title}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${act.description ? act.description.substring(0, 70) + '...' : ''}</div>
          </td>
          <td style="padding:12px 16px;">
            <span style="font-size:0.8rem; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:var(--radius-sm); color:var(--bronze-light);">${act.category}</span>
          </td>
          <td style="padding:12px 16px; font-size:0.82rem; color:var(--text-bone);">
            <strong>${dateStr}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${act.event_time || ''}</div>
          </td>
          <td style="padding:12px 16px; font-size:0.82rem; color:var(--text-muted);">
            ${act.location}, ${act.department}
          </td>
          <td style="padding:12px 16px; font-size:0.82rem;">
            <strong style="color:var(--color-available);">${parseFloat(act.price_members) === 0 ? 'Gratis' : '$ ' + act.price_members}</strong> / 
            <span style="color:var(--text-muted);">$ ${act.price_general}</span>
          </td>
          <td style="padding:12px 16px;">
            ${statusBadge}
          </td>
          <td style="padding:12px 16px; text-align:right;">
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; margin-right:4px; cursor:pointer;" onclick="editActivity(${act.id})">Editar ✏️</button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; color:#F87171; cursor:pointer;" onclick="deleteActivity(${act.id})">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading activities in admin:', err);
  }
}

function openNewActivityModal() {
  adminActivityImageFile = null;
  document.getElementById('activity-modal-id').value = '';
  document.getElementById('activity-modal-title').value = '';
  document.getElementById('activity-modal-category').value = 'Capacitación';
  document.getElementById('activity-modal-date').value = '';
  document.getElementById('activity-modal-time').value = '09:00 a 16:00 hs';
  document.getElementById('activity-modal-location').value = '';
  document.getElementById('activity-modal-dept').value = 'Lavalleja';
  document.getElementById('activity-modal-price-members').value = '0';
  document.getElementById('activity-modal-price-gen').value = '800';
  document.getElementById('activity-modal-capacity').value = '30';
  document.getElementById('activity-modal-status').value = 'OPEN';
  document.getElementById('activity-modal-desc').value = '';
  document.getElementById('activity-modal-image-url').value = '';
  document.getElementById('activity-modal-preview-img').src = 'assets/hero_uruguay_monte.jpg';
  document.getElementById('activity-modal-header-title').textContent = '✨ Nueva Actividad o Capacitación';

  openModal('activity-editor-modal');
}

async function editActivity(id) {
  let act = (AppState.adminActivities || []).find(item => item.id == id);
  if (!act) {
    try {
      const res = await fetch(`${API_BASE}/admin/activities`);
      if (res.ok) {
        const data = await res.json();
        AppState.adminActivities = data.activities || [];
        act = AppState.adminActivities.find(item => item.id == id);
      }
    } catch (e) {
      console.error('Error buscando actividad:', e);
    }
  }

  if (!act) {
    alert("No se pudo cargar la actividad #" + id);
    return;
  }

  adminActivityImageFile = null;
  const idEl = document.getElementById('activity-modal-id');
  const titleEl = document.getElementById('activity-modal-title');
  const catEl = document.getElementById('activity-modal-category');
  const dateEl = document.getElementById('activity-modal-date');
  const timeEl = document.getElementById('activity-modal-time');
  const locEl = document.getElementById('activity-modal-location');
  const deptEl = document.getElementById('activity-modal-dept');
  const pMemEl = document.getElementById('activity-modal-price-members');
  const pGenEl = document.getElementById('activity-modal-price-gen');
  const capEl = document.getElementById('activity-modal-capacity');
  const statusEl = document.getElementById('activity-modal-status');
  const descEl = document.getElementById('activity-modal-desc');
  const imgUrlEl = document.getElementById('activity-modal-image-url');
  const previewImgEl = document.getElementById('activity-modal-preview-img');
  const headTitleEl = document.getElementById('activity-modal-header-title');

  if (idEl) idEl.value = act.id;
  if (titleEl) titleEl.value = act.title || '';
  if (catEl) catEl.value = act.category || 'Capacitación';
  if (dateEl) dateEl.value = act.event_date ? act.event_date.substring(0, 10) : '';
  if (timeEl) timeEl.value = act.event_time || '';
  if (locEl) locEl.value = act.location || '';
  if (deptEl) deptEl.value = act.department || 'Lavalleja';
  if (pMemEl) pMemEl.value = act.price_members || 0;
  if (pGenEl) pGenEl.value = act.price_general || 0;
  if (capEl) capEl.value = act.capacity || 30;
  if (statusEl) statusEl.value = act.registration_status || 'OPEN';
  if (descEl) descEl.value = act.description || '';
  if (imgUrlEl) imgUrlEl.value = act.image_url || '';
  if (previewImgEl) previewImgEl.src = act.image_url || 'assets/hero_uruguay_monte.jpg';
  if (headTitleEl) headTitleEl.textContent = '✏️ Modificar Actividad';

  openModal('activity-editor-modal');
}

function handleActivityImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  adminActivityImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('activity-modal-preview-img').src = e.target.result;
    document.getElementById('activity-modal-image-url').value = '';
  };
  reader.readAsDataURL(file);
}

async function saveActivityForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('activity-modal-id').value;
  const title = document.getElementById('activity-modal-title').value.trim();
  const category = document.getElementById('activity-modal-category').value;
  const eventDate = document.getElementById('activity-modal-date').value;
  const eventTime = document.getElementById('activity-modal-time').value.trim();
  const location = document.getElementById('activity-modal-location').value.trim();
  const department = document.getElementById('activity-modal-dept').value;
  const priceMembers = document.getElementById('activity-modal-price-members').value;
  const priceGeneral = document.getElementById('activity-modal-price-gen').value;
  const capacity = document.getElementById('activity-modal-capacity').value;
  const registrationStatus = document.getElementById('activity-modal-status').value;
  const description = document.getElementById('activity-modal-desc').value.trim();
  const imageUrl = document.getElementById('activity-modal-image-url').value.trim();

  if (!title || !eventDate || !location) {
    alert("Por favor complete los campos requeridos.");
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('category', category);
  formData.append('event_date', eventDate);
  formData.append('event_time', eventTime);
  formData.append('location', location);
  formData.append('department', department);
  formData.append('price_members', priceMembers);
  formData.append('price_general', priceGeneral);
  formData.append('capacity', capacity);
  formData.append('registration_status', registrationStatus);
  formData.append('description', description);
  if (imageUrl) formData.append('image_url', imageUrl);
  if (adminActivityImageFile) formData.append('image', adminActivityImageFile);

  const btn = document.getElementById('btn-save-activity-submit');
  if (btn) btn.textContent = 'Guardando...';

  try {
    const url = id ? `${API_BASE}/admin/activities/${id}` : `${API_BASE}/admin/activities`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al guardar la actividad.');
      return;
    }

    alert(data.message || 'Actividad guardada con éxito.');
    closeModal('activity-editor-modal');
    await loadAdminActivities();
  } catch (err) {
    console.error('Error saving activity:', err);
    alert('Error al conectar con el servidor.');
  } finally {
    if (btn) btn.textContent = 'Guardar Actividad →';
  }
}

async function deleteActivity(id) {
  if (!confirm("¿Deseas eliminar esta actividad del calendario?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/activities/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert("Actividad eliminada con éxito.");
      await loadAdminActivities();
    } else {
      alert(data.error || "Error al eliminar actividad.");
    }
  } catch (err) {
    alert("Error de conexión con el backend.");
  }
}

// ====================================================
// CONVENIOS Y BENEFICIOS (ADMIN & PUBLIC)
// ====================================================

let adminBenefitLogoFile = null;

async function loadAdminBenefits() {
  const container = document.getElementById('admin-benefits-grid');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/admin/benefits`);
    if (!res.ok) return;
    const { benefits } = await res.json();
    AppState.adminBenefits = benefits || [];

    if (!AppState.adminBenefits || AppState.adminBenefits.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">No hay convenios comerciales cargados.</div>`;
      return;
    }

    container.innerHTML = AppState.adminBenefits.map(b => `
      <div class="pillar-card" style="background:var(--bg-card); border:1px solid var(--border-medium); position:relative;">
        <div style="position:absolute; top:12px; right:12px; display:flex; gap:6px;">
          <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; cursor:pointer;" onclick="editBenefit(${b.id})">✏️</button>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; color:#F87171; cursor:pointer;" onclick="deleteBenefit(${b.id})">🗑️</button>
        </div>

        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:50px; height:50px; border-radius:var(--radius-sm); border:1px solid var(--border-bronze); background:#0A0F0D; display:flex; align-items:center; justify-content:center; padding:4px; overflow:hidden;">
            <img src="${b.logo_url || 'assets/logo.png'}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="${b.partner_name}" onerror="this.src='assets/logo.png';" />
          </div>
          <div>
            <span style="font-size:0.75rem; color:var(--bronze-light); font-weight:700; text-transform:uppercase;">${b.category}</span>
            <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-bone);">${b.partner_name}</h4>
          </div>
        </div>

        <div style="background:rgba(35,88,60,0.25); border:1px solid rgba(52,126,87,0.4); padding:10px; border-radius:var(--radius-sm); margin-bottom:10px; font-size:0.85rem; color:#A7F3D0; font-weight:600;">
          🎁 ${b.discount_text}
        </div>

        <div style="font-size:0.78rem; color:var(--text-muted);">
          📍 ${b.address ? b.address + ' (' + b.department + ')' : b.department}
          ${b.website_url ? `<br>🌐 <a href="${b.website_url}" target="_blank" style="color:var(--bronze-light); text-decoration:underline;">Ver web</a>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading admin benefits:', err);
  }
}

function openNewBenefitModal() {
  adminBenefitLogoFile = null;
  document.getElementById('benefit-modal-id').value = '';
  document.getElementById('benefit-modal-name').value = '';
  document.getElementById('benefit-modal-discount').value = '';
  document.getElementById('benefit-modal-category').value = 'Armerías';
  document.getElementById('benefit-modal-dept').value = 'Montevideo';
  document.getElementById('benefit-modal-address').value = '';
  document.getElementById('benefit-modal-web').value = '';
  document.getElementById('benefit-modal-logo-url').value = '';
  document.getElementById('benefit-modal-preview-img').src = 'assets/logo.png';
  document.getElementById('benefit-modal-header-title').textContent = '✨ Nuevo Convenio Comercial';

  openModal('benefit-editor-modal');
}

async function editBenefit(id) {
  let b = (AppState.adminBenefits || []).find(item => item.id == id);
  if (!b) {
    try {
      const res = await fetch(`${API_BASE}/admin/benefits`);
      if (res.ok) {
        const data = await res.json();
        AppState.adminBenefits = data.benefits || [];
        b = AppState.adminBenefits.find(item => item.id == id);
      }
    } catch (e) {
      console.error('Error buscando convenio:', e);
    }
  }

  if (!b) {
    alert("No se pudo cargar el convenio #" + id);
    return;
  }

  adminBenefitLogoFile = null;
  const idEl = document.getElementById('benefit-modal-id');
  const nameEl = document.getElementById('benefit-modal-name');
  const discEl = document.getElementById('benefit-modal-discount');
  const catEl = document.getElementById('benefit-modal-category');
  const deptEl = document.getElementById('benefit-modal-dept');
  const addrEl = document.getElementById('benefit-modal-address');
  const webEl = document.getElementById('benefit-modal-web');
  const logoEl = document.getElementById('benefit-modal-logo-url');
  const previewImgEl = document.getElementById('benefit-modal-preview-img');
  const headTitleEl = document.getElementById('benefit-modal-header-title');

  if (idEl) idEl.value = b.id;
  if (nameEl) nameEl.value = b.partner_name || '';
  if (discEl) discEl.value = b.discount_text || '';
  if (catEl) catEl.value = b.category || 'Armerías';
  if (deptEl) deptEl.value = b.department || 'Montevideo';
  if (addrEl) addrEl.value = b.address || '';
  if (webEl) webEl.value = b.website_url || '';
  if (logoEl) logoEl.value = b.logo_url || '';
  if (previewImgEl) previewImgEl.src = b.logo_url || 'assets/logo.png';
  if (headTitleEl) headTitleEl.textContent = '✏️ Modificar Convenio';

  openModal('benefit-editor-modal');
}

function handleBenefitLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  adminBenefitLogoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('benefit-modal-preview-img').src = e.target.result;
    document.getElementById('benefit-modal-logo-url').value = '';
  };
  reader.readAsDataURL(file);
}

async function saveBenefitForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('benefit-modal-id').value;
  const partnerName = document.getElementById('benefit-modal-name').value.trim();
  const discountText = document.getElementById('benefit-modal-discount').value.trim();
  const category = document.getElementById('benefit-modal-category').value;
  const department = document.getElementById('benefit-modal-dept').value;
  const address = document.getElementById('benefit-modal-address').value.trim();
  const websiteUrl = document.getElementById('benefit-modal-web').value.trim();
  const logoUrl = document.getElementById('benefit-modal-logo-url').value.trim();

  if (!partnerName || !discountText) {
    alert("Por favor ingrese el nombre del comercio y el beneficio otorgado.");
    return;
  }

  const formData = new FormData();
  formData.append('partner_name', partnerName);
  formData.append('discount_text', discountText);
  formData.append('category', category);
  formData.append('department', department);
  formData.append('address', address);
  formData.append('website_url', websiteUrl);
  if (logoUrl) formData.append('logo_url', logoUrl);
  if (adminBenefitLogoFile) formData.append('logo', adminBenefitLogoFile);

  const btn = document.getElementById('btn-save-benefit-submit');
  if (btn) btn.textContent = 'Guardando...';

  try {
    const url = id ? `${API_BASE}/admin/benefits/${id}` : `${API_BASE}/admin/benefits`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al guardar el convenio.');
      return;
    }

    alert(data.message || 'Convenio guardado con éxito.');
    closeModal('benefit-editor-modal');
    await loadAdminBenefits();
  } catch (err) {
    console.error('Error saving benefit:', err);
    alert('Error al conectar con el servidor.');
  } finally {
    if (btn) btn.textContent = 'Guardar Convenio →';
  }
}

async function deleteBenefit(id) {
  if (!confirm("¿Deseas eliminar este convenio comercial?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/benefits/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert("Convenio eliminado con éxito.");
      await loadAdminBenefits();
    } else {
      alert(data.error || "Error al eliminar convenio.");
    }
  } catch (err) {
    alert("Error de conexión con el backend.");
  }
}

// ====================================================
// PUBLIC FRONTEND HYDRATION LOADERS
// ====================================================

async function loadPublicSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return;
    const { settings } = await res.json();

    // 1. Top Bar Announcement
    if (settings.top_announcement_text) {
      document.querySelectorAll('.top-bar-badge').forEach(badge => {
        badge.innerHTML = `<span class="dot"></span> ${settings.top_announcement_text}`;
      });
    }

    // 2. Contact Phone & Email
    if (settings.contact_email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
        if (!link.classList.contains('no-auto-sync')) {
          link.href = `mailto:${settings.contact_email}`;
          link.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> ${settings.contact_email}`;
        }
      });
    }

    if (settings.contact_phone) {
      const cleanPhone = settings.contact_phone.replace(/\D/g, '');
      const intlPhone = cleanPhone.startsWith('598') ? cleanPhone : (cleanPhone.startsWith('0') ? '598' + cleanPhone.substring(1) : '598' + cleanPhone);
      let displayPhone = settings.contact_phone;
      if (!displayPhone.startsWith('+598') && cleanPhone.length === 9 && cleanPhone.startsWith('09')) {
        displayPhone = `+598 ${cleanPhone.substring(1, 3)} ${cleanPhone.substring(3, 6)} ${cleanPhone.substring(6)}`;
      }

      document.querySelectorAll('a[href*="wa.me"], .contact-whatsapp-link').forEach(link => {
        link.href = `https://wa.me/${intlPhone}`;
        if (!link.classList.contains('no-auto-sync')) {
          link.textContent = displayPhone;
        }
      });

      document.querySelectorAll('.contact-phone-display').forEach(el => {
        el.textContent = displayPhone;
      });
    }

    // 3. Membership Fee Sync
    if (settings.membership_fee_amount) {
      document.querySelectorAll('.membership-fee-display').forEach(el => {
        el.textContent = `$ ${settings.membership_fee_amount} UYU`;
      });
    }

    // 4. Statute Download links
    if (settings.statute_pdf_url) {
      document.querySelectorAll('.statute-download-link').forEach(link => {
        link.href = settings.statute_pdf_url;
      });
    }

    // 5. Bank Accounts
    if (settings.brou_account_info) {
      document.querySelectorAll('.brou-account-display').forEach(el => {
        el.textContent = settings.brou_account_info;
      });
    }
    if (settings.prex_account_info) {
      document.querySelectorAll('.prex-account-display').forEach(el => {
        el.textContent = settings.prex_account_info;
      });
    }
  } catch (err) {
    console.warn('Configuraciones operando en modo estático/fallback:', err);
  }
}

async function loadPublicAuthorities() {
  const container = document.getElementById('public-authorities-grid');
  const mandateEl = document.getElementById('public-mandate-period');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/authorities`);
    if (!res.ok) return;
    const { authorities, mandatePeriod } = await res.json();

    if (mandateEl && mandatePeriod) {
      mandateEl.innerHTML = `Período de Mandato Estatutario: <strong>${mandatePeriod}</strong>`;
    }

    if (authorities && authorities.length > 0) {
      container.innerHTML = authorities.map(a => `
        <div class="pillar-card" style="text-align:center;">
          <div style="width:100px; height:100px; border-radius:50%; margin:0 auto 18px auto; overflow:hidden; border:2px solid var(--border-bronze); background:#0A0F0D;">
            <img src="${a.photo_url || 'assets/logo.png'}" alt="${a.role_title}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='assets/logo.png';" />
          </div>
          <span style="font-size:0.75rem; font-weight:700; color:var(--bronze-light); text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:4px;">
            ${a.role_title}
          </span>
          <h3 style="font-size:1.25rem; font-weight:700; color:var(--text-bone); margin-bottom:8px;">
            ${a.name}
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">
            ${a.bio || ''}
          </p>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Autoridades operando en modo estático/fallback:', err);
  }
}

async function loadPublicActivities() {
  const container = document.getElementById('public-activities-container');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/activities`);
    if (!res.ok) return;
    const { activities } = await res.json();

    if (activities && activities.length > 0) {
      container.innerHTML = activities.map(act => {
        const d = new Date(act.event_date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('es-UY', { month: 'short' }).toUpperCase();

        const badgeClass = act.registration_status === 'OPEN' ? 'style="color:var(--color-available);"' : 'style="color:var(--text-muted);"';
        const statusText = act.registration_status === 'OPEN' ? '🟢 Cupos Disponibles' : (act.registration_status === 'FULL' ? '🟠 Cupos Agotados' : '🔴 Finalizado');

        return `
          <div class="activity-card" style="background:var(--bg-card); border:1px solid var(--border-medium); border-radius:var(--radius-xl); overflow:hidden; display:grid; grid-template-columns: 240px 1fr; margin-bottom:24px; box-shadow:var(--shadow-md);">
            <div style="background-image:url('${act.image_url || 'assets/hero_uruguay_monte.jpg'}'); background-size:cover; background-position:center; min-height:180px; position:relative;">
              <div style="position:absolute; top:16px; left:16px; background:rgba(10,15,13,0.92); border:1.5px solid var(--border-bronze); border-radius:var(--radius-md); padding:8px 14px; text-align:center;">
                <span style="font-size:1.4rem; font-weight:800; color:var(--bronze-light); display:block; line-height:1;">${day}</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-bone);">${month}</span>
              </div>
            </div>
            <div style="padding:28px 32px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                  <span class="raffle-tag" style="margin-bottom:0;">${act.category}</span>
                  <span ${badgeClass} style="font-size:0.8rem; font-weight:700;">${statusText}</span>
                </div>
                <h3 style="font-family:var(--font-heading); font-size:1.35rem; font-weight:700; color:var(--text-bone); margin-bottom:10px;">
                  ${act.title}
                </h3>
                <p style="color:var(--text-muted); font-size:0.9rem; line-height:1.5; margin-bottom:16px;">
                  ${act.description}
                </p>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:14px; flex-wrap:wrap; gap:12px;">
                <div style="font-size:0.82rem; color:var(--text-muted);">
                  📍 <strong>${act.location}, ${act.department}</strong> · 🕒 ${act.event_time || '09:00 hs'}
                </div>
                <div style="display:flex; align-items:center; gap:16px;">
                  <div style="text-align:right;">
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Socios ANCU:</span>
                    <strong style="color:var(--color-available); font-size:0.95rem;">${parseFloat(act.price_members) === 0 ? 'Sin Costo' : '$ ' + act.price_members}</strong>
                  </div>
                  <a href="contacto.html" class="btn btn-secondary btn-sm">Inscribirse &rarr;</a>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Actividades operando en modo estático/fallback:', err);
  }
}

async function loadPublicBenefits() {
  const container = document.getElementById('public-benefits-grid');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/benefits`);
    if (!res.ok) return;
    const { benefits } = await res.json();

    if (benefits && benefits.length > 0) {
      container.innerHTML = benefits.map(b => `
        <div class="pillar-card" style="background:var(--bg-card); border:1px solid var(--border-medium); display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
              <div style="width:48px; height:48px; border-radius:var(--radius-sm); border:1.5px solid var(--border-bronze); background:#0A0F0D; display:flex; align-items:center; justify-content:center; padding:4px;">
                <img src="${b.logo_url || 'assets/logo.png'}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="${b.partner_name}" onerror="this.src='assets/logo.png';" />
              </div>
              <div>
                <span style="font-size:0.75rem; color:var(--bronze-light); font-weight:700; text-transform:uppercase;">${b.category}</span>
                <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-bone);">${b.partner_name}</h3>
              </div>
            </div>
            <div style="background:rgba(35,88,60,0.25); border:1px solid rgba(52,126,87,0.4); padding:12px; border-radius:var(--radius-md); margin-bottom:12px; font-size:0.9rem; color:#A7F3D0; font-weight:600;">
              🎁 ${b.discount_text}
            </div>
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); border-top:1px solid var(--border-subtle); padding-top:10px;">
            📍 ${b.address ? b.address + ' (' + b.department + ')' : b.department}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Convenios operando en modo estático/fallback:', err);
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

// ---------------- Initialization on DOM Ready ----------------
document.addEventListener('DOMContentLoaded', async () => {
  initMobileNavigation();
  initModalListeners();
  initNormativaFilters();
  initMembershipForm();

  // Load global settings, top bar & fees across all pages
  await loadPublicSettings();

  // Load public authorities on autoridades.html
  await loadPublicAuthorities();

  // Load public activities on actividades.html
  await loadPublicActivities();

  // Load public benefits on socios.html
  await loadPublicBenefits();

  // Load news from PostgreSQL
  await syncNewsFromAPI();

  // Load active raffle & numbers
  await syncRaffleFromAPI();
  initRaffleGrid();
  renderNumbersGrid(currentHundred);
  updateCheckoutTray();
  await checkMercadoPagoReturn();

  // Search input listener
  const searchInput = document.getElementById('raffle-search-input');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchRaffleNumber();
    });
  }

  // Load Member Digital Card
  renderDigitalCard();

  // Load Admin Dashboard if on admin.html
  await initAdminDashboard();
});

// Explicit Global Window Bindings for Inline HTML Events
window.openModal = openModal;
window.closeModal = closeModal;
window.switchAdminTab = switchAdminTab;
window.openNewAuthorityModal = openNewAuthorityModal;
window.editAuthority = editAuthority;
window.deleteAuthority = deleteAuthority;
window.saveAuthorityForm = saveAuthorityForm;
window.saveMandatePeriod = saveMandatePeriod;
window.openStatuteModal = openStatuteModal;
window.handleStatuteUploadSubmit = handleStatuteUploadSubmit;
window.openNewActivityModal = openNewActivityModal;
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.saveActivityForm = saveActivityForm;
window.openNewBenefitModal = openNewBenefitModal;
window.editBenefit = editBenefit;
window.deleteBenefit = deleteBenefit;
window.saveBenefitForm = saveBenefitForm;
window.openNewUserModal = openNewUserModal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.saveUserForm = saveUserForm;
window.openNewArticleModal = openNewArticleModal;
window.editArticle = editArticle;
window.deleteArticle = deleteArticle;
window.saveArticleForm = saveArticleForm;
window.openNewRaffleModal = openNewRaffleModal;
window.handleCreateNewRaffle = handleCreateNewRaffle;
window.saveRaffleConfig = saveRaffleConfig;
window.handleAdminLogin = handleAdminLogin;
window.handleAdminLogout = handleAdminLogout;
window.approveReceipt = approveReceipt;
window.rejectReceipt = rejectReceipt;
window.saveInstitutionalSettingsForm = saveInstitutionalSettingsForm;
window.openNewMemberModal = openNewMemberModal;
window.editMember = editMember;
window.deleteMember = deleteMember;
window.saveMemberForm = saveMemberForm;
window.handleMemberPhotoUpload = handleMemberPhotoUpload;
window.loadAdminMembers = loadAdminMembers;
window.debounceMemberSearch = debounceMemberSearch;

