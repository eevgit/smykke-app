const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");
const refreshActiveBtn = document.getElementById("refreshActiveBtn");
const refreshFinishedBtn = document.getElementById("refreshFinishedBtn");
const activeTabBtn = document.getElementById("activeTabBtn");
const finishedTabBtn = document.getElementById("finishedTabBtn");
const revenueTabBtn = document.getElementById("revenueTabBtn");
const logoutBtn = document.getElementById("logoutBtn");
const activeOrdersSection = document.getElementById("activeOrdersSection");
const finishedOrdersSection = document.getElementById("finishedOrdersSection");
const revenueSection = document.getElementById("revenueSection");
const ordersList = document.getElementById("ordersList");
const statsBox = document.getElementById("statsBox");
const statsChart = document.getElementById("statsChart");
const archivedOrdersList = document.getElementById("archivedOrdersList");
const currentPasswordInput = document.getElementById("currentPasswordInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const changePasswordMessage = document.getElementById("changePasswordMessage");
const accountingFileInput = document.getElementById("accountingFileInput");
const importAccountingBtn = document.getElementById("importAccountingBtn");
const accountingMessage = document.getElementById("accountingMessage");
const accountingSummary = document.getElementById("accountingSummary");
const accountingWatchPathInput = document.getElementById("accountingWatchPathInput");
const startWatchBtn = document.getElementById("startWatchBtn");
const stopWatchBtn = document.getElementById("stopWatchBtn");
const accountingWatchMessage = document.getElementById("accountingWatchMessage");

let lastAppMonthlySeries = [];
let lastImportedAccounting = null;
let accountingPollTimer = null;

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
    statsChart.innerHTML = "";
    return;
  }

  statsBox.innerHTML = `
    <article class="kpi-card">
      <p class="kpi-label">Solgt i uge</p>
      <p class="kpi-value">${stats.counts.weekOrders} ordrer</p>
      <p>Varer solgt: ${stats.counts.weekItems}</p>
    </article>
    <article class="kpi-card">
      <p class="kpi-label">Solgt i måned</p>
      <p class="kpi-value">${stats.counts.monthOrders} ordrer</p>
      <p>Varer solgt: ${stats.counts.monthItems}</p>
    </article>
    <article class="kpi-card">
      <p class="kpi-label">Statusoversigt</p>
      <p>Sendt: ${stats.counts.sent} ordrer / ${stats.counts.sentItems} varer</p>
      <p>Færdig: ${stats.counts.finished} ordrer / ${stats.counts.finishedItems} varer</p>
      <p>I alt solgt: ${stats.counts.sold} ordrer / ${stats.counts.soldItems} varer</p>
    </article>
    <article class="kpi-card">
      <p class="kpi-label">Ordreoversigt</p>
      <p>Aktive: ${stats.totals.activeOrders}</p>
      <p>Flyttet væk: ${stats.totals.archivedOrders}</p>
      <p>Totalt: ${stats.totals.allOrders}</p>
      <p>Nye i dag: ${stats.counts.today}</p>
    </article>
  `;

  renderStatsChart(stats.series);
}

function renderChartBars(title, series) {
  if (!Array.isArray(series) || series.length === 0) {
    return `
      <article class="card">
        <h3>${title}</h3>
        <p class="intro">Ingen data for denne periode.</p>
      </article>
    `;
  }

  const maxRevenue = Math.max(1, ...series.map((point) => point.revenue));
  const bars = series
    .map((point) => {
      const heightPercent = Math.round((point.revenue / maxRevenue) * 85);
      const tooltip = Number.isFinite(point.orders)
        ? `${formatDkk(point.revenue)} (${point.orders} ordrer)`
        : formatDkk(point.revenue);
      return `
        <div class="chart-bar-col" title="${tooltip}">
          <p class="chart-bar-value">${formatDkk(point.revenue)}</p>
          <div class="chart-bar" style="height: ${heightPercent}%"></div>
          <p class="chart-bar-label">${point.label}</p>
        </div>
      `;
    })
    .join("");

  return `
    <article class="card">
      <h3>${title}</h3>
      <div class="chart-bars">${bars}</div>
    </article>
  `;
}

