const checkoutCartItems = document.getElementById("checkoutCartItems");
const checkoutCartTotal = document.getElementById("checkoutCartTotal");
const orderName = document.getElementById("orderName");
const orderContact = document.getElementById("orderContact");
const orderAddress = document.getElementById("orderAddress");
const orderPostCode = document.getElementById("orderPostCode");
const orderCity = document.getElementById("orderCity");
const orderNote = document.getElementById("orderNote");
const submitOrderBtn = document.getElementById("submitOrderBtn");
const checkoutMessage = document.getElementById("checkoutMessage");

const CART_KEY = "hosejbye_shop_cart";
let cart = loadCart();

function resolveApiUrl(path) {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (isHttp && window.location.origin.includes("localhost:3000")) {
    return path;
  }
  return `http://localhost:3000${path}`;
}

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

function setCheckoutMessage(text, type) {
  checkoutMessage.textContent = text;
  checkoutMessage.classList.remove("ok", "warn");
  if (type) {
    checkoutMessage.classList.add(type);
  }
}

function toLengthMm(lengthText) {
  const value = Number(String(lengthText || "").replace(",", ".").replace(" cm", ""));
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 10);
}

function renderCart() {
  if (!cart.length) {
    checkoutCartItems.innerHTML = '<p>Kurven er tom. <a class="admin-link" href="lager.html">Gå tilbage til smykker</a>.</p>';
    checkoutCartTotal.textContent = "";
    submitOrderBtn.disabled = true;
    return;
  }

  checkoutCartItems.innerHTML = cart
    .map((item) => {
      return `
        <div class="cart-item">
          <p><strong>${item.categoryLabel} - ${item.name}</strong></p>
          <p>${item.quantity} x ${formatDkk(item.price)}</p>
          <p>${item.length}</p>
        </div>
      `;
    })
    .join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  checkoutCartTotal.textContent = `I alt: ${formatDkk(total)}`;
  submitOrderBtn.disabled = false;
}

function buildOrderItems() {
  return cart.map((item) => {
    return {
      type: `${item.categoryLabel} - ${item.name}`,
      count: item.quantity,
      lengthMm: toLengthMm(item.length),
      priceDkk: item.price,
      description: item.description || ""
    };
  });
}

async function submitOrder() {
  if (!cart.length) {
    setCheckoutMessage("Kurven er tom. Tilføj varer først.", "warn");
    return;
  }

  const name = orderName.value.trim();
  const contact = orderContact.value.trim();
  const address = orderAddress.value.trim();
  const postCode = orderPostCode.value.trim();
  const city = orderCity.value.trim();
  const note = orderNote.value.trim();

  if (!name || !contact || !address || !postCode || !city) {
    setCheckoutMessage("Udfyld navn, kontakt, adresse, postnr. og by for at bestille.", "warn");
    return;
  }

  submitOrderBtn.disabled = true;
  submitOrderBtn.textContent = "Sender bestilling...";

  try {
    const orderItems = buildOrderItems();
    if (!orderItems.length) {
      setCheckoutMessage("Kurven er tom. Tilføj varer først.", "warn");
      return;
    }

    const response = await fetch(resolveApiUrl("/api/orders"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer: {
          name,
          contact: `${contact} | ${address}, ${postCode} ${city}${note ? ` | Note: ${note}` : ""}`
        },
        items: orderItems
      })
    });

    const raw = await response.text();
    const data = (() => {
      try {
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })();

    if (!response.ok) {
      const details = data.error || data.details || raw || "Ukendt fejl";
      throw new Error(`Bestillingen kunne ikke sendes (${response.status}): ${details}`);
    }

    setCheckoutMessage(`Tak. Din bestilling er modtaget. Ordre-ID: ${data.orderId}.`, "ok");
    cart = [];
    saveCart();
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: { reason: "quantity" } }));
    renderCart();

    orderName.value = "";
    orderContact.value = "";
    orderAddress.value = "";
    orderPostCode.value = "";
    orderCity.value = "";
    orderNote.value = "";
  } catch (error) {
    const message = String(error?.message || "");
    if (/Failed to fetch|NetworkError/i.test(message)) {
      setCheckoutMessage("Serveren kunne ikke nås. Tjek at appen kører på localhost:3000.", "warn");
    } else {
      setCheckoutMessage(message || "Der opstod en fejl ved bestillingen.", "warn");
    }
  } finally {
    submitOrderBtn.textContent = "Gennemfør bestilling";
    if (cart.length > 0) {
      submitOrderBtn.disabled = false;
    }
  }
}

submitOrderBtn.addEventListener("click", submitOrder);
window.addEventListener("cart:updated", () => {
  cart = loadCart();
  renderCart();
});
renderCart();
