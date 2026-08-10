const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 8);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 6);
const LOGIN_BLOCK_MINUTES = Number(process.env.LOGIN_BLOCK_MINUTES || 15);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const ARCHIVED_ORDERS_FILE = path.join(DATA_DIR, "archived_orders.json");
const SITE_CONTENT_FILE = path.join(DATA_DIR, "site_content.json");

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_FROM || "";
const TWILIO_TO = process.env.TWILIO_TO || "";
let hasLoggedTwilioConfigWarning = false;

const activeTokens = new Map();
const loginAttemptsByIp = new Map();

function defaultSiteContent() {
  return {
    heroTitle: "HosEjbye",
    heroIntro1: "Personlige smykker og håndlavet keramik til private, gaver og virksomhedsbestillinger.",
    heroIntro2: "Vi laver små kollektioner, specialdesign og samarbejder med butikker.",
    aboutText1: "HosEjbye er et kreativt værksted med fokus på kvalitet, rolige farver og håndlavede detaljer.",
    aboutText2: "Vi tilbyder både enkeltkøb og mindre B2B-serier til butikker, events og firmagaver.",
    contactEmail: "kontakt@hosejbye.dk",
    contactPhone: "12 34 56 78",
    boothAddress: "Ny Munkegade 76 i Aarhus",
    openingHours: "Man-Fre 10:00-17:00"
  };
}

function normalizeSiteContent(raw) {
  const defaults = defaultSiteContent();
  const source = raw && typeof raw === "object" ? raw : {};

  const toText = (value, fallback) => {
    const text = String(value ?? fallback).trim();
    return text.slice(0, 400);
  };

  return {
    heroTitle: toText(source.heroTitle, defaults.heroTitle),
    heroIntro1: toText(source.heroIntro1, defaults.heroIntro1),
    heroIntro2: toText(source.heroIntro2, defaults.heroIntro2),
    aboutText1: toText(source.aboutText1, defaults.aboutText1),
    aboutText2: toText(source.aboutText2, defaults.aboutText2),
    contactEmail: toText(source.contactEmail, defaults.contactEmail),
    contactPhone: toText(source.contactPhone, defaults.contactPhone),
    boothAddress: toText(source.boothAddress, defaults.boothAddress),
    openingHours: toText(source.openingHours, defaults.openingHours)
  };
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), "utf8");
  }

  if (!fs.existsSync(ARCHIVED_ORDERS_FILE)) {
    fs.writeFileSync(ARCHIVED_ORDERS_FILE, JSON.stringify([], null, 2), "utf8");
  }

  if (!fs.existsSync(SITE_CONTENT_FILE)) {
    writeJson(SITE_CONTENT_FILE, defaultSiteContent());
  }

  if (!fs.existsSync(USERS_FILE)) {
    if (IS_PROD && !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_PASSWORD skal være sat i production ved første opstart.");
    }

    const username = "owner";
    const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(defaultPassword, salt);

    const users = [
      {
        id: crypto.randomUUID(),
        username,
        role: "admin",
        salt,
        hash
      }
    ];

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
    console.log("Admin bruger oprettet:");
    console.log("  Brugernavn:", username);
    console.log("  Password:", defaultPassword);
    console.log("Skift password via ADMIN_PASSWORD env ved første opstart.");
    if (!IS_PROD && defaultPassword === "admin123") {
      console.log("Advarsel: default admin password bruges lokalt. Skift det før produktion.");
    }
  }
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "0"
  };
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  const hash = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(text)
  });
  res.end(text);
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function isLoginBlocked(ip) {
  const entry = loginAttemptsByIp.get(ip);
  if (!entry) return false;
  if (entry.blockedUntil <= Date.now()) {
    loginAttemptsByIp.delete(ip);
    return false;
  }
  return true;
}

function registerFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttemptsByIp.get(ip) || { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.blockedUntil = now + LOGIN_BLOCK_MINUTES * 60 * 1000;
    entry.count = 0;
  }
  loginAttemptsByIp.set(ip, entry);
}

function clearFailedLogins(ip) {
  loginAttemptsByIp.delete(ip);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request too large"));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim();
}

function requireAdmin(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !activeTokens.has(token)) {
    sendJson(res, 401, { error: "Ikke logget ind" });
    return null;
  }

  const session = activeTokens.get(token);
  if (session.expiresAt < Date.now()) {
    activeTokens.delete(token);
    sendJson(res, 401, { error: "Session udløbet" });
    return null;
  }

  if (session.role !== "admin") {
    sendJson(res, 403, { error: "Ingen adgang" });
    return null;
  }

  return session;
}

function issueToken(user) {
  const token = crypto.randomBytes(32).toString("hex");
  activeTokens.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 1000 * 60 * 60 * SESSION_HOURS
  });
  return token;
}

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, session] of activeTokens.entries()) {
    if (session.expiresAt < now) {
      activeTokens.delete(token);
    }
  }

  for (const [ip, entry] of loginAttemptsByIp.entries()) {
    if (!entry.blockedUntil || entry.blockedUntil < now) {
      loginAttemptsByIp.delete(ip);
    }
  }
}

