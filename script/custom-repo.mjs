/**
 * @file Custom Repository Injector for Foundry VTT Setup v14.
 * Integrates external/custom package repositories into the ApplicationV2-based Package Installer.
 * Supports multiple repositories stored in localStorage, dynamic enabling/disabling,
 * extended metadata (id, author, site, social, cover), repository badges on package cards,
 * full backup and restore (JSON export/import), and real-time filtering.
 */

const SCRIPT_VERSION = "1.0.0"

const STORAGE_KEY = "foundry_custom_repositories";
const DEFAULT_REPOSITORIES = [];

const TEMPLATE_PATH = "/custom-package-card.hbs";
const MANAGER_TEMPLATE_PATH = "/custom-repo-manager.hbs";

/** @type {Handlebars.TemplateDelegate|null} */
let compiledCardTemplate = null;

/** @type {Handlebars.TemplateDelegate|null} */
let compiledManagerTemplate = null;

/** @type {Intl.DisplayNames|null} */
let displayNamesInstance = null;

/** @type {object[]|null} */
let cachedRawPackages = null;

/* -------------------------------------------- */
/*  CSS Style Injection                         */
/* -------------------------------------------- */

/**
 * Injects layout and alignment rules into document.head using Foundry CSS variables.
 * Ensures consistent presentation across Foundry VTT v14 themes without being stripped by cleanHTML.
 */
function injectCustomRepoStyles() {
  if (typeof document === "undefined" || document.getElementById("custom-repo-styles")) return;
  const style = document.createElement("style");
  style.id = "custom-repo-styles";
  style.textContent = `
    /* Toolbar Repository Switcher */
    #install-package .main nav.filters {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    #repo-source-group.controls.split-button {
      flex: none;
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      margin: 0;
    }
    #repo-source-group .ui-control {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
    }

    /* Custom Repository Manager Dialog */
    .custom-repo-manager-dialog .sources-fieldset {
      padding: var(--spacer-12, 0.75rem);
      margin-bottom: var(--spacer-12, 0.75rem);
    }
    .custom-repo-manager-dialog .repo-list {
      max-height: 320px;
      display: flex;
      flex-direction: column;
      gap: var(--spacer-8, 0.5rem);
      overflow-y: auto;
      padding-right: var(--spacer-4, 0.25rem);
    }
    .custom-repo-manager-dialog .repo-item {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--spacer-12, 0.75rem);
      padding: var(--spacer-8, 0.5rem);
      background: var(--input-background-color);
      border: 1px solid var(--color-fieldset-border);
      border-radius: 4px;
      transition: opacity 0.2s ease;
      width: 100%;
      box-sizing: border-box;
    }
    .custom-repo-manager-dialog .repo-item.disabled {
      opacity: 0.55;
    }
    .custom-repo-manager-dialog .repo-checkbox {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      margin: 0;
      cursor: pointer;
    }
    .custom-repo-manager-dialog .repo-cover {
      width: 44px;
      height: 44px;
      border-radius: 4px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--color-fieldset-border);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 44px;
    }
    .custom-repo-manager-dialog .repo-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .custom-repo-manager-dialog .repo-cover i {
      font-size: 1.25rem;
      color: var(--color-text-subtle);
    }
    .custom-repo-manager-dialog .repo-info {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .custom-repo-manager-dialog .repo-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--spacer-8, 0.5rem);
    }
    .custom-repo-manager-dialog .repo-title {
      font-size: var(--font-size-14, 14px);
      font-weight: bold;
      color: var(--color-text-light-heading, var(--color-text-primary));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }
    .custom-repo-manager-dialog .repo-header .tag {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .custom-repo-manager-dialog .repo-url {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-11, 11px);
      color: var(--color-text-subtle);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .custom-repo-manager-dialog .repo-description {
      font-size: var(--font-size-12, 12px);
      color: var(--color-text-secondary);
      margin: 2px 0 0;
      line-height: 1.3;
    }
    .custom-repo-manager-dialog .repo-meta {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .custom-repo-manager-dialog .repo-meta .tag {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .custom-repo-manager-dialog .repo-actions {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
    }
    .custom-repo-manager-dialog .delete-repo-btn {
      color: var(--color-level-error);
      cursor: pointer;
    }
    .custom-repo-manager-dialog .empty-hint {
      text-align: center;
      padding: var(--spacer-16);
    }
  `;
  document.head.appendChild(style);
}

injectCustomRepoStyles();

/* -------------------------------------------- */
/*  Repository Storage & Management APIs        */
/* -------------------------------------------- */

/**
 * Normalizes author definition into a human-readable string.
 * @param {string|object|Array} author - Raw author from repository metadata.
 * @returns {string} Formatted author string.
 */
function formatRepoAuthor(author) {
  if (!author) return "";
  if (typeof author === "string") return author;
  if (Array.isArray(author)) {
    return author.map(a => (typeof a === "object" ? (a.name || "") : String(a))).filter(Boolean).join(", ");
  }
  if (typeof author === "object") return author.name || "";
  return String(author);
}

/**
 * Retrieves the stored list of custom repositories from localStorage.
 * Initializes with defaults if not present or corrupt.
 * @returns {Array<{id: string, url: string, name: string, enabled: boolean, [key: string]: any}>}
 */
function getStoredRepositories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveStoredRepositories(DEFAULT_REPOSITORIES);
      return [...DEFAULT_REPOSITORIES];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn("Custom Repo: Failed to parse stored repositories, resetting to default.", err);
  }
  saveStoredRepositories(DEFAULT_REPOSITORIES);
  return [...DEFAULT_REPOSITORIES];
}

/**
 * Persists the list of custom repositories to localStorage.
 * @param {Array<object>} repos - List of repository configurations.
 */
