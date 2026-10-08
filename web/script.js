/**
 * Foundry VTT Custom Repository Builder (CRM-FVTT)
 * Client-side Controller & Manifest Parser with Bilingual (uk / en) Support
 */

// 1. CONSTANTS & CONFIGURATION
const OFFICIAL_FOUNDRY_TAGS = [
  "automation", "combat", "visuals", "tools", "translation",
  "dice", "sheets", "audio", "chat", "importer", "content",
  "integration", "journal", "overhaul", "patches", "adventures",
  "ai-tools", "ai-content", "zero-ai", "paid-features", "premium",
  "exclusive", "analytics", "archived"
];

const COMMON_LANGUAGES = ["en", "uk", "ru", "de", "fr", "es", "it", "pl", "ja", "zh", "pt-br", "cs", "ko"];

const STORAGE_KEY = "crm_fvtt_repo_draft_v1";
const LANG_STORAGE_KEY = "crm_fvtt_lang";

// Default Initial State
const defaultRepositoryState = {
  id: "my-custom-repo",
  version: "1.0.0",
  name: "My Custom Repository",
  description: "Каталог пакетів та модулів для Foundry VTT",
  author: "Community",
  site: "https://example.com",
  cover: "https://api.dicebear.com/10.x/blobs/svg?tags=animation&seed=my-custom-repo",
  social: [
    { name: "Discord", url: "https://discord.gg/example" }
  ],
  packages: []
};

// Global App State
var state = window.crmState = {
  repo: JSON.parse(JSON.stringify(defaultRepositoryState)),
  viewMode: "manage", // "manage" | "preview"
  typeFilter: "all",  // "all" | "module" | "system" | "world"
  searchQuery: "",
  activeManualTags: new Set(["tools"]),
  activeManualLangs: new Set(["en"]),
  editActiveTags: new Set()
};

// 2. INTERNATIONALIZATION (i18n) ENGINE
let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || "uk";
if (currentLang !== "uk" && currentLang !== "en") currentLang = "uk";
let translations = null;

async function loadTranslations() {
  try {
    const res = await fetch("./translations.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    translations = await res.json();
  } catch (err) {
    console.warn("Failed to load translations.json via fetch:", err);
  }
}

function t(key, params = {}) {
  if (!translations) return key;
  const dict = translations[currentLang] || translations["uk"] || translations["en"] || {};
  const parts = key.split(".");
  let val = dict;
  for (const p of parts) {
    if (val && typeof val === "object" && p in val) {
      val = val[p];
    } else {
      val = null;
      break;
    }
  }

  // Fallback to English if key missing in current language
  if (typeof val !== "string") {
    const fallbackDict = translations["en"] || {};
    let fVal = fallbackDict;
    for (const p of parts) {
      if (fVal && typeof fVal === "object" && p in fVal) {
        fVal = fVal[p];
      } else {
        fVal = null;
        break;
      }
    }
    if (typeof fVal === "string") val = fVal;
    else return key;
  }

  let res = val;
  for (const [k, v] of Object.entries(params)) {
    res = res.replaceAll(`{${k}}`, v);
  }
  return res;
}

function applyLanguage(lang) {
  if (lang !== "uk" && lang !== "en") return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (e) {
    console.warn("Could not save language to LocalStorage:", e);
  }

  document.documentElement.lang = lang;
  if (translations) {
    document.title = t("meta.pageTitle");
  }

  // Update language switcher buttons in header
  const btnUk = document.getElementById("lang-btn-uk");
  const btnEn = document.getElementById("lang-btn-en");
  if (btnUk && btnEn) {
    if (lang === "uk") {
      btnUk.className = "flex items-center gap-1.5 bg-amber-500 shadow-sm px-2.5 py-1 rounded-md font-semibold text-slate-950 text-xs transition lang-switch-btn active";
      btnEn.className = "flex items-center gap-1.5 hover:bg-foundry-800 px-2.5 py-1 rounded-md font-medium text-slate-400 hover:text-slate-200 text-xs transition lang-switch-btn";
    } else {
      btnEn.className = "flex items-center gap-1.5 bg-amber-500 shadow-sm px-2.5 py-1 rounded-md font-semibold text-slate-950 text-xs transition lang-switch-btn active";
      btnUk.className = "flex items-center gap-1.5 hover:bg-foundry-800 px-2.5 py-1 rounded-md font-medium text-slate-400 hover:text-slate-200 text-xs transition lang-switch-btn";
    }
  }

  // Update DOM elements with data-i18n attributes
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const k = el.getAttribute("data-i18n");
    el.textContent = t(k);
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const k = el.getAttribute("data-i18n-html");
    el.innerHTML = t(k);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const k = el.getAttribute("data-i18n-placeholder");
    el.placeholder = t(k);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const k = el.getAttribute("data-i18n-title");
    el.title = t(k);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
    const k = el.getAttribute("data-i18n-aria-label");
    el.setAttribute("aria-label", t(k));
  });

  // Re-render components that have dynamic text
  initSocialLinksUI();
  initLanguageChipsUI();
  renderAll();
}

function initLanguageSwitcher() {
  const btnUk = document.getElementById("lang-btn-uk");
  const btnEn = document.getElementById("lang-btn-en");
  if (btnUk) {
    btnUk.addEventListener("click", () => applyLanguage("uk"));
  }
  if (btnEn) {
    btnEn.addEventListener("click", () => applyLanguage("en"));
  }
}

function getPackageCountText(count) {
  if (currentLang === "uk") {
    let n = Math.abs(count) % 100;
    let n1 = n % 10;
    let word = t("packages.pkgNounMany");
    if (n < 10 || n > 20) {
      if (n1 === 1) word = t("packages.pkgNounOne");
      else if (n1 >= 2 && n1 <= 4) word = t("packages.pkgNounFew");
    }
    return `${count} ${word}`;
  } else {
    return `${count} ${count === 1 ? t("packages.pkgNounOne") : t("packages.pkgNounMany")}`;
  }
}

function getPackageNoun(count) {
  if (currentLang === "uk") {
    let n = Math.abs(count) % 100;
    let n1 = n % 10;
    if (n >= 10 && n <= 20) return t("packages.pkgNounMany");
    if (n1 === 1) return t("packages.pkgNounOne");
    if (n1 >= 2 && n1 <= 4) return t("packages.pkgNounFew");
    return t("packages.pkgNounMany");
  } else {
    return count === 1 ? t("packages.pkgNounOne") : t("packages.pkgNounMany");
  }
}

function getMissingManifestNoun(count) {
  if (currentLang === "uk") {
    let n = Math.abs(count) % 100;
    let n1 = n % 10;
    if (n >= 10 && n <= 20) return t("export.missingManifestNounMany");
    if (n1 === 1) return t("export.missingManifestNounOne");
    if (n1 >= 2 && n1 <= 4) return t("export.missingManifestNounFew");
    return t("export.missingManifestNounMany");
  } else {
    return count === 1 ? t("export.missingManifestNounOne") : t("export.missingManifestNounMany");
  }
}

