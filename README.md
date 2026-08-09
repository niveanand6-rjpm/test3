# Lakshmi Fancy Store - Store Management SPA

A zero-build, static HTML/CSS/JS app for running daily sales, jewellery
rentals, and back-office admin from a phone, tablet, or desktop. Runs free
on GitHub Pages - no server, no framework, no build step. A few small CDN
libraries (see below) add PDF export, Excel parsing, and charts.

## Files

```
index.html            Sales-person app (Daily Sales / Rental / Catalog / Expenses)
admin.html             Admin console - separate file, its own password
css/style.css           Shared styling (mobile-first)
js/common.js            Storage, auth, backup/export/import, CSV/PDF, promotions helper
js/app.js               Sales-person logic
js/admin.js             Admin console logic
data/*.json              Seed data - see table below
```

## CDN libraries used (all loaded via `<script>` tags, nothing to install)

| Library | Used for |
|---|---|
| jsPDF + jsPDF-AutoTable | "Download PDF" button on every report |
| SheetJS (xlsx) | Reading `.xlsx`/`.xls` files for bulk inventory upload (admin.html only) |
| Chart.js | Sales Report analytics charts (admin.html only) |

If a device is offline these enhancements degrade gracefully: PDF shows a
message pointing to Print > Save as PDF, bulk upload asks for a `.csv`
instead, and charts simply don't render (the tables underneath still work).

## JSON files and what they hold

| localStorage key | Seed file | Holds |
|---|---|---|
| `lfs_settings` | `data/settings.json` | Store profile, logo, GST, socials, QR codes, both passwords, auto-backup interval |
| `lfs_inventory` | `data/inventory.json` | Daily-sale stock items (name, code, category, qty, price, image) |
| `lfs_rental_items` | `data/rental_items.json` | Rentable jewellery master data (rate, deposit, purchase info, times rented, earnings) |
| `lfs_customers` | `data/customers.json` | Customer directory (name, phone, address, region, loyalty points, repeat/review flags) |
| `lfs_staff` | `data/staff.json` | Employee profiles (name, role, monthly salary) |
| `lfs_attendance` | `data/attendance.json` | One row per leave day taken |
| `lfs_expenses` | `data/expenses.json` | Store overhead log - both Admin-logged and Sales-person-logged daily expenses (see `source`/`loggedBy`) |
| `lfs_sales` | `data/sales.json` | Daily small-item sales transactions (incl. `paymentMode`, `soldBy`) |
| `lfs_rentals` | `data/rentals.json` | Rental transactions, active + historic (incl. payment modes, `handledBy`) |
| `lfs_loyalty` | `data/loyalty.json` | Points-per-₹100, repeat/review discounts, points-redemption settings, flash sale config |
| `lfs_customer_requests` | `data/customer_requests.json` | Free-text customer feedback/requirement notes |
| `lfs_promotions` | `data/promotions.json` | Celebration/holiday discounts (defaults + custom, enable/disable) |
| `lfs_images` | `data/images.json` | Image Portal library (reusable item photos) |

## Sales-person app (`index.html`)

- **Daily Sales** - employee picker, payment mode (Cash/GPay/PhonePe/Card/other), phone-number auto-lookup, loyalty discount hints, one-click points redemption, per-row **Print** button for reprinting any past bill (employee name is intentionally left off the printed bill).
- **Rental** - New Rental (POS terminal with auto rates, discounts, promotions, loyalty redemption, printable receipt), Historic/Returns (mark returned + **Print** any active or past rental), Customer Requirements notes.
- **Catalog** - live availability grid, filters, zoomable images, printable list.
- **Expenses** - sales person logs small day-to-day shop expenses; these appear automatically in Admin > Expenses > Log Store Monthly Expense, tagged with who logged them.

A "Sales person on duty" selector in the header remembers who's using the
device for the session and pre-fills the employee field across tabs.

## Admin console (`admin.html`)

Stock · Rental Inventory · **Image Portal** (upload once, reuse via "Choose
from Library" when adding stock/rental items) · Staff (profiles +
attendance/leave payroll) · Expenses (log + upcoming, including
leave-adjusted payroll) · Jewellery Usage · **Sales Report** (overview +
analytics charts: monthly revenue trend, best-selling categories, cash vs
UPI payment split, revenue by employee) · Customers · Loyalty & Discounts
(incl. points-redemption toggle/threshold/value) · **Promotions** (default
public holidays/celebrations, off by default, plus custom entries) · Store
Setup · Security (change both passwords) · Backup & Export.

Every report across every module has **Print**, **PDF**, and **CSV**
buttons (logo + store name + generated date/time on all three). Stock and
Rental Inventory also have **bulk CSV/Excel upload** with a downloadable
template and an in-page Help panel listing the exact required columns; bad
files are rejected with row-by-row error messages, nothing partial gets
imported.

## How data persistence & redeploy works

1. On first load, if a `localStorage` key is empty, the app fetches the
   matching JSON file in `/data` and uses it as the starting dataset.
2. From then on, every read/write happens against `localStorage`.
3. Admin -> **Backup & Export** lets you download any module (or a full
   bundle) as JSON any time. Commit the updated file(s) back into `/data`
   in your GitHub repo before the next deploy, and the new deployment seeds
   itself with your latest real data.
4. Admin can set an **auto-backup interval** (hours) that downloads a full
   backup JSON automatically while the admin console tab stays open.

## Passwords / authentication

- Sales-person tabs are gated by `salesPersonPassword` (default `sales1111`).
  Asks once per browser session, asks again after every refresh.
- Admin console (`admin.html`) is a separate file gated by `adminPassword`
  (default `admin111`). Asks once per session (not per admin tab), again
  after refresh.
- Both are changed from Admin -> **Security**.

## Deploying to GitHub Pages

1. Push this folder to a repo.
2. Repo Settings -> Pages -> deploy from the `main` branch, root folder.
3. Visit `https://<yourname>.github.io/<repo>/` for the sales app, and
   `.../admin.html` for the admin console.

## Notes & limitations

- Images (item photos, logo, QR codes) are stored as base64 inside
  `localStorage`/JSON - keep photos reasonably small; browsers cap
  `localStorage` around 5-10MB per origin.
- "Auto backup" downloads a file to the device in use; GitHub Pages is
  static and can't write back into your repo from the browser. Treat the
  downloaded file as what you commit back manually (or wire into a
  scheduled GitHub Action if you want it hands-off).
- Payment-mode totals in the Sales Report charts are computed from each
  transaction's recorded mode (`paymentMode` on sales, `advancePaymentMode`
  / `settlementPaymentMode` on rentals) - it's a running tally, not a bank
  reconciliation.
- Multi-device sync is file-based (export -> commit -> every device gets it
  on next load) rather than live real-time sync, since there is
  intentionally no backend.
