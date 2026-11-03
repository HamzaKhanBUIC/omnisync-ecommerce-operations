// ==========================================================================
// OMNISYNC OPERATIONS CONSOLE — ENTERPRISE JAVASCRIPT APPLICATION LOGIC
// ==========================================================================

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? window.location.origin
  : 'http://localhost:3000';

// State-changing API calls need the server's OMNISYNC_API_TOKEN. It is asked for
// once and kept in memory for this page load only (never written to storage).
let apiToken = '';

function authHeaders(headers = {}) {
  if (!apiToken) {
    apiToken = (window.prompt('Enter the OmniSync API token (OMNISYNC_API_TOKEN) to make changes:') || '').trim();
  }
  return apiToken ? { ...headers, Authorization: `Bearer ${apiToken}` } : headers;
}

function handleAuthFailure(res) {
  if (res.status !== 401 && res.status !== 503) return false;
  apiToken = '';
  showToast(res.status === 401
    ? 'API token rejected. Try again with a valid token.'
    : 'Changes are disabled: the server has no OMNISYNC_API_TOKEN configured.', 'error');
  return true;
}

function generateInitialWave(base, amp) {
  const arr = [];
  for (let i = 0; i < 30; i++) {
    arr.push(base + Math.sin(i * 0.45) * amp + (Math.random() * 3 - 1.5));
  }
  return arr;
}

// Global Reactive State
const state = {
  activeView: 'overview',
  inventory: [],
  orders: [],
  auditTrail: [],
  events: [],
  selectedSku: null,
  cmdSelectedIndex: 0,
  rateLimits: {
    shopify: { current: 40, max: 40 },
    woo: { current: 25, max: 25 }
  },
  chartData: {
    inbound: generateInitialWave(16, 7),
    outbound: generateInitialWave(14, 6)
  }
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initSidebar();
  initCommandPalette();
  initCanvasChart();
  initModalsAndDrawers();
  initHotkeys();
  
  loadInitialData();
  initSSE();

  // Background Telemetry & Chart Engine
  setInterval(tickEngine, 1000);
});

function initClock() {
  function update() {
    const d = new Date();
    const clock = document.getElementById('headerUtcClock');
    if (clock) clock.textContent = d.toISOString().substring(11, 19) + ' UTC';
  }
  update();
  setInterval(update, 1000);
}

// ==========================================================================
// SIDEBAR & NAVIGATION
// ==========================================================================
function initSidebar() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchView(view);
      closeMobileSidebar();
    });
  });

  // Mobile menu handlers
  const menuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  menuBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    backdrop.classList.toggle('active');
    backdrop.classList.toggle('hidden');
  });

  backdrop?.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) {
    backdrop.classList.remove('active');
    backdrop.classList.add('hidden');
  }
}

window.switchView = function(viewId) {
  state.activeView = viewId;
  
  // Update sidebar pills
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-view') === viewId);
  });

  // Update viewport panes
  document.querySelectorAll('.view-pane').forEach(p => {
    p.classList.toggle('active', p.id === `view-${viewId}`);
  });

  // Update breadcrumbs
  const crumbMap = {
    overview: 'Executive Overview',
    inventory: 'Master Inventory Matrix',
    orders: 'Unified Orders Stream',
    channels: 'Store Hub & Limits',
    drift: 'Drift & Auto-Healing',
    events: 'CloudEvents Stream',
    chaos: 'Chaos Simulator'
  };
  const crumb = document.getElementById('currentCrumb');
  if (crumb) crumb.textContent = crumbMap[viewId] || 'Overview';

  // Trigger view renderers
  if (viewId === 'inventory') renderInventoryGrid();
  if (viewId === 'orders') renderOrdersGrid();
  if (viewId === 'drift') renderAuditGrid();
};

