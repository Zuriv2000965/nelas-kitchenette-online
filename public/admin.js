let adminPassword = sessionStorage.getItem('adminPassword') || '';
let pendingUploadItem = null; // { categoryName, itemId } for whichever item's photo button was last clicked

function authHeaders() {
  return { 'x-admin-password': adminPassword, 'Content-Type': 'application/json' };
}

const EYE_OPEN_PATH = "M12,4.5C7,4.5 2.73,7.61 1,12c1.73,4.39 6,7.5 11,7.5s9.27,-3.11 11,-7.5c-1.73,-4.39 -6,-7.5 -11,-7.5zM12,17c-2.76,0 -5,-2.24 -5,-5s2.24,-5 5,-5 5,2.24 5,5 -2.24,5 -5,5zM12,9c-1.66,0 -3,1.34 -3,3s1.34,3 3,3 3,-1.34 3,-3 -1.34,-3 -3,-3z";
const EYE_CLOSED_PATH = "M12,7c2.76,0 5,2.24 5,5c0,0.65 -0.13,1.26 -0.36,1.83l2.92,2.92c1.51,-1.26 2.7,-2.89 3.43,-4.75c-1.73,-4.39 -6,-7.5 -11,-7.5c-1.4,0 -2.74,0.25 -3.98,0.7l2.16,2.16C10.74,7.13 11.35,7 12,7zM2,4.27l2.28,2.28l0.46,0.46C3.08,8.3 1.78,10.02 1,12c1.73,4.39 6,7.5 11,7.5c1.55,0 3.03,-0.3 4.38,-0.84l0.42,0.42L19.73,22L21,20.73L3.27,3L2,4.27zM7.53,9.8l1.55,1.55c-0.05,0.21 -0.08,0.43 -0.08,0.65c0,1.66 1.34,3 3,3c0.22,0 0.44,-0.03 0.65,-0.08l1.55,1.55c-0.67,0.33 -1.41,0.53 -2.2,0.53c-2.76,0 -5,-2.24 -5,-5C7,11.21 7.2,10.47 7.53,9.8zM11.84,9.02l3.15,3.15l0.02,-0.16c0,-1.66 -1.34,-3 -3,-3l-0.17,0.01z";

function togglePasswordVisibility() {
  const input = document.getElementById('passwordInput');
  const eyeIcon = document.getElementById('eyeIcon');
  const path = eyeIcon.querySelector('path');
  if (input.type === 'password') {
    input.type = 'text';
    path.setAttribute('d', EYE_CLOSED_PATH);
    eyeIcon.setAttribute('fill', '#FF6B35');
  } else {
    input.type = 'password';
    path.setAttribute('d', EYE_OPEN_PATH);
    eyeIcon.setAttribute('fill', '#9A9184');
  }
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
      itemEl.className = 'itemRow';

      const thumb = document.createElement('img');
      thumb.className = 'itemThumb';
      thumb.src = item.image ? `/${item.image}` : '';
      thumb.onerror = () => { thumb.style.visibility = 'hidden'; };

      const name = document.createElement('span');
      name.className = 'itemName';
      name.textContent = item.name;

      const photoBtn = document.createElement('button');
      photoBtn.className = 'smallBtn photoBtn';
      photoBtn.textContent = '📷 Photo';
      photoBtn.onclick = () => {
        pendingUploadItem = { categoryName: cat.name, itemId: item.id };
        document.getElementById('photoFileInput').click();
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'smallBtn deleteBtn';
      deleteBtn.textContent = '🗑 Delete';
      deleteBtn.onclick = () => deleteItem(cat.name, item.id, item.name);

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'switch';
      toggleLabel.innerHTML = `
        <input type="checkbox" ${item.visible !== false ? 'checked' : ''}>
        <span class="slider"></span>
      `;
      toggleLabel.querySelector('input').onchange = (e) => toggleVisibility(cat.name, item.id, e.target.checked);

      itemEl.appendChild(thumb);
      itemEl.appendChild(name);
      itemEl.appendChild(photoBtn);
      itemEl.appendChild(deleteBtn);
      itemEl.appendChild(toggleLabel);
      catEl.appendChild(itemEl);
    });

    container.appendChild(catEl);
  });
}

async function uploadPhotoForPendingItem(file) {
  if (!pendingUploadItem || !file) return;

  const formData = new FormData();
  formData.append('image', file);
  formData.append('categoryName', pendingUploadItem.categoryName);
  formData.append('itemId', pendingUploadItem.itemId);

  try {
    const res = await fetch('/api/admin/upload-image', {
      method: 'POST',
      headers: { 'x-admin-password': adminPassword }, // no Content-Type — browser sets the multipart boundary itself
      body: formData,
    });
    const result = await res.json();
    if (result.ok) {
      loadMenuTab(); // refresh to show the new photo
    } else {
      alert(result.error || 'Could not upload the photo.');
    }
  } catch (e) {
    alert('Could not reach the server. Please try again.');
  }
}

async function deleteItem(categoryName, itemId, itemName) {
  if (!confirm(`Delete "${itemName}" from the menu? This cannot be undone.`)) return;

  try {
    const res = await fetch('/api/admin/delete-item', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ categoryName, itemId }),
    });
    const result = await res.json();
    if (result.ok) {
      loadMenuTab();
    } else {
      alert(result.error || 'Could not delete the item.');
    }
  } catch (e) {
    alert('Could not reach the server. Please try again.');
  }
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

document.getElementById('photoFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  uploadPhotoForPendingItem(file);
  e.target.value = ''; // reset so choosing the same file again still fires 'change'
});
