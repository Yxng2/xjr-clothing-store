const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";
const SESSION_SECRET = process.env.SESSION_SECRET || "development-secret-change-me";
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "storage");
const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads");
const ORDERS_FILE = path.join(STORAGE_DIR, "orders.json");
const PRODUCTS_FILE = path.join(STORAGE_DIR, "products.json");

for (const dir of [STORAGE_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([
    { id: "tee-basic", name: "Classic Round-Neck T-Shirt", price: 8000, description: "Everyday cotton round-neck T-shirt.", image: "", active: true },
    { id: "tee-premium", name: "Premium Round-Neck T-Shirt", price: 11000, description: "Premium feel with a clean finish.", image: "", active: true },
    { id: "tee-custom", name: "Custom Printed T-Shirt", price: 14000, description: "Add your own artwork or request a design.", image: "", active: true }
  ], null, 2));
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}
function isAdmin(req) {
  const token = req.cookies.xjr_admin;
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.admin === true && data.exp > Date.now();
  } catch { return false; }
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Please sign in as admin." });
  next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new Error("Only JPG, PNG and WEBP images are accepted."));
    cb(null, true);
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, store: "XJR PRINTING" }));
app.get("/api/config", (_req, res) => res.json({ whatsapp: process.env.WHATSAPP_NUMBER || "2347015119367" }));
app.get("/api/products", (_req, res) => res.json(readJson(PRODUCTS_FILE).filter(p => p.active)));
app.post("/api/upload", upload.single("artwork"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an image first." });
  res.json({ url: `/uploads/${req.file.filename}`, originalName: req.file.originalname });
});

app.post("/api/orders", (req, res) => {
  const { customer, phone, address, items, note, artworkUrl } = req.body || {};
  if (!customer || !phone || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Enter your name, phone number and at least one item." });
  }
  const products = readJson(PRODUCTS_FILE);
  let total = 0;
  const safeItems = [];
  for (const item of items) {
    const product = products.find(p => p.id === item.id && p.active);
    const qty = Math.max(1, Math.min(50, Number(item.quantity) || 1));
    if (!product) return res.status(400).json({ error: "One of the selected products is unavailable." });
    total += product.price * qty;
    safeItems.push({ id: product.id, name: product.name, price: product.price, quantity: qty });
  }
  const orders = readJson(ORDERS_FILE);
  const order = {
    id: "XJR-" + Date.now().toString().slice(-8),
    customer: String(customer).slice(0, 100),
    phone: String(phone).slice(0, 40),
    address: String(address || "").slice(0, 500),
    items: safeItems,
    total,
    note: String(note || "").slice(0, 1000),
    artworkUrl: String(artworkUrl || "").slice(0, 300),
    status: "Pending confirmation",
    createdAt: new Date().toISOString()
  };
  orders.unshift(order);
  writeJson(ORDERS_FILE, orders);
  res.status(201).json({ message: "Order received. XJR PRINTING will contact you to confirm it.", order });
});

app.post("/api/admin/login", (req, res) => {
  const password = String((req.body || {}).password || "");
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Incorrect admin password." });
  const payload = Buffer.from(JSON.stringify({ admin: true, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  res.cookie("xjr_admin", `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});
app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie("xjr_admin");
  res.json({ ok: true });
});
app.get("/api/admin/orders", requireAdmin, (_req, res) => res.json(readJson(ORDERS_FILE)));
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const allowed = ["Pending confirmation", "Confirmed", "In production", "Ready for delivery", "Delivered", "Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid order status." });
  const orders = readJson(ORDERS_FILE);
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  order.status = req.body.status;
  writeJson(ORDERS_FILE, orders);
  res.json(order);
});
app.get("/api/admin/products", requireAdmin, (_req, res) => res.json(readJson(PRODUCTS_FILE)));
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { name, price, description } = req.body || {};
  if (!name || !Number.isFinite(Number(price)) || Number(price) < 1) return res.status(400).json({ error: "Enter a product name and valid price." });
  const products = readJson(PRODUCTS_FILE);
  const product = { id: "p-" + crypto.randomBytes(5).toString("hex"), name: String(name).slice(0, 100), price: Number(price), description: String(description || "").slice(0, 300), image: "", active: true };
  products.push(product); writeJson(PRODUCTS_FILE, products);
  res.status(201).json(product);
});

app.use((err, _req, res, _next) => {
  const message = err.message || "Something went wrong.";
  res.status(400).json({ error: message });
});
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`XJR PRINTING store running on port ${PORT}`));
