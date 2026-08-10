const productType = document.getElementById("productType");
const targetLength = document.getElementById("targetLength");
const beadSize = document.getElementById("beadSize");
const statsBox = document.getElementById("statsBox");
const palette = document.getElementById("palette");
const preview = document.getElementById("preview");
const orderSummary = document.getElementById("orderSummary");
const orderBtn = document.getElementById("orderBtn");
const orderMessage = document.getElementById("orderMessage");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");

const CART_KEY = "hosejbye_shop_cart";

const designPrices = {
  bracelet: 349,
  necklace: 529,
  keyring: 199
};

const lengthTargets = {
  bracelet: { label: "Armbånd", mm: 180 },
  necklace: { label: "Halskæde", mm: 400 },
  keyring: { label: "Nøglering", mm: 100 }
};

const beadPalette = [
  { name: "Hvid", color: "#f6f4ed" },
  { name: "Sand", color: "#d7b98e" },
  { name: "Kobber", color: "#b66a43" },
  { name: "Skovgrøn", color: "#3f6d4f" },
  { name: "Havblå", color: "#2f6885" },
  { name: "Nat", color: "#20232f" },
  { name: "Rosa", color: "#d68aa0" },
  { name: "Amber", color: "#ca8c2a" }
];

let selectedBeads = [];
let cart = loadCart();

function formatDkk(value) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  }).format(value);
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function notifyCartUpdate(reason) {
  window.dispatchEvent(new CustomEvent("cart:updated", { detail: { reason } }));
}

function getTarget() {
  return lengthTargets[productType.value];
}

function sizeMm() {
  return Number(beadSize.value);
}

function targetLengthMm() {
  return Math.round(Number(targetLength.value) * 10);
}

function currentLengthMm() {
  return selectedBeads.reduce((sum, bead) => sum + bead.size, 0);
}

function formatCm(mm) {
  return (mm / 10).toFixed(1).replace(".", ",") + " cm";
}

function lengthDifferenceMm() {
  return targetLengthMm() - currentLengthMm();
}

function addBead(color) {
  const nextSize = sizeMm();
  if (currentLengthMm() + nextSize > targetLengthMm()) {
    setMessage("Den perle overskrider den valgte længde. Vælg mindre perle eller læg i kurv.", "warn");
    return;
  }

  selectedBeads.push({ color, size: nextSize });
  setMessage("", "");
  render();
}

function undoBead() {
  if (selectedBeads.length > 0) {
    selectedBeads.pop();
    render();
  }
}

function clearBeads() {
  selectedBeads = [];
  setMessage("", "");
  render();
}

function setMessage(text, type) {
  orderMessage.textContent = text;
  orderMessage.classList.remove("ok", "warn");
  if (type) {
    orderMessage.classList.add(type);
  }
}

function isLengthReady() {
  return selectedBeads.length > 0 && currentLengthMm() <= targetLengthMm();
}

function renderPalette() {
  palette.innerHTML = "";

  for (const bead of beadPalette) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bead-btn";
    button.style.background = bead.color;
    button.title = bead.name;
    button.setAttribute("aria-label", `Tilføj ${bead.name}`);
    button.addEventListener("click", () => addBead(bead.color));
    palette.appendChild(button);
  }
}

function renderPreview() {
  preview.innerHTML = "";

  for (const beadItem of selectedBeads) {
    const bead = document.createElement("span");
    bead.className = "bead";
    const sizePx = Math.max(14, beadItem.size * 2);
    bead.style.width = `${sizePx}px`;
    bead.style.height = `${sizePx}px`;
    bead.style.background = beadItem.color;
    bead.title = `${beadItem.size} mm`;
    preview.appendChild(bead);
  }
}

