let adminPassword = sessionStorage.getItem('adminPassword') || '';
let pendingUploadItem = null; // { categoryName, itemId } for whichever item's photo button was last clicked
let currentMenu = null; // cached full menu, refreshed on every loadMenuTab()
let editingItem = null; // { categoryName, itemId } while the item modal is open for an edit, null when adding

function authHeaders() {
  return { 'x-admin-password': adminPassword, 'Content-Type': 'application/json' };
}

function togglePasswordVisibility() {
  const input = document.getElementById('passwordInput');
  const eyeIcon = document.getElementById('eyeIcon');
  const path = eyeIcon.querySelector('path');
  const EYE_OPEN_PATH = "M12,4.5C7,4.5 2.73,7.61 1,12c1.73,4.39 6,7.5 11,7.5s9.27,-3.11 11,-7.5c-1.73,-4.39 -6,-7.5 -11,-7.5zM12,17c-2.76,0 -5,-2.24 -5,-5s2.24,-5 5,-5 5,2.24 5,5 -2.24,5 -5,5zM12,9c-1.66,0 -3,1.34 -3,3s1.34,3 3,3 3,-1.34 3,-3 -1.34,-3 -3,-3z";
  const EYE_CLOSED_PATH = "M12,7c2.76,0 5,2.24 5,5c0,0.65 -0.13,1.26 -0.36,1.83l2.92,2.92c1.51,-1.26 2.7,-2.89 3.43,-4.75c-1.73,-4.39 -6,-7.5 -11,-7.5c-1.4,0 -2.74,0.25 -3.98,0.7l2.16,2.16C10.74,7.13 11.35,7 12,7zM2,4.27l2.28,2.28l0.46,0.46C3.08,8.3 1.78,10.02 1,12c1.73,4.39 6,7.5 11,7.5c1.55,0 3.03,-0.3 4.38,-0.84l0.42,0.42L19.73,22L21,20.73L3.27,3L2,4.27zM7.53,9.8l1.55,1.55c-0.05,0.21 -0.08,0.43 -0.08,0.65c0,1.66 1.34,3 3,3c0.22,0 0.44,-0.03 0.65,-0.08l1.55,1.55c-0.67,0.33 -1.41,0.53 -2.2,0.53c-2.76,0 -5,-2.24 -5,-5C7,11.21 7.2,10.47 7.53,9.8zM11.84,9.02l3.15,3.15l0.02,-0.16c0,-1.66 -1.34,-3 -3,-3l-0.17,0.01z";
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
  document.getElementById('tabSettings').classList.toggle('active', tab === 'settings');
  document.getElementById('tabOrders').classList.toggle('active', tab === 'orders');
  document.getElementById('menuTab').style.display = tab === 'menu' ? 'block' : 'none';
  document.getElementById('settingsTab').style.display = tab === 'settings' ? 'block' : 'none';
  document.getElementById('ordersTab').style.display = tab === 'orders' ? 'block' : 'none';
  if (tab === 'orders') loadOrdersTab();
  if (tab === 'settings') loadSettingsTab();
}

// ==================== MENU TAB ====================

async function loadMenuTab() {
  const res = await fetch('/api/admin/menu', { headers: authHeaders() });
  currentMenu = await res.json();
  renderMenuTab();
}

