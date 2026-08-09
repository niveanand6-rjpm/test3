/* ============================================================
   Lakshmi Fancy Store - common.js
   Shared utilities used by both index.html (sales person) and
   admin.html (admin console).

   Data model
   ----------
   Every module keeps its data in ONE localStorage key AND has a
   matching seed JSON file under /data. On first load (or whenever
   localStorage is empty for that key) the app fetches the seed
   file and uses it as the starting dataset. From then on all reads
   and writes happen against localStorage. Admin can export the
   current localStorage state back to JSON at any time and commit
   that file to the repo so the *next* deployment starts from the
   latest real data (this is the "old data populates historic
   values on redeploy" workflow).

   Storage keys <-> seed files
   ----------------------------
   lfs_settings        -> data/settings.json
   lfs_inventory       -> data/inventory.json        (daily-sale stock items)
   lfs_rental_items    -> data/rental_items.json      (rentable jewellery)
   lfs_customers       -> data/customers.json
   lfs_staff           -> data/staff.json
   lfs_attendance      -> data/attendance.json
   lfs_expenses        -> data/expenses.json
   lfs_sales           -> data/sales.json             (daily sales entries)
   lfs_rentals         -> data/rentals.json           (rental transactions)
   lfs_loyalty         -> data/loyalty.json
   lfs_customer_requests -> data/customer_requests.json
   ============================================================ */

/* ---------- embedded default seed data ----------
   Mirrors the /data/*.json files exactly. Used as the source of truth
   when the app is opened directly from disk (file:// URLs), where the
   browser blocks fetch() of local JSON files for security reasons.
   When served over http(s) (GitHub Pages, a local server, etc.) the app
   still tries fetch() first so committed /data updates are picked up;
   this object is only the fallback. ---------- */