// 3. INITIALIZATION
document.addEventListener("DOMContentLoaded", async () => {
  await loadTranslations();
  initLanguageSwitcher();
  loadFromLocalStorage();
  initFormBindings();
  initSocialLinksUI();
  initTagsUI();
  initLanguageChipsUI();
  initDragAndDrop();
  initDirectImportHandlers();
  initManualFormHandler();
  initModalHandlers();
  initToolbarHandlers();

  // URL parameters support (e.g. ?view=preview or ?lang=en)
  const params = new URLSearchParams(window.location.search);
  if (params.has("lang") && (params.get("lang") === "uk" || params.get("lang") === "en")) {
    currentLang = params.get("lang");
  }
  if (params.get("view") === "preview") {
    state.viewMode = "preview";
    const previewBtn = document.getElementById("view-mode-preview");
    const manageBtn = document.getElementById("view-mode-manage");
    if (previewBtn && manageBtn) {
      previewBtn.className = "px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 bg-amber-500 text-slate-950 font-semibold shadow";
      manageBtn.className = "px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 text-slate-400 hover:text-slate-200";
    }
  }

  applyLanguage(currentLang);
});

// 4. STORAGE & PERSISTENCE
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.repo));
  } catch (e) {
    console.warn("Failed to save state to LocalStorage:", e);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        state.repo = Object.assign({}, defaultRepositoryState, parsed);
        if (!Array.isArray(state.repo.packages)) state.repo.packages = [];
        if (!Array.isArray(state.repo.social)) state.repo.social = [];
        // Migrate old Russian default placeholder descriptions if present
        if (state.repo.description === "Пользовательский каталог пакетов и модулей для Foundry VTT" ||
          state.repo.description === "Каталог пакетов и модулей для Foundry VTT") {
          state.repo.description = t("repo.defaultDesc");
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load draft from LocalStorage:", e);
    state.repo = JSON.parse(JSON.stringify(defaultRepositoryState));
  }
}

// 5. METADATA FORM BINDINGS
function initFormBindings() {
  const repoIdInput = document.getElementById("repo-id");
  const repoNameInput = document.getElementById("repo-name");
  const repoVerInput = document.getElementById("repo-version");
  const repoAuthorInput = document.getElementById("repo-author");
  const repoSiteInput = document.getElementById("repo-site");
  const repoCoverInput = document.getElementById("repo-cover");
  const repoDescInput = document.getElementById("repo-description");
  const repoCoverPreview = document.getElementById("repo-cover-preview");

  // Sync inputs with state
  repoIdInput.value = state.repo.id || "";
  repoNameInput.value = state.repo.name || "";
  repoVerInput.value = state.repo.version || "1.0.0";
  repoAuthorInput.value = state.repo.author || "";
  repoSiteInput.value = state.repo.site || "";
  repoCoverInput.value = state.repo.cover || "";
  repoDescInput.value = state.repo.description || "";
  if (state.repo.cover) {
    repoCoverPreview.src = state.repo.cover;
  }

  // Event Listeners
  repoIdInput.addEventListener("input", (e) => {
    state.repo.id = e.target.value.trim();
    saveToLocalStorage();
    renderLiveJson();
  });

  repoNameInput.addEventListener("input", (e) => {
    state.repo.name = e.target.value;
    // Auto slug ID if repo-id is blank or default
    if (!state.repo.id || state.repo.id === "my-custom-repo") {
      const slug = slugify(e.target.value);
      if (slug) {
        state.repo.id = slug;
        repoIdInput.value = slug;
      }
    }
    saveToLocalStorage();
    renderLiveJson();
    if (state.viewMode === "preview") renderPackages();
  });

  repoVerInput.addEventListener("input", (e) => {
    state.repo.version = e.target.value.trim();
    saveToLocalStorage();
    renderLiveJson();
  });

  repoAuthorInput.addEventListener("input", (e) => {
    state.repo.author = e.target.value;
    saveToLocalStorage();
    renderLiveJson();
    if (state.viewMode === "preview") renderPackages();
  });

  repoSiteInput.addEventListener("input", (e) => {
    state.repo.site = e.target.value.trim();
    saveToLocalStorage();
    renderLiveJson();
  });

  repoCoverInput.addEventListener("input", (e) => {
    state.repo.cover = e.target.value.trim();
    repoCoverPreview.src = state.repo.cover || "https://api.dicebear.com/10.x/blobs/svg?tags=animation&seed=crm-repo";
    saveToLocalStorage();
    renderLiveJson();
  });

  repoDescInput.addEventListener("input", (e) => {
    state.repo.description = e.target.value;
    saveToLocalStorage();
    renderLiveJson();
  });

  // Random DiceBear Avatar
  document.getElementById("btn-random-avatar").addEventListener("click", () => {
    const seed = "repo-" + Math.random().toString(36).substring(2, 9);
    const newCover = `https://api.dicebear.com/10.x/blobs/svg?tags=animation&seed=${seed}`;
    state.repo.cover = newCover;
    repoCoverInput.value = newCover;
    repoCoverPreview.src = newCover;
    saveToLocalStorage();
    renderLiveJson();
    showToast(t("repo.newAvatarToast"), "info");
  });

  // Reset metadata
  document.getElementById("btn-reset-repo").addEventListener("click", () => {
    if (confirm(t("repo.resetConfirm"))) {
      state.repo.id = "my-custom-repo";
      state.repo.name = "My Custom Repository";
      state.repo.version = "1.0.0";
      state.repo.description = t("repo.defaultDesc");
      state.repo.author = "Community";
      state.repo.site = "";
      state.repo.cover = "https://api.dicebear.com/10.x/blobs/svg?tags=animation&seed=my-custom-repo";
      state.repo.social = [];

      initFormBindings();
      initSocialLinksUI();
      saveToLocalStorage();
      renderLiveJson();
      showToast(t("repo.resetToast"), "info");
    }
  });
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

// 6. SOCIAL LINKS MANAGEMENT
function initSocialLinksUI() {
  const container = document.getElementById("social-links-list");
  if (!container) return;
  container.innerHTML = "";

  if (!state.repo.social || state.repo.social.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-500 italic py-1">${t("repo.socialEmpty")}</div>`;
  } else {
    state.repo.social.forEach((link, idx) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 bg-foundry-950/70 p-2 rounded-lg border border-foundry-border";
      row.innerHTML = `
        <input type="text" placeholder="${escapeHtml(t("repo.socialNamePlaceholder"))}" value="${escapeHtml(link.name || "")}"
          class="social-name w-1/3 bg-foundry-900 border border-foundry-border rounded px-2 py-1 text-xs text-slate-100 outline-none">
        <input type="url" placeholder="${escapeHtml(t("repo.socialUrlPlaceholder"))}" value="${escapeHtml(link.url || "")}"
          class="social-url flex-1 bg-foundry-900 border border-foundry-border rounded px-2 py-1 text-xs text-slate-100 outline-none font-mono">
        <button type="button" class="btn-remove-social text-slate-500 hover:text-red-400 p-1.5 rounded transition" data-index="${idx}" title="${escapeHtml(t("repo.removeSocialTitle"))}">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      `;

      row.querySelector(".social-name").addEventListener("input", (e) => {
        state.repo.social[idx].name = e.target.value;
        saveToLocalStorage();
        renderLiveJson();
      });

      row.querySelector(".social-url").addEventListener("input", (e) => {
        state.repo.social[idx].url = e.target.value.trim();
        saveToLocalStorage();
        renderLiveJson();
      });

      row.querySelector(".btn-remove-social").addEventListener("click", () => {
        state.repo.social.splice(idx, 1);
        initSocialLinksUI();
        saveToLocalStorage();
        renderLiveJson();
      });

      container.appendChild(row);
    });
  }

  const addBtn = document.getElementById("btn-add-social");
  if (addBtn) {
    addBtn.onclick = () => {
      if (!Array.isArray(state.repo.social)) state.repo.social = [];
      state.repo.social.push({ name: "Discord", url: "https://discord.gg/" });
      initSocialLinksUI();
      saveToLocalStorage();
      renderLiveJson();
    };
  }
}

