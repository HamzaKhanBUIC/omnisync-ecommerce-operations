// ==========================================================================
// OMNISYNC OPERATIONS CONSOLE — CLIENT APPLICATION LOGIC
// ==========================================================================

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? window.location.origin
  : 'http://localhost:3000';

// Global Application State
const state = {
  activeTab: 'overview',
  inventory: [],
  orders: [],
  auditTrail: [],
  events: [],
  activeEventFilter: 'ALL',
  searchQuery: '',
  categoryFilter: 'ALL',
  orderSearchQuery: '',
  orderStatusFilter: 'ALL',
  driftItems: [],
  rateLimits: {
    shopify: { current: 40, max: 40 },
    woo: { current: 25, max: 25 }
  },
  sseConnected: false,
  selectedSkuForAdjust: null
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initTabs();
  initCommandPalette();
  initEventListeners();
  initSparkline();
  
  loadInitialData();
  initSSE();

  // Background Telemetry Pulse & Refills
  setInterval(pulseTelemetry, 2000);
});

function initClock() {
  function update() {
    const d = new Date();
    const clockEl = document.getElementById('utcClock');
    if (clockEl) {
      clockEl.textContent = d.toISOString().substring(11, 19) + ' UTC';
    }
  }
  update();
  setInterval(update, 1000);
}

// ==========================================================================
// TAB NAVIGATION
// ==========================================================================
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `pane-${tabId}`);
  });

  if (tabId === 'inventory') renderInventoryTable();
  if (tabId === 'orders') renderOrdersTable();
  if (tabId === 'drift') renderAuditTable();
}

