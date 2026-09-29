const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");

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
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ACCOUNTING_FILE = path.join(DATA_DIR, "accounting.json");
const BACKUP_DIR = path.join(ROOT_DIR, "backups");

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
    instagramName: "@hosejbye",
    boothAddress: "Ny Munkegade 76 i Aarhus",
    openingHours: "Man-Fre 10:00-17:00"
  };
}

function defaultProducts() {
  return [
    { id: "b3", type: "jewelry", category: "keyring", categoryLabel: "Nøglering", name: "Håndlavet Samling 1", images: ["assets/Design uden navn.png"], price: 50, length: "8 cm", description: "Unik håndlavet nøglering.", stock: 1 },
    { id: "b3b", type: "jewelry", category: "keyring", categoryLabel: "Nøglering", name: "Perle nøglering - Beige mix", images: ["assets/Design uden navn (4).png"], price: 65, length: "7 cm", description: "Smuk håndlavet nøglering med beige og neutrale perler.", stock: 1 },
    { id: "b3c", type: "jewelry", category: "keyring", categoryLabel: "Nøglering", name: "Perle nøglering - Grønne nuancer", images: ["assets/Design uden navn (6).png"], price: 75, length: "8 cm", description: "Elegant nøglering med grønne og varme jordfarver.", stock: 1 },
    { id: "b4", type: "jewelry", category: "bracelet", categoryLabel: "Armbånd", name: "Grønt armbånd med skiftevis 8 mm og små perler", images: ["assets/Design uden navn (1).png"], price: 100, length: "18,0 cm", description: "Personligt designet armbånd med varme jordfarver og fine perledetaljer.", stock: 1 },
    { id: "b5", type: "jewelry", category: "bracelet", categoryLabel: "Armbånd", name: "Håndlavet Samling 3", images: ["assets/Design uden navn (2).png"], price: 100, length: "18,2 cm", description: "Smykt armbånd med blanding af neutrale og varme toner. Perfekt til hverdagen.", stock: 1 },
    { id: "b6", type: "jewelry", category: "necklace", categoryLabel: "Halskæde", name: "10 mm perlehalskæde i lyse nuancer", images: ["assets/Design uden navn (3).png"], price: 200, length: "17,8 cm", description: "Justerbar halskæde med lyse perler i forskellige nuancer.", stock: 1 },
    { id: "b7", type: "jewelry", category: "necklace", categoryLabel: "Halskæde", name: "Mixet perlehalskæde", images: ["assets/Design uden navn (5).png"], price: 225, length: "40,0 cm", description: "Smuk håndlavet halskæde med delikate perler og justerbar lås.", stock: 1 },
    { id: "b9", type: "jewelry", category: "necklace", categoryLabel: "Halskæde", name: "8 mm perlehalskæde i brunlige nuancer", images: ["assets/Design uden navn (11).png"], price: 150, length: "40 cm", description: "Halskæde med perler i størrelse 8 mm i forskellige brunlige nuancer og med justerbar lås.", stock: 1 },
    { id: "b10", type: "jewelry", category: "necklace", categoryLabel: "Halskæde", name: "10 mm perlehalskæde i lysegrønne nuancer", images: ["assets/Design uden navn (12).png"], price: 180, length: "18,0 cm", description: "Flot håndlavet halskæde med lysegrønne 10 mm perler.", stock: 1 },
    { id: "b11", type: "jewelry", category: "necklace", categoryLabel: "Halskæde", name: "10 mm perlehalskæde i lyserød/pink nuancer", images: ["assets/Design uden navn (13).png"], price: 180, length: "18,5 cm", description: "Elegant halskæde med 10 mm perler i lyserød/pinke nuancer.", stock: 1 },
    { id: "ceramic-cup", type: "ceramic", category: "cup", categoryLabel: "Kopper", name: "Espressokop - Lerhvid", images: ["assets/Design uden navn (9).png", "assets/Design uden navn (10).png"], price: 229, length: "Keramik", description: "Volumen 180 ml. Mat finish med prikker. Egnet til mad. Kan komme i opvaskemaskinen.", stock: 3 },
    { id: "ceramic-bowl", type: "ceramic", category: "bowl", categoryLabel: "Skåle", name: "Skål - Havgrøn glasur", images: ["assets/Design uden navn (8).png"], price: 279, length: "Keramik", description: "Diameter 14 cm. Velegnet til snack og morgenmad. Egnet til mad. Kan komme i opvaskemaskinen.", stock: 3 },
    { id: "ceramic-matcha-bowl", type: "ceramic", category: "matcha", categoryLabel: "Matcha skåle", name: "Matcha skål", images: ["assets/Matcha.jpeg", "assets/Matcha1.jpeg", "assets/Matcha2.jpeg", "assets/Matcha3.jpeg"], price: 299, length: "Keramik", description: "Smuk matcha-skål i håndlavet keramik med minimalistisk form og varm grøn farve.", stock: 2 },
    { id: "ceramic-vase", type: "ceramic", category: "vase", categoryLabel: "Vaser", name: "Vase - Sandtone", images: ["assets/Design uden navn (12).png", "assets/Design uden navn (13).png"], price: 349, length: "Keramik", description: "Højde 22 cm. God til tørrede blomster. Egnet til mad. Kan komme i opvaskemaskinen.", stock: 3 }
  ];
}

