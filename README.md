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
- **Admin page** (`/admin.html`) — password-protected. Toggle any category or
  individual item on/off to control what customers see, and view all orders
  that have come in.
- **Backend API** (Express/Node.js) serving both, storing menu + orders data.

## Running it locally (to test before deploying)

You'll need [Node.js](https://nodejs.org) installed (version 18 or newer).

```bash
cd NelasKitchenetteOnline
npm install
npm start
```

Then open **http://localhost:4000** in a browser for the customer site, and
**http://localhost:4000/admin.html** for the admin page.

(This runs on port 4000 by default — chosen specifically so it doesn't clash
with XAMPP/Apache, which commonly runs on port 3000 or 80.)

The default admin password is **`changeme123`** — change this before going
live (see below).

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
6. Click **Deploy**. Render will give you a public URL like
   `https://nelas-kitchenette.onrender.com` — that's your real, internet-facing
   ordering site.

Other viable options: **Railway.app**, **Fly.io**, or a small VPS (e.g.
DigitalOcean) if you want more control. The steps are similar — install
Node.js dependencies, run `npm start`, set the `ADMIN_PASSWORD` environment
variable.

## ⚠️ Important limitation — please read before relying on this for real orders

This version stores the menu and orders in **plain JSON files** on disk
(`data/menu.json`, `data/orders.json`). This is simple and works great for
testing, but **most free hosting tiers (including Render's free plan) use a
temporary/ephemeral filesystem** — meaning any orders placed, or any
visibility changes made in the admin page, **can be wiped out** whenever the
server restarts (which free tiers do automatically after periods of
inactivity, or on redeploys).

**For actually taking real customer orders long-term, this needs an upgrade
to a real database** (e.g. a free-tier PostgreSQL or MongoDB instance, which
most hosts also offer) instead of flat JSON files. This is a very doable next
step — just let me know when you're ready to go properly live, and I'll wire
that in. For now, this version is solid for **testing the full flow and
showing it to people**, just don't treat the orders it collects as
permanently safe until that upgrade is made.

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
