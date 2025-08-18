# React Intl Intellisense – Translation Hover, Definition & Autocomplete for VS Code

---

## Description

**React Intl Intellisense** is a Visual Studio Code extension that makes working with translation files in JavaScript/TypeScript projects easier.

It provides:

- **Hover:** Displays the translation when hovering over a translation key.
- **Go to Definition (Ctrl+Click):** Navigates directly to the key definition in your translation files.
- **Autocomplete:** Suggests translation keys when typing inside `messages["..."]` or `messages['...']`.

---

## Key Features

- Supports multiple translation files (e.g., `es_ES.ts`, `en_US.ts`).
- Handles nested keys and flattens them into dot notation (e.g., `home.title`).
- Automatically reloads translations on changes to translation files or extension configuration—no VS Code restart needed.
- Works with JavaScript, TypeScript, and React variants (`.tsx`, `.jsx`).
- Smart autocomplete with translation value previews and source filename details.
- **🆕 Duplicate Value Detection:** Automatically detects and warns about identical translation values across different keys to help clean up your translation files.

---

## Installation

1. Search for **React-intl-intellisense** in the VS Code Marketplace and install the extension.
2. Alternatively, install manually via the `.vsix` package if you have it downloaded.

---

## Configuration

To use the extension, configure the list of translation files in your `settings.json` (preferably workspace settings):

```json
{
  "intlHelper.translationFiles": [
    "src/lang/locales/es_ES.ts",
    "src/lang/locales/en_US.ts"
  ],
  "intlHelper.checkDuplicatesOnLoad": true
}
```

### Configuration Options

- **`intlHelper.translationFiles`**: Array of relative paths to your translation files
- **`intlHelper.checkDuplicatesOnLoad`**: Boolean to enable/disable automatic duplicate value detection (default: `true`)

## Commands

- **"Verificar valores duplicados en traducciones"**: Manually check for duplicate values in translation files (accessible via Command Palette: `Ctrl+Shift+P`)

## Duplicate Value Detection

The extension automatically scans your translation files for identical values across different keys and shows warnings when duplicates are found. This helps you:

- Identify potential copy-paste errors
- Clean up redundant translations
- Maintain consistency in your translation files

When duplicates are detected, you'll see a warning notification with details about which keys share the same value.

## FAQ / Common Issues

    Autocomplete or hover not working?
        - Check that the paths in "intlHelper.translationFiles" are correct and relative to your workspace.

        - Make sure the translation files exist and export an object correctly.

        - Reload the VS Code window (Ctrl+Shift+P > Reload Window) after configuration changes.

    Does it support other formats?
        - Currently only .ts files exporting an object literal via default export are supported.

## Repository

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/EidanBlack/React-intl-intellisense)
