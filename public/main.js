let menuData = null;
let selectedCategory = null;
let cart = []; // { itemId, name, unitPrice, quantity, optionLabel }
let appliedCoupon = null;
let currentDetailItem = null;
let currentDetailOption = null;
let detailQty = 1;

function peso(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadMenu() {
  const res = await fetch('/api/menu');
  menuData = await res.json();
  document.getElementById('restaurantName').textContent = menuData.restaurantName || "Nela's Kitchenette";

  if (menuData.offers && menuData.offers.length > 0) {
    const bar = document.getElementById('offersBar');
    bar.textContent = menuData.offers.join('   •   ');
    bar.style.display = 'block';
  }

  renderCategoryBar();
  renderGrid();
}

function renderCategoryBar() {
  const bar = document.getElementById('categoryBar');
  bar.innerHTML = '';
  const categories = ['All', ...menuData.categories.map((c) => c.name)];
  categories.forEach((cat) => {
    const chip = document.createElement('div');
    chip.className = 'categoryChip' + ((cat === 'All' && !selectedCategory) || cat === selectedCategory ? ' active' : '');
    chip.textContent = cat;
    chip.onclick = () => {
      selectedCategory = cat === 'All' ? null : cat;
      renderCategoryBar();
      renderGrid();
    };
    bar.appendChild(chip);
  });
}

function allItemsFlat() {
  const flat = [];
  menuData.categories.forEach((cat) => {
    cat.items.forEach((item) => flat.push({ ...item, category: cat.name }));
  });
  return flat;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const items = allItemsFlat().filter((i) => !selectedCategory || i.category === selectedCategory);

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card';

    const photo = document.createElement('div');
    photo.className = 'cardPhoto';
    if (item.image) {
      photo.style.backgroundImage = `url(${item.image})`;
      photo.style.backgroundSize = 'cover';
      photo.style.backgroundPosition = 'center';
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'addBtn';
    addBtn.textContent = '+';
    addBtn.onclick = (e) => { e.stopPropagation(); onAddTapped(item); };
    photo.appendChild(addBtn);

    const body = document.createElement('div');
    body.className = 'cardBody';
    body.innerHTML = `
      <div class="name">${item.name}</div>
      <div class="price">${peso(item.price)}</div>
      ${item.rating ? `<div class="rating">★ ${item.rating.toFixed(1)}</div>` : ''}
    `;

    card.appendChild(photo);
    card.appendChild(body);
    card.onclick = () => openDetail(item);
    grid.appendChild(card);
  });
}

function onAddTapped(item) {
  if (item.options) {
    openDetail(item);
  } else {
    addToCart(item, null, 1);
  }
}

function openDetail(item) {
  currentDetailItem = item;
  currentDetailOption = item.options ? item.options.choices[0] : null;
  detailQty = 1;

  document.getElementById('detailName').textContent = item.name;
  document.getElementById('detailDescription').textContent = item.description || '';
  document.getElementById('detailQty').textContent = detailQty;

  const optsEl = document.getElementById('detailOptions');
  optsEl.innerHTML = '';
  if (item.options) {
    item.options.choices.forEach((choice) => {
      const chip = document.createElement('div');
      chip.className = 'optChip' + (choice.label === currentDetailOption.label ? ' selected' : '');
      chip.textContent = choice.priceDelta > 0 ? `${choice.label} (+${peso(choice.priceDelta)})` : choice.label;
      chip.onclick = () => { currentDetailOption = choice; openDetail(item); };
      optsEl.appendChild(chip);
    });
  }

  updateDetailAddButton();
  document.getElementById('detailOverlay').style.display = 'flex';
}

function changeDetailQty(delta) {
  detailQty = Math.max(1, detailQty + delta);
  document.getElementById('detailQty').textContent = detailQty;
  updateDetailAddButton();
}

function updateDetailAddButton() {
  const unitPrice = currentDetailItem.price + (currentDetailOption ? currentDetailOption.priceDelta : 0);
  document.getElementById('detailAddBtn').textContent = `Add to Cart • ${peso(unitPrice * detailQty)}`;
}

function confirmAddToCart() {
  addToCart(currentDetailItem, currentDetailOption, detailQty);
  closeOverlay('detailOverlay');
}

function addToCart(item, option, qty) {
  const key = item.id + '::' + (option ? option.label : '');
  const existing = cart.find((l) => l.key === key);
  const unitPrice = item.price + (option ? option.priceDelta : 0);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ key, itemId: item.id, name: item.name, optionLabel: option ? option.label : null, unitPrice, quantity: qty });
  }
  updateCartBar();
}

