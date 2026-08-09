/* ============================================================
   Lakshmi Fancy Store - common.js
   Shared utilities used by both index.html (sales person) and
   admin.html (admin console).

   Storage keys <-> seed files
   ----------------------------
   lfs_settings           -> data/settings.json
   lfs_inventory          -> data/inventory.json        (daily-sale stock items)
   lfs_rental_items       -> data/rental_items.json      (rentable jewellery)
   lfs_customers          -> data/customers.json
   lfs_staff              -> data/staff.json
   lfs_attendance         -> data/attendance.json
   lfs_expenses           -> data/expenses.json          (admin AND sales-person daily expenses)
   lfs_sales              -> data/sales.json              (daily sales entries)
   lfs_rentals            -> data/rentals.json            (rental transactions)
   lfs_loyalty            -> data/loyalty.json
   lfs_customer_requests  -> data/customer_requests.json
   lfs_promotions         -> data/promotions.json        (celebrations / holiday discounts)
   lfs_images             -> data/images.json            (Image Portal library)
   ============================================================ */

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
    lfs_customer_requests: "data/customer_requests.json",
    lfs_promotions: "data/promotions.json",
    lfs_images: "data/images.json",
    lfs_sync_log: "data/sync_log.json"
  };

  const ALL_KEYS = Object.keys(SEED_MAP);

  /* ---------- core storage ---------- */

  async function seedIfEmpty(key) {
    if (localStorage.getItem(key) !== null) return;
    try {
      const res = await fetch(SEED_MAP[key]);
      const json = await res.json();
      localStorage.setItem(key, JSON.stringify(json));
    } catch (e) {
      localStorage.setItem(key, JSON.stringify(key === "lfs_settings" ? {} : []));
      console.warn("Could not load seed for", key, e);
    }
  }

  async function init() {
    await Promise.all(ALL_KEYS.map(seedIfEmpty));
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

  /* ---------- CSV export / parse (GST filing, bulk upload) ---------- */

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

  // Simple RFC4180-ish CSV parser -> array of row objects keyed by header.
  function parseCSV(text) {
    const rows = [];
    let field = "", row = [], inQuotes = false;
    const pushField = () => { row.push(field); field = ""; };
    const pushRow = () => { rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') pushField();
        else if (c === '\r') { /* ignore */ }
        else if (c === '\n') { pushField(); pushRow(); }
        else field += c;
      }
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    const clean = rows.filter(r => r.some(c => String(c).trim() !== ""));
    if (!clean.length) return [];
    const headers = clean[0].map(h => String(h).trim());
    return clean.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = (r[idx] !== undefined ? String(r[idx]).trim() : ""));
      return obj;
    });
  }

  // Reads a File (.csv or .xlsx) and resolves to an array of row objects.
  // .xlsx parsing needs the SheetJS (XLSX) library loaded via CDN in the HTML shell.
  function parseSpreadsheetFile(file) {
    return new Promise((resolve, reject) => {
      const name = (file.name || "").toLowerCase();
      const reader = new FileReader();
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        if (!window.XLSX) { reject(new Error("Excel support library did not load. Please use a .csv file instead, or check your internet connection.")); return; }
        reader.onload = () => {
          try {
            const wb = window.XLSX.read(new Uint8Array(reader.result), { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
            resolve(rows.map(r => { const o = {}; Object.keys(r).forEach(k => o[String(k).trim()] = String(r[k]).trim()); return o; }));
          } catch (e) { reject(e); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => { try { resolve(parseCSV(reader.result)); } catch (e) { reject(e); } };
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  }

  /* ---------- PDF export (any table report) ----------
     Uses jsPDF + AutoTable, loaded via CDN in the HTML shell.
  */
  function downloadPDF(title, rows, columns, summaryLines) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library isn't available right now (check your internet connection). You can still use Print > Save as PDF.");
      return;
    }
    // jsPDF's built-in fonts (Helvetica etc.) have no glyph for the Rupee
    // sign (₹) and silently substitute an unrelated character instead - so
    // for PDF output specifically we swap ₹ for "Rs." (screen, browser
    // print, and CSV all render ₹ fine and are untouched).
    const forPdf = (v) => String(v === undefined || v === null ? "" : v).replace(/₹/g, "Rs. ");
    const s = get("lfs_settings");
    const cols = columns || (rows && rows[0] ? Object.keys(rows[0]).map(k => ({ key: k, label: k })) : []);
    const doc = new window.jspdf.jsPDF();
    if (s.logoDataUrl) {
      try { doc.addImage(s.logoDataUrl, "JPEG", 14, 8, 16, 16); } catch (e) { /* unsupported image format, skip */ }
    }
    doc.setFontSize(14);
    doc.text(forPdf(s.storeName || "Lakshmi Fancy Store"), s.logoDataUrl ? 34 : 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(forPdf([s.address || "", s.phone || ""].filter(Boolean).join(" | ")), s.logoDataUrl ? 34 : 14, 20);
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(forPdf(title), 14, 34);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(forPdf("Generated on " + new Date().toLocaleString("en-IN")), 14, 40);
    doc.setTextColor(0);
    let startY = 46;
    if (summaryLines && summaryLines.length) {
      doc.setFontSize(9);
      doc.setTextColor(40);
      let y = 47;
      summaryLines.forEach(line => { doc.text(forPdf(line), 14, y); y += 5; });
      doc.setTextColor(0);
      startY = y + 3;
    }
    if (doc.autoTable) {
      doc.autoTable({
        startY,
        head: [cols.map(c => forPdf(c.label))],
        body: (rows || []).map(r => cols.map(c => forPdf((r[c.key] !== undefined && r[c.key] !== null) ? r[c.key] : ""))),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [122, 30, 61] }
      });
    }
    doc.save(title.replace(/[^\w]+/g, "_").toLowerCase() + ".pdf");
  }

  /* ---------- printable reports (logo + store name + date/time header) ----------
     Opens the report in a new tab and triggers print; from that dialog the
     user can also choose "Save as PDF".
  */
  function tableHtml(rows, columns) {
    const cols = columns || (rows && rows[0] ? Object.keys(rows[0]).map(k => ({ key: k, label: k })) : []);
    const body = (rows || []).map(r => `<tr>${cols.map(c => `<td>${r[c.key] !== undefined && r[c.key] !== null ? r[c.key] : ""}</td>`).join("")}</tr>`).join("")
      || `<tr><td colspan="${cols.length || 1}">No records.</td></tr>`;
    return `<table><thead><tr>${cols.map(c => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function printReport(title, innerHtml) {
    const s = get("lfs_settings");
    const t = { ...DEFAULT_THEME, ...(s.theme || {}) };
    const pair = FONT_PAIRS[t.fontPair] || FONT_PAIRS.classic;
    const now = new Date();
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups to print reports."); return; }
    const logo = s.logoDataUrl
      ? `<img src="${s.logoDataUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:52px;height:52px;border-radius:50%;background:${t.accent};color:${t.footer};display:flex;align-items:center;justify-content:center;font-family:${pair.display};font-weight:800;font-size:1.3rem;">${(s.storeName || "L").charAt(0)}</div>`;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} - ${s.storeName || "Lakshmi Fancy Store"}</title>
      <style>
        ${pair.google ? `@import url('https://fonts.googleapis.com/css2?${pair.google}&display=swap');` : ""}
        *{box-sizing:border-box;} body{font-family:${pair.body};color:${t.text};padding:28px;max-width:1000px;margin:0 auto;font-size:${FONT_SIZES[t.fontSize] || 16}px;}
        h1,h2,h3{font-family:${pair.display};color:${t.header};margin:.2em 0;}
        .rpt-header{display:flex;align-items:center;gap:14px;border-bottom:2px solid ${t.accent};padding-bottom:14px;margin-bottom:6px;}
        .rpt-header .meta{flex:1;}
        .rpt-header .sub{color:#6B5F52;font-size:.85rem;}
        .rpt-when{text-align:right;font-size:.8rem;color:#6B5F52;}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:.85rem;}
        th,td{border:1px solid #E4D9C7;padding:6px 8px;text-align:left;}
        th{background:${t.cardBg};color:${t.footer};}
        .rpt-title{margin:14px 0 4px;font-size:1.15rem;}
        .rpt-foot{margin-top:18px;font-size:.75rem;color:#6B5F52;text-align:center;}
        .rpt-summary{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0;}
        .rpt-summary div{background:${t.cardBg};border-radius:8px;padding:8px 12px;font-size:.85rem;}
        .rpt-summary strong{color:${t.header};}
        @media print{ .no-print{display:none;} body{padding:6px;} }
      </style></head><body>
      <div class="rpt-header">
        ${logo}
        <div class="meta">
          <h2 style="margin:0;">${s.storeName || "Lakshmi Fancy Store"}</h2>
          <div class="sub">${[s.address, s.phone, s.gstNumber ? "GSTIN: " + s.gstNumber : ""].filter(Boolean).join(" &middot; ")}</div>
        </div>
        <div class="rpt-when">Printed: ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN")}</div>
      </div>
      <h3 class="rpt-title">${title}</h3>
      ${innerHtml}
      <div class="rpt-foot">${s.storeName || "Lakshmi Fancy Store"} - Generated report, for internal use.</div>
      <div class="no-print" style="text-align:center;margin-top:16px;">
        <button onclick="window.print()" style="padding:8px 18px;border-radius:20px;border:1px solid ${t.header};background:${t.header};color:#fff;cursor:pointer;">Print / Save as PDF</button>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.focus(); }, 200); };</script>
      </body></html>
    `);
    win.document.close();
  }

  /* ---------- validation ---------- */

  const isValidPhone = (v) => /^[0-9]{10}$/.test(String(v || "").trim());
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  const isValidAmount = (v) => v !== "" && !isNaN(v) && Number(v) >= 0;

  /* ---------- auth ---------- */

  function checkPassword(input, settingsKey) {
    const settings = get("lfs_settings");
    const stored = settings[settingsKey];
    return String(input) === String(stored);
  }
  function isAuthed(flag) { return sessionStorage.getItem(flag) === "1"; }
  function setAuthed(flag) { sessionStorage.setItem(flag, "1"); }
  function logout(flag) { sessionStorage.removeItem(flag); }

  // Clears all app data in THIS browser and re-seeds fresh from the current
  // /data/*.json files on next load. Used by the "Trouble logging in? Reset
  // app data" recovery link - fixes the common case where a browser cached
  // an old password from testing an earlier version of the app, since
  // seedIfEmpty() never overwrites existing localStorage.
  function resetAppData() {
    ALL_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("lfs_last_modified");
    localStorage.removeItem("lfs_last_backup");
    localStorage.removeItem("lfs_last_autobackup_ts");
    sessionStorage.removeItem("lfs_auth_sales");
    sessionStorage.removeItem("lfs_auth_admin");
    sessionStorage.removeItem("lfs_auth_senddata");
    sessionStorage.removeItem("lfs_auth_gallery");
    sessionStorage.removeItem("lfs_current_employee");
    location.reload();
  }

  /* ---------- misc helpers ---------- */

  function formatMoney(n) {
    const num = Number(n) || 0;
    return "\u20B9" + num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function daysBetween(d1, d2) {
    const a = new Date(d1), b = new Date(d2);
    return Math.max(1, Math.round((b - a) / 86400000));
  }

  // The sales person currently "signed in" as, for the session (used to prefill
  // Daily Sales employee, Rental handledBy, and Daily Expenses loggedBy).
  function currentEmployeeName() { return sessionStorage.getItem("lfs_current_employee") || ""; }
  function setCurrentEmployeeName(name) { sessionStorage.setItem("lfs_current_employee", name || ""); }

  /* ---------- promotions / celebration discounts ----------
     Returns the single active promotion for today, or null. Only one
     promotion can ever be enabled at a time (enforced when admin saves/
     toggles a promotion), so this simply checks whether today matches
     the one that's currently enabled.
  */
  function activePromotionToday() {
    const promos = get("lfs_promotions").filter(p => p.enabled);
    const today = new Date();
    const todayISOStr = todayISO();
    let best = null;
    promos.forEach(p => {
      let active = false;
      if (p.recurring) {
        active = (today.getMonth() + 1) === Number(p.month) && today.getDate() === Number(p.day);
      } else if (p.fromDate || p.toDate) {
        active = (!p.fromDate || todayISOStr >= p.fromDate) && (!p.toDate || todayISOStr <= p.toDate);
      }
      if (active && (!best || Number(p.discountPercent) > Number(best.discountPercent))) best = p;
    });
    return best;
  }

  // Whether a promotion's scope covers this sale: module is "dailySale" or
  // "rental"; category is the item's category (e.g. "Imitation Jewellery").
  // Empty/missing scope arrays mean "applies to everything".
  function promotionAppliesTo(promo, module, category) {
    if (!promo) return false;
    const modules = promo.appliesToModules;
    const cats = promo.appliesToCategories;
    const moduleOk = !modules || !modules.length || modules.includes(module);
    const catOk = !cats || !cats.length || !category || cats.includes(category);
    return moduleOk && catOk;
  }

  function anyOtherPromotionEnabled(excludeId) {
    return get("lfs_promotions").some(p => p.enabled && p.id !== excludeId);
  }

  const PAYMENT_MODES = ["Cash", "GPay", "PhonePe", "Card", "Other UPI", "Other"];
  const REFERRAL_SOURCES = ["Walk-in / Passing by", "Google Search", "Instagram", "Facebook", "Friend / Family Referral", "Newspaper / Flyer Ad", "Repeat Customer", "Other"];

  // Formats an ISO timestamp (or Date) as IST date + time, regardless of the
  // viewing device's own timezone/locale - so every report shows the actual
  // shop-local time a sale/rental/expense happened.
  function formatIST(dateInput) {
    if (!dateInput) return "";
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "";
    const datePart = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
    const timePart = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
    return `${datePart}, ${timePart} IST`;
  }
  function nowISO() { return new Date().toISOString(); }

  /* ---------- Go to Top button ----------
     Shows a floating right-side button once the user has scrolled past the
     halfway point of the page, and scrolls smoothly back to top on click.
  */
  function initGoTop(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const onScroll = () => {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      if (scrollable < 200) { btn.classList.remove("visible"); return; }
      const halfway = scrollable / 2;
      if (window.scrollY > halfway) btn.classList.add("visible");
      else btn.classList.remove("visible");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }
  function scrollToTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }

  /* ---------- rental revenue accounting ----------
     A rental's `total` (and the balance shown at the POS) intentionally
     includes the refundable security deposit, because that's the actual
     amount collected at the counter. But the deposit is NOT revenue - it
     gets handed back when the item is returned. This computes the real
     "sale" amount: rental charge, minus discount, minus any referral
     commission owed - so reports never overstate revenue with money that
     has to be refunded.
  */
  function rentalNetRevenue(r) {
    if (!r) return 0;
    if (r.netRevenue !== undefined && r.netRevenue !== null) return Number(r.netRevenue) || 0;
    const charge = r.rentalCharge !== undefined ? Number(r.rentalCharge) : Number(r.dailyRate || 0) * Number(r.days || 0);
    const commission = r.referred ? Number(r.referralCommission || 0) : 0;
    return Math.max(0, charge - Number(r.discount || 0) - commission);
  }

  /* ---------- site-wide theme ----------
     Admin-configurable colors AND fonts, applied as CSS custom-property
     overrides on the document root (and a root font-size for the size
     control, since the whole stylesheet is built on rem units). Falls
     back to the built-in palette/fonts if unset.
  */
  const DEFAULT_THEME = {
    bg: "#FBF7F1", header: "#7A1E3D", footer: "#5A1530", accent: "#C9A24B",
    cardBg: "#F2EAE0", text: "#2A2118", secondary: "#3E6259",
    fontPair: "classic", fontSize: "medium"
  };
  const FONT_PAIRS = {
    classic: { label: "Classic (Playfair Display + Inter)", display: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif", google: "family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700" },
    modern: { label: "Modern (Poppins + Roboto)", display: "'Poppins', sans-serif", body: "'Roboto', sans-serif", google: "family=Poppins:wght@600;700;800&family=Roboto:wght@400;500;600;700" },
    elegant: { label: "Elegant (Cormorant Garamond + Lato)", display: "'Cormorant Garamond', Georgia, serif", body: "'Lato', sans-serif", google: "family=Cormorant+Garamond:wght@600;700&family=Lato:wght@400;700" },
    simple: { label: "Simple (System Fonts, no download)", display: "Georgia, 'Times New Roman', serif", body: "-apple-system, system-ui, Arial, sans-serif", google: "" }
  };
  const FONT_SIZES = { small: 14, medium: 16, large: 18, xlarge: 20 };

  function ensureGoogleFont(pairKey) {
    const pair = FONT_PAIRS[pairKey];
    if (!pair || !pair.google) return;
    const linkId = "lfs-dynamic-font-" + pairKey;
    if (document.getElementById(linkId)) return;
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?" + pair.google + "&display=swap";
    document.head.appendChild(link);
  }

  function applyTheme() {
    const s = get("lfs_settings");
    const t = { ...DEFAULT_THEME, ...(s.theme || {}) };
    const root = document.documentElement.style;
    root.setProperty("--ivory", t.bg);
    root.setProperty("--maroon", t.header);
    root.setProperty("--maroon-dark", t.footer);
    root.setProperty("--gold", t.accent);
    root.setProperty("--ivory-dim", t.cardBg);
    root.setProperty("--ink", t.text);
    root.setProperty("--teal", t.secondary);
    const pair = FONT_PAIRS[t.fontPair] || FONT_PAIRS.classic;
    root.setProperty("--font-display", pair.display);
    root.setProperty("--font-body", pair.body);
    ensureGoogleFont(t.fontPair);
    document.documentElement.style.fontSize = (FONT_SIZES[t.fontSize] || 16) + "px";
  }

  /* ---------- GitHub Sync (interim manual push) ----------
     Shared by Admin's "Backup & Export > GitHub Sync" (pushes everything)
     and the sales app's "Send Data" tab (pushes ONLY the modules sales
     staff actually generate). Deliberately scoped this way because a
     sales device's local cache of admin-owned config - store settings,
     staff records, promotions, loyalty rules, rental rates/commission,
     the image library - can be stale, and must never be allowed to
     overwrite what the admin actually configured. Sales devices may push
     sales/rentals/expenses/customers/customer-notes, and stock quantities
     (since every sale decrements them) - nothing else.
  */
  const SALES_PUSH_KEYS = ["lfs_sales", "lfs_rentals", "lfs_expenses", "lfs_customers", "lfs_customer_requests", "lfs_inventory", "lfs_sync_log"];

  function getGithubConfig() {
    try { return JSON.parse(localStorage.getItem("lfs_github_config") || "{}"); } catch (e) { return {}; }
  }
  function saveGithubConfig(cfg) {
    localStorage.setItem("lfs_github_config", JSON.stringify(cfg));
  }
  function getGithubToken() {
    return localStorage.getItem("lfs_github_token") || "";
  }
  function setGithubToken(token) {
    if (token) localStorage.setItem("lfs_github_token", token);
  }
  function clearGithubToken() {
    localStorage.removeItem("lfs_github_token");
  }
  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  // Pushes the given storage keys to GitHub via the Contents API (create or
  // update, sequentially to stay well under rate limits). `onLog(line, isError)`
  // is called after each file. Resolves to { successCount, failCount }.
  function base64ToUtf8(b64) {
    return decodeURIComponent(escape(atob(String(b64).replace(/\n/g, ""))));
  }

  // Merges two arrays of records (each with an `id`) so a push never
  // silently deletes a record another device added. Where the same id
  // exists on both sides (a genuine edit conflict - e.g. the same
  // customer's points changed on two devices), the more recently touched
  // version wins, judged by `updatedAt`/`createdAt` if present.
  function mergeRecordsById(remoteArr, localArr) {
    const byId = new Map();
    (remoteArr || []).forEach(r => { if (r && r.id) byId.set(r.id, r); });
    (localArr || []).forEach(l => {
      if (!l || !l.id) return;
      const existing = byId.get(l.id);
      if (!existing) { byId.set(l.id, l); return; }
      const tRemote = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
      const tLocal = new Date(l.updatedAt || l.createdAt || 0).getTime() || 0;
      byId.set(l.id, tLocal >= tRemote ? l : existing);
    });
    return Array.from(byId.values());
  }

  async function pushKeysToGithub(keys, token, cfg, onLog) {
    const owner = (cfg.owner || "").trim();
    const repo = (cfg.repo || "").trim();
    const branch = (cfg.branch || "main").trim();
    const pathPrefix = ((cfg.pathPrefix || "data").trim()).replace(/\/$/, "");
    let successCount = 0, failCount = 0;

    for (const key of keys) {
      const filename = SEED_MAP[key].split("/").pop();
      const filePath = pathPrefix + "/" + filename;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
      try {
        let sha = null;
        let remoteValue = null;
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
        });
        if (getRes.ok) {
          const getData = await getRes.json();
          sha = getData.sha;
          try { remoteValue = JSON.parse(base64ToUtf8(getData.content)); } catch (e) { remoteValue = null; }
        } else if (getRes.status !== 404) {
          const errData = await getRes.json().catch(() => ({}));
          throw new Error(`check failed (${getRes.status}): ${errData.message || getRes.statusText}`);
        }

        // Merge record-by-record (never a blind overwrite) whenever both
        // sides are arrays of id'd records - covers sales, rentals,
        // expenses, customers, customer notes, inventory, and every
        // admin-only list too. Also writes the merged result back to this
        // device, so a push doubles as picking up what other devices added.
        let finalValue = get(key);
        const localValue = get(key);
        if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
          finalValue = mergeRecordsById(remoteValue, localValue);
          set(key, finalValue);
        }

        const content = JSON.stringify(finalValue, null, 2);
        const body = { message: `Update ${filePath} via Lakshmi Fancy Store sync`, content: utf8ToBase64(content), branch };
        if (sha) body.sha = sha;
        const putRes = await fetch(apiUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(`push failed (${putRes.status}): ${errData.message || putRes.statusText}`);
        }
        if (onLog) onLog(`✓ ${filePath}`, false);
        successCount++;
      } catch (err) {
        if (onLog) onLog(`✗ ${filePath}: ${err.message}`, true);
        failCount++;
      }
    }
    return { successCount, failCount };
  }

  // Read-only fetch of a single key from GitHub, merged into (and saved
  // to) local storage - no push involved. Used for Admin to check the
  // sales sync log, or generally to pick up other devices' changes,
  // without also sending this device's own data anywhere.
  async function pullKeyFromGithub(key, token, cfg) {
    const owner = (cfg.owner || "").trim();
    const repo = (cfg.repo || "").trim();
    const branch = (cfg.branch || "main").trim();
    const pathPrefix = ((cfg.pathPrefix || "data").trim()).replace(/\/$/, "");
    const filename = SEED_MAP[key].split("/").pop();
    const filePath = pathPrefix + "/" + filename;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    });
    if (!getRes.ok) {
      if (getRes.status === 404) return get(key); // nothing pushed yet
      const errData = await getRes.json().catch(() => ({}));
      throw new Error(`fetch failed (${getRes.status}): ${errData.message || getRes.statusText}`);
    }
    const getData = await getRes.json();
    const remoteValue = JSON.parse(base64ToUtf8(getData.content));
    const localValue = get(key);
    const merged = (Array.isArray(remoteValue) && Array.isArray(localValue)) ? mergeRecordsById(remoteValue, localValue) : remoteValue;
    set(key, merged);
    return merged;
  }

  /* ---------- social link normalization ----------
     Admin can type a full URL or just a handle (e.g. "@lakshmifancystore")
     - this builds a sensible clickable link either way.
  */
  function normalizeSocialUrl(platform, value) {
    if (!value) return "";
    const v = String(value).trim();
    if (/^https?:\/\//i.test(v)) return v;
    const handle = v.replace(/^@/, "");
    switch (platform) {
      case "facebook": return "https://facebook.com/" + handle;
      case "instagram": return "https://instagram.com/" + handle;
      case "twitter": return "https://x.com/" + handle;
      case "whatsapp": return "https://wa.me/" + handle.replace(/\D/g, "");
      default: return v;
    }
  }

  /* ---------- shared business-style footer (social + contact us) ---------- */
  function paintFooter(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const s = get("lfs_settings");
    const social = s.social || {};
    const socialIcons = { facebook: "📘 Facebook", instagram: "📸 Instagram", twitter: "𝕏 Twitter/X", whatsapp: "💬 WhatsApp" };
    const socialLinks = Object.keys(socialIcons)
      .filter(k => social[k])
      .map(k => `<a href="${normalizeSocialUrl(k, social[k])}" target="_blank" rel="noopener">${socialIcons[k]}</a>`)
      .join("");
    const contactBits = [
      s.phone ? `📞 ${s.phone}` : "",
      s.email ? `✉️ ${s.email}` : "",
      s.address ? `📍 ${s.address}` : ""
    ].filter(Boolean).join(" &nbsp;&middot;&nbsp; ");
    el.innerHTML = `
      <div class="site-footer-inner">
        <div class="footer-store">
          <strong>${s.storeName || "Lakshmi Fancy Store"}</strong>
          ${s.gstNumber ? `<span class="text-soft"> &middot; GSTIN: ${s.gstNumber}</span>` : ""}
        </div>
        ${contactBits ? `<div class="footer-contact">${contactBits}</div>` : ""}
        ${socialLinks ? `<div class="footer-social">${socialLinks}</div>` : ""}
        <div class="footer-copy">&copy; ${new Date().getFullYear()} ${s.storeName || "Lakshmi Fancy Store"}. All rights reserved.</div>
      </div>
    `;
  }

  return {
    SEED_MAP, ALL_KEYS, init, get, set, uid,
    downloadJSON, exportModule, exportFullBackup, importModule, importFullBackup,
    scheduleAutoBackup, toCSV, downloadCSV, parseCSV, parseSpreadsheetFile,
    downloadPDF, printReport, tableHtml,
    isValidPhone, isValidEmail, isValidAmount,
    checkPassword, isAuthed, setAuthed, logout, resetAppData,
    formatMoney, todayISO, daysBetween, formatIST, nowISO, normalizeSocialUrl, paintFooter, initGoTop, scrollToTop,
    rentalNetRevenue, applyTheme, DEFAULT_THEME, FONT_PAIRS, FONT_SIZES,
    getGithubConfig, saveGithubConfig, getGithubToken, setGithubToken, clearGithubToken, pushKeysToGithub, pullKeyFromGithub, SALES_PUSH_KEYS,
    currentEmployeeName, setCurrentEmployeeName,
    activePromotionToday, promotionAppliesTo, anyOtherPromotionEnabled,
    PAYMENT_MODES, REFERRAL_SOURCES
  };
})();

