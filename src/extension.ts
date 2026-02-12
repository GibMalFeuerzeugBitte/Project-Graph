import * as vscode from "vscode";
import { analyzeWorkspace } from "./analyzer";
import { getDashboardHtml } from "./webview";

let currentPanel: vscode.WebviewPanel | undefined;

async function openOrRefreshDashboard(context: vscode.ExtensionContext): Promise<void> {
  const data = await analyzeWorkspace();
  if (!data) {
    vscode.window.showWarningMessage("Project Graph: No workspace folder found.");
    return;
  }

  if (!currentPanel) {
    currentPanel = vscode.window.createWebviewPanel(
      "projectGraph",
      "Project Graph",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
    }, null, context.subscriptions);
  }

  currentPanel.webview.html = getDashboardHtml(currentPanel.webview, data);
  currentPanel.reveal(vscode.ViewColumn.One, true);
}

export function activate(context: vscode.ExtensionContext): void {
  const openCommand = vscode.commands.registerCommand("projectGraph.openDashboard", async () => {
    await openOrRefreshDashboard(context);
  });

  const refreshCommand = vscode.commands.registerCommand("projectGraph.refreshDashboard", async () => {
    await openOrRefreshDashboard(context);
  });

  context.subscriptions.push(openCommand, refreshCommand);
}

export function deactivate(): void {
  currentPanel?.dispose();
}