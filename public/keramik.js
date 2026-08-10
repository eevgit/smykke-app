const CART_KEY = "hosejbye_shop_cart";

const ceramicProducts = [
  {
    id: "ceramic-cup",
    category: "cup",
    categoryLabel: "Kopper",
    name: "Espressokop - Lerhvid",
    price: 229,
    length: "Keramik",
    description: "Volumen 180 ml. Mat finish med prikker. Egnet til mad. Kan komme i opvaskemaskinen.",
    images: ["assets/Design uden navn (9).png", "assets/Design uden navn (10).png"]
  },
  {
    id: "ceramic-bowl",
    category: "bowl",
    categoryLabel: "Skåle",
    name: "Skål - Havgrøn glasur",
    price: 279,
    length: "Keramik",
    description: "Diameter 14 cm. Velegnet til snack og morgenmad. Egnet til mad. Kan komme i opvaskemaskinen.",
    images: ["assets/Design uden navn (8).png"]
  },
  {
    id: "ceramic-vase",
    category: "vase",
    categoryLabel: "Vaser",
    name: "Vase - Sandtone",
    price: 349,
    length: "Keramik",
    description: "Højde 22 cm. God til tørrede blomster. Egnet til mad. Kan komme i opvaskemaskinen.",
    images: ["assets/Design uden navn (12).png", "assets/Design uden navn (13).png"]
  }
];

let cart = loadCart();
const detailCards = Array.from(document.querySelectorAll(".detail-card"));
const detailPlaceholder = document.getElementById("keramik-detail-placeholder");

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
const ceramicGrid = document.getElementById("ceramicGrid");
const categoryBar = document.getElementById("categoryBar");

const categoryOrder = ["cup", "bowl", "vase"];

function filteredProducts() {
  let list;
  if (activeCategory === "all") {
    list = ceramicProducts;
    // Sort by category order when "all" is selected
    list = list.sort((a, b) => {
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    });
  } else {
    list = ceramicProducts.filter((item) => item.category === activeCategory);
  }
  return list;
}

function renderProducts() {
  const list = filteredProducts();

  ceramicGrid.innerHTML = list
    .map((item) => {
      const imageItems = item.images
        .map((img, idx) => `<img class="product-image" src="${img}" alt="${item.name}" ${idx > 0 ? 'hidden' : ''} />`)
        .join("");
      
      return `
        <article class="card product-card" data-product-id="${item.id}">
          <div class="image-gallery-wrapper">
            <div class="image-gallery">
              ${imageItems}
            </div>
            ${item.images.length > 1 ? `
              <button class="image-nav-btn prev-btn" type="button" onclick="changeImage('${item.id}', 'prev')">‹</button>
              <button class="image-nav-btn next-btn" type="button" onclick="changeImage('${item.id}', 'next')">›</button>
            ` : ''}
          </div>
          <p class="product-category">${item.categoryLabel}</p>
          <h2>${item.name}</h2>
          <p><strong>Pris:</strong> ${formatPrice(item.price)}</p>
          <p>${item.description}</p>
          <button class="primary add-ceramic-btn" type="button" data-product-id="${item.id}">Læg i kurv</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".add-ceramic-btn").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.productId);
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
  if (!product) return;

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

function showDetail(detailId) {
  let found = false;

  detailCards.forEach((card) => {
    if (!card.id || card.id === "keramik-detail-placeholder") return;
    const isMatch = card.id === detailId;
    card.classList.toggle("hidden", !isMatch);
    card.classList.toggle("active", isMatch);
    if (isMatch) {
      found = true;
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  if (detailPlaceholder) {
    detailPlaceholder.classList.toggle("hidden", found);
  }
}

// Initialize products
renderProducts();

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

document.querySelectorAll(".add-ceramic-btn").forEach((button) => {
  button.addEventListener("click", () => {
    addToCart(button.dataset.productId);
  });
});

document.querySelectorAll(".show-detail-btn").forEach((button) => {
  button.addEventListener("click", () => {
    showDetail(button.dataset.detailId);
  });
});

document.querySelectorAll(".stock-card[data-detail-id]").forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    showDetail(card.dataset.detailId);
  });
});