/* ---------- Tamil Nadu regional dropdown (Rajapalayam taluk villages) ---------- */
const LFS_REGIONS = ["Rajapalayam","Achchandavilthan","Alagapuri RF","Ammapatti","Appaneri","Arasiyarpatti","Athikulam Sengulam","Ayaidharmam","Ayan Karisalkulam","Ayan Kollankondan","Chokkanathaputtur","Deyvendri","Gopalapuram","Govindanallur","Ilandaikulam","Ilandiraikondan","Kadambankulam","Kalathur","Keelrajakularaman","Khansabpuram","Kollankondan","Kollankondan R.F.","Kongalapuram","Korukkampatti","Kothankulam","Kothankulam RF","Kottaiyur","Kovilur","Kunnur","Kuruchiyarpatti","Kurukkalkulam","Maharajapuram","Malli","Mamsapuram","Marakalamkathan","Melapattamkarisalkulam","Melarajakularaman (Part)","Mullikulam","Muthusamipuram","Muthuvenkatarayapuram","Muvaraivenran","Nachchiyarkovil","Nallamangalam","Nallingaperi","Nathampatti","Pattakkulam Sallipatti","Pillaiyarkulam","Pillaiyarnatham","Pillaiyarnatham R.F.","Ponnangani","Pudupalaiyam","Pudupatti R.F.","Puthur","Puvani","Reghunathapuram","Rudrappanaickenpatti","S. Ammapatti","Sammandapuram","Sappaniparambu (R.F.)","Semmanandikarisalkulam","Settur RF","Sholapuram","Singammalpuram","Sivandipatti","Solaicheri","Srivilliputtur","Srivilliputtur R.F.","Sundarapandiyam","Sundararajapuram","Tadagannai Managaseri","Tenkarai","Terku Devadanam","Terkuvenganallur","Thambipatti","Thilakulam","Thulukkapatti","Tiruchalur","Vadagarai","Vadakku Venganallur","Vadakkudevadanam","Vadakkusrivilliputhur","Vadugapatti","Valaikkulam R.F.","Varagunaramapuram","Vellaipottal","Venkateswarapuram","Viluppanur","Watrap","Others"];

