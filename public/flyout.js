(function () {
  const links = [
    { href: "index.html", label: "Start" },
    { href: "lager.html", label: "Smykker" },
    { href: "design.html", label: "Design" },
    { href: "checkout.html", label: "Checkout" },
    { href: "keramik.html", label: "Keramik" }
  ];

  const currentPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

  const wrapper = document.createElement("div");
  wrapper.className = "flyout-shell";

  const navItems = links
    .map((link) => {
      const isActive = currentPath === link.href.toLowerCase();
      return `<a class="flyout-link${isActive ? " active" : ""}" href="${link.href}">${link.label}</a>`;
    })
    .join("");

  wrapper.innerHTML = `
    <button class="flyout-toggle" type="button" aria-label="Toggle menu">☰</button>
    <div class="flyout-head">
      <p>Menu</p>
    </div>
    <aside id="globalFlyoutPanel" class="flyout-panel">
      <nav class="flyout-nav">
        ${navItems}
      </nav>
    </aside>
  `;

  document.body.appendChild(wrapper);

  const toggle = wrapper.querySelector(".flyout-toggle");
  const shell = wrapper;

  toggle.addEventListener("click", () => {
    shell.classList.toggle("collapsed");
  });
})();
