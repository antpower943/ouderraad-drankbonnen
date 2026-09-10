// --- Application State ---
let config = {
  ticket_price: 0.60,
  currency: "€",
  categories: [],
  items: []
};

// Order state stores itemId -> quantity
let currentOrder = {};

// View mode: 'tickets' | 'euro' | 'both'
let viewMode = 'tickets';
let selectedCategory = 'all';

// --- DOM Elements ---
const drinkGrid = document.getElementById('drink-grid');
const categoryNav = document.getElementById('category-nav');
const orderBar = document.getElementById('order-bar');
const drawerContent = document.getElementById('drawer-content');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const drawerChevron = document.getElementById('drawer-chevron');
const orderItemsList = document.getElementById('order-items-list');
const drinkCountBadge = document.getElementById('drink-count-badge');
const totalPrimaryDisplay = document.getElementById('total-primary-display');
const totalSecondaryDisplay = document.getElementById('total-secondary-display');
const btnClear = document.getElementById('btn-clear');
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  initOnlineStatusListener();
  fetchPricesAndInit();
  setupEventListeners();
});

// Register Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker geregistreerd'))
      .catch((err) => console.error('Service Worker registratie mislukt:', err));
  }
}

// Network Status Tracking
function initOnlineStatusListener() {
  function updateOnlineStatus() {
    if (navigator.onLine) {
      statusBadge.classList.remove('offline');
      statusBadge.classList.add('online');
      statusText.textContent = 'Online';
    } else {
      statusBadge.classList.remove('online');
      statusBadge.classList.add('offline');
      statusText.textContent = 'Offline';
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// Fetch Prices JSON
async function fetchPricesAndInit() {
  try {
    const response = await fetch(`./prices.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Netwerk reageerde niet');
    config = await response.json();
  } catch (err) {
    console.warn('Kan prijzen niet ophalen via netwerk, probeer offline cache...', err);
    try {
      const cachedResponse = await fetch('./prices.json');
      config = await cachedResponse.json();
    } catch (cacheErr) {
      console.error('Laden van prices.json mislukt:', cacheErr);
    }
  }

  renderCategories();
  renderDrinkGrid();
  updateTotals();
}

// --- Helper Functions ---
function formatItemPrice(tickets) {
  const euroAmount = (tickets * config.ticket_price).toFixed(2).replace('.', ',');
  
  if (viewMode === 'tickets') {
    return `${tickets} bonnetje${tickets > 1 ? 's' : ''}`;
  } else if (viewMode === 'euro') {
    return `${config.currency} ${euroAmount}`;
  } else {
    return `${tickets} bonnetje${tickets > 1 ? 's' : ''} (${config.currency} ${euroAmount})`;
  }
}

// --- Rendering Functions ---

// Category Tabs
function renderCategories() {
  categoryNav.innerHTML = '<button class="cat-btn active" data-category="all">Alles</button>';
  
  if (config.categories) {
    config.categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.category = cat.id;
      btn.textContent = cat.name;
      categoryNav.appendChild(btn);
    });
  }
}

// Full Drinks Grid Render (only used when switching categories, views, or clearing)
function renderDrinkGrid() {
  drinkGrid.innerHTML = '';

  const filteredItems = selectedCategory === 'all' 
    ? config.items 
    : config.items.filter(item => item.category === selectedCategory);

  filteredItems.forEach((item) => {
    const count = currentOrder[item.id] || 0;
    const card = document.createElement('div');
    card.className = `drink-card ${count > 0 ? 'selected' : ''}`;
    card.dataset.id = item.id;

    const imageHtml = item.image 
      ? `<img src="${item.image}" alt="${item.name}" onerror="this.outerHTML='<div class=\\'placeholder-img\\'>🥤</div>'">` 
      : `<div class="placeholder-img">🥤</div>`;

    const badgeHtml = `<div class="card-badge ${count === 0 ? 'hidden' : ''}">${count}</div>`;
    const formattedPrice = formatItemPrice(item.tickets);

    card.innerHTML = `
      ${badgeHtml}
      ${imageHtml}
      <div class="drink-name">${item.name}</div>
      <div class="drink-tickets">${formattedPrice}</div>
    `;

    drinkGrid.appendChild(card);
  });
}

// Target-update a single card in-place without re-rendering grid
function updateSingleCardInPlace(itemId) {
  const card = drinkGrid.querySelector(`.drink-card[data-id="${itemId}"]`);
  if (!card) return;

  const count = currentOrder[itemId] || 0;
  let badge = card.querySelector('.card-badge');

  if (count > 0) {
    card.classList.add('selected');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'card-badge';
      card.appendChild(badge);
    }
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    card.classList.remove('selected');
    if (badge) {
      badge.classList.add('hidden');
    }
  }
}

// Drawer Selected Items Overview List
function renderOrderList() {
  orderItemsList.innerHTML = '';

  const itemIds = Object.keys(currentOrder).filter(id => currentOrder[id] > 0);

  if (itemIds.length === 0) {
    orderItemsList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 12px 0;">Geen artikelen geselecteerd.</p>';
    return;
  }

  itemIds.forEach((id) => {
    const item = config.items.find(i => i.id === id);
    if (!item) return;

    const count = currentOrder[id];
    const totalItemTickets = item.tickets * count;
    const priceSubtitle = formatItemPrice(totalItemTickets);

    const row = document.createElement('div');
    row.className = 'order-item-row';
    row.innerHTML = `
      <div class="order-item-details">
        <span class="order-item-name">${count}x ${item.name}</span>
        <span class="order-item-sub">${priceSubtitle}</span>
      </div>
      <div class="order-item-actions">
        <button class="btn-counter btn-minus" data-id="${item.id}">-</button>
        <button class="btn-counter btn-plus" data-id="${item.id}">+</button>
        <button class="btn-delete-item" data-id="${item.id}" aria-label="Verwijder item">🗑</button>
      </div>
    `;

    orderItemsList.appendChild(row);
  });
}

// Totals Calculation & Display
function updateTotals() {
  let totalCount = 0;
  let totalTickets = 0;

  Object.keys(currentOrder).forEach((id) => {
    const count = currentOrder[id];
    if (count > 0) {
      const item = config.items.find(i => i.id === id);
      if (item) {
        totalCount += count;
        totalTickets += item.tickets * count;
      }
    }
  });

  const totalEuro = (totalTickets * config.ticket_price).toFixed(2).replace('.', ',');

  drinkCountBadge.textContent = totalCount;

  if (viewMode === 'tickets') {
    totalPrimaryDisplay.textContent = `${totalTickets} bonnetje${totalTickets !== 1 ? 's' : ''}`;
    totalSecondaryDisplay.textContent = `(${config.currency} ${totalEuro})`;
  } else if (viewMode === 'euro') {
    totalPrimaryDisplay.textContent = `${config.currency} ${totalEuro}`;
    totalSecondaryDisplay.textContent = `(${totalTickets} bonnetje${totalTickets !== 1 ? 's' : ''})`;
  } else {
    totalPrimaryDisplay.textContent = `${totalTickets} bonnetje${totalTickets !== 1 ? 's' : ''}`;
    totalSecondaryDisplay.textContent = `${config.currency} ${totalEuro}`;
  }

  renderOrderList();
}

// --- Order Actions ---
function updateQuantity(itemId, delta) {
  const current = currentOrder[itemId] || 0;
  const updated = Math.max(0, current + delta);
  
  if (updated === 0) {
    delete currentOrder[itemId];
  } else {
    currentOrder[itemId] = updated;
  }

  // Update card DOM directly without grid flash
  updateSingleCardInPlace(itemId);
  updateTotals();
}

function deleteItem(itemId) {
  delete currentOrder[itemId];
  updateSingleCardInPlace(itemId);
  updateTotals();
}

function clearOrder() {
  currentOrder = {};
  renderDrinkGrid();
  updateTotals();
}

// --- Event Listeners ---
function setupEventListeners() {
  // Category Navigation Filter
  categoryNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;

    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.dataset.category;
    renderDrinkGrid();
  });

  // Tapping anywhere on a Drink Card increments +1
  drinkGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.drink-card');
    if (card) {
      updateQuantity(card.dataset.id, 1);
    }
  });

  // Quantity adjustments inside the Drawer
  drawerContent.addEventListener('click', (e) => {
    const btnPlus = e.target.closest('.btn-plus');
    const btnMinus = e.target.closest('.btn-minus');
    const btnDelete = e.target.closest('.btn-delete-item');

    if (btnPlus) {
      updateQuantity(btnPlus.dataset.id, 1);
    } else if (btnMinus) {
      updateQuantity(btnMinus.dataset.id, -1);
    } else if (btnDelete) {
      deleteItem(btnDelete.dataset.id);
    }
  });

  // Drawer Toggle
  orderBar.addEventListener('click', toggleDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  // Clear Order Button
  btnClear.addEventListener('click', () => {
    clearOrder();
    closeDrawer();
  });

  // View Mode Toggle (Tickets / Euro / Both)
  const viewToggleContainer = document.getElementById('view-toggle');
  viewToggleContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;

    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    viewMode = btn.dataset.mode;

    renderDrinkGrid();
    updateTotals();
  });
}

function toggleDrawer() {
  const isOpen = drawerContent.classList.contains('open');
  if (isOpen) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

function openDrawer() {
  drawerContent.classList.add('open');
  drawerBackdrop.classList.add('open');
  drawerChevron.classList.add('open');
}

function closeDrawer() {
  drawerContent.classList.remove('open');
  drawerBackdrop.classList.remove('open');
  drawerChevron.classList.remove('open');
}

// --- Screen Wake Lock Management ---
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      updateWakeBadge(true);

      wakeLock.addEventListener('release', () => {
        updateWakeBadge(false);
      });
    } catch (err) {
      console.warn(`Wake Lock request failed: ${err.name}, ${err.message}`);
      updateWakeBadge(false);
    }
  } else {
    console.warn('Screen Wake Lock API not supported on this browser.');
    updateWakeBadge(false);
  }
}

function updateWakeBadge(isActive) {
  const wakeBadge = document.getElementById('wake-badge');
  if (!wakeBadge) return;
  if (isActive) {
    wakeBadge.style.opacity = '1';
    wakeBadge.style.borderColor = '#38bdf8';
  } else {
    wakeBadge.style.opacity = '0.4';
    wakeBadge.style.borderColor = 'transparent';
  }
}

// Re-acquire lock when the app comes back to the foreground or user interacts
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

// Initialize Wake Lock on app load & on first tap (iOS requirement)
document.addEventListener('DOMContentLoaded', () => {
  requestWakeLock();
});

document.addEventListener('click', () => {
  if (!wakeLock) {
    requestWakeLock();
  }
}, { once: false });