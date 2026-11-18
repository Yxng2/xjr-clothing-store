const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
let products = [], cart = [], artworkUrl = "", designDescription = "";
let whatsappNumber = "2347015119367";

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function renderProducts() {
  $("#products").innerHTML = products.map(p => `
    <article class="product-card">
      <div class="product-visual"><span>XJR PRINTING / COLLECTION</span></div>
      <div class="product-info"><div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description || "")}</p></div><strong class="price">${money(p.price)}</strong></div>
      <button class="add-btn" data-add="${p.id}">Add to cart +</button>
    </article>`).join("");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function renderCart() {
  $("#cartCount").textContent = cart.reduce((n, x) => n + x.quantity, 0);
  $("#cartItems").innerHTML = cart.length ? cart.map(item => `
    <div class="cart-row"><div><strong>${escapeHtml(item.name)}</strong><br>${money(item.price)} × ${item.quantity}</div>
    <div><strong>${money(item.price * item.quantity)}</strong><br><button data-remove="${item.id}">Remove</button></div></div>`).join("") : '<p class="muted">Your cart is empty.</p>';
  $("#cartTotal").textContent = money(cart.reduce((n, x) => n + x.price * x.quantity, 0));
}
function openCart(open) {
  $("#cartDrawer").classList.toggle("open", open);
  $("#backdrop").classList.toggle("open", open);
}
$("#products").addEventListener("click", e => {
  const id = e.target.dataset.add;
  if (!id) return;
  const product = products.find(p => p.id === id);
  const existing = cart.find(x => x.id === id);
  if (existing) existing.quantity++;
  else cart.push({ id, name: product.name, price: product.price, quantity: 1 });
  renderCart();
});
$("#cartItems").addEventListener("click", e => {
  const id = e.target.dataset.remove;
  if (id) { cart = cart.filter(x => x.id !== id); renderCart(); }
});
$("#cartOpen").onclick = () => openCart(true);
$("#cartClose").onclick = $("#backdrop").onclick = () => openCart(false);
$("#menuToggle").onclick = () => $("#nav").classList.toggle("show");
$("#nav").addEventListener("click", e => { if (e.target.tagName === "A") $("#nav").classList.remove("show"); });

$("#artworkFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { $("#uploadStatus").textContent = "Image is larger than 8MB."; return; }
  const form = new FormData(); form.append("artwork", file);
  $("#uploadStatus").textContent = "Uploading image…";
  try {
    const result = await api("/api/upload", { method: "POST", body: form });
    artworkUrl = result.url;
    $("#uploadStatus").textContent = "Artwork uploaded successfully: " + file.name;
  } catch (err) { $("#uploadStatus").textContent = err.message; }
});
$("#saveDesign").onclick = () => {
  designDescription = $("#designText").value.trim();
  $("#orderNote").value = [designDescription, $("#orderNote").value].filter(Boolean).join("\n");
  $("#checkoutStatus").textContent = "Design details added. Add an item and submit your order.";
  openCart(true);
};

$("#checkoutForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!cart.length) { $("#checkoutStatus").textContent = "Add a T-shirt to your cart first."; return; }
  const form = new FormData(e.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.items = cart.map(({ id, quantity }) => ({ id, quantity }));
  payload.artworkUrl = artworkUrl;
  $("#checkoutStatus").textContent = "Submitting order…";
  try {
    const result = await api("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    $("#checkoutStatus").textContent = `${result.message} Your reference is ${result.order.id}.`;
    $("#checkoutStatus").className = "status-ok";
    const message = `Hello XJR PRINTING, I submitted order ${result.order.id}. Please confirm the order and next steps.`;
    $("#checkoutStatus").insertAdjacentHTML("beforeend", ` <a target="_blank" rel="noopener" href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}">Contact us on WhatsApp</a>`);
    cart = []; renderCart(); e.currentTarget.reset(); artworkUrl = ""; $("#uploadStatus").textContent = "No image uploaded yet.";
  } catch (err) { $("#checkoutStatus").textContent = err.message; $("#checkoutStatus").className = "status-error"; }
});

$("#adminLogin").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("#adminPassword").value }) });
    $("#adminPanel").hidden = false; $("#adminPassword").value = ""; loadOrders();
  } catch (err) { alert(err.message); }
});
async function loadOrders() {
  try {
    const orders = await api("/api/admin/orders");
    $("#ordersList").innerHTML = orders.length ? orders.map(o => `
      <article class="admin-order"><strong>${escapeHtml(o.id)} — ${escapeHtml(o.customer)}</strong><br>
      ${escapeHtml(o.phone)} · ${money(o.total)}<br>
      ${o.items.map(i => `${escapeHtml(i.name)} × ${i.quantity}`).join(", ")}<br>
      <span>${escapeHtml(o.note || "")}</span><br>
      <label>Status</label><select data-status="${o.id}">${["Pending confirmation","Confirmed","In production","Ready for delivery","Delivered","Cancelled"].map(s => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <small>${new Date(o.createdAt).toLocaleString()}</small></article>`).join("") : "<p>No orders yet.</p>";
  } catch (err) { $("#ordersList").textContent = err.message; }
}
$("#loadOrders").onclick = loadOrders;
$("#ordersList").addEventListener("change", async e => {
  const id = e.target.dataset.status;
  if (!id) return;
  try { await api(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: e.target.value }) }); }
  catch (err) { alert(err.message); }
});
$("#adminLogout").onclick = async () => {
  await api("/api/admin/logout", { method: "POST" });
  $("#adminPanel").hidden = true; $("#ordersList").innerHTML = "";
};

async function init() {
  $("#year").textContent = new Date().getFullYear();
  try {
    [products] = await Promise.all([api("/api/products")]);
    const config = await api("/api/config");
    whatsappNumber = config.whatsapp || whatsappNumber;
    $("#whatsappLink").href = `https://wa.me/${whatsappNumber}`;
    renderProducts();
  } catch (err) { $("#products").textContent = "The shop is temporarily unavailable. Please refresh shortly."; }
  renderCart();
}
init();
