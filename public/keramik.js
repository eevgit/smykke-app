const CART_KEY = "hosejbye_shop_cart";
const WISHLIST_KEY = "hosejbye_wishlist";

function resolveApiUrl(path) {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!isHttp) return path;
  return new URL(path, window.location.origin).toString();
}

let ceramicProducts = [];
let cart = loadCart();
let wishlist = loadWishlist();

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

function changeImage(productId, direction) {
  const imageGallery = document.querySelector(`[data-product-id="${productId}"] .image-gallery`);
  if (!imageGallery) return;
  
  const images = imageGallery.querySelectorAll(".gallery-image");
  if (images.length <= 1) return;
  
  const currentIndex = Array.from(images).findIndex((img) => !img.hidden);
  const nextIndex = direction === "next" ? (currentIndex + 1) % images.length : (currentIndex - 1 + images.length) % images.length;
  
  images.forEach((img) => img.hidden = true);
  images[nextIndex].hidden = false;
}

let activeCategory = "all";
let searchTerm = "";
const ceramicGrid = document.getElementById("ceramicGrid");
const categoryBar = document.getElementById("categoryBar");
const productSearch = document.getElementById("productSearch");

const categoryOrder = ["cup", "bowl", "matcha", "candlestick", "vase"];

function filteredProducts() {
  let list = ceramicProducts;

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

  ceramicGrid.innerHTML = list
    .map((item) => {
      const outOfStock = Number(item.stock) <= 0;
      const isFavorite = wishlist.includes(item.id);
      const images = item.images || [];
      const imageItems = images
        .map((img, idx) => `<img class="product-image gallery-image" src="${img}" alt="${item.name}" ${idx > 0 ? 'hidden' : ''} />`)
        .join("");

      return `
        <article class="card product-card${outOfStock ? " is-out-of-stock" : ""}" data-product-id="${item.id}">
          <button type="button" class="wishlist-btn${isFavorite ? " active" : ""}" data-wishlist-id="${item.id}" aria-label="Favorit">${isFavorite ? "♥" : "♡"}</button>
          <div class="image-gallery-wrapper">
            <div class="image-gallery">
              ${imageItems}
            </div>
            ${images.length > 1 ? `
              <button class="image-nav-btn prev-btn" type="button" onclick="changeImage('${item.id}', 'prev')">‹</button>
              <button class="image-nav-btn next-btn" type="button" onclick="changeImage('${item.id}', 'next')">›</button>
            ` : ''}
          </div>
          <p class="product-category">${item.categoryLabel}</p>
          <h2>${item.name}</h2>
          <p><strong>Pris:</strong> ${formatPrice(item.price)}</p>
          ${outOfStock ? '<p class="out-of-stock-badge">Udsolgt</p>' : ""}
          <p>${item.description}</p>
          <button class="primary add-ceramic-btn" type="button" data-product-id="${item.id}" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Udsolgt" : "Læg i kurv"}</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".add-ceramic-btn").forEach((button) => {
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

function formatPrice(value) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  }).format(value);
}

function addToCart(productId) {
  const product = ceramicProducts.find((item) => item.id === productId);
  if (!product || Number(product.stock) <= 0) return;

  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      categoryLabel: product.categoryLabel,
      name: product.name,
      price: product.price,
      quantity: 1,
      length: product.length,
      description: product.description
    });
  }

  saveCart();
  notifyCartUpdate("add");
}

// Category filter event listeners
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
    const response = await fetch(resolveApiUrl("/api/products?type=ceramic"));
    const data = await response.json();
    ceramicProducts = Array.isArray(data.products) ? data.products : [];
  } catch {
    ceramicProducts = [];
  }
  renderProducts();
}

loadProducts();
