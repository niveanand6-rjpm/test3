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
let SALES_REPORT_SUBTAB = "overview";

document.addEventListener("DOMContentLoaded", async () => {
  await LFS.init();
  LFS.scheduleAutoBackup();
  paintAdminHeader();
  LFS.initGoTop("goTopBtn");
  if (LFS.isAuthed("lfs_auth_admin")) showAdminApp(); else showAdminLogin();
});

function paintAdminHeader() {
  const s = LFS.get("lfs_settings");
  LFS.applyTheme();
  document.title = (s.storeName || "Lakshmi Fancy Store") + " - Admin";
  const nameSlot = document.getElementById("adminStoreName");
  if (nameSlot) nameSlot.textContent = (s.storeName || "Lakshmi Fancy Store") + " · Admin Console";
  const logoSlot = document.getElementById("adminLogoSlot");
  if (logoSlot) {
    logoSlot.innerHTML = s.logoDataUrl
      ? `<img class="logo" src="${s.logoDataUrl}" alt="logo">`
      : `<div class="logo-fallback">${(s.storeName || "L").charAt(0)}</div>`;
  }
  LFS.paintFooter("adminFooter");
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
  if (ADMIN_MODULE === "salesReport") setTimeout(initSalesReportCharts, 0);
  if (ADMIN_MODULE === "expenses" && EXPENSE_SUBTAB === "trend") setTimeout(initExpenseTrendChart, 0);
  if (ADMIN_MODULE === "customers") setTimeout(initCustomerChart, 0);
}

