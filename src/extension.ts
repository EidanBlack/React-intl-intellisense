import * as vscode from "vscode";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

type TranslationData = {
  translations: Record<string, string>;
  positions: Record<string, vscode.Position>;
  uri: vscode.Uri;
};

let translationData: TranslationData | null = null;

// Parsea el archivo es_ES.ts y guarda las traducciones y posiciones
function loadTranslations(): TranslationData | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return null;
  }

  const config = vscode.workspace.getConfiguration("intlHelper");
  const customPath = config.get<string>(
    "translationFile",
    "src/lang/locales/es_ES.ts"
  );
  const localePath = path.join(workspaceFolders[0].uri.fsPath, customPath);
  if (!fs.existsSync(localePath)) {
    vscode.window.showErrorMessage(`No se encontró ${customPath}`);
    return null;
  }

  const sourceCode = fs.readFileSync(localePath, "utf8");
  const sourceFile = ts.createSourceFile(
    localePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  const translations: Record<string, string> = {};
  const positions: Record<string, vscode.Position> = {};

  const visit = (node: ts.Node) => {
    if (
      ts.isExportAssignment(node) &&
      ts.isObjectLiteralExpression(node.expression)
    ) {
      for (const prop of node.expression.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
          ts.isStringLiteral(prop.initializer)
        ) {
          const key = prop.name.text;
          const value = prop.initializer.text;
          translations[key] = value;

          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            prop.name.getStart()
          );
          positions[key] = new vscode.Position(line, character);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    translations,
    positions,
    uri: vscode.Uri.file(localePath),
  };
}

export function activate(context: vscode.ExtensionContext) {
  translationData = loadTranslations();
  if (!translationData) {
    return;
  }

  const supportedLanguages = [
    "typescript",
    "javascript",
    "typescriptreact",
    "javascriptreact",
  ];

  // Hover provider
  for (const lang of supportedLanguages) {
    const hoverProvider = vscode.languages.registerHoverProvider(lang, {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(
          position,
          /(?<=["'`])[a-zA-Z0-9_.-]+(?=["'`])/
        );
        if (!range) {
          return;
        }

        const word = document.getText(range).replace(/['"]/g, "");
        const value = translationData?.translations[word];
        if (value) {
          return new vscode.Hover(`**${word}**: ${value}`);
        } else {
          return new vscode.Hover(`**${word}**: No se encontró traducción`);
        }
      },
    });

    const defProvider = vscode.languages.registerDefinitionProvider(lang, {
      provideDefinition(document, position) {
        const range = document.getWordRangeAtPosition(
          position,
          /(?<=["'`])[a-zA-Z0-9_.-]+(?=["'`])/
        );
        if (!range) {
          return;
        }

        const word = document.getText(range).replace(/['"]/g, "");
        const pos = translationData?.positions[word];
        if (pos) {
          return new vscode.Location(
            translationData?.uri || vscode.Uri.file(""),
            pos
          );
        }
      },
    });

    context.subscriptions.push(hoverProvider, defProvider);
  }

  vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document.uri.fsPath.endsWith("es_ES.ts")) {
      translationData = loadTranslations();
    }
  });
}

export function deactivate() {}