// 7. TAGS & LANGUAGES SELECTION
function initTagsUI() {
  const container = document.getElementById("foundry-tags-selector");
  if (!container) return;
  container.innerHTML = "";

  OFFICIAL_FOUNDRY_TAGS.forEach(tag => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = state.activeManualTags.has(tag);
    btn.className = `tag-pill px-2.5 py-1 rounded-md text-xs font-medium border transition ${isActive
      ? "bg-amber-500 text-slate-950 border-amber-400 font-semibold shadow-sm"
      : "bg-foundry-900 text-slate-300 border-foundry-border hover:border-slate-500 hover:text-white"
      }`;
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      if (state.activeManualTags.has(tag)) {
        state.activeManualTags.delete(tag);
        btn.className = "tag-pill px-2.5 py-1 rounded-md text-xs font-medium border transition bg-foundry-900 text-slate-300 border-foundry-border hover:border-slate-500 hover:text-white";
      } else {
        state.activeManualTags.add(tag);
        btn.className = "tag-pill px-2.5 py-1 rounded-md text-xs font-medium border transition bg-amber-500 text-slate-950 border-amber-400 font-semibold shadow-sm";
      }
    });
    container.appendChild(btn);
  });
}

function initLanguageChipsUI() {
  const container = document.getElementById("pkg-languages-chips");
  const input = document.getElementById("pkg-custom-lang");
  const addBtn = document.getElementById("btn-add-lang-manual");
  if (!container || !input || !addBtn) return;

  function renderLangs() {
    container.innerHTML = "";
    if (state.activeManualLangs.size === 0) {
      container.innerHTML = `<span class="text-[11px] text-slate-500 italic">${t("addPkg.noLanguagesSelected")}</span>`;
      return;
    }
    state.activeManualLangs.forEach(lang => {
      const chip = document.createElement("span");
      chip.className = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-foundry-800 text-amber-300 border border-amber-500/30 text-xs font-mono";
      chip.innerHTML = `${lang} <button type="button" class="hover:text-red-400 text-slate-400 font-bold">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        state.activeManualLangs.delete(lang);
        renderLangs();
      });
      container.appendChild(chip);
    });
  }

  addBtn.onclick = () => {
    const val = input.value.trim().toLowerCase();
    if (val) {
      val.split(/[\s,]+/).forEach(code => {
        if (code) state.activeManualLangs.add(code);
      });
      input.value = "";
      renderLangs();
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBtn.click();
    }
  });

  renderLangs();
}

// 8. INTELLIGENT MANIFEST PARSER & NORMALIZER
function parseManifestToPackage(rawManifest) {
  if (!rawManifest || typeof rawManifest !== "object") {
    throw new Error(t("toast.manifestInvalid"));
  }

  // 1. ID & Title
  const id = (rawManifest.id || rawManifest.name || "").trim();
  if (!id) {
    throw new Error(t("toast.manifestMissingId"));
  }
  const title = rawManifest.title || rawManifest.name || id;

  // 2. Type Detection
  let type = "module";
  if (rawManifest.type && ["module", "system", "world"].includes(rawManifest.type)) {
    type = rawManifest.type;
  } else if (id.includes("system") || rawManifest.system) {
    type = "system";
  } else if (id.includes("world")) {
    type = "world";
  }

  // 3. Version
  const version = rawManifest.version || "1.0.0";

  // 4. Description
  const description = rawManifest.description || "";

  // 5. Compatibility
  let compatibility = {
    minimum: "13",
    verified: "14",
    maximum: "14"
  };

  if (rawManifest.compatibility && typeof rawManifest.compatibility === "object") {
    compatibility.minimum = rawManifest.compatibility.minimum || rawManifest.minimumCoreVersion || "13";
    compatibility.verified = rawManifest.compatibility.verified || rawManifest.compatibleCoreVersion || "14";
    compatibility.maximum = rawManifest.compatibility.maximum || "";
  } else {
    if (rawManifest.minimumCoreVersion) compatibility.minimum = String(rawManifest.minimumCoreVersion);
    if (rawManifest.compatibleCoreVersion) compatibility.verified = String(rawManifest.compatibleCoreVersion);
  }

  // 6. Authors Normalization
  let authors = [];
  const defaultAuthorName = currentLang === "uk" ? "Автор" : "Author";
  if (Array.isArray(rawManifest.authors) && rawManifest.authors.length > 0) {
    authors = rawManifest.authors.map(a => {
      if (typeof a === "object") {
        return {
          name: a.name || a.discord || a.email || defaultAuthorName,
          url: a.url || (a.email ? `mailto:${a.email}` : "") || (a.discord ? `https://discord.com` : "")
        };
      }
      return { name: String(a), url: "" };
    });
  } else if (rawManifest.author) {
    if (typeof rawManifest.author === "string") {
      authors = [{ name: rawManifest.author, url: "" }];
    } else if (typeof rawManifest.author === "object") {
      authors = [{ name: rawManifest.author.name || defaultAuthorName, url: rawManifest.author.url || "" }];
    }
  }
  if (authors.length === 0) {
    authors = [{ name: "Unknown", url: "" }];
  }

  // 7. URLs
  const manifest = rawManifest.manifest || "";
  const download = rawManifest.download || "";
  const url = rawManifest.url || "";

  // 8. Languages Extraction
  let languages = [];
  if (Array.isArray(rawManifest.languages) && rawManifest.languages.length > 0) {
    languages = rawManifest.languages
      .map(l => (typeof l === "object" ? l.lang : l))
      .filter(Boolean)
      .map(code => String(code).toLowerCase());
  }
  languages = Array.from(new Set(languages));
  if (languages.length === 0) languages = ["en"];

  // 9. Intelligent Tags Suggestion
  let tags = [];
  if (Array.isArray(rawManifest.tags) && rawManifest.tags.length > 0) {
    tags = rawManifest.tags.map(t => String(t).toLowerCase());
  } else {
    const searchCorpus = `${id} ${title} ${description}`.toLowerCase();

    if (/visual|particle|filter|token|drawing|3d|iso|light|effect|wall|canvas|map|icon/.test(searchCorpus)) {
      tags.push("visuals");
    }
    if (/automation|automate|macro|trigger|level|condition|turn|initiative/.test(searchCorpus)) {
      tags.push("automation");
    }
    if (/combat|fight|attack|damage|weapon|action/.test(searchCorpus)) {
      tags.push("combat");
    }
    if (/translation|language|lang|localization|locale/.test(searchCorpus)) {
      tags.push("translation");
    }
    if (/sheet|character|actor|item-sheet|hud|ui/.test(searchCorpus)) {
      tags.push("sheets");
    }
    if (/audio|sound|music|playlist|ambient/.test(searchCorpus)) {
      tags.push("audio");
    }
    if (/dice|roll|roller|3d-dice/.test(searchCorpus)) {
      tags.push("dice");
    }
    if (/socket|lib|library|tool|utility|helper|framework|api/.test(searchCorpus) || rawManifest.library) {
      tags.push("tools");
    }
    if (/chat|message|log|whisper/.test(searchCorpus)) {
      tags.push("chat");
    }
    if (/adventure|campaign|quest/.test(searchCorpus)) {
      tags.push("adventures");
    }
    if (/import|export|sync|converter/.test(searchCorpus)) {
      tags.push("importer");
    }
    if (/journal|note|compendium|handout/.test(searchCorpus)) {
      tags.push("journal");
    }
  }

  if (tags.length === 0) tags = ["tools"];
  tags = Array.from(new Set(tags));

  // 10. Relationships & Systems
  let relationships = {};
  if (rawManifest.relationships && typeof rawManifest.relationships === "object") {
    relationships = rawManifest.relationships;
  }
  let systems = [];
  if (rawManifest.relationships?.systems && Array.isArray(rawManifest.relationships.systems)) {
    systems = rawManifest.relationships.systems.map(s => s.id || s);
  } else if (rawManifest.system) {
    systems = [rawManifest.system];
  }

  return {
    id,
    name: id,
    type,
    title,
    description,
    version,
    compatibility,
    authors,
    url,
    manifest,
    download,
    languages,
    tags,
    relationships,
    systems
  };
}