function saveStoredRepositories(repos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
  } catch (err) {
    console.error("Custom Repo: Failed to save repositories to localStorage.", err);
  }
}

/**
 * Toggles a repository's enabled state.
 * @param {string} url - Repository URL identifier.
 * @param {boolean} enabled - New enabled state.
 */
function toggleRepository(url, enabled) {
  const repos = getStoredRepositories();
  const repo = repos.find(r => r.url === url);
  if (repo) {
    repo.enabled = Boolean(enabled);
    saveStoredRepositories(repos);
    cachedRawPackages = null;
  }
}

/**
 * Removes a repository from the stored list.
 * @param {string} url - Repository URL to remove.
 */
function removeRepository(url) {
  const repos = getStoredRepositories();
  const filtered = repos.filter(r => r.url !== url);
  saveStoredRepositories(filtered);
  cachedRawPackages = null;
}

/**
 * Adds a new repository by URL, fetching its metadata to populate properties.
 * @param {string} url - The URL to the repository.json file.
 * @returns {Promise<object>} The newly added repository object.
 */
async function addRepository(url) {
  const cleanUrl = url.trim();
  if (!cleanUrl) throw new Error("Repository URL cannot be empty.");

  try {
    new URL(cleanUrl);
  } catch {
    throw new Error("Invalid URL format. Please include http:// or https://");
  }

  const repos = getStoredRepositories();
  if (repos.some(r => r.url.toLowerCase() === cleanUrl.toLowerCase())) {
    throw new Error("This repository URL is already in your list.");
  }

  const res = await fetch(`${cleanUrl}?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Failed to reach repository: HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data || typeof data !== "object") {
    throw new Error("Invalid repository JSON response.");
  }

  const newRepo = {
    id: data.id || `repo-${Date.now()}`,
    url: cleanUrl,
    name: data.name || "Custom Repository",
    description: data.description || "",
    author: formatRepoAuthor(data.author) || "",
    site: data.site || "",
    cover: data.cover || "",
    social: Array.isArray(data.social) ? data.social : [],
    enabled: true,
    packageCount: Array.isArray(data.packages) ? data.packages.length : 0,
    lastFetched: Date.now()
  };

  repos.push(newRepo);
  saveStoredRepositories(repos);
  cachedRawPackages = null;
  return newRepo;
}

/**
 * Exports stored repositories into a downloadable JSON backup file.
 */
function exportRepositoriesBackup() {
  const repos = getStoredRepositories();
  const backupData = {
    format: "foundry-custom-repositories",
    version: 1,
    exportedAt: new Date().toISOString(),
    repositories: repos
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `foundry-custom-repositories-backup-${dateStr}.json`;

  if (typeof foundry?.utils?.saveDataToFile === "function") {
    foundry.utils.saveDataToFile(jsonString, "application/json", filename);
  } else {
    const blob = new Blob([jsonString], { type: "application/json" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = filename;
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, view: window }));
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 200);
  }

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(jsonString).catch(() => { });
  }
}

/**
 * Imports repositories from a JSON backup string, merging with existing entries.
 * @param {string} jsonText - JSON string content from uploaded backup.
 * @returns {Array<object>} The updated list of repositories.
 */
function importRepositoriesBackup(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error("Invalid JSON format in imported file.");
  }

  let incomingList = [];
  if (Array.isArray(parsed)) {
    incomingList = parsed;
  } else if (parsed && Array.isArray(parsed.repositories)) {
    incomingList = parsed.repositories;
  } else {
    throw new Error("Invalid backup format: missing 'repositories' array.");
  }

  const validEntries = incomingList.filter(r => r && typeof r.url === "string" && r.url.trim().length > 0);
  if (!validEntries.length) {
    throw new Error("No valid repositories found in the backup file.");
  }

  const existing = getStoredRepositories();
  const map = new Map(existing.map(r => [r.url.trim().toLowerCase(), r]));

  for (const item of validEntries) {
    const key = item.url.trim().toLowerCase();
    const prev = map.get(key) || {};
    map.set(key, {
      ...prev,
      ...item,
      url: item.url.trim(),
      name: item.name || prev.name || "Custom Repository",
      id: item.id || prev.id || `repo-${Date.now()}`,
      enabled: item.enabled !== false,
      author: formatRepoAuthor(item.author) || prev.author || "",
      site: item.site || prev.site || "",
      cover: item.cover || prev.cover || "",
      description: item.description || prev.description || "",
      social: Array.isArray(item.social) ? item.social : (prev.social || [])
    });
  }

  const merged = Array.from(map.values());
  saveStoredRepositories(merged);
  cachedRawPackages = null;
  return merged;
}

/* -------------------------------------------- */
/*  Template & Language Helpers                 */
/* -------------------------------------------- */

/**
 * Loads, compiles, and caches the Handlebars template for package cards.
 * Registers the compiled template as a Handlebars partial.
 * @returns {Promise<Handlebars.TemplateDelegate>} The compiled Handlebars template function.
 */
async function loadCardTemplate() {
  if (compiledCardTemplate) return compiledCardTemplate;
  let res = await fetch(`${TEMPLATE_PATH}?v=${Date.now()}`);
  if (!res.ok) {
    const fallbackPath = TEMPLATE_PATH.startsWith("/templates/")
      ? TEMPLATE_PATH.replace("/templates/", "/")
      : `/templates${TEMPLATE_PATH}`;
    const fallbackRes = await fetch(`${fallbackPath}?v=${Date.now()}`);
    if (fallbackRes.ok) res = fallbackRes;
  }
  if (!res.ok) {
    throw new Error(`Failed to load template from "${TEMPLATE_PATH}" (${res.status} ${res.statusText})`);
  }
  const text = await res.text();
  compiledCardTemplate = Handlebars.compile(text, { preventIndent: true });
  Handlebars.registerPartial(TEMPLATE_PATH, compiledCardTemplate);
  return compiledCardTemplate;
}

/**
 * Loads, compiles, and caches the Handlebars template for the repository manager.
 * Registers the compiled template as a Handlebars partial.
 * @returns {Promise<Handlebars.TemplateDelegate>} The compiled Handlebars template function.
 */
async function loadManagerTemplate() {
  if (compiledManagerTemplate) return compiledManagerTemplate;
  let res = await fetch(`${MANAGER_TEMPLATE_PATH}?v=${Date.now()}`);
  if (!res.ok) {
    const fallbackPath = MANAGER_TEMPLATE_PATH.startsWith("/templates/")
      ? MANAGER_TEMPLATE_PATH.replace("/templates/", "/")
      : `/templates${MANAGER_TEMPLATE_PATH}`;
    const fallbackRes = await fetch(`${fallbackPath}?v=${Date.now()}`);
    if (fallbackRes.ok) res = fallbackRes;
  }
  if (!res.ok) {
    throw new Error(`Failed to load template from "${MANAGER_TEMPLATE_PATH}" (${res.status} ${res.statusText})`);
  }
  const text = await res.text();
  compiledManagerTemplate = Handlebars.compile(text, { preventIndent: true });
  Handlebars.registerPartial(MANAGER_TEMPLATE_PATH, compiledManagerTemplate);
  return compiledManagerTemplate;
}

/**
 * Returns a human-readable localized language label with its uppercase code.
 * @param {string} code - The ISO language code (e.g., "en", "ru").
 * @returns {string} The formatted label, e.g. "English (EN)" or the raw code if unavailable.
 */
function getLanguageLabel(code) {
  if (!code) return "";
  const cleanCode = code.toLowerCase().trim();
  try {
    displayNamesInstance ??= new Intl.DisplayNames([navigator.language || "en"], { type: "language" });
    const name = displayNamesInstance.of(cleanCode);
    if (!name) return cleanCode.toUpperCase();
    return `${name.charAt(0).toUpperCase() + name.slice(1)} (${cleanCode.toUpperCase()})`;
  } catch {
    return cleanCode.toUpperCase();
  }
}

/**
 * Renders HTML badges for social links of a repository.
 * @param {Array<object|string>} social - Array of social objects or URL strings.
 * @returns {string} HTML string of social links.
 */
function renderSocialLinks(social) {
  if (!Array.isArray(social) || !social.length) return "";
  return social.map(item => {
    let name = "Link";
    let url = "";
    if (typeof item === "string") {
      url = item;
      try {
        const hostname = new URL(url).hostname.replace("www.", "");
        name = hostname.split(".")[0] || "Link";
      } catch {
        name = "Link";
      }
    } else if (item && typeof item === "object") {
      name = item.name || "Link";
      url = item.url || "";
    }
    if (!url) return "";

    const lower = `${name} ${url}`.toLowerCase();
    let iconClass = "fa-solid fa-link";
    if (lower.includes("discord")) iconClass = "fa-brands fa-discord";
    else if (lower.includes("github")) iconClass = "fa-brands fa-github";
    else if (lower.includes("patreon")) iconClass = "fa-brands fa-patreon";
    else if (lower.includes("twitter") || lower.includes("x.com")) iconClass = "fa-brands fa-x-twitter";
    else if (lower.includes("telegram") || lower.includes("t.me")) iconClass = "fa-brands fa-telegram";
    else if (lower.includes("youtube")) iconClass = "fa-brands fa-youtube";
    else if (lower.includes("twitch")) iconClass = "fa-brands fa-twitch";
    else if (lower.includes("reddit")) iconClass = "fa-brands fa-reddit";

    return `<a class="tag social" href="${url}" target="_blank" rel="noopener noreferrer">
      <i class="${iconClass}"></i> <span>${name}</span>
    </a>`;
  }).join(" ");
}

/* -------------------------------------------- */
/*  Package Fetching & Aggregation              */
/* -------------------------------------------- */

/**
 * Fetches and aggregates packages from all enabled repositories.
 * Enriches packages with repository source metadata.
 * @param {boolean} [force=false] - Whether to bypass in-memory package cache.
 * @returns {Promise<object[]>} Array of raw package definitions.
 */
async function fetchCustomPackages(force = false) {
  if (cachedRawPackages && !force) return cachedRawPackages;

  const repos = getStoredRepositories();
  const enabledRepos = repos.filter(r => r.enabled !== false);

  if (!enabledRepos.length) {
    cachedRawPackages = [];
    return [];
  }

  const results = await Promise.allSettled(
    enabledRepos.map(async (repo) => {
      const res = await fetch(`${repo.url}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();

      const metaId = data.id || repo.id || repo.url;
      const metaName = data.name || repo.name || "Custom Repository";
      const metaAuthor = formatRepoAuthor(data.author) || repo.author || "";
      const metaSite = data.site || repo.site || "";
      const metaCover = data.cover || repo.cover || "";
      const metaDescription = data.description || repo.description || "";
      const metaSocial = Array.isArray(data.social) ? data.social : (repo.social || []);
      const packages = Array.isArray(data.packages) ? data.packages : [];

      repo.id = metaId;
      repo.name = metaName;
      repo.author = metaAuthor;
      repo.site = metaSite;
      repo.cover = metaCover;
      repo.description = metaDescription;
      repo.social = metaSocial;
      repo.packageCount = packages.length;
      repo.lastFetched = Date.now();

      return packages.map(pkg => ({
        ...pkg,
        _repoId: metaId,
        _repoName: metaName,
        _repoAuthor: metaAuthor,
        _repoSite: metaSite,
        _repoCover: metaCover,
        _repoSocial: metaSocial
      }));
    })
  );

  saveStoredRepositories(repos);

  const aggregated = [];
  const errors = [];
  results.forEach((res, index) => {
    if (res.status === "fulfilled") {
      aggregated.push(...res.value);
    } else {
      errors.push(`${enabledRepos[index].name || enabledRepos[index].url}: ${res.reason.message}`);
    }
  });

  if (errors.length && aggregated.length === 0) {
    throw new Error(`Failed to load repositories:\n${errors.join("\n")}`);
  }

  cachedRawPackages = aggregated;
  return cachedRawPackages;
}