function wireAdminEvents() {
  document.querySelectorAll("[data-subtab-group]").forEach(b => {
    b.addEventListener("click", () => {
      const group = b.dataset.subtabGroup;
      if (group === "staff") STAFF_SUBTAB = b.dataset.sub;
      if (group === "expenses") EXPENSE_SUBTAB = b.dataset.sub;
      if (group === "salesReport") SALES_REPORT_SUBTAB = b.dataset.sub;
      renderAdminModule();
    });
  });
  const forms = ["stockForm", "rentalInvForm", "staffForm", "attendanceForm", "expenseForm", "customerForm", "loyaltyForm", "personalizationForm", "securityForm", "promoForm", "imageUploadForm", "salesDeptForm", "githubSyncForm"];
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
      <h2>🖼️ Image Portal</h2>
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
      <h2>📦 ${editing ? "Edit Stock Item" : "Add Stock Item"}</h2>
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
      <div class="flex-between"><h2 style="margin:0;">📦 Stock List (${items.length})</h2>
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
      <h2>💍 ${editing ? "Edit Rental Item" : "Add Rental Jewellery Item"}</h2>
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
        <h3 class="mt-16">🤝 Referral Commission</h3>
        <p class="text-soft">If a customer was referred by someone for this item, this is what the referrer earns.</p>
        <div class="grid cols-2">
          <div class="field"><label>Commission Type</label>
            <select id="rivCommissionType">
              <option value="none" ${editing && editing.commissionType === "none" ? "selected" : ""}>None</option>
              <option value="percentage" ${!editing || editing.commissionType === "percentage" ? "selected" : ""}>Percentage of rental charge</option>
              <option value="flat" ${editing && editing.commissionType === "flat" ? "selected" : ""}>Flat amount (₹)</option>
            </select>
          </div>
          <div class="field"><label>Commission Value</label><input type="number" id="rivCommissionValue" min="0" step="0.1" value="${editing ? editing.commissionValue || 0 : 0}"></div>
        </div>
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
      <div class="flex-between"><h2 style="margin:0;">💍 Rental Master Data (${items.length})</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printRentalInvReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadRentalInvPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('rental_items.csv', LFS.get('lfs_rental_items'))">CSV</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.exportModule('lfs_rental_items')">Export JSON</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Code</th><th>Rate/Day</th><th>Deposit</th><th>Commission</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${escapeHtml(i.itemName)}</td><td class="mono">${i.itemCode}</td><td>${LFS.formatMoney(i.dailyRate)}</td><td>${LFS.formatMoney(i.deposit)}</td>
                <td>${describeCommission(i)}</td>
                <td><span class="badge ${i.status === 'available' ? 'badge-available' : 'badge-rented'}">${i.status}</span></td>
                <td class="flex gap-8">
                  <button class="btn btn-outline btn-sm" onclick="EDIT_RENTAL_ID='${i.id}';renderAdminModule();">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteRentalItem('${i.id}')">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="7" class="text-soft">No items yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function describeCommission(item) {
  if (!item.commissionType || item.commissionType === "none" || !item.commissionValue) return `<span class="text-soft">None</span>`;
  return item.commissionType === "percentage" ? `${item.commissionValue}%` : LFS.formatMoney(item.commissionValue);
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
      commissionType: document.getElementById("rivCommissionType").value,
      commissionValue: Number(document.getElementById("rivCommissionValue").value) || 0,
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
    : [{ itemName: "Bridal Necklace Set", itemCode: "RNS-099", category: "Imitation Jewellery", itemType: "Necklace Sets", dailyRate: 500, deposit: 3000, purchasedFrom: "Wholesale Vendor", purchaseDate: "2026-08-01", purchasePrice: 4000, warranty: "None", status: "available", commissionType: "percentage", commissionValue: 10 }];
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
        commissionType: ["none", "percentage", "flat"].includes(r.commissionType) ? r.commissionType : (idx >= 0 ? existing[idx].commissionType || "none" : "none"),
        commissionValue: r.commissionValue !== undefined && r.commissionValue !== "" ? Number(r.commissionValue) || 0 : (idx >= 0 ? existing[idx].commissionValue || 0 : 0),
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
      <button class="subtab-btn ${STAFF_SUBTAB === "profiles" ? "active" : ""}" data-subtab-group="staff" data-sub="profiles">🪪 Employee Profiles</button>
      <button class="subtab-btn ${STAFF_SUBTAB === "attendance" ? "active" : ""}" data-subtab-group="staff" data-sub="attendance">🗓️ Attendance &amp; Leave</button>
    </div>
    ${STAFF_SUBTAB === "profiles" ? renderStaffProfiles() : renderStaffAttendance()}
  `;
}

function renderStaffProfiles() {
  const staff = LFS.get("lfs_staff");
  const editing = EDIT_STAFF_ID ? staff.find(s => s.id === EDIT_STAFF_ID) : null;
  return `
    <div class="card">
      <h2>🪪 ${editing ? "Edit Employee" : "Add Employee"}</h2>
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
      <div class="flex-between"><h2 style="margin:0;">👥 Employees (${staff.length})</h2>
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
      <h2>🗓️ Log a Leave</h2>
      <p class="text-soft">For a single day, set From and To to the same date. For a longer leave (e.g. a week off), set the full range - each day in between is logged automatically.</p>
      <form id="attendanceForm">
        <div class="grid cols-2">
          <div class="field"><label>Employee</label><select id="attStaff">${staff.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Leave Type</label>
            <select id="attLeaveType">
              <option value="Personal">Personal</option>
              <option value="Sick">Sick</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>From Date</label><input type="date" id="attFromDate" value="${LFS.todayISO()}"></div>
          <div class="field"><label>To Date</label><input type="date" id="attToDate" value="${LFS.todayISO()}"></div>
        </div>
        <div class="field"><label>Reason / Notes</label><input type="text" id="attReason" placeholder="Optional additional detail"></div>
        <button class="btn btn-primary" type="submit">Log Leave</button>
      </form>
    </div>
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">🗓️ Leave &amp; Salary Summary</h2>
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
  const staffId = document.getElementById("attStaff").value;
  const leaveType = document.getElementById("attLeaveType").value;
  const reason = document.getElementById("attReason").value.trim();
  const fromDate = document.getElementById("attFromDate").value || LFS.todayISO();
  const toDate = document.getElementById("attToDate").value || fromDate;
  if (toDate < fromDate) { toast("To Date can't be before From Date"); return; }

  const att = LFS.get("lfs_attendance");
  let cursor = new Date(fromDate);
  const end = new Date(toDate);
  let daysLogged = 0;
  while (cursor <= end) {
    att.push({
      id: LFS.uid("att"),
      staffId,
      date: cursor.toISOString().slice(0, 10),
      type: "leave",
      leaveType,
      reason
    });
    cursor.setDate(cursor.getDate() + 1);
    daysLogged++;
  }
  LFS.set("lfs_attendance", att);
  toast(daysLogged === 1 ? "Leave logged" : `${daysLogged} days of leave logged`);
  renderAdminModule();
}

/* ============================================================
   EXPENSES TRACKING
   ============================================================ */
function renderExpensesModule() {
  return `
    <div class="subtab-nav" style="padding:0 0 12px;">
      <button class="subtab-btn ${EXPENSE_SUBTAB === "log" ? "active" : ""}" data-subtab-group="expenses" data-sub="log">📝 Log Store Monthly Expense</button>
      <button class="subtab-btn ${EXPENSE_SUBTAB === "upcoming" ? "active" : ""}" data-subtab-group="expenses" data-sub="upcoming">⏳ Upcoming Expenses</button>
      <button class="subtab-btn ${EXPENSE_SUBTAB === "trend" ? "active" : ""}" data-subtab-group="expenses" data-sub="trend">📉 Past Expenses Trend</button>
    </div>
    ${EXPENSE_SUBTAB === "log" ? renderExpenseLog() : EXPENSE_SUBTAB === "upcoming" ? renderUpcomingExpenses() : renderExpenseTrend()}
  `;
}
function renderExpenseLog() {
  const expenses = LFS.get("lfs_expenses").slice().reverse();
  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  return `
    <div class="card">
      <h2>💵 Log Expense</h2>
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
      <div class="flex-between"><h2 style="margin:0;">💵 Expense Log</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printExpensesReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadExpensesPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('expenses.csv', LFS.get('lfs_expenses'))">Export CSV</button>
        </div>
      </div>
      <div class="stat-box mt-8" style="max-width:220px;"><div class="num">${LFS.formatMoney(total)}</div><div class="lbl">Total Logged</div></div>
      <div class="table-wrap mt-16">
        <table>
          <thead><tr><th>Date</th><th>Time (IST)</th><th>Category</th><th>Description</th><th>Logged By</th><th>Amount</th></tr></thead>
          <tbody>${expenses.map(e => `<tr><td>${e.date}</td><td>${LFS.formatIST(e.createdAt)}</td><td>${e.category}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(e.loggedBy || "Admin")}${e.source === "sales_person" ? ` <span class="badge badge-neutral">Sales</span>` : ""}</td><td>${LFS.formatMoney(e.amount)}</td></tr>`).join("") || `<tr><td colspan="6" class="text-soft">No expenses logged.</td></tr>`}</tbody>
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
    source: "admin", loggedBy: "Admin",
    createdAt: LFS.nowISO()
  });
  LFS.set("lfs_expenses", expenses);
  toast("Expense saved");
  renderAdminModule();
}
function expenseLogRows() {
  return LFS.get("lfs_expenses").slice().reverse().map(e => ({ date: e.date, time: LFS.formatIST(e.createdAt), category: e.category, description: e.description, loggedBy: e.loggedBy || "Admin", amount: LFS.formatMoney(e.amount) }));
}
function printExpensesReport() {
  const total = LFS.get("lfs_expenses").reduce((sum, e) => sum + Number(e.amount || 0), 0);
  LFS.printReport("Store Expense Log", LFS.tableHtml(expenseLogRows(), [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "category", label: "Category" }, { key: "description", label: "Description" }, { key: "loggedBy", label: "Logged By" }, { key: "amount", label: "Amount" }
  ]) + `<p style="margin-top:10px;font-weight:700;">Total: ${LFS.formatMoney(total)}</p>`);
}
function downloadExpensesPDF() {
  LFS.downloadPDF("Store Expense Log", expenseLogRows(), [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "category", label: "Category" }, { key: "description", label: "Description" }, { key: "loggedBy", label: "Logged By" }, { key: "amount", label: "Amount" }
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
      <div class="flex-between"><h2 style="margin:0;">⏳ Upcoming Expenses - ${thisMonth}</h2>
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

/* ---------- Past Expenses Trend: pick a month for a breakdown, or a year for a 12-month bar graph ---------- */
let EXPENSE_TREND_VIEW = "month"; // "month" | "year"
let EXPENSE_TREND_MONTH = currentMonthStr(0);
let EXPENSE_TREND_YEAR = new Date().getFullYear();

function renderExpenseTrend() {
  const allExpenses = LFS.get("lfs_expenses");
  const years = new Set([new Date().getFullYear()]);
  allExpenses.forEach(e => { if (e.date) years.add(Number(e.date.slice(0, 4))); });
  const yearOptions = Array.from(years).sort((a, b) => b - a).map(y => `<option ${y === EXPENSE_TREND_YEAR ? "selected" : ""}>${y}</option>`).join("");

  return `
    <div class="card">
      <div class="flex-between" style="flex-wrap:wrap;gap:10px;">
        <h2 style="margin:0;">📉 Past Expenses Trend</h2>
        <div class="flex gap-8">
          <button class="btn ${EXPENSE_TREND_VIEW === "month" ? "btn-primary" : "btn-outline"} btn-sm" onclick="EXPENSE_TREND_VIEW='month';renderAdminModule();">By Month</button>
          <button class="btn ${EXPENSE_TREND_VIEW === "year" ? "btn-primary" : "btn-outline"} btn-sm" onclick="EXPENSE_TREND_VIEW='year';renderAdminModule();">By Year</button>
        </div>
      </div>
      ${EXPENSE_TREND_VIEW === "month" ? `
        <div class="field mt-16" style="max-width:220px;">
          <label>Select Month</label>
          <input type="month" id="trendMonthPicker" value="${EXPENSE_TREND_MONTH}" onchange="EXPENSE_TREND_MONTH=this.value;renderAdminModule();">
        </div>
        <div id="trendMonthResult"></div>
      ` : `
        <div class="field mt-16" style="max-width:160px;">
          <label>Select Year</label>
          <select id="trendYearPicker" onchange="EXPENSE_TREND_YEAR=Number(this.value);renderAdminModule();">${yearOptions}</select>
        </div>
        <div class="chart-box mt-16"><h4>Expenses by Month - ${EXPENSE_TREND_YEAR}</h4><canvas id="chartExpenseYear"></canvas></div>
      `}
    </div>
    ${EXPENSE_TREND_VIEW === "month" ? renderExpenseMonthBreakdown() : ""}
  `;
}
function renderExpenseMonthBreakdown() {
  const rows = LFS.get("lfs_expenses").filter(e => e.month === EXPENSE_TREND_MONTH).slice().reverse();
  const total = rows.reduce((s, e) => s + Number(e.amount || 0), 0);
  return `
    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">📅 Expenses for ${EXPENSE_TREND_MONTH}</h3>
        <div class="stat-box" style="padding:8px 16px;"><div class="num" style="font-size:1.2rem;">${LFS.formatMoney(total)}</div><div class="lbl">Total</div></div>
      </div>
      <div class="table-wrap mt-16">
        <table>
          <thead><tr><th>Date</th><th>Time (IST)</th><th>Category</th><th>Description</th><th>Logged By</th><th>Amount</th></tr></thead>
          <tbody>${rows.map(e => `<tr><td>${e.date}</td><td>${LFS.formatIST(e.createdAt)}</td><td>${e.category}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(e.loggedBy || "Admin")}</td><td>${LFS.formatMoney(e.amount)}</td></tr>`).join("") || `<tr><td colspan="6" class="text-soft">No expenses logged for this month.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}
function initExpenseTrendChart() {
  if (!window.Chart || EXPENSE_TREND_VIEW !== "year") return;
  const monthly = Array(12).fill(0);
  LFS.get("lfs_expenses").forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date);
    if (d.getFullYear() === EXPENSE_TREND_YEAR) monthly[d.getMonth()] += Number(e.amount || 0);
  });
  renderOrUpdateChart("chartExpenseYear", {
    type: "bar",
    data: { labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], datasets: [{ label: "Expenses (₹)", data: monthly, backgroundColor: "#B4483A" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

/* ============================================================
   JEWELLERY USAGE REPORT
   ============================================================ */
function renderUsageModule() {
  const items = LFS.get("lfs_rental_items").slice().sort((a, b) => (b.timesRented || 0) - (a.timesRented || 0));
  return `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">📈 Jewellery Usage &amp; Earnings</h2>
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
  return `
    <div class="subtab-nav" style="padding:0 0 12px;">
      <button class="subtab-btn ${SALES_REPORT_SUBTAB === "overview" ? "active" : ""}" data-subtab-group="salesReport" data-sub="overview">📊 Overview</button>
      <button class="subtab-btn ${SALES_REPORT_SUBTAB === "analytics" ? "active" : ""}" data-subtab-group="salesReport" data-sub="analytics">📉 Sales Analytics</button>
      <button class="subtab-btn ${SALES_REPORT_SUBTAB === "referral" ? "active" : ""}" data-subtab-group="salesReport" data-sub="referral">🤝 Referral Program</button>
      <button class="subtab-btn ${SALES_REPORT_SUBTAB === "dailySales" ? "active" : ""}" data-subtab-group="salesReport" data-sub="dailySales">🛍️ Daily Sales</button>
      <button class="subtab-btn ${SALES_REPORT_SUBTAB === "rentals" ? "active" : ""}" data-subtab-group="salesReport" data-sub="rentals">💍 Rentals</button>
      <button class="subtab-btn ${SALES_REPORT_SUBTAB === "settings" ? "active" : ""}" data-subtab-group="salesReport" data-sub="settings">⚙️ Sales Dept Setting</button>
    </div>
    ${SALES_REPORT_SUBTAB === "overview" ? renderSROverview()
      : SALES_REPORT_SUBTAB === "analytics" ? renderSRAnalytics()
      : SALES_REPORT_SUBTAB === "referral" ? renderSRReferral()
      : SALES_REPORT_SUBTAB === "dailySales" ? renderSRDailySales()
      : SALES_REPORT_SUBTAB === "rentals" ? renderSRRentals()
      : renderSRSettings()}
  `;
}

/* ---------- 1. Overview: numbers only, for management at a glance ---------- */
function renderSROverview() {
  const sales = LFS.get("lfs_sales");
  const rentals = LFS.get("lfs_rentals");
  const customers = LFS.get("lfs_customers");
  const today = LFS.todayISO();
  const thisMonth = currentMonthStr(0);
  const thisYear = String(new Date().getFullYear());

  const sumSalesTotal = arr => arr.reduce((s, x) => s + Number(x.total || 0), 0);
  const sumRentalRevenue = arr => arr.reduce((s, x) => s + LFS.rentalNetRevenue(x), 0);
  const salesToday = sales.filter(s => s.date === today);
  const rentalsToday = rentals.filter(r => r.rentalDate === today);
  const salesMonth = sales.filter(s => s.date.slice(0, 7) === thisMonth);
  const rentalsMonth = rentals.filter(r => r.rentalDate.slice(0, 7) === thisMonth);
  const salesYear = sales.filter(s => s.date.slice(0, 4) === thisYear);
  const rentalsYear = rentals.filter(r => r.rentalDate.slice(0, 4) === thisYear);

  const paymentTotal = (mode) => {
    let t = sales.filter(s => s.paymentMode === mode).reduce((s, x) => s + Number(x.total || 0), 0);
    t += rentals.filter(r => r.advancePaymentMode === mode).reduce((s, x) => s + Number(x.advancePaid || 0), 0);
    t += rentals.filter(r => r.status !== "active" && r.settlementPaymentMode === mode).reduce((s, x) => s + Math.max(0, Number(x.balance || 0)), 0);
    return t;
  };
  const cashTotal = paymentTotal("Cash");
  const gpayTotal = paymentTotal("GPay");
  const otherDigitalTotal = LFS.PAYMENT_MODES.filter(m => m !== "Cash" && m !== "GPay").reduce((s, m) => s + paymentTotal(m), 0);

  const pendingBalance = rentals.filter(r => r.status === "active").reduce((s, x) => s + Number(x.balance || 0), 0);
  const repeatCustomerCount = customers.filter(c => c.repeatCustomer).length;
  const referred = rentals.filter(r => r.referred);
  const commissionPaid = referred.reduce((s, r) => s + Number(r.referralCommission || 0), 0);
  const referralRevenue = referred.reduce((s, r) => s + LFS.rentalNetRevenue(r), 0);

  return `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">📊 Overall Sales Overview</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printSalesOverviewReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadOverviewPDF()">PDF</button>
        </div>
      </div>
      <p class="text-soft">Key numbers only - for a quick management glance. Graphs live in the Sales Analytics tab. "Rental Revenue" here is the actual sale (rental charge minus discount and any referral commission) - it never includes the refundable security deposit.</p>

      <h4 class="mt-16" style="color:var(--maroon);">This Year (${thisYear})</h4>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${LFS.formatMoney(sumSalesTotal(salesYear))}</div><div class="lbl">Sales Revenue</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(sumRentalRevenue(rentalsYear))}</div><div class="lbl">Rental Revenue</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(sumSalesTotal(salesYear) + sumRentalRevenue(rentalsYear))}</div><div class="lbl">Total Revenue</div></div>
      </div>

      <h4 class="mt-16" style="color:var(--maroon);">This Month (${thisMonth})</h4>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${LFS.formatMoney(sumSalesTotal(salesMonth))}</div><div class="lbl">Sales Revenue</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(sumRentalRevenue(rentalsMonth))}</div><div class="lbl">Rental Revenue</div></div>
        <div class="stat-box"><div class="num">${salesMonth.length + rentalsMonth.length}</div><div class="lbl">Transactions</div></div>
      </div>

      <h4 class="mt-16" style="color:var(--maroon);">Today (${today})</h4>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${LFS.formatMoney(sumSalesTotal(salesToday))}</div><div class="lbl">Sales Revenue</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(sumRentalRevenue(rentalsToday))}</div><div class="lbl">Rental Revenue</div></div>
        <div class="stat-box"><div class="num">${salesToday.length + rentalsToday.length}</div><div class="lbl">Transactions</div></div>
      </div>

      <h4 class="mt-16" style="color:var(--maroon);">Payments Received (All-Time)</h4>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${LFS.formatMoney(cashTotal)}</div><div class="lbl">Cash</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(gpayTotal)}</div><div class="lbl">GPay</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(otherDigitalTotal)}</div><div class="lbl">Other UPI / Card</div></div>
      </div>

      <h4 class="mt-16" style="color:var(--maroon);">Customers &amp; Referrals</h4>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${repeatCustomerCount}</div><div class="lbl">Repeat Customers</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(commissionPaid)}</div><div class="lbl">Commission Paid So Far</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(referralRevenue)}</div><div class="lbl">Revenue via Referrals</div></div>
      </div>

      <h4 class="mt-16" style="color:var(--maroon);">Outstanding</h4>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${LFS.formatMoney(pendingBalance)}</div><div class="lbl">Pending Balances (Active Rentals)</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(rentals.filter(r => r.status === "active").reduce((s, x) => s + Number(x.deposit || 0), 0))}</div><div class="lbl">Deposits Held (Refundable, not revenue)</div></div>
        <div class="stat-box"><div class="num">${rentals.filter(r => r.status === "active").length}</div><div class="lbl">Active Rentals</div></div>
      </div>
      <div class="grid cols-3 mt-16">
        <div class="stat-box"><div class="num">${sales.length + rentals.length}</div><div class="lbl">Total Transactions (All-Time)</div></div>
      </div>
    </div>
  `;
}
function overviewRows() {
  const sales = LFS.get("lfs_sales");
  const rentals = LFS.get("lfs_rentals");
  const customers = LFS.get("lfs_customers");
  const today = LFS.todayISO();
  const thisMonth = currentMonthStr(0);
  const thisYear = String(new Date().getFullYear());
  const sumSalesTotal = arr => arr.reduce((s, x) => s + Number(x.total || 0), 0);
  const sumRentalRevenue = arr => arr.reduce((s, x) => s + LFS.rentalNetRevenue(x), 0);
  const paymentTotal = (mode) => {
    let t = sales.filter(s => s.paymentMode === mode).reduce((s, x) => s + Number(x.total || 0), 0);
    t += rentals.filter(r => r.advancePaymentMode === mode).reduce((s, x) => s + Number(x.advancePaid || 0), 0);
    t += rentals.filter(r => r.status !== "active" && r.settlementPaymentMode === mode).reduce((s, x) => s + Math.max(0, Number(x.balance || 0)), 0);
    return t;
  };
  const referred = rentals.filter(r => r.referred);
  return [
    { metric: "Sales Revenue (Year)", value: LFS.formatMoney(sumSalesTotal(sales.filter(s => s.date.slice(0, 4) === thisYear))) },
    { metric: "Rental Revenue (Year)", value: LFS.formatMoney(sumRentalRevenue(rentals.filter(r => r.rentalDate.slice(0, 4) === thisYear))) },
    { metric: "Sales Revenue (Month)", value: LFS.formatMoney(sumSalesTotal(sales.filter(s => s.date.slice(0, 7) === thisMonth))) },
    { metric: "Rental Revenue (Month)", value: LFS.formatMoney(sumRentalRevenue(rentals.filter(r => r.rentalDate.slice(0, 7) === thisMonth))) },
    { metric: "Sales Revenue (Today)", value: LFS.formatMoney(sumSalesTotal(sales.filter(s => s.date === today))) },
    { metric: "Rental Revenue (Today)", value: LFS.formatMoney(sumRentalRevenue(rentals.filter(r => r.rentalDate === today))) },
    { metric: "Cash Received (All-Time)", value: LFS.formatMoney(paymentTotal("Cash")) },
    { metric: "GPay Received (All-Time)", value: LFS.formatMoney(paymentTotal("GPay")) },
    { metric: "Repeat Customers", value: customers.filter(c => c.repeatCustomer).length },
    { metric: "Commission Paid So Far", value: LFS.formatMoney(referred.reduce((s, r) => s + Number(r.referralCommission || 0), 0)) },
    { metric: "Revenue via Referrals", value: LFS.formatMoney(referred.reduce((s, r) => s + LFS.rentalNetRevenue(r), 0)) },
    { metric: "Deposits Held (Refundable, not revenue)", value: LFS.formatMoney(rentals.filter(r => r.status === "active").reduce((s, x) => s + Number(x.deposit || 0), 0)) },
    { metric: "Pending Balances", value: LFS.formatMoney(rentals.filter(r => r.status === "active").reduce((s, x) => s + Number(x.balance || 0), 0)) },
    { metric: "Total Transactions (All-Time)", value: sales.length + rentals.length }
  ];
}
function printSalesOverviewReport() {
  LFS.printReport("Overall Sales Overview", LFS.tableHtml(overviewRows(), [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }]));
}
function downloadOverviewPDF() {
  LFS.downloadPDF("Overall Sales Overview", overviewRows(), [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }]);
}

