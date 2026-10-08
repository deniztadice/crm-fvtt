# Custom Repository Manager for VTT

🇬🇧 [English version](README.md)

Патч/модифікація для **Foundry Virtual Tabletop**, що додає нативну підтримку сторонніх, приватних та спільнотних репозиторіїв пакунків (модулів, ігрових систем і світів) безпосередньо в інтерфейс застосунку.

[КОНСТРУКТОР РЕПОЗИТОРІЯ](https://deniztadice.github.io/crm-fvtt/)

---

## 🌟 Основні можливості

- **Безшовна інтеграція в інтерфейс Foundry**:
  - Додає перемикач **Official** / **Custom** та кнопку налаштувань репозиторіїв (**⚙**) на панель встановлення пакунків.
- **Підтримка декількох одночасних репозиторіїв**:
  - Підключення необмеженої кількості джерел `repository.json`.
  - Список репозиторіїв зберігається локально в браузері (`localStorage`).
- **Розширені метадані каталогу**:
  - Повна підтримка `id`, `name`, `description`, `author`, `site`, `social` (посилання на Discord, GitHub, Patreon тощо) та `cover` (бейдж/зображення обкладинки).
- **Бейджі джерела на картках пакунків**:
  - Кожна картка пакунка відображає бейдж із назвою репозиторію, з якого вона походить.
- **Резервне копіювання та відновлення**:
  - **Експорт JSON**: Збереження повного списку репозиторіїв у файл резервної копії `.json`.
  - **Імпорт JSON**: Завантаження та автоматичне об'єднання репозиторіїв із файлу резервної копії.
- **Додаткові фільтри**:
  - Фільтрація пакунків за підтримуваною мовою (якщо вказано).
- **Встановлення в один клік**:
  - Кнопки **Встановити** (Install) та **Оновити** (Update) напряму викликають нативний інсталятор Foundry за URL-адресою маніфесту пакунка.

---

## 📁 Структура файлів патчу в директорії Foundry VTT

```text
.
├── public/
│   ├── scripts/
│   │   └── custom-repo.mjs             # Основний ES-модуль патчу
│   └── templates/
│       ├── custom-package-card.hbs     # Шаблон картки пакунка
│       └── custom-repo-manager.hbs     # Шаблон модального вікна менеджера репозиторіїв
├── templates/
│   └── views/
│       └── layouts/
│           ├── setup.hbs               # Шаблон Setup (куди підключається скрипт)
│           └── setup.hbs.bak           # Автоматична резервна копія оригінального файлу
```

---

## 🚀 Встановлення

### Варіант 1: Швидке встановлення в одну команду (Рекомендовано)

Виконайте одну команду в терміналі на сервері:

```bash
curl -sSL https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/install.sh | bash
```

Скрипт автоматично:

1. Завантажить останній релізний пакет (`crm-fvtt.zip`) та розархівує необхідні файли.
2. Визначить директорію встановлення вашого Foundry VTT (або інтерактивно запитає шлях, якщо не знайде автоматично).
3. Створить резервну копію `setup.hbs` та підключить модуль.
4. Встановить шаблони та скрипти в папку `public/` вашого Foundry.

*Якщо потрібно передати шлях безпосередньо:*

```bash
curl -sSL https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/install.sh | bash -s -- -p /path/to/foundry
```

*Видалення за допомогою однієї команди:*

```bash
curl -sSL https://raw.githubusercontent.com/deniztadice/crm-fvtt/main/install.sh | bash -s -- --uninstall
```

---

### Варіант 2: Локальне встановлення через ZIP-архів

1. Завантажте останній `crm-fvtt.zip` зі сторінки [Релізів](https://github.com/deniztadice/crm-fvtt/releases/latest) та розпакуйте його.
2. Відкрийте термінал у розпакованій папці та запустіть:

   ```bash
   chmod +x install.sh
   ./install.sh
   ```

   *Якщо Foundry розташовано в нестандартній директорії, скрипт запитає шлях, або ви можете вказати його прапорцем:*

   ```bash
   ./install.sh -p /path/to/foundry
   ```

3. Перезапустіть сервер Foundry VTT.

#### Видалення патчу локально

Щоб повернути Foundry VTT до початкового стану:

```bash
./install.sh --uninstall
```

Скрипт автоматично відновить оригінальний файл `setup.hbs` із резервної копії та видалить усі додані файли патчу. Після цього перезапустіть сервер Foundry VTT.

---

### Варіант 3: Встановлення вручну

---

### Варіант 2: Встановлення вручну

1. **Скопіюйте скрипт**:
   Помістіть `custom-repo.mjs` у:
   `<FOUNDRY_DIR>/public/scripts`

2. **Скопіюйте шаблони**:
   Помістіть `custom-package-card.hbs` та `custom-repo-manager.hbs` у (створіть папку, якщо її ще немає):
   `<FOUNDRY_DIR>/public/templates/`

3. **Вбудуйте скрипт у шаблон Setup**:
   Відкрийте `<FOUNDRY_DIR>/templates/views/layouts/setup.hbs` (спочатку створіть резервну копію). Перед закриваючим тегом `</body>` додайте:

   ```html
   <script type="module" src="/scripts/custom-repo.mjs"></script>
   ```

   Результат має виглядати так:

   ```html
   ...
   <aside id="tooltip" role="tooltip" popover="manual"></aside>
   <script type="module" src="/scripts/custom-repo.mjs"></script>
   </body>
   ...
   ```

4. Перезапустіть сервер Foundry VTT.

---

## 📖 Посібник користувача

### 1. Перемикання на користувацькі репозиторії

У вікні встановлення пакунків (під час встановлення модулів або систем) на верхній панелі фільтрів з'явиться перемикач:

```text
[ 🌐 Official | 📦 Custom | ⚙ ]
```

- Натисніть **Custom** — список пакунків перемкнеться на підключені користувацькі репозиторії.
- Натисніть **Official** — повернення до стандартного офіційного каталогу Foundry.

### 2. Керування репозиторіями (⚙)

Натисніть на значок шестерні (**⚙**), щоб відкрити вікно **Custom Repositories**:

- **Увімкнення / Вимкнення**: Позначте або зніміть прапорець поруч із будь-яким репозиторієм. Список модулів оновлюється миттєво в реальному часі.
- **Додавання нового репозиторію**:
  Вставте пряме посилання на `repository.json` у поле **Repository Manifest URL** і натисніть **Add & Fetch**. Скрипт негайно звернеться до каталогу, отримає метадані та оновить список.
- **Видалення**: Натисніть на значок кошика біля репозиторію.
- **Експорт резервної копії**: Завантажує файл `foundry-custom-repositories-backup-YYYY-MM-DD.json` і копіює JSON у буфер обміну.
- **Імпорт резервної копії**: Виберіть раніше експортований файл `.json` — репозиторії буде об'єднано з поточним списком.

---

## 🛠 Специфікація формату `repository.json`

Репозиторій — це статичний JSON-файл, доступний за протоколом HTTP/HTTPS.

### Приклад `repository.json`

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

### Поля каталогу (Корінь репозиторію)

| Поле          | Тип                             | Опис                                                                |
| :------------ | :------------------------------ | :------------------------------------------------------------------ |
| `id`          | `string`                        | Унікальний рядковий ідентифікатор репозиторію                       |
| `version`     | `string`                        | Версія репозиторію                                                  |
| `name`        | `string`                        | Назва репозиторію, що відображається в заголовках та бейджах карток |
| `description` | `string`                        | Короткий опис репозиторію                                           |
| `author`      | `string` \| `object` \| `array` | Автор або команда авторів репозиторію                               |
| `site`        | `string`                        | Посилання на головну сторінку або документацію                      |
| `cover`       | `string`                        | Пряме посилання на квадратну іконку/обкладинку (44×44px)            |
| `social`      | `array`                         | Масив посилань на соцмережі (`{ "name": "Discord", "url": "..." }`) |
| `packages`    | `array`                         | Масив об'єктів визначення пакунків                                  |

### Поля пакунка (`packages[]`)

| Поле                     | Тип      | Опис                                                                              |
| :----------------------- | :------- | :-------------------------------------------------------------------------------- |
| `id`                     | `string` | Ідентифікатор пакунка (наприклад, `my-cool-module`)                               |
| `type`                   | `string` | Тип пакунка: `"module"`, `"system"` або `"world"`                                 |
| `title`                  | `string` | Назва пакунка, що відображається                                                  |
| `description`            | `string` | Опис пакунка                                                                      |
| `version`                | `string` | Поточна версія                                                                    |
| `compatibility.verified` | `string` | Перевірена версія Foundry (наприклад, `"14"`)                                     |
| `manifest`               | `string` | Пряме посилання на `module.json` / `system.json` для завантаження та встановлення |
| `download`               | `string` | Пряме посилання на ZIP-архів пакунка                                              |
| `url`                    | `string` | Посилання на сторінку проекту або GitHub-репозиторій                              |
| `languages`              | `array`  | Коди підтримуваних мов (наприклад, `["en", "uk"]`)                                |
| `tags`                   | `array`  | Категорії / теги (наприклад, `["translation", "automation"]`)                     |

Підтримуються такі теги, аналогічні офіційному репозиторію:

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