function renderStatsChart(series) {
  if (!series) {
    statsChart.innerHTML = "";
    return;
  }

  lastAppMonthlySeries = series.monthlyApp || series.monthly || [];

  const dailyExcel = Array.isArray(series.dailyExcel) ? series.dailyExcel : [];
  const dailyApp = Array.isArray(series.dailyApp) ? series.dailyApp : [];
  const monthlyExcel = Array.isArray(series.monthlyExcel) ? series.monthlyExcel : [];
  const monthlyApp = Array.isArray(series.monthlyApp) ? series.monthlyApp : [];

  statsChart.innerHTML = `
    ${renderChartBars("Omsætning - seneste 7 kalenderdage (Excel)", dailyExcel.length ? dailyExcel : [])}
    ${renderChartBars("Omsætning - sidste 7 dage (App)", dailyApp.length ? dailyApp : [])}
    ${renderChartBars("Omsætning - sidste 6 måneder (Excel)", monthlyExcel.length ? monthlyExcel : [])}
    ${renderChartBars("Omsætning - sidste 6 måneder (App)", monthlyApp.length ? monthlyApp : [])}
  `;

  renderAccountingComparison();
}

function setAccountingMessage(text, type) {
  accountingMessage.textContent = text;
  accountingMessage.classList.remove("ok", "warn");
  if (type) {
    accountingMessage.classList.add(type);
  }
}

function renderAccountingComparison() {
  if (!lastImportedAccounting || !lastImportedAccounting.importedAt) {
    accountingSummary.innerHTML = "<p>Ingen regnskabsfil importeret endnu.</p>";
    return;
  }

  const accountingByMonth = new Map((lastImportedAccounting.monthly || []).map((entry) => [entry.month, entry]));
  const appByMonth = new Map(lastAppMonthlySeries.map((entry) => [entry.month, entry]));
  const allMonths = [...new Set([...accountingByMonth.keys(), ...appByMonth.keys()])].sort();

  const rows = allMonths
    .map((month) => {
      const appEntry = appByMonth.get(month);
      const accountingEntry = accountingByMonth.get(month);
      const appRevenue = appEntry ? appEntry.revenue : 0;
      const accountingRevenue = accountingEntry ? accountingEntry.revenue : 0;
      const accountingExpense = accountingEntry ? accountingEntry.expense : 0;
      const diff = accountingRevenue - appRevenue;
      const label = accountingEntry?.label || appEntry?.label || month;
      const diffClass = diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "";

      return `
        <tr>
          <td>${label}</td>
          <td>${formatDkk(appRevenue)}</td>
          <td>${formatDkk(accountingRevenue)}</td>
          <td>${formatDkk(accountingExpense)}</td>
          <td class="${diffClass}">${formatDkk(diff)}</td>
        </tr>
      `;
    })
    .join("");

  accountingSummary.innerHTML = `
    <p>Sidst importeret: ${new Date(lastImportedAccounting.importedAt).toLocaleString("da-DK")} (${lastImportedAccounting.fileName || "ukendt fil"}) - ${lastImportedAccounting.rowCount} rækker brugt${lastImportedAccounting.skippedCount ? `, ${lastImportedAccounting.skippedCount} sprunget over` : ""}.</p>
    ${lastImportedAccounting.watchedFilePath ? `<p>Automatisk opdatering aktiv fra: ${lastImportedAccounting.watchedFilePath}</p>` : ""}
    ${lastImportedAccounting.unmatchedSheets?.length ? `<p>Ignorerede faneblade (kunne ikke genkendes): ${lastImportedAccounting.unmatchedSheets.join(", ")}</p>` : ""}
    ${renderAccountingTotalsKpis(lastImportedAccounting.monthly || [], lastImportedAccounting.groups || [])}
    <table class="compare-table">
      <thead>
        <tr>
          <th>Måned</th>
          <th>App-ordrer</th>
          <th>Regnskab oms.</th>
          <th>Regnskab udgift</th>
          <th>Diff (regnskab - app)</th>
        </tr>
      </thead>
      <tbody>${rows || "<tr><td colspan=\"5\">Ingen data</td></tr>"}</tbody>
    </table>
    ${renderCategoryChart(lastImportedAccounting.categories || [])}
    ${renderMonthlyCategoryCharts(lastImportedAccounting.monthly || [])}
  `;
}