/* ---------- 2. Sales Analytics: graphs only ---------- */
function renderSRAnalytics() {
  const sales = LFS.get("lfs_sales");
  const rentals = LFS.get("lfs_rentals");
  const years = new Set([new Date().getFullYear()]);
  sales.forEach(s => years.add(Number(s.date.slice(0, 4))));
  rentals.forEach(r => years.add(Number(r.rentalDate.slice(0, 4))));
  const yearOptions = Array.from(years).sort((a, b) => b - a).map(y => `<option ${y === SALES_CHART_YEAR ? "selected" : ""}>${y}</option>`).join("");
  return `
    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">📉 Sales Analytics</h3>
        <select id="chartYearSelect" style="width:110px;" onchange="SALES_CHART_YEAR=Number(this.value);initSalesReportCharts();">${yearOptions}</select>
      </div>
      <div class="grid cols-2 mt-16">
        <div class="chart-box"><h4>Monthly Revenue Trend (${SALES_CHART_YEAR})</h4><canvas id="chartMonthly"></canvas></div>
        <div class="chart-box"><h4>Daily Revenue - Last 30 Days</h4><canvas id="chartDailyTrend"></canvas></div>
        <div class="chart-box"><h4>Best-Selling Categories</h4><canvas id="chartCategories"></canvas></div>
        <div class="chart-box"><h4>Payment Mode - Cash vs UPI</h4><canvas id="chartPayments"></canvas></div>
        <div class="chart-box"><h4>Sales by Employee</h4><canvas id="chartEmployees"></canvas></div>
        <div class="chart-box"><h4>New vs Repeat Customers</h4><canvas id="chartCustomerMix"></canvas></div>
      </div>
    </div>
  `;
}

