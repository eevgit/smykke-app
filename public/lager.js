const productsGrid = document.getElementById("productsGrid");
const categoryBar = document.getElementById("categoryBar");

const CART_KEY = "hosejbye_shop_cart";

const products = [
 
  {
    id: "b3",
    category: "keyring",
    categoryLabel: "Nøglering",
    name: "Håndlavet Samling 1",
    image: "assets/Design uden navn.png",
    price: 50,
    length: "8 cm",
    description: "Unik håndlavet nøglering.",
    stock: 1
  },
  {
    id: "b3b",
    category: "keyring",
    categoryLabel: "Nøglering",
    name: "Perle nøglering - Beige mix",
    image: "assets/Design uden navn (4).png",
    price: 65,
    length: "7 cm",
    description: "Smuk håndlavet nøglering med beige og neutrale perler.",
    stock: 1
  },
  {
    id: "b3c",
    category: "keyring",
    categoryLabel: "Nøglering",
    name: "Perle nøglering - Grønne nuancer",
    image: "assets/Design uden navn (6).png",
    price: 75,
    length: "8 cm",
    description: "Elegant nøglering med grønne og varme jordfarver.",
    stock: 1
  },
  {
    id: "b4",
    category: "bracelet",
    categoryLabel: "Armbånd",
    name: "Grønt armbånd med skiftevis 8 mm og små perler",
    image: "assets/Design uden navn (1).png",
    price: 100,
    length: "18,0 cm",
    description: "Personligt designet armbånd med varme jordfarver og fine perledetaljer.",
    stock: 1
  },
  {
    id: "b5",
    category: "bracelet",
    categoryLabel: "Armbånd",
    name: "Håndlavet Samling 3",
    image: "assets/Design uden navn (2).png",
    price: 100,
    length: "18,2 cm",
    description: "Smykt armbånd med blanding af neutrale og varme toner. Perfekt til hverdagen.",
    stock: 1
  },
  {
    id: "b6",
    category: "necklace",
    categoryLabel: "Halskæde",
    name: "10 mm perlehalskæde i lyse nuancer",
    image: "assets/Design uden navn (3).png",
    price: 200,
    length: "17,8 cm",
    description: "Justerbar halskæde med lyse perler i forskellige nuancer.",
    stock: 1
  },
  {
    id: "b7",
    category: "necklace",
    categoryLabel: "Halskæde",
    name: "Mixet perlehalskæde",
    image: "assets/Design uden navn (5).png",
    price: 225,
    length: "40,0 cm",
    description: "Smuk håndlavet halskæde med delikate perler og justerbar lås.",
    stock: 1
  },
  
  
  {
    id: "b9",
    category: "necklace",
    categoryLabel: "Halskæde",
    name: "8 mm perlehalskæde i brunlige nuancer",
    image: "assets/Design uden navn (11).png",
    price: 150,
    length: "40 cm",
    description: "Halskæde med perler i størrelse 8 mm i forskellige brunlige nuancer og med justerbar lås.",
    stock: 1
  },
  {
    id: "b10",
    category: "necklace",
    categoryLabel: "Halskæde",
    name: "10 mm perlehalskæde i lysegrønne nuancer",
    image: "assets/Design uden navn (12).png",
    price: 180,
    length: "18,0 cm",
    description: "Flot håndlavet halskæde med lysegrønne 10 mm perler.",
    stock: 1
  },
  {
    id: "b11",
    category: "necklace",
    categoryLabel: "Halskæde",
    name: "10 mm perlehalskæde i lyserød/pink nuancer",
    image: "assets/Design uden navn (13).png",
    price: 180,
    length: "18,5 cm",
    description: "Elegant halskæde med 10 mm perler i lyserød/pinke nuancer.",
    stock: 1
  }
];

let activeCategory = "all";
let cart = loadCart();

const categoryOrder = ["bracelet", "necklace", "keyring"];

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

function filteredProducts() {
  let list;
  if (activeCategory === "all") {
    list = products;
    // Sort by category order when "all" is selected
    list = list.sort((a, b) => {
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    });
  } else {
    list = products.filter((item) => item.category === activeCategory);
  }
  return list;
}

function renderProducts() {
  const list = filteredProducts();

  if (!list.length) {
    productsGrid.innerHTML = '<article class="card"><p>Ingen produkter i den kategori lige nu.</p></article>';
    return;
  }

  productsGrid.innerHTML = list
    .map((item) => {
      return `
        <article class="card product-card">
          <img class="product-image" src="${item.image}" alt="${item.categoryLabel} ${item.name}" />
          <p class="product-category">${item.categoryLabel}</p>
          <h2>${item.name}</h2>
          <p><strong>Længde:</strong> ${item.length}</p>
          <p><strong>Pris:</strong> ${formatDkk(item.price)}</p>
          <details class="product-details">
            <summary>Se mere beskrivelse</summary>
            <p>${item.description}</p>
            <p class="stock-count">Antal på lager: ${item.stock}</p>
          </details>
          <button class="primary add-btn" type="button" data-product-id="${item.id}">Læg i kurv</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".add-btn").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.productId);
    });
  });
}

function addToCart(productId) {
  const item = products.find((product) => product.id === productId);
  if (!item) return;

  const existing = cart.find((entry) => entry.id === productId);
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
      description: item.description
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

renderProducts();
