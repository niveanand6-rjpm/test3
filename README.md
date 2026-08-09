# Lakshmi Fancy Store - Store Management SPA

## Latest updates (2026-08-20)

- **Fixed the overwrite risk on `inventory.json`, `expenses.json`, and
  `customers.json`** when a sales device pushes: a push now GETs the
  current remote file first and **merges by record ID** instead of
  blindly replacing it - so an admin's new stock item, salary/rent
  expense entry, or new customer is never silently dropped just because a
  sales device's local cache didn't have it yet. When the *same* record
  was genuinely edited on two devices, whichever has the newer
  `updatedAt`/`createdAt` wins. As a bonus, the merged result is also
  written back to the pushing device's local storage, so pushing now
  doubles as picking up what other devices have added.
- Added `updatedAt` tracking to the records that actually get edited in
  place (stock quantity/price, customer points/details, rental status on
  return) so the "which version is newer" comparison is accurate.

**What this does and doesn't solve:** additions are now always safe -
nothing gets deleted just because one device didn't know about it. Genuine
edit conflicts on the *exact same record* from two devices in a short
window still resolve by "most recent edit wins," which is usually right
but isn't a true 3-way merge (e.g., if a customer's loyalty points changed
on two devices in the same window, only one edit's point value survives,
not both increments added together). For that level of correctness across
many simultaneous devices, the real fix is still what's noted in the
GitHub Sync section below: a proper real-time database. For a shop with
one admin device and a handful of sales devices pushing a few times a day,
this merge makes the current approach solidly safe in practice.

## Previous updates (2026-08-19)

- **"Send Data" tab for sales staff** - a new sales-app tab lets each
  device push its own data to GitHub, same mechanism as the admin's
  GitHub Sync but **deliberately scoped**: sales devices can only push
  Daily Sales, Rentals, Expenses, Customers, Customer Notes, and current
  Stock quantities. They can never push store settings, staff records,
  promotions, loyalty/points rules, rental rates/commission, or the image
  library - those stay admin-only, so a sales device's possibly-stale
  local cache can never overwrite the admin's actual configuration. The
  GitHub-push engine itself was refactored into `common.js` so both apps
  share the same tested code instead of duplicating it.
- Each device (admin or sales) should have **its own** Personal Access
  Token, scoped to "Contents: Read and write" on this one repo only, so
  any single device can be revoked individually if lost or a staff member
  leaves - see the in-app Help panel on both the admin and sales "Send
  Data" screens.

## Previous updates (2026-08-18)

- **GitHub Sync (interim manual push)** - new card in Admin > Backup &
  Export. Enter your repo owner/name/branch and a fine-grained Personal
  Access Token once, then click "Save & Push All Data to GitHub Now" to
  commit every `data/*.json` file straight to your repo via the GitHub API
  - no manual download-then-upload needed. See "How best to use this"
  below (also included as an in-app Help panel next to the button).

## How best to use GitHub Sync

This is a **one-way, on-demand push from one device** - not live
multi-device sync (see the note in the previous update below for why that
needs a different architecture). Used well, it's still genuinely useful:

1. **Create a scoped token.** GitHub Settings &gt; Developer settings &gt;
   Personal access tokens &gt; Fine-grained tokens &gt; Generate new token.
   Restrict "Repository access" to *just* this repo, set an expiry (90
   days is reasonable), and grant *only* "Contents: Read and write" under
   Permissions. Don't use a classic all-repo-access token here.
2. **Only enter the token on a trusted device** - it's saved in that
   browser's local storage so you don't have to retype it every time,
   which also means it's readable via that browser's dev tools. Use the
   shop owner/admin's own device, not a shared or public one. "Clear Saved
   Token" removes it from that device whenever you want.
3. **Treat it as end-of-day ritual, not real-time sync.** Push once when
   you close up (or whenever you want a durable snapshot). Other devices
   won't automatically see the update - they'd need "Reset app data" on
   their login screen and a reload to re-seed fresh from GitHub. Good
   rhythm: the admin device is the source of truth and pushes daily; sales
   devices reset/resync periodically (e.g. each morning) rather than
   expecting instant cross-device sync.
4. **Mind what's in the commits.** These files contain real customer
   names, phone numbers, and addresses, and every push is a permanent
   entry in your repo's history (even a later edit doesn't erase it from
   old commits). Free-tier GitHub Pages requires a *public* repo unless
   you're on a paid plan that supports Pages from private repos - check
   your repo's visibility before relying on this, and treat this data as
   sensitive either way.
5. **Rotate/revoke the token periodically**, and immediately if the device
   is lost, sold, or shared.

If you outgrow this (e.g. need several sales devices to see each other's
entries live), the next step up is a real-time database like Firebase -
ask any time and I can help migrate to it.

## Previous updates (2026-08-17)

