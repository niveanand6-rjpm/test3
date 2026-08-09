/* ============================================================
   Lakshmi Fancy Store - app.js (Sales Person side, index.html)
   ============================================================ */

let CURRENT_TAB = "daily";
let CURRENT_RENTAL_SUBTAB = "new";
let SELECTED_RENTAL_ITEM = null;
let RENTAL_REDEEM_APPLIED = null; // { points, value } while a redemption is staged for the current rental
let SALE_REDEEM_APPLIED = null;

document.addEventListener("DOMContentLoaded", async () => {
  await LFS.init();
  LFS.scheduleAutoBackup();
  paintHeader();
  paintEmployeeSelect();
  LFS.initGoTop("goTopBtn");
  if (LFS.isAuthed("lfs_auth_sales")) {
    showApp();
  } else {
    showLogin();
  }
});

/* ---------- header ---------- */
function paintHeader() {
  const s = LFS.get("lfs_settings");
  LFS.applyTheme();
  document.title = s.storeName || "Lakshmi Fancy Store";
  const logoSlot = document.getElementById("logoSlot");
  if (logoSlot) {
    logoSlot.innerHTML = s.logoDataUrl
      ? `<img class="logo" src="${s.logoDataUrl}" alt="logo">`
      : `<div class="logo-fallback">${(s.storeName || "L").charAt(0)}</div>`;
  }
  const nameSlot = document.getElementById("storeNameSlot");
  if (nameSlot) nameSlot.textContent = s.storeName || "Lakshmi Fancy Store";
  const subSlot = document.getElementById("storeSubSlot");
  if (subSlot) subSlot.textContent = s.branch || "";
  LFS.paintFooter("siteFooter");
}

function paintEmployeeSelect() {
  const sel = document.getElementById("employeeSelect");
  if (!sel) return;
  const staff = LFS.get("lfs_staff").filter(s => s.active);
  const current = LFS.currentEmployeeName();
  sel.innerHTML = `<option value="">-- Sales person --</option>` + staff.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === current ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
  if (!current && staff.length) { /* leave unselected until they choose */ }
}
function onEmployeeChange(name) {
  LFS.setCurrentEmployeeName(name);
  toast(name ? `Signed in as ${name}` : "Sales person cleared");
  renderTab();
}

/* ---------- login ---------- */
function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}
function showApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  paintEmployeeSelect();
  renderTab();
}
function attemptLogin(e) {
  e.preventDefault();
  const pw = document.getElementById("loginPassword").value;
  if (LFS.checkPassword(pw, "salesPersonPassword")) {
    LFS.setAuthed("lfs_auth_sales");
    document.getElementById("loginError").classList.add("hidden");
    document.getElementById("loginPassword").value = "";
    showApp();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
  }
}
function doLogout() { LFS.logout("lfs_auth_sales"); showLogin(); }