function normalizeProduct(raw, existing) {
  const defaults = existing || {};
  const source = raw && typeof raw === "object" ? raw : {};

  const toText = (value, fallback) => String(value ?? fallback ?? "").trim().slice(0, 500);
  const toPositiveNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  const normalizeCategory = (value, fallback) => {
    const text = toText(value, fallback || "other").toLowerCase();
    if (text === "earring") return "earrings";
    if (text === "earrings") return "earrings";
    return text.slice(0, 40);
  };

  const images = Array.isArray(source.images)
    ? source.images.map((img) => String(img).trim()).filter(Boolean).slice(0, 8)
    : defaults.images || [];

  return {
    id: defaults.id || String(source.id || "").trim() || crypto.randomUUID(),
    type: source.type === "ceramic" ? "ceramic" : source.type === "jewelry" ? "jewelry" : defaults.type || "jewelry",
    category: normalizeCategory(source.category, defaults.category || "other"),
    categoryLabel: toText(source.categoryLabel, defaults.categoryLabel || ""),
    name: toText(source.name, defaults.name || "Nyt produkt"),
    images: images.length ? images : ["assets/Design uden navn.png"],
    price: toPositiveNumber(source.price, defaults.price ?? 0),
    length: toText(source.length, defaults.length || ""),
    description: toText(source.description, defaults.description || ""),
    stock: Math.round(toPositiveNumber(source.stock, defaults.stock ?? 0))
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
    instagramName: toText(source.instagramName, defaults.instagramName),
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

  if (!fs.existsSync(PRODUCTS_FILE)) {
    writeJson(PRODUCTS_FILE, defaultProducts());
  }

  if (!fs.existsSync(ACCOUNTING_FILE)) {
    writeJson(ACCOUNTING_FILE, {
      importedAt: null,
      fileName: null,
      watchedFilePath: null,
      monthly: [],
      categories: [],
      groups: [],
      rowCount: 0,
      skippedCount: 0,
      sheetsProcessed: 0,
      unmatchedSheets: []
    });
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

function parseRequestBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
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

function runDataBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return;
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const destination = path.join(BACKUP_DIR, `data-backup-${stamp}`);
    fs.mkdirSync(destination, { recursive: true });

    for (const fileName of fs.readdirSync(DATA_DIR)) {
      const from = path.join(DATA_DIR, fileName);
      if (fs.statSync(from).isFile()) {
        fs.copyFileSync(from, path.join(destination, fileName));
      }
    }

    console.log("Automatisk backup oprettet:", destination);
  } catch (error) {
    console.error("Automatisk backup fejlede:", error.message);
  }
}

function shouldRunStartupBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return true;
    }

    const entries = fs.readdirSync(BACKUP_DIR).filter((name) => name.startsWith("data-backup-"));
    if (!entries.length) {
      return true;
    }

    const latest = entries.sort().at(-1);
    const stat = fs.statSync(path.join(BACKUP_DIR, latest));
    return Date.now() - stat.mtimeMs > 1000 * 60 * 60 * 20;
  } catch {
    return true;
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
  let decodedPath = urlPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const safePath = path.normalize(decodedPath).replace(/^([\\/])+/, "");
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
  if (ext === ".xml") return "application/xml; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
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

function orderItemCount(order) {
  if (!Array.isArray(order?.items)) {
    return 0;
  }

  return order.items.reduce((sum, item) => sum + Math.max(0, toNumber(item?.count)), 0);
}

function isDateBetween(value, from, to) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= from && date <= to;
}

