# Custom Repository Manager for VTT

🇺🇦 [Українська версія](README_UA.md)

A patch/modification for **Foundry Virtual Tabletop** that introduces native support for third-party, private, and community package repositories (modules, game systems, and worlds) directly within the application's user interface.

[REPOSITORY BUILDER](https://deniztadice.github.io/crm-fvtt/)

[SCREENSHOTS](screenshots/SCREENSHOTS.md)

---

## 🌟 Key Features

- **Seamless Foundry UI Integration**:
  - Adds an **Official** / **Custom** toggle switch and a repository settings button (**⚙**) to the package installer toolbar.
- **Multiple Concurrent Repositories**:
  - Connect an unlimited number of `repository.json` endpoints.
  - The repository list is stored locally in the browser (`localStorage`).
- **Extended Catalog Metadata**:
  - Full support for `id`, `name`, `description`, `author`, `site`, `social` (links to Discord, GitHub, Patreon, etc.), and `cover` (badge/cover image).
- **Source Badges on Package Cards**:
  - Each package card displays a badge indicating its origin repository.
- **Backup and Restore**:
  - **Export JSON**: Save the complete repository list to a `.json` backup file.
  - **Import JSON**: Upload and automatically merge repositories from a backup file.
- **Additional Filters**:
  - Filter packages by supported language (when specified).
- **One-Click Installation**:
  - **Install** and **Update** buttons directly invoke Foundry's native installer using the package manifest URL.

---

## 📁 Patch File Structure in Foundry VTT Directory

```text
.
├── public/
│   ├── scripts/
│   │   └── custom-repo.mjs             # Main patch ES module
│   └── templates/
│       ├── custom-package-card.hbs     # Package card template
│       └── custom-repo-manager.hbs     # Repository manager modal template
├── templates/
│   └── views/
│       └── layouts/
│           ├── setup.hbs               # Setup template (where the script is injected)
│           └── setup.hbs.bak           # Automatic backup of the original file
```

---

## 🚀 Installation

### Option 1: Quick One-Line Installation (Recommended)

Run this single command on your server in the terminal:

```bash
curl -sSL https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/install.sh | bash
```

The script will automatically:

1. Download the latest release package (`crm-fvtt.zip`) and extract the necessary files.
2. Auto-detect your Foundry VTT installation directory (or ask you to enter the path interactively if it cannot find it automatically).
3. Back up `setup.hbs` and inject the script module.
4. Install all templates and scripts into your Foundry `public/` folder.

*To pass an explicit path directly:*

```bash
curl -sSL https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/install.sh | bash -s -- -p /path/to/foundry
```

*To uninstall using the one-liner:*

```bash
curl -sSL https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/install.sh | bash -s -- --uninstall
```

---

### Option 2: Local Installation via ZIP Archive

1. Download the latest `crm-fvtt.zip` from [Releases](https://github.com/deniztadice/crm-fvtt/releases/latest) and extract it.
2. Open a terminal in the extracted folder and run:

   ```bash
   chmod +x install.sh
   ./install.sh
   ```

   *If Foundry is installed in a non-standard location, the script will prompt you for the path, or you can provide it directly:*

   ```bash
   ./install.sh -p /path/to/foundry
   ```

3. Restart the Foundry VTT server.

#### Uninstalling the Patch Locally

To restore Foundry VTT to its original state:

```bash
./install.sh --uninstall
```

The script will automatically restore the original `setup.hbs` from the backup and remove all added patch files. Restart the Foundry VTT server afterwards.

---

### Option 3: Manual Installation

---

### Option 2: Manual Installation

1. **Copy the script**:
   Place `custom-repo.mjs` into:
   `<FOUNDRY_DIR>/public/scripts`

2. **Copy the templates**:
   Place `custom-package-card.hbs` and `custom-repo-manager.hbs` into (create the folder if it does not exist):
   `<FOUNDRY_DIR>/public/templates/`

3. **Inject the script into the Setup template**:
   Open `<FOUNDRY_DIR>/templates/views/layouts/setup.hbs` (create a backup first). Before the closing `</body>` tag, add:

   ```html
   <script type="module" src="/scripts/custom-repo.mjs"></script>
   ```

   The result should look like this:

   ```html
   ...
   <aside id="tooltip" role="tooltip" popover="manual"></aside>
   <script type="module" src="/scripts/custom-repo.mjs"></script>
   </body>
   ...
   ```

4. Restart the Foundry VTT server.

---

## 📖 User Guide

### 1. Switching to Custom Repositories

In the package installation window (when installing Modules or Systems), a toggle group appears in the top filter bar:

```text
[ 🌐 Official | 📦 Custom | ⚙ ]
```

- Click **Custom** — the package list switches to your connected custom repositories.
- Click **Official** — returns to the standard Foundry catalog.

### 2. Managing Repositories (⚙)

Click the gear icon (**⚙**) to open the **Custom Repositories** window:

- **Enable / Disable**: Toggle the checkbox next to any repository. The module list updates immediately in real time.
- **Add a New Repository**:
  Paste the direct link to a `repository.json` into the **Repository Manifest URL** field and click **Add & Fetch**. The script immediately queries the catalog, populates metadata, and updates the list.
- **Remove**: Click the trash icon next to a repository.
- **Export Backup**: Downloads a `foundry-custom-repositories-backup-YYYY-MM-DD.json` file and copies the JSON to your clipboard.
- **Import Backup**: Choose a previously exported `.json` file — repositories will be merged into the current list.

---

## 🛠 `repository.json` Format Specification

A repository is a static JSON file accessible over HTTP/HTTPS.

### Example `repository.json`

```json
{
  "id": "dtd-repo",
  "version": "1.0.0",
  "name": "DenizTaDice Repository",
  "description": "Custom package catalog",
  "author": "DTD",
  "site": "https://deniztadice.xyz",
  "cover": "https://api.dicebear.com/10.x/blobs/svg?tags=animation&seed=dtd-repo",
  "social": [
    { "name": "Telegram", "url": "https://t.me/deniztadice" }
  ],
  "packages": [
    {
      "id": "my-custom-module",
      "name": "my-custom-module",
      "type": "module",
      "title": "My Custom Module",
      "description": "Useful module for combat automation.",
      "version": "1.2.0",
      "compatibility": {
        "minimum": "13",
        "verified": "14",
        "maximum": "14"
      },
      "authors": [
        { "name": "DTD", "url": "https://t.me/deniztadice" }
      ],
      "url": "https://github.com/example/my-custom-module",
      "manifest": "https://github.com/example/my-custom-module/releases/latest/download/module.json",
      "download": "https://github.com/example/my-custom-module/releases/latest/download/module.zip",
      "languages": ["en", "uk"],
      "tags": ["automation", "combat", "translation"],
      "relationships": {
        "systems": [
          { "id": "dnd5e", "type": "system", "compatibility": {} }
        ]
      }
    }
  ]
}
```

### Catalog Fields (Repository Root)

| Field         | Type                            | Description                                                         |
| :------------ | :------------------------------ | :------------------------------------------------------------------ |
| `id`          | `string`                        | Unique string identifier for the repository                         |
| `version`     | `string`                        | Version of the repository                                           |
| `name`        | `string`                        | Repository name displayed in headers and card badges                |
| `description` | `string`                        | Short description of the repository                                 |
| `author`      | `string` \| `object` \| `array` | Author or creator team of the repository                            |
| `site`        | `string`                        | Link to homepage or documentation                                   |
| `cover`       | `string`                        | Direct link to a square icon (44×44px)                              |
| `social`      | `array`                         | Array of social media links (`{ "name": "Discord", "url": "..." }`) |
| `packages`    | `array`                         | Array of package definition objects                                 |

### Package Fields (`packages[]`)

| Field                    | Type     | Description                                                                   |
| :----------------------- | :------- | :---------------------------------------------------------------------------- |
| `id`                     | `string` | Package identifier (e.g., `my-cool-module`)                                   |
| `type`                   | `string` | Package type: `"module"`, `"system"`, or `"world"`                            |
| `title`                  | `string` | Display title of the package                                                  |
| `description`            | `string` | Package description                                                           |
| `version`                | `string` | Current version                                                               |
| `compatibility.verified` | `string` | Verified Foundry version (e.g., `"14"`)                                       |
| `manifest`               | `string` | Direct link to `module.json` / `system.json` for downloading and installation |
| `download`               | `string` | Direct link to the package ZIP archive                                        |
| `url`                    | `string` | Link to the package project page or GitHub repository                         |
| `languages`              | `array`  | Supported language codes (e.g., `["en", "uk"]`)                               |
| `tags`                   | `array`  | Categories (e.g., `["translation", "automation"]`)                            |

The following tags are supported, identical to the official repository:

- premium
- exclusive
- sheets
- adventures
- ai-tools
- analytics
- archived
- audio
- automation
- chat
- combat
- ai-content
- paid-features
- zero-ai
- importer
- content
- dice
- integration
- journal
- overhaul
- patches
- tools
- translation
- visuals