/* ---------- tab switching ---------- */
function switchTab(tab) {
  CURRENT_TAB = tab;
  document.querySelectorAll(".tab-btn[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  renderTab();
}
function switchRentalSubtab(sub) { CURRENT_RENTAL_SUBTAB = sub; renderTab(); }

function renderTab() {
  const main = document.getElementById("mainContent");
  if (CURRENT_TAB === "daily") main.innerHTML = renderDailySales();
  else if (CURRENT_TAB === "rental") main.innerHTML = renderRentalTab();
  else if (CURRENT_TAB === "catalog") main.innerHTML = renderCatalog();
  else if (CURRENT_TAB === "expenses") main.innerHTML = renderDailyExpenses();
  else if (CURRENT_TAB === "summary") main.innerHTML = renderRecentSalesSummary();
  else if (CURRENT_TAB === "sendData") main.innerHTML = renderSendData();
  wireTabEvents();
}

/* ---------- shared receipt builder + offscreen print ---------- */
function buildReceiptHtml(opts) {
  const s = LFS.get("lfs_settings");
  return `
    <div class="receipt">
      <h3>${escapeHtml(s.storeName || "Lakshmi Fancy Store")}</h3>
      <div class="center text-soft">${escapeHtml(s.address || "")}</div>
      <div class="center text-soft">${escapeHtml(s.phone || "")}</div>
      <hr>
      ${opts.itemImage ? `<img class="item-img" src="${opts.itemImage}">` : ""}
      <div class="row"><span>Item</span><span>${escapeHtml(opts.itemName || "")}</span></div>
      <div class="row"><span>${opts.dateLabel}</span><span>${opts.dateValue}</span></div>
      ${opts.dateLabel2 ? `<div class="row"><span>${opts.dateLabel2}</span><span>${opts.dateValue2}</span></div>` : ""}
      <div class="row"><span>Customer</span><span>${escapeHtml(opts.customerName || "Walk-in")}</span></div>
      ${opts.phone ? `<div class="row"><span>Phone</span><span>${opts.phone}</span></div>` : ""}
      <hr>
      ${opts.rows.map(r => `<div class="row"><span>${r.label}</span><span>${r.value}</span></div>`).join("")}
      <hr>
      <div class="row total-row"><span>${opts.totalLabel}</span><span>${opts.totalValue}</span></div>
      ${opts.paymentMode ? `<div class="center text-soft mt-8">Paid via ${opts.paymentMode}</div>` : ""}
    </div>
  `;
}
function showReceiptModal(html) {
  let holder = document.getElementById("receiptModalHolder");
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "receiptModalHolder";
    document.body.appendChild(holder);
  }
  holder.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeReceiptModal()">
      <div class="modal" style="max-width:380px;">
        <button class="modal-close" onclick="closeReceiptModal()">&times;</button>
        ${html}
        <div class="text-center mt-16">
          <button class="btn btn-gold" onclick="window.print()">Print</button>
          <button class="btn btn-outline" onclick="closeReceiptModal()">Close</button>
        </div>
      </div>
    </div>
  `;
}
function closeReceiptModal() {
  const holder = document.getElementById("receiptModalHolder");
  if (holder) holder.innerHTML = "";
}

/* ============================================================
   DAILY SALES
   ============================================================ */
function renderDailySales() {
  const inv = LFS.get("lfs_inventory");
  const sales = LFS.get("lfs_sales").slice().reverse().slice(0, 25);
  const options = inv.map(i => `<option value="${i.id}">${escapeHtml(i.itemName)} (${i.itemCode}) - ${LFS.formatMoney(i.price)} - Qty ${i.quantityAvailable}</option>`).join("");
  const staff = LFS.get("lfs_staff").filter(s => s.active);
  const currentEmp = LFS.currentEmployeeName();
  const promo = LFS.activePromotionToday();

  return `
    <div class="card">
      <h2>🛍️ Daily Sales Entry</h2>
      <p class="text-soft">Quick sale of small fancy items from current stock.</p>
      ${promo ? `<div class="promo-banner"><span class="promo-emoji">🎉</span> ${escapeHtml(promo.name)} promotion is LIVE today - ${promo.discountPercent}% off (${describePromoScopeShort(promo)}). Let every customer know!</div>` : ""}
      <form id="dailySaleForm">
        <div class="grid cols-2">
          <div class="field">
            <label>Sales Person *</label>
            <select id="dsEmployee" required>
              <option value="">-- Select employee --</option>
              ${staff.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === currentEmp ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Payment Mode *</label>
            <select id="dsPayment" required>${LFS.PAYMENT_MODES.map(m => `<option>${m}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field">
          <label><input type="checkbox" id="dsBackdateToggle" onchange="toggleDailySaleBackdate()" style="width:auto;display:inline-block;margin-right:6px;">This sale happened on an earlier date</label>
        </div>
        <div id="dsBackdateFields" class="field hidden" style="max-width:220px;">
          <label>Sale Date</label>
          <input type="date" id="dsBackdateDate" max="${yesterdayISO()}">
          <div class="error-msg hidden" id="dsBackdateErr">Please choose a past date (not today or later)</div>
        </div>
        <div class="grid cols-2">
          <div class="field">
            <label>Customer Phone (optional)</label>
            <input type="tel" id="dsPhone" maxlength="10" placeholder="10-digit mobile number" oninput="lookupDailyCustomer()">
            <div class="error-msg hidden" id="dsPhoneErr">Enter a valid 10-digit number</div>
          </div>
          <div class="field">
            <label>Customer Name</label>
            <input type="text" id="dsName" placeholder="Walk-in customer">
          </div>
        </div>
        <div class="field">
          <label>Item</label>
          <select id="dsItem" onchange="onDailyItemChange()">
            <option value="">-- Select item --</option>
            ${options}
            <option value="__other__">Others (custom item)</option>
          </select>
        </div>
        <div id="dsOtherFields" class="grid cols-2 hidden">
          <div class="field"><label>Item Description *</label><input type="text" id="dsOtherDesc" placeholder="Describe the item sold"></div>
          <div class="field"><label>Unit Price (₹) *</label><input type="number" id="dsOtherPrice" min="0" value="0" oninput="updateDailySaleTotals()"></div>
        </div>
        <div class="grid cols-3">
          <div class="field">
            <label>Quantity</label>
            <input type="number" id="dsQty" min="1" value="1" oninput="updateDailySaleTotals()">
          </div>
          <div class="field">
            <label>Discount (₹)</label>
            <input type="number" id="dsDiscount" min="0" value="0" oninput="updateDailySaleTotals()">
          </div>
          <div class="field">
            <label>Total</label>
            <input type="text" id="dsTotal" readonly value="₹0">
          </div>
        </div>
        <div id="dsLoyaltySlot"></div>
        <button class="btn btn-primary" type="submit">Save Sale</button>
      </form>
    </div>
    <div class="card">
      <div class="flex-between"><h3 style="margin:0;">🧾 Recent Sales</h3><button class="btn btn-outline btn-sm" onclick="printDailySalesReportSales()">Print All</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Time (IST)</th><th>Item</th><th>Qty</th><th>Customer</th><th>Payment</th><th>Discount</th><th>Points Earned</th><th>Points Redeemed</th><th>Total</th><th></th></tr></thead>
          <tbody>
            ${sales.map(s => `<tr>
              <td>${s.date}${s.backdated ? ` <span class="badge badge-neutral" title="Entered later for an earlier date">Backdated</span>` : ""}</td><td>${LFS.formatIST(s.createdAt)}</td><td>${escapeHtml(s.itemName)}</td><td>${s.quantity}</td><td>${escapeHtml(s.customerName || "Walk-in")}</td>
              <td>${paymentBadge(s.paymentMode)}</td><td>${LFS.formatMoney(s.discount)}</td><td>${s.pointsEarned || 0}</td><td>${s.pointsRedeemed ? `${s.pointsRedeemed} (${LFS.formatMoney(s.redemptionValue)})` : "-"}</td><td>${LFS.formatMoney(s.total)}</td>
              <td><button class="btn btn-outline btn-sm" onclick="printSaleReceipt('${s.id}')">Print</button></td>
            </tr>`).join("") || `<tr><td colspan="11" class="text-soft">No sales recorded yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function describePromoScopeShort(p) {
  const cats = (p.appliesToCategories && p.appliesToCategories.length) ? p.appliesToCategories.join(", ") : "all categories";
  return cats;
}

function onDailyItemChange() {
  const isOther = document.getElementById("dsItem").value === "__other__";
  document.getElementById("dsOtherFields").classList.toggle("hidden", !isOther);
  updateDailySaleTotals();
  refreshDailyDiscountBlock();
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function toggleDailySaleBackdate() {
  const on = document.getElementById("dsBackdateToggle").checked;
  document.getElementById("dsBackdateFields").classList.toggle("hidden", !on);
  if (!on) document.getElementById("dsBackdateErr").classList.add("hidden");
}

function paymentBadge(mode) {
  const cls = mode === "Cash" ? "badge-cash" : (mode === "GPay" || mode === "PhonePe" || mode === "Other UPI") ? "badge-upi" : "badge-other";
  return `<span class="badge ${cls}">${escapeHtml(mode || "-")}</span>`;
}

function printDailySalesReportSales() {
  const sales = LFS.get("lfs_sales").slice().reverse();
  const rows = sales.map(s => ({ date: s.date, time: LFS.formatIST(s.createdAt), item: s.itemName, qty: s.quantity, customer: s.customerName || "Walk-in", payment: s.paymentMode || "-", discount: LFS.formatMoney(s.discount), pointsEarned: s.pointsEarned || 0, pointsRedeemed: s.pointsRedeemed || 0, total: LFS.formatMoney(s.total) }));
  LFS.printReport("Daily Sales Report", LFS.tableHtml(rows, [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "item", label: "Item" }, { key: "qty", label: "Qty" },
    { key: "customer", label: "Customer" }, { key: "payment", label: "Payment" }, { key: "discount", label: "Discount" },
    { key: "pointsEarned", label: "Points Earned" }, { key: "pointsRedeemed", label: "Points Redeemed" }, { key: "total", label: "Total" }
  ]));
}

function printSaleReceipt(saleId) {
  const sale = LFS.get("lfs_sales").find(s => s.id === saleId);
  if (!sale) return;
  const inv = LFS.get("lfs_inventory").find(i => i.id === sale.itemId);
  const html = buildReceiptHtml({
    itemName: `${sale.itemName} x${sale.quantity}`,
    itemImage: inv ? inv.imageDataUrl : "",
    dateLabel: "Date", dateValue: sale.date,
    customerName: sale.customerName, phone: sale.customerPhone,
    rows: [
      { label: "Unit Price", value: LFS.formatMoney(sale.unitPrice) },
      { label: "Quantity", value: sale.quantity },
      { label: "Discount", value: "-" + LFS.formatMoney(sale.discount) }
    ],
    totalLabel: "Total Paid", totalValue: LFS.formatMoney(sale.total),
    paymentMode: sale.paymentMode
  });
  // Employee name is intentionally omitted from the printed bill.
  showReceiptModal(html);
}

function lookupDailyCustomer() {
  const phone = document.getElementById("dsPhone").value.trim();
  const err = document.getElementById("dsPhoneErr");
  err.classList.toggle("hidden", phone.length === 0 || LFS.isValidPhone(phone));
  if (LFS.isValidPhone(phone)) {
    const cust = LFS.get("lfs_customers").find(c => c.phone === phone);
    if (cust) document.getElementById("dsName").value = cust.name;
  }
  refreshDailyDiscountBlock();
}

/* ---------- unified discount engine (repeat / review / promotion / points redemption) ---------- */
function computeEligibleDiscounts(cust, basisAmount, module, category) {
  const loyalty = LFS.get("lfs_loyalty");
  const breakdown = [];
  let total = 0;
  if (cust) {
    if (cust.repeatCustomer && loyalty.repeatCustomerDiscountPercent) {
      const amt = Math.round(basisAmount * loyalty.repeatCustomerDiscountPercent / 100);
      if (amt > 0) { breakdown.push({ label: `Repeat customer (${loyalty.repeatCustomerDiscountPercent}%)`, amount: amt }); total += amt; }
    }
    if (cust.reviewGiven && loyalty.reviewDiscountAmount) {
      breakdown.push({ label: `Review discount (${cust.reviewPlatform || "review"})`, amount: loyalty.reviewDiscountAmount });
      total += Number(loyalty.reviewDiscountAmount);
    }
  }
  const promo = LFS.activePromotionToday();
  if (promo && LFS.promotionAppliesTo(promo, module, category)) {
    const amt = Math.round(basisAmount * promo.discountPercent / 100);
    if (amt > 0) { breakdown.push({ label: `${promo.name} (${promo.discountPercent}%)`, amount: amt }); total += amt; }
  }
  let redemption = null;
  if (cust && loyalty.redemption && loyalty.redemption.enabled && (cust.loyaltyPoints || 0) >= (loyalty.redemption.thresholdPoints || 999999)) {
    const val = Math.round((cust.loyaltyPoints || 0) * (loyalty.redemption.valuePerPoint || 0));
    if (val > 0) { breakdown.push({ label: `Redeem ${cust.loyaltyPoints} points`, amount: val }); total += val; redemption = { customerId: cust.id, points: cust.loyaltyPoints, value: val }; }
  }
  return { total, breakdown, redemption };
}

function refreshDailyDiscountBlock() {
  const slot = document.getElementById("dsLoyaltySlot");
  if (!slot) return;
  const phone = document.getElementById("dsPhone").value.trim();
  const cust = LFS.isValidPhone(phone) ? LFS.get("lfs_customers").find(c => c.phone === phone) : null;
  const itemVal = document.getElementById("dsItem").value;
  let category = null, basis = 0;
  if (itemVal === "__other__") {
    category = "Others";
    basis = (Number(document.getElementById("dsOtherPrice").value) || 0) * (Number(document.getElementById("dsQty").value) || 1);
  } else if (itemVal) {
    const item = LFS.get("lfs_inventory").find(i => i.id === itemVal);
    if (item) { category = item.category; basis = item.price * (Number(document.getElementById("dsQty").value) || 1); }
  }
  if (!cust && !LFS.activePromotionToday()) { slot.innerHTML = ""; return; }
  const result = computeEligibleDiscounts(cust, basis, "dailySale", category);
  if (!result.breakdown.length) { slot.innerHTML = ""; return; }
  slot.innerHTML = `
    <div class="success-note">
      <div>${result.breakdown.map(b => `${escapeHtml(b.label)}: ${LFS.formatMoney(b.amount)}`).join("<br>")}</div>
      <div class="flex-between mt-8">
        <strong>Total eligible: ${LFS.formatMoney(result.total)}</strong>
        <button type="button" class="btn btn-gold btn-sm" onclick='applyDailyDiscounts(${JSON.stringify(result).replace(/'/g, "&#39;")})'>Apply Discounts</button>
      </div>
    </div>`;
}

function applyDailyDiscounts(result) {
  document.getElementById("dsDiscount").value = result.total;
  SALE_REDEEM_APPLIED = result.redemption || null;
  updateDailySaleTotals();
  toast(`Applied ${LFS.formatMoney(result.total)} in discounts`);
}

function updateDailySaleTotals() {
  const itemVal = document.getElementById("dsItem").value;
  const qty = Number(document.getElementById("dsQty").value) || 0;
  const discount = Number(document.getElementById("dsDiscount").value) || 0;
  let unitPrice = 0;
  if (itemVal === "__other__") {
    unitPrice = Number(document.getElementById("dsOtherPrice").value) || 0;
  } else if (itemVal) {
    const item = LFS.get("lfs_inventory").find(i => i.id === itemVal);
    unitPrice = item ? item.price : 0;
  }
  const total = Math.max(0, unitPrice * qty - discount);
  document.getElementById("dsTotal").value = LFS.formatMoney(total);
}

function submitDailySale(e) {
  e.preventDefault();
  const employee = document.getElementById("dsEmployee").value;
  if (!employee) { toast("Please select the sales person"); return; }
  LFS.setCurrentEmployeeName(employee);
  const phone = document.getElementById("dsPhone").value.trim();
  if (phone && !LFS.isValidPhone(phone)) { toast("Please enter a valid 10-digit phone number"); return; }

  const isBackdated = document.getElementById("dsBackdateToggle").checked;
  let saleDate = LFS.todayISO();
  if (isBackdated) {
    const chosen = document.getElementById("dsBackdateDate").value;
    const errEl = document.getElementById("dsBackdateErr");
    if (!chosen || chosen >= LFS.todayISO()) {
      errEl.classList.remove("hidden");
      toast("Please choose a past date for a backdated sale");
      return;
    }
    errEl.classList.add("hidden");
    saleDate = chosen;
  }

  const itemVal = document.getElementById("dsItem").value;
  const inv = LFS.get("lfs_inventory");
  let item = null, itemName = "", unitPrice = 0, isOther = false;
  if (itemVal === "__other__") {
    isOther = true;
    itemName = document.getElementById("dsOtherDesc").value.trim();
    if (!itemName) { toast("Please describe the item for this custom sale"); return; }
    unitPrice = Number(document.getElementById("dsOtherPrice").value) || 0;
    if (unitPrice <= 0) { toast("Please enter a unit price for the custom item"); return; }
  } else {
    item = inv.find(i => i.id === itemVal);
    if (!item) { toast("Please select an item"); return; }
    itemName = item.itemName;
    unitPrice = item.price;
  }

  const qty = Number(document.getElementById("dsQty").value) || 1;
  if (!isOther && qty > item.quantityAvailable) { toast(`Only ${item.quantityAvailable} in stock`); return; }
  const discount = Number(document.getElementById("dsDiscount").value) || 0;
  const total = Math.max(0, unitPrice * qty - discount);
  const paymentMode = document.getElementById("dsPayment").value;
  const loyalty = LFS.get("lfs_loyalty");
  const pointsEarned = Math.floor(total * (loyalty.pointsPer100Rupees || 0) / 100);
  const pointsRedeemed = (SALE_REDEEM_APPLIED && SALE_REDEEM_APPLIED.customerId) ? SALE_REDEEM_APPLIED.points : 0;
  const redemptionValue = (SALE_REDEEM_APPLIED && SALE_REDEEM_APPLIED.customerId) ? SALE_REDEEM_APPLIED.value : 0;

  const sales = LFS.get("lfs_sales");
  sales.push({
    id: LFS.uid("sal"),
    date: saleDate,
    backdated: isBackdated,
    createdAt: LFS.nowISO(),
    itemId: isOther ? null : item.id,
    itemName,
    isCustomItem: isOther,
    quantity: qty,
    unitPrice,
    discount,
    total,
    paymentMode,
    customerPhone: phone,
    customerName: document.getElementById("dsName").value.trim() || "Walk-in",
    soldBy: employee,
    pointsEarned,
    pointsRedeemed,
    redemptionValue
  });
  LFS.set("lfs_sales", sales);

  if (!isOther) {
    item.quantityAvailable = Math.max(0, item.quantityAvailable - qty);
    LFS.set("lfs_inventory", inv);
  }

  // update / create customer + loyalty points
  if (phone) {
    const customers = LFS.get("lfs_customers");
    let cust = customers.find(c => c.phone === phone);
    if (!cust) {
      cust = { id: LFS.uid("cus"), name: document.getElementById("dsName").value.trim() || "Walk-in", phone, address: "", region: "Rajapalayam", howHeard: "", loyaltyPoints: 0, repeatCustomer: false, reviewGiven: false, reviewPlatform: "", notes: "", createdAt: LFS.nowISO() };
      customers.push(cust);
    } else {
      cust.repeatCustomer = true;
    }
    if (SALE_REDEEM_APPLIED && SALE_REDEEM_APPLIED.customerId === cust.id) {
      cust.loyaltyPoints = 0;
    }
    cust.loyaltyPoints = (cust.loyaltyPoints || 0) + pointsEarned;
    LFS.set("lfs_customers", customers);
  }
  SALE_REDEEM_APPLIED = null;

  toast("Sale saved successfully");
  renderTab();
}

/* ============================================================
   RENTAL TAB (New / Historic / Customer Requirements)
   ============================================================ */
function renderRentalTab() {
  return `
    <div class="subtab-nav" style="padding:0 0 12px;">
      <button class="subtab-btn ${CURRENT_RENTAL_SUBTAB === "new" ? "active" : ""}" data-sub="new">➕ New Rental</button>
      <button class="subtab-btn ${CURRENT_RENTAL_SUBTAB === "historic" ? "active" : ""}" data-sub="historic">🔄 Historic / Returns</button>
      <button class="subtab-btn ${CURRENT_RENTAL_SUBTAB === "requests" ? "active" : ""}" data-sub="requests">💬 Customer Requirements</button>
    </div>
    <div id="rentalSubContent">
      ${CURRENT_RENTAL_SUBTAB === "new" ? renderNewRental() : CURRENT_RENTAL_SUBTAB === "historic" ? renderHistoricRentals() : renderCustomerRequests()}
    </div>
  `;
}

function renderNewRental() {
  const items = LFS.get("lfs_rental_items").filter(i => i.status === "available");
  const options = items.map(i => `<option value="${i.id}">${escapeHtml(i.itemName)} (${i.itemCode}) - ${LFS.formatMoney(i.dailyRate)}/day</option>`).join("");
  const staff = LFS.get("lfs_staff").filter(s => s.active);
  const currentEmp = LFS.currentEmployeeName();
  const promo = LFS.activePromotionToday();
  return `
    <div class="card">
      <h2>💳 New Rental - POS Terminal</h2>
      ${promo ? `<div class="promo-banner"><span class="promo-emoji">🎉</span> ${escapeHtml(promo.name)} promotion is LIVE today - ${promo.discountPercent}% off (${describePromoScopeShort(promo)}). Let every customer know!</div>` : ""}
      <form id="rentalForm">
        <div class="grid cols-2">
          <div class="field">
            <label>Sales Person *</label>
            <select id="rnEmployee" required>
              <option value="">-- Select employee --</option>
              ${staff.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === currentEmp ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Customer Phone *</label>
            <input type="tel" id="rnPhone" maxlength="10" required placeholder="10-digit mobile number" oninput="lookupRentalCustomer()">
            <div class="error-msg hidden" id="rnPhoneErr">Enter a valid 10-digit number</div>
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field">
            <label>Customer Name *</label>
            <input type="text" id="rnName" required>
          </div>
          <div class="field">
            <label>Customer Address</label>
            <input type="text" id="rnAddress">
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field">
            <label>Region</label>
            <select id="rnRegion">${LFS_REGIONS.map(r => `<option>${r}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Event Type</label>
            <select id="rnEvent">${LFS_EVENT_TYPES.map(e => `<option>${e}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field">
          <label>How did they hear about us? (new customers)</label>
          <select id="rnHowHeard">${LFS.REFERRAL_SOURCES.map(r => `<option>${r}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Jewellery Item *</label>
          <select id="rnItem" required onchange="onRentalItemChange()">
            <option value="">-- Select item --</option>
            ${options}
          </select>
        </div>
        <div id="rnItemPreview"></div>
        <div class="grid cols-3">
          <div class="field">
            <label>Rental Date</label>
            <input type="date" id="rnDate" value="${LFS.todayISO()}" onchange="recalcRental()">
          </div>
          <div class="field">
            <label>Number of Days</label>
            <input type="number" id="rnDays" min="1" value="1" oninput="recalcRental()">
          </div>
          <div class="field">
            <label>Expected Return</label>
            <input type="text" id="rnReturnDate" readonly>
          </div>
        </div>
        <div class="grid cols-3">
          <div class="field">
            <label>Daily Rate (₹)</label>
            <input type="number" id="rnRate" min="0" value="0" oninput="recalcRental()">
          </div>
          <div class="field">
            <label>Deposit (₹)</label>
            <input type="number" id="rnDeposit" min="0" value="0" oninput="recalcRental()">
          </div>
          <div class="field">
            <label>Discount (₹)</label>
            <input type="number" id="rnDiscount" min="0" value="0" oninput="recalcRental()">
          </div>
        </div>
        <div id="rnLoyaltySlot"></div>
        <div class="grid cols-3">
          <div class="field">
            <label>Advance Paid (₹)</label>
            <input type="number" id="rnAdvance" min="0" value="0" oninput="recalcRental()">
          </div>
          <div class="field">
            <label>Advance Payment Mode</label>
            <select id="rnAdvanceMode">${LFS.PAYMENT_MODES.map(m => `<option>${m}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Total ((Rate×Days)+Deposit)</label>
            <input type="text" id="rnTotal" readonly>
          </div>
        </div>
        <div class="field" style="max-width:280px;">
          <label>Balance Pending</label>
          <input type="text" id="rnBalance" readonly>
        </div>
        <h3 class="mt-16">🤝 Referred By</h3>
        <div class="field" style="max-width:280px;">
          <label>Was this customer referred by someone?</label>
          <select id="rnReferredYesNo" onchange="onReferredToggle()">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div id="rnReferralFields" class="hidden">
          <div class="grid cols-3">
            <div class="field"><label>Referrer Phone *</label><input type="tel" id="rnReferrerPhone" maxlength="10" oninput="lookupReferrerCustomer()" placeholder="10-digit mobile number"></div>
            <div class="field"><label>Referrer Name *</label><input type="text" id="rnReferrerName"></div>
            <div class="field"><label>Referrer Place / Address</label><input type="text" id="rnReferrerPlace"></div>
          </div>
          <div class="text-soft" id="rnReferrerLookupHint"></div>
          <div id="rnCommissionPreview" class="text-soft"></div>
        </div>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-primary" type="submit">Save Rental &amp; Print Receipt</button>
        </div>
      </form>
    </div>
    <div id="receiptSlot"></div>
  `;
}

function lookupRentalCustomer() {
  const phone = document.getElementById("rnPhone").value.trim();
  const err = document.getElementById("rnPhoneErr");
  err.classList.toggle("hidden", phone.length === 0 || LFS.isValidPhone(phone));
  if (LFS.isValidPhone(phone)) {
    const cust = LFS.get("lfs_customers").find(c => c.phone === phone);
    if (cust) {
      document.getElementById("rnName").value = cust.name;
      document.getElementById("rnAddress").value = cust.address || "";
      if (cust.region) document.getElementById("rnRegion").value = cust.region;
    }
  }
  recalcRental();
}

function onReferredToggle() {
  const isYes = document.getElementById("rnReferredYesNo").value === "yes";
  document.getElementById("rnReferralFields").classList.toggle("hidden", !isYes);
  updateCommissionPreview();
}

function lookupReferrerCustomer() {
  const phone = document.getElementById("rnReferrerPhone").value.trim();
  const hint = document.getElementById("rnReferrerLookupHint");
  if (!LFS.isValidPhone(phone)) { if (hint) hint.textContent = ""; return; }
  const cust = LFS.get("lfs_customers").find(c => c.phone === phone);
  if (cust) {
    document.getElementById("rnReferrerName").value = cust.name;
    document.getElementById("rnReferrerPlace").value = cust.address || cust.region || "";
    if (hint) hint.textContent = `Matched existing customer: ${cust.name}`;
  } else if (hint) {
    hint.textContent = "";
  }
}

function computeCommission(item, basis) {
  if (!item || !item.commissionType || item.commissionType === "none") return 0;
  if (item.commissionType === "percentage") return Math.round(basis * (Number(item.commissionValue) || 0) / 100);
  return Number(item.commissionValue) || 0;
}

function updateCommissionPreview() {
  const slot = document.getElementById("rnCommissionPreview");
  if (!slot) return;
  const isYes = document.getElementById("rnReferredYesNo").value === "yes";
  if (!isYes || !SELECTED_RENTAL_ITEM) { slot.textContent = ""; return; }
  const days = Math.max(1, Number(document.getElementById("rnDays").value) || 1);
  const rate = Number(document.getElementById("rnRate").value) || 0;
  const commission = computeCommission(SELECTED_RENTAL_ITEM, rate * days);
  slot.textContent = commission > 0
    ? `Referral commission for this rental: ${LFS.formatMoney(commission)}`
    : "This item has no referral commission configured (set it in Admin > Rental Inventory).";
}

function onRentalItemChange() {
  const items = LFS.get("lfs_rental_items");
  const item = items.find(i => i.id === document.getElementById("rnItem").value);
  SELECTED_RENTAL_ITEM = item || null;
  document.getElementById("rnRate").value = item ? item.dailyRate : 0;
  document.getElementById("rnDeposit").value = item ? item.deposit : 0;
  document.getElementById("rnItemPreview").innerHTML = item ? `
    <div class="flex gap-8 mt-8" style="margin-bottom:10px;">
      <div style="width:60px;height:60px;border-radius:8px;overflow:hidden;background:var(--ivory-dim);display:flex;align-items:center;justify-content:center;">
        ${item.imageDataUrl ? `<img src="${item.imageDataUrl}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:var(--gold);font-family:'Playfair Display',serif;">L</span>`}
      </div>
      <div>
        <div style="font-weight:700;">${escapeHtml(item.itemName)}</div>
        <div class="text-soft">${item.itemCode} · ${item.itemType}</div>
      </div>
    </div>` : "";
  recalcRental();
}

function recalcRental() {
  const days = Math.max(1, Number(document.getElementById("rnDays").value) || 1);
  const date = document.getElementById("rnDate").value || LFS.todayISO();
  const rate = Number(document.getElementById("rnRate").value) || 0;
  const deposit = Number(document.getElementById("rnDeposit").value) || 0;
  const advance = Number(document.getElementById("rnAdvance").value) || 0;
  let discount = Number(document.getElementById("rnDiscount").value) || 0;

  refreshRentalDiscountBlock();
  updateCommissionPreview();

  const returnDate = new Date(date);
  returnDate.setDate(returnDate.getDate() + days);
  document.getElementById("rnReturnDate").value = returnDate.toISOString().slice(0, 10);

  const total = (rate * days) + deposit;
  const balance = total - discount - advance;
  document.getElementById("rnTotal").value = LFS.formatMoney(total);
  document.getElementById("rnBalance").value = LFS.formatMoney(balance);
}

function refreshRentalDiscountBlock() {
  const slot = document.getElementById("rnLoyaltySlot");
  if (!slot) return;
  const phone = document.getElementById("rnPhone").value.trim();
  const cust = LFS.isValidPhone(phone) ? LFS.get("lfs_customers").find(c => c.phone === phone) : null;
  const days = Math.max(1, Number(document.getElementById("rnDays").value) || 1);
  const rate = Number(document.getElementById("rnRate").value) || 0;
  const category = SELECTED_RENTAL_ITEM ? SELECTED_RENTAL_ITEM.category : null;
  const basis = rate * days; // percent discounts apply to the rental charge, not the refundable deposit
  if (!cust && !LFS.activePromotionToday()) { slot.innerHTML = ""; return; }
  const result = computeEligibleDiscounts(cust, basis, "rental", category);
  if (!result.breakdown.length) { slot.innerHTML = ""; return; }
  slot.innerHTML = `
    <div class="success-note mt-8">
      <div>${result.breakdown.map(b => `${escapeHtml(b.label)}: ${LFS.formatMoney(b.amount)}`).join("<br>")}</div>
      <div class="flex-between mt-8">
        <strong>Total eligible: ${LFS.formatMoney(result.total)}</strong>
        <button type="button" class="btn btn-gold btn-sm" onclick='applyRentalDiscounts(${JSON.stringify(result).replace(/'/g, "&#39;")})'>Apply Discounts</button>
      </div>
    </div>`;
}

function applyRentalDiscounts(result) {
  document.getElementById("rnDiscount").value = result.total;
  RENTAL_REDEEM_APPLIED = result.redemption || null;
  recalcRental();
  toast(`Applied ${LFS.formatMoney(result.total)} in discounts`);
}

function submitRental(e) {
  e.preventDefault();
  const employee = document.getElementById("rnEmployee").value;
  if (!employee) { toast("Please select the sales person"); return; }
  LFS.setCurrentEmployeeName(employee);
  const phone = document.getElementById("rnPhone").value.trim();
  if (!LFS.isValidPhone(phone)) { toast("Please enter a valid 10-digit phone number"); return; }
  const itemId = document.getElementById("rnItem").value;
  const items = LFS.get("lfs_rental_items");
  const item = items.find(i => i.id === itemId);
  if (!item) { toast("Please select a jewellery item"); return; }

  const days = Math.max(1, Number(document.getElementById("rnDays").value) || 1);
  const date = document.getElementById("rnDate").value || LFS.todayISO();
  const rate = Number(document.getElementById("rnRate").value) || 0;
  const deposit = Number(document.getElementById("rnDeposit").value) || 0;
  const discount = Number(document.getElementById("rnDiscount").value) || 0;
  const advance = Number(document.getElementById("rnAdvance").value) || 0;
  const advanceMode = document.getElementById("rnAdvanceMode").value;
  const total = (rate * days) + deposit;
  const balance = total - discount - advance;
  const returnDate = new Date(date); returnDate.setDate(returnDate.getDate() + days);

  const name = document.getElementById("rnName").value.trim();
  const address = document.getElementById("rnAddress").value.trim();
  const region = document.getElementById("rnRegion").value;

  const referred = document.getElementById("rnReferredYesNo").value === "yes";
  let referrerName = "", referrerPhone = "", referrerPlace = "", referralCommission = 0;
  if (referred) {
    referrerName = document.getElementById("rnReferrerName").value.trim();
    referrerPhone = document.getElementById("rnReferrerPhone").value.trim();
    referrerPlace = document.getElementById("rnReferrerPlace").value.trim();
    if (!referrerName) { toast("Please enter the referrer's name"); return; }
    if (!LFS.isValidPhone(referrerPhone)) { toast("Please enter a valid 10-digit referrer phone number"); return; }
    referralCommission = computeCommission(item, rate * days);
  }

  const customers = LFS.get("lfs_customers");
  let cust = customers.find(c => c.phone === phone);
  if (!cust) {
    cust = { id: LFS.uid("cus"), name, phone, address, region, howHeard: document.getElementById("rnHowHeard").value, loyaltyPoints: 0, repeatCustomer: false, reviewGiven: false, reviewPlatform: "", notes: "", createdAt: LFS.nowISO() };
    customers.push(cust);
  } else {
    cust.name = name; cust.address = address; cust.region = region;
    cust.repeatCustomer = true;
  }
  if (RENTAL_REDEEM_APPLIED && RENTAL_REDEEM_APPLIED.customerId === cust.id) {
    cust.loyaltyPoints = 0;
  }
  const rentalCharge = rate * days;
  const netRevenue = Math.max(0, rentalCharge - discount - (referred ? referralCommission : 0));
  const loyalty = LFS.get("lfs_loyalty");
  // Points are earned on the actual sale (rental charge), never on the refundable deposit.
  const pointsEarned = Math.floor(netRevenue * (loyalty.pointsPer100Rupees || 0) / 100);
  const pointsRedeemed = (RENTAL_REDEEM_APPLIED && RENTAL_REDEEM_APPLIED.customerId === cust.id) ? RENTAL_REDEEM_APPLIED.points : 0;
  const redemptionValue = (RENTAL_REDEEM_APPLIED && RENTAL_REDEEM_APPLIED.customerId === cust.id) ? RENTAL_REDEEM_APPLIED.value : 0;
  cust.loyaltyPoints = (cust.loyaltyPoints || 0) + pointsEarned;
  LFS.set("lfs_customers", customers);
  RENTAL_REDEEM_APPLIED = null;

  const rentals = LFS.get("lfs_rentals");
  const record = {
    id: LFS.uid("ren"),
    createdAt: LFS.nowISO(),
    rentalItemId: item.id,
    itemName: item.itemName,
    customerPhone: phone,
    customerName: name,
    customerAddress: address,
    eventType: document.getElementById("rnEvent").value,
    rentalDate: date,
    expectedReturnDate: returnDate.toISOString().slice(0, 10),
    actualReturnDate: "",
    days, dailyRate: rate, deposit, discount, advancePaid: advance, advancePaymentMode: advanceMode,
    total, balance, status: "active", handledBy: employee, settlementPaymentMode: "",
    referred, referrerName, referrerPhone, referrerPlace,
    commissionType: referred ? (item.commissionType || "none") : "none",
    commissionValue: referred ? (item.commissionValue || 0) : 0,
    referralCommission,
    rentalCharge, netRevenue, pointsEarned, pointsRedeemed, redemptionValue
  };
  rentals.push(record);
  LFS.set("lfs_rentals", rentals);

  item.status = "rented";
  LFS.set("lfs_rental_items", items);

  const html = buildReceiptHtml({
    itemName: item.itemName, itemImage: item.imageDataUrl,
    dateLabel: "Rental Date", dateValue: date, dateLabel2: "Return Due", dateValue2: record.expectedReturnDate,
    customerName: name, phone,
    rows: [
      { label: "Daily Rate × Days", value: LFS.formatMoney(rate * days) },
      { label: "Security Deposit (Refundable)", value: LFS.formatMoney(deposit) },
      { label: "Discount", value: "-" + LFS.formatMoney(discount) },
      { label: "Advance Paid", value: "-" + LFS.formatMoney(advance) }
    ],
    totalLabel: "Balance Pending", totalValue: LFS.formatMoney(balance),
    paymentMode: advance > 0 ? advanceMode : ""
  });
  document.getElementById("receiptSlot").innerHTML = `
    <div class="card">
      ${html}
      <div class="text-center mt-16"><button class="btn btn-gold" onclick="window.print()">Print Receipt</button></div>
    </div>
  `;

  toast("Rental saved. Receipt ready.");
  renderNewRentalReset();
}

function renderNewRentalReset() {
  const formCard = document.querySelector("#rentalSubContent .card");
  if (formCard) formCard.outerHTML = renderNewRental().split('<div id="receiptSlot">')[0];
  wireTabEvents();
}

function renderHistoricRentals() {
  const rentals = LFS.get("lfs_rentals").slice().reverse();
  const active = rentals.filter(r => r.status === "active");
  const past = rentals.filter(r => r.status !== "active");
  return `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">⏱️ Active Rentals</h2><button class="btn btn-outline btn-sm" onclick="printRentalsReportSales()">Print All</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Customer</th><th>Rented</th><th>Time (IST)</th><th>Due</th><th>Balance</th><th>Settle Via</th><th></th></tr></thead>
          <tbody>
            ${active.map(r => `
              <tr>
                <td>${escapeHtml(r.itemName)}</td>
                <td>${escapeHtml(r.customerName)}<br><span class="text-soft">${r.customerPhone}</span></td>
                <td>${r.rentalDate}</td>
                <td>${LFS.formatIST(r.createdAt)}</td>
                <td>${r.expectedReturnDate}</td>
                <td>${LFS.formatMoney(r.balance)}</td>
                <td><select id="settleMode_${r.id}" style="width:110px;">${LFS.PAYMENT_MODES.map(m => `<option>${m}</option>`).join("")}</select></td>
                <td class="flex gap-8">
                  <button class="btn btn-outline btn-sm" onclick="markReturned('${r.id}')">Mark Returned</button>
                  <button class="btn btn-outline btn-sm" onclick="printRentalReceipt('${r.id}')">Print</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="8" class="text-soft">No active rentals.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h2>📜 Rental History</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Customer</th><th>Rented</th><th>Time (IST)</th><th>Returned</th><th>Rental Charge</th><th>Deposit (Refundable)</th><th>Net Revenue</th><th></th></tr></thead>
          <tbody>
            ${past.map(r => `<tr>
              <td>${escapeHtml(r.itemName)}</td><td>${escapeHtml(r.customerName)}</td><td>${r.rentalDate}</td><td>${LFS.formatIST(r.createdAt)}</td><td>${r.actualReturnDate}</td><td>${LFS.formatMoney(r.rentalCharge !== undefined ? r.rentalCharge : r.dailyRate * r.days)}</td><td>${LFS.formatMoney(r.deposit)}</td><td>${LFS.formatMoney(LFS.rentalNetRevenue(r))}</td>
              <td><button class="btn btn-outline btn-sm" onclick="printRentalReceipt('${r.id}')">Print</button></td>
            </tr>`).join("") || `<tr><td colspan="9" class="text-soft">No history yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function printRentalReceipt(rentalId) {
  const r = LFS.get("lfs_rentals").find(x => x.id === rentalId);
  if (!r) return;
  const item = LFS.get("lfs_rental_items").find(i => i.id === r.rentalItemId);
  const html = buildReceiptHtml({
    itemName: r.itemName, itemImage: item ? item.imageDataUrl : "",
    dateLabel: "Rental Date", dateValue: r.rentalDate,
    dateLabel2: r.status === "active" ? "Return Due" : "Returned", dateValue2: r.status === "active" ? r.expectedReturnDate : r.actualReturnDate,
    customerName: r.customerName, phone: r.customerPhone,
    rows: [
      { label: "Daily Rate × Days", value: LFS.formatMoney(r.dailyRate * r.days) },
      { label: "Security Deposit (Refundable)", value: LFS.formatMoney(r.deposit) },
      { label: "Discount", value: "-" + LFS.formatMoney(r.discount) },
      { label: "Advance Paid", value: "-" + LFS.formatMoney(r.advancePaid) }
    ],
    totalLabel: r.status === "active" ? "Balance Pending" : "Total",
    totalValue: LFS.formatMoney(r.status === "active" ? r.balance : r.total),
    paymentMode: r.status === "active" ? r.advancePaymentMode : (r.settlementPaymentMode || r.advancePaymentMode)
  });
  showReceiptModal(html);
}

function printRentalsReportSales() {
  const rentals = LFS.get("lfs_rentals").slice().reverse();
  const rows = rentals.map(r => ({
    date: r.rentalDate, time: LFS.formatIST(r.createdAt), item: r.itemName, customer: r.customerName, status: r.status,
    rentalCharge: LFS.formatMoney(r.rentalCharge !== undefined ? r.rentalCharge : r.dailyRate * r.days),
    deposit: LFS.formatMoney(r.deposit), netRevenue: LFS.formatMoney(LFS.rentalNetRevenue(r)), balance: LFS.formatMoney(r.balance)
  }));
  LFS.printReport("Rentals Report", LFS.tableHtml(rows, [
    { key: "date", label: "Date" }, { key: "time", label: "Time (IST)" }, { key: "item", label: "Item" }, { key: "customer", label: "Customer" },
    { key: "status", label: "Status" }, { key: "rentalCharge", label: "Rental Charge" }, { key: "deposit", label: "Deposit (Refundable)" }, { key: "netRevenue", label: "Net Revenue" }, { key: "balance", label: "Balance" }
  ]));
}

function markReturned(rentalId) {
  const rentals = LFS.get("lfs_rentals");
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return;
  const modeSel = document.getElementById(`settleMode_${rentalId}`);
  r.status = "returned";
  r.actualReturnDate = LFS.todayISO();
  r.settlementPaymentMode = modeSel ? modeSel.value : "Cash";
  LFS.set("lfs_rentals", rentals);

  const items = LFS.get("lfs_rental_items");
  const item = items.find(i => i.id === r.rentalItemId);
  if (item) {
    item.status = "available";
    item.timesRented = (item.timesRented || 0) + 1;
    item.totalEarned = (item.totalEarned || 0) + LFS.rentalNetRevenue(r);
    LFS.set("lfs_rental_items", items);
  }
  toast("Item marked as returned to stock");
  renderTab();
}

function lookupRequestCustomer() {
  const phone = document.getElementById("reqPhone").value.trim();
  if (!LFS.isValidPhone(phone)) return;
  const cust = LFS.get("lfs_customers").find(c => c.phone === phone);
  if (cust) document.getElementById("reqName").value = cust.name;
}

function renderCustomerRequests() {
  const reqs = LFS.get("lfs_customer_requests").slice().reverse();
  return `
    <div class="card">
      <h2>💬 Log Customer Requirement / Comment</h2>
      <form id="reqForm">
        <div class="grid cols-2">
          <div class="field">
            <label>Customer Phone</label>
            <input type="tel" id="reqPhone" maxlength="10" oninput="lookupRequestCustomer()" placeholder="10-digit mobile number">
          </div>
          <div class="field">
            <label>Customer Name</label>
            <input type="text" id="reqName">
          </div>
        </div>
        <div class="field">
          <label>What did they ask for / feedback</label>
          <textarea id="reqComment" required placeholder="e.g. Wants more temple jewellery haaram sets for wedding season"></textarea>
        </div>
        <button class="btn btn-primary" type="submit">Save Note</button>
      </form>
    </div>
    <div class="card">
      <h3>📝 Recent Customer Notes</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Time (IST)</th><th>Customer</th><th>Comment</th></tr></thead>
          <tbody>
            ${reqs.map(r => `<tr><td>${r.date}</td><td>${LFS.formatIST(r.createdAt)}</td><td>${escapeHtml(r.customerName) || "-"} <br><span class="text-soft">${r.customerPhone || ""}</span></td><td>${escapeHtml(r.comment)}</td></tr>`).join("") || `<tr><td colspan="4" class="text-soft">No notes yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function submitRequest(e) {
  e.preventDefault();
  const reqs = LFS.get("lfs_customer_requests");
  reqs.push({
    id: LFS.uid("req"),
    date: LFS.todayISO(),
    createdAt: LFS.nowISO(),
    customerPhone: document.getElementById("reqPhone").value.trim(),
    customerName: document.getElementById("reqName").value.trim(),
    comment: document.getElementById("reqComment").value.trim(),
    loggedBy: LFS.currentEmployeeName() || "Sales Person"
  });
  LFS.set("lfs_customer_requests", reqs);
  toast("Note saved");
  renderTab();
}

/* ============================================================
   DAILY EXPENSES (sales-side entry, feeds Admin > Expenses)
   ============================================================ */
function renderDailyExpenses() {
  const staff = LFS.get("lfs_staff").filter(s => s.active);
  const currentEmp = LFS.currentEmployeeName();
  const today = LFS.todayISO();
  const mine = LFS.get("lfs_expenses").filter(e => e.source === "sales_person" && e.date === today).slice().reverse();
  return `
    <div class="card">
      <h2>💵 Log Daily Shop Expense</h2>
      <p class="text-soft">Small day-to-day expenses (e.g. cleaning supplies, packaging, tea/snacks for staff). These appear in Admin &gt; Expenses &gt; Log Store Monthly Expense automatically.</p>
      <form id="dailyExpenseForm">
        <div class="grid cols-2">
          <div class="field">
            <label>Sales Person *</label>
            <select id="deEmployee" required>
              <option value="">-- Select employee --</option>
              ${staff.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === currentEmp ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Amount (₹) *</label>
            <input type="number" id="deAmount" min="0" required>
          </div>
        </div>
        <div class="field">
          <label>Description *</label>
          <input type="text" id="deDesc" required placeholder="e.g. Packaging covers, tea for staff">
        </div>
        <button class="btn btn-primary" type="submit">Save Expense</button>
      </form>
    </div>
    <div class="card">
      <h3>📅 Logged Today</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time (IST)</th><th>Employee</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>${mine.map(e => `<tr><td>${LFS.formatIST(e.createdAt)}</td><td>${escapeHtml(e.loggedBy || "")}</td><td>${escapeHtml(e.description)}</td><td>${LFS.formatMoney(e.amount)}</td></tr>`).join("") || `<tr><td colspan="4" class="text-soft">Nothing logged today yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}
function submitDailyExpense(e) {
  e.preventDefault();
  const employee = document.getElementById("deEmployee").value;
  if (!employee) { toast("Please select the sales person"); return; }
  LFS.setCurrentEmployeeName(employee);
  const expenses = LFS.get("lfs_expenses");
  const date = LFS.todayISO();
  expenses.push({
    id: LFS.uid("exp"),
    category: "Daily Shop Expense",
    description: document.getElementById("deDesc").value.trim(),
    amount: Number(document.getElementById("deAmount").value) || 0,
    date, month: date.slice(0, 7),
    source: "sales_person",
    loggedBy: employee,
    createdAt: LFS.nowISO()
  });
  LFS.set("lfs_expenses", expenses);
  toast("Expense logged");
  renderTab();
}

/* ============================================================
   RECENT SALES SUMMARY - configurable cash-handover digest
   ============================================================ */
function daySalesSummary(dateISO) {
  const sales = LFS.get("lfs_sales").filter(s => s.date === dateISO);
  const rentalsStarted = LFS.get("lfs_rentals").filter(r => r.rentalDate === dateISO);
  const rentalsReturned = LFS.get("lfs_rentals").filter(r => r.actualReturnDate === dateISO);

  let cash = 0, gpay = 0, other = 0;
  const bucket = (mode, amt) => {
    if (!amt) return;
    if (mode === "Cash") cash += amt;
    else if (mode === "GPay") gpay += amt;
    else other += amt;
  };
  sales.forEach(s => bucket(s.paymentMode, Number(s.total || 0)));
  rentalsStarted.forEach(r => bucket(r.advancePaymentMode, Number(r.advancePaid || 0)));
  rentalsReturned.forEach(r => bucket(r.settlementPaymentMode, Math.max(0, Number(r.balance || 0))));

  const salesRevenue = sales.reduce((s, x) => s + Number(x.total || 0), 0);
  const rentalRevenue = rentalsStarted.reduce((s, r) => s + LFS.rentalNetRevenue(r), 0);
  const pointsEarned = sales.reduce((s, x) => s + Number(x.pointsEarned || 0), 0);
  const pointsRedeemed = sales.reduce((s, x) => s + Number(x.pointsRedeemed || 0), 0);

  return { date: dateISO, salesCount: sales.length, salesRevenue, rentalCount: rentalsStarted.length, rentalRevenue, pointsEarned, pointsRedeemed, cash, gpay, other, total: cash + gpay + other };
}

function renderRecentSalesSummary() {
  const s = LFS.get("lfs_settings");
  const sd = s.salesDept || { recentSummaryDays: 5, showDailySalesSummary: true, showRentalSummary: true };
  const days = Math.max(1, Number(sd.recentSummaryDays) || 5);
  const showDaily = sd.showDailySalesSummary !== false;
  const showRental = sd.showRentalSummary !== false;

  const dayList = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayList.push(daySalesSummary(d.toISOString().slice(0, 10)));
  }

  const grand = dayList.reduce((acc, d) => ({
    salesRevenue: acc.salesRevenue + d.salesRevenue, rentalRevenue: acc.rentalRevenue + d.rentalRevenue,
    cash: acc.cash + d.cash, gpay: acc.gpay + d.gpay, other: acc.other + d.other, total: acc.total + d.total
  }), { salesRevenue: 0, rentalRevenue: 0, cash: 0, gpay: 0, other: 0, total: 0 });

  return `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0;">📆 Recent Sales Summary - Last ${days} Days</h2>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="printRecentSummary()">Print</button>
          <button class="btn btn-outline btn-sm" onclick="downloadRecentSummaryPDF()">PDF</button>
          <button class="btn btn-outline btn-sm" onclick="downloadRecentSummaryCSV()">CSV</button>
        </div>
      </div>
      <p class="text-soft">A quick digest to help reconcile cash and hand over the day's takings to the shop owner. The number of days and which sections show here are set by the Admin under Sales Report &gt; Sales Dept Setting.</p>
      <div class="grid cols-3">
        ${showDaily ? `<div class="stat-box"><div class="num">${LFS.formatMoney(grand.salesRevenue)}</div><div class="lbl">Daily Sales Revenue</div></div>` : ""}
        ${showRental ? `<div class="stat-box"><div class="num">${LFS.formatMoney(grand.rentalRevenue)}</div><div class="lbl">Rental Revenue</div></div>` : ""}
        <div class="stat-box"><div class="num">${LFS.formatMoney(grand.total)}</div><div class="lbl">Total Collected</div></div>
      </div>
      <div class="grid cols-3 mt-16">
        <div class="stat-box"><div class="num">${LFS.formatMoney(grand.cash)}</div><div class="lbl">Cash Collected</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(grand.gpay)}</div><div class="lbl">GPay Collected</div></div>
        <div class="stat-box"><div class="num">${LFS.formatMoney(grand.other)}</div><div class="lbl">Other (Card / UPI)</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Day-by-Day Breakdown</h3>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Date</th>
            ${showDaily ? "<th>Daily Sales (count)</th><th>Sales Revenue</th>" : ""}
            ${showRental ? "<th>Rentals (count)</th><th>Rental Revenue</th>" : ""}
            <th>Cash</th><th>GPay</th><th>Other</th><th>Total Collected</th>
          </tr></thead>
          <tbody>
            ${dayList.map(d => `<tr>
              <td>${d.date}</td>
              ${showDaily ? `<td>${d.salesCount}</td><td>${LFS.formatMoney(d.salesRevenue)}</td>` : ""}
              ${showRental ? `<td>${d.rentalCount}</td><td>${LFS.formatMoney(d.rentalRevenue)}</td>` : ""}
              <td>${LFS.formatMoney(d.cash)}</td><td>${LFS.formatMoney(d.gpay)}</td><td>${LFS.formatMoney(d.other)}</td><td style="font-weight:700;">${LFS.formatMoney(d.total)}</td>
            </tr>`).join("")}
            <tr style="font-weight:700;background:var(--ivory-dim);">
              <td>Total</td>
              ${showDaily ? `<td></td><td>${LFS.formatMoney(grand.salesRevenue)}</td>` : ""}
              ${showRental ? `<td></td><td>${LFS.formatMoney(grand.rentalRevenue)}</td>` : ""}
              <td>${LFS.formatMoney(grand.cash)}</td><td>${LFS.formatMoney(grand.gpay)}</td><td>${LFS.formatMoney(grand.other)}</td><td>${LFS.formatMoney(grand.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function recentSummaryRows() {
  const s = LFS.get("lfs_settings");
  const sd = s.salesDept || { recentSummaryDays: 5 };
  const days = Math.max(1, Number(sd.recentSummaryDays) || 5);
  const rows = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const sum = daySalesSummary(d.toISOString().slice(0, 10));
    rows.push({
      date: sum.date, salesCount: sum.salesCount, salesRevenue: LFS.formatMoney(sum.salesRevenue),
      rentalCount: sum.rentalCount, rentalRevenue: LFS.formatMoney(sum.rentalRevenue),
      cash: LFS.formatMoney(sum.cash), gpay: LFS.formatMoney(sum.gpay), other: LFS.formatMoney(sum.other), total: LFS.formatMoney(sum.total)
    });
  }
  return rows;
}
function printRecentSummary() {
  const days = (LFS.get("lfs_settings").salesDept || {}).recentSummaryDays || 5;
  LFS.printReport(`Recent Sales Summary - Last ${days} Days`, LFS.tableHtml(recentSummaryRows(), [
    { key: "date", label: "Date" }, { key: "salesCount", label: "Sales #" }, { key: "salesRevenue", label: "Sales Revenue" },
    { key: "rentalCount", label: "Rentals #" }, { key: "rentalRevenue", label: "Rental Revenue" },
    { key: "cash", label: "Cash" }, { key: "gpay", label: "GPay" }, { key: "other", label: "Other" }, { key: "total", label: "Total Collected" }
  ]));
}
function downloadRecentSummaryPDF() {
  const days = (LFS.get("lfs_settings").salesDept || {}).recentSummaryDays || 5;
  LFS.downloadPDF(`Recent Sales Summary - Last ${days} Days`, recentSummaryRows(), [
    { key: "date", label: "Date" }, { key: "salesCount", label: "Sales #" }, { key: "salesRevenue", label: "Sales Revenue" },
    { key: "rentalCount", label: "Rentals #" }, { key: "rentalRevenue", label: "Rental Revenue" },
    { key: "cash", label: "Cash" }, { key: "gpay", label: "GPay" }, { key: "other", label: "Other" }, { key: "total", label: "Total Collected" }
  ]);
}
function downloadRecentSummaryCSV() {
  LFS.downloadCSV("recent_sales_summary.csv", recentSummaryRows());
}

/* ============================================================
   SEND DATA - sales staff's own GitHub push, scoped to only the
   records sales staff actually generate (never store settings, staff,
   promotions, loyalty rules, rental rates/commission, or the image
   library, which stay admin-only so a stale sales-device cache can
   never overwrite the admin's real configuration).
   ============================================================ */
function renderSendData() {
  const ghCfg = LFS.getGithubConfig();
  const hasToken = !!LFS.getGithubToken();
  const lastPush = localStorage.getItem("lfs_github_last_push_sales") || "Never";
  return `
    <div class="card">
      <h2>🐙 Send Data to GitHub</h2>
      <p class="text-soft">Pushes <strong>this device's</strong> Daily Sales, Rentals, Expenses, Customers, Customer Notes, and Stock quantities straight into the shop's GitHub repo. It does not touch store settings, staff records, promotions, or pricing - those stay admin-only. This is a one-way, on-demand push - it doesn't pull other devices' data.</p>
      <form id="sendDataForm">
        <div class="grid cols-2">
          <div class="field"><label>Repo Owner</label><input type="text" id="sdGhOwner" placeholder="e.g. yourusername" value="${ghCfg.owner || ""}"></div>
          <div class="field"><label>Repo Name</label><input type="text" id="sdGhRepo" placeholder="e.g. lakshmi-fancy-store" value="${ghCfg.repo || ""}"></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Branch</label><input type="text" id="sdGhBranch" value="${ghCfg.branch || "main"}"></div>
          <div class="field"><label>Path Prefix</label><input type="text" id="sdGhPathPrefix" value="${ghCfg.pathPrefix || "data"}"></div>
        </div>
        <div class="field">
          <label>Personal Access Token</label>
          <input type="password" id="sdGhToken" placeholder="${hasToken ? "Token saved on this device (leave blank to keep it)" : "Ask the admin for a token scoped to this repo only"}">
        </div>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-gold" type="submit">Save &amp; Send My Sales Data Now</button>
          <button type="button" class="btn btn-outline" onclick="clearSalesGithubToken()">Clear Saved Token</button>
        </div>
      </form>
      <p class="text-soft mt-8">Last successful send from this device: ${lastPush === "Never" ? "Never" : new Date(lastPush).toLocaleString()}</p>
      <div id="sendDataStatus" class="mt-8"></div>
      <details class="help-panel">
        <summary>Help - what this does and doesn't do</summary>
        <div class="help-body">
          <p><strong>What gets sent:</strong> Daily Sales, Rentals, Expenses, Customers, Customer Notes, and current Stock quantities - the records this device actually creates.</p>
          <p><strong>What never gets sent from here:</strong> store settings, staff/attendance, promotions, loyalty and points rules, rental item rates/commission, and the image library. Only the Admin console can update those, so an out-of-date sales device can never accidentally overwrite the admin's setup.</p>
          <p><strong>Ask the admin for the repo details and your own token</strong> - each device should have its own Personal Access Token (scoped to just this repo, "Contents: Read and write" only) so it can be individually revoked if a phone or tablet is lost. Don't share one token across multiple devices.</p>
          <p><strong>This is a manual push, not live sync</strong> - send your data at the end of a shift or whenever you want it backed up. Other devices (including the admin's) won't see it until they resync from GitHub.</p>
        </div>
      </details>
    </div>
  `;
}
function clearSalesGithubToken() {
  LFS.clearGithubToken();
  toast("Saved GitHub token cleared from this device");
  renderTab();
}
async function pushSalesDataToGithub(e) {
  if (e) e.preventDefault();
  const owner = document.getElementById("sdGhOwner").value.trim();
  const repo = document.getElementById("sdGhRepo").value.trim();
  const branch = document.getElementById("sdGhBranch").value.trim() || "main";
  const pathPrefix = document.getElementById("sdGhPathPrefix").value.trim().replace(/\/$/, "") || "data";
  const tokenInput = document.getElementById("sdGhToken").value.trim();

  if (!owner || !repo) { toast("Enter the repo owner and name first"); return; }
  const token = tokenInput || LFS.getGithubToken();
  if (!token) { toast("Enter a Personal Access Token first"); return; }

  const cfg = { owner, repo, branch, pathPrefix };
  LFS.saveGithubConfig(cfg);
  if (tokenInput) LFS.setGithubToken(tokenInput);

  const statusEl = document.getElementById("sendDataStatus");
  statusEl.innerHTML = "";
  const log = (msg, isError) => {
    const line = document.createElement("div");
    line.textContent = msg;
    line.style.fontSize = ".85rem";
    if (isError) line.style.color = "var(--terracotta)";
    statusEl.appendChild(line);
  };

  log("Sending sales data to " + owner + "/" + repo + " (" + branch + ")...");
  const { successCount, failCount } = await LFS.pushKeysToGithub(LFS.SALES_PUSH_KEYS, token, cfg, log);

  log(`Done. ${successCount} succeeded, ${failCount} failed.`);
  if (failCount === 0) {
    localStorage.setItem("lfs_github_last_push_sales", new Date().toISOString());
    toast(`Sales data sent to GitHub successfully (${successCount} files)`);
  } else {
    toast(`Send finished with ${failCount} error(s) - see the log below`);
  }
}

/* ============================================================
   CATALOG / JEWELLERY STATUS
   ============================================================ */
let CATALOG_FILTER = { category: "", search: "" };

function renderCatalog() {
  const items = LFS.get("lfs_rental_items");
  const filtered = items.filter(i => {
    const matchCat = !CATALOG_FILTER.category || i.category === CATALOG_FILTER.category;
    const matchSearch = !CATALOG_FILTER.search || i.itemName.toLowerCase().includes(CATALOG_FILTER.search.toLowerCase()) || i.itemCode.toLowerCase().includes(CATALOG_FILTER.search.toLowerCase());
    return matchCat && matchSearch;
  });
  return `
    <div class="card">
      <div class="flex-between" style="flex-wrap:wrap;gap:10px;">
        <h2 style="margin:0;">📋 Jewellery Status &amp; Catalog</h2>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <input type="text" placeholder="Search item or code" style="width:180px;" value="${CATALOG_FILTER.search}" oninput="setCatalogFilter('search', this.value)">
          <select style="width:170px;" onchange="setCatalogFilter('category', this.value)">
            <option value="">All Categories</option>
            ${LFS_CATEGORIES.map(c => `<option ${CATALOG_FILTER.category === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
          <button class="btn btn-outline btn-sm" onclick="printCatalogReport()">Print</button>
        </div>
      </div>
    </div>
    <div class="grid cols-4">
      ${filtered.map(i => `
        <div class="catalog-card" onclick="openImageZoom('${i.id}')">
          <div class="img-wrap">${i.imageDataUrl ? `<img src="${i.imageDataUrl}">` : "L"}</div>
          <div class="info">
            <span class="badge ${i.status === 'available' ? 'badge-available' : 'badge-rented'}">${i.status === 'available' ? 'Available' : 'Rented Out'}</span>
            <h4>${escapeHtml(i.itemName)}</h4>
            <div class="text-soft">${i.itemCode}</div>
            <div class="price">${LFS.formatMoney(i.dailyRate)}/day</div>
          </div>
        </div>
      `).join("") || `<div class="text-soft">No items match your filters.</div>`}
    </div>
    <div id="zoomSlot"></div>
  `;
}

function printCatalogReport() {
  const items = LFS.get("lfs_rental_items");
  const rows = items.map(i => ({ item: i.itemName, code: i.itemCode, category: i.category, rate: LFS.formatMoney(i.dailyRate), status: i.status === "available" ? "Available" : "Rented Out" }));
  LFS.printReport("Jewellery Status &amp; Catalog", LFS.tableHtml(rows, [
    { key: "item", label: "Item" }, { key: "code", label: "Code" }, { key: "category", label: "Category" },
    { key: "rate", label: "Rate/Day" }, { key: "status", label: "Status" }
  ]));
}
function setCatalogFilter(key, value) { CATALOG_FILTER[key] = value; renderTab(); }

function openImageZoom(itemId) {
  const item = LFS.get("lfs_rental_items").find(i => i.id === itemId);
  if (!item) return;
  document.getElementById("zoomSlot").innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeZoom()">
      <div class="modal">
        <button class="modal-close" onclick="closeZoom()">&times;</button>
        <h3>${escapeHtml(item.itemName)}</h3>
        ${item.imageDataUrl ? `<img src="${item.imageDataUrl}">` : `<div class="img-wrap" style="height:220px;">L</div>`}
        <p class="text-soft mt-8">${item.itemCode} · ${item.itemType} · ${item.category}</p>
        <p><span class="badge ${item.status === 'available' ? 'badge-available' : 'badge-rented'}">${item.status === 'available' ? 'Available' : 'Rented Out'}</span></p>
        <div class="grid cols-2">
          <div class="stat-box"><div class="num">${LFS.formatMoney(item.dailyRate)}</div><div class="lbl">Daily Rate</div></div>
          <div class="stat-box"><div class="num">${LFS.formatMoney(item.deposit)}</div><div class="lbl">Deposit</div></div>
        </div>
      </div>
    </div>
  `;
}
function closeZoom() { document.getElementById("zoomSlot").innerHTML = ""; }

/* ---------- helpers ---------- */
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function wireTabEvents() {
  document.querySelectorAll(".subtab-btn").forEach(b => b.addEventListener("click", () => switchRentalSubtab(b.dataset.sub)));
  const f1 = document.getElementById("dailySaleForm"); if (f1) f1.addEventListener("submit", submitDailySale);
  const f2 = document.getElementById("rentalForm"); if (f2) f2.addEventListener("submit", submitRental);
  const f3 = document.getElementById("reqForm"); if (f3) f3.addEventListener("submit", submitRequest);
  const f4 = document.getElementById("dailyExpenseForm"); if (f4) f4.addEventListener("submit", submitDailyExpense);
  const f5 = document.getElementById("sendDataForm"); if (f5) f5.addEventListener("submit", pushSalesDataToGithub);
}
