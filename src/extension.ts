import * as vscode from "vscode";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

type TranslationFileData = {
  translations: Record<string, string>;
  positions: Record<string, vscode.Position>;
  uri: vscode.Uri;
};

type DuplicateValue = {
  value: string;
  keys: string[];
  filePath: string;
};

let allTranslations: Record<string, TranslationFileData> = {};
const keyPattern = /(?<=["'])[^"']+(?=["'])/;
const supportedLanguages = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
];

function checkForDuplicateValues(
  translationData: TranslationFileData,
  filePath: string
): DuplicateValue[] {
  const valueMap: Record<string, string[]> = {};
  const duplicates: DuplicateValue[] = [];

  for (const [key, value] of Object.entries(translationData.translations)) {
    if (!value.trim()) continue;

    if (!valueMap[value]) {
      valueMap[value] = [];
    }
    valueMap[value].push(key);
  }

  for (const [value, keys] of Object.entries(valueMap)) {
    if (keys.length > 1) {
      duplicates.push({
        value,
        keys,
        filePath: path.basename(filePath),
      });
    }
  }

  return duplicates;
}

function showDuplicateValuesWarning(duplicates: DuplicateValue[]) {
  if (duplicates.length === 0) return;

  const messages = duplicates.map(
    (duplicate) =>
      `**${duplicate.filePath}**: "${
        duplicate.value
      }" se repite en las claves: ${duplicate.keys.join(", ")}`
  );

  const totalDuplicates = duplicates.reduce(
    (sum, dup) => sum + dup.keys.length,
    0
  );

  vscode.window
    .showWarningMessage(
      `Se encontraron ${duplicates.length} valores duplicados (${totalDuplicates} claves afectadas)`,
      "Ver detalles"
    )
    .then((selection) => {
      if (selection === "Ver detalles") {
        const panel = vscode.window.createWebviewPanel(
          "duplicateValues",
          "Valores de traducción duplicados",
          vscode.ViewColumn.Beside,
          {}
        );

        panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
            .duplicate-group { margin: 15px 0; padding: 15px; border-left: 4px solid #ff6b35; background: #163b62; }
            .value { font-weight: bold; color: #d73a49; margin-bottom: 8px; }
            .keys { color: #053a77ff; }
            .file-name { color: #0366d6; font-weight: 500; }
            h1 { color: #008ecc; }
          </style>
        </head>
        <body>
          <h1>🔍 Valores de traducción duplicados</h1>
          <p>Los siguientes valores aparecen en múltiples claves:</p>
          ${messages
            .map(
              (msg) =>
                `<div class="duplicate-group">${msg.replace(
                  /\*\*(.*?)\*\*/g,
                  '<span class="file-name">$1</span>'
                )}</div>`
            )
            .join("")}
        </body>
        </html>
      `;
      }
    });
}

function getDocumentSelector() {
  return supportedLanguages.map((lang) => ({ language: lang }));
}

function loadTranslationFile(filePath: string): TranslationFileData | null {
  if (!fs.existsSync(filePath)) {
    vscode.window.showErrorMessage(`No se encontró ${filePath}`);
    return null;
  }

  const sourceCode = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  let translations: Record<string, string> = {};
  const positions: Record<string, vscode.Position> = {};

  const parseObject = (obj: ts.ObjectLiteralExpression, prefix = "") => {
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const name =
          ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
            ? prop.name.text
            : "";
        const fullKey = prefix ? `${prefix}.${name}` : name;

        if (ts.isStringLiteral(prop.initializer)) {
          translations[fullKey] = prop.initializer.text;
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            prop.name.getStart()
          );
          positions[fullKey] = new vscode.Position(line, character);
        } else if (ts.isObjectLiteralExpression(prop.initializer)) {
          parseObject(prop.initializer, fullKey);
        }
      }
    }
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isExportAssignment(node) &&
      ts.isObjectLiteralExpression(node.expression)
    ) {
      parseObject(node.expression);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    translations,
    positions,
    uri: vscode.Uri.file(filePath),
  };
}

function loadAllTranslations() {
  allTranslations = {};
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const config = vscode.workspace.getConfiguration("intlHelper");
  const files = config.get<string[]>("translationFiles", [
    "src/lang/locales/es_ES.ts",
  ]);
  const checkDuplicatesOnLoad = config.get<boolean>(
    "checkDuplicatesOnLoad",
    true
  );

  let allDuplicates: DuplicateValue[] = [];

  for (const relativePath of files) {
    const absPath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(workspaceFolders[0].uri.fsPath, relativePath);
    const data = loadTranslationFile(absPath);
    if (data) {
      allTranslations[relativePath] = data;
      if (checkDuplicatesOnLoad) {
        const duplicates = checkForDuplicateValues(data, absPath);
        allDuplicates.push(...duplicates);
      }
    }
  }
  if (checkDuplicatesOnLoad && allDuplicates.length > 0) {
    showDuplicateValuesWarning(allDuplicates);
  }
}

export function activate(context: vscode.ExtensionContext) {
  loadAllTranslations();

  const checkDuplicatesCommand = vscode.commands.registerCommand(
    "react-intl-intellisense.checkDuplicates",
    () => {
      let allDuplicates: DuplicateValue[] = [];

      for (const [filePath, data] of Object.entries(allTranslations)) {
        const duplicates = checkForDuplicateValues(data, filePath);
        allDuplicates.push(...duplicates);
      }

      if (allDuplicates.length === 0) {
        vscode.window.showInformationMessage(
          "✅ No se encontraron valores duplicados en los archivos de traducción"
        );
      } else {
        showDuplicateValuesWarning(allDuplicates);
      }
    }
  );

  const hoverProvider = vscode.languages.registerHoverProvider(
    getDocumentSelector(),
    {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, keyPattern);
        if (!range) return;

        const key = document.getText(range);
        const found = Object.entries(allTranslations)
          .map(([file, data]) => {
            const value = data.translations[key];
            return value
              ? `**${key}** (${path.basename(file)}): ${value}`
              : null;
          })
          .filter(Boolean);

        if (found.length) {
          return new vscode.Hover(found.join("\n\n"));
        }
      },
    }
  );

  const defProvider = vscode.languages.registerDefinitionProvider(
    getDocumentSelector(),
    {
      provideDefinition(document, position) {
        const range = document.getWordRangeAtPosition(position, keyPattern);
        if (!range) return;

        const key = document.getText(range);
        for (const data of Object.values(allTranslations)) {
          const pos = data.positions[key];
          if (pos) {
            return new vscode.Location(data.uri, pos);
          }
        }
      },
    }
  );

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    getDocumentSelector(),
    {
      provideCompletionItems(document, position) {
        const line = document
          .lineAt(position)
          .text.substring(0, position.character);
        if (
          !/(messages\s*\[\s*["'][^"']*$)|(formatMessage\s*\(\s*{[^}]*id\s*:\s*["'][^"']*$)/.test(
            line
          )
        )
          return;

        const items: vscode.CompletionItem[] = [];
        for (const [file, data] of Object.entries(allTranslations)) {
          for (const [key, value] of Object.entries(data.translations)) {
            const item = new vscode.CompletionItem(
              key,
              vscode.CompletionItemKind.Text
            );
            item.detail = `${path.basename(file)}: ${value}`;
            item.insertText = key;
            items.push(item);
          }
        }
        return items;
      },
    },
    `"`,
    `'`
  );

  context.subscriptions.push(
    checkDuplicatesCommand,
    hoverProvider,
    defProvider,
    completionProvider
  );

  let reloadTimeout: NodeJS.Timeout;
  vscode.workspace.onDidChangeTextDocument((e) => {
    const fileChanged = Object.values(allTranslations).some(
      (data) => e.document.uri.fsPath === data.uri.fsPath
    );
    if (fileChanged) {
      clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(loadAllTranslations, 300);
    }
  });
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration("intlHelper.translationFiles") ||
      e.affectsConfiguration("intlHelper.checkDuplicatesOnLoad")
    ) {
      loadAllTranslations();
    }
  });
}

export function deactivate() {}