- **Fixed iPad promo banner not showing.** Root cause: animating
  `background-position` on a gradient is unreliably repainted by iOS
  Safari/WebKit (especially in Low Power Mode). Replaced with GPU-safe
  `transform`/`opacity`/`box-shadow` animations only, which render
  reliably on every device.
- **Font customization**: Admin > Store Setup now has a font-style picker
  (Classic/Modern/Elegant/Simple, each loading the right Google Fonts on
  demand) and a text-size picker (Small/Medium/Large/Extra Large) that
  scales the whole UI, since the stylesheet is built on rem units.
- **Sub-section color theming** expanded beyond Background/Header/Footer/
  Accent to include Card Background, Text Color, and Secondary Accent.
- **Sales Report > Daily Sales & Rentals** now show Total Sales, Total
  Discounts, Total Points Redeemed, Total Cash Received, and Total GPay
  Received as stat boxes on the page, and as a summary block at the top of
  both the printed report and the PDF export.
- **Attendance & Leave**: Log a Leave now takes a From/To date range
  (auto-expands into one record per day - useful for a week off) and a
  Leave Type (Personal / Sick / Other).
- **Daily Sales backdating**: a "This sale happened on an earlier date"
  checkbox reveals a date picker capped at yesterday (today/future are
  blocked); the sale's business `date` is backdated while `createdAt` keeps
  the real entry time for an audit trail, and a "Backdated" badge shows in
  Recent Sales.
- **Phone-number autofill gaps fixed**: audited every phone field in both
  apps. The Rental "Referred By" phone and the Customer Requirements phone
  field were missing the customer-lookup wiring entirely - both now
  autofill name/address from the customer database, keyed on phone number.

## GitHub sync - why data only lives in the browser, and how to actually fix it

**This is an architecture limit, not a bug.** GitHub Pages is 100% static
hosting - there is no server component, so nothing running in the
browser can write back to your repository on its own. `localStorage` is
also strictly per-browser and per-device: two people on two phones looking
at the same GitHub Pages URL each have their own separate, local copy of
the data. That's why the JSON only ever updates "in the local system
cache" - every export/backup button in this app has been a workaround for
that limit from the start, not the real fix.

If you want genuine real-time sync across every device (sales staff's
phones + your admin console all seeing the same live data instantly),
there are three real options, in order of effort:

1. **Commit straight to GitHub from the browser (quick, but has a real
   security tradeoff).** GitHub's REST API supports authenticated
   cross-origin requests, so it's possible to add a "Push to GitHub" button
   that PUTs each `data/*.json` file to your repo using a Personal Access
   Token entered by the admin. The catch: that token has to live in the
   browser to make the request, which means anyone with access to that
   browser's dev tools can see it. Only worth doing with a token scoped to
   *just* this one repo's contents, and only on a device you trust. I can
   build this if you want it - say so and I'll add it to Backup & Export.
2. **A small serverless relay (secure middle ground).** A tiny function
   (Cloudflare Worker, Vercel/Netlify function, etc. - free tier is enough
   for a shop this size) holds the GitHub token server-side; the browser
   calls that function instead of GitHub directly. Keeps the token safe,
   still no traditional server to maintain, but it's one more thing to
   deploy outside GitHub Pages itself.
3. **Swap local JSON for a real real-time database** (Firebase Firestore
   or Supabase, both have generous free tiers). This is the properly
   "right" answer if you want live sync - every device reads/writes the
   same database and sees changes within a second, no export/import or
   GitHub commits involved at all. It's a bigger change (the `LFS.get`/
   `LFS.set` functions would swap from `localStorage` to database calls),
   but it's the standard way apps like this actually solve multi-device
   sync, and I can help build it if that's the direction you want.

**My recommendation:** if it's mainly one admin device and one or two
sales devices, option 1 (GitHub API push button) is the fastest fix and
keeps everything inside the current architecture - just treat that device
as trusted and use a minimally-scoped token. If you're expecting several
sales devices working simultaneously and need them to see each other's
sales in real time, go straight to option 3 (Firebase/Supabase) - patching
GitHub-as-a-database further will always feel like a workaround. Let me
know which direction you'd like and I'll build it out.

## Previous updates (2026-08-16)

- **Fixed ₹ showing as garbled text in PDFs**: jsPDF's built-in fonts have
  no glyph for the Rupee sign, so it silently substituted an unrelated
  character. PDF output now uses "Rs." instead - screen, browser print, and
  CSV are unaffected and still show ₹ normally.
- **Rental revenue no longer includes the refundable security deposit.**
  Added `LFS.rentalNetRevenue()` (rental charge minus discount minus any
  referral commission) and applied it everywhere "revenue" is reported:
  Sales Report Overview, all Analytics charts, the Rentals table/print/PDF
  (now shows Rental Charge, Deposit (Refundable), and Net Revenue as
  separate columns), per-item earnings, and loyalty points earned. Receipts
  now label the deposit line "Security Deposit (Refundable)". The
  payment-mode chart is intentionally untouched since it tracks actual cash
  movement (deposit included), not revenue.