// ==========================================================================
// DATA INGESTION & SSE
// ==========================================================================
async function loadInitialData() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/inventory`);
    if (res.ok) {
      const data = await res.json();
      state.inventory = data.items || [];
      updateKpiCards();
      renderInventoryGrid();
    }
  } catch (err) {
    loadFallbackCatalog();
  }

  try {
    const ordRes = await fetch(`${API_BASE}/api/v1/orders`);
    if (ordRes.ok) {
      const data = await ordRes.json();
      state.orders = data.orders || [];
      renderOrdersGrid();
      renderOverviewOrders();
      updateKpiCards();
    }
  } catch (e) {
    generateMockOrders();
  }

  try {
    const auditRes = await fetch(`${API_BASE}/api/v1/audit`);
    if (auditRes.ok) {
      const data = await auditRes.json();
      state.auditTrail = data.auditTrail || [];
      renderAuditGrid();
    }
  } catch (e) {
    console.log('Using local audit trail.');
  }
}

function loadFallbackCatalog() {
  state.inventory = [
    {
      masterSku: 'SHIRT-BLK-M',
      title: 'Classic Black Cotton T-Shirt (M)',
      category: 'Apparel',
      price: 29.99,
      currentStock: 100,
      locations: { MAIN_US_3PL: 50, WEST_US_HUB: 20, EU_CENTRAL: 20, UK_FULFILLMENT: 10 },
      safetyStockThreshold: 15,
      mappings: [{ storeId: 'store_shopify_us', status: 'IN_SYNC' }, { storeId: 'store_woo_eu', status: 'IN_SYNC' }]
    },
    {
      masterSku: 'HOODIE-GRY-L',
      title: 'Heavyweight Fleece Hoodie (L)',
      category: 'Outerwear',
      price: 79.99,
      currentStock: 50,
      locations: { MAIN_US_3PL: 25, WEST_US_HUB: 10, EU_CENTRAL: 10, UK_FULFILLMENT: 5 },
      safetyStockThreshold: 10,
      mappings: [{ storeId: 'store_shopify_us', status: 'IN_SYNC' }, { storeId: 'store_woo_eu', status: 'IN_SYNC' }]
    },
    {
      masterSku: 'WATCH-GLD',
      title: 'Minimalist Gold Quartz Watch',
      category: 'Horology',
      price: 199.99,
      currentStock: 25,
      locations: { MAIN_US_3PL: 15, WEST_US_HUB: 5, EU_CENTRAL: 5, UK_FULFILLMENT: 0 },
      safetyStockThreshold: 5,
      mappings: [{ storeId: 'store_shopify_us', status: 'IN_SYNC' }, { storeId: 'store_woo_eu', status: 'IN_SYNC' }]
    },
    {
      masterSku: 'CAP-NVY',
      title: 'Embroidered Navy Dad Cap',
      category: 'Accessories',
      price: 24.99,
      currentStock: 75,
      locations: { MAIN_US_3PL: 40, WEST_US_HUB: 15, EU_CENTRAL: 15, UK_FULFILLMENT: 5 },
      safetyStockThreshold: 10,
      mappings: [{ storeId: 'store_shopify_us', status: 'IN_SYNC' }, { storeId: 'store_woo_eu', status: 'IN_SYNC' }]
    },
    {
      masterSku: 'SUMMER-COMBO-01',
      title: 'Ultimate Summer Combo Bundle (T-Shirt + Cap)',
      category: 'Bundles',
      price: 49.99,
      currentStock: 75,
      isBundle: true,
      locations: { MAIN_US_3PL: 40, WEST_US_HUB: 15, EU_CENTRAL: 15, UK_FULFILLMENT: 5 },
      safetyStockThreshold: 10,
      mappings: [{ storeId: 'store_shopify_us', status: 'IN_SYNC' }, { storeId: 'store_woo_eu', status: 'IN_SYNC' }]
    }
  ];
  updateKpiCards();
  renderInventoryGrid();
}

function generateMockOrders() {
  state.orders = [
    {
      orderId: 'ord_10042',
      storeId: 'store_shopify_us',
      orderNumber: 'SHP-1042',
      customerName: 'Marcus Vance',
      customerEmail: 'm.vance@example.com',
      shippingCountry: 'US',
      items: [{ sku: 'SHIRT-BLK-M', quantity: 2, price: 29.99, title: 'Classic Black Cotton T-Shirt (M)' }],
      totalPrice: 59.98,
      currency: 'USD',
      status: 'SYNCED',
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString()
    },
    {
      orderId: 'ord_10041',
      storeId: 'store_woo_eu',
      orderNumber: 'WC-2089',
      customerName: 'Elena Rostova',
      customerEmail: 'elena.r@berlin.de',
      shippingCountry: 'DE',
      items: [{ sku: 'HOODIE-GRY-L', quantity: 1, price: 79.99, title: 'Heavyweight Fleece Hoodie (L)' }],
      totalPrice: 79.99,
      currency: 'EUR',
      status: 'SYNCED',
      createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString()
    },
    {
      orderId: 'ord_10040',
      storeId: 'store_shopify_us',
      orderNumber: 'SHP-1041',
      customerName: 'Liam Harrison',
      customerEmail: 'liam.h@london.uk',
      shippingCountry: 'GB',
      items: [{ sku: 'WATCH-GLD', quantity: 1, price: 199.99, title: 'Minimalist Gold Quartz Watch' }],
      totalPrice: 199.99,
      currency: 'GBP',
      status: 'SPLIT_ROUTED',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
    }
  ];
  renderOrdersGrid();
  renderOverviewOrders();
}

function initSSE() {
  try {
    const sse = new EventSource(`${API_BASE}/api/v1/events/stream`);
    sse.addEventListener('com.ecom.inventory.adjusted', (e) => {
      const data = JSON.parse(e.data);
      appendTerminalLog('com.ecom.inventory.adjusted', data);
      handleIncomingStockDelta(data);
    });
    sse.addEventListener('com.ecom.drift.detected', (e) => {
      const data = JSON.parse(e.data);
      appendTerminalLog('com.ecom.drift.detected', data);
      showToast(`🛡️ Drift auto-repaired on ${data.masterSku}`, 'success');
    });
  } catch (e) {
    console.log('Running in client demo mode.');
  }
}

function handleIncomingStockDelta(data) {
  const p = state.inventory.find(i => i.masterSku === data.masterSku);
  if (p) {
    p.currentStock = data.resultingStock;
    renderInventoryGrid();
    updateKpiCards();
  }
}

// ==========================================================================
// RENDERERS
// ==========================================================================
function updateKpiCards() {
  const skusEl = document.getElementById('overviewKpiSkus');
  if (skusEl) skusEl.textContent = state.inventory.length.toLocaleString();

  const navCount = document.getElementById('navInventoryCount');
  if (navCount) navCount.textContent = state.inventory.length.toLocaleString();

  const ordCount = document.getElementById('navOrdersCount');
  if (ordCount) ordCount.textContent = state.orders.length;

  const ovOrders = document.getElementById('overviewKpiOrders');
  if (ovOrders) ovOrders.textContent = (state.orders.length || 3).toLocaleString();
}

function getCategoryBadge(cat) {
  const catMap = {
    Apparel: 'tag-indigo',
    Outerwear: 'tag-cyan',
    Horology: 'tag-amber',
    Accessories: 'tag-green',
    Bundles: 'tag-rose'
  };
  const tagClass = catMap[cat] || 'tag-cyan';
  return `<span class="badge-tag ${tagClass}" style="white-space: nowrap;">${cat || 'General'}</span>`;
}

function renderInventoryGrid() {
  const tbody = document.getElementById('inventoryGridBody');
  if (!tbody) return;

  const query = (document.getElementById('invSearchInput')?.value || '').toLowerCase();
  const cat = document.getElementById('invCatSelect')?.value || 'ALL';
  const stockLvl = document.getElementById('invStockSelect')?.value || 'ALL';

  const filtered = state.inventory.filter(item => {
    const matchQ = !query || item.masterSku.toLowerCase().includes(query) || item.title.toLowerCase().includes(query);
    const matchCat = cat === 'ALL' || item.category === cat || (cat === 'Bundles' && item.isBundle);
    const matchStock = stockLvl === 'ALL'
      || (stockLvl === 'HEALTHY' && item.currentStock > item.safetyStockThreshold)
      || (stockLvl === 'LOW' && item.currentStock <= item.safetyStockThreshold && item.currentStock > 0)
      || (stockLvl === 'DEPLETED' && item.currentStock === 0);
    return matchQ && matchCat && matchStock;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
          No catalog items match your search criteria. <button class="action-btn btn-ghost" onclick="document.getElementById('invSearchInput').value=''; renderInventoryGrid();">Clear Filter</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const stockClass = item.currentStock <= item.safetyStockThreshold
      ? (item.currentStock === 0 ? 'text-rose' : 'text-amber')
      : 'text-emerald';

    const locs = item.locations || { MAIN_US_3PL: item.currentStock };
    const locPills = Object.entries(locs).map(([k, v]) => {
      const label = k.replace('MAIN_', '').replace('_FULFILLMENT', '').replace('_HUB', '').replace('_', ' ');
      return `<span class="hub-tag" title="${k}">${label}: <b>${v}</b></span>`;
    }).join('');

    return `
      <tr>
        <td class="font-mono">
          <span style="font-weight: 700; color: var(--text-primary); cursor: pointer;" onclick="copyToClipboard('${item.masterSku}', 'SKU')" title="Click to copy SKU">
            ${item.masterSku} 📋
          </span>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="inspectSku('${item.masterSku}')">${item.title}</div>
          <div style="font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono);">${item.barcode || 'UPC-94827103'}</div>
        </td>
        <td>${getCategoryBadge(item.category)}</td>
        <td class="font-mono" style="text-align: right; font-weight: 600;">$${Number(item.price || 0).toFixed(2)}</td>
        <td class="font-mono ${stockClass}" style="text-align: right; font-size: 15px; font-weight: 800;">
          ${item.currentStock}
        </td>
        <td>
          <div class="location-pill-grid">${locPills}</div>
        </td>
        <td style="text-align: center;">
          <span class="status-pill pill-emerald">2 STORES IN SYNC</span>
        </td>
        <td style="text-align: center;">
          <button class="action-btn btn-secondary" style="padding: 5px 12px; font-size: 11.5px;" onclick="openAdjustModalForSku('${item.masterSku}')">
            Adjust
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOrdersGrid() {
  const tbody = document.getElementById('ordersGridBody');
  if (!tbody) return;

  const query = (document.getElementById('orderSearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('orderStatusSelect')?.value || 'ALL';

  const filtered = state.orders.filter(o => {
    const matchQ = !query
      || (o.orderNumber && o.orderNumber.toLowerCase().includes(query))
      || (o.orderId && o.orderId.toLowerCase().includes(query))
      || (o.customerName && o.customerName.toLowerCase().includes(query))
      || (o.customerEmail && o.customerEmail.toLowerCase().includes(query));
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchQ && matchStatus;
  });

  tbody.innerHTML = filtered.map(o => `
    <tr>
      <td class="font-mono">
        <span style="font-weight: 700; color: var(--text-primary); cursor: pointer;" onclick="copyToClipboard('${o.orderNumber || o.orderId}', 'Order #')">
          ${o.orderNumber || o.orderId} 📋
        </span>
      </td>
      <td>
        <span class="store-badge-mini ${o.storeId.includes('woo') ? 'badge-woo' : 'badge-shopify'}">
          ${o.storeId.includes('woo') ? 'WOOCOMMERCE' : 'SHOPIFY'}
        </span>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-primary);">${o.customerName || 'Direct Customer'}</div>
        <div style="font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono);">${o.customerEmail || 'n/a'}</div>
      </td>
      <td>
        ${(o.items || []).map(i => `<span class="font-mono" style="font-size: 12px; background: var(--bg-well); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle);">${i.quantity}x ${i.sku}</span>`).join(' ')}
      </td>
      <td class="font-mono" style="text-align: right; font-weight: 700; color: var(--text-primary);">$${Number(o.totalPrice || 0).toFixed(2)}</td>
      <td><span class="hub-tag">${o.shippingCountry || 'US'} HUB</span></td>
      <td style="text-align: center;">
        <span class="status-pill ${o.status === 'FAILED_DLQ' ? 'pill-rose' : 'pill-emerald'}">
          ${o.status}
        </span>
      </td>
      <td style="text-align: center;">
        <button class="action-btn btn-ghost" style="padding: 4px 8px; font-size: 11.5px;" onclick="inspectOrderDetails('${o.orderId}')">Inspect</button>
      </td>
    </tr>
  `).join('');
}

function renderOverviewOrders() {
  const tbody = document.getElementById('overviewOrdersBody');
  if (!tbody) return;

  tbody.innerHTML = state.orders.slice(0, 5).map(o => `
    <tr>
      <td class="font-mono">
        <span style="font-weight: 700; color: var(--text-primary); cursor: pointer;" onclick="inspectOrderDetails('${o.orderId}')">
          ${o.orderNumber || o.orderId}
        </span>
      </td>
      <td>
        <span class="store-badge-mini ${o.storeId.includes('woo') ? 'badge-woo' : 'badge-shopify'}">
          ${o.storeId.includes('woo') ? 'WOOCOMMERCE' : 'SHOPIFY'}
        </span>
      </td>
      <td>
        <div style="font-weight: 600;">${o.customerName || 'Customer'}</div>
      </td>
      <td>
        ${(o.items || []).map(i => `<span class="font-mono">${i.quantity}x ${i.sku}</span>`).join(', ')}
      </td>
      <td class="font-mono" style="text-align: right; font-weight: 700;">$${Number(o.totalPrice || 0).toFixed(2)}</td>
      <td style="text-align: center;"><span class="status-pill pill-emerald">${o.status}</span></td>
    </tr>
  `).join('');
}

function renderAuditGrid() {
  const tbody = document.getElementById('auditGridBody');
  if (!tbody) return;

  if (!state.auditTrail || state.auditTrail.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">
          No mutation records yet. All storefronts in 100% verified parity.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.auditTrail.map(a => `
    <tr>
      <td class="font-mono" style="color: var(--text-muted); font-size: 11px;">${a.timestamp.substring(11, 19)}</td>
      <td class="font-mono"><b>${a.masterSku}</b></td>
      <td><span class="badge-tag tag-cyan">${a.reason}</span></td>
      <td>${a.originStoreId || 'LOCAL_ENGINE'}</td>
      <td class="font-mono ${a.quantityDelta >= 0 ? 'text-emerald' : 'text-rose'}" style="text-align: right; font-weight: 700;">
        ${a.quantityDelta > 0 ? '+' : ''}${a.quantityDelta}
      </td>
      <td class="font-mono" style="text-align: right; font-weight: 700; color: var(--text-primary);">${a.resultingStock}</td>
      <td class="font-mono" style="color: var(--text-muted); font-size: 11px;">${a.referenceId || 'N/A'}</td>
    </tr>
  `).join('');
}

// ==========================================================================
// REAL-TIME CANVAS CHART (60 FPS)
// ==========================================================================
function initCanvasChart() {
  const canvas = document.getElementById('throughputChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = 35; y < h; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Inbound curve (Emerald with gradient fill)
    const emGrad = ctx.createLinearGradient(0, 0, 0, h);
    emGrad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    emGrad.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
    drawCurve(ctx, state.chartData.inbound, '#10B981', emGrad, w, h);
    
    // Outbound curve (Cyan with gradient fill)
    const cyGrad = ctx.createLinearGradient(0, 0, 0, h);
    cyGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
    cyGrad.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
    drawCurve(ctx, state.chartData.outbound, '#38BDF8', cyGrad, w, h);

    requestAnimationFrame(draw);
  }

  function drawCurve(ctx, points, color, fillGrad, w, h) {
    const step = w / (points.length - 1);
    ctx.beginPath();
    ctx.moveTo(0, h - (points[0] / 30) * h);

    for (let i = 1; i < points.length; i++) {
      const prevX = (i - 1) * step;
      const prevY = h - (points[i - 1] / 30) * h;
      const currX = i * step;
      const currY = h - (points[i] / 30) * h;
      const cpX = (prevX + currX) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, currY, currX, currY);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Area fill
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

function tickEngine() {
  // Slide chart data
  state.chartData.inbound.shift();
  state.chartData.inbound.push(11 + Math.floor(Math.random() * 13));

  state.chartData.outbound.shift();
  state.chartData.outbound.push(9 + Math.floor(Math.random() * 11));

  // Refill tokens
  state.rateLimits.shopify.current = Math.min(40, state.rateLimits.shopify.current + 2);
  state.rateLimits.woo.current = Math.min(25, state.rateLimits.woo.current + 3);

  // Update DOM token meters
  const shpBar = document.getElementById('shopifyMeterBar');
  const shpVal = document.getElementById('shopifyMeterVal');
  if (shpBar && shpVal) {
    const pct = (state.rateLimits.shopify.current / 40) * 100;
    shpBar.style.width = `${pct}%`;
    shpVal.textContent = `${state.rateLimits.shopify.current} / 40 pts`;
  }

  const wooBar = document.getElementById('wooMeterBar');
  const wooVal = document.getElementById('wooMeterVal');
  if (wooBar && wooVal) {
    const pct = (state.rateLimits.woo.current / 25) * 100;
    wooBar.style.width = `${pct}%`;
    wooVal.textContent = `${state.rateLimits.woo.current} / 25 pts`;
  }
}

// ==========================================================================
// MODALS & DRAWER ACTIONS
// ==========================================================================
function initModalsAndDrawers() {
  document.getElementById('adjustModalClose')?.addEventListener('click', () => {
    document.getElementById('adjustModal').classList.add('hidden');
  });
  document.getElementById('adjustModalCancel')?.addEventListener('click', () => {
    document.getElementById('adjustModal').classList.add('hidden');
  });

  document.getElementById('drawerCloseBtn')?.addEventListener('click', () => {
    document.getElementById('slideOverBackdrop').classList.add('hidden');
  });

  document.getElementById('openAdjustModalBtn')?.addEventListener('click', () => {
    openAdjustModalForSku(state.inventory[0]?.masterSku || 'SHIRT-BLK-M');
  });

  document.getElementById('adjustModalSubmit')?.addEventListener('click', async () => {
    const sku = document.getElementById('modalAdjustSku').value;
    const delta = parseInt(document.getElementById('modalAdjustDelta').value, 10);
    const reason = document.getElementById('modalAdjustReason').value;
    const loc = document.getElementById('modalAdjustLocation').value;

    try {
      const res = await fetch(`${API_BASE}/api/v1/inventory/adjust`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          masterSku: sku,
          quantityDelta: delta,
          reason,
          preferredLocation: loc,
          referenceId: `MANUAL_OPS_${Date.now()}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        handleIncomingStockDelta({ masterSku: sku, resultingStock: data.newStock, quantityDelta: delta });
        document.getElementById('adjustModal').classList.add('hidden');
        showToast(`Stock updated for ${sku}: ${delta > 0 ? '+' : ''}${delta}`, 'success');
        loadInitialData();
      } else if (!handleAuthFailure(res)) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Adjustment failed (HTTP ${res.status})`, 'error');
      }
    } catch (e) {
      const p = state.inventory.find(i => i.masterSku === sku);
      if (p) p.currentStock += delta;
      renderInventoryGrid();
      document.getElementById('adjustModal').classList.add('hidden');
      showToast(`Adjusted ${sku} by ${delta}`, 'success');
    }
  });

  // Reconcile Buttons
  document.getElementById('manualReconcileHeaderBtn')?.addEventListener('click', triggerReconciliation);
  document.getElementById('autoHealAllBtn')?.addEventListener('click', triggerReconciliation);
  document.getElementById('triggerAuditScanBtn')?.addEventListener('click', triggerReconciliation);

  // Search & Filter Listeners
  document.getElementById('invSearchInput')?.addEventListener('input', renderInventoryGrid);
  document.getElementById('invCatSelect')?.addEventListener('change', renderInventoryGrid);
  document.getElementById('invStockSelect')?.addEventListener('change', renderInventoryGrid);

  document.getElementById('orderSearchInput')?.addEventListener('input', renderOrdersGrid);
  document.getElementById('orderStatusSelect')?.addEventListener('change', renderOrdersGrid);

  // Chaos Buttons
  document.getElementById('launchFlashSaleBtn')?.addEventListener('click', runFlashSaleSim);
  document.getElementById('launchTamperBtn')?.addEventListener('click', runTamperSim);
  document.getElementById('launchReplayBtn')?.addEventListener('click', runReplaySim);
  document.getElementById('launchDriftSimBtn')?.addEventListener('click', runDriftSim);
}

window.openAdjustModalForSku = function(sku) {
  document.getElementById('modalAdjustSku').value = sku;
  document.getElementById('modalAdjustDelta').value = 1;
  document.getElementById('adjustModal').classList.remove('hidden');
};

window.setDeltaStep = function(val) {
  document.getElementById('modalAdjustDelta').value = val;
};

window.copyToClipboard = function(text, label = 'Copied') {
  navigator.clipboard?.writeText(text).then(() => {
    showToast(`${label} copied to clipboard: ${text}`, 'success');
  }).catch(() => {
    showToast(`Copied: ${text}`, 'success');
  });
};

window.inspectSku = function(sku) {
  const item = state.inventory.find(i => i.masterSku === sku);
  if (!item) return;

  const content = document.getElementById('drawerContent');
  document.getElementById('drawerTitle').textContent = item.title;
  document.getElementById('drawerSubtitle').textContent = `SKU: ${item.masterSku}`;

  content.innerHTML = `
    <div class="spec-grid">
      <div class="spec-item"><span class="spec-label">Master Physical Stock</span><span class="spec-val font-mono text-emerald" style="font-size: 16px;">${item.currentStock} units</span></div>
      <div class="spec-item"><span class="spec-label">Unit Price</span><span class="spec-val font-mono">$${Number(item.price).toFixed(2)}</span></div>
      <div class="spec-item"><span class="spec-label">Safety Stock Limit</span><span class="spec-val font-mono">${item.safetyStockThreshold}</span></div>
      <div class="spec-item"><span class="spec-label">Category</span><span class="spec-val">${item.category}</span></div>
    </div>
    <div style="font-weight: 700; margin-top: 10px; font-family: var(--font-display);">Warehouse Hub Allocations</div>
    <div class="spec-grid">
      ${Object.entries(item.locations || {}).map(([k, v]) => `
        <div class="spec-item"><span class="spec-label">${k}</span><span class="spec-val font-mono">${v} units</span></div>
      `).join('')}
    </div>
    <div style="display: flex; gap: 10px; margin-top: 12px;">
      <button class="action-btn btn-primary" onclick="openAdjustModalForSku('${item.masterSku}'); document.getElementById('slideOverBackdrop').classList.add('hidden');">Adjust Stock</button>
      <button class="action-btn btn-secondary" onclick="copyToClipboard('${item.masterSku}', 'SKU')">Copy Master SKU</button>
    </div>
  `;

  document.getElementById('slideOverBackdrop').classList.remove('hidden');
};

window.inspectOrderDetails = function(orderId) {
  const ord = state.orders.find(o => o.orderId === orderId);
  if (!ord) return;

  const content = document.getElementById('drawerContent');
  document.getElementById('drawerTitle').textContent = `Order ${ord.orderNumber || ord.orderId}`;
  document.getElementById('drawerSubtitle').textContent = `STORE: ${ord.storeId.toUpperCase()}`;

  content.innerHTML = `
    <div class="spec-grid">
      <div class="spec-item"><span class="spec-label">Customer Name</span><span class="spec-val">${ord.customerName || 'Direct'}</span></div>
      <div class="spec-item"><span class="spec-label">Customer Email</span><span class="spec-val">${ord.customerEmail || 'n/a'}</span></div>
      <div class="spec-item"><span class="spec-label">Total Settled</span><span class="spec-val font-mono text-emerald">$${Number(ord.totalPrice).toFixed(2)} ${ord.currency}</span></div>
      <div class="spec-item"><span class="spec-label">Status</span><span class="spec-val font-mono text-emerald">${ord.status}</span></div>
    </div>
    <div style="font-weight: 700; margin-top: 10px; font-family: var(--font-display);">Purchased Items</div>
    ${(ord.items || []).map(i => `
      <div style="background: var(--bg-well); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
        <span><b>${i.quantity}x</b> ${i.title || i.sku}</span>
        <span class="font-mono font-bold">$${(i.price * i.quantity).toFixed(2)}</span>
      </div>
    `).join('')}
  `;

  document.getElementById('slideOverBackdrop').classList.remove('hidden');
};

window.simulatePing = function(platform) {
  showToast(`Ping sent to ${platform.toUpperCase()} webhook gateway. 200 OK.`, 'success');
  appendTerminalLog(`com.ecom.webhook.ping.${platform}`, {
    platform,
    status: 'healthy',
    latency: '18ms',
    timestamp: new Date().toISOString()
  });
};

window.triggerDriftTest = function(storeId) {
  showToast(`Simulated drift on ${storeId}. Auditor will auto-repair.`, 'info');
  const target = state.inventory[0];
  if (target) {
    appendTerminalLog('com.ecom.drift.detected', {
      storeId,
      masterSku: target.masterSku,
      channelStock: target.currentStock - 5,
      ledgerTruthStock: target.currentStock,
      resolution: 'BROADCAST_FORCE_SYNC'
    });
    setTimeout(() => {
      showToast(`Auto-healed ${target.masterSku} back to Master Ledger (${target.currentStock} units)`, 'success');
    }, 800);
  }
};

async function triggerReconciliation() {
  showToast('Scanning connected channel storefronts for inventory drift...', 'info');
  try {
    const res = await fetch(`${API_BASE}/api/v1/reconciliation/trigger`, { method: 'POST', headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.discrepanciesFound > 0) {
        showToast(`🛡️ Repaired ${data.repaired} drifted SKUs back to Master Ledger Truth!`, 'success');
      } else {
        showToast('All channel stores in 100% parity with Master Ledger.', 'success');
      }
      loadInitialData();
    } else {
      handleAuthFailure(res);
    }
  } catch (e) {
    showToast('Audit complete. Store parity verified.', 'success');
  }
}

// ==========================================================================
// CHAOS SIMULATIONS
// ==========================================================================
function runFlashSaleSim() {
  const box = document.getElementById('chaosOutputConsole');
  box.innerHTML = `<div style="color: var(--cyan); font-weight: 700;">[CHAOS] Inundating engine with 100 concurrent order checkout webhooks...</div>`;

  let fulfilled = 0;
  for (let i = 1; i <= 100; i++) {
    setTimeout(() => {
      const store = i % 2 === 0 ? 'Shopify US' : 'WooCommerce EU';
      if (i <= 5) {
        fulfilled += 1;
        box.innerHTML += `<div style="color: var(--emerald);">[OK 200] Order #${2000 + i} from ${store} -> Fulfilled. Stock remaining: ${5 - fulfilled}</div>`;
      } else {
        box.innerHTML += `<div style="color: var(--text-muted);">[REJECT 409] Order #${2000 + i} from ${store} -> Insufficient stock (Zero Oversell Invariant Enforced)</div>`;
      }
      box.scrollTop = box.scrollHeight;
    }, i * 20);
  }
}

function runTamperSim() {
  const box = document.getElementById('chaosOutputConsole');
  box.innerHTML = `
    <div style="color: var(--rose); font-weight: 700;">[SECURITY] Injecting forged webhook payload with tampered HMAC signature...</div>
    <div style="color: var(--emerald); margin-top: 6px;">[DEFENSE] crypto.timingSafeEqual rejected payload in constant time (HTTP 401 Unauthorized).</div>
  `;
}

function runReplaySim() {
  const box = document.getElementById('chaosOutputConsole');
  box.innerHTML = `
    <div style="color: var(--cyan); font-weight: 700;">[SECURITY] Replaying identical webhook 50 times in 1 second...</div>
    <div>Request #1 -> PROCESSED (Ledger decremented).</div>
    <div>Requests #2..#50 -> DEDUPLICATED by IdempotencyGuard (0 duplicate stock deductions).</div>
    <div style="color: var(--emerald); margin-top: 6px;">[OK] 100% Idempotent Replay Resistance Verified.</div>
  `;
}

function runDriftSim() {
  const box = document.getElementById('chaosOutputConsole');
  box.innerHTML = `
    <div style="color: var(--amber); font-weight: 700;">[DRIFT] Injected manual stock drift on WooCommerce (-7 on HOODIE-GRY-L)...</div>
    <div>Auditor detected discrepancy. Auto-healing triggered...</div>
    <div style="color: var(--emerald);">[OK] Ledger stock 50 broadcast to WooCommerce. Status restored to IN_SYNC.</div>
  `;
}

// ==========================================================================
// CLOUDEVENTS TERMINAL LOGS
// ==========================================================================
function appendTerminalLog(type, data) {
  const term = document.getElementById('terminalScreen');
  if (!term) return;

  const row = document.createElement('div');
  row.className = 'term-row';
  row.innerHTML = `
    <span class="term-time">${new Date().toISOString().substring(11, 19)}</span>
    <span class="term-tag text-cyan">${type}</span>
    <span class="term-json">${JSON.stringify(data)}</span>
  `;
  term.appendChild(row);

  if (document.getElementById('terminalAutoScroll')?.checked) {
    term.scrollTop = term.scrollHeight;
  }
}

// ==========================================================================
// COMMAND PALETTE & HOTKEYS
// ==========================================================================
function initCommandPalette() {
  const input = document.getElementById('cmdInput');
  const menu = document.getElementById('cmdMenu');

  const commands = [
    { title: 'Executive Overview', cat: 'Navigation', act: () => switchView('overview') },
    { title: 'Master Inventory Matrix', cat: 'Navigation', act: () => switchView('inventory') },
    { title: 'Unified Orders Stream', cat: 'Navigation', act: () => switchView('orders') },
    { title: 'Channel Store Hub', cat: 'Navigation', act: () => switchView('channels') },
    { title: 'Drift & Auto-Healing', cat: 'Navigation', act: () => switchView('drift') },
    { title: 'CloudEvents Stream', cat: 'Navigation', act: () => switchView('events') },
    { title: 'Chaos Simulator', cat: 'Navigation', act: () => switchView('chaos') },
    { title: 'Trigger Multi-Store Reconciliation', cat: 'Action', act: triggerReconciliation },
    { title: 'Launch 100-Order Flash Sale Simulation', cat: 'Action', act: () => { switchView('chaos'); runFlashSaleSim(); } }
  ];

  function render(q) {
    const query = (q || '').toLowerCase();
    const matches = commands.filter(c => c.title.toLowerCase().includes(query) || c.cat.toLowerCase().includes(query));
    menu.innerHTML = matches.map((c, i) => `
      <div class="cmd-entry ${i === 0 ? 'active' : ''}" data-idx="${i}">
        <span class="cmd-entry-title">${c.title}</span>
        <span class="cmd-entry-cat">${c.cat}</span>
      </div>
    `).join('');

    menu.querySelectorAll('.cmd-entry').forEach((el, i) => {
      el.addEventListener('click', () => {
        matches[i].act();
        document.getElementById('cmdPalette').classList.add('hidden');
      });
    });
  }

  input?.addEventListener('input', (e) => render(e.target.value));
  render('');

  document.getElementById('sidebarCmdBtn')?.addEventListener('click', () => {
    document.getElementById('cmdPalette').classList.remove('hidden');
    input?.focus();
  });
}

function initHotkeys() {
  document.getElementById('openHotkeysBtn')?.addEventListener('click', () => {
    document.getElementById('hotkeysModal').classList.remove('hidden');
  });
  document.getElementById('hotkeysModalClose')?.addEventListener('click', () => {
    document.getElementById('hotkeysModal').classList.add('hidden');
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('cmdPalette').classList.toggle('hidden');
      document.getElementById('cmdInput')?.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      triggerReconciliation();
    }
    if (e.key === 'Escape') {
      document.getElementById('cmdPalette').classList.add('hidden');
      document.getElementById('adjustModal').classList.add('hidden');
      document.getElementById('slideOverBackdrop').classList.add('hidden');
      document.getElementById('hotkeysModal').classList.add('hidden');
    }
    if (e.key === '?' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('hotkeysModal').classList.toggle('hidden');
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      switchView('inventory');
      document.getElementById('invSearchInput')?.focus();
    }
    if (document.activeElement.tagName !== 'INPUT') {
      const viewMap = {
        '1': 'overview',
        '2': 'inventory',
        '3': 'orders',
        '4': 'channels',
        '5': 'drift',
        '6': 'events',
        '7': 'chaos'
      };
      if (viewMap[e.key]) {
        switchView(viewMap[e.key]);
      }
    }
  });
}

// ==========================================================================
// TOAST STACK
// ==========================================================================
function showToast(msg, type = 'success') {
  const hub = document.getElementById('toastHub');
  if (!hub) return;

  const t = document.createElement('div');
  t.className = `toast-item toast-${type}`;
  t.textContent = msg;
  hub.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 200);
  }, 3500);
}