function updateCartBar() {
  const totalItems = cart.reduce((s, l) => s + l.quantity, 0);
  const bar = document.getElementById('cartBar');
  if (totalItems === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  document.getElementById('cartBarText').textContent = `${totalItems} item(s) • ${peso(cartTotal())}`;
}

function subtotal() {
  return cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
}

function discountAmount() {
  if (!appliedCoupon) return 0;
  return subtotal() * (appliedCoupon.discountPercent / 100);
}

function cartTotal() {
  return Math.max(0, subtotal() - discountAmount());
}

function openCart() {
  renderCartLines();
  document.getElementById('cartOverlay').style.display = 'flex';
}

function renderCartLines() {
  const container = document.getElementById('cartLines');
  container.innerHTML = '';
  cart.forEach((line) => {
    const row = document.createElement('div');
    row.className = 'cartLine';
    row.innerHTML = `
      <div class="lname">${line.name}${line.optionLabel ? ' (' + line.optionLabel + ')' : ''}</div>
      <button class="stepBtn">−</button>
      <span class="qty">${line.quantity}</span>
      <button class="stepBtn">+</button>
      <span class="ltotal">${peso(line.unitPrice * line.quantity)}</span>
    `;
    const buttons = row.querySelectorAll('.stepBtn');
    buttons[0].onclick = () => { changeLineQty(line.key, -1); };
    buttons[1].onclick = () => { changeLineQty(line.key, 1); };
    container.appendChild(row);
  });

  document.getElementById('subtotalText').textContent = peso(subtotal());
  const discountRow = document.getElementById('discountRow');
  if (appliedCoupon) {
    discountRow.style.display = 'flex';
    document.getElementById('discountText').textContent = '-' + peso(discountAmount());
  } else {
    discountRow.style.display = 'none';
  }
  document.getElementById('totalText').textContent = peso(cartTotal());
}

function changeLineQty(key, delta) {
  const line = cart.find((l) => l.key === key);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) {
    cart = cart.filter((l) => l.key !== key);
  }
  renderCartLines();
  updateCartBar();
}

function applyCoupon() {
  const code = document.getElementById('couponInput').value.trim();
  const match = (menuData.coupons || []).find((c) => c.code.toLowerCase() === code.toLowerCase());
  const status = document.getElementById('couponStatus');
  if (match) {
    appliedCoupon = match;
    status.textContent = `Applied ${match.code}: ${match.discountPercent}% off`;
    status.style.color = '#2EC4B6';
  } else {
    appliedCoupon = null;
    status.textContent = 'Invalid coupon code';
    status.style.color = '#E85A2A';
  }
  renderCartLines();
}

let selectedFulfillment = 'pickup';
function selectFulfillment(type) {
  selectedFulfillment = type;
  document.getElementById('optPickup').classList.toggle('selected', type === 'pickup');
  document.getElementById('optDelivery').classList.toggle('selected', type === 'delivery');
}

function goToCheckout() {
  closeOverlay('cartOverlay');
  document.getElementById('checkoutTotalText').textContent = peso(cartTotal());
  document.getElementById('checkoutOverlay').style.display = 'flex';
}

async function placeOrder() {
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('customerAddress').value.trim();

  if (!name || !phone) {
    alert('Please enter your name and phone number.');
    return;
  }
  if (selectedFulfillment === 'delivery' && !address) {
    alert('Please enter a delivery address.');
    return;
  }

  const payload = {
    items: cart.map((l) => ({ name: l.name, option: l.optionLabel, quantity: l.quantity, unitPrice: l.unitPrice })),
    customerName: name,
    phone,
    address: selectedFulfillment === 'delivery' ? address : null,
    fulfillment: selectedFulfillment,
    total: cartTotal(),
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (result.ok) {
      closeOverlay('checkoutOverlay');
      document.getElementById('orderNumberText').textContent = 'Order #' + result.orderNumber;
      document.getElementById('confirmOverlay').style.display = 'flex';
    } else {
      alert(result.error || 'Could not place order.');
    }
  } catch (e) {
    alert('Could not reach the server. Please try again.');
  }
}

function startNewOrder() {
  cart = [];
  appliedCoupon = null;
  updateCartBar();
  closeOverlay('confirmOverlay');
}

function closeOverlay(id) {
  document.getElementById(id).style.display = 'none';
}

loadMenu();
