(function () {
  const links = [
    { href: "index.html", label: "Start" },
    { href: "lager.html", label: "Smykker" },
    { href: "design.html", label: "Design" },
    { href: "keramik.html", label: "Keramik" },
    { href: "checkout.html", label: "Checkout" }
    
  ];

  if (!document.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = "manifest.json";
    document.head.appendChild(manifestLink);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        // Offline support is a nice-to-have; ignore registration failures.
      });
    });
  }

  const currentPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const body = document.body;
  body.classList.add("has-flyout");

  const wrapper = document.createElement("div");
  wrapper.className = "flyout-shell";

  const navItems = links
    .map((link) => {
      const isActive = currentPath === link.href.toLowerCase();
      return `<a class="flyout-link${isActive ? " active" : ""}" href="${link.href}">${link.label}</a>`;
    })
    .join("");

  wrapper.innerHTML = `
    <button class="flyout-toggle" type="button" aria-label="Skjul menu" aria-expanded="true">☰</button>
    <div class="flyout-head">
      <p>Menu</p>
    </div>
    <aside id="globalFlyoutPanel" class="flyout-panel">
      <nav class="flyout-nav">
        ${navItems}
      </nav>
    </aside>
  `;

  const appShell = document.querySelector(".app-shell");
  if (appShell && appShell.parentNode) {
    appShell.parentNode.insertBefore(wrapper, appShell);
  } else {
    document.body.appendChild(wrapper);
  }

  const toggle = wrapper.querySelector(".flyout-toggle");

  toggle.addEventListener("click", () => {
    const collapsed = body.classList.toggle("flyout-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Vis menu" : "Skjul menu");
  });
})();
