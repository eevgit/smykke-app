const productsGrid = document.getElementById("productsGrid");
const categoryBar = document.getElementById("categoryBar");
const productSearch = document.getElementById("productSearch");

const CART_KEY = "hosejbye_shop_cart";
const WISHLIST_KEY = "hosejbye_wishlist";

function resolveApiUrl(path) {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!isHttp) return path;
  return new URL(path, window.location.origin).toString();
}

let products = [];
let activeCategory = "all";
let searchTerm = "";
let cart = loadCart();
let wishlist = loadWishlist();

const categoryOrder = ["bracelet", "necklace", "earrings", "keyring"];

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

function loadWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWishlist() {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
}

function toggleWishlist(productId) {
  const index = wishlist.indexOf(productId);
  if (index >= 0) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push(productId);
  }
  saveWishlist();
  renderProducts();
}

function filteredProducts() {
  let list = products;

  if (activeCategory === "favorites") {
    list = list.filter((item) => wishlist.includes(item.id));
  } else if (activeCategory !== "all") {
    list = list.filter((item) => item.category === activeCategory);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    list = list.filter((item) => item.name.toLowerCase().includes(term) || item.description.toLowerCase().includes(term));
  }

  if (activeCategory === "all") {
    list = [...list].sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
  }

  return list;
}

function renderProducts() {
  const list = filteredProducts();

  if (!list.length) {
    productsGrid.innerHTML = '<article class="card"><p>Ingen produkter matcher lige nu.</p></article>';
    return;
  }

  productsGrid.innerHTML = list
    .map((item) => {
      const outOfStock = Number(item.stock) <= 0;
      const lowStock = Number(item.stock) > 0 && Number(item.stock) <= 2;
      const isFavorite = wishlist.includes(item.id);
      const image = (item.images && item.images[0]) || "";
      const lengthText = item.length && String(item.length).trim() ? `<p><strong>Længde:</strong> ${item.length}</p>` : "";
      const stockMessage = lowStock ? `<p class="out-of-stock-badge low-stock">Kun ${item.stock} tilbage på lager</p>` : `<p class="stock-count">Antal på lager: ${item.stock}</p>`;

      return `
        <article class="card product-card${outOfStock ? " is-out-of-stock" : ""}">
          <button type="button" class="wishlist-btn${isFavorite ? " active" : ""}" data-wishlist-id="${item.id}" aria-label="Favorit">${isFavorite ? "♥" : "♡"}</button>
          <img class="product-image" src="${image}" alt="${item.categoryLabel} ${item.name}" />
          <p class="product-category">${item.categoryLabel}</p>
          <h2>${item.name}</h2>
          ${lengthText}
          <p><strong>Pris:</strong> ${formatDkk(item.price)}</p>
          ${outOfStock ? '<p class="out-of-stock-badge">Udsolgt</p>' : ""}
          <details class="product-details">
            <summary>Se mere beskrivelse</summary>
            <p>${item.description}</p>
            ${stockMessage}
          </details>
          <button class="primary add-btn" type="button" data-product-id="${item.id}" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Udsolgt" : (lowStock ? `Læg i kurv (${item.stock} tilbage)` : "Læg i kurv")}</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".add-btn").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.productId);
    });
  });

  document.querySelectorAll("[data-wishlist-id]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleWishlist(button.dataset.wishlistId);
    });
  });
}

function addToCart(productId) {
  const item = products.find((product) => product.id === productId);
  if (!item || Number(item.stock) <= 0) return;

  const existing = cart.find((entry) => entry.id === productId);
  const currentQty = existing ? Number(existing.quantity) || 0 : 0;
  const stockLimit = Number(item.stock) || 0;

  if (currentQty >= stockLimit) {
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      categoryLabel: item.categoryLabel,
      length: item.length,
      description: item.description,
      stock: stockLimit
    });
  }

  saveCart();
  notifyCartUpdate("add");
}

categoryBar.addEventListener("click", (event) => {
  const target = event.target.closest("[data-category]");
  if (!target) return;

  activeCategory = target.dataset.category;

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.classList.remove("active");
  });
  target.classList.add("active");

  renderProducts();
});

if (productSearch) {
  productSearch.addEventListener("input", () => {
    searchTerm = productSearch.value.trim();
    renderProducts();
  });
}

async function loadProducts() {
  try {
    const response = await fetch(resolveApiUrl("/api/products?type=jewelry"));
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
  } catch {
    products = [];
  }
  renderProducts();
}

loadProducts();