/* ---------- 3. Referral Program ---------- */
function renderSRReferral() {
  const rentals = LFS.get("lfs_rentals");
  const referredRentals = rentals.filter(r => r.referred).slice().reverse();
  const referralTotals = {
    totalCommission: referredRentals.reduce((s, r) => s + Number(r.referralCommission || 0), 0),
    count: referredRentals.length,
    topReferrer: (() => {
      const byReferrer = {};
      referredRentals.forEach(r => { byReferrer[r.referrerName] = (byReferrer[r.referrerName] || 0) + Number(r.referralCommission || 0); });
      const names = Object.keys(byReferrer);
      if (!names.length) return "-";
      return names.reduce((a, b) => byReferrer[a] >= byReferrer[b] ? a : b);
    })()
  };
  return `
    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">🤝 Referral Program</h3></div>
      <p class="text-soft">Rentals that came in through a referral, and the commission owed to each referrer.</p>
      <div class="grid cols-3">
        <div class="stat-box"><div class="num">${LFS.formatMoney(referralTotals.totalCommission)}</div><div class="lbl">Total Commission (all time)</div></div>
        <div class="stat-box"><div class="num">${referralTotals.count}</div><div class="lbl">Referred Rentals</div></div>
        <div class="stat-box"><div class="num" style="font-size:1.1rem;">${escapeHtml(referralTotals.topReferrer)}</div><div class="lbl">Top Referrer</div></div>
      </div>
      <div class="grid cols-2 mt-16">
        <div class="chart-box"><h4>Top Referrers (by commission)</h4><canvas id="chartTopReferrers"></canvas></div>
        <div class="chart-box"><h4>Commission by Month (${SALES_CHART_YEAR})</h4><canvas id="chartReferralMonthly"></canvas></div>
      </div>
      <div class="table-wrap mt-16">
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Customer</th><th>Referrer</th><th>Phone</th><th>Place</th><th>Commission</th></tr></thead>
          <tbody>${referredRentals.map(r => `<tr><td>${r.rentalDate}</td><td>${escapeHtml(r.itemName)}</td><td>${escapeHtml(r.customerName)}</td><td>${escapeHtml(r.referrerName)}</td><td class="mono">${r.referrerPhone}</td><td>${escapeHtml(r.referrerPlace || "-")}</td><td>${LFS.formatMoney(r.referralCommission)}</td></tr>`).join("") || `<tr><td colspan="7" class="text-soft">No referred rentals yet.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="flex gap-8 mt-8">
        <button class="btn btn-outline btn-sm" onclick="printReferralReport()">Print</button>
        <button class="btn btn-outline btn-sm" onclick="downloadReferralPDF()">PDF</button>
        <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('referrals.csv', LFS.get('lfs_rentals').filter(r=>r.referred))">Export CSV</button>
      </div>
    </div>
  `;
}

/* ---------- 4. Daily Sales ---------- */
function dailySalesSummaryTotals() {
  const sales = LFS.get("lfs_sales");
  return {
    totalSales: sales.reduce((s, x) => s + Number(x.total || 0), 0),
    totalDiscounts: sales.reduce((s, x) => s + Number(x.discount || 0), 0),
    totalPointsRedeemed: sales.reduce((s, x) => s + Number(x.pointsRedeemed || 0), 0),
    cashReceived: sales.filter(x => x.paymentMode === "Cash").reduce((s, x) => s + Number(x.total || 0), 0),
    gpayReceived: sales.filter(x => x.paymentMode === "GPay").reduce((s, x) => s + Number(x.total || 0), 0)
  };
}
function renderSRDailySales() {
  const sales = LFS.get("lfs_sales");
  const tot = dailySalesSummaryTotals();
  return `
    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">🛍️ Daily Sales</h3>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printDailySalesReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadDailySalesPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('sales.csv', LFS.get('lfs_sales'))">Export CSV</button>
        </div>
      </div>
      <div class="grid cols-3 mt-16">
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.totalSales)}</div><div class="lbl">Total Sales</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.totalDiscounts)}</div><div class="lbl">Total Discounts</div></div>
        <div class="stat-box"><div class="num">${tot.totalPointsRedeemed}</div><div class="lbl">Total Points Redeemed</div></div>
      </div>
      <div class="grid cols-2 mt-16">
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.cashReceived)}</div><div class="lbl">Total Cash Received</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.gpayReceived)}</div><div class="lbl">Total GPay Received</div></div>
      </div>
      <div class="chart-box mt-16"><h4>Top-Selling Items (by revenue)</h4><canvas id="chartTopItems"></canvas></div>
      <div class="table-wrap mt-16">
        <table>
          <thead><tr><th>Date</th><th>Time (IST)</th><th>Item</th><th>Qty</th><th>Customer</th><th>Employee</th><th>Payment</th><th>Discount</th><th>Pts Earned</th><th>Pts Redeemed</th><th>Total</th></tr></thead>
          <tbody>${sales.slice().reverse().slice(0, 50).map(s => `<tr><td>${s.date}</td><td>${LFS.formatIST(s.createdAt)}</td><td>${escapeHtml(s.itemName)}</td><td>${s.quantity}</td><td>${escapeHtml(s.customerName || "Walk-in")}</td><td>${escapeHtml(s.soldBy || "-")}</td><td>${s.paymentMode || "-"}</td><td>${LFS.formatMoney(s.discount)}</td><td>${s.pointsEarned || 0}</td><td>${s.pointsRedeemed || 0}</td><td>${LFS.formatMoney(s.total)}</td></tr>`).join("") || `<tr><td colspan="11" class="text-soft">No sales yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- 5. Rentals ---------- */
function rentalsSummaryTotals() {
  const rentals = LFS.get("lfs_rentals");
  const cashOf = r => {
    let c = 0;
    if (r.advancePaymentMode === "Cash") c += Number(r.advancePaid || 0);
    if (r.status !== "active" && r.settlementPaymentMode === "Cash") c += Math.max(0, Number(r.balance || 0));
    return c;
  };
  const gpayOf = r => {
    let g = 0;
    if (r.advancePaymentMode === "GPay") g += Number(r.advancePaid || 0);
    if (r.status !== "active" && r.settlementPaymentMode === "GPay") g += Math.max(0, Number(r.balance || 0));
    return g;
  };
  return {
    totalSales: rentals.reduce((s, r) => s + LFS.rentalNetRevenue(r), 0),
    totalDiscounts: rentals.reduce((s, r) => s + Number(r.discount || 0), 0),
    totalPointsRedeemed: rentals.reduce((s, r) => s + Number(r.pointsRedeemed || 0), 0),
    cashReceived: rentals.reduce((s, r) => s + cashOf(r), 0),
    gpayReceived: rentals.reduce((s, r) => s + gpayOf(r), 0)
  };
}
function renderSRRentals() {
  const rentals = LFS.get("lfs_rentals");
  const tot = rentalsSummaryTotals();
  return `
    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">💍 Rentals</h3>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printRentalsReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadRentalsPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.downloadCSV('rentals.csv', LFS.get('lfs_rentals'))">Export CSV</button>
        </div>
      </div>
      <div class="grid cols-3 mt-16">
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.totalSales)}</div><div class="lbl">Total Sales (Net Revenue)</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.totalDiscounts)}</div><div class="lbl">Total Discounts</div></div>
        <div class="stat-box"><div class="num">${tot.totalPointsRedeemed}</div><div class="lbl">Total Points Redeemed</div></div>
      </div>
      <div class="grid cols-2 mt-16">
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.cashReceived)}</div><div class="lbl">Total Cash Received</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(tot.gpayReceived)}</div><div class="lbl">Total GPay Received</div></div>
      </div>
      <div class="grid cols-2 mt-16">
        <div class="chart-box"><h4>Rental Status Breakdown</h4><canvas id="chartRentalStatus"></canvas></div>
        <div class="chart-box"><h4>Revenue by Event Type</h4><canvas id="chartEventType"></canvas></div>
      </div>
      <div class="table-wrap mt-16">
        <table>
          <thead><tr><th>Date</th><th>Time (IST)</th><th>Item</th><th>Customer</th><th>Employee</th><th>Status</th><th>Referred By</th><th>Rental Charge</th><th>Deposit (Refundable)</th><th>Net Revenue</th><th>Balance</th></tr></thead>
          <tbody>${rentals.slice().reverse().slice(0, 50).map(r => `<tr><td>${r.rentalDate}</td><td>${LFS.formatIST(r.createdAt)}</td><td>${escapeHtml(r.itemName)}</td><td>${escapeHtml(r.customerName)}</td><td>${escapeHtml(r.handledBy || "-")}</td><td>${r.status}</td><td>${r.referred ? `${escapeHtml(r.referrerName)} (${LFS.formatMoney(r.referralCommission)})` : "-"}</td><td>${LFS.formatMoney(r.rentalCharge !== undefined ? r.rentalCharge : r.dailyRate * r.days)}</td><td>${LFS.formatMoney(r.deposit)}</td><td>${LFS.formatMoney(LFS.rentalNetRevenue(r))}</td><td>${LFS.formatMoney(r.balance)}</td></tr>`).join("") || `<tr><td colspan="11" class="text-soft">No rentals yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- 6. Sales Dept Setting ---------- */
function renderSRSettings() {
  const s = LFS.get("lfs_settings");
  const sd = s.salesDept || { recentSummaryDays: 5, showDailySalesSummary: true, showRentalSummary: true };
  return `
    <div class="card">
      <h3>⚙️ Sales Dept Setting</h3>
      <p class="text-soft">Controls what the sales team sees under their own "Recent Sales Summary" tab - a quick digest that helps them reconcile cash and hand over takings to the shop owner at the end of a shift.</p>
      <form id="salesDeptForm">
        <div class="field" style="max-width:220px;">
          <label>Number of days to show</label>
          <input type="number" id="sdDays" min="1" max="30" value="${sd.recentSummaryDays || 5}">
        </div>
        <p class="text-soft mt-8">Which sections should sales staff be able to see?</p>
        <div class="field"><label><input type="checkbox" id="sdShowDaily" ${sd.showDailySalesSummary !== false ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Daily Sales Summary</label></div>
        <div class="field"><label><input type="checkbox" id="sdShowRental" ${sd.showRentalSummary !== false ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Rental Summary</label></div>
        <button class="btn btn-primary" type="submit">Save Settings</button>
      </form>
    </div>
  `;
}
function saveSalesDeptSettings(e) {
  e.preventDefault();
  const s = LFS.get("lfs_settings");
  s.salesDept = {
    recentSummaryDays: Math.max(1, Number(document.getElementById("sdDays").value) || 5),
    showDailySalesSummary: document.getElementById("sdShowDaily").checked,
    showRentalSummary: document.getElementById("sdShowRental").checked
  };
  LFS.set("lfs_settings", s);
  toast("Sales Dept settings saved");
  renderAdminModule();
}

/* ============================================================
   CHARTS - dispatched by active Sales Report sub-tab
   ============================================================ */
function initSalesReportCharts() {
  if (!window.Chart) return;
  if (SALES_REPORT_SUBTAB === "analytics") initAnalyticsCharts();
  else if (SALES_REPORT_SUBTAB === "referral") initReferralCharts();
  else if (SALES_REPORT_SUBTAB === "dailySales") initDailySalesCharts();
  else if (SALES_REPORT_SUBTAB === "rentals") initRentalsCharts();
}

const CHART_PALETTE = ["#7A1E3D", "#C9A24B", "#3E6259", "#B4483A", "#8E6C88", "#5A1530", "#E8D6A0"];

function initAnalyticsCharts() {
  const sales = LFS.get("lfs_sales");
  const rentals = LFS.get("lfs_rentals");
  const inventory = LFS.get("lfs_inventory");
  const rentalItems = LFS.get("lfs_rental_items");
  const customers = LFS.get("lfs_customers");

  const monthly = Array(12).fill(0);
  sales.forEach(s => { const d = new Date(s.date); if (d.getFullYear() === SALES_CHART_YEAR) monthly[d.getMonth()] += Number(s.total || 0); });
  rentals.forEach(r => { const d = new Date(r.rentalDate); if (d.getFullYear() === SALES_CHART_YEAR) monthly[d.getMonth()] += LFS.rentalNetRevenue(r); });
  renderOrUpdateChart("chartMonthly", {
    type: "bar",
    data: { labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], datasets: [{ label: "Revenue (₹)", data: monthly, backgroundColor: "#7A1E3D" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // Daily revenue - last 30 days
  const dayLabels = [], dayTotals = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    dayLabels.push(iso.slice(5));
    let t = sales.filter(s => s.date === iso).reduce((s, x) => s + Number(x.total || 0), 0);
    t += rentals.filter(r => r.rentalDate === iso).reduce((s, x) => s + LFS.rentalNetRevenue(x), 0);
    dayTotals.push(t);
  }
  renderOrUpdateChart("chartDailyTrend", {
    type: "line",
    data: { labels: dayLabels, datasets: [{ label: "Revenue (₹)", data: dayTotals, borderColor: "#C9A24B", backgroundColor: "rgba(201,162,75,.2)", fill: true, tension: 0.3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  const catTotals = {};
  sales.forEach(s => { const inv = inventory.find(i => i.id === s.itemId); const cat = inv ? inv.category : "Others"; catTotals[cat] = (catTotals[cat] || 0) + Number(s.total || 0); });
  rentals.forEach(r => { const it = rentalItems.find(i => i.id === r.rentalItemId); const cat = it ? it.category : "Others"; catTotals[cat] = (catTotals[cat] || 0) + LFS.rentalNetRevenue(r); });
  const catLabels = Object.keys(catTotals);
  renderOrUpdateChart("chartCategories", { type: "pie", data: { labels: catLabels, datasets: [{ data: catLabels.map(l => catTotals[l]), backgroundColor: CHART_PALETTE }] } });

  // Payment-mode split intentionally tracks actual money movement (incl.
  // refundable deposits collected/returned in cash or UPI) - not "revenue".
  const payTotals = {};
  sales.forEach(s => { const m = s.paymentMode || "Other"; payTotals[m] = (payTotals[m] || 0) + Number(s.total || 0); });
  rentals.forEach(r => {
    const advMode = r.advancePaymentMode || "Other";
    payTotals[advMode] = (payTotals[advMode] || 0) + Number(r.advancePaid || 0);
    if (r.status !== "active" && r.settlementPaymentMode) payTotals[r.settlementPaymentMode] = (payTotals[r.settlementPaymentMode] || 0) + Math.max(0, Number(r.balance || 0));
  });
  const payLabels = Object.keys(payTotals);
  renderOrUpdateChart("chartPayments", { type: "doughnut", data: { labels: payLabels, datasets: [{ data: payLabels.map(l => payTotals[l]), backgroundColor: CHART_PALETTE }] } });

  const empTotals = {};
  sales.forEach(s => { const emp = s.soldBy || "Unassigned"; empTotals[emp] = (empTotals[emp] || 0) + Number(s.total || 0); });
  rentals.forEach(r => { const emp = r.handledBy || "Unassigned"; empTotals[emp] = (empTotals[emp] || 0) + LFS.rentalNetRevenue(r); });
  const empLabels = Object.keys(empTotals);
  renderOrUpdateChart("chartEmployees", {
    type: "bar", data: { labels: empLabels, datasets: [{ label: "Revenue (₹)", data: empLabels.map(l => empTotals[l]), backgroundColor: "#C9A24B" }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } } }
  });

  const newCount = customers.filter(c => !c.repeatCustomer).length;
  const repeatCount = customers.filter(c => c.repeatCustomer).length;
  renderOrUpdateChart("chartCustomerMix", {
    type: "doughnut",
    data: { labels: ["New", "Repeat"], datasets: [{ data: [newCount, repeatCount], backgroundColor: ["#8E6C88", "#3E6259"] }] }
  });
}

function initReferralCharts() {
  const rentals = LFS.get("lfs_rentals");
  const referred = rentals.filter(r => r.referred);
  const referrerTotals = {};
  referred.forEach(r => { referrerTotals[r.referrerName] = (referrerTotals[r.referrerName] || 0) + Number(r.referralCommission || 0); });
  const referrerLabels = Object.keys(referrerTotals);
  renderOrUpdateChart("chartTopReferrers", {
    type: "bar", data: { labels: referrerLabels, datasets: [{ label: "Commission (₹)", data: referrerLabels.map(l => referrerTotals[l]), backgroundColor: "#3E6259" }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } } }
  });
  const commissionMonthly = Array(12).fill(0);
  referred.forEach(r => { const d = new Date(r.rentalDate); if (d.getFullYear() === SALES_CHART_YEAR) commissionMonthly[d.getMonth()] += Number(r.referralCommission || 0); });
  renderOrUpdateChart("chartReferralMonthly", {
    type: "bar", data: { labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], datasets: [{ label: "Commission (₹)", data: commissionMonthly, backgroundColor: "#B4483A" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function initDailySalesCharts() {
  const sales = LFS.get("lfs_sales");
  const itemTotals = {};
  sales.forEach(s => { itemTotals[s.itemName] = (itemTotals[s.itemName] || 0) + Number(s.total || 0); });
  const top = Object.entries(itemTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);
  renderOrUpdateChart("chartTopItems", {
    type: "bar",
    data: { labels: top.map(t => t[0]), datasets: [{ label: "Revenue (₹)", data: top.map(t => t[1]), backgroundColor: "#7A1E3D" }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } } }
  });
}

function initRentalsCharts() {
  const rentals = LFS.get("lfs_rentals");
  const statusTotals = {};
  rentals.forEach(r => { statusTotals[r.status] = (statusTotals[r.status] || 0) + 1; });
  const statusLabels = Object.keys(statusTotals);
  renderOrUpdateChart("chartRentalStatus", {
    type: "doughnut",
    data: { labels: statusLabels, datasets: [{ data: statusLabels.map(l => statusTotals[l]), backgroundColor: CHART_PALETTE }] }
  });
  const eventTotals = {};
  rentals.forEach(r => { const e = r.eventType || "Others"; eventTotals[e] = (eventTotals[e] || 0) + LFS.rentalNetRevenue(r); });
  const eventLabels = Object.keys(eventTotals);
  renderOrUpdateChart("chartEventType", {
    type: "bar",
    data: { labels: eventLabels, datasets: [{ label: "Revenue (₹)", data: eventLabels.map(l => eventTotals[l]), backgroundColor: "#8E6C88" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderOrUpdateChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (CHART_REFS[canvasId]) CHART_REFS[canvasId].destroy();
  CHART_REFS[canvasId] = new window.Chart(ctx, config);
}
function dailySalesRows() {
  return LFS.get("lfs_sales").slice().reverse().map(s => ({
    date: s.date, time: LFS.formatIST(s.createdAt), item: s.itemName, qty: s.quantity, customer: s.customerName || "Walk-in",
    employee: s.soldBy || "-", payment: s.paymentMode || "-", discount: LFS.formatMoney(s.discount),
    pointsEarned: s.pointsEarned || 0, pointsRedeemed: s.pointsRedeemed || 0, total: LFS.formatMoney(s.total)
  }));
}
function printDailySalesReport() {
  const tot = dailySalesSummaryTotals();
  const summaryHtml = `<div class="rpt-summary">
    <div>Total Sales: <strong>${LFS.formatMoney(tot.totalSales)}</strong></div>
    <div>Total Discounts: <strong>${LFS.formatMoney(tot.totalDiscounts)}</strong></div>
    <div>Points Redeemed: <strong>${tot.totalPointsRedeemed}</strong></div>
    <div>Cash Received: <strong>${LFS.formatMoney(tot.cashReceived)}</strong></div>
    <div>GPay Received: <strong>${LFS.formatMoney(tot.gpayReceived)}</strong></div>
  </div>`;
  LFS.printReport("Daily Sales Report", summaryHtml + LFS.tableHtml(dailySalesRows(), [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "item", label: "Item" }, { key: "qty", label: "Qty" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "payment", label: "Payment" }, { key: "discount", label: "Discount" }, { key: "pointsEarned", label: "Points Earned" }, { key: "pointsRedeemed", label: "Points Redeemed" }, { key: "total", label: "Total" }
  ]));
}
function downloadDailySalesPDF() {
  const tot = dailySalesSummaryTotals();
  const summaryLines = [
    `Total Sales: ${LFS.formatMoney(tot.totalSales)}`,
    `Total Discounts: ${LFS.formatMoney(tot.totalDiscounts)}`,
    `Total Points Redeemed: ${tot.totalPointsRedeemed}`,
    `Cash Received: ${LFS.formatMoney(tot.cashReceived)}`,
    `GPay Received: ${LFS.formatMoney(tot.gpayReceived)}`
  ];
  LFS.downloadPDF("Daily Sales Report", dailySalesRows(), [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "item", label: "Item" }, { key: "qty", label: "Qty" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "payment", label: "Payment" }, { key: "discount", label: "Discount" }, { key: "pointsEarned", label: "Points Earned" }, { key: "pointsRedeemed", label: "Points Redeemed" }, { key: "total", label: "Total" }
  ], summaryLines);
}
function rentalsRows() {
  return LFS.get("lfs_rentals").slice().reverse().map(r => ({
    date: r.rentalDate, time: LFS.formatIST(r.createdAt), item: r.itemName, customer: r.customerName, employee: r.handledBy || "-",
    status: r.status, referredBy: r.referred ? r.referrerName : "-",
    rentalCharge: LFS.formatMoney(r.rentalCharge !== undefined ? r.rentalCharge : r.dailyRate * r.days),
    deposit: LFS.formatMoney(r.deposit), netRevenue: LFS.formatMoney(LFS.rentalNetRevenue(r)), balance: LFS.formatMoney(r.balance)
  }));
}
function printRentalsReport() {
  const tot = rentalsSummaryTotals();
  const summaryHtml = `<div class="rpt-summary">
    <div>Total Sales (Net Revenue): <strong>${LFS.formatMoney(tot.totalSales)}</strong></div>
    <div>Total Discounts: <strong>${LFS.formatMoney(tot.totalDiscounts)}</strong></div>
    <div>Points Redeemed: <strong>${tot.totalPointsRedeemed}</strong></div>
    <div>Cash Received: <strong>${LFS.formatMoney(tot.cashReceived)}</strong></div>
    <div>GPay Received: <strong>${LFS.formatMoney(tot.gpayReceived)}</strong></div>
  </div>`;
  LFS.printReport("Rentals Report", summaryHtml + LFS.tableHtml(rentalsRows(), [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "item", label: "Item" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "status", label: "Status" }, { key: "referredBy", label: "Referred By" }, { key: "rentalCharge", label: "Rental Charge" }, { key: "deposit", label: "Deposit (Refundable)" }, { key: "netRevenue", label: "Net Revenue" }, { key: "balance", label: "Balance" }
  ]));
}
function downloadRentalsPDF() {
  const tot = rentalsSummaryTotals();
  const summaryLines = [
    `Total Sales (Net Revenue): ${LFS.formatMoney(tot.totalSales)}`,
    `Total Discounts: ${LFS.formatMoney(tot.totalDiscounts)}`,
    `Total Points Redeemed: ${tot.totalPointsRedeemed}`,
    `Cash Received: ${LFS.formatMoney(tot.cashReceived)}`,
    `GPay Received: ${LFS.formatMoney(tot.gpayReceived)}`
  ];
  LFS.downloadPDF("Rentals Report", rentalsRows(), [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "item", label: "Item" }, { key: "customer", label: "Customer" }, { key: "employee", label: "Employee" }, { key: "status", label: "Status" }, { key: "referredBy", label: "Referred By" }, { key: "rentalCharge", label: "Rental Charge" }, { key: "deposit", label: "Deposit (Refundable)" }, { key: "netRevenue", label: "Net Revenue" }, { key: "balance", label: "Balance" }
  ], summaryLines);
}

/* ---------- Referral Program report exports ---------- */
function referralRows() {
  return LFS.get("lfs_rentals").filter(r => r.referred).slice().reverse().map(r => ({
    date: r.rentalDate, item: r.itemName, customer: r.customerName, referrer: r.referrerName, phone: r.referrerPhone, place: r.referrerPlace || "-", commission: LFS.formatMoney(r.referralCommission)
  }));
}
function printReferralReport() {
  LFS.printReport("Referral Commission Report", LFS.tableHtml(referralRows(), [
    { key: "date", label: "Date" }, { key: "item", label: "Item" }, { key: "customer", label: "Customer" }, { key: "referrer", label: "Referrer" }, { key: "phone", label: "Phone" }, { key: "place", label: "Place" }, { key: "commission", label: "Commission" }
  ]));
}
function downloadReferralPDF() {
  LFS.downloadPDF("Referral Commission Report", referralRows(), [
    { key: "date", label: "Date" }, { key: "item", label: "Item" }, { key: "customer", label: "Customer" }, { key: "referrer", label: "Referrer" }, { key: "phone", label: "Phone" }, { key: "place", label: "Place" }, { key: "commission", label: "Commission" }
  ]);
}

/* ============================================================
   CUSTOMER MANAGEMENT
   ============================================================ */
function renderCustomersModule() {
  const customers = LFS.get("lfs_customers");
  const editing = EDIT_CUSTOMER_ID ? customers.find(c => c.id === EDIT_CUSTOMER_ID) : null;
  const years = new Set([new Date().getFullYear()]);
  customers.forEach(c => { if (c.createdAt) years.add(new Date(c.createdAt).getFullYear()); });
  const yearOptions = Array.from(years).sort((a, b) => b - a).map(y => `<option ${y === CUSTOMER_CHART_YEAR ? "selected" : ""}>${y}</option>`).join("");
  return `
    <div class="card">
      <h2>🧑‍🤝‍🧑 ${editing ? "Edit Customer" : "Add Customer"}</h2>
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
        <div class="field"><label>How did they hear about us?</label><select id="cusHowHeard">${LFS.REFERRAL_SOURCES.map(r => `<option ${editing && editing.howHeard === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
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
      <div class="flex-between"><h3 style="margin:0;">📈 New Customers Over Time</h3>
        <select id="custYearPicker" style="width:110px;" onchange="CUSTOMER_CHART_YEAR=Number(this.value);initCustomerChart();">${yearOptions}</select>
      </div>
      <div class="chart-box mt-16"><canvas id="chartNewCustomers"></canvas></div>
    </div>

    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">🧑‍🤝‍🧑 Customers (${customers.length})</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printCustomersReport()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadCustomersPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="LFS.exportModule('lfs_customers')">Export JSON</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Region</th><th>Points</th><th>Repeat</th><th>Review</th><th>Heard Via</th><th></th></tr></thead>
          <tbody>
            ${customers.map(c => `
              <tr>
                <td>${escapeHtml(c.name)}</td><td class="mono">${c.phone}</td><td>${c.region || "-"}</td><td>${c.loyaltyPoints || 0}</td>
                <td>${c.repeatCustomer ? "Yes" : "No"}</td>
                <td>${c.reviewGiven ? `<span class="badge badge-available">Yes - ${escapeHtml(c.reviewPlatform || "?")}</span>` : `<span class="badge badge-neutral">No</span>`}</td>
                <td>${escapeHtml(c.howHeard || "-")}</td>
                <td class="flex gap-8">
                  <button class="btn btn-outline btn-sm" onclick="EDIT_CUSTOMER_ID='${c.id}';renderAdminModule();">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="8" class="text-soft">No customers yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
let CUSTOMER_CHART_YEAR = new Date().getFullYear();
function initCustomerChart() {
  if (!window.Chart) return;
  const customers = LFS.get("lfs_customers");
  const monthly = Array(12).fill(0);
  customers.forEach(c => {
    if (!c.createdAt) return;
    const d = new Date(c.createdAt);
    if (d.getFullYear() === CUSTOMER_CHART_YEAR) monthly[d.getMonth()]++;
  });
  renderOrUpdateChart("chartNewCustomers", {
    type: "bar",
    data: { labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], datasets: [{ label: "New Customers", data: monthly, backgroundColor: "#7A1E3D" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}
function saveCustomer(e) {
  e.preventDefault();
  const phone = document.getElementById("cusPhone").value.trim();
  if (!LFS.isValidPhone(phone)) { toast("Enter a valid 10-digit phone number"); return; }
  const customers = LFS.get("lfs_customers");
  const id = document.getElementById("cusId").value;
  const existing = id ? customers.find(c => c.id === id) : null;
  const data = {
    id: id || LFS.uid("cus"),
    name: document.getElementById("cusName").value.trim(),
    phone,
    address: document.getElementById("cusAddress").value.trim(),
    region: document.getElementById("cusRegion").value,
    howHeard: document.getElementById("cusHowHeard").value,
    loyaltyPoints: Number(document.getElementById("cusPoints").value) || 0,
    repeatCustomer: document.getElementById("cusRepeat").checked,
    reviewGiven: document.getElementById("cusReview").checked,
    reviewPlatform: document.getElementById("cusReviewPlatform").value,
    notes: existing ? existing.notes || "" : "",
    createdAt: existing ? existing.createdAt || LFS.nowISO() : LFS.nowISO()
  };
  if (id) customers[customers.findIndex(c => c.id === id)] = data; else customers.push(data);
  LFS.set("lfs_customers", customers);
  EDIT_CUSTOMER_ID = null;
  toast("Customer saved");
  renderAdminModule();
}
function customerRows() {
  return LFS.get("lfs_customers").map(c => ({
    name: c.name, phone: c.phone, region: c.region || "-", points: c.loyaltyPoints || 0, repeat: c.repeatCustomer ? "Yes" : "No",
    review: c.reviewGiven ? `Yes - ${c.reviewPlatform || "?"}` : "No", heardVia: c.howHeard || "-"
  }));
}
function printCustomersReport() {
  LFS.printReport("Customer Directory Report", LFS.tableHtml(customerRows(), [
    { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "region", label: "Region" }, { key: "points", label: "Points" }, { key: "repeat", label: "Repeat" }, { key: "review", label: "Review" }, { key: "heardVia", label: "Heard Via" }
  ]));
}
function downloadCustomersPDF() {
  LFS.downloadPDF("Customer Directory Report", customerRows(), [
    { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "region", label: "Region" }, { key: "points", label: "Points" }, { key: "repeat", label: "Repeat" }, { key: "review", label: "Review" }, { key: "heardVia", label: "Heard Via" }
  ]);
}
function deleteCustomer(id) {
  if (!confirm("Delete this customer?")) return;
  LFS.set("lfs_customers", LFS.get("lfs_customers").filter(c => c.id !== id));
  toast("Customer deleted");
  renderAdminModule();
}

/* ============================================================
   LOYALTY, DISCOUNTS & POINTS REDEMPTION
   (Flash sales are now handled by the Promotions module)
   ============================================================ */
function renderLoyaltyModule() {
  const l = LFS.get("lfs_loyalty");
  const r = l.redemption || { enabled: false, thresholdPoints: 50, valuePerPoint: 1 };
  return `
    <div class="card">
      <h2>🎁 Loyalty Points &amp; Discount Rules</h2>
      <p class="text-soft">Looking for seasonal sales or celebration discounts? Those now live in the <strong>Promotions</strong> tab, where you can also scope them to specific categories.</p>
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
    }
  };
  LFS.set("lfs_loyalty", data);
  toast("Loyalty settings saved");
  renderAdminModule();
}

/* ============================================================
   PROMOTIONS / CELEBRATIONS
   Only ONE promotion may be enabled at any time (enforced below), and each
   promotion can be scoped to Daily Sale and/or Rental, and to specific
   item categories - similar to how category-scoped "automatic discounts"
   work in Shopify/Square/WooCommerce coupon rules.
   ============================================================ */
function renderPromotionsModule() {
  const promos = LFS.get("lfs_promotions");
  const editing = EDIT_PROMO_ID ? promos.find(p => p.id === EDIT_PROMO_ID) : null;
  const activeOne = promos.find(p => p.enabled);
  return `
    <div class="card">
      <h2>🎉 Promotions &amp; Celebration Discounts</h2>
      <p class="text-soft">Default public holidays and celebrations are listed below, all switched off until you enable them. You can also add your own custom promotions, and scope each one to Daily Sale and/or Rental items in specific categories. These automatically show up as a selectable discount in the Daily Sales and Rental POS screens on the matching date.</p>
      <p class="text-soft"><strong>Only one promotion can be active at a time.</strong> Enabling one automatically requires disabling any other first.</p>
      ${activeOne ? `<div class="promo-banner"><span class="promo-emoji">🎉</span> Currently enabled: <strong>${escapeHtml(activeOne.name)}</strong> (${activeOne.discountPercent}% off, ${describePromoScope(activeOne)})${LFS.activePromotionToday() ? " - live today!" : " - will apply automatically once its date is reached."}</div>` : ""}
      <div class="card" style="background:var(--ivory-dim);box-shadow:none;">
        ${promos.map(p => `
          <div class="promo-row ${p.enabled ? "active-promo" : ""}">
            <div>
              <div class="promo-name">${escapeHtml(p.name)} ${p.isDefault ? '<span class="badge badge-neutral">Default</span>' : '<span class="badge badge-neutral">Custom</span>'}</div>
              <div class="promo-when">${p.recurring ? `Every ${monthName(p.month)} ${p.day}` : `${p.fromDate || "?"} to ${p.toDate || "?"}`} &middot; ${p.discountPercent}% off &middot; ${describePromoScope(p)}</div>
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
      <h2>🎊 ${editing ? "Edit Promotion" : "Add New Promotion"}</h2>
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
        <p class="text-soft mt-8">Applies to which items? Leave both sections unchecked to apply to everything.</p>
        <div class="grid cols-2">
          <div class="field">
            <label>Module</label>
            <label class="flex gap-8" style="font-weight:400;"><input type="checkbox" id="promoModDaily" value="dailySale" ${!editing || (editing.appliesToModules || []).includes("dailySale") ? "checked" : ""} style="width:auto;"> Daily Sale (Fancy Items)</label>
            <label class="flex gap-8" style="font-weight:400;"><input type="checkbox" id="promoModRental" value="rental" ${!editing || (editing.appliesToModules || []).includes("rental") ? "checked" : ""} style="width:auto;"> Rental Jewellery</label>
          </div>
          <div class="field">
            <label>Categories (leave all unchecked for "All categories")</label>
            ${LFS_CATEGORIES.map(c => `<label class="flex gap-8" style="font-weight:400;"><input type="checkbox" class="promoCat" value="${c}" ${editing && (editing.appliesToCategories || []).includes(c) ? "checked" : ""} style="width:auto;"> ${c}</label>`).join("")}
          </div>
        </div>
        <div class="field mt-8"><label><input type="checkbox" id="promoEnabled" ${editing && editing.enabled ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Enabled</label></div>
        <div class="flex gap-8">
          <button class="btn btn-primary" type="submit">${editing ? "Save Changes" : "Add Promotion"}</button>
          ${editing ? `<button type="button" class="btn btn-outline" onclick="EDIT_PROMO_ID=null;renderAdminModule();">Cancel</button>` : ""}
        </div>
      </form>
    </div>
  `;
}
function describePromoScope(p) {
  const mods = (p.appliesToModules && p.appliesToModules.length) ? p.appliesToModules.map(m => m === "dailySale" ? "Daily Sale" : "Rental").join(" + ") : "All modules";
  const cats = (p.appliesToCategories && p.appliesToCategories.length) ? p.appliesToCategories.join(", ") : "All categories";
  return `${mods} &middot; ${cats}`;
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
  if (!p) return;
  if (enabled && LFS.anyOtherPromotionEnabled(id)) {
    toast("Only one promotion can be active at a time. Disable the current one first.");
    renderAdminModule();
    return;
  }
  p.enabled = enabled;
  LFS.set("lfs_promotions", promos);
  toast(enabled ? `${p.name} enabled` : `${p.name} disabled`);
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
  const enabled = document.getElementById("promoEnabled").checked;
  if (enabled && LFS.anyOtherPromotionEnabled(id)) {
    toast("Only one promotion can be active at a time. Disable the current one first, then enable this one.");
    return;
  }
  const appliesToModules = [];
  if (document.getElementById("promoModDaily").checked) appliesToModules.push("dailySale");
  if (document.getElementById("promoModRental").checked) appliesToModules.push("rental");
  const appliesToCategories = Array.from(document.querySelectorAll(".promoCat:checked")).map(c => c.value);
  const data = {
    id: id || LFS.uid("promo"),
    name: document.getElementById("promoName").value.trim(),
    discountPercent: Number(document.getElementById("promoDiscount").value) || 0,
    recurring: isRecurring,
    month: isRecurring ? Number(document.getElementById("promoMonth").value) : null,
    day: isRecurring ? Number(document.getElementById("promoDay").value) : null,
    fromDate: !isRecurring ? document.getElementById("promoFrom").value : "",
    toDate: !isRecurring ? document.getElementById("promoTo").value : "",
    appliesToModules, appliesToCategories,
    enabled,
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
      <h2>🏬 Store Personalization</h2>
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

        <h3 class="mt-16">🎨 Website Theme</h3>
        <p class="text-soft">Customize the colors and fonts used across both the sales app and this admin console. Changes apply immediately after saving.</p>
        <p class="text-soft" style="font-weight:700;">Main colors</p>
        <div class="grid cols-4">
          <div class="field"><label>Background</label><input type="color" id="pThemeBg" value="${(s.theme && s.theme.bg) || LFS.DEFAULT_THEME.bg}" style="height:42px;padding:4px;"></div>
          <div class="field"><label>Header / Primary</label><input type="color" id="pThemeHeader" value="${(s.theme && s.theme.header) || LFS.DEFAULT_THEME.header}" style="height:42px;padding:4px;"></div>
          <div class="field"><label>Footer</label><input type="color" id="pThemeFooter" value="${(s.theme && s.theme.footer) || LFS.DEFAULT_THEME.footer}" style="height:42px;padding:4px;"></div>
          <div class="field"><label>Accent / Animation</label><input type="color" id="pThemeAccent" value="${(s.theme && s.theme.accent) || LFS.DEFAULT_THEME.accent}" style="height:42px;padding:4px;"></div>
        </div>
        <p class="text-soft mt-8" style="font-weight:700;">Sub-section colors</p>
        <div class="grid cols-3">
          <div class="field"><label>Card / Sub-section Background</label><input type="color" id="pThemeCardBg" value="${(s.theme && s.theme.cardBg) || LFS.DEFAULT_THEME.cardBg}" style="height:42px;padding:4px;"></div>
          <div class="field"><label>Text Color</label><input type="color" id="pThemeText" value="${(s.theme && s.theme.text) || LFS.DEFAULT_THEME.text}" style="height:42px;padding:4px;"></div>
          <div class="field"><label>Secondary Accent (badges, success states)</label><input type="color" id="pThemeSecondary" value="${(s.theme && s.theme.secondary) || LFS.DEFAULT_THEME.secondary}" style="height:42px;padding:4px;"></div>
        </div>
        <p class="text-soft mt-8" style="font-weight:700;">Fonts</p>
        <div class="grid cols-2">
          <div class="field"><label>Font Style</label>
            <select id="pThemeFontPair">
              ${Object.keys(LFS.FONT_PAIRS).map(k => `<option value="${k}" ${((s.theme && s.theme.fontPair) || "classic") === k ? "selected" : ""}>${LFS.FONT_PAIRS[k].label}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Text Size</label>
            <select id="pThemeFontSize">
              <option value="small" ${((s.theme && s.theme.fontSize) || "medium") === "small" ? "selected" : ""}>Small</option>
              <option value="medium" ${((s.theme && s.theme.fontSize) || "medium") === "medium" ? "selected" : ""}>Medium (default)</option>
              <option value="large" ${((s.theme && s.theme.fontSize) || "medium") === "large" ? "selected" : ""}>Large</option>
              <option value="xlarge" ${((s.theme && s.theme.fontSize) || "medium") === "xlarge" ? "selected" : ""}>Extra Large</option>
            </select>
          </div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="resetTheme()">Reset to Default Theme</button>

        <button class="btn btn-primary mt-16" type="submit">Save Store Settings</button>
      </form>
    </div>
  `;
}
function resetTheme() {
  document.getElementById("pThemeBg").value = LFS.DEFAULT_THEME.bg;
  document.getElementById("pThemeHeader").value = LFS.DEFAULT_THEME.header;
  document.getElementById("pThemeFooter").value = LFS.DEFAULT_THEME.footer;
  document.getElementById("pThemeAccent").value = LFS.DEFAULT_THEME.accent;
  document.getElementById("pThemeCardBg").value = LFS.DEFAULT_THEME.cardBg;
  document.getElementById("pThemeText").value = LFS.DEFAULT_THEME.text;
  document.getElementById("pThemeSecondary").value = LFS.DEFAULT_THEME.secondary;
  document.getElementById("pThemeFontPair").value = LFS.DEFAULT_THEME.fontPair;
  document.getElementById("pThemeFontSize").value = LFS.DEFAULT_THEME.fontSize;
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
      },
      theme: {
        bg: document.getElementById("pThemeBg").value,
        header: document.getElementById("pThemeHeader").value,
        footer: document.getElementById("pThemeFooter").value,
        accent: document.getElementById("pThemeAccent").value,
        cardBg: document.getElementById("pThemeCardBg").value,
        text: document.getElementById("pThemeText").value,
        secondary: document.getElementById("pThemeSecondary").value,
        fontPair: document.getElementById("pThemeFontPair").value,
        fontSize: document.getElementById("pThemeFontSize").value
      }
    };
    LFS.set("lfs_settings", updated);
    toast("Store settings saved");
    LFS.applyTheme();
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
      <h2>🔐 Security &amp; Passwords</h2>
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
  const ghCfg = getGithubConfig();
  const hasToken = !!localStorage.getItem("lfs_github_token");
  const lastPush = localStorage.getItem("lfs_github_last_push") || "Never";
  return `
    <div class="card">
      <h2>☁️ Auto Backup</h2>
      <p class="text-soft">Automatically downloads a full backup JSON file to the device's Downloads folder at the configured interval. Save that file into your GitHub repo's <code>/data</code> folder workflow to restore it on next deploy.</p>
      <div class="field" style="max-width:220px;">
        <label>Auto-backup every (hours)</label>
        <input type="number" id="backupHours" min="0" value="${s.autoBackupHours || 0}" onchange="updateBackupHours(this.value)">
      </div>
      <p class="text-soft">Last full backup: ${lastBackup === "Never" ? "Never" : new Date(lastBackup).toLocaleString()}</p>
      <button class="btn btn-gold" onclick="LFS.exportFullBackup(); renderAdminModule();">Download Full Backup Now</button>
    </div>
    <div class="card">
      <h2>♻️ Restore from Backup</h2>
      <p class="text-soft">Importing a full backup replaces all module data in this browser with the file's contents.</p>
      <input type="file" id="restoreInput" accept="application/json">
      <button class="btn btn-outline mt-8" onclick="restoreFullBackup()">Restore</button>
    </div>
    <div class="card">
      <h2>📤 Per-Module Export (for GitHub Pages seed data)</h2>
      <div class="grid cols-3">
        ${Object.keys(LFS.SEED_MAP).map(k => `<button class="btn btn-outline btn-sm" onclick="LFS.exportModule('${k}')">${LFS.SEED_MAP[k]}</button>`).join("")}
      </div>
    </div>
    <div class="card">
      <h2>🐙 GitHub Sync (Interim - Manual Push)</h2>
      <p class="text-soft">Pushes this device's current data straight into your GitHub repo's <code>data/</code> folder using the GitHub API, so you don't have to manually download and re-upload each file. This is a <strong>one-way, on-demand</strong> push from this device - it does not pull other devices' changes, and it isn't automatic. Read the Help panel below before using it.</p>
      <form id="githubSyncForm">
        <div class="grid cols-2">
          <div class="field"><label>Repo Owner</label><input type="text" id="ghOwner" placeholder="e.g. yourusername" value="${ghCfg.owner || ""}"></div>
          <div class="field"><label>Repo Name</label><input type="text" id="ghRepo" placeholder="e.g. lakshmi-fancy-store" value="${ghCfg.repo || ""}"></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Branch</label><input type="text" id="ghBranch" value="${ghCfg.branch || "main"}"></div>
          <div class="field"><label>Path Prefix</label><input type="text" id="ghPathPrefix" value="${ghCfg.pathPrefix || "data"}"></div>
        </div>
        <div class="field">
          <label>Personal Access Token</label>
          <input type="password" id="ghToken" placeholder="${hasToken ? "Token saved on this device (leave blank to keep it)" : "Paste a fine-grained token scoped to this repo only"}">
        </div>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-gold" type="submit">Save &amp; Push All Data to GitHub Now</button>
          <button type="button" class="btn btn-outline" onclick="clearGithubToken()">Clear Saved Token</button>
        </div>
      </form>
      <p class="text-soft mt-8">Last successful push from this device: ${lastPush === "Never" ? "Never" : new Date(lastPush).toLocaleString()}</p>
      <div id="githubSyncStatus" class="mt-8"></div>
      <details class="help-panel">
        <summary>Help - how to set this up safely, and how to use it well</summary>
        <div class="help-body">
          <p><strong>1. Create a scoped token.</strong> On GitHub: Settings &gt; Developer settings &gt; Personal access tokens &gt; Fine-grained tokens &gt; Generate new token. Set "Repository access" to <em>only</em> this one repo, set an expiry (90 days is reasonable), and under Permissions grant <em>only</em> "Contents: Read and write". Don't use a classic all-repo token here.</p>
          <p><strong>2. Only use this on a trusted device.</strong> The token is stored in this browser's local storage so it doesn't need to be re-entered every time - that also means anyone with access to this device's browser dev tools could read it. Use it on the shop owner/admin's own device, not a shared or public one.</p>
          <p><strong>3. This is one-way and manual, not live sync.</strong> Clicking the button pushes <em>this device's</em> current data up to GitHub - it does not pull in anything other devices have entered, and other devices won't see the update until they clear their local data (Backup &amp; Export won't do this - use the "Reset app data" link on their login screen) and reload, which re-seeds fresh from GitHub. A good rhythm: treat this admin device as the source of truth, push at the end of each day, and have sales devices reset/resync periodically (e.g., each morning) rather than expecting instant sync between them.</p>
          <p><strong>4. Mind the data your commits will contain.</strong> These JSON files include real customer names, phone numbers, and addresses. Every push becomes a permanent entry in your repo's history - even if you edit or delete the file later, old commits still contain it unless you rewrite history. If this repo is public (which the free tier of GitHub Pages requires unless you're on a paid plan that supports Pages from private repos), that customer data will be publicly visible on the internet indefinitely. Please check your repo's visibility and plan before relying on this, and treat it as private/sensitive data even in a private repo.</p>
          <p><strong>5. Rotate the token periodically</strong> and revoke it immediately from GitHub if this device is lost, sold, or shared.</p>
        </div>
      </details>
    </div>
  `;
}
function getGithubConfig() {
  try { return JSON.parse(localStorage.getItem("lfs_github_config") || "{}"); } catch (e) { return {}; }
}
function clearGithubToken() {
  localStorage.removeItem("lfs_github_token");
  toast("Saved GitHub token cleared from this device");
  renderAdminModule();
}
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
async function pushAllToGithub(e) {
  if (e) e.preventDefault();
  const owner = document.getElementById("ghOwner").value.trim();
  const repo = document.getElementById("ghRepo").value.trim();
  const branch = document.getElementById("ghBranch").value.trim() || "main";
  const pathPrefix = document.getElementById("ghPathPrefix").value.trim().replace(/\/$/, "") || "data";
  const tokenInput = document.getElementById("ghToken").value.trim();

  if (!owner || !repo) { toast("Enter the repo owner and name first"); return; }
  const savedToken = localStorage.getItem("lfs_github_token") || "";
  const token = tokenInput || savedToken;
  if (!token) { toast("Enter a Personal Access Token first"); return; }

  localStorage.setItem("lfs_github_config", JSON.stringify({ owner, repo, branch, pathPrefix }));
  if (tokenInput) localStorage.setItem("lfs_github_token", tokenInput);

  const statusEl = document.getElementById("githubSyncStatus");
  statusEl.innerHTML = "";
  const log = (msg, isError) => {
    const line = document.createElement("div");
    line.textContent = msg;
    line.style.fontSize = ".85rem";
    if (isError) line.style.color = "var(--terracotta)";
    statusEl.appendChild(line);
  };

  log("Starting push to " + owner + "/" + repo + " (" + branch + ")...");
  let successCount = 0, failCount = 0;

  for (const key of LFS.ALL_KEYS) {
    const filename = LFS.SEED_MAP[key].split("/").pop();
    const filePath = pathPrefix + "/" + filename;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    try {
      let sha = null;
      const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
      });
      if (getRes.ok) {
        const getData = await getRes.json();
        sha = getData.sha;
      } else if (getRes.status !== 404) {
        const errData = await getRes.json().catch(() => ({}));
        throw new Error(`check failed (${getRes.status}): ${errData.message || getRes.statusText}`);
      }
      const content = JSON.stringify(LFS.get(key), null, 2);
      const body = {
        message: `Update ${filePath} via Lakshmi Fancy Store admin sync`,
        content: utf8ToBase64(content),
        branch
      };
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
      log(`✓ ${filePath}`);
      successCount++;
    } catch (err) {
      log(`✗ ${filePath}: ${err.message}`, true);
      failCount++;
    }
  }

  log(`Done. ${successCount} succeeded, ${failCount} failed.`);
  if (failCount === 0) {
    localStorage.setItem("lfs_github_last_push", new Date().toISOString());
    toast(`Pushed all data to GitHub successfully (${successCount} files)`);
  } else {
    toast(`GitHub push finished with ${failCount} error(s) - see the log below`);
  }
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
  imageUploadForm: saveImageUpload,
  salesDeptForm: saveSalesDeptSettings,
  githubSyncForm: pushAllToGithub
};