// 9. ADD PACKAGE TO REPOSITORY
function addPackageToRepo(pkgData, { notify = true, allowOverwrite = false } = {}) {
  const existingIdx = state.repo.packages.findIndex(p => p.id === pkgData.id);

  if (existingIdx !== -1) {
    if (!allowOverwrite) {
      const confirmUpdate = confirm(t("toast.pkgExistsConfirm", { id: pkgData.id, version: pkgData.version }));
      if (!confirmUpdate) return false;
    }
    state.repo.packages[existingIdx] = pkgData;
    if (notify) showToast(t("toast.pkgUpdated", { title: pkgData.title }), "success");
  } else {
    state.repo.packages.push(pkgData);
    if (notify) showToast(t("toast.pkgAdded", { title: pkgData.title }), "success");
  }

  saveToLocalStorage();
  renderAll();
  return true;
}

// 10. DRAG & DROP & FILE HANDLING
function initDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-manifest-input");
  const browseBtn = document.getElementById("btn-browse-files");
  if (!dropZone || !fileInput || !browseBtn) return;

  browseBtn.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("click", (e) => {
    if (e.target !== browseBtn && !browseBtn.contains(e.target)) {
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      fileInput.value = "";
    }
  });

  // Drag Events
  ["dragenter", "dragover"].forEach(evtName => {
    dropZone.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("dropzone-active");
    });
  });

  ["dragleave", "drop"].forEach(evtName => {
    dropZone.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("dropzone-active");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFiles(Array.from(dt.files));
    }
  });
}

function handleFoundryBackup(json) {
  if (json.repositories && Array.isArray(json.repositories) && json.repositories.length > 0) {
    loadRepositoryObject(json.repositories[0]);
    showToast(t("toast.repoLoaded", {
      name: json.repositories[0].name || json.repositories[0].id,
      count: json.repositories[0].packages?.length || 0,
      noun: getPackageNoun(json.repositories[0].packages?.length || 0)
    }), "success");
  }
}

function handleFiles(files) {
  let importedCount = 0;
  let errors = [];

  const promises = files.map(file => {
    return new Promise((resolve) => {
      if (!file.name.endsWith(".json")) {
        errors.push(t("toast.notJsonFile", { name: file.name }));
        return resolve();
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          // Check if this is a repository.json backup
          if (json.repositories && Array.isArray(json.repositories)) {
            handleFoundryBackup(json);
            return resolve();
          }
          if (json.packages && Array.isArray(json.packages)) {
            // It's a repository.json file!
            loadRepositoryObject(json);
            showToast(t("toast.repoLoaded", {
              name: json.name || json.id,
              count: json.packages.length,
              noun: getPackageNoun(json.packages.length)
            }), "success");
            return resolve();
          }

          // Single manifest file
          const pkg = parseManifestToPackage(json);
          addPackageToRepo(pkg, { notify: false, allowOverwrite: true });
          importedCount++;
        } catch (err) {
          errors.push(t("toast.fileError", { name: file.name, err: err.message }));
        }
        resolve();
      };
      reader.onerror = () => {
        errors.push(t("toast.fileReadFail", { name: file.name }));
        resolve();
      };
      reader.readAsText(file);
    });
  });

  Promise.all(promises).then(() => {
    if (importedCount > 0) {
      showToast(t("toast.manifestsImported", { count: importedCount }), "success");
    }
    if (errors.length > 0) {
      showToast(errors[0], "error");
    }
  });
}

// 11. DIRECT MANIFEST IMPORT HANDLERS (URL & RAW JSON)
function initDirectImportHandlers() {
  // Fetch URL button
  const fetchUrlBtn = document.getElementById("btn-fetch-url");
  if (fetchUrlBtn) {
    fetchUrlBtn.addEventListener("click", async () => {
      const urlInput = document.getElementById("input-manifest-url");
      const url = urlInput.value.trim();
      if (!url) {
        showToast(t("toast.specifyUrlWarning"), "warning");
        return;
      }

      try {
        showToast(t("toast.loadingUrlInfo"), "info");
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        const data = await resp.json();
        const pkg = parseManifestToPackage(data);
        addPackageToRepo(pkg);
        urlInput.value = "";
      } catch (err) {
        showToast(t("toast.fetchUrlError", { err: err.message }), "error");
      }
    });
  }

  // Raw JSON parser button
  const parseRawBtn = document.getElementById("btn-parse-raw-manifest");
  if (parseRawBtn) {
    parseRawBtn.addEventListener("click", () => {
      const textarea = document.getElementById("textarea-raw-manifest");
      const raw = textarea.value.trim();
      if (!raw) {
        showToast(t("toast.pasteJsonWarning"), "warning");
        return;
      }

      try {
        const data = JSON.parse(raw);
        const pkg = parseManifestToPackage(data);
        addPackageToRepo(pkg);
        textarea.value = "";
      } catch (err) {
        showToast(t("toast.jsonSyntaxError", { err: err.message }), "error");
      }
    });
  }
}