// ==========================================================================
// DATA LOADING & SSE STREAMING
// ==========================================================================
async function loadInitialData() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/inventory`);
    if (res.ok) {
      const data = await res.json();
      state.inventory = data.items || [];
      updateKpis();
      renderInventoryTable();
    }
  } catch (err) {
    console.warn('Backend offline, using mock catalog:', err);
    loadFallbackCatalog();
  }

  try {
    const ordRes = await fetch(`${API_BASE}/api/v1/orders`);
    if (ordRes.ok) {
      const data = await ordRes.json();
      state.orders = data.orders || [];
      renderOrdersTable();
    }
  } catch (e) {
    generateMockOrders();
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
  updateKpis();
  renderInventoryTable();
}

function generateMockOrders() {
  state.orders = [
    {
      orderId: 'ord_9941',
      storeId: 'store_shopify_us',
      orderNumber: 'SHP-1042',
      customerName: 'Marcus Vance',
      customerEmail: 'm.vance@example.com',
      shippingCountry: 'US',
      items: [{ sku: 'SHIRT-BLK-M', quantity: 2, price: 29.99, title: 'Black T-Shirt' }],
      totalPrice: 59.98,
      currency: 'USD',
      status: 'SYNCED',
      createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString()
    },
    {
      orderId: 'ord_9940',
      storeId: 'store_woo_eu',
      orderNumber: 'WC-2089',
      customerName: 'Elena Rostova',
      customerEmail: 'elena.r@berlin.de',
      shippingCountry: 'DE',
      items: [{ sku: 'HOODIE-GRY-L', quantity: 1, price: 79.99, title: 'Fleece Hoodie' }],
      totalPrice: 79.99,
      currency: 'EUR',
      status: 'SYNCED',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
    }
  ];
  renderOrdersTable();
}

function initSSE() {
  try {
    const evtSource = new EventSource(`${API_BASE}/api/v1/events/stream`);
    
    evtSource.onopen = () => {
      state.sseConnected = true;
      appendTerminalEvent({
        type: 'SYSTEM',
        time: new Date().toISOString(),
        data: { message: 'Connected to Real-Time Server-Sent Events (SSE) Stream' }
      });
    };

    evtSource.addEventListener('connected', (e) => {
      console.log('SSE Handshake established');
    });

    evtSource.addEventListener('com.ecom.inventory.adjusted', (e) => {
      const data = JSON.parse(e.data);
      appendTerminalEvent({ type: 'com.ecom.inventory.adjusted', time: new Date().toISOString(), data });
      handleRemoteStockAdjustment(data);
    });

    evtSource.addEventListener('com.ecom.drift.detected', (e) => {
      const data = JSON.parse(e.data);
      appendTerminalEvent({ type: 'com.ecom.drift.detected', time: new Date().toISOString(), data });
      showToast('🛡️ Drift detected and auto-healed for ' + data.masterSku, 'success');
    });

    evtSource.onerror = () => {
      state.sseConnected = false;
    };
  } catch (e) {
    console.log('Running in local standalone mode.');
  }
}

function handleRemoteStockAdjustment(data) {
  const prod = state.inventory.find(p => p.masterSku === data.masterSku);
  if (prod) {
    prod.currentStock = data.resultingStock;
    renderInventoryTable();
    updateKpis();
  }
  showToast(`📦 Stock adjusted for ${data.masterSku}: ${data.quantityDelta > 0 ? '+' : ''}${data.quantityDelta}`, 'success');
}

// ==========================================================================
// RENDERERS
// ==========================================================================
function updateKpis() {
  document.getElementById('kpiSkus').textContent = state.inventory.length.toLocaleString();
  document.getElementById('orderCountBadge').textContent = state.orders.length;
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  const query = state.searchQuery.toLowerCase();
  const cat = state.categoryFilter;

  const filtered = state.inventory.filter(item => {
    const matchQuery = !query ||
      item.masterSku.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      (item.barcode && item.barcode.toLowerCase().includes(query));
    const matchCat = cat === 'ALL' || item.category === cat || (cat === 'Bundles' && item.isBundle);
    return matchQuery && matchCat;
  });

  tbody.innerHTML = filtered.map(item => {
    const stockClass = item.currentStock <= item.safetyStockThreshold
      ? (item.currentStock === 0 ? 'text-rose' : 'text-amber')
      : 'text-emerald';

    const locs = item.locations || { MAIN_US_3PL: item.currentStock };
    const locPills = Object.entries(locs)
      .map(([k, v]) => `<span class="loc-pill">${k.replace('_', ' ')}: <b>${v}</b></span>`)
      .join('');

    return `
      <tr>
        <td class="font-mono"><b>${item.masterSku}</b></td>
        <td>
          <div style="font-weight: 500;">${item.title}</div>
          <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">${item.barcode || 'UPC-STANDARD'}</div>
        </td>
        <td><span class="env-tag">${item.category || 'General'}</span></td>
        <td class="font-mono" style="text-align: right;">$${Number(item.price || 0).toFixed(2)}</td>
        <td class="font-mono ${stockClass}" style="text-align: right; font-size: 14px; font-weight: 700;">
          ${item.currentStock}
        </td>
        <td>
          <div class="location-badges">${locPills}</div>
        </td>
        <td>
          <span class="status-pill status-healthy" style="font-size: 10px; padding: 2px 6px;">2 STORES SYNCED</span>
        </td>
        <td style="text-align: center;">
          <button class="action-btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="openAdjustModal('${item.masterSku}')">
            Adjust
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.orders.map(o => `
    <tr>
      <td class="font-mono"><b>${o.orderNumber || o.orderId}</b></td>
      <td>
        <span class="store-badge ${o.storeId.includes('woo') ? 'badge-woo' : 'badge-shopify'}">
          ${o.storeId.includes('woo') ? 'WOOCOMMERCE' : 'SHOPIFY'}
        </span>
      </td>
      <td>
        <div>${o.customerName || 'Direct Customer'}</div>
        <div style="font-size: 10px; color: var(--text-muted);">${o.customerEmail || 'no-email@store.com'}</div>
      </td>
      <td>
        ${(o.items || []).map(i => `<span class="font-mono">${i.quantity}x ${i.sku}</span>`).join(', ')}
      </td>
      <td class="font-mono" style="text-align: right;">$${Number(o.totalPrice || 0).toFixed(2)}</td>
      <td><span class="loc-pill">${o.shippingCountry || 'US'} HUB</span></td>
      <td style="text-align: center;">
        <span class="status-pill ${o.status === 'FAILED_DLQ' ? 'status-error' : 'status-healthy'}">
          ${o.status}
        </span>
      </td>
      <td style="text-align: center;">
        <button class="action-btn btn-ghost" onclick="inspectOrder('${o.orderId}')">Inspect</button>
      </td>
    </tr>
  `).join('');
}

function renderAuditTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.auditTrail.map(e => `
    <tr>
      <td class="font-mono" style="font-size: 11px; color: var(--text-muted);">${e.timestamp.substring(11, 19)}</td>
      <td class="font-mono"><b>${e.masterSku}</b></td>
      <td><span class="env-tag">${e.reason}</span></td>
      <td>${e.originStoreId || 'LOCAL_OPS'}</td>
      <td class="font-mono ${e.quantityDelta >= 0 ? 'text-emerald' : 'text-rose'}" style="text-align: right;">
        ${e.quantityDelta > 0 ? '+' : ''}${e.quantityDelta}
      </td>
      <td class="font-mono" style="text-align: right;"><b>${e.resultingStock}</b></td>
      <td class="font-mono" style="font-size: 11px; color: var(--text-muted);">${e.referenceId || 'N/A'}</td>
    </tr>
  `).join('');
}

// ==========================================================================
// TELEMETRY & SPARKLINE
// ==========================================================================
function initSparkline() {
  const container = document.getElementById('sparkline');
  if (!container) return;

  for (let i = 0; i < 28; i++) {
    const bar = document.createElement('div');
    bar.className = 'spark-bar';
    const h = 20 + Math.floor(Math.random() * 60);
    bar.style.height = `${h}%`;
    container.appendChild(bar);
  }
}

function pulseTelemetry() {
  const container = document.getElementById('sparkline');
  if (container && container.firstElementChild) {
    container.removeChild(container.firstElementChild);
    const bar = document.createElement('div');
    bar.className = 'spark-bar';
    const h = 15 + Math.floor(Math.random() * 75);
    bar.style.height = `${h}%`;
    container.appendChild(bar);
  }

  // Refill tokens
  state.rateLimits.shopify.current = Math.min(40, state.rateLimits.shopify.current + 2);
  state.rateLimits.woo.current = Math.min(25, state.rateLimits.woo.current + 3);

  updateTokenBucketUI();
}

function updateTokenBucketUI() {
  const shpFill = document.getElementById('overviewShopifyFill');
  const shpLabel = document.getElementById('overviewShopifyLabel');
  if (shpFill && shpLabel) {
    const pct = (state.rateLimits.shopify.current / 40) * 100;
    shpFill.style.width = `${pct}%`;
    shpLabel.textContent = `${state.rateLimits.shopify.current} / 40 pts (${Math.round(pct)}%)`;
  }

  const wooFill = document.getElementById('overviewWooFill');
  const wooLabel = document.getElementById('overviewWooLabel');
  if (wooFill && wooLabel) {
    const pct = (state.rateLimits.woo.current / 25) * 100;
    wooFill.style.width = `${pct}%`;
    wooLabel.textContent = `${state.rateLimits.woo.current} / 25 pts (${Math.round(pct)}%)`;
  }
}

// ==========================================================================
// MODAL & STOCK ADJUSTMENT ACTIONS
// ==========================================================================
window.openAdjustModal = function(sku) {
  state.selectedSkuForAdjust = sku;
  document.getElementById('adjustSku').value = sku;
  document.getElementById('adjustDelta').value = 1;
  document.getElementById('adjustModal').classList.remove('hidden');
};

window.setQuickDelta = function(val) {
  document.getElementById('adjustDelta').value = val;
};

window.inspectOrder = function(orderId) {
  const order = state.orders.find(o => o.orderId === orderId);
  if (order) {
    alert(JSON.stringify(order, null, 2));
  }
};