const LFS_ITEM_TYPES = ["Necklace Sets","Earrings (Jhumkas)","Stud Earrings","Bangles (Set of 2/4)","Bracelets","Rings","Anklets (Payal)","Maang Tikka / Matha Patti","Nose Pins / Nose Rings","Hair Clips & Pins","Hair Bands / Scrunchies","Brooches / Pins","Keychains","Mobile Charms / Phone Accessories","Handbags / Clutches (Small Fancy)","Wallets / Coin Purses","Photo Frames (Decorative)","Showpieces / Figurines","Candles & Candle Holders","Artificial Flowers / Garlands","Gift Boxes & Wrapping Items","Makeup Accessories (Compact Mirrors, Brushes)","Perfume / Attar Mini Bottles","Beads & Craft Materials","Imitation Pearl Sets","Kundan / Polki Style Jewellery","Temple Jewellery (Imitation)","Oxidised Silver Look Jewellery","Kids Jewellery Sets","Waist Belts / Kamarbandh","Others"];

const LFS_CATEGORIES = ["Imitation Jewellery","Accessories","Fancy Items","Others"];

const LFS_EVENT_TYPES = ["Marriage","Baby Shower","Reception","Engagement","Naming Ceremony","Others"];

/* Build marker - open DevTools Console on any device and check this value
   against the version query string on index.html/admin.html's <script> tags
   to confirm the browser isn't showing a stale cached copy of the app. */
const LFS_BUILD_VERSION = "2026-08-23";
console.info("Lakshmi Fancy Store build:", LFS_BUILD_VERSION);

/* Shared recovery action wired to the "Trouble logging in?" link on both
   login screens. Clears this browser's cached data (including any stale
   password from an earlier version of the app) and reloads to re-seed
   fresh from the current /data/*.json files. */
function confirmResetAppData(e) {
  if (e) e.preventDefault();
  const ok = confirm(
    "This clears all locally saved data on THIS device/browser (sales, rentals, stock, passwords, etc.) " +
    "and reloads fresh from the deployed data files.\n\n" +
    "Only do this if you're stuck at login or the device has out-of-date info - it does NOT affect other devices. " +
    "Continue?"
  );
  if (ok) LFS.resetAppData();
}