// 12. MANUAL PACKAGE FORM HANDLER
function initManualFormHandler() {
  const manualForm = document.getElementById("form-manual-package");
  if (!manualForm) return;

  manualForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = document.getElementById("pkg-id").value.trim();
    const title = document.getElementById("pkg-title").value.trim();
    const type = document.getElementById("pkg-type").value;
    const version = document.getElementById("pkg-version").value.trim();

    const compatVerified = document.getElementById("pkg-compat-verified").value.trim() || "14";
    const compatMin = document.getElementById("pkg-compat-min").value.trim();
    const compatMax = document.getElementById("pkg-compat-max").value.trim();

    const manifestUrl = document.getElementById("pkg-manifest-url").value.trim();
    const downloadUrl = document.getElementById("pkg-download-url").value.trim();
    const projectUrl = document.getElementById("pkg-project-url").value.trim();

    const authorName = document.getElementById("pkg-author-name").value.trim();
    const desc = document.getElementById("pkg-desc").value.trim();

    const tags = Array.from(state.activeManualTags);
    const languages = Array.from(state.activeManualLangs);

    const newPkg = {
      id,
      name: id,
      type,
      title,
      description: desc,
      version,
      compatibility: {
        minimum: compatMin,
        verified: compatVerified,
        maximum: compatMax
      },
      authors: [
        { name: authorName || "Unknown", url: projectUrl }
      ],
      url: projectUrl,
      manifest: manifestUrl,
      download: downloadUrl,
      languages: languages.length > 0 ? languages : ["en"],
      tags: tags.length > 0 ? tags : ["tools"],
      relationships: {}
    };

    addPackageToRepo(newPkg);
    manualForm.reset();
    state.activeManualTags = new Set(["tools"]);
    state.activeManualLangs = new Set(["en"]);
    initTagsUI();
    initLanguageChipsUI();
  });
}

// 13. TAB SWITCHERS & TOOLBARS
function initToolbarHandlers() {
  const tabBtnImport = document.getElementById("tab-btn-import");
  const tabBtnManual = document.getElementById("tab-btn-manual");
  const panelImport = document.getElementById("panel-import");
  const panelManual = document.getElementById("panel-manual");

  if (tabBtnImport && tabBtnManual && panelImport && panelManual) {
    tabBtnImport.addEventListener("click", () => {
      tabBtnImport.className = "tab-btn active px-3.5 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-2 bg-amber-500 text-slate-950 shadow";
      tabBtnManual.className = "tab-btn px-3.5 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-slate-200 transition flex items-center gap-2";
      panelImport.classList.remove("hidden");
      panelManual.classList.add("hidden");
    });

    tabBtnManual.addEventListener("click", () => {
      tabBtnManual.className = "tab-btn active px-3.5 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-2 bg-amber-500 text-slate-950 shadow";
      tabBtnImport.className = "tab-btn px-3.5 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-slate-200 transition flex items-center gap-2";
      panelManual.classList.remove("hidden");
      panelImport.classList.add("hidden");
    });
  }

  // View Mode: Manage vs Foundry Preview
  const btnViewManage = document.getElementById("view-mode-manage");
  const btnViewPreview = document.getElementById("view-mode-preview");

  if (btnViewManage && btnViewPreview) {
    btnViewManage.addEventListener("click", () => {
      state.viewMode = "manage";
      btnViewManage.className = "px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 bg-amber-500 text-slate-950 font-semibold shadow";
      btnViewPreview.className = "px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 text-slate-400 hover:text-slate-200";
      renderPackages();
    });

    btnViewPreview.addEventListener("click", () => {
      state.viewMode = "preview";
      btnViewPreview.className = "px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 bg-amber-500 text-slate-950 font-semibold shadow";
      btnViewManage.className = "px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 text-slate-400 hover:text-slate-200";
      renderPackages();
    });
  }

  // Search Filter
  const searchInput = document.getElementById("search-packages-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderPackages();
    });
  }

  // Type Filter Pills
  const typeFilterBtns = document.querySelectorAll(".btn-filter-type");
  typeFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      typeFilterBtns.forEach(b => {
        b.className = "btn-filter-type px-2.5 py-1 text-xs font-medium rounded-md bg-foundry-800 text-slate-300 hover:text-slate-100 transition";
      });
      btn.className = "btn-filter-type active px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500 text-slate-950 transition font-semibold";
      state.typeFilter = btn.getAttribute("data-type-filter");
      renderPackages();
    });
  });

  // Clear all packages
  const clearAllBtn = document.getElementById("btn-clear-all-packages");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      if (state.repo.packages.length === 0) return;
      if (confirm(t("packages.clearConfirm", { count: state.repo.packages.length }))) {
        state.repo.packages = [];
        saveToLocalStorage();
        renderAll();
        showToast(t("packages.clearToast"), "info");
      }
    });
  }

  // Copy JSON Buttons
  const copyHandler = () => {
    const jsonStr = JSON.stringify(cleanRepositoryOutput(state.repo), null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast(t("toast.jsonCopied"), "success");
    }).catch(err => {
      showToast(t("toast.copyError", { err: err.message }), "error");
    });
  };

  const copyBtn = document.getElementById("btn-copy-json");
  const copyBtnNav = document.getElementById("btn-copy-json-nav");
  if (copyBtn) copyBtn.addEventListener("click", copyHandler);
  if (copyBtnNav) copyBtnNav.addEventListener("click", copyHandler);

  // Download JSON Buttons
  const downloadHandler = () => {
    const output = cleanRepositoryOutput(state.repo);
    const jsonStr = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "repository.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("toast.downloadSuccess"), "success");
  };

  const downloadBtn = document.getElementById("btn-download-json-bottom");
  const downloadBtnNav = document.getElementById("btn-download-repo-nav");
  if (downloadBtn) downloadBtn.addEventListener("click", downloadHandler);
  if (downloadBtnNav) downloadBtnNav.addEventListener("click", downloadHandler);
}

// 14. RENDER PACKAGES & LIVE JSON
function renderAll() {
  renderPackages();
  renderLiveJson();
}

function getFilteredPackages() {
  return state.repo.packages.filter(pkg => {
    // Type Filter
    if (state.typeFilter !== "all" && pkg.type !== state.typeFilter) {
      return false;
    }

    // Search Query
    if (state.searchQuery) {
      const q = state.searchQuery;
      const authorText = Array.isArray(pkg.authors) ? pkg.authors.map(a => a.name).join(" ") : "";
      const tagsText = Array.isArray(pkg.tags) ? pkg.tags.join(" ") : "";
      const fullText = `${pkg.title || ""} ${pkg.id || ""} ${pkg.description || ""} ${authorText} ${tagsText}`.toLowerCase();
      if (!fullText.includes(q)) return false;
    }

    return true;
  });
}