function renderMenuTab() {
  const container = document.getElementById('menuTab');
  container.innerHTML = '';

  const addCategoryRow = document.createElement('div');
  addCategoryRow.className = 'addBtnRow';
  addCategoryRow.innerHTML = `<button class="addBtn" onclick="addCategory()">+ Add Category</button>`;
  container.appendChild(addCategoryRow);

  currentMenu.categories.forEach((cat) => {
    const catEl = document.createElement('div');
    catEl.className = 'category';

    const header = document.createElement('div');
    header.className = 'categoryHeader';

    const left = document.createElement('div');
    left.className = 'categoryHeaderLeft';
    left.innerHTML = `<span>${cat.name}</span>`;
    header.appendChild(left);

    const renameBtn = document.createElement('button');
    renameBtn.className = 'smallBtn editBtn';
    renameBtn.textContent = '✏️ Rename';
    renameBtn.onclick = () => renameCategory(cat.name);

    const deleteCatBtn = document.createElement('button');
    deleteCatBtn.className = 'smallBtn deleteBtn';
    deleteCatBtn.textContent = '🗑 Delete Category';
    deleteCatBtn.onclick = () => deleteCategory(cat.name);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'switch';
    toggleLabel.innerHTML = `
      <input type="checkbox" ${cat.visible !== false ? 'checked' : ''}>
      <span class="slider"></span>
    `;
    toggleLabel.querySelector('input').onchange = (e) => toggleVisibility(cat.name, null, e.target.checked);

    header.appendChild(renameBtn);
    header.appendChild(deleteCatBtn);
    header.appendChild(toggleLabel);
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
      name.innerHTML = `${item.name} <span class="itemPrice">₱${Number(item.price).toFixed(2)}</span>`;

      const photoBtn = document.createElement('button');
      photoBtn.className = 'smallBtn photoBtn';
      photoBtn.textContent = '📷 Photo';
      photoBtn.onclick = () => {
        pendingUploadItem = { categoryName: cat.name, itemId: item.id };
        document.getElementById('photoFileInput').click();
      };

      const editBtn = document.createElement('button');
      editBtn.className = 'smallBtn editBtn';
      editBtn.textContent = '✏️ Edit';
      editBtn.onclick = () => openEditItemModal(cat.name, item);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'smallBtn deleteBtn';
      deleteBtn.textContent = '🗑 Delete';
      deleteBtn.onclick = () => deleteItem(cat.name, item.id, item.name);

      const toggleItemLabel = document.createElement('label');
      toggleItemLabel.className = 'switch';
      toggleItemLabel.innerHTML = `
        <input type="checkbox" ${item.visible !== false ? 'checked' : ''}>
        <span class="slider"></span>
      `;
      toggleItemLabel.querySelector('input').onchange = (e) => toggleVisibility(cat.name, item.id, e.target.checked);

      itemEl.appendChild(thumb);
      itemEl.appendChild(name);
      itemEl.appendChild(photoBtn);
      itemEl.appendChild(editBtn);
      itemEl.appendChild(deleteBtn);
      itemEl.appendChild(toggleItemLabel);
      catEl.appendChild(itemEl);
    });

    const addItemRow = document.createElement('div');
    addItemRow.className = 'addBtnRow';
    addItemRow.innerHTML = `<button class="addBtn" onclick="openAddItemModal('${cat.name.replace(/'/g, "\\'")}')">+ Add Item</button>`;
    catEl.appendChild(addItemRow);

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

async function addCategory() {
  const name = prompt('New category name:');
  if (!name || !name.trim()) return;

  const res = await fetch('/api/admin/save-category', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ newName: name.trim() }),
  });
  const result = await res.json();
  if (result.ok) {
    loadMenuTab();
  } else {
    alert(result.error || 'Could not add category.');
  }
}

async function renameCategory(oldName) {
  const newName = prompt('Rename category to:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const res = await fetch('/api/admin/save-category', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ oldName, newName: newName.trim() }),
  });
  const result = await res.json();
  if (result.ok) {
    loadMenuTab();
  } else {
    alert(result.error || 'Could not rename category.');
  }
}

