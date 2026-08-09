/* ============================================================
   Lakshmi Fancy Store - gallery.js (customer-facing collection album)
   Read-only view of the shop's rental jewellery, built from the same
   data as the admin/sales apps. No customer data is shown or collected.
   ============================================================ */

let GALLERY_FILTER = { status: "", category: "", search: "" };
let GALLERY_REVEAL_OBSERVER = null;

document.addEventListener("DOMContentLoaded", async () => {
  await LFS.init();
  LFS.applyTheme();
  paintGalleryBrand();
  spawnSparkles();
  if (LFS.isAuthed("lfs_auth_gallery")) {
    showGalleryScreen();
  } else {
    showGalleryGate();
  }
  const form = document.getElementById("galleryLoginForm");
  if (form) form.addEventListener("submit", attemptGalleryUnlock);
});

function spawnSparkles() {
  const holder = document.getElementById("heroSparkles");
  if (!holder) return;
  const count = 18;
  let html = "";
  for (let i = 0; i < count; i++) {
    const top = Math.round(Math.random() * 100);
    const left = Math.round(Math.random() * 100);
    const delay = (Math.random() * 2.6).toFixed(2);
    const size = (Math.random() * 4 + 3).toFixed(1);
    html += `<span class="sparkle" style="top:${top}%;left:${left}%;animation-delay:${delay}s;width:${size}px;height:${size}px;"></span>`;
  }
  holder.innerHTML = html;
}

function paintGalleryBrand() {
  const s = LFS.get("lfs_settings");
  document.title = "Our Collection - " + (s.storeName || "Lakshmi Fancy Store");
  const logoSlot = document.getElementById("heroLogoSlot");
  if (logoSlot) {
    logoSlot.innerHTML = s.logoDataUrl
      ? `<img class="hero-logo" src="${s.logoDataUrl}" alt="logo">`
      : `<div class="hero-logo-fallback">${(s.storeName || "L").charAt(0)}</div>`;
  }
  const nameEl = document.getElementById("heroStoreName");
  if (nameEl) nameEl.textContent = s.storeName || "Lakshmi Fancy Store";
}

function showGalleryGate() {
  document.getElementById("galleryGate").classList.remove("hidden");
  document.getElementById("galleryScreen").classList.add("hidden");
}
function showGalleryScreen() {
  document.getElementById("galleryGate").classList.add("hidden");
  document.getElementById("galleryScreen").classList.remove("hidden");
  LFS.paintFooter("galleryFooter");
  LFS.initGoTop("goTopBtn");
  populateCategoryOptions();
  renderGalleryGrid();
}
// A returning customer's browser may still have the OLD gallery password
// cached from before the admin last changed it (data only re-seeds into a
// browser once, the same reason the staff apps have their own reset link).
// This clears it and reloads so the page picks up the current password
// and collection data - worded for a customer, not staff.
function confirmResetGalleryData(e) {
  if (e) e.preventDefault();
  const ok = confirm("This refreshes the page with the latest password and collection details from the store. Continue?");
  if (ok) LFS.resetAppData();
}

function attemptGalleryUnlock(e) {
  e.preventDefault();
  const pw = document.getElementById("galleryPasswordInput").value;
  if (LFS.checkPassword(pw, "galleryPassword")) {
    LFS.setAuthed("lfs_auth_gallery");
    document.getElementById("galleryLoginError").classList.add("hidden");
    showGalleryScreen();
  } else {
    document.getElementById("galleryLoginError").classList.remove("hidden");
  }
}

/* ---------- data helpers ---------- */
function galleryItems() {
  const items = LFS.get("lfs_rental_items");
  const rentals = LFS.get("lfs_rentals");
  return items.map(item => {
    let expectedReturn = "";
    if (item.status === "rented") {
      const active = rentals.find(r => r.rentalItemId === item.id && r.status === "active");
      if (active) expectedReturn = active.expectedReturnDate;
    }
    return { ...item, expectedReturn };
  });
}

