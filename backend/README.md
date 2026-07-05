# Naila Home — Backend

Node.js/Express API, PDF invoice generation, and an admin dashboard.

## Run locally

```
npm install
npm start
```

Server runs at `http://localhost:4000`. Set a custom admin password with:

```
ADMIN_PASSWORD=your-password npm start
```

## Set your real delivery origin point

Delivery fees are calculated as straight-line ("as the crow flies")
distance from a fixed point — matching the flyer's "radius from CBD"
wording. Update the coordinates in **`distance.js`**:

```js
const CBD_COORDS = { lat: -17.8292, lng: 31.0522 };
```

Set this to your actual shop/warehouse location, and make sure
`mobile/src/config.js` has the exact same coordinates.

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/delivery-tiers` | Fee tiers + the CBD coordinate they're measured from |
| POST | `/api/delivery-fee` | Body: `{ "lat": -17.85, "lng": 31.06 }` (or `{ "distanceKm": 8 }`) → fee for that point |
| POST | `/api/orders` | Create an order. Generates a PDF invoice immediately. See `server.js` for the expected body shape |
| GET | `/api/orders/:id` | Look up a single order. Optional `?phone=` double-checks the requester's phone matches |
| GET | `/api/orders?phone=...` | **Order history** for a customer, most recent first |
| GET | `/api/orders/:id/invoice.pdf` | Download the PDF invoice. Optional `?phone=` for the same check as above |
| GET | `/api/admin/orders` | *(admin)* List all orders |
| PATCH | `/api/admin/orders/:id/status` | *(admin)* Update an order's status |
| GET | `/api/admin/orders/:id/invoice.pdf` | *(admin)* Download any invoice |

Admin endpoints require the header `x-admin-password: <your password>`.

## PDF invoices

Generated with `pdfkit` (pure JS, no native dependencies) the moment an
order is created, and saved to `invoices/<invoiceId>.pdf`. The layout lives
in `invoice.js` — edit that file to change the look, add a logo image, etc.

Note: on most hosting platforms, the local filesystem is **not persistent**
across deploys or restarts. Before going live, either:
- switch to a host with persistent disk (e.g. a small VPS), or
- upload each generated PDF to object storage (S3, Cloudflare R2, etc.) as
  soon as it's created, and serve from there instead.

## Admin dashboard

Visit `http://localhost:4000/admin`, enter the admin password, and update
order statuses or download any invoice from a simple table.

## Moving to production

- Swap `db.js` for a real database — the five functions in that file
  (`getOrders`, `getOrderById`, `getOrdersByPhone`, `addOrder`,
  `updateOrderStatus`) are the only things you need to re-implement.
- Deploy to Render, Railway, Fly.io, or similar.
- Set `ADMIN_PASSWORD` via your host's environment variable settings, and
  consider real user accounts if more than one person manages orders.
- Enforce HTTPS in production (your host almost certainly handles this).