function renderPackages() {
  const container = document.getElementById("packages-container");
  if (!container) return;

  const emptyState = document.getElementById("packages-empty-state");
  const countBadge = document.getElementById("badge-package-count");

  if (countBadge) {
    countBadge.textContent = getPackageCountText(state.repo.packages.length);
  }

  if (state.repo.packages.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    if (container) container.innerHTML = "";
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  if (container) container.innerHTML = "";

  const filtered = getFilteredPackages();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-xs border border-dashed border-foundry-border rounded-lg">
        ${escapeHtml(t("packages.notFound"))}
      </div>
    `;
    return;
  }

  if (state.viewMode === "manage") {
    // MANAGEMENT LIST VIEW
    filtered.forEach((pkg) => {
      const realIndex = state.repo.packages.indexOf(pkg);
      const card = createManagePackageCard(pkg, realIndex);
      container.appendChild(card);
    });
  } else {
    // FOUNDRY VTT PREVIEW VIEW
    const previewGrid = document.createElement("div");
    previewGrid.className = "space-y-3";
    filtered.forEach((pkg) => {
      const previewCard = createFoundryPreviewCard(pkg);
      previewGrid.appendChild(previewCard);
    });
    container.appendChild(previewGrid);
  }
}

function createManagePackageCard(pkg, index) {
  const div = document.createElement("div");
  div.className = "bg-foundry-950/80 border border-foundry-border hover:border-slate-500 rounded-xl p-4 transition shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 group";

  const authorsText = Array.isArray(pkg.authors) ? pkg.authors.map(a => a.name).join(", ") : "Unknown";
  const verifiedVer = pkg.compatibility?.verified || "14";
  const isVerified14 = String(verifiedVer).startsWith("14");

  div.innerHTML = `
    <div class="flex-1 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold px-2 py-0.5 rounded bg-foundry-800 text-amber-400 uppercase tracking-wider font-mono">${pkg.type || "module"}</span>
        <h4 class="text-base font-bold text-white group-hover:text-amber-400 transition">${escapeHtml(pkg.title || pkg.id)}</h4>
        <span class="text-xs font-mono text-slate-400">id: ${escapeHtml(pkg.id)}</span>
        <span class="text-xs font-mono px-2 py-0.5 rounded bg-foundry-900 border border-foundry-border text-slate-300">v${escapeHtml(pkg.version || "1.0.0")}</span>
        
        <span class="text-xs px-2 py-0.5 rounded font-mono ${isVerified14
      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
    }">
          ${escapeHtml(t("packages.verified", { ver: verifiedVer }))}
        </span>
      </div>

      <p class="text-xs text-slate-300 line-clamp-2 max-w-3xl">
        ${escapeHtml(pkg.description || t("packages.noDesc"))}
      </p>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
        <span class="flex items-center gap-1.5">
          <i class="fa-solid fa-user text-slate-500 text-[11px]"></i>
          <span class="text-slate-300">${escapeHtml(authorsText)}</span>
        </span>

        ${pkg.languages && pkg.languages.length ? `
          <span class="flex items-center gap-1.5">
            <i class="fa-solid fa-language text-slate-500 text-[11px]"></i>
            <span class="text-slate-300 font-mono">${pkg.languages.join(", ")}</span>
          </span>
        ` : ""}

        ${pkg.tags && pkg.tags.length ? `
          <div class="flex items-center gap-1 flex-wrap">
            <i class="fa-solid fa-tag text-slate-500 text-[11px]"></i>
            ${pkg.tags.slice(0, 4).map(t => `<span class="bg-foundry-900 px-1.5 py-0.5 rounded text-[10px] text-slate-300 border border-foundry-border">${t}</span>`).join("")}
            ${pkg.tags.length > 4 ? `<span class="text-[10px] text-slate-500">+${pkg.tags.length - 4}</span>` : ""}
          </div>
        ` : ""}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 flex-shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 border-foundry-border/60">
      <button type="button" class="btn-edit-pkg p-2 rounded-lg bg-foundry-900 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-foundry-border transition" title="${escapeHtml(t("packages.editTitle"))}">
        <i class="fa-solid fa-pen text-xs"></i>
      </button>

      <button type="button" class="btn-clone-pkg p-2 rounded-lg bg-foundry-900 hover:bg-foundry-800 text-slate-300 border border-foundry-border transition" title="${escapeHtml(t("packages.cloneTitle"))}">
        <i class="fa-regular fa-clone text-xs"></i>
      </button>

      <button type="button" class="btn-delete-pkg p-2 rounded-lg bg-foundry-900 hover:bg-red-950/60 hover:text-red-400 text-slate-400 border border-foundry-border hover:border-red-500/40 transition" title="${escapeHtml(t("packages.deleteTitle"))}">
        <i class="fa-solid fa-trash-can text-xs"></i>
      </button>
    </div>
  `;

  // Bind Actions
  div.querySelector(".btn-edit-pkg").addEventListener("click", () => openEditModal(index));
  div.querySelector(".btn-clone-pkg").addEventListener("click", () => duplicatePackage(index));
  div.querySelector(".btn-delete-pkg").addEventListener("click", () => deletePackage(index));

  return div;
}

function createFoundryPreviewCard(pkg) {
  const card = document.createElement("div");
  card.className = "fvtt-card space-y-2 text-slate-200";

  const repoName = state.repo.name || "Custom Repository";
  const authorName = Array.isArray(pkg.authors) ? pkg.authors.map(a => a.name).join(", ") : "Unknown";
  const verifiedVer = pkg.compatibility?.verified || "14";
  const isVerified14 = String(verifiedVer).startsWith("14");

  card.innerHTML = `
    <!-- Card Top Header -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold text-white tracking-wide">${escapeHtml(pkg.title || pkg.id)}</span>
        ${pkg.url ? `
          <a href="${escapeHtml(pkg.url)}" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-amber-400 transition text-xs" title="${escapeHtml(t("packages.openProjectTitle"))}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        ` : ""}
      </div>

      <button type="button" class="fvtt-install-btn px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm">
        <i class="fa-solid fa-download text-[11px]"></i>
        <span>${escapeHtml(t("packages.installBtn"))}</span>
      </button>
    </div>

    <!-- Repo Badge -->
    <div class="flex items-center gap-2 -mt-1">
      <span class="fvtt-repo-badge px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5" title="${escapeHtml(t("packages.repoBadgeTitle", { name: repoName }))}">
        <i class="fa-solid fa-database text-[10px]"></i>
        <span>${escapeHtml(repoName)}</span>
      </span>
    </div>

    <!-- Description -->
    <p class="text-xs text-slate-300 leading-relaxed font-sans">
      ${escapeHtml(pkg.description || t("packages.noDesc"))}
    </p>

    <!-- Language Tags -->
    ${pkg.languages && pkg.languages.length ? `
      <div class="flex items-center gap-1.5 flex-wrap">
        ${pkg.languages.map(l => `
          <span class="fvtt-tag px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
            <i class="fa-solid fa-language text-[10px] text-slate-400"></i>
            <span>${escapeHtml(l.toUpperCase())}</span>
          </span>
        `).join("")}
      </div>
    ` : ""}

    <!-- Card Footer Tags Row -->
    <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-foundry-border/40 text-xs">
      ${pkg.manifest ? `
        <span class="text-amber-400/90 hover:underline cursor-pointer truncate max-w-xs text-[11px] font-mono" title="${escapeHtml(pkg.manifest)}">
          ${escapeHtml(pkg.manifest)}
        </span>
      ` : ""}

      <span class="fvtt-tag px-2 py-0.5 rounded text-[11px]">
        <i class="fa-regular fa-user text-[10px] mr-1 text-slate-400"></i>${escapeHtml(authorName)}
      </span>

      <span class="fvtt-tag px-2 py-0.5 rounded text-[11px] font-mono">
        v${escapeHtml(pkg.version || "1.0.0")}
      </span>

      <span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium ${isVerified14 ? 'fvtt-verified-badge' : 'fvtt-verified-warning'}">
        ${escapeHtml(t("packages.verified", { ver: verifiedVer }))}
      </span>
    </div>
  `;

  return card;
}

// 15. DUPLICATE & DELETE PACKAGE
function duplicatePackage(index) {
  const orig = state.repo.packages[index];
  if (!orig) return;

  const clone = JSON.parse(JSON.stringify(orig));
  clone.id = `${clone.id}-copy`;
  clone.name = clone.id;
  clone.title = `${clone.title} (${t("packages.copySuffix")})`;

  state.repo.packages.splice(index + 1, 0, clone);
  saveToLocalStorage();
  renderAll();
  showToast(t("packages.cloneToast", { title: clone.title }), "info");
}

function deletePackage(index) {
  const pkg = state.repo.packages[index];
  if (!pkg) return;

  if (confirm(t("packages.deleteConfirm", { title: pkg.title || pkg.id }))) {
    state.repo.packages.splice(index, 1);
    saveToLocalStorage();
    renderAll();
    showToast(t("packages.deleteToast"), "info");
  }
}

// 16. EDIT MODAL
function initModalHandlers() {
  const editModal = document.getElementById("modal-edit-package");
  const editForm = document.getElementById("form-edit-package");

  document.getElementById("btn-close-edit-modal").addEventListener("click", () => editModal.close());
  document.getElementById("btn-cancel-edit-modal").addEventListener("click", () => editModal.close());

  editForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById("edit-pkg-index").value, 10);
    if (isNaN(index) || !state.repo.packages[index]) return;

    const id = document.getElementById("edit-pkg-id").value.trim();
    const title = document.getElementById("edit-pkg-title").value.trim();
    const type = document.getElementById("edit-pkg-type").value;
    const version = document.getElementById("edit-pkg-version").value.trim();

    const min = document.getElementById("edit-pkg-compat-min").value.trim();
    const ver = document.getElementById("edit-pkg-compat-verified").value.trim();
    const max = document.getElementById("edit-pkg-compat-max").value.trim();

    const manifest = document.getElementById("edit-pkg-manifest").value.trim();
    const download = document.getElementById("edit-pkg-download").value.trim();
    const url = document.getElementById("edit-pkg-url").value.trim();

    const author = document.getElementById("edit-pkg-author").value.trim();
    const desc = document.getElementById("edit-pkg-desc").value.trim();

    const langsRaw = document.getElementById("edit-pkg-languages").value.trim();
    const languages = langsRaw.split(/[\s,]+/).map(c => c.trim().toLowerCase()).filter(Boolean);

    state.repo.packages[index] = {
      id,
      name: id,
      type,
      title,
      description: desc,
      version,
      compatibility: { minimum: min, verified: ver, maximum: max },
      authors: [{ name: author || "Unknown", url }],
      url,
      manifest,
      download,
      languages: languages.length ? languages : ["en"],
      tags: Array.from(state.editActiveTags),
      relationships: state.repo.packages[index].relationships || {}
    };

    saveToLocalStorage();
    renderAll();
    editModal.close();
    showToast(t("editModal.savedToast"), "success");
  });

  // Import Repo Modal
  const importRepoModal = document.getElementById("modal-import-repo");
  document.getElementById("btn-import-repo-modal").addEventListener("click", () => {
    importRepoModal.showModal();
  });
  document.getElementById("btn-close-import-repo-modal").addEventListener("click", () => importRepoModal.close());
  document.getElementById("btn-cancel-import-repo").addEventListener("click", () => importRepoModal.close());

  document.getElementById("btn-submit-import-repo").addEventListener("click", () => {
    const textarea = document.getElementById("textarea-import-repo");
    const text = textarea.value.trim();
    if (!text) {
      showToast(t("importModal.emptyWarning"), "warning");
      return;
    }
    try {
      const data = JSON.parse(text);
      loadRepositoryObject(data);
      textarea.value = "";
      importRepoModal.close();
      showToast(t("importModal.successToast"), "success");
    } catch (e) {
      showToast(t("importModal.jsonSyntaxError", { err: e.message }), "error");
    }
  });

  // Dropzone inside Import Repo Modal
  const repoDropzone = document.getElementById("repo-file-dropzone");
  const repoFileInput = document.getElementById("input-repo-file");
  repoDropzone.addEventListener("click", () => repoFileInput.click());
  repoFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          loadRepositoryObject(data);
          importRepoModal.close();
          showToast(t("importModal.fileSuccessToast"), "success");
        } catch (err) {
          showToast(t("importModal.fileReadError", { err: err.message }), "error");
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  });
}

function openEditModal(index) {
  const pkg = state.repo.packages[index];
  if (!pkg) return;

  const modal = document.getElementById("modal-edit-package");
  document.getElementById("edit-pkg-index").value = index;

  document.getElementById("edit-pkg-id").value = pkg.id || "";
  document.getElementById("edit-pkg-title").value = pkg.title || "";
  document.getElementById("edit-pkg-type").value = pkg.type || "module";
  document.getElementById("edit-pkg-version").value = pkg.version || "1.0.0";

  document.getElementById("edit-pkg-compat-min").value = pkg.compatibility?.minimum || "";
  document.getElementById("edit-pkg-compat-verified").value = pkg.compatibility?.verified || "14";
  document.getElementById("edit-pkg-compat-max").value = pkg.compatibility?.maximum || "";

  document.getElementById("edit-pkg-manifest").value = pkg.manifest || "";
  document.getElementById("edit-pkg-download").value = pkg.download || "";
  document.getElementById("edit-pkg-url").value = pkg.url || "";

  const authorName = Array.isArray(pkg.authors) ? pkg.authors.map(a => a.name).join(", ") : (pkg.author || "");
  document.getElementById("edit-pkg-author").value = authorName;

  document.getElementById("edit-pkg-languages").value = Array.isArray(pkg.languages) ? pkg.languages.join(", ") : "en";
  document.getElementById("edit-pkg-desc").value = pkg.description || "";

  // Render Tags in Edit Modal
  state.editActiveTags = new Set(Array.isArray(pkg.tags) ? pkg.tags : ["tools"]);
  const tagsContainer = document.getElementById("edit-foundry-tags-selector");
  tagsContainer.innerHTML = "";

  OFFICIAL_FOUNDRY_TAGS.forEach(tag => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = state.editActiveTags.has(tag);
    btn.className = `px-2 py-0.5 rounded text-xs transition border ${isActive
      ? "bg-amber-500 text-slate-950 border-amber-400 font-semibold"
      : "bg-foundry-900 text-slate-300 border-foundry-border hover:border-slate-500"
      }`;
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      if (state.editActiveTags.has(tag)) {
        state.editActiveTags.delete(tag);
        btn.className = "px-2 py-0.5 rounded text-xs transition border bg-foundry-900 text-slate-300 border-foundry-border hover:border-slate-500";
      } else {
        state.editActiveTags.add(tag);
        btn.className = "px-2 py-0.5 rounded text-xs transition border bg-amber-500 text-slate-950 border-amber-400 font-semibold";
      }
    });
    tagsContainer.appendChild(btn);
  });

  modal.showModal();
}

// 17. LOAD FULL REPOSITORY OBJECT
function loadRepositoryObject(repoObj) {
  if (!repoObj || typeof repoObj !== "object") return;

  state.repo = {
    id: repoObj.id || "my-custom-repo",
    version: repoObj.version || "1.0.0",
    name: repoObj.name || "Custom Repository",
    description: repoObj.description || "",
    author: repoObj.author || "",
    site: repoObj.site || "",
    cover: repoObj.cover || `https://api.dicebear.com/10.x/blobs/svg?tags=animation&seed=${repoObj.id || 'repo'}`,
    social: Array.isArray(repoObj.social) ? repoObj.social : [],
    packages: Array.isArray(repoObj.packages) ? repoObj.packages.map(p => parseManifestToPackage(p)) : []
  };

  initFormBindings();
  initSocialLinksUI();
  saveToLocalStorage();
  renderAll();
}