function buildDailyRevenueSeries(soldOrders, days) {
  const now = new Date();
  const series = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 23, 59, 59, 999);
    const dayOrders = soldOrders.filter((order) => isDateBetween(order.createdAt, dayStart, dayEnd));
    series.push({
      label: dayStart.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit" }),
      revenue: dayOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0),
      orders: dayOrders.length
    });
  }

  return series;
}

function buildMonthlyRevenueSeries(soldOrders, months) {
  const now = new Date();
  const series = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
    const monthOrders = soldOrders.filter((order) => isDateBetween(order.createdAt, monthStart, monthEnd));
    const revenue = monthOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0);

    if (revenue === 0 && monthOrders.length === 0 && offset !== 0) {
      continue;
    }

    series.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      label: monthStart.toLocaleDateString("da-DK", { month: "short", year: "2-digit" }),
      revenue,
      orders: monthOrders.length
    });
  }

  return series;
}

const DANISH_MONTHS = {
  jan: 1, januar: 1,
  feb: 2, februar: 2,
  mar: 3, marts: 3,
  apr: 4, april: 4,
  maj: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

function parseMonthFromSheetName(sheetName, fallbackYear) {
  const normalized = String(sheetName || "").trim().toLowerCase();
  const yearMatch = normalized.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : fallbackYear;

  const wordMatch = normalized.match(/[a-zæøå]+/);
  if (!wordMatch) {
    return null;
  }

  const monthKey = Object.keys(DANISH_MONTHS).find((key) => wordMatch[0].startsWith(key));
  if (!monthKey) {
    return null;
  }

  return `${year}-${String(DANISH_MONTHS[monthKey]).padStart(2, "0")}`;
}

function toNumberSafe(value) {
  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object" && typeof value.result === "number") {
    return value.result;
  }

  const parsed = Number(String(value ?? "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDayNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const text = String(value).trim().replace(/\.$/, "");
  const num = Number(text);
  if (!Number.isInteger(num) || num < 1 || num > 31) {
    return null;
  }
  return num;
}

function monthKeyToLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("da-DK", { month: "short", year: "numeric" });
}

// Sheet layout: one worksheet per month (sheet name = Danish month name),
// one row per day-of-month, and one column per product category (Dato/Antal excluded, Udgifter treated as expense).
function buildColumnGroupMap(worksheet, groupRowNumber) {
  const map = new Map();
  if (groupRowNumber < 1) {
    return map;
  }

  let currentLabel = null;
  const maxCol = Math.max(worksheet.columnCount || 0, worksheet.getRow(groupRowNumber).cellCount || 0, 50);
  const row = worksheet.getRow(groupRowNumber);

  for (let col = 1; col <= maxCol; col += 1) {
    const text = String(row.getCell(col).value ?? "").trim();
    if (text) {
      currentLabel = text;
    }
    if (currentLabel) {
      map.set(col, currentLabel);
    }
  }

  return map;
}

async function parseAccountingWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets.length) {
    throw new Error("Filen indeholder ingen ark");
  }

  const currentYear = new Date().getFullYear();
  const monthTotals = new Map();
  const categoryTotals = new Map();
  const monthCategoryTotals = new Map();
  const groupTotals = new Map();
  const monthGroupTotals = new Map();
  const dailyTotals = new Map();
  const unmatchedSheets = [];
  let rowCount = 0;
  let skippedCount = 0;
  let sheetsProcessed = 0;

  workbook.worksheets.forEach((worksheet) => {
    const monthKey = parseMonthFromSheetName(worksheet.name, currentYear);
    if (!monthKey) {
      unmatchedSheets.push(worksheet.name);
      return;
    }

    let headerRowNumber = -1;
    let dateCol = -1;

    for (let rowNumber = 1; rowNumber <= Math.min(5, worksheet.rowCount); rowNumber += 1) {
      let foundDateCol = -1;
      worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = String(cell.value ?? "").trim().toLowerCase();
        if (foundDateCol === -1 && /dato/.test(text)) {
          foundDateCol = colNumber;
        }
      });

      if (foundDateCol !== -1) {
        headerRowNumber = rowNumber;
        dateCol = foundDateCol;
        break;
      }
    }

    if (headerRowNumber === -1) {
      unmatchedSheets.push(`${worksheet.name} (ingen dato-kolonne fundet)`);
      return;
    }

    const revenueCols = [];
    const expenseCols = [];

    const groupMap = buildColumnGroupMap(worksheet, headerRowNumber - 1);

    worksheet.getRow(headerRowNumber).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber === dateCol) return;
      const rawLabel = String(cell.value ?? "").trim();
      const text = rawLabel.toLowerCase();
      if (!text || /antal/.test(text)) return;

      if (/udgift|omkostning|expense|cost/.test(text)) {
        expenseCols.push({ col: colNumber, group: groupMap.get(colNumber) || "Andet" });
      } else {
        revenueCols.push({ col: colNumber, label: rawLabel, group: groupMap.get(colNumber) || "Andet" });
      }
    });

    if (!revenueCols.length && !expenseCols.length) {
      unmatchedSheets.push(`${worksheet.name} (ingen kategori-kolonner fundet)`);
      return;
    }

    sheetsProcessed += 1;
    if (!monthTotals.has(monthKey)) {
      monthTotals.set(monthKey, { revenue: 0, expense: 0 });
    }
    const totals = monthTotals.get(monthKey);

    if (!monthCategoryTotals.has(monthKey)) {
      monthCategoryTotals.set(monthKey, new Map());
    }
    const categoryTotalsForMonth = monthCategoryTotals.get(monthKey);

    if (!monthGroupTotals.has(monthKey)) {
      monthGroupTotals.set(monthKey, new Map());
    }
    const groupTotalsForMonth = monthGroupTotals.get(monthKey);

    const addToGroup = (groupMapRef, group, field, value) => {
      if (!groupMapRef.has(group)) {
        groupMapRef.set(group, { revenue: 0, expense: 0 });
      }
      groupMapRef.get(group)[field] += value;
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;

      const day = parseDayNumber(row.getCell(dateCol).value);
      if (day === null) {
        skippedCount += 1;
        return;
      }

      const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
      if (!dailyTotals.has(dateKey)) {
        dailyTotals.set(dateKey, { dateKey, label: dateKey, revenue: 0, orders: 0 });
      }

      rowCount += 1;
      revenueCols.forEach(({ col, label, group }) => {
        const value = toNumberSafe(row.getCell(col).value);
        totals.revenue += value;
        dailyTotals.get(dateKey).revenue += value;
        if (value) {
          const key = `${group}::${label}`.toLowerCase();
          if (!categoryTotals.has(key)) {
            categoryTotals.set(key, { label, group, revenue: 0 });
          }
          categoryTotals.get(key).revenue += value;

          if (!categoryTotalsForMonth.has(key)) {
            categoryTotalsForMonth.set(key, { label, group, revenue: 0 });
          }
          categoryTotalsForMonth.get(key).revenue += value;

          addToGroup(groupTotals, group, "revenue", value);
          addToGroup(groupTotalsForMonth, group, "revenue", value);
        }
      });
      expenseCols.forEach(({ col, group }) => {
        const value = Math.abs(toNumberSafe(row.getCell(col).value));
        totals.expense += value;
        if (value) {
          addToGroup(groupTotals, group, "expense", value);
          addToGroup(groupTotalsForMonth, group, "expense", value);
        }
      });

      if (revenueCols.some(({ col }) => toNumberSafe(row.getCell(col).value) > 0)) {
        dailyTotals.get(dateKey).orders += 1;
      }
    });
  });

  const daily = [...dailyTotals.entries()]
    .map(([dateKey, entry]) => {
      const [year, month, day] = dateKey.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return {
        label: date.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit" }),
        dateKey,
        revenue: Math.round((entry.revenue || 0) * 100) / 100,
        orders: entry.orders || 0
      };
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-7);

  const monthly = [...monthTotals.entries()]
    .filter(([, totals]) => totals.revenue > 0 || totals.expense > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => {
      const categoriesForMonth = [...(monthCategoryTotals.get(month)?.values() || [])]
        .sort((a, b) => b.revenue - a.revenue)
        .map((entry) => ({
          category: entry.label,
          group: entry.group,
          revenue: Math.round(entry.revenue * 100) / 100
        }));

      const groupsForMonth = [...(monthGroupTotals.get(month)?.entries() || [])].map(([group, groupTotal]) => ({
        group,
        revenue: Math.round(groupTotal.revenue * 100) / 100,
        expense: Math.round(groupTotal.expense * 100) / 100
      }));

      return {
        month,
        label: monthKeyToLabel(month),
        revenue: Math.round(totals.revenue * 100) / 100,
        expense: Math.round(totals.expense * 100) / 100,
        categories: categoriesForMonth,
        groups: groupsForMonth
      };
    });

  const categories = [...categoryTotals.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map((entry) => ({
      category: entry.label,
      group: entry.group,
      revenue: Math.round(entry.revenue * 100) / 100
    }));

  const groups = [...groupTotals.entries()].map(([group, groupTotal]) => ({
    group,
    revenue: Math.round(groupTotal.revenue * 100) / 100,
    expense: Math.round(groupTotal.expense * 100) / 100
  }));

  if (!monthly.length) {
    throw new Error("Kunne ikke genkende måneder/data i nogen af arkets faneblade");
  }

  return { daily, monthly, categories, groups, rowCount, skippedCount, sheetsProcessed, unmatchedSheets };
}

let accountingWatcher = null;
let accountingDebounceTimer = null;

function stopAccountingWatcher() {
  if (accountingWatcher) {
    accountingWatcher.close();
    accountingWatcher = null;
  }
  clearTimeout(accountingDebounceTimer);
}

async function reimportFromWatchedFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const result = await parseAccountingWorkbook(buffer);

  writeJson(ACCOUNTING_FILE, {
    importedAt: new Date().toISOString(),
    fileName: path.basename(filePath),
    watchedFilePath: filePath,
    daily: result.daily,
    monthly: result.monthly,
    categories: result.categories,
    groups: result.groups,
    rowCount: result.rowCount,
    skippedCount: result.skippedCount,
    sheetsProcessed: result.sheetsProcessed,
    unmatchedSheets: result.unmatchedSheets
  });
  console.log("Regnskab auto-genindlæst fra", filePath);
}