function renderAccountingTotalsKpis(monthly, groups) {
  if (!monthly.length) {
    return "";
  }

  const totalRevenue = monthly.reduce((sum, month) => sum + month.revenue, 0);
  const totalExpense = monthly.reduce((sum, month) => sum + month.expense, 0);
  const result = totalRevenue - totalExpense;
  const resultClass = result >= 0 ? "diff-positive" : "diff-negative";

  const groupCards = (groups || [])
    .slice()
    .sort((a, b) => {
      const order = ["Smykker", "Keramik"];
      const indexA = order.indexOf(a.group);
      const indexB = order.indexOf(b.group);
      if (indexA === -1 && indexB === -1) return a.group.localeCompare(b.group);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    })
    .map((group) => {
      const groupResult = group.revenue - group.expense;
      const groupResultClass = groupResult >= 0 ? "diff-positive" : "diff-negative";
      return `
        <article class="kpi-card">
          <p class="kpi-label">${group.group}</p>
          <p>Solgt for: ${formatDkk(group.revenue)}</p>
          <p>Udgifter: ${formatDkk(group.expense)}</p>
          <p class="${groupResultClass}">Resultat: ${formatDkk(groupResult)}</p>
        </article>
      `;
    })
    .join("");

  return `
    <div class="stats-grid">
      <article class="kpi-card">
        <p class="kpi-label">Solgt for i alt</p>
        <p class="kpi-value">${formatDkk(totalRevenue)}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-label">Udgifter i alt</p>
        <p class="kpi-value">${formatDkk(totalExpense)}</p>
      </article>
      <article class="kpi-card">
        <p class="kpi-label">Resultat (oms. - udgift)</p>
        <p class="kpi-value ${resultClass}">${formatDkk(result)}</p>
      </article>
    </div>
    ${groupCards ? `<div class="stats-grid">${groupCards}</div>` : ""}
  `;
}

function groupCategoriesByGroup(categories) {
  const groups = new Map();
  categories.forEach((entry) => {
    const groupName = entry.group || "Andet";
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(entry);
  });

  const groupOrder = ["Smykker", "Keramik"];
  return [...groups.entries()].sort(([a], [b]) => {
    const indexA = groupOrder.indexOf(a);
    const indexB = groupOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

function renderCategoryChart(categories) {
  if (!categories.length) {
    return "";
  }

  return groupCategoriesByGroup(categories)
    .map(([groupName, entries]) => {
      const series = entries.map((entry) => ({ label: entry.category, revenue: entry.revenue }));
      return renderChartBars(`Omsætning pr. kategori - ${groupName} (alle måneder)`, series);
    })
    .join("");
}

function renderMonthlyCategoryCharts(monthly) {
  const monthsWithData = monthly.filter((month) => month.revenue > 0 || (month.categories || []).length);
  if (!monthsWithData.length) {
    return "";
  }

  const charts = monthsWithData
    .map((month) => {
      const grouped = groupCategoriesByGroup(month.categories || []);
      return grouped
        .map(([groupName, entries]) => {
          const groupTotal = entries.reduce((sum, entry) => sum + entry.revenue, 0);
          const series = [
            { label: "I alt", revenue: groupTotal },
            ...entries.map((entry) => ({ label: entry.category, revenue: entry.revenue }))
          ];
          return renderChartBars(`${month.label} - ${groupName}`, series);
        })
        .join("");
    })
    .join("");

  return `<h3>Omsætning pr. måned og kategori</h3>${charts}`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Kunne ikke læse filen"));
    reader.readAsDataURL(file);
  });
}

async function loadAccounting() {
  const token = getToken();
  if (!token) {
    return;
  }

  const response = await fetch(resolveApiUrl("/api/admin/accounting"), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok) {
    lastImportedAccounting = data.accounting;
    renderAccountingComparison();
  }
}

async function importAccounting() {
  const token = getToken();
  const file = accountingFileInput.files?.[0];

  if (!file) {
    setAccountingMessage("Vælg en .xlsx-fil først", "warn");
    return;
  }

  importAccountingBtn.disabled = true;
  importAccountingBtn.textContent = "Importerer...";
  setAccountingMessage("Importerer regnskab...", "");

  try {
    const contentBase64 = await readFileAsBase64(file);
    const response = await fetch(resolveApiUrl("/api/admin/accounting/import"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ fileName: file.name, contentBase64 })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Kunne ikke importere regnskab");
    }

    lastImportedAccounting = data.accounting;
    renderAccountingComparison();
    setAccountingMessage(`Regnskab importeret: ${data.accounting.rowCount} rækker brugt.`, "ok");
    accountingFileInput.value = "";
  } catch (error) {
    setAccountingMessage(error.message || "Der opstod en fejl ved import", "warn");
  } finally {
    importAccountingBtn.disabled = false;
    importAccountingBtn.textContent = "Importér regnskab";
  }
}

