let adminPassword = sessionStorage.getItem('adminPassword') || '';

function authHeaders() {
  return { 'x-admin-password': adminPassword, 'Content-Type': 'application/json' };
}

async function login() {
  adminPassword = document.getElementById('passwordInput').value;
  const res = await fetch('/api/admin/menu', { headers: authHeaders() });
  if (res.ok) {
    sessionStorage.setItem('adminPassword', adminPassword);
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    loadMenuTab();
  } else {
    document.getElementById('loginError').textContent = 'Incorrect password.';
  }
}

function showTab(tab) {
  document.getElementById('tabMenu').classList.toggle('active', tab === 'menu');
  document.getElementById('tabOrders').classList.toggle('active', tab === 'orders');
  document.getElementById('menuTab').style.display = tab === 'menu' ? 'block' : 'none';
  document.getElementById('ordersTab').style.display = tab === 'orders' ? 'block' : 'none';
  if (tab === 'orders') loadOrdersTab();
}

async function loadMenuTab() {
  const res = await fetch('/api/admin/menu', { headers: authHeaders() });
  const menu = await res.json();
  const container = document.getElementById('menuTab');
  container.innerHTML = '';

  menu.categories.forEach((cat) => {
    const catEl = document.createElement('div');
    catEl.className = 'category';

    const header = document.createElement('div');
    header.className = 'categoryHeader';
    header.innerHTML = `
      <span>${cat.name}</span>
      <label class="switch">
        <input type="checkbox" ${cat.visible !== false ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    `;
    header.querySelector('input').onchange = (e) => toggleVisibility(cat.name, null, e.target.checked);
    catEl.appendChild(header);

    cat.items.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'item';
      itemEl.innerHTML = `
        <span>${item.name}</span>
        <label class="switch">
          <input type="checkbox" ${item.visible !== false ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      `;
      itemEl.querySelector('input').onchange = (e) => toggleVisibility(cat.name, item.id, e.target.checked);
      catEl.appendChild(itemEl);
    });

    container.appendChild(catEl);
  });
}

async function toggleVisibility(categoryName, itemId, visible) {
  await fetch('/api/admin/toggle', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ categoryName, itemId, visible }),
  });
}

async function loadOrdersTab() {
  const res = await fetch('/api/admin/orders', { headers: authHeaders() });
  const orders = await res.json();
  const container = document.getElementById('ordersTab');
  container.innerHTML = '';

  if (orders.length === 0) {
    container.innerHTML = '<p style="color:#9A9184;">No orders yet.</p>';
    return;
  }

  orders.forEach((order) => {
    const el = document.createElement('div');
    el.className = 'orderCard';
    const itemsHtml = order.items.map((i) => `<div class="line">${i.quantity} × ${i.name}${i.option ? ' (' + i.option + ')' : ''}</div>`).join('');
    el.innerHTML = `
      <div class="num">Order #${order.orderNumber}</div>
      <div class="meta">${order.customerName} • ${order.phone} • ${order.fulfillment}${order.address ? ' — ' + order.address : ''}</div>
      <div class="meta">${new Date(order.createdAt).toLocaleString()}</div>
      ${itemsHtml}
      <div class="line" style="font-weight:bold;margin-top:6px;">Total: ₱${Number(order.total).toFixed(2)}</div>
    `;
    container.appendChild(el);
  });
}

// Auto-login if a password was already saved this session
if (adminPassword) {
  login();
}
