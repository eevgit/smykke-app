const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");
const refreshBtn = document.getElementById("refreshBtn");
const activeTabBtn = document.getElementById("activeTabBtn");
const finishedTabBtn = document.getElementById("finishedTabBtn");
const logoutBtn = document.getElementById("logoutBtn");
const activeOrdersSection = document.getElementById("activeOrdersSection");
const finishedOrdersSection = document.getElementById("finishedOrdersSection");
const ordersList = document.getElementById("ordersList");
const statsBox = document.getElementById("statsBox");
const archivedOrdersList = document.getElementById("archivedOrdersList");
const siteHeroTitleInput = document.getElementById("siteHeroTitleInput");
const siteHeroIntro1Input = document.getElementById("siteHeroIntro1Input");
const siteHeroIntro2Input = document.getElementById("siteHeroIntro2Input");
const siteAboutText1Input = document.getElementById("siteAboutText1Input");
const siteAboutText2Input = document.getElementById("siteAboutText2Input");
const siteContactEmailInput = document.getElementById("siteContactEmailInput");
const siteContactPhoneInput = document.getElementById("siteContactPhoneInput");
const siteBoothAddressInput = document.getElementById("siteBoothAddressInput");
const siteOpeningHoursInput = document.getElementById("siteOpeningHoursInput");
const reloadSiteContentBtn = document.getElementById("reloadSiteContentBtn");
const saveSiteContentBtn = document.getElementById("saveSiteContentBtn");
const siteContentMessage = document.getElementById("siteContentMessage");

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

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function setLoginMessage(text, type) {
  loginMessage.textContent = text;
  loginMessage.classList.remove("ok", "warn");
  if (type) {
    loginMessage.classList.add(type);
  }
}

function setSiteContentMessage(text, type) {
  siteContentMessage.textContent = text;
  siteContentMessage.classList.remove("ok", "warn");
  if (type) {
    siteContentMessage.classList.add(type);
  }
}

function formatDkk(value) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function renderStats(stats) {
  if (!stats) {
    statsBox.innerHTML = "<p>Kunne ikke hente statistik.</p>";
    return;
  }

  statsBox.innerHTML = `
    <article class="kpi-card">
      <p class="kpi-label">Solgt i uge</p>
      <p class="kpi-value">${formatDkk(stats.revenue.week)}</p>
      <p>Antal solgte ordrer: ${stats.counts.sold}</p>
    </article>
    <article class="kpi-card">
      <p class="kpi-label">Solgt i måned</p>
      <p class="kpi-value">${formatDkk(stats.revenue.month)}</p>
      <p>Solgt i år: ${formatDkk(stats.revenue.year)}</p>
    </article>
    <article class="kpi-card">
      <p class="kpi-label">Statusindtjening</p>
      <p>Sendt: ${formatDkk(stats.revenue.sent)} (${stats.counts.sent} ordrer)</p>
      <p>Færdig: ${formatDkk(stats.revenue.finished)} (${stats.counts.finished} ordrer)</p>
      <p>I alt solgt: ${formatDkk(stats.revenue.soldTotal)}</p>
      <p>Gns. ordreværdi: ${formatDkk(stats.revenue.soldAverage)}</p>
    </article>
    <article class="kpi-card">
      <p class="kpi-label">Ordreoversigt</p>
      <p>Aktive: ${stats.totals.activeOrders}</p>
      <p>Flyttet væk: ${stats.totals.archivedOrders}</p>
      <p>Totalt: ${stats.totals.allOrders}</p>
      <p>Nye i dag: ${stats.counts.today}</p>
    </article>
  `;
}

function siteContentPayloadFromInputs() {
  return {
    heroTitle: siteHeroTitleInput.value.trim(),
    heroIntro1: siteHeroIntro1Input.value.trim(),
    heroIntro2: siteHeroIntro2Input.value.trim(),
    aboutText1: siteAboutText1Input.value.trim(),
    aboutText2: siteAboutText2Input.value.trim(),
    contactEmail: siteContactEmailInput.value.trim(),
    contactPhone: siteContactPhoneInput.value.trim(),
    boothAddress: siteBoothAddressInput.value.trim(),
    openingHours: siteOpeningHoursInput.value.trim()
  };
}

function writeSiteContentToInputs(content) {
  siteHeroTitleInput.value = content.heroTitle || "";
  siteHeroIntro1Input.value = content.heroIntro1 || "";
  siteHeroIntro2Input.value = content.heroIntro2 || "";
  siteAboutText1Input.value = content.aboutText1 || "";
  siteAboutText2Input.value = content.aboutText2 || "";
  siteContactEmailInput.value = content.contactEmail || "";
  siteContactPhoneInput.value = content.contactPhone || "";
  siteBoothAddressInput.value = content.boothAddress || "";
  siteOpeningHoursInput.value = content.openingHours || "";
}

function showAdmin() {
  loginPanel.classList.add("hidden");
  adminPanel.classList.remove("hidden");
}

function showLogin() {
  adminPanel.classList.add("hidden");
  loginPanel.classList.remove("hidden");
}

function setAdminTab(tabName) {
  const showingActive = tabName !== "finished";

  activeTabBtn.classList.toggle("active", showingActive);
  finishedTabBtn.classList.toggle("active", !showingActive);

  activeOrdersSection.classList.toggle("hidden", !showingActive);
  finishedOrdersSection.classList.toggle("hidden", showingActive);
}

