const API_BASE = '';

let token = null;

// --- DOM refs ---
const loginHeading = document.getElementById('login-heading');
const loginStatus = document.getElementById('login-status');
const dashboard = document.getElementById('dashboard');
const logEl = document.getElementById('log');

const programSelect = document.getElementById('program-select');
const capacityDisplay = document.getElementById('capacity-display');
const totalLimitEl = document.getElementById('total-limit');
const reservedAmountEl = document.getElementById('reserved-amount');
const availableAmountEl = document.getElementById('available-amount');
const currencyEl = document.getElementById('currency');
const capacityStatus = document.getElementById('capacity-status');

const reserveStatus = document.getElementById('reserve-status');
const releaseStatus = document.getElementById('release-status');

// --- Helpers ---
function log(msg, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const icons = { success: '🟢', warning: '🟠', error: '🔴', info: '🔵' };
  const icon = icons[type] || '🔵';
  logEl.textContent = `[${timestamp}] ${icon} ${msg}\n${logEl.textContent}`;
}

function showStatus(el, msg, type = 'success') {
  el.textContent = msg;
  el.className = `status ${type}`;
}

function clearStatus(el) {
  el.textContent = '';
  el.className = 'status';
}

function formatCents(cents, currency = 'USD') {
  return (cents / 100).toFixed(2) + ' ' + currency;
}

function getSelectedProgram() {
  return programSelect.value;
}

// --- Auto-login ---
async function autoLogin() {
  loginHeading.textContent = '🔐 Authenticating...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    token = data.accessToken;

    loginHeading.textContent = '✅ Authenticated as admin';
    showStatus(loginStatus, 'Authenticated successfully', 'success');
    log('Logged in as "admin" (role: admin)', 'success');
    dashboard.classList.remove('hidden');

    // Auto-fetch capacity on login
    refreshCapacity();
  } catch (err) {
    loginHeading.textContent = '❌ Authentication failed';
    showStatus(loginStatus, `Login failed: ${err.message}`, 'error');
    log(`Login failed: ${err.message}`, 'error');
  }
}

// --- Capacity ---
async function refreshCapacity() {
  const programId = getSelectedProgram();
  if (!programId) return;

  clearStatus(capacityStatus);

  try {
    const res = await fetch(`${API_BASE}/programs/${programId}/capacity`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    totalLimitEl.textContent = formatCents(data.totalLimit, data.currency);
    reservedAmountEl.textContent = formatCents(
      data.reservedAmount,
      data.currency,
    );
    availableAmountEl.textContent = formatCents(
      data.availableAmount,
      data.currency,
    );
    currencyEl.textContent = data.currency;
    capacityDisplay.classList.remove('hidden');

    const pct =
      data.totalLimit > 0
        ? ((data.reservedAmount / data.totalLimit) * 100).toFixed(1)
        : 0;
    log(
      `Capacity: ${formatCents(data.availableAmount, data.currency)} available (${pct}% used)`,
      'info',
    );
  } catch (err) {
    showStatus(capacityStatus, `Failed: ${err.message}`, 'error');
    log(`Capacity fetch failed: ${err.message}`, 'error');
  }
}

document
  .getElementById('get-capacity-btn')
  .addEventListener('click', refreshCapacity);

// --- Reserve ---
document.getElementById('reserve-btn').addEventListener('click', async () => {
  const programId = getSelectedProgram();
  const invoiceId = document.getElementById('invoice-id').value.trim();
  const amount = parseInt(document.getElementById('amount').value, 10);
  const currency = document.getElementById('currency-select').value;

  if (!programId || !invoiceId || !amount) {
    showStatus(reserveStatus, 'Please fill all fields', 'error');
    return;
  }

  clearStatus(reserveStatus);

  try {
    const res = await fetch(`${API_BASE}/programs/${programId}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invoiceId, amount, currency }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showStatus(
      reserveStatus,
      `Reservation created: ${data.reservationId}`,
      'success',
    );
    log(
      `Reserved ${formatCents(amount, currency)} for invoice "${invoiceId}" → ${data.reservationId}`,
      'success',
    );

    // Auto-fill reservation ID for release
    document.getElementById('reservation-id').value = data.reservationId;

    // Refresh capacity and reservations list
    refreshCapacity();
    refreshReservations();
  } catch (err) {
    showStatus(reserveStatus, `Failed: ${err.message}`, 'error');
    log(`Reservation failed: ${err.message}`, 'error');
  }
});

// --- List Active Reservations ---
async function refreshReservations() {
  const programId = getSelectedProgram();
  if (!programId) return;

  const listEl = document.getElementById('reservations-list');
  const statusEl = document.getElementById('reservations-status');

  clearStatus(statusEl);
  listEl.innerHTML = '<p class="muted">Loading...</p>';

  try {
    const res = await fetch(`${API_BASE}/programs/${programId}/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const reservations = await res.json();

    if (reservations.length === 0) {
      listEl.innerHTML =
        '<p class="muted">No active reservations for this program.</p>';
      log('No active reservations found', 'info');
      return;
    }

    listEl.innerHTML = '';
    for (const r of reservations) {
      const item = document.createElement('div');
      item.className = 'reservation-item';
      item.innerHTML = `
        <div class="reservation-info">
          <div class="reservation-detail">
            Invoice: <strong>${r.invoiceId}</strong> — ${(r.amount / 100).toFixed(2)} ${r.currency}
          </div>
          <div class="reservation-id">ID: ${r.id}</div>
        </div>
        <button class="btn warning small release-reservation-btn" data-id="${r.id}">
          Release
        </button>
      `;
      listEl.appendChild(item);
    }

    // Attach click handlers to release buttons
    document.querySelectorAll('.release-reservation-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rid = btn.dataset.id;
        document.getElementById('reservation-id').value = rid;
        document.getElementById('release-btn').click();
        setTimeout(refreshReservations, 500);
      });
    });

    log(
      `Found ${reservations.length} active reservation(s) for program "${programId}"`,
      'info',
    );
  } catch (err) {
    listEl.innerHTML =
      '<p class="muted">Failed to load reservations. Click to retry.</p>';
    showStatus(statusEl, `Failed: ${err.message}`, 'error');
    log(`List reservations failed: ${err.message}`, 'error');
  }
}

document
  .getElementById('list-reservations-btn')
  .addEventListener('click', refreshReservations);

// --- Release ---
document.getElementById('release-btn').addEventListener('click', async () => {
  const programId = getSelectedProgram();
  const reservationId = document.getElementById('reservation-id').value.trim();

  if (!programId || !reservationId) {
    showStatus(releaseStatus, 'Please enter a Reservation ID', 'error');
    return;
  }

  clearStatus(releaseStatus);

  try {
    const res = await fetch(`${API_BASE}/programs/${programId}/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reservationId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showStatus(
      releaseStatus,
      `Released ${formatCents(data.releasedAmount)}`,
      'success',
    );
    log(
      `Released reservation "${reservationId}" — ${formatCents(data.releasedAmount)} freed`,
      'warning',
    );

    // Clear reservation ID field
    document.getElementById('reservation-id').value = '';

    // Refresh capacity
    refreshCapacity();
  } catch (err) {
    showStatus(releaseStatus, `Failed: ${err.message}`, 'error');
    log(`Release failed: ${err.message}`, 'error');
  }
});

// --- Init ---
autoLogin();
