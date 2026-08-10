(function () {
  const badge = document.getElementById("topCartCount");
  if (!badge) return;

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

  function updateBadge() {
    const cart = readCart();
    const count = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    badge.textContent = String(count);
  }

  updateBadge();
  window.addEventListener("storage", updateBadge);
})();