async function deleteCategory(categoryName) {
  if (!confirm(`Delete the entire "${categoryName}" category and everything in it? This cannot be undone.`)) return;

  const res = await fetch('/api/admin/delete-category', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ categoryName }),
  });
  const result = await res.json();
  if (result.ok) {
    loadMenuTab();
  } else {
    alert(result.error || 'Could not delete category.');
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

// ==================== ITEM ADD/EDIT MODAL ====================

function openAddItemModal(categoryName) {
  editingItem = { categoryName, itemId: null };
  document.getElementById('itemModalTitle').textContent = 'Add Item';
  document.getElementById('itemNameInput').value = '';
  document.getElementById('itemDescInput').value = '';
  document.getElementById('itemPriceInput').value = '';
  document.getElementById('itemHasOptions').checked = false;
  document.getElementById('optionGroupNameInput').value = '';
  document.getElementById('choicesContainer').innerHTML = '';
  toggleOptionsEditor();
  document.getElementById('itemModalOverlay').style.display = 'flex';
}

function openEditItemModal(categoryName, item) {
  editingItem = { categoryName, itemId: item.id };
  document.getElementById('itemModalTitle').textContent = 'Edit Item';
  document.getElementById('itemNameInput').value = item.name;
  document.getElementById('itemDescInput').value = item.description || '';
  document.getElementById('itemPriceInput').value = item.price;

  const hasOptions = !!item.options;
  document.getElementById('itemHasOptions').checked = hasOptions;
  document.getElementById('optionGroupNameInput').value = hasOptions ? item.options.name : '';
  document.getElementById('choicesContainer').innerHTML = '';
  if (hasOptions) {
    item.options.choices.forEach((c) => addChoiceRow(c.label, c.priceDelta));
  }
  toggleOptionsEditor();
  document.getElementById('itemModalOverlay').style.display = 'flex';
}

function closeItemModal() {
  document.getElementById('itemModalOverlay').style.display = 'none';
  editingItem = null;
}

function toggleOptionsEditor() {
  const has = document.getElementById('itemHasOptions').checked;
  document.getElementById('optionsEditor').style.display = has ? 'block' : 'none';
  if (has && document.getElementById('choicesContainer').children.length === 0) {
    addChoiceRow('', 0);
  }
}

function addChoiceRow(label, priceDelta) {
  const container = document.getElementById('choicesContainer');
  const row = document.createElement('div');
  row.className = 'choiceRow';
  row.innerHTML = `
    <input class="field choiceLabelInput" placeholder="Choice (e.g. Large)" value="${label ? label.replace(/"/g, '&quot;') : ''}">
    <input class="field choicePriceInput" type="number" step="0.01" placeholder="+₱" value="${priceDelta || 0}">
    <button type="button" class="removeChoiceBtn" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

async function saveItemModal() {
  const name = document.getElementById('itemNameInput').value.trim();
  const description = document.getElementById('itemDescInput').value.trim();
  const price = document.getElementById('itemPriceInput').value;

  if (!name) {
    alert('Please enter an item name.');
    return;
  }
  if (price === '' || Number.isNaN(Number(price))) {
    alert('Please enter a valid price.');
    return;
  }

  let optionGroup = null;
  if (document.getElementById('itemHasOptions').checked) {
    const groupName = document.getElementById('optionGroupNameInput').value.trim() || 'Options';
    const choices = [];
    document.querySelectorAll('#choicesContainer .choiceRow').forEach((row) => {
      const label = row.querySelector('.choiceLabelInput').value.trim();
      const priceDelta = Number(row.querySelector('.choicePriceInput').value) || 0;
      if (label) choices.push({ label, priceDelta });
    });
    if (choices.length > 0) {
      optionGroup = { name: groupName, choices };
    }
  }

  const res = await fetch('/api/admin/save-item', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      categoryName: editingItem.categoryName,
      itemId: editingItem.itemId,
      name,
      description,
      price: Number(price),
      optionGroup,
    }),
  });
  const result = await res.json();
  if (result.ok) {
    closeItemModal();
    loadMenuTab();
  } else {
    alert(result.error || 'Could not save the item.');
  }
}

// ==================== PHOTO UPLOAD ====================

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

// ==================== STORE SETTINGS TAB ====================

async function loadSettingsTab() {
  const res = await fetch('/api/admin/menu', { headers: authHeaders() });
  currentMenu = await res.json();
  renderSettingsTab();
}

function renderSettingsTab() {
  const container = document.getElementById('settingsTab');
  container.innerHTML = '';

  // --- Restaurant name ---
  const nameSection = document.createElement('div');
  nameSection.className = 'settingsSection';
  nameSection.innerHTML = `
    <h2>Restaurant Name</h2>
    <input class="field" id="restaurantNameInput" value="${(currentMenu.restaurantName || '').replace(/"/g, '&quot;')}">
  `;
  container.appendChild(nameSection);

  // --- Offers ---
  const offersSection = document.createElement('div');
  offersSection.className = 'settingsSection';
  offersSection.innerHTML = `<h2>Offers Banner</h2><div id="offersListContainer"></div>
    <button type="button" class="addSmallLink" onclick="addOfferRow('')">+ Add Offer</button>`;
  container.appendChild(offersSection);
  (currentMenu.offers || []).forEach((offer) => addOfferRow(offer));

  // --- Coupons ---
  const couponsSection = document.createElement('div');
  couponsSection.className = 'settingsSection';
  couponsSection.innerHTML = `<h2>Coupon Codes</h2><div id="couponsListContainer"></div>
    <button type="button" class="addSmallLink" onclick="addCouponRow('', '')">+ Add Coupon</button>`;
  container.appendChild(couponsSection);
  (currentMenu.coupons || []).forEach((c) => addCouponRow(c.code, c.discountPercent));

  // --- Save button ---
  const saveRow = document.createElement('div');
  saveRow.className = 'addBtnRow';
  saveRow.innerHTML = `<button class="addBtn" onclick="saveStoreSettings()">Save All Store Settings</button>`;
  container.appendChild(saveRow);
}

function addOfferRow(text) {
  const container = document.getElementById('offersListContainer');
  const row = document.createElement('div');
  row.className = 'listRow';
  row.innerHTML = `
    <input class="field offerInput" value="${text ? text.replace(/"/g, '&quot;') : ''}" placeholder="e.g. 10% off with code SAVE10">
    <button type="button" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

function addCouponRow(code, discountPercent) {
  const container = document.getElementById('couponsListContainer');
  const row = document.createElement('div');
  row.className = 'listRow couponRow';
  row.innerHTML = `
    <input class="field couponCodeInput" value="${code ? code.replace(/"/g, '&quot;') : ''}" placeholder="Code (e.g. SAVE10)">
    <input class="field couponPercentInput" type="number" value="${discountPercent || ''}" placeholder="% off">
    <button type="button" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

async function saveStoreSettings() {
  const restaurantName = document.getElementById('restaurantNameInput').value.trim();

  const offers = [];
  document.querySelectorAll('#offersListContainer .offerInput').forEach((input) => {
    if (input.value.trim()) offers.push(input.value.trim());
  });

  const coupons = [];
  document.querySelectorAll('#couponsListContainer .couponRow').forEach((row) => {
    const code = row.querySelector('.couponCodeInput').value.trim();
    const discountPercent = Number(row.querySelector('.couponPercentInput').value) || 0;
    if (code) coupons.push({ code, discountPercent });
  });

  const res = await fetch('/api/admin/update-store-settings', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ restaurantName, offers, coupons }),
  });
  const result = await res.json();
  if (result.ok) {
    alert('Store settings saved.');
  } else {
    alert(result.error || 'Could not save store settings.');
  }
}

// ==================== ORDERS TAB ====================

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
