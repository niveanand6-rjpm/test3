/* ============================================================
   Lakshmi Fancy Store - admin.js (admin.html)
   ============================================================ */

let ADMIN_MODULE = "stock";
let STAFF_SUBTAB = "profiles";
let EXPENSE_SUBTAB = "log";
let EDIT_STOCK_ID = null;
let EDIT_RENTAL_ID = null;
let EDIT_STAFF_ID = null;
let EDIT_CUSTOMER_ID = null;
let EDIT_PROMO_ID = null;
let STOCK_PICKED_IMAGE = null;   // dataURL chosen from Image Portal, takes effect if no new file uploaded
let RENTAL_PICKED_IMAGE = null;
let IMAGE_PICKER_CONTEXT = null; // 'stock' | 'rental'
let CHART_REFS = {};
let SALES_CHART_YEAR = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", async () => {
  await LFS.init();
  LFS.scheduleAutoBackup();
  paintAdminHeader();
  if (LFS.isAuthed("lfs_auth_admin")) showAdminApp(); else showAdminLogin();
});

function paintAdminHeader() {
  const s = LFS.get("lfs_settings");
  document.title = (s.storeName || "Lakshmi Fancy Store") + " - Admin";
  const nameSlot = document.getElementById("adminStoreName");
  if (nameSlot) nameSlot.textContent = (s.storeName || "Lakshmi Fancy Store") + " · Admin Console";
}

function showAdminLogin() {
  document.getElementById("adminLoginScreen").classList.remove("hidden");
  document.getElementById("adminAppScreen").classList.add("hidden");
}
function showAdminApp() {
  document.getElementById("adminLoginScreen").classList.add("hidden");
  document.getElementById("adminAppScreen").classList.remove("hidden");
  renderAdminModule();
}
function attemptAdminLogin(e) {
  e.preventDefault();
  const pw = document.getElementById("adminLoginPassword").value;
  if (LFS.checkPassword(pw, "adminPassword")) {
    LFS.setAuthed("lfs_auth_admin");
    document.getElementById("adminLoginError").classList.add("hidden");
    showAdminApp();
  } else {
    document.getElementById("adminLoginError").classList.remove("hidden");
  }
}
function adminLogout() { LFS.logout("lfs_auth_admin"); showAdminLogin(); }

/* ---------- module switching ---------- */
function switchAdminModule(mod) {
  ADMIN_MODULE = mod;
  document.querySelectorAll(".tab-btn[data-mod]").forEach(b => b.classList.toggle("active", b.dataset.mod === mod));
  renderAdminModule();
}

const ADMIN_RENDERERS = {
  stock: renderStockModule,
  rentalInv: renderRentalInvModule,
  images: renderImagesModule,
  staff: renderStaffModule,
  expenses: renderExpensesModule,
  usage: renderUsageModule,
  salesReport: renderSalesReportModule,
  customers: renderCustomersModule,
  loyalty: renderLoyaltyModule,
  promotions: renderPromotionsModule,
  personalization: renderPersonalizationModule,
  security: renderSecurityModule,
  backup: renderBackupModule
};

function renderAdminModule() {
  document.getElementById("adminMain").innerHTML = ADMIN_RENDERERS[ADMIN_MODULE]();
  wireAdminEvents();
  if (ADMIN_MODULE === "salesReport") setTimeout(initSalesCharts, 0);
}

function wireAdminEvents() {
  document.querySelectorAll("[data-subtab-group]").forEach(b => {
    b.addEventListener("click", () => {
      const group = b.dataset.subtabGroup;
      if (group === "staff") STAFF_SUBTAB = b.dataset.sub;
      if (group === "expenses") EXPENSE_SUBTAB = b.dataset.sub;
      renderAdminModule();
    });
  });
  const forms = ["stockForm", "rentalInvForm", "staffForm", "attendanceForm", "expenseForm", "customerForm", "loyaltyForm", "personalizationForm", "securityForm", "promoForm", "imageUploadForm"];
  forms.forEach(id => {
    const f = document.getElementById(id);
    if (f) f.addEventListener("submit", FORM_HANDLERS[id]);
  });
}

/* helpers */
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function readImageAsDataURL(input, cb) {
  if (!input.files || !input.files[0]) { cb(""); return; }
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(input.files[0]);
}

/* ============================================================
   IMAGE PORTAL
   ============================================================ */
function renderImagesModule() {
  const images = LFS.get("lfs_images").slice().reverse();
  return `
    <div class="card">
      <h2>Image Portal</h2>
      <p class="text-soft">Upload jewellery / item photos once here, then pick them from the library when adding Stock or Rental Inventory items - no need to re-upload the same photo each time.</p>
      <form id="imageUploadForm">
        <div class="field"><label>Upload Image(s)</label><input type="file" id="imgUploadInput" accept="image/*" multiple required></div>
        <button class="btn btn-primary" type="submit">Add to Library</button>
      </form>
    </div>
    <div class="card">
      <h3>Library (${images.length})</h3>
      <div class="gallery-grid">
        ${images.map(img => `
          <div class="gallery-item">
            <button class="del-btn" onclick="deleteLibraryImage('${img.id}')" title="Delete">&times;</button>
            <img src="${img.dataUrl}" alt="${escapeHtml(img.name)}">
            <div class="cap">${escapeHtml(img.name)}</div>
          </div>
        `).join("") || `<p class="text-soft">No images uploaded yet.</p>`}
      </div>
    </div>
  `;
}
function saveImageUpload(e) {
  e.preventDefault();
  const input = document.getElementById("imgUploadInput");
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const images = LFS.get("lfs_images");
  let remaining = files.length;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      images.push({ id: LFS.uid("img"), name: file.name.replace(/\.[^.]+$/, ""), dataUrl: reader.result, uploadedAt: new Date().toISOString() });
      remaining--;
      if (remaining === 0) {
        LFS.set("lfs_images", images);
        toast("Image(s) added to library");
        renderAdminModule();
      }
    };
    reader.readAsDataURL(file);
  });
}
function deleteLibraryImage(id) {
  if (!confirm("Delete this image from the library?")) return;
  LFS.set("lfs_images", LFS.get("lfs_images").filter(i => i.id !== id));
  toast("Image deleted");
  renderAdminModule();
}