function startAccountingWatcher(filePath) {
  stopAccountingWatcher();
  accountingWatcher = fs.watch(filePath, { persistent: false }, () => {
    clearTimeout(accountingDebounceTimer);
    accountingDebounceTimer = setTimeout(() => {
      reimportFromWatchedFile(filePath).catch((error) => {
        console.error("Automatisk regnskabsopdatering fejlede:", error.message);
      });
    }, 1500);
  });
  accountingWatcher.on("error", (error) => {
    console.error("Regnskabs-fil-overvågning fejlede:", error.message);
  });
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
  const weekOrders = soldOrders.filter((order) => isDateBetween(order.createdAt, startOfWeek, now));
  const monthOrders = soldOrders.filter((order) => isDateBetween(order.createdAt, startOfMonth, now));

  const weekRevenue = weekOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0);
  const monthRevenue = monthOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0);
  const yearRevenue = soldOrders
    .filter((order) => isDateBetween(order.createdAt, startOfYear, now))
    .reduce((sum, order) => sum + orderRevenueDkk(order), 0);

  const sentOrders = allOrders.filter((order) => order.status === "Sendt");
  const finishedOrders = allOrders.filter((order) => order.status === "Færdig" || order.status === "Faerdig");
  const soldTotalRevenue = soldOrders.reduce((sum, order) => sum + orderRevenueDkk(order), 0);
  const soldAverageRevenue = soldOrders.length > 0 ? soldTotalRevenue / soldOrders.length : 0;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ordersToday = allOrders.filter((order) => isDateBetween(order.createdAt, startOfToday, now));

  const accounting = readJson(ACCOUNTING_FILE);
  const accountingMonthly = Array.isArray(accounting.monthly) ? accounting.monthly : [];
  const accountingDaily = Array.isArray(accounting.daily) ? accounting.daily : [];

  const buildAccountingSeries = (series, limit) => {
    const entries = (series || [])
      .map((entry) => ({
        label: String(entry.label || entry.month || ""),
        month: String(entry.month || ""),
        revenue: Number(entry.revenue) || 0,
        orders: Number(entry.orders) || 0
      }))
      .filter((entry) => entry.label || entry.month)
      .slice(-limit);

    if (entries.length) {
      return entries;
    }

    return [];
  };

  const buildAccountingDailySeriesForCurrentWeek = (series, days) => {
    const entries = Array.isArray(series) ? series : [];
    const map = new Map(
      entries
        .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry.dateKey || entry.label || "")))
        .map((entry) => [String(entry.dateKey || entry.label || ""), entry])
    );

    const today = new Date();
    const result = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const match = map.get(dateKey) || { revenue: 0, orders: 0 };
      result.push({
        label: date.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit" }),
        month: "",
        revenue: Number(match.revenue) || 0,
        orders: Number(match.orders) || 0
      });
    }

    return result;
  };

  const appDailySeries = buildDailyRevenueSeries(soldOrders, 7);
  const appMonthlySeries = buildMonthlyRevenueSeries(soldOrders, 6);
  const excelDailySeries = buildAccountingDailySeriesForCurrentWeek(accountingDaily, 7);
  const excelMonthlySeries = buildAccountingSeries(accountingMonthly, 6);

  const mergedMonthlySeries = excelMonthlySeries.length ? excelMonthlySeries : appMonthlySeries;
  const mergedDailySeries = excelDailySeries.length ? excelDailySeries : appDailySeries;

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
      today: ordersToday.length,
      weekOrders: weekOrders.length,
      monthOrders: monthOrders.length,
      sentItems: sentOrders.reduce((sum, order) => sum + orderItemCount(order), 0),
      finishedItems: finishedOrders.reduce((sum, order) => sum + orderItemCount(order), 0),
      soldItems: soldOrders.reduce((sum, order) => sum + orderItemCount(order), 0),
      weekItems: weekOrders.reduce((sum, order) => sum + orderItemCount(order), 0),
      monthItems: monthOrders.reduce((sum, order) => sum + orderItemCount(order), 0)
    },
    series: {
      daily: mergedDailySeries,
      monthly: mergedMonthlySeries,
      dailyApp: appDailySeries,
      dailyExcel: excelDailySeries,
      monthlyApp: appMonthlySeries,
      monthlyExcel: excelMonthlySeries
    }
  };
}