/* -------------------------------------------- */
/*  Filter Matching Helpers                     */
/* -------------------------------------------- */

/**
 * Checks whether the category filter state matches the default state.
 * @param {Map<string, 1|-1>} [categories] - The category filter Map.
 * @returns {boolean} True if the filter state is at default.
 */
function isDefaultCategoryState(categories) {
  if (!categories || categories.size === 0) return true;
  if (categories.size === 1 && categories.get("archived") === -1) return true;
  return false;
}

/**
 * Tests whether a package matches the active search query.
 * @param {object} pkg - Prepared package view model.
 * @param {string} query - The search query string.
 * @returns {boolean} True if all space-delimited query words match.
 */
function matchesSearch(pkg, query) {
  if (!query) return true;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every(term => pkg.searchText.includes(term));
}

/**
 * Tests whether package tags match the active tri-state category filter.
 * @param {string[]} tags - The package's tag array.
 * @param {string[]} included - Category IDs that must be present.
 * @param {string[]} excluded - Category IDs that must not be present.
 * @returns {boolean} True if the package passes category filtering.
 */
function matchesCategory(tags, included, excluded) {
  if (included.length && !included.every(id => tags.includes(id))) return false;
  if (excluded.length && excluded.some(id => tags.includes(id))) return false;
  return true;
}