const LFS_DEFAULT_DATA = {
  lfs_settings: {
  "storeName": "Lakshmi Fancy Store",
  "logoDataUrl": "",
  "branch": "Main Branch",
  "businessType": "Imitation Jewellery & Fancy Items",
  "address": "Rajapalayam, Tamil Nadu",
  "region": "Rajapalayam",
  "phone": "9944000000",
  "email": "info@lakshmifancystore.example",
  "gstNumber": "",
  "social": {
    "facebook": "",
    "instagram": "",
    "twitter": "",
    "whatsapp": ""
  },
  "qrCodes": {
    "storeLocation": "",
    "gpay": "",
    "phonepe": "",
    "googleReview": ""
  },
  "salesPersonPassword": "sales1111",
  "adminPassword": "admin111",
  "autoBackupHours": 3,
  "lastSetupNote": "Change default passwords immediately from the Admin > Security panel."
},
  lfs_inventory: [
  {
    "id": "inv_001",
    "itemName": "Oxidised Jhumka Earrings",
    "itemCode": "EAR-001",
    "category": "Imitation Jewellery",
    "itemType": "Earrings (Jhumkas)",
    "purchaseDate": "2026-01-15",
    "quantityAvailable": 24,
    "price": 180,
    "imageDataUrl": ""
  },
  {
    "id": "inv_002",
    "itemName": "Kids Bangle Set (4pc)",
    "itemCode": "BAN-014",
    "category": "Imitation Jewellery",
    "itemType": "Bangles (Set of 2/4)",
    "purchaseDate": "2026-02-02",
    "quantityAvailable": 40,
    "price": 90,
    "imageDataUrl": ""
  },
  {
    "id": "inv_003",
    "itemName": "Decorative Photo Frame - Small",
    "itemCode": "PF-007",
    "category": "Fancy Items",
    "itemType": "Photo Frames (Decorative)",
    "purchaseDate": "2026-03-10",
    "quantityAvailable": 15,
    "price": 250,
    "imageDataUrl": ""
  }
],
  lfs_rental_items: [
  {
    "id": "rit_001",
    "itemName": "Bridal Kundan Necklace Set",
    "itemCode": "RNS-101",
    "category": "Imitation Jewellery",
    "itemType": "Kundan / Polki Style Jewellery",
    "dailyRate": 500,
    "deposit": 3000,
    "status": "available",
    "purchasedFrom": "Madurai Wholesale Traders",
    "purchaseDate": "2025-11-20",
    "purchasePrice": 4200,
    "warranty": "None",
    "imageDataUrl": "",
    "timesRented": 6,
    "totalEarned": 9200
  },
  {
    "id": "rit_002",
    "itemName": "Temple Jewellery Long Haaram",
    "itemCode": "RNS-102",
    "category": "Imitation Jewellery",
    "itemType": "Temple Jewellery (Imitation)",
    "dailyRate": 650,
    "deposit": 4000,
    "status": "available",
    "purchasedFrom": "Trichy Antique Jewels",
    "purchaseDate": "2025-12-05",
    "purchasePrice": 5500,
    "warranty": "None",
    "imageDataUrl": "",
    "timesRented": 4,
    "totalEarned": 7800
  },
  {
    "id": "rit_003",
    "itemName": "Maang Tikka & Matha Patti Set",
    "itemCode": "RMT-021",
    "category": "Imitation Jewellery",
    "itemType": "Maang Tikka / Matha Patti",
    "dailyRate": 200,
    "deposit": 1000,
    "status": "rented",
    "purchasedFrom": "Rajapalayam Local Vendor",
    "purchaseDate": "2026-01-08",
    "purchasePrice": 900,
    "warranty": "None",
    "imageDataUrl": "",
    "timesRented": 11,
    "totalEarned": 5100
  }
],
  lfs_customers: [
  {
    "id": "cus_001",
    "name": "Priya Ramesh",
    "phone": "9876543210",
    "address": "12 Kovil Street",
    "region": "Rajapalayam",
    "loyaltyPoints": 340,
    "repeatCustomer": true,
    "reviewGiven": true,
    "reviewPlatform": "Google",
    "notes": ""
  },
  {
    "id": "cus_002",
    "name": "Meena Selvam",
    "phone": "9944112233",
    "address": "45 Bazaar Road",
    "region": "Srivilliputtur",
    "loyaltyPoints": 60,
    "repeatCustomer": false,
    "reviewGiven": false,
    "reviewPlatform": "",
    "notes": ""
  }
],
  lfs_staff: [
  {
    "id": "stf_001",
    "name": "Kalaivani M",
    "phone": "9865123400",
    "role": "Sales Associate",
    "monthlySalary": 3000,
    "joinDate": "2024-06-01",
    "active": true
  },
  {
    "id": "stf_002",
    "name": "Suresh Kumar",
    "phone": "9865123411",
    "role": "Sales Associate",
    "monthlySalary": 3500,
    "joinDate": "2025-02-15",
    "active": true
  }
],
  lfs_attendance: [
  {
    "id": "att_001",
    "staffId": "stf_001",
    "date": "2026-07-04",
    "type": "leave",
    "reason": "Personal"
  },
  {
    "id": "att_002",
    "staffId": "stf_001",
    "date": "2026-07-18",
    "type": "leave",
    "reason": "Sick"
  },
  {
    "id": "att_003",
    "staffId": "stf_002",
    "date": "2026-07-10",
    "type": "leave",
    "reason": "Family function"
  }
],
  lfs_expenses: [
  {
    "id": "exp_001",
    "category": "Rent",
    "description": "Shop rent - July",
    "amount": 12000,
    "date": "2026-07-01",
    "month": "2026-07"
  },
  {
    "id": "exp_002",
    "category": "Electricity",
    "description": "EB bill - July",
    "amount": 1800,
    "date": "2026-07-05",
    "month": "2026-07"
  },
  {
    "id": "exp_003",
    "category": "Tax",
    "description": "GST payment - Q2",
    "amount": 4500,
    "date": "2026-07-10",
    "month": "2026-07"
  }
],
  lfs_sales: [
  {
    "id": "sal_001",
    "date": "2026-08-05",
    "itemId": "inv_001",
    "itemName": "Oxidised Jhumka Earrings",
    "quantity": 2,
    "unitPrice": 180,
    "discount": 10,
    "total": 350,
    "customerPhone": "9876543210",
    "customerName": "Priya Ramesh",
    "soldBy": "Kalaivani M"
  }
],
  lfs_rentals: [
  {
    "id": "ren_001",
    "rentalItemId": "rit_003",
    "itemName": "Maang Tikka & Matha Patti Set",
    "customerPhone": "9876543210",
    "customerName": "Priya Ramesh",
    "customerAddress": "12 Kovil Street",
    "eventType": "Reception",
    "rentalDate": "2026-08-07",
    "expectedReturnDate": "2026-08-09",
    "actualReturnDate": "",
    "days": 2,
    "dailyRate": 200,
    "deposit": 1000,
    "discount": 20,
    "advancePaid": 400,
    "total": 780,
    "balance": 380,
    "status": "active",
    "handledBy": "Kalaivani M"
  }
],
  lfs_loyalty: {
  "pointsPer100Rupees": 5,
  "repeatCustomerDiscountPercent": 10,
  "reviewDiscountAmount": 50,
  "flashSale": {
    "enabled": false,
    "discountPercent": 15,
    "fromDate": "",
    "toDate": "",
    "appliesTo": "all"
  }
},
  lfs_customer_requests: [
  {
    "id": "req_001",
    "date": "2026-08-06",
    "customerPhone": "9944112233",
    "customerName": "Meena Selvam",
    "comment": "Asked if we can stock more temple jewellery haaram sets for reception season.",
    "loggedBy": "Suresh Kumar"
  }
],
};