// 18. CLEAN AND FORMAT FINAL REPOSITORY.JSON
function cleanRepositoryOutput(repoState) {
  const output = {
    id: repoState.id || "my-custom-repo",
    version: repoState.version || "1.0.0",
    name: repoState.name || "Custom Repository",
    description: repoState.description || "",
    author: repoState.author || "",
    site: repoState.site || "",
    cover: repoState.cover || "",
    social: (repoState.social || []).filter(s => s && s.name && s.url),
    packages: (repoState.packages || []).map(p => ({
      id: p.id,
      name: p.name || p.id,
      type: p.type || "module",
      title: p.title || p.id,
      description: p.description || "",
      version: p.version || "1.0.0",
      compatibility: {
        minimum: p.compatibility?.minimum || "13",
        verified: p.compatibility?.verified || "14",
        maximum: p.compatibility?.maximum || "14"
      },
      authors: p.authors || [{ name: "Unknown", url: "" }],
      url: p.url || "",
      manifest: p.manifest || "",
      download: p.download || "",
      languages: Array.isArray(p.languages) ? p.languages : ["en"],
      tags: Array.isArray(p.tags) ? p.tags : ["tools"],
      relationships: p.relationships || {}
    }))
  };

  return output;
}

// 19. LIVE JSON PREVIEW & VALIDATION
function renderLiveJson() {
  const codeEl = document.getElementById("json-preview-code");
  const sizeBadge = document.getElementById("json-size-badge");
  const validationBox = document.getElementById("validation-box");
  const validationText = document.getElementById("validation-text");

  if (!codeEl) return;

  const output = cleanRepositoryOutput(state.repo);
  const jsonStr = JSON.stringify(output, null, 2);

  // Size calculation
  const bytes = new Blob([jsonStr]).size;
  sizeBadge.textContent = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;

  // Syntax Highlighting
  codeEl.innerHTML = syntaxHighlightJson(jsonStr);

  // Validation Checklist
  const issues = [];
  if (!output.id) issues.push(t("export.missingId"));
  if (!output.name) issues.push(t("export.missingName"));
  if (!output.version) issues.push(t("export.missingVersion"));

  let missingManifestCount = 0;
  output.packages.forEach(pkg => {
    if (!pkg.manifest) missingManifestCount++;
  });

  if (missingManifestCount > 0) {
    issues.push(t("export.missingManifests", {
      count: missingManifestCount,
      noun: getMissingManifestNoun(missingManifestCount)
    }));
  }

  if (issues.length > 0) {
    validationBox.className = "p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 flex items-center gap-2 mb-3";
    validationBox.querySelector("i").className = "fa-solid fa-triangle-exclamation text-amber-400 flex-shrink-0";
    validationText.textContent = t("export.warningsPrefix") + issues.join(" • ");
  } else {
    validationBox.className = "p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 mb-3";
    validationBox.querySelector("i").className = "fa-solid fa-circle-check text-emerald-400 flex-shrink-0";
    validationText.textContent = t("export.validText");
  }
}