function openImagePicker(context) {
  IMAGE_PICKER_CONTEXT = context;
  const images = LFS.get("lfs_images");
  const holder = document.getElementById("modalHolder") || (() => {
    const d = document.createElement("div"); d.id = "modalHolder"; document.body.appendChild(d); return d;
  })();
  holder.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeImagePicker()">
      <div class="modal" style="max-width:560px;">
        <button class="modal-close" onclick="closeImagePicker()">&times;</button>
        <h3>Choose an Image</h3>
        ${images.length ? `<div class="gallery-grid mt-8">${images.map(img => `
          <div class="gallery-item" onclick="pickLibraryImage('${img.id}')">
            <img src="${img.dataUrl}" alt="${escapeHtml(img.name)}">
            <div class="cap">${escapeHtml(img.name)}</div>
          </div>`).join("")}</div>` : `<p class="text-soft">No images in the library yet. Upload some from the Image Portal tab.</p>`}
      </div>
    </div>
  `;
}
function closeImagePicker() {
  const holder = document.getElementById("modalHolder");
  if (holder) holder.innerHTML = "";
}
function pickLibraryImage(imageId) {
  const img = LFS.get("lfs_images").find(i => i.id === imageId);
  if (!img) return;
  if (IMAGE_PICKER_CONTEXT === "stock") {
    STOCK_PICKED_IMAGE = img.dataUrl;
    const prev = document.getElementById("stkLibPreview");
    if (prev) prev.innerHTML = `<img src="${img.dataUrl}">`;
  } else if (IMAGE_PICKER_CONTEXT === "rental") {
    RENTAL_PICKED_IMAGE = img.dataUrl;
    const prev = document.getElementById("rivLibPreview");
    if (prev) prev.innerHTML = `<img src="${img.dataUrl}">`;
  }
  closeImagePicker();
  toast("Image selected from library");
}

/* ============================================================
   STOCK MANAGEMENT (daily-sale items)
   ============================================================ */
function renderStockModule() {
  const items = LFS.get("lfs_inventory");
  const editing = EDIT_STOCK_ID ? items.find(i => i.id === EDIT_STOCK_ID) : null;
  return `
    <div class="card">
      <h2>${editing ? "Edit Stock Item" : "Add Stock Item"}</h2>
      <form id="stockForm">
        <input type="hidden" id="stkId" value="${editing ? editing.id : ""}">
        <div class="grid cols-2">
          <div class="field"><label>Item Name *</label><input type="text" id="stkName" required value="${editing ? escapeHtml(editing.itemName) : ""}"></div>
          <div class="field"><label>Item Code *</label><input type="text" id="stkCode" required value="${editing ? escapeHtml(editing.itemCode) : ""}"></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Category</label><select id="stkCategory">${LFS_CATEGORIES.map(c => `<option ${editing && editing.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label>Item Type</label><select id="stkType">${LFS_ITEM_TYPES.map(t => `<option ${editing && editing.itemType === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="grid cols-3">
          <div class="field"><label>Purchase Date</label><input type="date" id="stkPurchaseDate" value="${editing ? editing.purchaseDate : LFS.todayISO()}"></div>
          <div class="field"><label>Quantity Available *</label><input type="number" id="stkQty" min="0" required value="${editing ? editing.quantityAvailable : 0}"></div>
          <div class="field"><label>Price (₹) *</label><input type="number" id="stkPrice" min="0" required value="${editing ? editing.price : 0}"></div>
        </div>
        <div class="field">
          <label>Item Image</label>
          <div class="image-pick-row">
            <input type="file" id="stkImage" accept="image/*" style="flex:1;min-width:180px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openImagePicker('stock')">Choose from Library</button>
            <div class="image-pick-preview" id="stkLibPreview">${editing && editing.imageDataUrl ? `<img src="${editing.imageDataUrl}">` : ""}</div>
          </div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-primary" type="submit">${editing ? "Save Changes" : "Add Item"}</button>
          ${editing ? `<button type="button" class="btn btn-outline" onclick="EDIT_STOCK_ID=null;STOCK_PICKED_IMAGE=null;renderAdminModule();">Cancel</button>` : ""}
        </div>
      </form>
    </div>

    ${renderBulkUploadCard("stock")}

    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Stock List (${items.length})</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printStockReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadStockPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('inventory.csv', LFS.get('lfs_inventory'))">CSV</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.exportModule('lfs_inventory')">Export JSON</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Code</th><th>Category</th><th>Qty</th><th>Price</th><th></th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${escapeHtml(i.itemName)}</td><td class="mono">${i.itemCode}</td><td>${i.category}</td><td>${i.quantityAvailable}</td><td>${LFS.formatMoney(i.price)}</td>
                <td class="flex gap-8">
                  <button class="btn btn-outline btn-sm" onclick="EDIT_STOCK_ID='${i.id}';renderAdminModule();">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteStockItem('${i.id}')">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="6" class="text-soft">No items yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function saveStockItem(e) {
  e.preventDefault();
  const items = LFS.get("lfs_inventory");
  const id = document.getElementById("stkId").value;
  const build = (imageDataUrl) => {
    const finalImage = imageDataUrl || STOCK_PICKED_IMAGE || (id ? (items.find(i => i.id === id) || {}).imageDataUrl : "") || "";
    const data = {
      id: id || LFS.uid("inv"),
      itemName: document.getElementById("stkName").value.trim(),
      itemCode: document.getElementById("stkCode").value.trim(),
      category: document.getElementById("stkCategory").value,
      itemType: document.getElementById("stkType").value,
      purchaseDate: document.getElementById("stkPurchaseDate").value,
      quantityAvailable: Number(document.getElementById("stkQty").value) || 0,
      price: Number(document.getElementById("stkPrice").value) || 0,
      imageDataUrl: finalImage
    };
    if (id) { items[items.findIndex(i => i.id === id)] = data; } else { items.push(data); }
    LFS.set("lfs_inventory", items);
    EDIT_STOCK_ID = null;
    STOCK_PICKED_IMAGE = null;
    toast("Stock item saved");
    renderAdminModule();
  };
  readImageAsDataURL(document.getElementById("stkImage"), build);
}
function printStockReport() {
  const rows = LFS.get("lfs_inventory").map(i => ({ item: i.itemName, code: i.itemCode, category: i.category, type: i.itemType, qty: i.quantityAvailable, price: LFS.formatMoney(i.price) }));
  LFS.printReport("Stock Inventory Report", LFS.tableHtml(rows, [
    { key: "item", label: "Item" }, { key: "code", label: "Code" }, { key: "category", label: "Category" },
    { key: "type", label: "Type" }, { key: "qty", label: "Qty" }, { key: "price", label: "Price" }
  ]));
}
function downloadStockPDF() {
  const rows = LFS.get("lfs_inventory").map(i => ({ item: i.itemName, code: i.itemCode, category: i.category, qty: i.quantityAvailable, price: LFS.formatMoney(i.price) }));
  LFS.downloadPDF("Stock Inventory Report", rows, [
    { key: "item", label: "Item" }, { key: "code", label: "Code" }, { key: "category", label: "Category" },
    { key: "qty", label: "Qty" }, { key: "price", label: "Price" }
  ]);
}
function deleteStockItem(id) {
  if (!confirm("Delete this stock item?")) return;
  LFS.set("lfs_inventory", LFS.get("lfs_inventory").filter(i => i.id !== id));
  toast("Item deleted");
  renderAdminModule();
}

/* ============================================================
   RENTAL INVENTORY MANAGEMENT
   ============================================================ */
function renderRentalInvModule() {
  const items = LFS.get("lfs_rental_items");
  const editing = EDIT_RENTAL_ID ? items.find(i => i.id === EDIT_RENTAL_ID) : null;
  return `
    <div class="card">
      <h2>${editing ? "Edit Rental Item" : "Add Rental Jewellery Item"}</h2>
      <form id="rentalInvForm">
        <input type="hidden" id="rivId" value="${editing ? editing.id : ""}">
        <div class="grid cols-2">
          <div class="field"><label>Item Name *</label><input type="text" id="rivName" required value="${editing ? escapeHtml(editing.itemName) : ""}"></div>
          <div class="field"><label>Item Code *</label><input type="text" id="rivCode" required value="${editing ? escapeHtml(editing.itemCode) : ""}"></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Category</label><select id="rivCategory">${LFS_CATEGORIES.map(c => `<option ${editing && editing.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label>Item Type</label><select id="rivType">${LFS_ITEM_TYPES.map(t => `<option ${editing && editing.itemType === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Daily Rental Rate (₹) *</label><input type="number" id="rivRate" min="0" required value="${editing ? editing.dailyRate : 0}"></div>
          <div class="field"><label>Deposit (₹) *</label><input type="number" id="rivDeposit" min="0" required value="${editing ? editing.deposit : 0}"></div>
        </div>
        <p class="text-soft">First-time purchase details (for records only)</p>
        <div class="grid cols-3">
          <div class="field"><label>Purchased From</label><input type="text" id="rivFrom" value="${editing ? escapeHtml(editing.purchasedFrom || "") : ""}"></div>
          <div class="field"><label>Purchase Date</label><input type="date" id="rivPurchaseDate" value="${editing ? editing.purchaseDate || "" : LFS.todayISO()}"></div>
          <div class="field"><label>Purchase Price (₹)</label><input type="number" id="rivPurchasePrice" min="0" value="${editing ? editing.purchasePrice || 0 : 0}"></div>
        </div>
        <div class="field"><label>Warranty</label><input type="text" id="rivWarranty" placeholder="e.g. None / 6 months" value="${editing ? escapeHtml(editing.warranty || "") : ""}"></div>
        <div class="field">
          <label>Item Image</label>
          <div class="image-pick-row">
            <input type="file" id="rivImage" accept="image/*" style="flex:1;min-width:180px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openImagePicker('rental')">Choose from Library</button>
            <div class="image-pick-preview" id="rivLibPreview">${editing && editing.imageDataUrl ? `<img src="${editing.imageDataUrl}">` : ""}</div>
          </div>
        </div>
        <div class="field"><label>Status</label><select id="rivStatus"><option value="available" ${editing && editing.status === "available" ? "selected" : ""}>Available</option><option value="rented" ${editing && editing.status === "rented" ? "selected" : ""}>Rented</option></select></div>
        <div class="flex gap-8">
          <button class="btn btn-primary" type="submit">${editing ? "Save Changes" : "Add Item"}</button>
          ${editing ? `<button type="button" class="btn btn-outline" onclick="EDIT_RENTAL_ID=null;RENTAL_PICKED_IMAGE=null;renderAdminModule();">Cancel</button>` : ""}
        </div>
      </form>
    </div>

    ${renderBulkUploadCard("rental")}

    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Rental Master Data (${items.length})</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printRentalInvReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadRentalInvPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('rental_items.csv', LFS.get('lfs_rental_items'))">CSV</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.exportModule('lfs_rental_items')">Export JSON</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Code</th><th>Rate/Day</th><th>Deposit</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${escapeHtml(i.itemName)}</td><td class="mono">${i.itemCode}</td><td>${LFS.formatMoney(i.dailyRate)}</td><td>${LFS.formatMoney(i.deposit)}</td>
                <td><span class="badge ${i.status === 'available' ? 'badge-available' : 'badge-rented'}">${i.status}</span></td>
                <td class="flex gap-8">
                  <button class="btn btn-outline btn-sm" onclick="EDIT_RENTAL_ID='${i.id}';renderAdminModule();">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteRentalItem('${i.id}')">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="6" class="text-soft">No items yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function saveRentalItem(e) {
  e.preventDefault();
  const items = LFS.get("lfs_rental_items");
  const id = document.getElementById("rivId").value;
  const existing = id ? items.find(i => i.id === id) : null;
  const build = (imageDataUrl) => {
    const finalImage = imageDataUrl || RENTAL_PICKED_IMAGE || (existing ? existing.imageDataUrl : "") || "";
    const data = {
      id: id || LFS.uid("rit"),
      itemName: document.getElementById("rivName").value.trim(),
      itemCode: document.getElementById("rivCode").value.trim(),
      category: document.getElementById("rivCategory").value,
      itemType: document.getElementById("rivType").value,
      dailyRate: Number(document.getElementById("rivRate").value) || 0,
      deposit: Number(document.getElementById("rivDeposit").value) || 0,
      status: document.getElementById("rivStatus").value,
      purchasedFrom: document.getElementById("rivFrom").value.trim(),
      purchaseDate: document.getElementById("rivPurchaseDate").value,
      purchasePrice: Number(document.getElementById("rivPurchasePrice").value) || 0,
      warranty: document.getElementById("rivWarranty").value.trim(),
      imageDataUrl: finalImage,
      timesRented: existing ? existing.timesRented || 0 : 0,
      totalEarned: existing ? existing.totalEarned || 0 : 0
    };
    if (id) { items[items.findIndex(i => i.id === id)] = data; } else { items.push(data); }
    LFS.set("lfs_rental_items", items);
    EDIT_RENTAL_ID = null;
    RENTAL_PICKED_IMAGE = null;
    toast("Rental item saved");
    renderAdminModule();
  };
  readImageAsDataURL(document.getElementById("rivImage"), build);
}
function printRentalInvReport() {
  const rows = LFS.get("lfs_rental_items").map(i => ({ item: i.itemName, code: i.itemCode, rate: LFS.formatMoney(i.dailyRate), deposit: LFS.formatMoney(i.deposit), status: i.status }));
  LFS.printReport("Rental Inventory Report", LFS.tableHtml(rows, [
    { key: "item", label: "Item" }, { key: "code", label: "Code" }, { key: "rate", label: "Rate/Day" },
    { key: "deposit", label: "Deposit" }, { key: "status", label: "Status" }
  ]));
}
function downloadRentalInvPDF() {
  const rows = LFS.get("lfs_rental_items").map(i => ({ item: i.itemName, code: i.itemCode, rate: LFS.formatMoney(i.dailyRate), deposit: LFS.formatMoney(i.deposit), status: i.status }));
  LFS.downloadPDF("Rental Inventory Report", rows, [
    { key: "item", label: "Item" }, { key: "code", label: "Code" }, { key: "rate", label: "Rate/Day" },
    { key: "deposit", label: "Deposit" }, { key: "status", label: "Status" }
  ]);
}
function deleteRentalItem(id) {
  if (!confirm("Delete this rental item?")) return;
  LFS.set("lfs_rental_items", LFS.get("lfs_rental_items").filter(i => i.id !== id));
  toast("Item deleted");
  renderAdminModule();
}

/* ============================================================
   BULK CSV / EXCEL UPLOAD (Stock + Rental Inventory)
   ============================================================ */
function renderBulkUploadCard(type) {
  const isStock = type === "stock";
  const cols = isStock
    ? "itemName, itemCode, category, itemType, purchaseDate, quantityAvailable, price"
    : "itemName, itemCode, category, itemType, dailyRate, deposit, purchasedFrom, purchaseDate, purchasePrice, warranty, status";
  return `
    <div class="card">
      <h3>Bulk Upload / Update ${isStock ? "Stock" : "Rental Inventory"} (CSV or Excel)</h3>
      <p class="text-soft">Upload a spreadsheet to add many items at once, or update existing ones (matched by <code>itemCode</code>).</p>
      <div class="flex gap-8" style="flex-wrap:wrap;">
        <input type="file" id="bulkFile_${type}" accept=".csv,.xlsx,.xls" style="flex:1;min-width:200px;">
        <button type="button" class="btn btn-primary btn-sm" onclick="runBulkUpload('${type}')">Upload &amp; Import</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="downloadBulkTemplate('${type}')">Download CSV Template</button>
      </div>
      <div id="bulkResult_${type}"></div>
      <details class="help-panel">
        <summary>Help - required columns</summary>
        <div class="help-body">
          <p>Your file's first row must be a header row with these exact column names:</p>
          <p><code>${cols}</code></p>
          <ul>
            <li><code>itemName</code> and <code>itemCode</code> are required for every row. <code>itemCode</code> is the unique key used to match existing items for updates.</li>
            <li><code>category</code> must be one of: ${LFS_CATEGORIES.join(", ")}.</li>
            <li><code>itemType</code> must be one of the standard item types (e.g. "Necklace Sets", "Bangles (Set of 2/4)") - see the Stock/Rental form dropdown for the full list.</li>
            <li>${isStock ? '<code>quantityAvailable</code> and <code>price</code>' : '<code>dailyRate</code> and <code>deposit</code>'} must be numbers, 0 or greater.</li>
            <li>Dates use <code>YYYY-MM-DD</code> format; leave blank to default to today.</li>
            ${isStock ? "" : `<li><code>status</code> is optional - "available" or "rented" (defaults to "available").</li>`}
          </ul>
          <p>If any row fails validation, the whole file is rejected and the exact row/column errors are listed so you can fix and re-upload.</p>
        </div>
      </details>
    </div>
  `;
}

function downloadBulkTemplate(type) {
  const rows = type === "stock"
    ? [{ itemName: "Oxidised Jhumka Earrings", itemCode: "EAR-099", category: "Imitation Jewellery", itemType: "Earrings (Jhumkas)", purchaseDate: "2026-08-01", quantityAvailable: 10, price: 180 }]
    : [{ itemName: "Bridal Necklace Set", itemCode: "RNS-099", category: "Imitation Jewellery", itemType: "Necklace Sets", dailyRate: 500, deposit: 3000, purchasedFrom: "Wholesale Vendor", purchaseDate: "2026-08-01", purchasePrice: 4000, warranty: "None", status: "available" }];
  LFS.downloadCSV(`${type}_bulk_template.csv`, rows);
}

function validateBulkRows(type, rows) {
  const errors = [];
  const isStock = type === "stock";
  const requiredCols = isStock
    ? ["itemName", "itemCode", "category", "itemType", "quantityAvailable", "price"]
    : ["itemName", "itemCode", "category", "itemType", "dailyRate", "deposit"];

  if (!rows.length) { errors.push("The file has no data rows."); return { errors, clean: [] }; }
  const headerCols = Object.keys(rows[0]);
  requiredCols.forEach(c => { if (!headerCols.includes(c)) errors.push(`Missing required column "${c}" in the header row.`); });
  if (errors.length) return { errors, clean: [] };

  const clean = [];
  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // header is row 1
    const rowErrors = [];
    if (!String(r.itemName || "").trim()) rowErrors.push(`Row ${rowNum}: itemName is required`);
    if (!String(r.itemCode || "").trim()) rowErrors.push(`Row ${rowNum}: itemCode is required`);
    if (r.category && !LFS_CATEGORIES.includes(r.category)) rowErrors.push(`Row ${rowNum}: category "${r.category}" is not one of ${LFS_CATEGORIES.join(", ")}`);
    if (r.itemType && !LFS_ITEM_TYPES.includes(r.itemType)) rowErrors.push(`Row ${rowNum}: itemType "${r.itemType}" is not a recognised item type`);
    if (isStock) {
      if (r.quantityAvailable === undefined || r.quantityAvailable === "" || isNaN(r.quantityAvailable) || Number(r.quantityAvailable) < 0) rowErrors.push(`Row ${rowNum}: quantityAvailable must be a number 0 or greater`);
      if (r.price === undefined || r.price === "" || isNaN(r.price) || Number(r.price) < 0) rowErrors.push(`Row ${rowNum}: price must be a number 0 or greater`);
    } else {
      if (r.dailyRate === undefined || r.dailyRate === "" || isNaN(r.dailyRate) || Number(r.dailyRate) < 0) rowErrors.push(`Row ${rowNum}: dailyRate must be a number 0 or greater`);
      if (r.deposit === undefined || r.deposit === "" || isNaN(r.deposit) || Number(r.deposit) < 0) rowErrors.push(`Row ${rowNum}: deposit must be a number 0 or greater`);
      if (r.status && !["available", "rented"].includes(String(r.status).toLowerCase())) rowErrors.push(`Row ${rowNum}: status must be "available" or "rented"`);
    }
    if (rowErrors.length) { errors.push(...rowErrors); return; }
    clean.push(r);
  });
  return { errors, clean };
}

function runBulkUpload(type) {
  const input = document.getElementById(`bulkFile_${type}`);
  const resultSlot = document.getElementById(`bulkResult_${type}`);
  if (!input.files[0]) { toast("Choose a file first"); return; }
  LFS.parseSpreadsheetFile(input.files[0]).then(rows => {
    const { errors, clean } = validateBulkRows(type, rows);
    if (errors.length) {
      resultSlot.innerHTML = `<ul class="error-list">${errors.slice(0, 30).map(e => `<li>${escapeHtml(e)}</li>`).join("")}${errors.length > 30 ? `<li>...and ${errors.length - 30} more errors.</li>` : ""}</ul>`;
      return;
    }
    const key = type === "stock" ? "lfs_inventory" : "lfs_rental_items";
    const existing = LFS.get(key);
    let added = 0, updated = 0;
    clean.forEach(r => {
      const idx = existing.findIndex(x => x.itemCode === r.itemCode);
      const base = type === "stock" ? {
        itemName: r.itemName, itemCode: r.itemCode, category: r.category || LFS_CATEGORIES[0], itemType: r.itemType || LFS_ITEM_TYPES[0],
        purchaseDate: r.purchaseDate || LFS.todayISO(), quantityAvailable: Number(r.quantityAvailable), price: Number(r.price),
        imageDataUrl: idx >= 0 ? existing[idx].imageDataUrl : ""
      } : {
        itemName: r.itemName, itemCode: r.itemCode, category: r.category || LFS_CATEGORIES[0], itemType: r.itemType || LFS_ITEM_TYPES[0],
        dailyRate: Number(r.dailyRate), deposit: Number(r.deposit), status: (r.status || "available").toLowerCase(),
        purchasedFrom: r.purchasedFrom || "", purchaseDate: r.purchaseDate || LFS.todayISO(), purchasePrice: Number(r.purchasePrice) || 0, warranty: r.warranty || "",
        imageDataUrl: idx >= 0 ? existing[idx].imageDataUrl : "",
        timesRented: idx >= 0 ? existing[idx].timesRented || 0 : 0, totalEarned: idx >= 0 ? existing[idx].totalEarned || 0 : 0
      };
      if (idx >= 0) { existing[idx] = { ...existing[idx], ...base, id: existing[idx].id }; updated++; }
      else { existing.push({ ...base, id: LFS.uid(type === "stock" ? "inv" : "rit") }); added++; }
    });
    LFS.set(key, existing);
    resultSlot.innerHTML = `<div class="success-note">Import complete: ${added} added, ${updated} updated.</div>`;
    setTimeout(renderAdminModule, 900);
  }).catch(err => {
    resultSlot.innerHTML = `<ul class="error-list"><li>${escapeHtml(err.message || String(err))}</li></ul>`;
  });
}

/* ============================================================
   STAFF MANAGEMENT (Profiles + Attendance/Leave payroll)
   ============================================================ */
function currentMonthStr(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}
function countLeaves(staffId, monthStr) {
  return LFS.get("lfs_attendance").filter(a => a.staffId === staffId && a.type === "leave" && a.date.slice(0, 7) === monthStr).length;
}
function payrollFor(staff, monthStr) {
  const leaves = countLeaves(staff.id, monthStr);
  const perDay = staff.monthlySalary / 30;
  const excess = Math.max(0, leaves - 4);
  const deduction = Math.round(excess * perDay);
  const finalSalary = Math.max(0, Math.round(staff.monthlySalary - deduction));
  return { leaves, perDay: Math.round(perDay), excess, deduction, finalSalary };
}

function renderStaffModule() {
  return `
    <div class="subtab-nav" style="padding:0 0 12px;">
      <button class="subtab-btn ${STAFF_SUBTAB === "profiles" ? "active" : ""}" data-subtab-group="staff" data-sub="profiles">Employee Profiles</button>
      <button class="subtab-btn ${STAFF_SUBTAB === "attendance" ? "active" : ""}" data-subtab-group="staff" data-sub="attendance">Attendance &amp; Leave</button>
    </div>
    ${STAFF_SUBTAB === "profiles" ? renderStaffProfiles() : renderStaffAttendance()}
  `;
}

function renderStaffProfiles() {
  const staff = LFS.get("lfs_staff");
  const editing = EDIT_STAFF_ID ? staff.find(s => s.id === EDIT_STAFF_ID) : null;
  return `
    <div class="card">
      <h2>${editing ? "Edit Employee" : "Add Employee"}</h2>
      <form id="staffForm">
        <input type="hidden" id="stfId" value="${editing ? editing.id : ""}">
        <div class="grid cols-2">
          <div class="field"><label>Name *</label><input type="text" id="stfName" required value="${editing ? escapeHtml(editing.name) : ""}"></div>
          <div class="field"><label>Phone</label><input type="tel" id="stfPhone" maxlength="10" value="${editing ? editing.phone : ""}"></div>
        </div>
        <div class="grid cols-3">
          <div class="field"><label>Role</label><input type="text" id="stfRole" value="${editing ? escapeHtml(editing.role || "") : "Sales Associate"}"></div>
          <div class="field"><label>Monthly Salary (₹) *</label><input type="number" id="stfSalary" min="0" required value="${editing ? editing.monthlySalary : 0}"></div>
          <div class="field"><label>Join Date</label><input type="date" id="stfJoinDate" value="${editing ? editing.joinDate : LFS.todayISO()}"></div>
        </div>
        <div class="field"><label><input type="checkbox" id="stfActive" ${!editing || editing.active ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Active employee</label></div>
        <div class="flex gap-8">
          <button class="btn btn-primary" type="submit">${editing ? "Save Changes" : "Add Employee"}</button>
          ${editing ? `<button type="button" class="btn btn-outline" onclick="EDIT_STAFF_ID=null;renderAdminModule();">Cancel</button>` : ""}
        </div>
      </form>
    </div>
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Employees (${staff.length})</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printStaffReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadStaffPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.exportModule('lfs_staff')">Export JSON</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Salary</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${staff.map(s => `
              <tr>
                <td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.role || "")}</td><td>${s.phone || "-"}</td><td>${LFS.formatMoney(s.monthlySalary)}</td>
                <td><span class="badge ${s.active ? 'badge-available' : 'badge-neutral'}">${s.active ? "Active" : "Inactive"}</span></td>
                <td class="flex gap-8">
                  <button class="btn btn-outline btn-sm" onclick="EDIT_STAFF_ID='${s.id}';renderAdminModule();">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteStaff('${s.id}')">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="6" class="text-soft">No employees yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function saveStaff(e) {
  e.preventDefault();
  const staff = LFS.get("lfs_staff");
  const id = document.getElementById("stfId").value;
  const data = {
    id: id || LFS.uid("stf"),
    name: document.getElementById("stfName").value.trim(),
    phone: document.getElementById("stfPhone").value.trim(),
    role: document.getElementById("stfRole").value.trim(),
    monthlySalary: Number(document.getElementById("stfSalary").value) || 0,
    joinDate: document.getElementById("stfJoinDate").value,
    active: document.getElementById("stfActive").checked
  };
  if (id) staff[staff.findIndex(s => s.id === id)] = data; else staff.push(data);
  LFS.set("lfs_staff", staff);
  EDIT_STAFF_ID = null;
  toast("Employee saved");
  renderAdminModule();
}
function printStaffReport() {
  const rows = LFS.get("lfs_staff").map(s => ({ name: s.name, role: s.role || "", phone: s.phone || "-", salary: LFS.formatMoney(s.monthlySalary), status: s.active ? "Active" : "Inactive" }));
  LFS.printReport("Employee Profiles Report", LFS.tableHtml(rows, [
    { key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "phone", label: "Phone" }, { key: "salary", label: "Salary" }, { key: "status", label: "Status" }
  ]));
}
function downloadStaffPDF() {
  const rows = LFS.get("lfs_staff").map(s => ({ name: s.name, role: s.role || "", phone: s.phone || "-", salary: LFS.formatMoney(s.monthlySalary), status: s.active ? "Active" : "Inactive" }));
  LFS.downloadPDF("Employee Profiles Report", rows, [
    { key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "phone", label: "Phone" }, { key: "salary", label: "Salary" }, { key: "status", label: "Status" }
  ]);
}
function deleteStaff(id) {
  if (!confirm("Remove this employee record?")) return;
  LFS.set("lfs_staff", LFS.get("lfs_staff").filter(s => s.id !== id));
  toast("Employee removed");
  renderAdminModule();
}

function renderStaffAttendance() {
  const staff = LFS.get("lfs_staff");
  const thisMonth = currentMonthStr(0);
  const lastMonth = currentMonthStr(-1);
  return `
    <div class="card">
      <h2>Log a Leave Day</h2>
      <form id="attendanceForm">
        <div class="grid cols-3">
          <div class="field"><label>Employee</label><select id="attStaff">${staff.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Date</label><input type="date" id="attDate" value="${LFS.todayISO()}"></div>
          <div class="field"><label>Reason</label><input type="text" id="attReason" placeholder="e.g. Sick, Personal"></div>
        </div>
        <button class="btn btn-primary" type="submit">Log Leave</button>
      </form>
    </div>
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Leave &amp; Salary Summary</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printAttendanceReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadAttendancePDF()">PDF</button>
        </div>
      </div>
      <p class="text-soft">Employees may take up to 4 leave days per month without deduction. Beyond that, each extra day is deducted at (monthly salary ÷ 30) per day.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Leaves - ${lastMonth}</th><th>Leaves - ${thisMonth}</th><th>Per-day Rate</th><th>Deduction (this month)</th><th>Final Salary (this month)</th></tr></thead>
          <tbody>
            ${staff.map(s => {
              const cur = payrollFor(s, thisMonth);
              const lastLeaves = countLeaves(s.id, lastMonth);
              return `<tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${lastLeaves}</td>
                <td>${cur.leaves}${cur.excess > 0 ? ` <span class="badge badge-rented">${cur.excess} over limit</span>` : ""}</td>
                <td>${LFS.formatMoney(cur.perDay)}</td>
                <td>${LFS.formatMoney(cur.deduction)}</td>
                <td style="font-weight:700;color:var(--maroon);">${LFS.formatMoney(cur.finalSalary)}</td>
              </tr>`;
            }).join("") || `<tr><td colspan="6" class="text-soft">No employees yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function attendanceRows() {
  const staff = LFS.get("lfs_staff");
  const thisMonth = currentMonthStr(0);
  return staff.map(s => {
    const p = payrollFor(s, thisMonth);
    return { employee: s.name, salary: LFS.formatMoney(s.monthlySalary), leaves: p.leaves, deduction: LFS.formatMoney(p.deduction), payable: LFS.formatMoney(p.finalSalary) };
  });
}
function printAttendanceReport() {
  const thisMonth = currentMonthStr(0);
  LFS.printReport(`Leave &amp; Salary Summary - ${thisMonth}`, LFS.tableHtml(attendanceRows(), [
    { key: "employee", label: "Employee" }, { key: "salary", label: "Base Salary" }, { key: "leaves", label: "Leaves Taken" }, { key: "deduction", label: "Deduction" }, { key: "payable", label: "Payable" }
  ]));
}
function downloadAttendancePDF() {
  const thisMonth = currentMonthStr(0);
  LFS.downloadPDF(`Leave & Salary Summary - ${thisMonth}`, attendanceRows(), [
    { key: "employee", label: "Employee" }, { key: "salary", label: "Base Salary" }, { key: "leaves", label: "Leaves Taken" }, { key: "deduction", label: "Deduction" }, { key: "payable", label: "Payable" }
  ]);
}
function saveAttendance(e) {
  e.preventDefault();
  const att = LFS.get("lfs_attendance");
  att.push({
    id: LFS.uid("att"),
    staffId: document.getElementById("attStaff").value,
    date: document.getElementById("attDate").value || LFS.todayISO(),
    type: "leave",
    reason: document.getElementById("attReason").value.trim()
  });
  LFS.set("lfs_attendance", att);
  toast("Leave logged");
  renderAdminModule();
}

/* ============================================================
   EXPENSES TRACKING
   ============================================================ */
function renderExpensesModule() {
  return `
    <div class="subtab-nav" style="padding:0 0 12px;">
      <button class="subtab-btn ${EXPENSE_SUBTAB === "log" ? "active" : ""}" data-subtab-group="expenses" data-sub="log">Log Store Monthly Expense</button>
      <button class="subtab-btn ${EXPENSE_SUBTAB === "upcoming" ? "active" : ""}" data-subtab-group="expenses" data-sub="upcoming">Upcoming Expenses</button>
    </div>
    ${EXPENSE_SUBTAB === "log" ? renderExpenseLog() : renderUpcomingExpenses()}
  `;
}
function renderExpenseLog() {
  const expenses = LFS.get("lfs_expenses").slice().reverse();
  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  return `
    <div class="card">
      <h2>Log Expense</h2>
      <form id="expenseForm">
        <div class="grid cols-3">
          <div class="field"><label>Category</label><select id="expCategory"><option>Rent</option><option>Electricity</option><option>Tax</option><option>Salaries</option><option>Maintenance</option><option>Daily Shop Expense</option><option>Others</option></select></div>
          <div class="field"><label>Amount (₹) *</label><input type="number" id="expAmount" min="0" required></div>
          <div class="field"><label>Date</label><input type="date" id="expDate" value="${LFS.todayISO()}"></div>
        </div>
        <div class="field"><label>Description</label><input type="text" id="expDesc" placeholder="e.g. July shop rent"></div>
        <button class="btn btn-primary" type="submit">Save Expense</button>
      </form>
    </div>
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Expense Log</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printExpensesReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadExpensesPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('expenses.csv', LFS.get('lfs_expenses'))">Export CSV</button>
        </div>
      </div>
      <div class="stat-box mt-8" style="max-width:220px;"><div class="num">${LFS.formatMoney(total)}</div><div class="lbl">Total Logged</div></div>
      <div class="table-wrap mt-16">
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Logged By</th><th>Amount</th></tr></thead>
          <tbody>${expenses.map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(e.loggedBy || "Admin")}${e.source === "sales_person" ? ` <span class="badge badge-neutral">Sales</span>` : ""}</td><td>${LFS.formatMoney(e.amount)}</td></tr>`).join("") || `<tr><td colspan="5" class="text-soft">No expenses logged.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}
function saveExpense(e) {
  e.preventDefault();
  const expenses = LFS.get("lfs_expenses");
  const date = document.getElementById("expDate").value || LFS.todayISO();
  expenses.push({
    id: LFS.uid("exp"),
    category: document.getElementById("expCategory").value,
    description: document.getElementById("expDesc").value.trim(),
    amount: Number(document.getElementById("expAmount").value) || 0,
    date, month: date.slice(0, 7),
    source: "admin", loggedBy: "Admin"
  });
  LFS.set("lfs_expenses", expenses);
  toast("Expense saved");
  renderAdminModule();
}
function expenseLogRows() {
  return LFS.get("lfs_expenses").slice().reverse().map(e => ({ date: e.date, category: e.category, description: e.description, loggedBy: e.loggedBy || "Admin", amount: LFS.formatMoney(e.amount) }));
}
function printExpensesReport() {
  const total = LFS.get("lfs_expenses").reduce((sum, e) => sum + Number(e.amount || 0), 0);
  LFS.printReport("Store Expense Log", LFS.tableHtml(expenseLogRows(), [
    { key: "date", label: "Date" }, { key: "category", label: "Category" }, { key: "description", label: "Description" }, { key: "loggedBy", label: "Logged By" }, { key: "amount", label: "Amount" }
  ]) + `<p style="margin-top:10px;font-weight:700;">Total: ${LFS.formatMoney(total)}</p>`);
}
function downloadExpensesPDF() {
  LFS.downloadPDF("Store Expense Log", expenseLogRows(), [
    { key: "date", label: "Date" }, { key: "category", label: "Category" }, { key: "description", label: "Description" }, { key: "loggedBy", label: "Logged By" }, { key: "amount", label: "Amount" }
  ]);
}
function renderUpcomingExpenses() {
  const thisMonth = currentMonthStr(0);
  const staff = LFS.get("lfs_staff").filter(s => s.active);
  const recurring = LFS.get("lfs_expenses").filter(e => e.month === thisMonth);
  const payroll = staff.map(s => ({ s, p: payrollFor(s, thisMonth) }));
  const salaryTotal = payroll.reduce((sum, r) => sum + r.p.finalSalary, 0);
  const recurringTotal = recurring.reduce((sum, e) => sum + Number(e.amount), 0);
  return `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Upcoming Expenses - ${thisMonth}</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printUpcomingReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadUpcomingPDF()">PDF</button>
        </div>
      </div>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${LFS.formatMoney(recurringTotal)}</div><div class="lbl">Logged This Month</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(salaryTotal)}</div><div class="lbl">Payroll Due (leave-adjusted)</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(recurringTotal + salaryTotal)}</div><div class="lbl">Projected Total</div></div>
      </div>
      <h3 class="mt-16">Payroll Breakdown</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Base Salary</th><th>Leaves Taken</th><th>Deduction</th><th>Payable</th></tr></thead>
          <tbody>${payroll.map(r => `<tr><td>${escapeHtml(r.s.name)}</td><td>${LFS.formatMoney(r.s.monthlySalary)}</td><td>${r.p.leaves}</td><td>${LFS.formatMoney(r.p.deduction)}</td><td style="font-weight:700;">${LFS.formatMoney(r.p.finalSalary)}</td></tr>`).join("") || `<tr><td colspan="5" class="text-soft">No active staff.</td></tr>`}</tbody>
        </table>
      </div>
      <h3 class="mt-16">Other Logged Expenses This Month</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Logged By</th><th>Amount</th></tr></thead>
          <tbody>${recurring.map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(e.loggedBy || "Admin")}</td><td>${LFS.formatMoney(e.amount)}</td></tr>`).join("") || `<tr><td colspan="5" class="text-soft">Nothing logged yet this month.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}
function upcomingRows() {
  const thisMonth = currentMonthStr(0);
  const staff = LFS.get("lfs_staff").filter(s => s.active);
  const recurring = LFS.get("lfs_expenses").filter(e => e.month === thisMonth);
  const payrollRows = staff.map(s => { const p = payrollFor(s, thisMonth); return { category: "Salary", description: s.name + ` (${p.leaves} leave days)`, amount: LFS.formatMoney(p.finalSalary) }; });
  const otherRows = recurring.map(e => ({ category: e.category, description: e.description, amount: LFS.formatMoney(e.amount) }));
  return [...payrollRows, ...otherRows];
}
function printUpcomingReport() {
  const thisMonth = currentMonthStr(0);
  LFS.printReport(`Upcoming Expenses - ${thisMonth}`, LFS.tableHtml(upcomingRows(), [
    { key: "category", label: "Category" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount" }
  ]));
}
function downloadUpcomingPDF() {
  const thisMonth = currentMonthStr(0);
  LFS.downloadPDF(`Upcoming Expenses - ${thisMonth}`, upcomingRows(), [
    { key: "category", label: "Category" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount" }
  ]);
}

/* ============================================================
   JEWELLERY USAGE REPORT
   ============================================================ */
function renderUsageModule() {
  const items = LFS.get("lfs_rental_items").slice().sort((a, b) => (b.timesRented || 0) - (a.timesRented || 0));
  return `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Jewellery Usage &amp; Earnings</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printUsageReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadUsagePDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('jewellery_usage.csv', LFS.get('lfs_rental_items').map(i=>({item:i.itemName,code:i.itemCode,timesRented:i.timesRented||0,totalEarned:i.totalEarned||0})))">CSV</button>
        </div>
      </div>
      <p class="text-soft">How often each imitation jewellery piece has gone out for rent, and total earnings generated.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Code</th><th>Times Rented</th><th>Total Earned</th><th>Current Status</th></tr></thead>
          <tbody>
            ${items.map(i => `<tr><td>${escapeHtml(i.itemName)}</td><td class="mono">${i.itemCode}</td><td>${i.timesRented || 0}</td><td>${LFS.formatMoney(i.totalEarned || 0)}</td><td><span class="badge ${i.status === 'available' ? 'badge-available' : 'badge-rented'}">${i.status}</span></td></tr>`).join("") || `<tr><td colspan="5" class="text-soft">No rental items yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function usageRows() {
  return LFS.get("lfs_rental_items").slice().sort((a, b) => (b.timesRented || 0) - (a.timesRented || 0))
    .map(i => ({ item: i.itemName, code: i.itemCode, timesRented: i.timesRented || 0, totalEarned: LFS.formatMoney(i.totalEarned || 0), status: i.status }));
}
function printUsageReport() {
  LFS.printReport("Jewellery Usage &amp; Earnings Report", LFS.tableHtml(usageRows(), [
    { key: "item", label: "Item" }, { key: "code", label: "Code" }, { key: "timesRented", label: "Times Rented" }, { key: "totalEarned", label: "Total Earned" }, { key: "status", label: "Status" }
  ]));
}
function downloadUsagePDF() {
  LFS.downloadPDF("Jewellery Usage & Earnings Report", usageRows(), [
    { key: "item", label: "Item" }, { key: "code", label: "Code" }, { key: "timesRented", label: "Times Rented" }, { key: "totalEarned", label: "Total Earned" }, { key: "status", label: "Status" }
  ]);
}

/* ============================================================
   OVERALL SALES REPORT + ANALYTICS
   ============================================================ */
function renderSalesReportModule() {
  const sales = LFS.get("lfs_sales");
  const rentals = LFS.get("lfs_rentals");
  const salesTotal = sales.reduce((s, x) => s + Number(x.total || 0), 0);
  const rentalTotal = rentals.reduce((s, x) => s + Number(x.total || 0), 0);
  const pendingBalance = rentals.filter(r => r.status === "active").reduce((s, x) => s + Number(x.balance || 0), 0);

  const years = new Set([new Date().getFullYear()]);
  sales.forEach(s => years.add(Number(s.date.slice(0, 4))));
  rentals.forEach(r => years.add(Number(r.rentalDate.slice(0, 4))));
  const yearOptions = Array.from(years).sort((a, b) => b - a).map(y => `<option ${y === SALES_CHART_YEAR ? "selected" : ""}>${y}</option>`).join("");

  return `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Overall Sales Overview</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printSalesOverviewReport()">Print Overview</button>
          <button class="btn btn-outline btn-sm" onclick="downloadOverviewPDF()">PDF</button>
        </div>
      </div>
      <div class="grid cols-4">
        <div class="stat-box"><div class="num">${LFS.formatMoney(salesTotal)}</div><div class="lbl">Daily Sales Revenue</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(rentalTotal)}</div><div class="lbl">Rental Revenue</div></div>
        <div class="stat-box"><div class="num">${sales.length + rentals.length}</div><div class="lbl">Total Transactions</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(pendingBalance)}</div><div class="lbl">Pending Balances</div></div>
      </div>
    </div>

    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">Sales Analytics</h3>
        <select id="chartYearSelect" style="width:110px;" onchange="SALES_CHART_YEAR=Number(this.value);initSalesCharts();">${yearOptions}</select>
      </div>
      <div class="grid cols-2 mt-16">
        <div class="chart-box"><h4>Monthly Revenue Trend (${SALES_CHART_YEAR})</h4><canvas id="chartMonthly"></canvas></div>
        <div class="chart-box"><h4>Best-Selling Categories</h4><canvas id="chartCategories"></canvas></div>
        <div class="chart-box"><h4>Payment Mode - Cash vs UPI</h4><canvas id="chartPayments"></canvas></div>
        <div class="chart-box"><h4>Sales by Employee</h4><canvas id="chartEmployees"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">Daily Sales</h3>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printDailySalesReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadDailySalesPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('sales.csv', LFS.get('lfs_sales'))">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Customer</th><th>Employee</th><th>Payment</th><th>Total</th></tr></thead>
          <tbody>${sales.slice().reverse().slice(0, 50).map(s => `<tr><td>${s.date}</td><td>${escapeHtml(s.itemName)}</td><td>${s.quantity}</td><td>${escapeHtml(s.customerName || "Walk-in")}</td><td>${escapeHtml(s.soldBy || "-")}</td><td>${s.paymentMode || "-"}</td><td>${LFS.formatMoney(s.total)}</td></tr>`).join("") || `<tr><td colspan="7" class="text-soft">No sales yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">Rentals</h3>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printRentalsReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadRentalsPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('rentals.csv', LFS.get('lfs_rentals'))">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Customer</th><th>Employee</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead>
          <tbody>${rentals.slice().reverse().slice(0, 50).map(r => `<tr><td>${r.rentalDate}</td><td>${escapeHtml(r.itemName)}</td><td>${escapeHtml(r.customerName)}</td><td>${escapeHtml(r.handledBy || "-")}</td><td>${r.status}</td><td>${LFS.formatMoney(r.total)}</td><td>${LFS.formatMoney(r.balance)}</td></tr>`).join("") || `<tr><td colspan="7" class="text-soft">No rentals yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

function initSalesCharts() {
  if (!window.Chart) return;
  const sales = LFS.get("lfs_sales");
  const rentals = LFS.get("lfs_rentals");
  const inventory = LFS.get("lfs_inventory");
  const rentalItems = LFS.get("lfs_rental_items");
  const palette = ["#7A1E3D", "#C9A24B", "#3E6259", "#B4483A", "#8E6C88", "#5A1530", "#E8D6A0"];

  // --- Monthly revenue trend ---
  const monthly = Array(12).fill(0);
  sales.forEach(s => { const d = new Date(s.date); if (d.getFullYear() === SALES_CHART_YEAR) monthly[d.getMonth()] += Number(s.total || 0); });
  rentals.forEach(r => { const d = new Date(r.rentalDate); if (d.getFullYear() === SALES_CHART_YEAR) monthly[d.getMonth()] += Number(r.total || 0); });
  renderOrUpdateChart("chartMonthly", {
    type: "bar",
    data: { labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], datasets: [{ label: "Revenue (₹)", data: monthly, backgroundColor: "#7A1E3D" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // --- Best-selling categories (daily sales + rentals combined) ---
  const catTotals = {};
  sales.forEach(s => { const inv = inventory.find(i => i.id === s.itemId); const cat = inv ? inv.category : "Others"; catTotals[cat] = (catTotals[cat] || 0) + Number(s.total || 0); });
  rentals.forEach(r => { const it = rentalItems.find(i => i.id === r.rentalItemId); const cat = it ? it.category : "Others"; catTotals[cat] = (catTotals[cat] || 0) + Number(r.total || 0); });
  const catLabels = Object.keys(catTotals);
  renderOrUpdateChart("chartCategories", {
    type: "pie",
    data: { labels: catLabels, datasets: [{ data: catLabels.map(l => catTotals[l]), backgroundColor: palette }] }
  });

  // --- Payment mode: cash vs UPI-type vs other ---
  const payTotals = {};
  sales.forEach(s => { const m = s.paymentMode || "Other"; payTotals[m] = (payTotals[m] || 0) + Number(s.total || 0); });
  rentals.forEach(r => {
    const advMode = r.advancePaymentMode || "Other";
    payTotals[advMode] = (payTotals[advMode] || 0) + Number(r.advancePaid || 0);
    if (r.status !== "active" && r.settlementPaymentMode) {
      payTotals[r.settlementPaymentMode] = (payTotals[r.settlementPaymentMode] || 0) + Math.max(0, Number(r.balance || 0));
    }
  });
  const payLabels = Object.keys(payTotals);
  renderOrUpdateChart("chartPayments", {
    type: "doughnut",
    data: { labels: payLabels, datasets: [{ data: payLabels.map(l => payTotals[l]), backgroundColor: palette }] }
  });

  // --- Sales by employee ---
  const empTotals = {};
  sales.forEach(s => { const emp = s.soldBy || "Unassigned"; empTotals[emp] = (empTotals[emp] || 0) + Number(s.total || 0); });
  rentals.forEach(r => { const emp = r.handledBy || "Unassigned"; empTotals[emp] = (empTotals[emp] || 0) + Number(r.total || 0); });
  const empLabels = Object.keys(empTotals);
  renderOrUpdateChart("chartEmployees", {
    type: "bar",
    data: { labels: empLabels, datasets: [{ label: "Revenue (₹)", data: empLabels.map(l => empTotals[l]), backgroundColor: "#C9A24B" }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } } }
  });
}
function renderOrUpdateChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (CHART_REFS[canvasId]) CHART_REFS[canvasId].destroy();
  CHART_REFS[canvasId] = new window.Chart(ctx, config);
}

function overviewRows() {
  const sales = LFS.get("lfs_sales");
  const rentals = LFS.get("lfs_rentals");
  const salesTotal = sales.reduce((s, x) => s + Number(x.total || 0), 0);
  const rentalTotal = rentals.reduce((s, x) => s + Number(x.total || 0), 0);
  const pendingBalance = rentals.filter(r => r.status === "active").reduce((s, x) => s + Number(x.balance || 0), 0);
  return [
    { metric: "Daily Sales Revenue", value: LFS.formatMoney(salesTotal) },
    { metric: "Rental Revenue", value: LFS.formatMoney(rentalTotal) },
    { metric: "Total Transactions", value: sales.length + rentals.length },
    { metric: "Pending Balances", value: LFS.formatMoney(pendingBalance) }
  ];
}
function printSalesOverviewReport() {
  LFS.printReport("Overall Sales Overview", LFS.tableHtml(overviewRows(), [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }]));
}
function downloadOverviewPDF() {
  LFS.downloadPDF("Overall Sales Overview", overviewRows(), [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }]);
}
function dailySalesRows() {
  return LFS.get("lfs_sales").slice().reverse().map(s => ({ date: s.date, item: s.itemName, qty: s.quantity, customer: s.customerName || "Walk-in", employee: s.soldBy || "-", payment: s.paymentMode || "-", total: LFS.formatMoney(s.total) }));
}
function printDailySalesReport() {
  LFS.printReport("Daily Sales Report", LFS.tableHtml(dailySalesRows(), [
    { key: "date", label: "Date" }, { key: "item", label: "Item" }, { key: "qty", label: "Qty" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "payment", label: "Payment" }, { key: "total", label: "Total" }
  ]));
}
function downloadDailySalesPDF() {
  LFS.downloadPDF("Daily Sales Report", dailySalesRows(), [
    { key: "date", label: "Date" }, { key: "item", label: "Item" }, { key: "qty", label: "Qty" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "payment", label: "Payment" }, { key: "total", label: "Total" }
  ]);
}
function rentalsRows() {
  return LFS.get("lfs_rentals").slice().reverse().map(r => ({ date: r.rentalDate, item: r.itemName, customer: r.customerName, employee: r.handledBy || "-", status: r.status, total: LFS.formatMoney(r.total), balance: LFS.formatMoney(r.balance) }));
}
function printRentalsReport() {
  LFS.printReport("Rentals Report", LFS.tableHtml(rentalsRows(), [
    { key: "date", label: "Date" }, { key: "item", label: "Item" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }, { key: "balance", label: "Balance" }
  ]));
}
function downloadRentalsPDF() {
  LFS.downloadPDF("Rentals Report", rentalsRows(), [
    { key: "date", label: "Date" }, { key: "item", label: "Item" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }, { key: "balance", label: "Balance" }
  ]);
}

/* ============================================================
   CUSTOMER MANAGEMENT
   ============================================================ */
function renderCustomersModule() {
  const customers = LFS.get("lfs_customers");
  const editing = EDIT_CUSTOMER_ID ? customers.find(c => c.id === EDIT_CUSTOMER_ID) : null;
  return `
    <div class="card">
      <h2>${editing ? "Edit Customer" : "Add Customer"}</h2>
      <form id="customerForm">
        <input type="hidden" id="cusId" value="${editing ? editing.id : ""}">
        <div class="grid cols-2">
          <div class="field"><label>Name *</label><input type="text" id="cusName" required value="${editing ? escapeHtml(editing.name) : ""}"></div>
          <div class="field"><label>Phone *</label><input type="tel" id="cusPhone" maxlength="10" required value="${editing ? editing.phone : ""}"></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Address</label><input type="text" id="cusAddress" value="${editing ? escapeHtml(editing.address || "") : ""}"></div>
          <div class="field"><label>Region</label><select id="cusRegion">${LFS_REGIONS.map(r => `<option ${editing && editing.region === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        </div>
        <div class="grid cols-3">
          <div class="field"><label>Loyalty Points</label><input type="number" id="cusPoints" value="${editing ? editing.loyaltyPoints || 0 : 0}"></div>
          <div class="field"><label><input type="checkbox" id="cusRepeat" ${editing && editing.repeatCustomer ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Repeat customer</label></div>
          <div class="field"><label><input type="checkbox" id="cusReview" ${editing && editing.reviewGiven ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Gave online review</label></div>
        </div>
        <div class="field"><label>Review Platform</label><select id="cusReviewPlatform"><option value="">-</option><option ${editing && editing.reviewPlatform === "Google" ? "selected" : ""}>Google</option><option ${editing && editing.reviewPlatform === "Instagram" ? "selected" : ""}>Instagram</option><option ${editing && editing.reviewPlatform === "Facebook" ? "selected" : ""}>Facebook</option></select></div>
        <div class="flex gap-8">
          <button class="btn btn-primary" type="submit">${editing ? "Save Changes" : "Add Customer"}</button>
          ${editing ? `<button type="button" class="btn btn-outline" onclick="EDIT_CUSTOMER_ID=null;renderAdminModule();">Cancel</button>` : ""}
        </div>
      </form>
    </div>
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">Customers (${customers.length})</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printCustomersReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadCustomersPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.exportModule('lfs_customers')">Export JSON</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Region</th><th>Points</th><th>Repeat</th><th></th></tr></thead>
          <tbody>
            ${customers.map(c => `
              <tr>
                <td>${escapeHtml(c.name)}</td><td class="mono">${c.phone}</td><td>${c.region || "-"}</td><td>${c.loyaltyPoints || 0}</td>
                <td>${c.repeatCustomer ? "Yes" : "No"}</td>
                <td class="flex gap-8">
                  <button class="btn btn-outline btn-sm" onclick="EDIT_CUSTOMER_ID='${c.id}';renderAdminModule();">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="6" class="text-soft">No customers yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function saveCustomer(e) {
  e.preventDefault();
  const phone = document.getElementById("cusPhone").value.trim();
  if (!LFS.isValidPhone(phone)) { toast("Enter a valid 10-digit phone number"); return; }
  const customers = LFS.get("lfs_customers");
  const id = document.getElementById("cusId").value;
  const data = {
    id: id || LFS.uid("cus"),
    name: document.getElementById("cusName").value.trim(),
    phone,
    address: document.getElementById("cusAddress").value.trim(),
    region: document.getElementById("cusRegion").value,
    loyaltyPoints: Number(document.getElementById("cusPoints").value) || 0,
    repeatCustomer: document.getElementById("cusRepeat").checked,
    reviewGiven: document.getElementById("cusReview").checked,
    reviewPlatform: document.getElementById("cusReviewPlatform").value,
    notes: id ? (customers.find(c => c.id === id) || {}).notes || "" : ""
  };
  if (id) customers[customers.findIndex(c => c.id === id)] = data; else customers.push(data);
  LFS.set("lfs_customers", customers);
  EDIT_CUSTOMER_ID = null;
  toast("Customer saved");
  renderAdminModule();
}
function customerRows() {
  return LFS.get("lfs_customers").map(c => ({ name: c.name, phone: c.phone, region: c.region || "-", points: c.loyaltyPoints || 0, repeat: c.repeatCustomer ? "Yes" : "No" }));
}
function printCustomersReport() {
  LFS.printReport("Customer Directory Report", LFS.tableHtml(customerRows(), [
    { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "region", label: "Region" }, { key: "points", label: "Points" }, { key: "repeat", label: "Repeat" }
  ]));
}
function downloadCustomersPDF() {
  LFS.downloadPDF("Customer Directory Report", customerRows(), [
    { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "region", label: "Region" }, { key: "points", label: "Points" }, { key: "repeat", label: "Repeat" }
  ]);
}
function deleteCustomer(id) {
  if (!confirm("Delete this customer?")) return;
  LFS.set("lfs_customers", LFS.get("lfs_customers").filter(c => c.id !== id));
  toast("Customer deleted");
  renderAdminModule();
}

/* ============================================================
   LOYALTY, DISCOUNTS, REDEMPTION & FLASH SALE
   ============================================================ */
function renderLoyaltyModule() {
  const l = LFS.get("lfs_loyalty");
  const r = l.redemption || { enabled: false, thresholdPoints: 50, valuePerPoint: 1 };
  return `
    <div class="card">
      <h2>Loyalty Points &amp; Discount Rules</h2>
      <form id="loyaltyForm">
        <div class="grid cols-2">
          <div class="field"><label>Points earned per ₹100 spent</label><input type="number" id="loyPoints" min="0" value="${l.pointsPer100Rupees}"></div>
          <div class="field"><label>Repeat customer discount (%)</label><input type="number" id="loyRepeat" min="0" max="100" value="${l.repeatCustomerDiscountPercent}"></div>
        </div>
        <div class="field"><label>Discount for customers who left a review (₹)</label><input type="number" id="loyReview" min="0" value="${l.reviewDiscountAmount}"></div>

        <h3 class="mt-16">Points Redemption</h3>
        <p class="text-soft">Let known customers redeem their accumulated points for a rupee discount at the POS. When redeemed, their points reset to zero.</p>
        <div class="field"><label><input type="checkbox" id="loyRedeemEnabled" ${r.enabled ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Allow customers to redeem points</label></div>
        <div class="grid cols-2">
          <div class="field"><label>Minimum points required to redeem</label><input type="number" id="loyRedeemThreshold" min="1" value="${r.thresholdPoints}"></div>
          <div class="field"><label>Value per point (₹)</label><input type="number" id="loyRedeemValue" min="0" step="0.1" value="${r.valuePerPoint}"></div>
        </div>

        <h3 class="mt-16">Flash Sale</h3>
        <div class="field"><label><input type="checkbox" id="loyFlashEnabled" ${l.flashSale && l.flashSale.enabled ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Enable flash sale</label></div>
        <div class="grid cols-3">
          <div class="field"><label>Discount (%)</label><input type="number" id="loyFlashPct" min="0" max="100" value="${l.flashSale ? l.flashSale.discountPercent : 0}"></div>
          <div class="field"><label>From Date</label><input type="date" id="loyFlashFrom" value="${l.flashSale ? l.flashSale.fromDate : ""}"></div>
          <div class="field"><label>To Date</label><input type="date" id="loyFlashTo" value="${l.flashSale ? l.flashSale.toDate : ""}"></div>
        </div>
        <button class="btn btn-primary" type="submit">Save Loyalty Settings</button>
      </form>
    </div>
  `;
}
function saveLoyalty(e) {
  e.preventDefault();
  const data = {
    pointsPer100Rupees: Number(document.getElementById("loyPoints").value) || 0,
    repeatCustomerDiscountPercent: Number(document.getElementById("loyRepeat").value) || 0,
    reviewDiscountAmount: Number(document.getElementById("loyReview").value) || 0,
    redemption: {
      enabled: document.getElementById("loyRedeemEnabled").checked,
      thresholdPoints: Number(document.getElementById("loyRedeemThreshold").value) || 50,
      valuePerPoint: Number(document.getElementById("loyRedeemValue").value) || 1
    },
    flashSale: {
      enabled: document.getElementById("loyFlashEnabled").checked,
      discountPercent: Number(document.getElementById("loyFlashPct").value) || 0,
      fromDate: document.getElementById("loyFlashFrom").value,
      toDate: document.getElementById("loyFlashTo").value,
      appliesTo: "all"
    }
  };
  LFS.set("lfs_loyalty", data);
  toast("Loyalty settings saved");
  renderAdminModule();
}

/* ============================================================
   PROMOTIONS / CELEBRATIONS
   ============================================================ */
function renderPromotionsModule() {
  const promos = LFS.get("lfs_promotions");
  const editing = EDIT_PROMO_ID ? promos.find(p => p.id === EDIT_PROMO_ID) : null;
  return `
    <div class="card">
      <h2>Promotions &amp; Celebration Discounts</h2>
      <p class="text-soft">Default public holidays and celebrations are listed below, all switched off until you enable them. You can also add your own custom promotions with a discount percentage. These automatically show up as available discounts in the Daily Sales and Rental POS screens on the matching date.</p>
      <div class="card" style="background:var(--ivory-dim);box-shadow:none;">
        ${promos.map(p => `
          <div class="promo-row">
            <div>
              <div class="promo-name">${escapeHtml(p.name)} ${p.isDefault ? '<span class="badge badge-neutral">Default</span>' : '<span class="badge badge-neutral">Custom</span>'}</div>
              <div class="promo-when">${p.recurring ? `Every ${monthName(p.month)} ${p.day}` : `${p.fromDate || "?"} to ${p.toDate || "?"}`} &middot; ${p.discountPercent}% off</div>
            </div>
            <div class="flex gap-8">
              <label class="flex gap-8" style="font-size:.8rem;"><input type="checkbox" ${p.enabled ? "checked" : ""} onchange="togglePromotion('${p.id}', this.checked)"> Enabled</label>
              <button class="btn btn-outline btn-sm" onclick="EDIT_PROMO_ID='${p.id}';renderAdminModule();">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deletePromotion('${p.id}')">Delete</button>
            </div>
          </div>
        `).join("") || `<p class="text-soft">No promotions yet.</p>`}
      </div>
    </div>
    <div class="card">
      <h2>${editing ? "Edit Promotion" : "Add New Promotion"}</h2>
      <form id="promoForm">
        <input type="hidden" id="promoId" value="${editing ? editing.id : ""}">
        <div class="grid cols-2">
          <div class="field"><label>Name *</label><input type="text" id="promoName" required value="${editing ? escapeHtml(editing.name) : ""}" placeholder="e.g. Diwali Dhamaka"></div>
          <div class="field"><label>Discount (%) *</label><input type="number" id="promoDiscount" min="0" max="100" required value="${editing ? editing.discountPercent : 10}"></div>
        </div>
        <div class="field"><label>Type</label>
          <select id="promoType" onchange="togglePromoTypeFields()">
            <option value="recurring" ${!editing || editing.recurring ? "selected" : ""}>Recurring yearly date (e.g. every Aug 15)</option>
            <option value="range" ${editing && !editing.recurring ? "selected" : ""}>Fixed date range (e.g. this year's sale only)</option>
          </select>
        </div>
        <div id="promoRecurringFields" class="grid cols-2">
          <div class="field"><label>Month</label><select id="promoMonth">${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => `<option value="${i + 1}" ${editing && editing.month === i + 1 ? "selected" : ""}>${m}</option>`).join("")}</select></div>
          <div class="field"><label>Day</label><input type="number" id="promoDay" min="1" max="31" value="${editing ? editing.day || 1 : 1}"></div>
        </div>
        <div id="promoRangeFields" class="grid cols-2 hidden">
          <div class="field"><label>From Date</label><input type="date" id="promoFrom" value="${editing ? editing.fromDate || "" : ""}"></div>
          <div class="field"><label>To Date</label><input type="date" id="promoTo" value="${editing ? editing.toDate || "" : ""}"></div>
        </div>
        <div class="field"><label><input type="checkbox" id="promoEnabled" ${editing && editing.enabled ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Enabled</label></div>
        <div class="flex gap-8">
          <button class="btn btn-primary" type="submit">${editing ? "Save Changes" : "Add Promotion"}</button>
          ${editing ? `<button type="button" class="btn btn-outline" onclick="EDIT_PROMO_ID=null;renderAdminModule();">Cancel</button>` : ""}
        </div>
      </form>
    </div>
  `;
}
function monthName(m) { return ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)] || ""; }
function togglePromoTypeFields() {
  const isRecurring = document.getElementById("promoType").value === "recurring";
  document.getElementById("promoRecurringFields").classList.toggle("hidden", !isRecurring);
  document.getElementById("promoRangeFields").classList.toggle("hidden", isRecurring);
}
function togglePromotion(id, enabled) {
  const promos = LFS.get("lfs_promotions");
  const p = promos.find(x => x.id === id);
  if (p) { p.enabled = enabled; LFS.set("lfs_promotions", promos); toast(enabled ? `${p.name} enabled` : `${p.name} disabled`); }
}
function deletePromotion(id) {
  if (!confirm("Delete this promotion?")) return;
  LFS.set("lfs_promotions", LFS.get("lfs_promotions").filter(p => p.id !== id));
  toast("Promotion deleted");
  renderAdminModule();
}
function savePromotion(e) {
  e.preventDefault();
  const promos = LFS.get("lfs_promotions");
  const id = document.getElementById("promoId").value;
  const isRecurring = document.getElementById("promoType").value === "recurring";
  const data = {
    id: id || LFS.uid("promo"),
    name: document.getElementById("promoName").value.trim(),
    discountPercent: Number(document.getElementById("promoDiscount").value) || 0,
    recurring: isRecurring,
    month: isRecurring ? Number(document.getElementById("promoMonth").value) : null,
    day: isRecurring ? Number(document.getElementById("promoDay").value) : null,
    fromDate: !isRecurring ? document.getElementById("promoFrom").value : "",
    toDate: !isRecurring ? document.getElementById("promoTo").value : "",
    enabled: document.getElementById("promoEnabled").checked,
    isDefault: id ? (promos.find(p => p.id === id) || {}).isDefault || false : false
  };
  if (id) promos[promos.findIndex(p => p.id === id)] = data; else promos.push(data);
  LFS.set("lfs_promotions", promos);
  EDIT_PROMO_ID = null;
  toast("Promotion saved");
  renderAdminModule();
}

/* ============================================================
   STORE PERSONALIZATION
   ============================================================ */
function renderPersonalizationModule() {
  const s = LFS.get("lfs_settings");
  return `
    <div class="card">
      <h2>Store Personalization</h2>
      <form id="personalizationForm">
        <div class="grid cols-2">
          <div class="field"><label>Store Name</label><input type="text" id="pStoreName" value="${escapeHtml(s.storeName || "")}"></div>
          <div class="field"><label>Branch</label><input type="text" id="pBranch" value="${escapeHtml(s.branch || "")}"></div>
        </div>
        <div class="field"><label>Business Type</label><input type="text" id="pBusinessType" value="${escapeHtml(s.businessType || "")}"></div>
        <div class="grid cols-2">
          <div class="field"><label>Address</label><input type="text" id="pAddress" value="${escapeHtml(s.address || "")}"></div>
          <div class="field"><label>Region</label><select id="pRegion">${LFS_REGIONS.map(r => `<option ${s.region === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Phone</label><input type="tel" id="pPhone" maxlength="10" value="${s.phone || ""}"></div>
          <div class="field"><label>Email</label><input type="email" id="pEmail" value="${escapeHtml(s.email || "")}"></div>
        </div>
        <div class="field"><label>GST Number</label><input type="text" id="pGST" value="${escapeHtml(s.gstNumber || "")}"></div>
        <h3 class="mt-16">Social Media</h3>
        <div class="grid cols-2">
          <div class="field"><label>Facebook</label><input type="text" id="pFacebook" value="${escapeHtml((s.social || {}).facebook || "")}"></div>
          <div class="field"><label>Instagram</label><input type="text" id="pInstagram" value="${escapeHtml((s.social || {}).instagram || "")}"></div>
          <div class="field"><label>Twitter / X</label><input type="text" id="pTwitter" value="${escapeHtml((s.social || {}).twitter || "")}"></div>
          <div class="field"><label>WhatsApp</label><input type="text" id="pWhatsapp" value="${escapeHtml((s.social || {}).whatsapp || "")}"></div>
        </div>
        <h3 class="mt-16">Logo</h3>
        <div class="field"><label>Upload Logo</label><input type="file" id="pLogo" accept="image/*"></div>
        <h3 class="mt-16">QR Codes (shown to customers during billing)</h3>
        <div class="grid cols-2">
          <div class="field"><label>Store Location QR</label><input type="file" id="pQrLocation" accept="image/*"></div>
          <div class="field"><label>GPay QR</label><input type="file" id="pQrGpay" accept="image/*"></div>
          <div class="field"><label>PhonePe QR</label><input type="file" id="pQrPhonepe" accept="image/*"></div>
          <div class="field"><label>Google Review QR</label><input type="file" id="pQrReview" accept="image/*"></div>
        </div>
        <button class="btn btn-primary" type="submit">Save Store Settings</button>
      </form>
    </div>
  `;
}
function savePersonalization(e) {
  e.preventDefault();
  const s = LFS.get("lfs_settings");
  const email = document.getElementById("pEmail").value.trim();
  if (email && !LFS.isValidEmail(email)) { toast("Enter a valid email address"); return; }
  const fields = ["pLogo", "pQrLocation", "pQrGpay", "pQrPhonepe", "pQrReview"];
  const reads = fields.map(id => new Promise(resolve => readImageAsDataURL(document.getElementById(id), resolve)));
  Promise.all(reads).then(([logo, qrLoc, qrGpay, qrPhonepe, qrReview]) => {
    const updated = {
      ...s,
      storeName: document.getElementById("pStoreName").value.trim(),
      branch: document.getElementById("pBranch").value.trim(),
      businessType: document.getElementById("pBusinessType").value.trim(),
      address: document.getElementById("pAddress").value.trim(),
      region: document.getElementById("pRegion").value,
      phone: document.getElementById("pPhone").value.trim(),
      email,
      gstNumber: document.getElementById("pGST").value.trim(),
      social: {
        facebook: document.getElementById("pFacebook").value.trim(),
        instagram: document.getElementById("pInstagram").value.trim(),
        twitter: document.getElementById("pTwitter").value.trim(),
        whatsapp: document.getElementById("pWhatsapp").value.trim()
      },
      logoDataUrl: logo || s.logoDataUrl,
      qrCodes: {
        storeLocation: qrLoc || (s.qrCodes || {}).storeLocation || "",
        gpay: qrGpay || (s.qrCodes || {}).gpay || "",
        phonepe: qrPhonepe || (s.qrCodes || {}).phonepe || "",
        googleReview: qrReview || (s.qrCodes || {}).googleReview || ""
      }
    };
    LFS.set("lfs_settings", updated);
    toast("Store settings saved");
    paintAdminHeader();
    renderAdminModule();
  });
}

/* ============================================================
   SECURITY (password reset - both Admin and Sales team)
   ============================================================ */
function renderSecurityModule() {
  return `
    <div class="card">
      <h2>Security &amp; Passwords</h2>
      <p class="text-soft">Both the Sales Person and Admin passwords can be reset here (defaults are <code>sales1111</code> and <code>admin111</code>). Everyone will need to re-enter the new password the next time they open a protected tab.</p>
      <form id="securityForm">
        <div class="field"><label>Current Admin Password *</label><input type="password" id="secCurrentAdmin" required></div>
        <div class="grid cols-2">
          <div class="field"><label>New Sales Team Password</label><input type="password" id="secNewSales" placeholder="Leave blank to keep unchanged"></div>
          <div class="field"><label>New Admin Password</label><input type="password" id="secNewAdmin" placeholder="Leave blank to keep unchanged"></div>
        </div>
        <button class="btn btn-primary" type="submit">Update Passwords</button>
      </form>
    </div>
  `;
}
function saveSecurity(e) {
  e.preventDefault();
  const current = document.getElementById("secCurrentAdmin").value;
  if (!LFS.checkPassword(current, "adminPassword")) { toast("Current admin password is incorrect"); return; }
  const s = LFS.get("lfs_settings");
  const newSales = document.getElementById("secNewSales").value;
  const newAdmin = document.getElementById("secNewAdmin").value;
  if (newSales) s.salesPersonPassword = newSales;
  if (newAdmin) s.adminPassword = newAdmin;
  LFS.set("lfs_settings", s);
  document.getElementById("securityForm").reset();
  toast("Passwords updated");
}

/* ============================================================
   BACKUP, EXPORT / IMPORT
   ============================================================ */
function renderBackupModule() {
  const s = LFS.get("lfs_settings");
  const lastBackup = localStorage.getItem("lfs_last_backup") || "Never";
  return `
    <div class="card">
      <h2>Auto Backup</h2>
      <p class="text-soft">Automatically downloads a full backup JSON file to the device's Downloads folder at the configured interval. Save that file into your GitHub repo's <code>/data</code> folder workflow to restore it on next deploy.</p>
      <div class="field" style="max-width:220px;">
        <label>Auto-backup every (hours)</label>
        <input type="number" id="backupHours" min="0" value="${s.autoBackupHours || 0}" onchange="updateBackupHours(this.value)">
      </div>
      <p class="text-soft">Last full backup: ${lastBackup === "Never" ? "Never" : new Date(lastBackup).toLocaleString()}</p>
      <button class="btn btn-gold" onclick="LFS.exportFullBackup(); renderAdminModule();">Download Full Backup Now</button>
    </div>
    <div class="card">
      <h2>Restore from Backup</h2>
      <p class="text-soft">Importing a full backup replaces all module data in this browser with the file's contents.</p>
      <input type="file" id="restoreInput" accept="application/json">
      <button class="btn btn-outline mt-8" onclick="restoreFullBackup()">Restore</button>
    </div>
    <div class="card">
      <h2>Per-Module Export (for GitHub Pages seed data)</h2>
      <div class="grid cols-3">
        ${Object.keys(LFS.SEED_MAP).map(k => `<button class="btn btn-outline btn-sm" onclick="LFS.exportModule('${k}')">${LFS.SEED_MAP[k]}</button>`).join("")}
      </div>
    </div>
    <div class="card">
      <h2>CSV Export (for external billing / GST filing)</h2>
      <div class="grid cols-3">
        <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('sales.csv', LFS.get('lfs_sales'))">Sales CSV</button>
        <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('rentals.csv', LFS.get('lfs_rentals'))">Rentals CSV</button>
        <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('customers.csv', LFS.get('lfs_customers'))">Customers CSV</button>
        <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('expenses.csv', LFS.get('lfs_expenses'))">Expenses CSV</button>
        <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('inventory.csv', LFS.get('lfs_inventory'))">Stock CSV</button>
        <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('rental_items.csv', LFS.get('lfs_rental_items'))">Rental Inventory CSV</button>
      </div>
    </div>
  `;
}
function updateBackupHours(val) {
  const s = LFS.get("lfs_settings");
  s.autoBackupHours = Number(val) || 0;
  LFS.set("lfs_settings", s);
  toast("Auto-backup interval updated");
}
function restoreFullBackup() {
  const input = document.getElementById("restoreInput");
  if (!input.files[0]) { toast("Choose a backup file first"); return; }
  if (!confirm("This will overwrite current data in this browser. Continue?")) return;
  LFS.importFullBackup(input.files[0]).then(() => {
    toast("Backup restored");
    paintAdminHeader();
    renderAdminModule();
  }).catch(() => toast("Could not read that file"));
}

/* ---------- form handler map (wired in wireAdminEvents) ---------- */
const FORM_HANDLERS = {
  stockForm: saveStockItem,
  rentalInvForm: saveRentalItem,
  staffForm: saveStaff,
  attendanceForm: saveAttendance,
  expenseForm: saveExpense,
  customerForm: saveCustomer,
  loyaltyForm: saveLoyalty,
  personalizationForm: savePersonalization,
  securityForm: saveSecurity,
  promoForm: savePromotion,
  imageUploadForm: saveImageUpload
};
