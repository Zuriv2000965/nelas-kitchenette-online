const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SEED_MENU_FILE = path.join(__dirname, 'data', 'menu.json'); // used only to seed a brand-new database
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Set these in your hosting provider's environment variables — never hardcode
// real credentials in code you might share or commit publicly.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set. The server cannot start without it.');
  process.exit(1);
}

let menuCollection;
let ordersCollection;
const MENU_DOC_ID = 'main'; // the whole menu is stored as a single document with this fixed id

async function connectToDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('nelas_kitchenette');
  menuCollection = db.collection('menu');
  ordersCollection = db.collection('orders');

  // Seed the database with the starter menu the very first time it's ever run,
  // so the site isn't empty on a brand-new database.
  const existing = await menuCollection.findOne({ _id: MENU_DOC_ID });
  if (!existing) {
    const seedData = JSON.parse(fs.readFileSync(SEED_MENU_FILE, 'utf8'));
    await menuCollection.insertOne({ _id: MENU_DOC_ID, ...seedData });
    console.log('Seeded a brand-new database with the starter menu.');
  }

  console.log('Connected to MongoDB.');
}

async function getMenu() {
  const doc = await menuCollection.findOne({ _id: MENU_DOC_ID });
  return doc;
}

async function saveMenu(menu) {
  const { _id, ...rest } = menu;
  await menuCollection.replaceOne({ _id: MENU_DOC_ID }, { _id: MENU_DOC_ID, ...rest });
}

function requireAdmin(req, res, next) {
  const provided = req.header('x-admin-password');
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Invalid admin password' });
  }
  next();
}

// ---------- Image upload configuration ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const itemId = (req.body.itemId || 'item').replace(/[^a-zA-Z0-9-_]/g, '');
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${itemId}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});
// NOTE: uploaded photo FILES still live on Render's disk, which resets on restart —
// only the menu/orders DATA is now permanently stored in MongoDB. See README for
// the follow-up needed (e.g. Cloudinary) to make photos permanent too.

// ---------- Public: menu (only visible categories/items) ----------
app.get('/api/menu', async (req, res) => {
  const menu = await getMenu();
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
app.post('/api/orders', async (req, res) => {
  const { items, customerName, phone, address, fulfillment, total } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'Cart is empty' });
  }
  if (!customerName || !phone) {
    return res.status(400).json({ ok: false, error: 'Name and phone are required' });
  }

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
  await ordersCollection.insertOne(order);

  res.json({ ok: true, orderNumber });
});

// ---------- Admin: full menu (including hidden items) ----------
app.get('/api/admin/menu', requireAdmin, async (req, res) => {
  res.json(await getMenu());
});

// ---------- Admin: toggle a category's or item's visibility ----------
app.post('/api/admin/toggle', requireAdmin, async (req, res) => {
  const { categoryName, itemId, visible } = req.body;
  const menu = await getMenu();

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

  await saveMenu(menu);
  res.json({ ok: true });
});

// ---------- Admin: upload/replace an item's photo ----------
app.post('/api/admin/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  const { categoryName, itemId } = req.body;
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No image file received' });
  }

  const menu = await getMenu();
  const category = (menu.categories || []).find((c) => c.name === categoryName);
  const item = category && (category.items || []).find((i) => i.id === itemId);

  if (!item) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ ok: false, error: 'Item not found' });
  }

  if (item.image && item.image.startsWith('uploads/')) {
    const oldPath = path.join(__dirname, 'public', item.image);
    fs.unlink(oldPath, () => {});
  }

  item.image = `uploads/${req.file.filename}`;
  await saveMenu(menu);

  res.json({ ok: true, image: item.image });
});

// ---------- Admin: delete a menu item entirely ----------
app.post('/api/admin/delete-item', requireAdmin, async (req, res) => {
  const { categoryName, itemId } = req.body;
  const menu = await getMenu();

  const category = (menu.categories || []).find((c) => c.name === categoryName);
  if (!category) {
    return res.status(404).json({ ok: false, error: 'Category not found' });
  }

  const itemIndex = (category.items || []).findIndex((i) => i.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ ok: false, error: 'Item not found' });
  }

  const [removed] = category.items.splice(itemIndex, 1);

  if (removed.image && removed.image.startsWith('uploads/')) {
    fs.unlink(path.join(__dirname, 'public', removed.image), () => {});
  }

  await saveMenu(menu);
  res.json({ ok: true });
});