function setAccountingWatchMessage(text, type) {
  accountingWatchMessage.textContent = text;
  accountingWatchMessage.classList.remove("ok", "warn");
  if (type) {
    accountingWatchMessage.classList.add(type);
  }
}

async function startAccountingWatch() {
  const token = getToken();
  const filePath = accountingWatchPathInput.value.trim();

  if (!filePath) {
    setAccountingWatchMessage("Angiv en filsti", "warn");
    return;
  }

  startWatchBtn.disabled = true;
  startWatchBtn.textContent = "Starter...";
  setAccountingWatchMessage("Læser fil og starter overvågning...", "");

  try {
    const response = await fetch(resolveApiUrl("/api/admin/accounting/watch"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ filePath })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Kunne ikke starte automatisk opdatering");
    }

    lastImportedAccounting = data.accounting;
    renderAccountingComparison();
    setAccountingWatchMessage("Automatisk opdatering er nu aktiv.", "ok");
  } catch (error) {
    setAccountingWatchMessage(error.message || "Der opstod en fejl", "warn");
  } finally {
    startWatchBtn.disabled = false;
    startWatchBtn.textContent = "Start automatisk opdatering";
  }
}

async function stopAccountingWatch() {
  const token = getToken();
  stopWatchBtn.disabled = true;

  try {
    const response = await fetch(resolveApiUrl("/api/admin/accounting/unwatch"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Kunne ikke stoppe automatisk opdatering");
    }

    await loadAccounting();
    setAccountingWatchMessage("Automatisk opdatering er stoppet.", "ok");
  } catch (error) {
    setAccountingWatchMessage(error.message || "Der opstod en fejl", "warn");
  } finally {
    stopWatchBtn.disabled = false;
  }
}

function startAccountingPolling() {
  stopAccountingPolling();
  accountingPollTimer = setInterval(loadAccounting, 30000);
}

function stopAccountingPolling() {
  if (accountingPollTimer) {
    clearInterval(accountingPollTimer);
    accountingPollTimer = null;
  }
}

function showAdmin() {
  loginPanel.classList.add("hidden");
  adminPanel.classList.remove("hidden");
}

function showLogin() {
  adminPanel.classList.add("hidden");
  loginPanel.classList.remove("hidden");
  stopAccountingPolling();
}

function setAdminTab(tabName) {
  const showingActive = tabName === "active";
  const showingFinished = tabName === "finished";
  const showingRevenue = tabName === "revenue";

  activeTabBtn.classList.toggle("active", showingActive);
  finishedTabBtn.classList.toggle("active", showingFinished);
  revenueTabBtn.classList.toggle("active", showingRevenue);

  activeOrdersSection.classList.toggle("hidden", !showingActive);
  finishedOrdersSection.classList.toggle("hidden", !showingFinished);
  revenueSection.classList.toggle("hidden", !showingRevenue);
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
    await loadAccounting();
    startAccountingPolling();
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
            <button class="danger delete-order" type="button">Slet ordre</button>
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

  document.querySelectorAll(".delete-order").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-order-id]");
      const orderId = card.dataset.orderId;
      await deleteOrder(orderId);
    });
  });
}