const LFS = (() => {

  const SEED_MAP = {
    lfs_settings: "data/settings.json",
    lfs_inventory: "data/inventory.json",
    lfs_rental_items: "data/rental_items.json",
    lfs_customers: "data/customers.json",
    lfs_staff: "data/staff.json",
    lfs_attendance: "data/attendance.json",
    lfs_expenses: "data/expenses.json",
    lfs_sales: "data/sales.json",
    lfs_rentals: "data/rentals.json",
    lfs_loyalty: "data/loyalty.json",
    lfs_customer_requests: "data/customer_requests.json"
  };

  const ALL_KEYS = Object.keys(SEED_MAP);

  /* ---------- core storage ---------- */

  async function seedIfEmpty(key) {
    if (localStorage.getItem(key) !== null) return;
    // Try fetching the live seed file first (works when served over http/https,
    // e.g. GitHub Pages or any local server) so committed /data updates are
    // picked up on redeploy. If that fails -- most commonly because the app
    // was opened directly from disk as a file:// URL, where browsers block
    // fetch() of local files -- fall back to the data embedded above so the
    // app (and default passwords) still work correctly.
    try {
      const res = await fetch(SEED_MAP[key]);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      localStorage.setItem(key, JSON.stringify(json));
    } catch (e) {
      const fallback = LFS_DEFAULT_DATA[key];
      localStorage.setItem(key, JSON.stringify(fallback !== undefined ? fallback : (key === "lfs_settings" ? {} : [])));
      console.warn("Seed fetch failed for", key, "- using embedded default data instead.", e);
    }
  }

  async function init() {
    await Promise.all(ALL_KEYS.map(seedIfEmpty));
    repairCorruptedData();
  }

  /* ---------- one-time repair for browsers that already saved broken/empty
     data from before this fix (e.g. opened as file:// where fetch() of the
     JSON seed files is blocked, so lfs_settings got saved as {} and every
     password check failed). Runs once per browser via a version marker,
     merges embedded defaults into any key found empty/incomplete, and
     never touches a key that already has real data. ---------- */
  function repairCorruptedData() {
    if (localStorage.getItem("lfs_repair_v2") === "1") return;
    const settings = get("lfs_settings");
    if (!settings || !settings.adminPassword || !settings.salesPersonPassword) {
      set("lfs_settings", Object.assign({}, LFS_DEFAULT_DATA.lfs_settings, settings || {}));
      console.warn("Repaired lfs_settings (missing passwords) using embedded defaults.");
    }
    ALL_KEYS.forEach(key => {
      if (key === "lfs_settings") return;
      const current = get(key);
      const isEmpty = Array.isArray(current) ? current.length === 0 : (!current || Object.keys(current).length === 0);
      const fallback = LFS_DEFAULT_DATA[key];
      const fallbackHasData = Array.isArray(fallback) ? fallback.length > 0 : (fallback && Object.keys(fallback).length > 0);
      if (isEmpty && fallbackHasData) set(key, fallback);
    });
    localStorage.setItem("lfs_repair_v2", "1");
  }

  function get(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (key === "lfs_settings" ? {} : []);
  }

  function set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("lfs_last_modified", new Date().toISOString());
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- export / import (per module + full backup) ---------- */

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportModule(key) {
    downloadJSON(SEED_MAP[key].split("/").pop(), get(key));
  }

  function exportFullBackup() {
    const bundle = {};
    ALL_KEYS.forEach(k => bundle[k] = get(k));
    bundle._backupAt = new Date().toISOString();
    downloadJSON(`lfs_backup_${Date.now()}.json`, bundle);
    localStorage.setItem("lfs_last_backup", bundle._backupAt);
  }

  function importModule(key, fileOrText) {
    return new Promise((resolve, reject) => {
      const apply = (text) => {
        try {
          const json = JSON.parse(text);
          set(key, json);
          resolve(json);
        } catch (e) { reject(e); }
      };
      if (typeof fileOrText === "string") { apply(fileOrText); return; }
      const reader = new FileReader();
      reader.onload = () => apply(reader.result);
      reader.onerror = reject;
      reader.readAsText(fileOrText);
    });
  }

  function importFullBackup(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const bundle = JSON.parse(reader.result);
          ALL_KEYS.forEach(k => { if (bundle[k] !== undefined) set(k, bundle[k]); });
          resolve(bundle);
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /* ---------- auto backup (admin-configured interval) ---------- */

  function scheduleAutoBackup() {
    const settings = get("lfs_settings");
    const hours = Number(settings.autoBackupHours) || 0;
    if (!hours) return;
    const ms = hours * 60 * 60 * 1000;
    const last = Number(localStorage.getItem("lfs_last_autobackup_ts")) || 0;
    const run = () => {
      exportFullBackup();
      localStorage.setItem("lfs_last_autobackup_ts", String(Date.now()));
    };
    const elapsed = Date.now() - last;
    const wait = Math.max(ms - elapsed, 5000);
    setTimeout(function tick() {
      run();
      setInterval(run, ms);
    }, last ? wait : ms);
  }

  /* ---------- CSV export (for GST / external billing software) ---------- */

  function toCSV(rows) {
    if (!rows || !rows.length) return "";
    const headers = Object.keys(rows[0]);
    const esc = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(",")];
    rows.forEach(r => lines.push(headers.map(h => esc(r[h])).join(",")));
    return lines.join("\n");
  }

  function downloadCSV(filename, rows) {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------- validation ---------- */

  const isValidPhone = (v) => /^[0-9]{10}$/.test(String(v || "").trim());
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  const isValidAmount = (v) => v !== "" && !isNaN(v) && Number(v) >= 0;

  /* ---------- auth ----------
     Sale-person side: sessionStorage flag lfs_auth_sales -> cleared on tab/browser close
     and re-asked on every refresh (per spec).
     Admin side: sessionStorage flag lfs_auth_admin -> asked once per session, not per tab,
     but also cleared on refresh (new session = new tab activation).
  */

  function checkPassword(input, settingsKey) {
    const settings = get("lfs_settings");
    const stored = settings[settingsKey];
    return String(input) === String(stored);
  }

  function isAuthed(flag) {
    return sessionStorage.getItem(flag) === "1";
  }

  function setAuthed(flag) {
    sessionStorage.setItem(flag, "1");
  }

  function logout(flag) {
    sessionStorage.removeItem(flag);
  }

  /* ---------- printable reports (logo + store name + date/time header) ----------
     Used by every module (sales, inventory, rentals, expenses, staff, customers)
     to print a clean report with the store's branding on it. Opens the report
     in a new tab/window so it doesn't disturb the live app, then triggers print.
  */
  function printReport(title, innerHtml, opts = {}) {
    const s = get("lfs_settings");
    const now = new Date();
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups to print reports."); return; }
    const logo = s.logoDataUrl
      ? `<img src="${s.logoDataUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:52px;height:52px;border-radius:50%;background:#C9A24B;color:#5A1530;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',Georgia,serif;font-weight:800;font-size:1.3rem;">${(s.storeName || "L").charAt(0)}</div>`;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} - ${s.storeName || "Lakshmi Fancy Store"}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;} body{font-family:'Inter',system-ui,sans-serif;color:#2A2118;padding:28px;max-width:1000px;margin:0 auto;}
        h1,h2,h3{font-family:'Playfair Display',Georgia,serif;color:#7A1E3D;margin:.2em 0;}
        .rpt-header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #C9A24B;padding-bottom:14px;margin-bottom:6px;}
        .rpt-header .meta{flex:1;}
        .rpt-header .sub{color:#6B5F52;font-size:.85rem;}
        .rpt-when{text-align:right;font-size:.8rem;color:#6B5F52;}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:.85rem;}
        th,td{border:1px solid #E4D9C7;padding:6px 8px;text-align:left;}
        th{background:#F2EAE0;color:#5A1530;}
        .rpt-title{margin:14px 0 4px;font-size:1.15rem;}
        .rpt-foot{margin-top:18px;font-size:.75rem;color:#6B5F52;text-align:center;}
        @media print{ .no-print{display:none;} body{padding:6px;} }
      </style></head><body>
      <div class="rpt-header">
        ${logo}
        <div class="meta">
          <h2 style="margin:0;">${s.storeName || "Lakshmi Fancy Store"}</h2>
          <div class="sub">${[s.address, s.phone, s.gstNumber ? "GSTIN: " + s.gstNumber : ""].filter(Boolean).join(" · ")}</div>
        </div>
        <div class="rpt-when">Printed: ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN")}</div>
      </div>
      <h3 class="rpt-title">${title}</h3>
      ${innerHtml}
      <div class="rpt-foot">${s.storeName || "Lakshmi Fancy Store"} - Generated report, for internal use.</div>
      <div class="no-print" style="text-align:center;margin-top:16px;"><button onclick="window.print()" style="padding:8px 18px;border-radius:20px;border:1px solid #7A1E3D;background:#7A1E3D;color:#fff;cursor:pointer;">Print</button></div>
      <script>window.onload = function(){ setTimeout(function(){ window.focus(); }, 200); };</script>
      </body></html>
    `);
    win.document.close();
  }

  /* ---------- misc helpers ---------- */

  function formatMoney(n) {
    const num = Number(n) || 0;
    return "\u20B9" + num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysBetween(d1, d2) {
    const a = new Date(d1), b = new Date(d2);
    return Math.max(1, Math.round((b - a) / 86400000));
  }

  return {
    SEED_MAP, ALL_KEYS, init, get, set, uid,
    downloadJSON, exportModule, exportFullBackup, importModule, importFullBackup,
    scheduleAutoBackup, toCSV, downloadCSV, printReport,
    isValidPhone, isValidEmail, isValidAmount,
    checkPassword, isAuthed, setAuthed, logout,
    formatMoney, todayISO, daysBetween
  };
})();

/* ---------- Tamil Nadu regional dropdown (Rajapalayam taluk villages) ---------- */
const LFS_REGIONS = ["Rajapalayam","Achchandavilthan","Alagapuri RF","Ammapatti","Appaneri","Arasiyarpatti","Athikulam Sengulam","Ayaidharmam","Ayan Karisalkulam","Ayan Kollankondan","Chokkanathaputtur","Deyvendri","Gopalapuram","Govindanallur","Ilandaikulam","Ilandiraikondan","Kadambankulam","Kalathur","Keelrajakularaman","Khansabpuram","Kollankondan","Kollankondan R.F.","Kongalapuram","Korukkampatti","Kothankulam","Kothankulam RF","Kottaiyur","Kovilur","Kunnur","Kuruchiyarpatti","Kurukkalkulam","Maharajapuram","Malli","Mamsapuram","Marakalamkathan","Melapattamkarisalkulam","Melarajakularaman (Part)","Mullikulam","Muthusamipuram","Muthuvenkatarayapuram","Muvaraivenran","Nachchiyarkovil","Nallamangalam","Nallingaperi","Nathampatti","Pattakkulam Sallipatti","Pillaiyarkulam","Pillaiyarnatham","Pillaiyarnatham R.F.","Ponnangani","Pudupalaiyam","Pudupatti R.F.","Puthur","Puvani","Reghunathapuram","Rudrappanaickenpatti","S. Ammapatti","Sammandapuram","Sappaniparambu (R.F.)","Semmanandikarisalkulam","Settur RF","Sholapuram","Singammalpuram","Sivandipatti","Solaicheri","Srivilliputtur","Srivilliputtur R.F.","Sundarapandiyam","Sundararajapuram","Tadagannai Managaseri","Tenkarai","Terku Devadanam","Terkuvenganallur","Thambipatti","Thilakulam","Thulukkapatti","Tiruchalur","Vadagarai","Vadakku Venganallur","Vadakkudevadanam","Vadakkusrivilliputhur","Vadugapatti","Valaikkulam R.F.","Varagunaramapuram","Vellaipottal","Venkateswarapuram","Viluppanur","Watrap","Others"];

const LFS_ITEM_TYPES = ["Necklace Sets","Earrings (Jhumkas)","Stud Earrings","Bangles (Set of 2/4)","Bracelets","Rings","Anklets (Payal)","Maang Tikka / Matha Patti","Nose Pins / Nose Rings","Hair Clips & Pins","Hair Bands / Scrunchies","Brooches / Pins","Keychains","Mobile Charms / Phone Accessories","Handbags / Clutches (Small Fancy)","Wallets / Coin Purses","Photo Frames (Decorative)","Showpieces / Figurines","Candles & Candle Holders","Artificial Flowers / Garlands","Gift Boxes & Wrapping Items","Makeup Accessories (Compact Mirrors, Brushes)","Perfume / Attar Mini Bottles","Beads & Craft Materials","Imitation Pearl Sets","Kundan / Polki Style Jewellery","Temple Jewellery (Imitation)","Oxidised Silver Look Jewellery","Kids Jewellery Sets","Waist Belts / Kamarbandh","Others"];

const LFS_CATEGORIES = ["Imitation Jewellery","Accessories","Fancy Items","Others"];

const LFS_EVENT_TYPES = ["Marriage","Baby Shower","Reception","Engagement","Naming Ceremony","Others"];
