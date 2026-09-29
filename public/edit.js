const siteHeroTitleInput = document.getElementById("siteHeroTitleInput");
const siteHeroIntro1Input = document.getElementById("siteHeroIntro1Input");
const siteHeroIntro2Input = document.getElementById("siteHeroIntro2Input");
const siteAboutText1Input = document.getElementById("siteAboutText1Input");
const siteAboutText2Input = document.getElementById("siteAboutText2Input");
const siteContactEmailInput = document.getElementById("siteContactEmailInput");
const siteInstagramNameInput = document.getElementById("siteInstagramNameInput");
const siteBoothAddressInput = document.getElementById("siteBoothAddressInput");
const siteOpeningHoursInput = document.getElementById("siteOpeningHoursInput");
const reloadSiteContentBtn = document.getElementById("reloadSiteContentBtn");
const saveSiteContentBtn = document.getElementById("saveSiteContentBtn");
const siteContentMessage = document.getElementById("siteContentMessage");
const logoutBtn = document.getElementById("logoutBtn");

const TOKEN_KEY = "smykke_admin_token";

function resolveApiUrl(path) {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!isHttp) return path;
  return new URL(path, window.location.origin).toString();
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setSiteContentMessage(text, type) {
  siteContentMessage.textContent = text;
  siteContentMessage.classList.remove("ok", "warn");
  if (type) {
    siteContentMessage.classList.add(type);
  }
}

function siteContentPayloadFromInputs() {
  return {
    heroTitle: siteHeroTitleInput.value.trim(),
    heroIntro1: siteHeroIntro1Input.value.trim(),
    heroIntro2: siteHeroIntro2Input.value.trim(),
    aboutText1: siteAboutText1Input.value.trim(),
    aboutText2: siteAboutText2Input.value.trim(),
    contactEmail: siteContactEmailInput.value.trim(),
    instagramName: siteInstagramNameInput.value.trim(),
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
  siteInstagramNameInput.value = content.instagramName || "";
  siteBoothAddressInput.value = content.boothAddress || "";
  siteOpeningHoursInput.value = content.openingHours || "";
}

async function loadSiteContent() {
  const token = getToken();
  if (!token) {
    window.location.replace("ejer-login.html");
    return;
  }

  setSiteContentMessage("Henter forside...", "");
  const response = await fetch(resolveApiUrl("/api/admin/site-content"), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.content) {
    setSiteContentMessage(data.error || "Session udløbet. Log ind igen.", "warn");
    return;
  }

  writeSiteContentToInputs(data.content);
  setSiteContentMessage("Forsideindhold hentet", "ok");
}

async function saveSiteContent() {
  const token = getToken();
  if (!token) {
    window.location.replace("ejer-login.html");
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

reloadSiteContentBtn.addEventListener("click", loadSiteContent);
saveSiteContentBtn.addEventListener("click", saveSiteContent);
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace("ejer-login.html");
});
loadSiteContent();