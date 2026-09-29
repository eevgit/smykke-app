function resolveApiUrl(path) {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!isHttp) return path;
  return new URL(path, window.location.origin).toString();
}

async function loadSiteContent() {
  try {
    const response = await fetch(resolveApiUrl("/api/site-content"));
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.content) {
      return;
    }

    const content = data.content;

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element && typeof value === "string") {
        element.textContent = value;
      }
    };

    setText("siteHeroTitle", content.heroTitle);
    setText("siteHeroIntro1", content.heroIntro1);
    setText("siteHeroIntro2", content.heroIntro2);
    setText("siteAboutText1", content.aboutText1);
    setText("siteAboutText2", content.aboutText2);
    setText("siteContactEmail", content.contactEmail);
    const instagramLink = document.getElementById("siteInstagramName");
    if (instagramLink && typeof content.instagramName === "string" && content.instagramName.trim()) {
      const instagramName = content.instagramName.trim();
      instagramLink.textContent = instagramName;
      instagramLink.href = `https://www.instagram.com/${encodeURIComponent(instagramName.replace(/^@/, ""))}`;
    }
    setText("siteBoothAddress", content.boothAddress);
    setText("siteOpeningHours", content.openingHours);
  } catch {
    // Keep existing static text as fallback when API is unavailable.
  }
}

loadSiteContent();