// ---------- Admin: add a new category, or rename an existing one ----------
app.post('/api/admin/save-category', requireAdmin, async (req, res) => {
  const { oldName, newName } = req.body;
  const trimmedNewName = (newName || '').trim();

  if (!trimmedNewName) {
    return res.status(400).json({ ok: false, error: 'Category name cannot be empty' });
  }

  const menu = await getMenu();
  menu.categories = menu.categories || [];

  if (oldName) {
    const category = menu.categories.find((c) => c.name === oldName);
    if (!category) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }
    category.name = trimmedNewName;
  } else {
    if (menu.categories.some((c) => c.name === trimmedNewName)) {
      return res.status(400).json({ ok: false, error: 'A category with that name already exists' });
    }
    menu.categories.push({ name: trimmedNewName, visible: true, items: [] });
  }

  await saveMenu(menu);
  res.json({ ok: true });
});

// ---------- Admin: delete an entire category (and everything in it) ----------
app.post('/api/admin/delete-category', requireAdmin, async (req, res) => {
  const { categoryName } = req.body;
  const menu = await getMenu();

  const index = (menu.categories || []).findIndex((c) => c.name === categoryName);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: 'Category not found' });
  }

  const [removed] = menu.categories.splice(index, 1);

  (removed.items || []).forEach((item) => {
    if (item.image && item.image.startsWith('uploads/')) {
      fs.unlink(path.join(__dirname, 'public', item.image), () => {});
    }
  });

  await saveMenu(menu);
  res.json({ ok: true });
});

// ---------- Admin: add a new item, or edit an existing one ----------
app.post('/api/admin/save-item', requireAdmin, async (req, res) => {
  const { categoryName, itemId, name, description, price, optionGroup } = req.body;
  const trimmedName = (name || '').trim();

  if (!trimmedName) {
    return res.status(400).json({ ok: false, error: 'Item name cannot be empty' });
  }
  const parsedPrice = Number(price);
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid price' });
  }

  const menu = await getMenu();
  const category = (menu.categories || []).find((c) => c.name === categoryName);
  if (!category) {
    return res.status(404).json({ ok: false, error: 'Category not found' });
  }
  category.items = category.items || [];

  if (itemId) {
    const item = category.items.find((i) => i.id === itemId);
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    item.name = trimmedName;
    item.description = description || '';
    item.price = parsedPrice;
    if (optionGroup) {
      item.options = optionGroup;
    } else {
      delete item.options;
    }
  } else {
    const newId = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
    const newItem = {
      id: newId,
      name: trimmedName,
      description: description || '',
      price: parsedPrice,
      image: '',
      visible: true,
    };
    if (optionGroup) newItem.options = optionGroup;
    category.items.push(newItem);
  }

  await saveMenu(menu);
  res.json({ ok: true });
});

// ---------- Admin: update restaurant name, offers banner, and coupon codes ----------
app.post('/api/admin/update-store-settings', requireAdmin, async (req, res) => {
  const { restaurantName, offers, coupons } = req.body;
  const menu = await getMenu();

  if (typeof restaurantName === 'string' && restaurantName.trim()) {
    menu.restaurantName = restaurantName.trim();
  }
  if (Array.isArray(offers)) {
    menu.offers = offers.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim());
  }
  if (Array.isArray(coupons)) {
    menu.coupons = coupons
      .filter((c) => c && c.code && c.code.trim())
      .map((c) => ({ code: c.code.trim(), discountPercent: Number(c.discountPercent) || 0 }));
  }

  await saveMenu(menu);
  res.json({ ok: true });
});

// ---------- Admin: view received orders ----------
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const orders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray();
  res.json(orders);
});

const PORT = process.env.PORT || 4000;

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Nela's Kitchenette online server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
