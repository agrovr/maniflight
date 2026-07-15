/**
 * Inline report controller. It intentionally reads only server-rendered DOM
 * attributes and performs no network requests or dynamic HTML insertion.
 */
export const REPORT_INTERACTION = `
(() => {
  "use strict";

  const root = document.documentElement;
  const findings = Array.from(document.querySelectorAll("[data-finding]"));
  const domainButtons = Array.from(document.querySelectorAll("[data-domain-filter]"));
  const orbitLines = Array.from(document.querySelectorAll("[data-orbit-domain]"));
  const domainSelect = document.querySelector("#domain-filter");
  const statusSelect = document.querySelector("#status-filter");
  const severitySelect = document.querySelector("#severity-filter");
  const searchInput = document.querySelector("#finding-search");
  const clearButton = document.querySelector("#clear-filters");
  const resultCount = document.querySelector("#result-count");
  const emptyState = document.querySelector("#empty-state");
  const themeButton = document.querySelector("#theme-toggle");
  const priorityLinks = Array.from(document.querySelectorAll('.priority-links a[href^="#"]'));
  const themeMedia = window.matchMedia("(prefers-color-scheme: light)");

  const normalize = (value) => String(value || "").trim().toLocaleLowerCase();

  function currentTheme() {
    const explicit = root.getAttribute("data-theme");
    if (explicit === "light" || explicit === "dark") return explicit;
    return themeMedia.matches ? "light" : "dark";
  }

  function storedTheme() {
    try {
      const value = window.localStorage.getItem("maniflight-theme");
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function storeTheme(value) {
    try {
      window.localStorage.setItem("maniflight-theme", value);
    } catch {
      // Storage can be unavailable for local files or privacy-restricted tabs.
    }
  }

  function updateThemeButton() {
    if (!themeButton) return;
    const theme = currentTheme();
    const next = theme === "dark" ? "light" : "dark";
    const visibleLabel = (theme === "light" ? "Light" : "Dark") + " theme";
    themeButton.textContent = visibleLabel;
    themeButton.setAttribute("aria-label", visibleLabel + "; switch to " + next + " theme");
  }

  const initialTheme = storedTheme();
  if (initialTheme) root.setAttribute("data-theme", initialTheme);
  updateThemeButton();

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      storeTheme(next);
      updateThemeButton();
    });
  }

  themeMedia.addEventListener?.("change", () => {
    if (!root.hasAttribute("data-theme")) updateThemeButton();
  });

  function openFinding(fragment) {
    try {
      const target = document.getElementById(decodeURIComponent(fragment.replace(/^#/, "")));
      if (target instanceof HTMLDetailsElement) {
        const finding = target.closest("[data-finding]");
        if (finding?.hidden) {
          resetFilterValues();
          applyFilters();
        }
        target.open = true;
        const summary = target.querySelector("summary");
        if (summary instanceof HTMLElement) summary.focus();
      }
    } catch {
      // Ignore malformed URL fragments; the report remains fully navigable without them.
    }
  }

  function openLinkedFinding() {
    if (window.location.hash) openFinding(window.location.hash);
  }

  window.addEventListener("hashchange", openLinkedFinding);
  priorityLinks.forEach((link) => {
    link.addEventListener("click", () => openFinding(link.getAttribute("href") || ""));
  });
  openLinkedFinding();

  function filterState() {
    return {
      domain: domainSelect ? domainSelect.value : "all",
      status: statusSelect ? statusSelect.value : "all",
      severity: severitySelect ? severitySelect.value : "all",
      query: searchInput ? normalize(searchInput.value) : "",
    };
  }

  function updateVisualControls(domain) {
    domainButtons.forEach((button) => {
      const selected = button.getAttribute("data-domain-filter") === domain;
      button.setAttribute("aria-pressed", String(selected));
    });

    orbitLines.forEach((line) => {
      line.setAttribute(
        "data-active",
        String(domain !== "all" && line.getAttribute("data-orbit-domain") === domain),
      );
    });
  }

  function applyFilters() {
    const state = filterState();
    let visible = 0;

    findings.forEach((finding) => {
      const matchesDomain = state.domain === "all" || finding.dataset.domain === state.domain;
      const matchesStatus = state.status === "all" || finding.dataset.status === state.status;
      const matchesSeverity =
        state.severity === "all" || finding.dataset.severity === state.severity;
      const matchesQuery = !state.query || normalize(finding.dataset.search).includes(state.query);
      const matches = matchesDomain && matchesStatus && matchesSeverity && matchesQuery;

      finding.hidden = !matches;
      if (matches) visible += 1;
    });

    updateVisualControls(state.domain);

    if (emptyState) emptyState.hidden = visible !== 0;
    if (resultCount) {
      const suffix = visible === 1 ? " check shown" : " checks shown";
      resultCount.textContent = String(visible) + suffix;
    }
  }

  function resetFilterValues() {
    if (domainSelect) domainSelect.value = "all";
    if (statusSelect) statusSelect.value = "all";
    if (severitySelect) severitySelect.value = "all";
    if (searchInput) searchInput.value = "";
  }

  domainButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!domainSelect) return;
      domainSelect.value = button.getAttribute("data-domain-filter") || "all";
      applyFilters();
    });
  });

  domainSelect?.addEventListener("change", applyFilters);
  statusSelect?.addEventListener("change", applyFilters);
  severitySelect?.addEventListener("change", applyFilters);
  searchInput?.addEventListener("input", applyFilters);

  clearButton?.addEventListener("click", () => {
    resetFilterValues();
    applyFilters();
    searchInput?.focus();
  });

  applyFilters();
})();
`;
export default REPORT_INTERACTION;
//# sourceMappingURL=interaction.js.map