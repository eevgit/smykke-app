(function () {
  const CART_KEY = "hosejbye_shop_cart";
  let hideTimer = null;

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function formatDkk(value) {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0
    }).format(value);
  }

  const shell = document.createElement("aside");
  shell.className = "cart-overview";
  shell.setAttribute("aria-live", "polite");
  shell.innerHTML = `
    <div class="cart-overview-head">
      <p>Samlet kurv</p>
      <button type="button" class="cart-overview-close">Luk</button>
    </div>
    <div class="cart-overview-list"></div>
    <p class="cart-overview-total"></p>
    <a class="menu-link cart-overview-checkout" href="checkout.html">Gå til køb</a>
  `;

  document.body.appendChild(shell);

  const listEl = shell.querySelector(".cart-overview-list");
  const totalEl = shell.querySelector(".cart-overview-total");
  const closeBtn = shell.querySelector(".cart-overview-close");

  function updateCartQuantity(itemId, delta) {
    const cart = readCart();
    const item = cart.find((entry) => entry.id === itemId);
    if (!item) return;

    const nextQuantity = Number(item.quantity || 1) + delta;
    if (nextQuantity <= 0) {
      const next = cart.filter((entry) => entry.id !== itemId);
      saveCart(next);
      window.dispatchEvent(new CustomEvent("cart:updated", { detail: { reason: "quantity" } }));
      return;
    }

    item.quantity = nextQuantity;
    saveCart(cart);
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: { reason: "quantity" } }));
  }

  function removeItem(itemId) {
    const cart = readCart().filter((entry) => entry.id !== itemId);
    saveCart(cart);
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: { reason: "quantity" } }));
  }

  function render() {
    const cart = readCart();

    if (!cart.length) {
      listEl.innerHTML = "<p>Kurven er tom.</p>";
      totalEl.textContent = "";
      return;
    }

    listEl.innerHTML = cart
      .map((item) => {
        return `
          <div class="cart-overview-item">
            <p><strong>${item.categoryLabel} - ${item.name}</strong></p>
            <p>${formatDkk(item.price)} pr. stk</p>
            <div class="cart-overview-qty" data-item-id="${item.id}">
              <button type="button" class="secondary" data-action="decrement">-</button>
              <span>${item.quantity}</span>
              <button type="button" class="secondary" data-action="increment">+</button>
              <button type="button" class="secondary" data-action="remove">Fjern</button>
            </div>
          </div>
        `;
      })
      .join("");

    const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    totalEl.textContent = `I alt: ${formatDkk(total)}`;

    listEl.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".cart-overview-qty");
        const itemId = row?.dataset.itemId;
        const action = button.dataset.action;
        if (!itemId || !action) return;

        if (action === "increment") updateCartQuantity(itemId, 1);
        if (action === "decrement") updateCartQuantity(itemId, -1);
        if (action === "remove") removeItem(itemId);
      });
    });
  }

  function openForTenSeconds() {
    shell.classList.add("open");
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    hideTimer = setTimeout(() => {
      shell.classList.remove("open");
      hideTimer = null;
    }, 10000);
  }

  closeBtn.addEventListener("click", () => {
    shell.classList.remove("open");
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  window.addEventListener("cart:updated", (event) => {
    render();
    const reason = event?.detail?.reason;
    if (reason === "add") {
      openForTenSeconds();
    }
  });

  window.addEventListener("storage", render);
  window.addEventListener("focus", render);

  render();
})();