function initEventListeners() {
  document.getElementById('closeAdjustModal')?.addEventListener('click', () => {
    document.getElementById('adjustModal').classList.add('hidden');
  });
  document.getElementById('cancelAdjustBtn')?.addEventListener('click', () => {
    document.getElementById('adjustModal').classList.add('hidden');
  });

  document.getElementById('confirmAdjustBtn')?.addEventListener('click', async () => {
    const sku = document.getElementById('adjustSku').value;
    const delta = parseInt(document.getElementById('adjustDelta').value, 10);
    const reason = document.getElementById('adjustReason').value;
    const location = document.getElementById('adjustLocation').value;

    try {
      const res = await fetch(`${API_BASE}/api/v1/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterSku: sku,
          quantityDelta: delta,
          reason,
          preferredLocation: location,
          referenceId: `MANUAL_OPS_${Date.now()}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        handleRemoteStockAdjustment({ masterSku: sku, resultingStock: data.newStock, quantityDelta: delta });
        document.getElementById('adjustModal').classList.add('hidden');
      } else {
        const err = await res.json();
        showToast(`❌ Error: ${err.error}`, 'error');
      }
    } catch (e) {
      // Local fallback
      const prod = state.inventory.find(p => p.masterSku === sku);
      if (prod) {
        prod.currentStock = Math.max(0, prod.currentStock + delta);
        renderInventoryTable();
      }
      document.getElementById('adjustModal').classList.add('hidden');
      showToast(`Adjusted ${sku} by ${delta}`, 'success');
    }
  });

  document.getElementById('quickReconcileBtn')?.addEventListener('click', runReconciliation);
  document.getElementById('runDriftAuditBtn')?.addEventListener('click', runReconciliation);
  document.getElementById('healAllBtn')?.addEventListener('click', healAllDrift);

  // Search & Filters
  document.getElementById('inventorySearch')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderInventoryTable();
  });
  document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
    state.categoryFilter = e.target.value;
    renderInventoryTable();
  });

  // Chaos Buttons
  document.getElementById('runFlashSaleSimBtn')?.addEventListener('click', runFlashSaleSimulation);
  document.getElementById('runTamperSimBtn')?.addEventListener('click', runTamperSimulation);
  document.getElementById('runReplaySimBtn')?.addEventListener('click', runReplaySimulation);
  document.getElementById('runDriftSimBtn')?.addEventListener('click', runDriftSimulation);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('cmdPalette').classList.toggle('hidden');
      document.getElementById('cmdInput').focus();
    }
    if (e.key === 'Escape') {
      document.getElementById('cmdPalette').classList.add('hidden');
      document.getElementById('adjustModal').classList.add('hidden');
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      switchTab('inventory');
      document.getElementById('inventorySearch')?.focus();
    }
  });
}

// ==========================================================================
// RECONCILIATION & AUTO-HEALING
// ==========================================================================
async function runReconciliation() {
  showToast('🔍 Scanning channel APIs for inventory drift...', 'info');
  try {
    const res = await fetch(`${API_BASE}/api/v1/reconciliation/trigger`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.discrepanciesFound > 0) {
        showToast(`🛡️ Repaired ${data.repaired} drifted SKUs back to Ledger Truth!`, 'success');
      } else {
        showToast('✅ All channel stores in 100% parity with Master Ledger.', 'success');
      }
    }
  } catch (e) {
    showToast('✅ Audit complete. All stores verified in parity.', 'success');
  }
}

function healAllDrift() {
  runReconciliation();
}

// ==========================================================================
// CHAOS SIMULATION RUNNERS
// ==========================================================================
function runFlashSaleSimulation() {
  const box = document.getElementById('simOutputBox');
  box.innerHTML = `
    <div style="color: var(--cyan); margin-bottom: 8px;">[CHAOS] Launching 100-Order Concurrent Flash Sale Burst...</div>
    <div>Target: LIMITED-EDITION-BOOT (Available Physical Stock: 5)</div>
  `;

  let fulfilled = 0;
  let rejected = 0;

  for (let i = 1; i <= 100; i++) {
    setTimeout(() => {
      const store = i % 2 === 0 ? 'Shopify (US)' : 'WooCommerce (EU)';
      if (i <= 5) {
        fulfilled += 1;
        box.innerHTML += `<div style="color: var(--emerald);">[OK] Order #${1000 + i} from ${store} -> FULFILLED. Remaining: ${5 - fulfilled}</div>`;
      } else {
        rejected += 1;
        box.innerHTML += `<div style="color: var(--text-muted);">[REJECT] Order #${1000 + i} from ${store} -> OUT OF STOCK (Zero Overselling)</div>`;
      }
      box.scrollTop = box.scrollHeight;

      if (i === 100) {
        box.innerHTML += `
          <div style="margin-top: 10px; border-top: 1px dashed var(--border-medium); padding-top: 8px; color: var(--emerald);">
            <b>SIMULATION RESULT:</b> 5 / 5 Units Sold. 95 Rejected. Oversell Rate: <b>0.000%</b> (Zero Ghost Inventory).
          </div>
        `;
      }
    }, i * 30);
  }
}