function syntaxHighlightJson(json) {
  json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = "json-number";
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = "json-key";
      } else {
        cls = "json-string";
      }
    } else if (/true|false/.test(match)) {
      cls = "json-boolean";
    } else if (/null/.test(match)) {
      cls = "json-null";
    }
    return '<span class="' + cls + '">' + match + "</span>";
  });
}

// 20. TOAST NOTIFICATIONS
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");

  let bgClass = "bg-foundry-900 border-foundry-border text-slate-100";
  let iconClass = "fa-solid fa-circle-info text-blue-400";

  if (type === "success") {
    bgClass = "bg-emerald-950/90 border-emerald-500/40 text-emerald-100";
    iconClass = "fa-solid fa-circle-check text-emerald-400";
  } else if (type === "warning") {
    bgClass = "bg-amber-950/90 border-amber-500/40 text-amber-100";
    iconClass = "fa-solid fa-triangle-exclamation text-amber-400";
  } else if (type === "error") {
    bgClass = "bg-red-950/90 border-red-500/40 text-red-100";
    iconClass = "fa-solid fa-circle-xmark text-red-400";
  }

  toast.className = `pointer-events-auto p-3 rounded-xl border shadow-xl flex items-center justify-between gap-3 text-xs backdrop-blur-md animate-fade-in ${bgClass}`;
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i class="${iconClass} text-sm flex-shrink-0"></i>
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="text-slate-400 hover:text-white p-1">&times;</button>
  `;

  toast.querySelector("button").addEventListener("click", () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4500);
}

// 21. UTILITY FUNCTIONS
function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