function renderArchivedOrders(orders) {
  if (!orders.length) {
    archivedOrdersList.innerHTML = "<p>Ingen arkiverede ordrer.</p>";
    return;
  }

  const now = new Date();
  const recentCutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const monthFormatter = new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" });
  const groupedOrders = new Map();

  orders.forEach((order) => {
    const archiveDate = new Date(order.archivedAt || order.createdAt);
    const validDate = Number.isNaN(archiveDate.getTime()) ? now : archiveDate;
    const year = String(validDate.getFullYear());
    const monthKey = `${year}-${String(validDate.getMonth() + 1).padStart(2, "0")}`;
    const groupType = validDate < recentCutoff ? "year" : "month";
    const groupKey = groupType === "year" ? year : monthKey;

    if (!groupedOrders.has(groupKey)) {
      groupedOrders.set(groupKey, {
        type: groupType,
        label: groupType === "year" ? year : monthFormatter.format(validDate),
        sortKey: groupKey,
        months: new Map()
      });
    }

    const group = groupedOrders.get(groupKey);
    if (!group.months.has(monthKey)) {
      group.months.set(monthKey, {
        label: monthFormatter.format(validDate),
        orders: []
      });
    }
    group.months.get(monthKey).orders.push(order);
  });

  const renderOrder = (order) => {
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
            <button class="danger delete-archived-order" type="button">Slet ordre</button>
          </div>
        </article>
      `;
  };

  const renderMonth = (month) => `
    <details class="archive-month">
      <summary>${month.label} <span>${month.orders.length} ordrer</span></summary>
      <div class="archive-orders">${month.orders.map(renderOrder).join("")}</div>
    </details>
  `;

  archivedOrdersList.innerHTML = [...groupedOrders.values()]
    .sort((first, second) => second.sortKey.localeCompare(first.sortKey))
    .map((group) => {
      const months = [...group.months.entries()]
        .sort(([firstKey], [secondKey]) => secondKey.localeCompare(firstKey))
        .map(([, month]) => renderMonth(month))
        .join("");

      if (group.type === "year") {
        const orderCount = [...group.months.values()].reduce((sum, month) => sum + month.orders.length, 0);
        return `
          <details class="archive-year">
            <summary>${group.label} <span>${orderCount} ordrer</span></summary>
            <div class="archive-months">${months}</div>
          </details>
        `;
      }

      return months;
    })
    .join("");

  document.querySelectorAll(".restore-order").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-archived-order-id]");
      const orderId = card.dataset.archivedOrderId;
      await restoreArchivedOrder(orderId);
    });
  });

  document.querySelectorAll(".delete-archived-order").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-archived-order-id]");
      const orderId = card.dataset.archivedOrderId;
      await deleteOrder(orderId);
    });
  });
}

async function deleteOrder(orderId) {
  const token = getToken();
  if (!token) {
    return;
  }

  const confirmed = window.confirm("Er du sikker på, at du vil slette denne ordre?");
  if (!confirmed) {
    return;
  }

  const response = await fetch(resolveApiUrl(`/api/admin/orders/${orderId}`), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(data.error || "Kunne ikke slette ordre");
    return;
  }

  await loadOrders();
  await loadArchivedOrders();
  await loadStats();
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

function setChangePasswordMessage(text, type) {
  changePasswordMessage.textContent = text;
  changePasswordMessage.classList.remove("ok", "warn");
  if (type) {
    changePasswordMessage.classList.add(type);
  }
}

async function changePassword() {
  const token = getToken();
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;

  if (!currentPassword || newPassword.length < 6) {
    setChangePasswordMessage("Udfyld nuværende password og et nyt password på mindst 6 tegn", "warn");
    return;
  }

  changePasswordBtn.disabled = true;
  changePasswordBtn.textContent = "Skifter...";

  try {
    const response = await fetch(resolveApiUrl("/api/admin/change-password"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Kunne ikke skifte adgangskode");
    }

    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    setChangePasswordMessage("Adgangskode opdateret", "ok");
  } catch (error) {
    setChangePasswordMessage(error.message || "Der opstod en fejl", "warn");
  } finally {
    changePasswordBtn.disabled = false;
    changePasswordBtn.textContent = "Skift adgangskode";
  }
}

changePasswordBtn.addEventListener("click", changePassword);
importAccountingBtn.addEventListener("click", importAccounting);
startWatchBtn.addEventListener("click", startAccountingWatch);
stopWatchBtn.addEventListener("click", stopAccountingWatch);

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});
refreshActiveBtn.addEventListener("click", async () => {
  await loadOrders();
  await loadStats();
});
refreshFinishedBtn.addEventListener("click", async () => {
  await loadArchivedOrders();
  await loadStats();
});
logoutBtn.addEventListener("click", () => {
  clearToken();
  showLogin();
});
activeTabBtn.addEventListener("click", () => setAdminTab("active"));
finishedTabBtn.addEventListener("click", () => setAdminTab("finished"));
revenueTabBtn.addEventListener("click", () => setAdminTab("revenue"));

if (getToken()) {
  showAdmin();
  setAdminTab(window.location.hash === "#finished" ? "finished" : "active");
  loadOrders();
  loadArchivedOrders();
  loadStats();
  loadAccounting();
  startAccountingPolling();
} else {
  showLogin();
}