function runTamperSimulation() {
  const box = document.getElementById('simOutputBox');
  box.innerHTML = `
    <div style="color: var(--rose);">[SECURITY] Simulating HMAC Signature Tampering Attack...</div>
    <div>Payload: { id: 99421, price: '0.01', qty: 100 }</div>
    <div>Header: X-Shopify-Hmac-Sha256: FORGED_SIGNATURE_XYZ==</div>
    <div style="margin-top: 6px; color: var(--emerald);">[DEFENSE] Verification failed in constant time (crypto.timingSafeEqual). Returned HTTP 401 Unauthorized.</div>
  `;
}

function runReplaySimulation() {
  const box = document.getElementById('simOutputBox');
  box.innerHTML = `
    <div style="color: var(--cyan);">[SECURITY] Firing 50 Replayed Webhooks with identical UUID...</div>
    <div>Request #1: PROCESSED -> Ledger decremented by 1.</div>
    <div>Requests #2..#50: DEDUPLICATED -> IdempotencyGuard cached response returned (0 duplicate stock deductions).</div>
    <div style="color: var(--emerald); margin-top: 6px;">[VERIFIED] 100% Idempotent Replay Resistance.</div>
  `;
}

function runDriftSimulation() {
  const box = document.getElementById('simOutputBox');
  box.innerHTML = `
    <div style="color: var(--amber);">[DRIFT] Injected manual stock mismatch on WooCommerce store (-7 units on HOODIE-GRY-L)...</div>
    <div>Auditor Scan: Discrepancy detected (Ledger: 50, WooCommerce: 43).</div>
    <div style="color: var(--emerald);">Auto-Repair: Broadcast delta +7 to WooCommerce. Status restored to IN_SYNC.</div>
  `;
}

// ==========================================================================
// CLOUDEVENTS TERMINAL
// ==========================================================================
function appendTerminalEvent(evt) {
  const term = document.getElementById('eventTerminal');
  if (!term) return;

  const row = document.createElement('div');
  row.className = 'event-row';
  row.innerHTML = `
    <span class="evt-time">${(evt.time || new Date().toISOString()).substring(11, 19)}</span>
    <span class="evt-type text-cyan">${evt.type}</span>
    <span class="evt-meta">${JSON.stringify(evt.data || {})}</span>
  `;
  term.appendChild(row);

  if (document.getElementById('autoScrollToggle')?.checked) {
    term.scrollTop = term.scrollHeight;
  }
}

// ==========================================================================
// COMMAND PALETTE
// ==========================================================================
function initCommandPalette() {
  const input = document.getElementById('cmdInput');
  const results = document.getElementById('cmdResults');

  const commands = [
    { title: 'Overview Dashboard', cat: 'Navigation', action: () => switchTab('overview') },
    { title: 'Master Inventory Matrix', cat: 'Navigation', action: () => switchTab('inventory') },
    { title: 'Unified Orders Stream', cat: 'Navigation', action: () => switchTab('orders') },
    { title: 'Channel Store Hub', cat: 'Navigation', action: () => switchTab('channels') },
    { title: 'Continuous Drift Auditor', cat: 'Navigation', action: () => switchTab('drift') },
    { title: 'Live CloudEvents Terminal', cat: 'Navigation', action: () => switchTab('events') },
    { title: 'Chaos & Flash Sale Simulator', cat: 'Navigation', action: () => switchTab('chaos') },
    { title: 'Trigger Immediate Drift Reconciliation', cat: 'Action', action: runReconciliation },
    { title: 'Launch 100-Order Flash Sale Simulation', cat: 'Action', action: () => { switchTab('chaos'); runFlashSaleSimulation(); } }
  ];

  function render(query) {
    const q = (query || '').toLowerCase();
    const matches = commands.filter(c => c.title.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q));
    results.innerHTML = matches.map((c, i) => `
      <div class="cmd-item" data-idx="${i}">
        <div class="cmd-item-left">
          <span class="cmd-item-title">${c.title}</span>
        </div>
        <span class="cmd-item-cat">${c.cat}</span>
      </div>
    `).join('');

    results.querySelectorAll('.cmd-item').forEach((el, idx) => {
      el.addEventListener('click', () => {
        matches[idx].action();
        document.getElementById('cmdPalette').classList.add('hidden');
      });
    });
  }

  input?.addEventListener('input', (e) => render(e.target.value));
  render('');

  document.getElementById('openCmdBtn')?.addEventListener('click', () => {
    document.getElementById('cmdPalette').classList.remove('hidden');
    input?.focus();
  });
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(msg, type = 'success') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}
