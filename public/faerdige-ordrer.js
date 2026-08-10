const finishedOrdersList = document.getElementById("finishedOrdersList");

const TOKEN_KEY = "smykke_admin_token";

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

function renderFinishedOrders(orders) {
  if (!orders.length) {
    finishedOrdersList.innerHTML = "<p>Ingen færdige ordrer endnu.</p>";
    return;
  }

  finishedOrdersList.innerHTML = orders
    .map((order) => {
      const items = (order.items || [])
        .map((item, index) => {
          const amountText = Number.isFinite(Number(item.priceDkk)) ? ` - ${formatDkk(Number(item.priceDkk))}` : "";
          return `<li>${index + 1}. ${item.type} - ${item.count || 0} stk${amountText}</li>`;
        })
        .join("");

      const archivedAtText = order.archivedAt
        ? new Date(order.archivedAt).toLocaleString("da-DK")
        : "-";

      return `
        <article class="next-step" data-archived-order-id="${order.id}">
          <p><strong>Ordre-ID:</strong> ${order.id}</p>
          <p><strong>Arkiveret:</strong> ${archivedAtText}</p>
          <p><strong>Kunde:</strong> ${order.customer?.name || "-"}</p>
          <ul>${items}</ul>
          <div class="actions">
            <button class="secondary restore-order" type="button">Gendan ordre</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".restore-order").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-archived-order-id]");
      const orderId = card?.dataset.archivedOrderId;
      if (orderId) {
        await restoreArchivedOrder(orderId);
      }
    });
  });
}

async function loadFinishedOrders() {
  const token = getToken();
  if (!token) {
    window.location.href = "ejer-login.html";
    return;
  }

  const response = await fetch(resolveApiUrl("/api/admin/orders/archived"), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "ejer-login.html";
      return;
    }
    finishedOrdersList.innerHTML = `<p>Kunne ikke hente færdige ordrer: ${data.error || "ukendt fejl"}</p>`;
    return;
  }

  renderFinishedOrders(data.orders || []);
}

async function restoreArchivedOrder(orderId) {
  const token = getToken();
  if (!token) {
    window.location.href = "ejer-login.html";
    return;
  }

  const response = await fetch(resolveApiUrl(`/api/admin/orders/${orderId}/restore`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(data.error || "Kunne ikke gendanne ordre");
    return;
  }

  await loadFinishedOrders();
}

loadFinishedOrders();
