(function () {
  const CART_KEY = "hosejbye_shop_cart";

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

  function getCount(cart) {
    return cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  }

  const link = document.createElement("a");
  link.className = "global-cart-link";
  link.href = "checkout.html";
  link.setAttribute("aria-label", "Gå til kurv");
  link.innerHTML = `
    <svg class="global-cart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="10" cy="20" r="1.6" fill="currentColor"/>
      <circle cx="18" cy="20" r="1.6" fill="currentColor"/>
    </svg>
    <span>Kurv</span>
    <span class="global-cart-status">0 varer</span>
    <span class="global-cart-badge">0</span>
  `;

  document.body.appendChild(link);

  const badge = link.querySelector(".global-cart-badge");
  const status = link.querySelector(".global-cart-status");

  function update() {
    const count = getCount(readCart());
    badge.textContent = String(count);
    status.textContent = `${count} vare${count === 1 ? "" : "r"}`;
    link.setAttribute("aria-label", `Gå til kurv (${count} vare${count === 1 ? "" : "r"})`);
  }

  update();
  window.addEventListener("storage", update);
  window.addEventListener("focus", update);
  window.addEventListener("cart:updated", update);
})();
