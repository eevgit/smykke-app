const productType = document.getElementById("productType");
const productCategory = document.getElementById("productCategory");
const productCategoryLabel = document.getElementById("productCategoryLabel");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productStock = document.getElementById("productStock");
const productLength = document.getElementById("productLength");
const productDescription = document.getElementById("productDescription");
const productImages = document.getElementById("productImages");
const saveProductBtn = document.getElementById("saveProductBtn");
const resetFormBtn = document.getElementById("resetFormBtn");
const refreshProductsBtn = document.getElementById("refreshProductsBtn");
const productFormMessage = document.getElementById("productFormMessage");
const productsList = document.getElementById("productsList");
const categorySummary = document.getElementById("categorySummary");
const formTitle = document.getElementById("formTitle");
const logoutBtn = document.getElementById("logoutBtn");

const TOKEN_KEY = "smykke_admin_token";
let editingProductId = null;
let activeCategoryFilter = null;

function resolveApiUrl(path) {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (isHttp && window.location.origin.includes("localhost:3000")) {
    return path;
  }
  return `http://localhost:3000${path}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function formatDkk(value) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function setFormMessage(text, type) {
  productFormMessage.textContent = text;
  productFormMessage.classList.remove("ok", "warn");
  if (type) {
    productFormMessage.classList.add(type);
  }
}

function resetForm() {
  editingProductId = null;
  formTitle.textContent = "Tilføj produkt";
  productType.value = "jewelry";
  productCategory.value = "";
  productCategoryLabel.value = "";
  productName.value = "";
  productPrice.value = "";
  productStock.value = "";
  productLength.value = "";
  productDescription.value = "";
  productImages.value = "";
  setFormMessage("", "");
}

function fillFormFromProduct(product) {
  editingProductId = product.id;
  formTitle.textContent = `Redigér: ${product.name}`;
  productType.value = product.type;
  productCategory.value = product.category;
  productCategoryLabel.value = product.categoryLabel;
  productName.value = product.name;
  productPrice.value = product.price;
  productStock.value = product.stock;
  productLength.value = product.length;
  productDescription.value = product.description;
  productImages.value = (product.images || []).join("\n");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProductsList(products) {
  const list = activeCategoryFilter
    ? products.filter((product) => `${product.type}::${product.category}` === activeCategoryFilter)
    : products;

  if (!list.length) {
    productsList.innerHTML = "<p>Ingen produkter i denne kategori.</p>";
    return;
  }

  productsList.innerHTML = list
    .map((product) => {
      const outOfStock = Number(product.stock) <= 0;
      return `
        <article class="next-step" data-product-id="${product.id}">
          <p><strong>${product.name}</strong> ${outOfStock ? '<span class="out-of-stock-badge">Udsolgt</span>' : ""}</p>
          <p>${product.type === "ceramic" ? "Keramik" : "Smykke"} - ${product.categoryLabel} - ${formatDkk(product.price)} - Lager: ${product.stock}</p>
          <div class="actions">
            <button class="secondary edit-product" type="button">Redigér</button>
            <button class="secondary delete-product" type="button">Slet</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".edit-product").forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.closest("[data-product-id]").dataset.productId;
      const product = products.find((item) => item.id === productId);
      if (product) {
        fillFormFromProduct(product);
      }
    });
  });

  document.querySelectorAll(".delete-product").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.closest("[data-product-id]").dataset.productId;
      if (!confirm("Slet dette produkt?")) {
        return;
      }
      await deleteProduct(productId);
    });
  });
}

async function loadProducts() {
  const token = getToken();
  if (!token) {
    window.location.replace("ejer-login.html");
    return;
  }

  const response = await fetch(resolveApiUrl("/api/admin/products"), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    productsList.innerHTML = `<p>${data.error || "Kunne ikke hente produkter"}</p>`;
    categorySummary.innerHTML = "";
    return;
  }

  const products = data.products || [];
  renderCategorySummary(products);
  renderProductsList(products);
}

function renderCategorySummary(products) {
  const groups = new Map();

  products.forEach((product) => {
    const key = `${product.type}::${product.category}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        type: product.type,
        categoryLabel: product.categoryLabel || product.category,
        count: 0,
        outOfStock: 0
      });
    }
    const group = groups.get(key);
    group.count += 1;
    if (Number(product.stock) <= 0) {
      group.outOfStock += 1;
    }
  });

  const cards = [...groups.values()]
    .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel, "da"))
    .map((group) => {
      const isActive = activeCategoryFilter === group.key;
      return `
        <button type="button" class="kpi-card clickable${isActive ? " active-filter" : ""}" data-category-key="${group.key}">
          <p class="kpi-label">${group.type === "ceramic" ? "Keramik" : "Smykke"} - ${group.categoryLabel}</p>
          <p class="kpi-value">${group.count} produkter</p>
          ${group.outOfStock ? `<p>${group.outOfStock} udsolgt</p>` : ""}
        </button>
      `;
    })
    .join("");

  const allActive = !activeCategoryFilter;
  categorySummary.innerHTML = `
    <button type="button" class="kpi-card clickable${allActive ? " active-filter" : ""}" data-category-key="">
      <p class="kpi-label">Alle kategorier</p>
      <p class="kpi-value">${products.length} produkter</p>
    </button>
    ${cards}
  `;

  categorySummary.querySelectorAll("[data-category-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.categoryKey;
      activeCategoryFilter = key || null;
      loadProducts();
    });
  });
}

function payloadFromForm() {
  const images = productImages.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    type: productType.value,
    category: productCategory.value.trim(),
    categoryLabel: productCategoryLabel.value.trim(),
    name: productName.value.trim(),
    price: Number(productPrice.value),
    stock: Number(productStock.value),
    length: productLength.value.trim(),
    description: productDescription.value.trim(),
    images
  };
}

async function saveProduct() {
  const token = getToken();
  if (!token) {
    window.location.replace("ejer-login.html");
    return;
  }

  const payload = payloadFromForm();
  if (!payload.name || !payload.categoryLabel) {
    setFormMessage("Udfyld mindst navn og kategorinavn", "warn");
    return;
  }

  saveProductBtn.disabled = true;
  saveProductBtn.textContent = "Gemmer...";

  try {
    const url = editingProductId
      ? resolveApiUrl(`/api/admin/products/${editingProductId}`)
      : resolveApiUrl("/api/admin/products");
    const method = editingProductId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Kunne ikke gemme produkt");
    }

    setFormMessage("Produkt gemt", "ok");
    resetForm();
    await loadProducts();
  } catch (error) {
    setFormMessage(error.message || "Der opstod en fejl", "warn");
  } finally {
    saveProductBtn.disabled = false;
    saveProductBtn.textContent = "Gem produkt";
  }
}

async function deleteProduct(productId) {
  const token = getToken();
  const response = await fetch(resolveApiUrl(`/api/admin/products/${productId}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(data.error || "Kunne ikke slette produkt");
    return;
  }

  if (editingProductId === productId) {
    resetForm();
  }
  await loadProducts();
}

saveProductBtn.addEventListener("click", saveProduct);
resetFormBtn.addEventListener("click", resetForm);
refreshProductsBtn.addEventListener("click", loadProducts);
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace("ejer-login.html");
});

loadProducts();