- **Recent Sales Summary** - new sales-app tab: a day-by-day cash-handover
  digest (Cash / GPay / Other totals, sales & rental revenue) for the last
  N days, to help staff reconcile and hand over takings. Configurable by
  Admin under Sales Report &gt; **Sales Dept Setting** (new 6th sub-tab):
  number of days to show, and whether Daily Sales / Rental sections are
  visible to the sales team.
- **Website theme customization**: Admin > Store Setup now has 4 color
  pickers (Background, Header/Primary, Footer, Accent/Animation) that apply
  instantly across both apps via CSS custom properties - yes, this was
  fully feasible client-side since the whole stylesheet was already built
  on CSS variables.

## Previous updates (2026-08-15)

- **Sales Report split into 5 sub-tabs**: Overview (numbers only - year/
  month/today revenue, cash & GPay totals, repeat customers, commission
  paid, referral revenue, pending balances - for a quick management
  glance), Sales Analytics (6 charts: monthly trend, 30-day daily trend,
  best categories, payment split, revenue by employee, new-vs-repeat
  customers), Referral Program, Daily Sales (+ top-selling-items chart),
  and Rentals (+ status breakdown & revenue-by-event-type charts). Every
  sub-tab has its own Print/PDF/CSV where applicable.
- **Promotion banners are more eye-catching**: shimmering gold gradient,
  pulsing glow, and a bouncing emoji - shown in Admin > Promotions (on the
  active row and a top banner) and on both the Daily Sales and Rental POS
  screens.
- **Go to Top button**: a floating button on the right side of every page,
  appears once you've scrolled past halfway down the page, scrolls smoothly
  back to the top on click.

## Previous updates (2026-08-14)

- **Fixed per-sale/per-rental "Print" bug**: the individual receipt print
  buttons (Recent Sales, Active Rentals, Rental History) relied on an
  off-screen positioning trick to trigger `window.print()`, which is
  unreliable across browsers/devices. Replaced with a visible print-preview
  modal - click Print on any row, review the receipt, then hit Print inside
  the modal. "Print All" (report view) was unaffected and still works the
  same way.
- **Recent Sales table** now shows Discount, Points Earned, and Points
  Redeemed for every sale (also added to the Print All / Admin Sales
  Report / PDF / CSV versions) so you can review redemption and discount
  activity daily.
- **Active promotions now flash**: in Admin > Promotions, the
  enabled promotion is highlighted with a pulsing gold border in the list,
  plus a "Currently enabled" banner at the top. The same flashing banner
  shows on the Daily Sales and Rental POS screens so sales staff always
  know to mention the current offer to customers.

## Previous updates (2026-08-13)

- **Referral program**: Rental POS now has a "Referred By" toggle - when yes,
  it captures the referrer's name, phone, and place, and computes a
  commission live from the rental item's commission settings.
- **Referral commission** is configured per rental item in Admin > Rental
  Inventory (percentage of the rental charge, or a flat ₹ amount) - shown in
  the master data table and included in bulk CSV/Excel upload.
- **Admin > Sales Report** now has a Referral Program section: total
  commission, referred-rental count, top referrer, a "top referrers by
  commission" chart, a "commission by month" chart, and a full table with
  Print/PDF/CSV export. The main Rentals table/report also shows who
  referred each booking.
- **Icons** added across every admin and sales-app nav tab, sub-tab, and
  major section heading.
- **Admin header logo bug fixed**: the admin console was hardcoded to a
  static "A" placeholder and never actually rendered the uploaded store
  logo - it now does.
- **Footer added** to both apps: social media links (built from a full URL
  or just a handle), contact info, GST number, and copyright.

## Previous updates (2026-08-12)

- **Promotions** are now scoped to Daily Sale and/or Rental, and to specific
  item categories (like Shopify/Square/WooCommerce "automatic discount"
  rules scoped by collection/product type). **Only one promotion can be
  enabled at a time** - enabling a second one is blocked until you disable
  the first.
- **Unified discount engine**: repeat-customer %, review discount, the
  active promotion, and points redemption are now combined into a single
  breakdown with one "Apply Discounts" button in both Daily Sales and the
  Rental POS - no more separately clicking each one.
- **Flash Sale removed** from Loyalty & Discounts (superseded by Promotions).
- **Daily Sales "Others" item**: pick "Others (custom item)" to reveal a
  description + unit price field for anything not in the catalog.
- **IST date & time** now shown (and exported/printed) alongside the date on
  Recent Sales, Active/History Rentals, Expenses, Customer Notes, and every
  related report/PDF/CSV - so you can see exactly when a customer visited.
- **Customers table** now shows review status + platform and "how did they
  hear about us", plus a new-customers-by-month chart.
- **Expenses** gets a third sub-tab, "Past Expenses Trend": pick a month for
  a breakdown, or a year for a 12-month bar graph.

## Overview

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