function populateCategoryOptions() {
  const sel = document.getElementById("galleryCategory");
  const cats = Array.from(new Set(galleryItems().map(i => i.category).filter(Boolean)));
  sel.innerHTML = `<option value="">All Categories</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
  document.querySelectorAll("#statusChips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#statusChips .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      GALLERY_FILTER.status = chip.dataset.status;
      renderGalleryGrid();
    });
  });
}

function onGalleryFilterChange() {
  GALLERY_FILTER.category = document.getElementById("galleryCategory").value;
  GALLERY_FILTER.search = document.getElementById("gallerySearch").value.trim().toLowerCase();
  renderGalleryGrid();
}

function renderGalleryGrid() {
  const all = galleryItems();
  const filtered = all.filter(i => {
    const matchStatus = !GALLERY_FILTER.status || i.status === GALLERY_FILTER.status;
    const matchCategory = !GALLERY_FILTER.category || i.category === GALLERY_FILTER.category;
    const matchSearch = !GALLERY_FILTER.search || i.itemName.toLowerCase().includes(GALLERY_FILTER.search) || (i.itemType || "").toLowerCase().includes(GALLERY_FILTER.search);
    return matchStatus && matchCategory && matchSearch;
  });

  const availableCount = all.filter(i => i.status === "available").length;
  const statsEl = document.getElementById("heroStats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="hero-stat"><strong>${all.length}</strong> Pieces in Collection</div>
      <div class="hero-stat"><strong>${availableCount}</strong> Available Today</div>
    `;
  }

  const grid = document.getElementById("galleryGrid");
  if (!filtered.length) {
    grid.innerHTML = `<div class="gallery-empty">✨ No pieces match your search right now. Try a different filter or visit us in-store to see the full collection!</div>`;
    return;
  }
  grid.innerHTML = filtered.map(i => `
    <div class="jewel-card reveal" onclick="openLightbox('${i.id}')">
      <div class="jewel-img-wrap">
        ${i.imageDataUrl ? `<img src="${i.imageDataUrl}" alt="${escapeHtmlG(i.itemName)}" loading="lazy">` : `<div class="jewel-img-placeholder">💎</div>`}
        <span class="jewel-status-badge ${i.status === "available" ? "status-available" : "status-rented"}">${i.status === "available" ? "Available" : "Booked"}</span>
        <div class="jewel-shine"></div>
      </div>
      <div class="jewel-info">
        <h3>${escapeHtmlG(i.itemName)}</h3>
        <div class="jewel-type">${escapeHtmlG(i.category || "")}${i.itemType ? " · " + escapeHtmlG(i.itemType) : ""}</div>
        <div class="jewel-rate">${LFS.formatMoney(i.dailyRate)} / day</div>
        ${i.status === "rented" && i.expectedReturn ? `<div class="jewel-return">Available from ${formatFriendlyDate(i.expectedReturn)}</div>` : ""}
      </div>
    </div>
  `).join("");

  initRevealObserver();
}

function formatFriendlyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function initRevealObserver() {
  if (GALLERY_REVEAL_OBSERVER) GALLERY_REVEAL_OBSERVER.disconnect();
  const cards = document.querySelectorAll(".jewel-card.reveal");
  if (!("IntersectionObserver" in window)) { cards.forEach(c => c.classList.add("visible")); return; }
  GALLERY_REVEAL_OBSERVER = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        GALLERY_REVEAL_OBSERVER.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  cards.forEach(c => GALLERY_REVEAL_OBSERVER.observe(c));
}

/* ---------- lightbox ---------- */
function openLightbox(itemId) {
  const item = galleryItems().find(i => i.id === itemId);
  if (!item) return;
  const s = LFS.get("lfs_settings");
  const isAvailable = item.status === "available";
  const whatsappNumber = (s.social && s.social.whatsapp) ? s.social.whatsapp.replace(/\D/g, "") : (s.phone || "").replace(/\D/g, "");
  const waLink = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi! I'm interested in the " + item.itemName + " from your collection.")}` : "";
  const callLink = s.phone ? `tel:${s.phone}` : "";

  const html = `
    <div class="lightbox-backdrop" onclick="if(event.target===this) closeLightbox()">
      <div class="lightbox">
        <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
        <div class="lightbox-img-wrap">
          ${item.imageDataUrl ? `<img src="${item.imageDataUrl}" alt="${escapeHtmlG(item.itemName)}">` : `<div class="jewel-img-placeholder" style="height:100%;">💎</div>`}
        </div>
        <div class="lightbox-body">
          <h2>${escapeHtmlG(item.itemName)}</h2>
          <div class="lightbox-meta">${escapeHtmlG(item.category || "")}${item.itemType ? " · " + escapeHtmlG(item.itemType) : ""} · ${item.itemCode || ""}</div>
          <span class="jewel-status-badge ${isAvailable ? "status-available" : "status-rented"}" style="position:static;display:inline-block;">${isAvailable ? "Available Now" : "Currently Booked"}</span>
          ${!isAvailable && item.expectedReturn ? `<div class="jewel-return mt-8">Expected available from <strong>${formatFriendlyDate(item.expectedReturn)}</strong></div>` : ""}
          <div class="lightbox-price-row">
            <div class="lightbox-price">${LFS.formatMoney(item.dailyRate)} <span style="font-size:.7rem;color:var(--ink-soft);font-weight:400;">/ day</span></div>
            <div class="text-soft" style="font-size:.8rem;">Deposit: ${LFS.formatMoney(item.deposit)}</div>
          </div>
          <div class="lightbox-cta">
            <p>${isAvailable ? "Love this piece? Reserve it or visit us to try it on!" : "This piece is booked, but we can let you know when it's free - or come see similar pieces in-store!"}</p>
            <div class="lightbox-cta-buttons">
              ${waLink ? `<a class="btn btn-gold" href="${waLink}" target="_blank" rel="noopener">💬 WhatsApp Us</a>` : ""}
              ${callLink ? `<a class="btn btn-outline" href="${callLink}">📞 Call Store</a>` : ""}
            </div>
            ${s.qrCodes && s.qrCodes.storeLocation ? `<img class="lightbox-qr" src="${s.qrCodes.storeLocation}" alt="Store location QR">` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("lightboxSlot").innerHTML = html;
}
function closeLightbox() {
  document.getElementById("lightboxSlot").innerHTML = "";
}

function escapeHtmlG(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
