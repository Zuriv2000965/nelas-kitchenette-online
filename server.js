const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MENU_FILE = path.join(__dirname, 'data', 'menu.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

// Set this in your hosting provider's environment variables — never hardcode
// the real password in code you might share or commit publicly.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function requireAdmin(req, res, next) {
  const provided = req.header('x-admin-password');
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Invalid admin password' });
  }
  next();
}

// ---------- Public: menu (only visible categories/items) ----------
app.get('/api/menu', (req, res) => {
  const menu = readJson(MENU_FILE);
  const filtered = {
    restaurantName: menu.restaurantName,
    offers: menu.offers || [],
    coupons: menu.coupons || [],
    categories: (menu.categories || [])
      .filter((c) => c.visible !== false)
      .map((c) => ({
        name: c.name,
        items: (c.items || []).filter((i) => i.visible !== false),
      }))
      .filter((c) => c.items.length > 0),
  };
  res.json(filtered);
});

// ---------- Public: place an order ----------
app.post('/api/orders', (req, res) => {
  const { items, customerName, phone, address, fulfillment, total } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'Cart is empty' });
  }
  if (!customerName || !phone) {
    return res.status(400).json({ ok: false, error: 'Name and phone are required' });
  }

  const orders = readJson(ORDERS_FILE);
  const orderNumber = Math.floor(1000 + Math.random() * 9000);
  const order = {
    orderNumber,
    items,
    customerName,
    phone,
    address: address || null,
    fulfillment: fulfillment || 'pickup',
    total,
    status: 'received',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  writeJson(ORDERS_FILE, orders);

  res.json({ ok: true, orderNumber });
});

// ---------- Admin: full menu (including hidden items) ----------
app.get('/api/admin/menu', requireAdmin, (req, res) => {
  res.json(readJson(MENU_FILE));
});

// ---------- Admin: toggle a category's or item's visibility ----------
app.post('/api/admin/toggle', requireAdmin, (req, res) => {
  const { categoryName, itemId, visible } = req.body;
  const menu = readJson(MENU_FILE);

  const category = (menu.categories || []).find((c) => c.name === categoryName);
  if (!category) {
    return res.status(404).json({ ok: false, error: 'Category not found' });
  }

  if (itemId) {
    const item = (category.items || []).find((i) => i.id === itemId);
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    item.visible = visible;
  } else {
    category.visible = visible;
  }

  writeJson(MENU_FILE, menu);
  res.json({ ok: true });
});

// ---------- Admin: view received orders ----------
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = readJson(ORDERS_FILE);
  res.json(orders.slice().reverse()); // newest first
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Nela's Kitchenette online server running on port ${PORT}`);
});