function renderStats() {
  const target = getTarget();
  const current = selectedBeads.length;
  const currentMm = currentLengthMm();
  const diff = lengthDifferenceMm();

  let status = "Klar til bestilling";
  if (diff > 0) {
    status = `Du kan stadig tilføje op til ${formatCm(diff)}`;
  }
  if (diff === 0) {
    status = "Målet er ramt præcist";
  }
  if (diff < 0) {
    status = "Design er over grænsen. Fjern perler.";
  }

  statsBox.innerHTML = `
    <strong>Type:</strong> ${target.label}<br>
    <strong>Mållængde:</strong> ${formatCm(targetLengthMm())}<br>
    <strong>Aktiv perlestørrelse:</strong> ${sizeMm()} mm<br>
    <strong>Valgte perler:</strong> ${current} stk<br>
    <strong>Nuværende længde:</strong> ${formatCm(currentMm)}<br>
    <strong>Status:</strong> ${status}
  `;

  if (selectedBeads.length === 0) {
    orderBtn.disabled = true;
    orderBtn.textContent = "Vælg mindst 1 perle";
  } else if (diff < 0) {
    orderBtn.disabled = true;
    orderBtn.textContent = "Fjern perler for at fortsætte";
  } else {
    orderBtn.disabled = false;
    orderBtn.textContent = "Læg i kurv";
  }
}

function currentSizeMixText(beads) {
  const sizeMix = {};
  for (const beadItem of beads) {
    const key = `${beadItem.size} mm`;
    sizeMix[key] = (sizeMix[key] || 0) + 1;
  }

  if (!Object.keys(sizeMix).length) {
    return "Ingen perler valgt";
  }

  return Object.entries(sizeMix).map(([size, count]) => `${size}: ${count}`).join(", ");
}

function renderSummary() {
  const target = getTarget();

  orderSummary.innerHTML = `
    <p><strong>Type:</strong> ${target.label}</p>
    <p><strong>Ønsket længde:</strong> ${formatCm(targetLengthMm())}</p>
    <p><strong>Valgte perler:</strong> ${selectedBeads.length} stk</p>
    <p><strong>Størrelsesmix:</strong> ${currentSizeMixText(selectedBeads)}</p>
    <p><strong>Beregnet længde:</strong> ${formatCm(currentLengthMm())}</p>
    <p><strong>Plads tilbage:</strong> ${formatCm(Math.max(0, lengthDifferenceMm()))}</p>
  `;
}

function render() {
  renderPreview();
  renderStats();
  renderSummary();
}

function resetDesignForNewSetup() {
  selectedBeads = [];
  setMessage("Design nulstillet pga. ændring i type/størrelse.", "warn");
  render();
}

function applyDefaultLengthForType() {
  const target = getTarget();
  targetLength.value = (target.mm / 10).toString();
}

function onProductTypeChange() {
  applyDefaultLengthForType();
  resetDesignForNewSetup();
}

function onTargetLengthChange() {
  const value = Number(targetLength.value);
  const min = Number(targetLength.min) || 1;
  const max = Number(targetLength.max) || 100;

  if (Number.isNaN(value)) {
    targetLength.value = String(min);
  } else if (value < min) {
    targetLength.value = String(min);
  } else if (value > max) {
    targetLength.value = String(max);
  }

  if (targetLengthMm() < currentLengthMm()) {
    targetLength.value = (currentLengthMm() / 10).toFixed(1).replace(/\.0$/, "");
    setMessage("Mållængde kan ikke sættes under nuværende design. Fjern perler først.", "warn");
    render();
    return;
  }

  setMessage("", "");
  render();
}

function addCurrentDesignToCart() {
  const target = getTarget();

  cart.push({
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    categoryLabel: target.label,
    name: "Eget design",
    price: designPrices[productType.value] || 349,
    quantity: 1,
    length: formatCm(currentLengthMm()),
    description: `Størrelsesmix: ${currentSizeMixText(selectedBeads)} | Ønsket længde: ${formatCm(targetLengthMm())}`
  });

  saveCart();
  notifyCartUpdate("add");
}

function prepareNextDesign() {
  selectedBeads = [];
  setMessage("Smykke lagt i kurv. Design det næste smykke eller gå til køb.", "ok");
  render();
}

productType.addEventListener("change", onProductTypeChange);
beadSize.addEventListener("change", render);
targetLength.addEventListener("change", onTargetLengthChange);
targetLength.addEventListener("input", onTargetLengthChange);
undoBtn.addEventListener("click", undoBead);
clearBtn.addEventListener("click", clearBeads);

orderBtn.addEventListener("click", () => {
  if (!isLengthReady()) {
    setMessage("Vælg mindst 1 perle, og hold dig under den valgte længde.", "warn");
    return;
  }

  addCurrentDesignToCart();
  prepareNextDesign();
});

applyDefaultLengthForType();
renderPalette();
render();