/**
 * Tests whether a package matches the active visibility filter.
 * @param {boolean} isInstalled - Whether the package is currently installed locally.
 * @param {"all"|"inst"|"unin"} visibility - The visibility filter mode.
 * @returns {boolean} True if the package matches visibility.
 */
function matchesVisibility(isInstalled, visibility) {
  if (visibility === "inst") return isInstalled;
  if (visibility === "unin") return !isInstalled;
  return true;
}

/**
 * Tests whether a package matches the active system filter.
 * @param {string[]} requires - System IDs the package requires.
 * @param {{mode: string, value: Set<string>}} [filter] - The active system filter state.
 * @returns {boolean} True if the package matches the system filter.
 */
function matchesSystems(requires, filter) {
  if (!filter) return true;
  const installedSystems = new Set(game?.systems?.keys() || []);
  switch (filter.mode) {
    case "installed":
      return !requires.length || requires.some(id => installedSystems.has(id));
    case "specific":
      if (!filter.value || !filter.value.size) return true;
      return requires.some(id => filter.value.has(id));
    case "none":
    default:
      return true;
  }
}

/**
 * Tests whether a package matches the selected language.
 * @param {string[]} packageLanguages - Array of lowercase language codes for the package.
 * @param {string} selectedLang - The selected language code, or empty for all.
 * @returns {boolean} True if matches.
 */
function matchesLanguage(packageLanguages, selectedLang) {
  if (!selectedLang) return true;
  return packageLanguages.includes(selectedLang.toLowerCase());
}

/**
 * Updates sidebar category counts, glyphs, and active classes to reflect custom repository state.
 * @param {HTMLElement} root - The root DOM element of the application.
 * @param {object[]} tabPackages - All packages available for the current tab.
 * @param {object[]} matchingPackages - Packages matching current filters.
 * @param {Map<string, 1|-1>} [categories] - Active category states.
 */