async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setLoginMessage("Udfyld brugernavn og password", "warn");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logger ind...";

  try {
    const response = await fetch(resolveApiUrl("/api/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Login mislykkedes");
    }

    setToken(data.token);
    setLoginMessage("", "");
    passwordInput.value = "";
    showAdmin();
    await loadOrders();
    await loadArchivedOrders();
    await loadStats();
  } catch (error) {
    setLoginMessage(error.message, "warn");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log ind";
  }
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = "<p>Ingen ordrer endnu.</p>";
    return;
  }

  ordersList.innerHTML = orders
    .map((order) => {
      const items = (order.items || [])
        .map((item, index) => {
          const workerText = item.worker ? ` - ${item.worker}` : "";
          const amountText = Number.isFinite(Number(item.priceDkk)) ? ` - ${formatDkk(Number(item.priceDkk))}` : "";
          return `<li>${index + 1}. ${item.type}${workerText} - ${item.count} stk - ${((item.lengthMm || 0) / 10).toFixed(1).replace(".", ",")} cm${amountText}</li>`;
        })
        .join("");

      const normalizedStatus = order.status === "Faerdig" ? "Færdig" : order.status;
      const options = ["Ny", "I gang", "Sendt", "Færdig"]
        .map((status) => `<option value="${status}" ${normalizedStatus === status ? "selected" : ""}>${status}</option>`)
        .join("");

      return `
        <article class="next-step" data-order-id="${order.id}">
          <p><strong>Ordre-ID:</strong> ${order.id}</p>
          <p><strong>Tid:</strong> ${new Date(order.createdAt).toLocaleString("da-DK")}</p>
          <p><strong>Kunde:</strong> ${order.customer?.name || "-"} (${order.customer?.contact || "ingen kontakt"})</p>
          <ul>${items}</ul>
          <div class="actions">
            <select class="status-select">${options}</select>
            <button class="secondary save-status" type="button">Gem status</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".save-status").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-order-id]");
      const orderId = card.dataset.orderId;
      const select = card.querySelector(".status-select");
      await updateOrderStatus(orderId, select.value);
    });
  });
}

function renderArchivedOrders(orders) {
  if (!orders.length) {
    archivedOrdersList.innerHTML = "<p>Ingen arkiverede ordrer.</p>";
    return;
  }

  archivedOrdersList.innerHTML = orders
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
      const orderId = card.dataset.archivedOrderId;
      await restoreArchivedOrder(orderId);
    });
  });
}

async function loadOrders() {
  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }

  const response = await fetch(resolveApiUrl("/api/admin/orders"), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    clearToken();
    showLogin();
    setLoginMessage(data.error || "Session udløbet", "warn");
    return;
  }

  renderOrders(data.orders || []);
}

async function loadStats() {
  const token = getToken();
  if (!token) {
    return;
  }

  const response = await fetch(resolveApiUrl("/api/admin/stats"), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setLoginMessage(data.error || "Kunne ikke hente statistik", "warn");
    return;
  }

  renderStats(data.stats);
}

async function loadSiteContent() {
  const token = getToken();
  if (!token) {
    return;
  }

  setSiteContentMessage("Henter forside...", "");
  const response = await fetch(resolveApiUrl("/api/admin/site-content"), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.content) {
    setSiteContentMessage(data.error || "Kunne ikke hente forsideindhold", "warn");
    return;
  }

  writeSiteContentToInputs(data.content);
  setSiteContentMessage("Forsideindhold hentet", "ok");
}

async function saveSiteContent() {
  const token = getToken();
  if (!token) {
    return;
  }

  const payload = siteContentPayloadFromInputs();
  saveSiteContentBtn.disabled = true;
  saveSiteContentBtn.textContent = "Gemmer...";
  setSiteContentMessage("Gemmer forside...", "");

  try {
    const response = await fetch(resolveApiUrl("/api/admin/site-content"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Kunne ikke gemme forsideindhold");
    }

    writeSiteContentToInputs(data.content || payload);
    setSiteContentMessage("Forside gemt. Opdater forsiden for at se ændringen.", "ok");
  } catch (error) {
    setSiteContentMessage(error.message || "Der opstod en fejl", "warn");
  } finally {
    saveSiteContentBtn.disabled = false;
    saveSiteContentBtn.textContent = "Gem forside";
  }
}

async function loadArchivedOrders() {
  const token = getToken();
  if (!token) {
    return;
  }

  const response = await fetch(resolveApiUrl("/api/admin/orders/archived"), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    archivedOrdersList.innerHTML = "<p>Kunne ikke hente arkiverede ordrer.</p>";
    return;
  }

  renderArchivedOrders(data.orders || []);
}

async function restoreArchivedOrder(orderId) {
  const token = getToken();
  if (!token) {
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

  await loadOrders();
  await loadArchivedOrders();
  await loadStats();
}

async function updateOrderStatus(orderId, status) {
  const token = getToken();
  const response = await fetch(resolveApiUrl(`/api/admin/orders/${orderId}/status`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "Kunne ikke opdatere status");
    return;
  }

  await loadOrders();
  await loadArchivedOrders();
  await loadStats();
}

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});
refreshBtn.addEventListener("click", loadOrders);
refreshBtn.addEventListener("click", loadArchivedOrders);
refreshBtn.addEventListener("click", loadStats);
refreshBtn.addEventListener("click", loadSiteContent);
logoutBtn.addEventListener("click", () => {
  clearToken();
  showLogin();
});
activeTabBtn.addEventListener("click", () => setAdminTab("active"));
finishedTabBtn.addEventListener("click", () => setAdminTab("finished"));
reloadSiteContentBtn.addEventListener("click", loadSiteContent);
saveSiteContentBtn.addEventListener("click", saveSiteContent);

if (getToken()) {
  showAdmin();
  setAdminTab("active");
  loadOrders();
  loadArchivedOrders();
  loadStats();
  loadSiteContent();
} else {
  showLogin();
}