async function handleApi(req, res, pathname, searchParams) {
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

    const products = readJson(PRODUCTS_FILE);
    const requestedPerProduct = new Map();

    for (const item of items) {
      const productId = String(item.id || "").trim();
      if (!productId) continue;
      const product = products.find((entry) => entry.id === productId);
      if (!product) continue;

      const count = Number(item.count ?? item.quantity ?? 1);
      const currentTotal = requestedPerProduct.get(productId) || 0;
      requestedPerProduct.set(productId, currentTotal + count);
    }

    for (const [productId, count] of requestedPerProduct.entries()) {
      const product = products.find((entry) => entry.id === productId);
      if (!product) continue;
      const stockLimit = Number(product.stock) || 0;
      if (count > stockLimit) {
        sendJson(res, 409, {
          error: `Du kan ikke bestille ${count} af ${product.name}. Der er kun ${stockLimit} på lager.`
        });
        return true;
      }
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

    for (const [productId, count] of requestedPerProduct.entries()) {
      const product = products.find((entry) => entry.id === productId);
      if (!product) continue;
      product.stock = Math.max(0, Number(product.stock || 0) - count);
    }
    writeJson(PRODUCTS_FILE, products);

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

  if (req.method === "GET" && pathname === "/api/products") {
    const products = readJson(PRODUCTS_FILE);
    const type = searchParams.get("type");
    const filtered = type ? products.filter((item) => item.type === type) : products;
    sendJson(res, 200, { products: filtered });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/admin/products") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    sendJson(res, 200, { products: readJson(PRODUCTS_FILE) });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/products") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const body = await parseRequestBody(req);
    const product = normalizeProduct(body);
    const products = readJson(PRODUCTS_FILE);
    products.push(product);
    writeJson(PRODUCTS_FILE, products);

    sendJson(res, 201, { ok: true, product });
    return true;
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/products/")) {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const productId = pathname.split("/")[4];
    const body = await parseRequestBody(req);
    const products = readJson(PRODUCTS_FILE);
    const index = products.findIndex((item) => item.id === productId);
    if (index < 0) {
      sendJson(res, 404, { error: "Produkt ikke fundet" });
      return true;
    }

    const updated = normalizeProduct(body, products[index]);
    products[index] = updated;
    writeJson(PRODUCTS_FILE, products);

    sendJson(res, 200, { ok: true, product: updated });
    return true;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/products/")) {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const productId = pathname.split("/")[4];
    const products = readJson(PRODUCTS_FILE);
    const index = products.findIndex((item) => item.id === productId);
    if (index < 0) {
      sendJson(res, 404, { error: "Produkt ikke fundet" });
      return true;
    }

    products.splice(index, 1);
    writeJson(PRODUCTS_FILE, products);

    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/orders/lookup") {
    const orderId = String(searchParams.get("orderId") || "").trim();
    const contact = String(searchParams.get("contact") || "").trim();

    if (!orderId || contact.length < 3) {
      sendJson(res, 400, { error: "Angiv ordre-id og kontaktoplysning (min. 3 tegn)" });
      return true;
    }

    const activeOrders = readJson(ORDERS_FILE);
    const archivedOrders = readJson(ARCHIVED_ORDERS_FILE);
    const order = [...activeOrders, ...archivedOrders].find((item) => {
      return item.id === orderId && String(item.customer?.contact || "").toLowerCase().includes(contact.toLowerCase());
    });

    if (!order) {
      sendJson(res, 404, { error: "Ingen ordre fundet med de oplysninger" });
      return true;
    }

    sendJson(res, 200, {
      order: {
        id: order.id,
        createdAt: order.createdAt,
        status: order.status === "Faerdig" ? "Færdig" : order.status,
        items: (order.items || []).map((item) => ({
          type: item.type,
          count: item.count,
          priceDkk: item.priceDkk
        }))
      }
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/admin/accounting") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    sendJson(res, 200, { accounting: readJson(ACCOUNTING_FILE) });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/accounting/import") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    let body;
    try {
      body = await parseRequestBody(req, 10 * 1024 * 1024);
    } catch {
      sendJson(res, 413, { error: "Filen er for stor (maks 10 MB)" });
      return true;
    }

    const contentBase64 = String(body.contentBase64 || "");
    const fileName = String(body.fileName || "regnskab.xlsx").trim().slice(0, 200) || "regnskab.xlsx";

    if (!contentBase64) {
      sendJson(res, 400, { error: "Ingen fil modtaget" });
      return true;
    }

    try {
      const buffer = Buffer.from(contentBase64, "base64");
      const result = await parseAccountingWorkbook(buffer);
      const previous = readJson(ACCOUNTING_FILE);

      const accountingData = {
        importedAt: new Date().toISOString(),
        fileName,
        watchedFilePath: previous.watchedFilePath || null,
        daily: result.daily,
        monthly: result.monthly,
        categories: result.categories,
        groups: result.groups,
        rowCount: result.rowCount,
        skippedCount: result.skippedCount,
        sheetsProcessed: result.sheetsProcessed,
        unmatchedSheets: result.unmatchedSheets
      };

      writeJson(ACCOUNTING_FILE, accountingData);
      sendJson(res, 200, { ok: true, accounting: accountingData });
    } catch (error) {
      sendJson(res, 400, { error: `Kunne ikke læse regnearket: ${error.message}` });
    }
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/accounting/watch") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const body = await parseRequestBody(req);
    const filePath = String(body.filePath || "").trim();

    if (!filePath || !filePath.toLowerCase().endsWith(".xlsx")) {
      sendJson(res, 400, { error: "Angiv en gyldig sti til en .xlsx-fil" });
      return true;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      sendJson(res, 400, { error: "Filen blev ikke fundet på den sti (husk at appen skal kunne læse den lokalt)" });
      return true;
    }

    try {
      await reimportFromWatchedFile(filePath);
      startAccountingWatcher(filePath);
      sendJson(res, 200, { ok: true, accounting: readJson(ACCOUNTING_FILE) });
    } catch (error) {
      sendJson(res, 400, { error: `Kunne ikke læse filen: ${error.message}` });
    }
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/accounting/unwatch") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    stopAccountingWatcher();
    const current = readJson(ACCOUNTING_FILE);
    current.watchedFilePath = null;
    writeJson(ACCOUNTING_FILE, current);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/change-password") {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const body = await parseRequestBody(req);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (newPassword.length < 6) {
      sendJson(res, 400, { error: "Nyt password skal være mindst 6 tegn" });
      return true;
    }

    const users = readJson(USERS_FILE);
    const userIndex = users.findIndex((item) => item.id === session.userId);
    const user = userIndex >= 0 ? users[userIndex] : null;
    if (!user || !verifyPassword(currentPassword, user)) {
      sendJson(res, 401, { error: "Nuværende password er forkert" });
      return true;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    user.salt = salt;
    user.hash = hashPassword(newPassword, salt);
    users[userIndex] = user;
    writeJson(USERS_FILE, users);

    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/orders/") && !pathname.includes("/status") && !pathname.includes("/restore") && !pathname.endsWith("/archive-all")) {
    const session = requireAdmin(req, res);
    if (!session) {
      return true;
    }

    const parts = pathname.split("/");
    const orderId = parts[4];
    if (!orderId) {
      sendJson(res, 400, { error: "Ordre-id mangler" });
      return true;
    }

    const activeOrders = readJson(ORDERS_FILE);
    const activeIndex = activeOrders.findIndex((item) => item.id === orderId);
    if (activeIndex >= 0) {
      activeOrders.splice(activeIndex, 1);
      writeJson(ORDERS_FILE, activeOrders);
      sendJson(res, 200, { ok: true, deleted: true, source: "active" });
      return true;
    }

    const archivedOrders = readJson(ARCHIVED_ORDERS_FILE);
    const archivedIndex = archivedOrders.findIndex((item) => item.id === orderId);
    if (archivedIndex >= 0) {
      archivedOrders.splice(archivedIndex, 1);
      writeJson(ARCHIVED_ORDERS_FILE, archivedOrders);
      sendJson(res, 200, { ok: true, deleted: true, source: "archived" });
      return true;
    }

    sendJson(res, 404, { error: "Ordre ikke fundet" });
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

if (shouldRunStartupBackup()) {
  runDataBackup();
}
setInterval(runDataBackup, 1000 * 60 * 60 * 24).unref();

setInterval(cleanupExpiredTokens, 1000 * 60 * 10).unref();

const existingAccounting = readJson(ACCOUNTING_FILE);
if (existingAccounting.watchedFilePath && fs.existsSync(existingAccounting.watchedFilePath)) {
  startAccountingWatcher(existingAccounting.watchedFilePath);
  reimportFromWatchedFile(existingAccounting.watchedFilePath).catch((error) => {
    console.error("Kunne ikke genindlæse overvåget regnskabsfil ved opstart:", error.message);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = parsed.pathname;

    if (pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, pathname, parsed.searchParams);
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