function updateCategorySidebar(root, tabPackages, matchingPackages, categories) {
  const categoryButtons = root.querySelectorAll('aside nav.tabs button[data-category], nav.tabs button[data-category]');
  if (!categoryButtons.length) return;

  const tagCounts = {};
  for (const pkg of tabPackages) {
    const tags = (pkg.tags && pkg.tags.length) ? pkg.tags : ["content"];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const isDefaultState = isDefaultCategoryState(categories);

  categoryButtons.forEach(btn => {
    const reset = "reset" in btn.dataset || btn.dataset.category === "all";
    const cat = btn.dataset.category;
    const state = reset ? 0 : (categories?.get(cat) ?? 0);
    const count = reset ? matchingPackages.length : (tagCounts[cat] ?? 0);

    const countSpan = btn.querySelector(":scope > span[data-count], span[data-count], .count");
    if (countSpan) countSpan.textContent = `[${count}]`;

    const statusIcon = btn.querySelector(":scope > i.status, i.status");
    if (statusIcon) {
      statusIcon.className = `status fa-solid${state > 0 ? " fa-check" : state < 0 ? " fa-xmark" : ""}`;
    }

    btn.classList.toggle("filter-in", state > 0);
    btn.classList.toggle("filter-out", state < 0);
    btn.classList.toggle("no-matches", (state >= 0) && (count === 0));
    btn.classList.toggle("active", reset && isDefaultState);

    btn.style.display = (reset || count > 0 || state !== 0) ? "" : "none";
  });
}

/* -------------------------------------------- */
/*  UI: Repository Manager Modal                */
/* -------------------------------------------- */

/**
 * Opens the Custom Repository Manager dialog using Foundry VTT v14 DialogV2.
 * Renders the custom-repo-manager.hbs template with native Foundry styling.
 * @param {foundry.applications.api.ApplicationV2} installerApp - The InstallPackage application instance.
 */
async function openRepositoryManager(installerApp) {
  const template = await loadManagerTemplate();

  /**
   * Prepares context data for the manager template.
   * @returns {object} Context object with processed repositories.
   */
  function prepareManagerContext() {
    const repos = getStoredRepositories();
    const processed = repos.map(r => ({
      ...r,
      enabled: r.enabled !== false,
      socialDisplay: renderSocialLinks(r.social)
    }));
    return { repos: processed };
  }

  // Prevent opening duplicate dialog instances
  const existingDialog = Array.from(foundry?.applications?.instances?.values() || [])
    .find(app => app.options?.id === "custom-repo-manager-dialog");
  if (existingDialog) {
    existingDialog.bringToTop();
    return;
  }

  const initialHtml = template(prepareManagerContext());

  const dialog = new foundry.applications.api.DialogV2({
    id: "custom-repo-manager-dialog",
    classes: ["dialog", "custom-repo-manager-dialog"],
    window: {
      title: "Custom Repositories",
      icon: "fa-solid fa-boxes-stacked"
    },
    position: {
      width: 680,
      height: "auto"
    },
    modal: true,
    form: {
      closeOnSubmit: false
    },
    content: initialHtml,
    buttons: [
      {
        action: "export",
        label: "Export Backup",
        icon: "fa-solid fa-file-export",
        callback: (event, target, d) => {
          exportRepositoriesBackup();
          ui.notifications?.info("Repositories backup exported successfully.");
        }
      },
      {
        action: "import",
        label: "Import Backup",
        icon: "fa-solid fa-file-import",
        callback: (event, target, d) => {
          const fileInput = d.element.querySelector("#import-repos-file-input");
          fileInput?.click();
        }
      },
      {
        action: "close",
        label: "Close",
        icon: "fa-solid fa-xmark",
        default: true,
        callback: (event, target, d) => d.close()
      }
    ]
  });

  await dialog.render({ force: true });

  /**
   * Re-renders the dialog content dynamically and rebinds interactive handlers.
   */
  function refreshContent() {
    const contentContainer = dialog.element.querySelector(".dialog-content");
    if (contentContainer) {
      contentContainer.innerHTML = template(prepareManagerContext());
      bindDialogListeners();
    }
  }

  /**
   * Binds interactive event handlers to the dialog DOM elements.
   */
  function bindDialogListeners() {
    const root = dialog.element;
    if (!root) return;

    // Toggle repository checkbox
    root.querySelectorAll('input[data-action="toggleRepo"]').forEach(box => {
      box.onchange = async () => {
        toggleRepository(box.dataset.url, box.checked);
        const item = box.closest(".repo-item");
        if (item) item.classList.toggle("disabled", !box.checked);
        if (installerApp.selectedRepo === "custom") {
          await renderCustomPackages(installerApp, { forceFetch: true });
        }
      };
    });

    // Delete repository button
    root.querySelectorAll('button[data-action="deleteRepo"]').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        removeRepository(btn.dataset.url);
        refreshContent();
        if (installerApp.selectedRepo === "custom") {
          await renderCustomPackages(installerApp, { forceFetch: true });
        }
      };
    });

    // Add repository form
    const addBtn = root.querySelector('button[data-action="addRepo"]');
    const urlInput = root.querySelector("#new-repo-url-input");
    const feedback = root.querySelector("#add-repo-feedback");

    async function handleAddRepo() {
      if (!urlInput) return;
      const url = urlInput.value.trim();
      if (!url) return;

      if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Fetching...</span>';
      }
      if (feedback) {
        feedback.style.display = "block";
        feedback.style.color = "var(--color-text-subtle)";
        feedback.textContent = "Validating repository URL...";
      }

      try {
        await addRepository(url);
        if (feedback) {
          feedback.style.color = "var(--color-level-success)";
          feedback.textContent = "Repository added successfully!";
        }
        setTimeout(() => {
          refreshContent();
          if (installerApp.selectedRepo === "custom") {
            renderCustomPackages(installerApp, { forceFetch: true });
          }
        }, 300);
      } catch (err) {
        if (feedback) {
          feedback.style.display = "block";
          feedback.style.color = "var(--color-level-error)";
          feedback.textContent = `Error: ${err.message}`;
        }
        if (addBtn) {
          addBtn.disabled = false;
          addBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> <span>Add &amp; Fetch</span>';
        }
      }
    }

    if (addBtn) addBtn.onclick = handleAddRepo;
    if (urlInput) {
      urlInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddRepo();
        }
      };
    }

    // Import backup file picker listener
    const fileInput = root.querySelector("#import-repos-file-input");
    if (fileInput && !fileInput._changeBound) {
      fileInput._changeBound = true;
      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const text = event.target.result;
            const updated = importRepositoriesBackup(text);
            ui.notifications?.info(`Successfully restored ${updated.length} repositories.`);
            refreshContent();
            if (installerApp.selectedRepo === "custom") {
              await renderCustomPackages(installerApp, { forceFetch: true });
            }
          } catch (err) {
            ui.notifications?.error(`Restore failed: ${err.message}`);
          } finally {
            fileInput.value = "";
          }
        };
        reader.readAsText(file);
      };
    }
  }

  bindDialogListeners();
}

/* -------------------------------------------- */
/*  Delegated Event Listeners                   */
/* -------------------------------------------- */

/**
 * Binds delegated click handlers on the package list container for install and manifest selection.
 * @param {foundry.applications.api.ApplicationV2} app - The application instance.
 * @param {HTMLElement} packageList - The package list element.
 * @param {HTMLElement} root - The application root element.
 */