function canSendSms() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM && TWILIO_TO);
}

function buildOrderSms(order) {
  const customerName = order.customer?.name || "Ukendt";
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  return `Ny ordre hos HosEjbye. ID: ${order.id}. Kunde: ${customerName}. Antal designs: ${itemCount}.`;
}

async function sendOrderSmsNotification(order) {
  if (!canSendSms()) {
    if (!hasLoggedTwilioConfigWarning) {
      hasLoggedTwilioConfigWarning = true;
      console.log("SMS ikke aktiveret: sæt TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_TO.");
    }
    return;
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const form = new URLSearchParams({
    To: TWILIO_TO,
    From: TWILIO_FROM,
    Body: buildOrderSms(order)
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Twilio fejl (${response.status}): ${details}`);
  }
}

function sanitizePath(urlPath) {
  const safePath = path.normalize(urlPath).replace(/^([\\/])+/, "");
  const fullPath = path.join(PUBLIC_DIR, safePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    return null;
  }
  return fullPath;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = sanitizePath(relativePath);
  if (!fullPath) {
    sendText(res, 400, "Bad request");
    return;
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  const content = fs.readFileSync(fullPath);
  sendText(res, 200, content, mimeType(fullPath));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function itemRevenueDkk(item) {
  const count = toNumber(item?.count || 0);
  if (count <= 0) {
    return 0;
  }

  if (typeof item?.priceDkk === "number") {
    return item.priceDkk * count;
  }

  if (typeof item?.price === "number") {
    return item.price * count;
  }

  return 0;
}

function orderRevenueDkk(order) {
  if (!Array.isArray(order?.items)) {
    return 0;
  }

  return order.items.reduce((sum, item) => sum + itemRevenueDkk(item), 0);
}

function isDateBetween(value, from, to) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= from && date <= to;
}

function buildSalesStats(activeOrders, archivedOrders) {
  const allOrders = [...activeOrders, ...archivedOrders];
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const soldStatuses = new Set(["Sendt", "Færdig", "Faerdig"]);

  const soldOrders = allOrders.filter((order) => soldStatuses.has(order.status));

  const weekRevenue = soldOrders
    .filter((order) => isDateBetween(order.createdAt, startOfWeek, now))
    .reduce((sum, order) => sum + orderRevenueDkk(order), 0);

  const monthRevenue = soldOrders
    .filter((order) => isDateBetween(order.createdAt, startOfMonth, now))
    .reduce((sum, order) => sum + orderRevenueDkk(order), 0);

  const yearRevenue = soldOrders
    .filter((order) => isDateBetween(order.createdAt, startOfYear, now))
    .reduce((sum, order) => sum + orderRevenueDkk(order), 0);

  const sentOrders = allOrders.filter((order) => order.status === "Sendt");
  const finishedOrders = allOrders.filter((order) => order.status === "Færdig" || order.status === "Faerdig");
  const soldTotalRevenue = soldOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0);
  const soldAverageRevenue = soldOrders.length > 0 ? soldTotalRevenue / soldOrders.length : 0;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ordersToday = allOrders.filter((order) => isDateBetween(order.createdAt, startOfToday, now));

  return {
    totals: {
      activeOrders: activeOrders.length,
      archivedOrders: archivedOrders.length,
      allOrders: allOrders.length
    },
    revenue: {
      week: weekRevenue,
      month: monthRevenue,
      year: yearRevenue,
      sent: sentOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0),
      finished: finishedOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0),
      soldTotal: soldTotalRevenue,
      soldAverage: soldAverageRevenue
    },
    counts: {
      sent: sentOrders.length,
      finished: finishedOrders.length,
      sold: soldOrders.length,
      today: ordersToday.length
    }
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const ip = getClientIp(req);
    if (isLoginBlocked(ip)) {
      sendJson(res, 429, { error: "For mange loginforsøg. Prøv igen senere." });
      return true;
    }

    const body = await parseRequestBody(req);
    const { username, password } = body;

    if (!username || !password) {
      sendJson(res, 400, { error: "Udfyld brugernavn og password" });
      return true;
    }

    const users = readJson(USERS_FILE);
    const user = users.find((item) => item.username === username);
    if (!user || !verifyPassword(password, user)) {
      registerFailedLogin(ip);
      sendJson(res, 401, { error: "Forkerte loginoplysninger" });
      return true;
    }

    clearFailedLogins(ip);

    const token = issueToken(user);
    sendJson(res, 200, {
      token,
      user: {
        username: user.username,
        role: user.role
      }
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/orders") {
    const body = await parseRequestBody(req);
    const customer = body.customer || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customer.name || items.length === 0) {
      sendJson(res, 400, { error: "Ordren mangler kundeinfo eller varer" });
      return true;
    }

    const order = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: "Ny",
      customer: {
        name: String(customer.name).trim(),
        contact: String(customer.contact || "").trim()
      },
      items
    };

    const orders = readJson(ORDERS_FILE);
    orders.unshift(order);
    writeJson(ORDERS_FILE, orders);

    try {
      await sendOrderSmsNotification(order);
    } catch (error) {
      console.error("Kunne ikke sende SMS:", error.message);
    }

    sendJson(res, 201, { ok: true, orderId: order.id });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/admin/orders") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const orders = readJson(ORDERS_FILE);
    sendJson(res, 200, { orders });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/admin/orders/archived") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const archivedOrders = readJson(ARCHIVED_ORDERS_FILE);
    sendJson(res, 200, { orders: archivedOrders });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/admin/stats") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const activeOrders = readJson(ORDERS_FILE);
    const archivedOrders = readJson(ARCHIVED_ORDERS_FILE);
    const stats = buildSalesStats(activeOrders, archivedOrders);
    sendJson(res, 200, { stats });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/site-content") {
    const content = normalizeSiteContent(readJson(SITE_CONTENT_FILE));
    sendJson(res, 200, { content });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/admin/site-content") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const content = normalizeSiteContent(readJson(SITE_CONTENT_FILE));
    sendJson(res, 200, { content });
    return true;
  }

  if (req.method === "PUT" && pathname === "/api/admin/site-content") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const body = await parseRequestBody(req);
    const content = normalizeSiteContent(body);
    writeJson(SITE_CONTENT_FILE, content);
    sendJson(res, 200, { ok: true, content });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/orders/archive-all") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const activeOrders = readJson(ORDERS_FILE);
    if (!activeOrders.length) {
      sendJson(res, 200, { ok: true, moved: 0 });
      return true;
    }

    const archivedOrders = readJson(ARCHIVED_ORDERS_FILE);
    const archivedAt = new Date().toISOString();
    const movedOrders = activeOrders.map((order) => ({
      ...order,
      archivedAt,
      archivedBy: session.username
    }));

    writeJson(ARCHIVED_ORDERS_FILE, [...movedOrders, ...archivedOrders]);
    writeJson(ORDERS_FILE, []);

    sendJson(res, 200, { ok: true, moved: movedOrders.length });
    return true;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/admin/orders/") && pathname.endsWith("/status")) {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const parts = pathname.split("/");
    const orderId = parts[4];
    const body = await parseRequestBody(req);
    const rawStatus = String(body.status || "").trim();
    const statusMap = new Map([
      ["Ny", "Ny"],
      ["I gang", "I gang"],
      ["Sendt", "Sendt"],
      ["Faerdig", "Færdig"],
      ["Færdig", "Færdig"]
    ]);

    const newStatus = statusMap.get(rawStatus);
    if (!newStatus) {
      sendJson(res, 400, { error: "Ugyldig status" });
      return true;
    }

    const orders = readJson(ORDERS_FILE);
    const orderIndex = orders.findIndex((item) => item.id === orderId);
    const order = orderIndex >= 0 ? orders[orderIndex] : null;
    if (!order) {
      sendJson(res, 404, { error: "Ordre ikke fundet" });
      return true;
    }

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    // Auto-archive completed orders so active list stays focused on work in progress.
    if (newStatus === "Færdig") {
      const archivedOrders = readJson(ARCHIVED_ORDERS_FILE);
      const [finishedOrder] = orders.splice(orderIndex, 1);
      finishedOrder.archivedAt = new Date().toISOString();
      finishedOrder.archivedBy = session.username;

      writeJson(ARCHIVED_ORDERS_FILE, [finishedOrder, ...archivedOrders]);
      writeJson(ORDERS_FILE, orders);
      sendJson(res, 200, { ok: true, archived: true });
      return true;
    }

    writeJson(ORDERS_FILE, orders);
    sendJson(res, 200, { ok: true, archived: false });
    return true;
  }

  if (req.method === "POST" && pathname.startsWith("/api/admin/orders/") && pathname.endsWith("/restore")) {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const parts = pathname.split("/");
    const orderId = parts[4];
    const archivedOrders = readJson(ARCHIVED_ORDERS_FILE);
    const archivedIndex = archivedOrders.findIndex((item) => item.id === orderId);
    if (archivedIndex < 0) {
      sendJson(res, 404, { error: "Arkiveret ordre ikke fundet" });
      return true;
    }

    const [restoredOrder] = archivedOrders.splice(archivedIndex, 1);
    restoredOrder.status = "I gang";
    restoredOrder.updatedAt = new Date().toISOString();
    restoredOrder.restoredAt = new Date().toISOString();
    restoredOrder.restoredBy = session.username;

    delete restoredOrder.archivedAt;
    delete restoredOrder.archivedBy;

    const activeOrders = readJson(ORDERS_FILE);
    writeJson(ORDERS_FILE, [restoredOrder, ...activeOrders]);
    writeJson(ARCHIVED_ORDERS_FILE, archivedOrders);

    sendJson(res, 200, { ok: true, restored: true });
    return true;
  }

  return false;
}

ensureDataFiles();

setInterval(cleanupExpiredTokens, 1000 * 60 * 10).unref();

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = parsed.pathname;

    if (pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, pathname);
      if (!handled) {
        sendJson(res, 404, { error: "Endpoint ikke fundet" });
      }
      return;
    }

    if (req.method !== "GET") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: "Serverfejl", details: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}`);
});
