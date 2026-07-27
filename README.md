# Nela's Kitchenette — Online Ordering

A real internet-facing ordering website for Nela's Kitchenette, plus an admin
page to control which categories/items are visible to customers online.

This is a separate project from the Android tablet app — it's a small
Node.js web server + website, meant to be deployed somewhere on the internet
(not run on the tablet itself, since a tablet can't reliably serve public
internet traffic).

## What's included

- **Public ordering website** (`/`) — customers browse the menu, customize
  items (sizes, etc.), add to cart, apply coupons, and check out (pickup,
  dine-in, or delivery), landing on an order confirmation screen.
- **Admin page** (`/admin.html`) — password-protected. Add/rename/delete
  categories, add/edit/delete menu items (including size/customization
  options), upload photos, toggle visibility, edit the restaurant name/offers/
  coupons, and view all orders that have come in.
- **Backend API** (Express/Node.js) serving both, storing menu + orders data
  permanently in **MongoDB Atlas** (a free cloud database).

## Running it locally (to test before deploying)

You'll need [Node.js](https://nodejs.org) installed (version 18 or newer),
and a MongoDB Atlas connection string (see "Setting up MongoDB" below if you
don't have one yet).

```bash
cd NelasKitchenetteOnline
npm install
```

Before running it, set two environment variables. On Windows PowerShell:

```powershell
$env:MONGODB_URI="your connection string here"
$env:ADMIN_PASSWORD="choose a real password"
npm start
```

(On Mac/Linux, use `export MONGODB_URI="..."` instead of `$env:...=`.)

Then open **http://localhost:4000** in a browser for the customer site, and
**http://localhost:4000/admin.html** for the admin page.

(This runs on port 4000 by default — chosen specifically so it doesn't clash
with XAMPP/Apache, which commonly runs on port 3000 or 80.)

## Setting up MongoDB (one-time, free)

1. Create a free account at **mongodb.com/cloud/atlas**
2. Create a free "Free" tier cluster (no cost, never expires)
3. Under **Database Access**, create a database user (username + password)
4. Under **Network Access**, add `0.0.0.0/0` ("Allow Access from Anywhere") —
   needed since Render's servers don't have a fixed IP address
5. Click **Connect → Drivers → Node.js**, copy the connection string, and
   replace `<password>` in it with your actual database user's password

That connection string is what goes into `MONGODB_URI` below. **Never commit
it directly into code you share or push to GitHub** — it belongs in
environment variables only, both locally and on your hosting provider.

The first time the server ever connects to a brand-new, empty database, it
automatically seeds it with the starter menu from `data/menu.json` — after
that, all edits live in MongoDB, not in that file.

## Deploying it to the real internet

You'll need to create a free account with a hosting provider — this part
can't be done from within this chat, since it requires your own account and
a live deployment step on your end. Here's a straightforward option:

### Using Render.com (recommended — has a genuinely free tier for small projects)

1. Create a free account at **render.com**
2. Push this project folder to a GitHub repository (or use Render's option to
   deploy from a zip/local folder if offered)
3. In Render, click **New → Web Service**, connect your repo
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `ADMIN_PASSWORD` = (choose a real password — don't use the default)
   - `MONGODB_URI` = (your full MongoDB Atlas connection string, with the real password in it)
6. Click **Deploy**. Render will give you a public URL like
   `https://nelas-kitchenette.onrender.com` — that's your real, internet-facing
   ordering site.

Other viable options: **Railway.app**, **Fly.io**, or a small VPS (e.g.
DigitalOcean) if you want more control. The steps are similar — install
Node.js dependencies, run `npm start`, set both environment variables above.

## ⚠️ One limitation still remaining: uploaded photos

Menu data and orders now persist permanently in MongoDB — that part is fully
solved. **Uploaded photo files, however, still live on Render's disk**, which
resets on restart, exactly like the old JSON-file limitation. So category/item
edits, coupons, offers, and orders are now safe permanently — but a photo you
upload today could still disappear after a server restart.

**The fix for this is cloud photo storage** (e.g. Cloudinary, which has a free
tier built for exactly this). This is a smaller, separate follow-up — let me
know when you're ready and I'll wire it in.

## How the admin page works

1. Go to `/admin.html` on wherever this is hosted.
2. Enter the admin password.
3. **Menu Visibility tab** — every category has an on/off switch; every item
   under it has its own switch. Turning a category off hides everything in
   it, regardless of individual item switches. Changes take effect
   immediately on the public site (next time it loads the menu).
4. **Orders tab** — see every order placed, newest first: customer name,
   phone, fulfillment method, items, and total.

## Menu data format

Same shape as the Android app's `menu.json`, with one addition: a `"visible"`
boolean on every category and every item (defaults to visible if omitted).
The admin page is just a friendly way to flip these without editing the file
by hand — though you can still edit `data/menu.json` directly if you prefer,
as long as the server gets restarted (or you edit it through the admin API).

## What's NOT connected yet

- **The Android tablet app doesn't know about this system yet.** Orders
  placed online currently only show up in the admin page's Orders tab — the
  tablet app still only handles its own local in-app ordering. Syncing these
  (e.g. the tablet polling for new online orders) is a good next step once
  this is deployed and working.
- **No real payment processing** — orders are collected with contact info;
  payment is assumed to happen on pickup/delivery (cash) for now, matching
  the tablet app's current approach.