function bindPackageListEvents(app, packageList, root) {
  if (packageList._customEventsBound) return;
  packageList._customEventsBound = true;

  packageList.addEventListener("click", async (e) => {
    const installBtn = e.target.closest('button[data-action="installCustomPackage"]');
    if (installBtn) {
      e.preventDefault();
      e.stopPropagation();

      const manifest = installBtn.dataset.manifest;
      installBtn.disabled = true;
      installBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Installing...</span>`;

      const manifestInput = root.querySelector("#install-package-manifestUrl");
      const installUrlBtn = root.querySelector('button[data-action="installUrl"]');

      if (manifestInput && installUrlBtn) {
        manifestInput.value = manifest;
        installUrlBtn.click();
        installBtn.innerHTML = `<i class="fa-solid fa-check" style="color: var(--color-level-success, #4ade80);"></i> <span>Queued</span>`;
      }
      return;
    }

    const label = e.target.closest('.label[data-action="setManifestUrl"]');
    if (label) {
      const card = label.closest(".package");
      const btn = card?.querySelector('button[data-action="installCustomPackage"]');
      const manifest = btn?.dataset.manifest;
      const manifestInput = root.querySelector("#install-package-manifestUrl");
      if (manifest && manifestInput) {
        manifestInput.value = manifest;
      }
    }
  });
}

/**
 * Binds a debounced real-time input event handler on the search input element.
 * @param {foundry.applications.api.ApplicationV2} app - The application instance.
 * @param {HTMLElement} root - The application root element.
 */
function bindSearchInput(app, root) {
  const searchInput = root.querySelector("aside input[type=search], input[type=search]");
  if (!searchInput || searchInput._customRepoBound) return;
  searchInput._customRepoBound = true;

  let debounceTimer = null;
  searchInput.addEventListener("input", () => {
    if (app.selectedRepo === "custom") {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderCustomPackages(app);
      }, 100);
    }
  });
}

/**
 * Injects or updates the language filter select dropdown in the installer sidebar.
 * @param {foundry.applications.api.ApplicationV2} app - The application instance.
 * @param {HTMLElement} root - The root DOM element of the application window.
 * @param {object[]} packages - The list of package definitions for the active tab.
 */
function injectLanguageFilter(app, root, packages) {
  const filtersContainer = root.querySelector("aside .package-filters");
  if (!filtersContainer) return;

  let group = root.querySelector("#install-package-language-group");
  if (!group) {
    group = document.createElement("div");
    group.id = "install-package-language-group";
    group.className = "form-group stacked language-filter";
    group.innerHTML = `
      <label for="install-package-language-select">Languages</label>
      <div class="form-fields">
        <select id="install-package-language-select">
          <option value="">All Languages</option>
        </select>
      </div>
    `;
    filtersContainer.appendChild(group);
  }

  group.style.display = app.selectedRepo === "custom" ? "" : "none";

  const select = group.querySelector("#install-package-language-select");
  const currentVal = select.value || "";

  const uniqueLangCodes = new Set();
  packages.forEach(pkg => {
    (pkg.languages || []).forEach(l => {
      const code = (typeof l === "object" ? l.lang : l);
      if (code) uniqueLangCodes.add(code.toLowerCase());
    });
  });

  select.innerHTML = '<option value="">All Languages</option>';
  Array.from(uniqueLangCodes).sort().forEach(code => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = getLanguageLabel(code);
    select.appendChild(opt);
  });

  select.value = currentVal;

  if (!select._customRepoBound) {
    select._customRepoBound = true;
    select.addEventListener("change", () => {
      if (app.selectedRepo === "custom") {
        renderCustomPackages(app);
      }
    });
  }
}

/**
 * Injects Official vs. Custom repository switch buttons and Manage Repositories trigger into the installer toolbar.
 * @param {foundry.applications.api.ApplicationV2} app - The InstallPackage application instance.
 * @param {HTMLElement} root - The root DOM element of the application window.
 */
function injectRepositoryControls(app, root) {
  const navFilters = root.querySelector(".main nav.filters");
  if (!navFilters || root.querySelector("#repo-source-group")) return;

  const repoWrapper = document.createElement("div");
  repoWrapper.id = "repo-source-group";
  repoWrapper.className = "controls split-button noflex";

  repoWrapper.innerHTML = `
    <button type="button" class="ui-control" data-repo="official" aria-pressed="${app.selectedRepo === "official"}">
      <i class="fa-solid fa-globe"></i> Official
    </button>
    <button type="button" class="ui-control" data-repo="custom" aria-pressed="${app.selectedRepo === "custom"}">
      <i class="fa-solid fa-boxes-stacked"></i> Custom
    </button>
    <button type="button" class="ui-control" id="custom-repo-manage-trigger" title="Manage Repositories">
      <i class="fa-solid fa-gear"></i>
    </button>
  `;

  const existingControls = navFilters.querySelector(".controls:not(#repo-source-group)");
  if (existingControls) {
    navFilters.insertBefore(repoWrapper, existingControls);
  } else {
    navFilters.appendChild(repoWrapper);
  }

  const manageBtn = repoWrapper.querySelector("#custom-repo-manage-trigger");
  if (manageBtn) {
    manageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRepositoryManager(app);
    });
  }

  repoWrapper.querySelectorAll("button[data-repo]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const mode = btn.dataset.repo;
      if (app.selectedRepo === mode) return;

      app.selectedRepo = mode;
      repoWrapper.querySelectorAll("button[data-repo]").forEach(b => {
        b.setAttribute("aria-pressed", b.dataset.repo === mode ? "true" : "false");
      });

      const langFilter = root.querySelector("#install-package-language-group");
      if (langFilter) langFilter.style.display = mode === "custom" ? "" : "none";

      if (mode === "custom") {
        if (app._filterState) {
          app._filterState.categories = new Map([["archived", -1]]);
          app._filterState.visibility = "all";
        }
        const searchInput = root.querySelector("aside input[type=search], input[type=search]");
        if (searchInput) searchInput.value = "";

        const langSelect = root.querySelector("#install-package-language-select");
        if (langSelect) langSelect.value = "";

        await renderCustomPackages(app, { forceFetch: true });
      } else {
        app.render({ force: true });
      }
    });
  });
}

/* -------------------------------------------- */
/*  Main Render Pipeline                        */
/* -------------------------------------------- */

/**
 * Orchestrates filtering and rendering of custom repository packages.
 * @param {foundry.applications.api.ApplicationV2} app - The InstallPackage application instance.
 * @param {{ forceFetch?: boolean }} [options={}] - Render options.
 * @returns {Promise<void>}
 */
async function renderCustomPackages(app, { forceFetch = false } = {}) {
  const root = app.element;
  if (!root) return;

  const packageList = root.querySelector(".categories .package-list");
  if (!packageList) return;

  bindPackageListEvents(app, packageList, root);
  bindSearchInput(app, root);

  const repos = getStoredRepositories();
  const enabledRepos = repos.filter(r => r.enabled !== false);

  if (!enabledRepos.length) {
    updateCategorySidebar(root, [], [], app._filterState?.categories);
    packageList.innerHTML = `
      <div class="notice center" style="padding: 40px; text-align: center; color: var(--color-text-subtle);">
        <i class="fa-solid fa-boxes-stacked fa-2x" style="color: var(--color-level-warning);"></i>
        <p style="margin: 10px 0 4px; font-size: 14px; font-weight: 500;">No custom repositories are enabled.</p>
        <p class="hint">Enable existing repositories or add new ones in repository settings.</p>
        <div style="margin-top: 14px;">
          <button type="button" class="open-repo-manager-empty-btn">
            <i class="fa-solid fa-gear"></i> <span>Manage Repositories</span>
          </button>
        </div>
      </div>
    `;
    const openBtn = packageList.querySelector(".open-repo-manager-empty-btn");
    if (openBtn) openBtn.onclick = () => openRepositoryManager(app);
    return;
  }

  if (!cachedRawPackages || forceFetch) {
    packageList.innerHTML = `
      <div class="notice center" style="padding: 40px; text-align: center; color: var(--color-text-subtle);">
        <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
        <p class="hint" style="margin-top: 10px;">Loading custom repositories...</p>
      </div>
    `;
  }

  try {
    const rawPackages = await fetchCustomPackages(forceFetch);
    const currentTab = app.tabGroups?.primary || "modules";
    const targetType = currentTab.replace(/s$/, "");

    if (app._previousCustomTab && app._previousCustomTab !== currentTab) {
      if (app._filterState) {
        app._filterState.categories = new Map([["archived", -1]]);
        app._filterState.visibility = "all";
      }
      const searchInput = root.querySelector("aside input[type=search], input[type=search]");
      if (searchInput) searchInput.value = "";
      const langSelect = root.querySelector("#install-package-language-select");
      if (langSelect) langSelect.value = "";
    }
    app._previousCustomTab = currentTab;

    const tabPackages = rawPackages.filter(p => !p.type || p.type === targetType);

    injectLanguageFilter(app, root, tabPackages);

    if (!tabPackages.length) {
      updateCategorySidebar(root, [], [], app._filterState?.categories);
      packageList.innerHTML = `
        <div class="notice center" style="padding: 40px; text-align: center; color: var(--color-text-subtle);">
          <i class="fa-solid fa-box-open fa-2x"></i>
          <p class="hint" style="margin-top: 10px;">No packages of type <b>${targetType}</b> found in the enabled repositories.</p>
        </div>
      `;
      return;
    }

    const installedMap = (targetType === "module" ? game?.modules : (targetType === "world" ? game?.worlds : game?.systems))
      || new Map();

    const preparedPackages = tabPackages.map(pkg => {
      const id = pkg.id || pkg.name;
      const author = Array.isArray(pkg.authors) ? pkg.authors.map(a => a.name).join(", ") : "Unknown";
      const verifiedVer = pkg.compatibility?.verified || "14";
      const installedPkg = installedMap.get(id);
      const isInstalled = Boolean(installedPkg);

      let hasUpdate = false;
      if (isInstalled && installedPkg.version && pkg.version) {
        try {
          hasUpdate = foundry.utils.isNewerVersion(pkg.version, installedPkg.version);
        } catch {
          hasUpdate = pkg.version !== installedPkg.version;
        }
      }

      let langCodes = [];
      let languagesDisplay = [];
      if (Array.isArray(pkg.languages) && pkg.languages.length > 0) {
        langCodes = pkg.languages
          .map(l => (typeof l === "object" ? l.lang : l))
          .filter(Boolean)
          .map(code => code.toLowerCase());
        languagesDisplay = langCodes.map(code => getLanguageLabel(code));
      }

      const tags = (pkg.tags && pkg.tags.length) ? pkg.tags : ["content"];
      const systems = pkg.systems || [];
      const title = pkg.title || id;
      const description = pkg.description || "";
      const repoName = pkg._repoName || "Custom Repository";
      const repoId = pkg._repoId || "";
      const repoAuthor = pkg._repoAuthor || "";
      const repoSite = pkg._repoSite || "";

      const searchText = `${title} ${description} ${author} ${id} ${tags.join(" ")} ${systems.join(" ")} ${langCodes.join(" ")} ${repoName} ${repoId} ${repoAuthor}`.toLowerCase();

      return {
        id,
        title,
        url: pkg.url || "",
        manifest: pkg.manifest,
        type: pkg.type || targetType,
        version: pkg.version,
        description,
        authorName: author,
        verifiedVer,
        badgeType: String(verifiedVer).startsWith("14") ? "success" : "warning",
        tags,
        tagsString: tags.join(" "),
        systems,
        systemsString: systems.join(" "),
        langCodes,
        languagesString: langCodes.join(" "),
        languagesDisplay,
        repoName,
        repoId,
        repoAuthor,
        repoSite,
        isInstalled,
        localVersion: installedPkg?.version || "",
        hasUpdate,
        searchText
      };
    });

    const searchInput = root.querySelector("aside input[type=search], input[type=search]");
    const searchQuery = (searchInput?.value || "").toLowerCase().trim();

    const visibility = app._filterState?.visibility || "all";

    const includedCategories = [];
    const excludedCategories = [];
    if (app._filterState?.categories) {
      for (const [catId, state] of app._filterState.categories) {
        if (catId === "all") continue;
        if (state > 0) includedCategories.push(catId);
        else if (state < 0) excludedCategories.push(catId);
      }
    }

    const langSelect = root.querySelector("#install-package-language-select");
    const activeLang = (langSelect?.value || "").toLowerCase();

    const matchingPackages = preparedPackages.filter(pkg => {
      if (!matchesVisibility(pkg.isInstalled, visibility)) return false;
      if (!matchesCategory(pkg.tags, includedCategories, excludedCategories)) return false;
      if (!matchesSystems(pkg.systems, app._filterState?.systems)) return false;
      if (!matchesLanguage(pkg.langCodes, activeLang)) return false;
      if (!matchesSearch(pkg, searchQuery)) return false;
      return true;
    });

    updateCategorySidebar(root, tabPackages, matchingPackages, app._filterState?.categories);

    root.querySelectorAll('.main nav.filters button[data-action="filterVisibility"], .main nav.filters button[data-filter]').forEach(btn => {
      const f = btn.dataset.filter;
      if (f) btn.setAttribute("aria-pressed", f === visibility ? "true" : "false");
    });

    if (!matchingPackages.length) {
      packageList.innerHTML = `
        <div class="notice center" style="padding: 40px; text-align: center; color: var(--color-text-subtle);">
          <i class="fa-solid fa-filter-circle-xmark fa-2x"></i>
          <p class="hint" style="margin-top: 10px;">No matching packages found.</p>
        </div>
      `;
      return;
    }

    const renderCard = await loadCardTemplate();
    packageList.innerHTML = renderCard({ packages: matchingPackages });

  } catch (err) {
    console.error("Custom Repo Error:", err);
    packageList.innerHTML = `
      <div class="notice center" style="padding: 20px; color: var(--color-level-error); text-align: center;">
        <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
        <p style="margin-top: 10px;">Error loading repositories: ${err.message}</p>
        <div style="margin-top: 10px;">
          <button type="button" class="open-repo-manager-err-btn">
            <i class="fa-solid fa-gear"></i> <span>Manage Repositories</span>
          </button>
        </div>
      </div>
    `;
    const openBtn = packageList.querySelector(".open-repo-manager-err-btn");
    if (openBtn) openBtn.onclick = () => openRepositoryManager(app);
  }
}

/* -------------------------------------------- */
/*  ApplicationV2 Hook & Prototype Patch        */
/* -------------------------------------------- */

/**
 * Patches Foundry VTT v14 InstallPackage ApplicationV2 instance to support custom package repositories.
 * Hooks into ApplicationV2 prototype `_onRender`, `_applyFilters`, and `search`.
 */
function patchV14Installer() {
  const activeInstaller = Array.from(foundry?.applications?.instances?.values() || [])
    .find(app => app.options?.id === "install-package");

  const TargetClass = activeInstaller?.constructor
    || foundry?.applications?.setup?.PackageInstaller
    || foundry?.applications?.setup?.InstallPackage;

  if (!TargetClass) {
    setTimeout(patchV14Installer, 100);
    return;
  }

  if (TargetClass.prototype._customRepoPatched) return;
  TargetClass.prototype._customRepoPatched = true;

  const originalOnRender = TargetClass.prototype._onRender;
  TargetClass.prototype._onRender = async function (context, options) {
    if (originalOnRender) await originalOnRender.call(this, context, options);

    const root = this.element;
    if (!root) return;

    if (!this.selectedRepo) this.selectedRepo = "official";

    injectRepositoryControls(this, root);

    if (this.selectedRepo === "custom") {
      await renderCustomPackages(this);
    }
  };

  const originalApplyFilters = TargetClass.prototype._applyFilters;
  TargetClass.prototype._applyFilters = function () {
    if (this.selectedRepo === "custom") {
      return renderCustomPackages(this);
    }
    return originalApplyFilters.call(this);
  };

  const originalSearch = TargetClass.prototype.search;
  TargetClass.prototype.search = function (query) {
    if (this.selectedRepo === "custom") {
      const input = this.element?.querySelector("aside input[type=search], input[type=search]");
      if (input) input.value = query;
      return renderCustomPackages(this);
    }
    return originalSearch.call(this, query);
  };

  if (activeInstaller) {
    activeInstaller._applyFilters = TargetClass.prototype._applyFilters;
    activeInstaller.search = TargetClass.prototype.search;
    if (activeInstaller.element && activeInstaller.selectedRepo === "custom") {
      renderCustomPackages(activeInstaller);
    }
  }

  console.log("Custom Repo: Multi-repository installer patch successfully initialized.");
}

patchV14Installer();