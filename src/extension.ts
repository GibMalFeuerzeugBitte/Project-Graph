import * as vscode from "vscode";
import { spawnSync } from "child_process";
import { analyzeWorkspace } from "./analyzer";
import { getDashboardHtml } from "./webview";
import { DashboardData } from "./types";

let currentPanel: vscode.WebviewPanel | undefined;
let currentData: DashboardData | undefined;

async function openOrRefreshDashboard(context: vscode.ExtensionContext): Promise<void> {
  const data = await analyzeWorkspace();
  if (!data) {
    vscode.window.showWarningMessage("Project Graph: No workspace folder found.");
    return;
  }
  currentData = data;

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

    currentPanel.webview.onDidReceiveMessage(async (msg) => {
      if (!currentPanel) { return; }
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ".";

      if (msg.type === "getGitLog") {
        const result = spawnSync("git", ["log", "--oneline", "-15"], { cwd: root, encoding: "utf8" });
        if (result.error || result.status !== 0) {
          currentPanel.webview.postMessage({ type: "gitLog", commits: [], error: "Git not available or not a git repository" });
          return;
        }
        const commits = (result.stdout as string).trim().split("\n").filter(Boolean).map((l) => ({
          sha: l.slice(0, 7),
          message: l.slice(8, 70)
        }));
        currentPanel.webview.postMessage({ type: "gitLog", commits });

      } else if (msg.type === "getDiffAt") {
        const sha: string = String(msg.sha ?? "");
        // Validate SHA to prevent command injection
        if (!/^[0-9a-f]{6,40}$/i.test(sha)) {
          currentPanel.webview.postMessage({ type: "diffData", sha: "", addedLinks: [], removedLinks: [], error: "Invalid commit SHA" });
          return;
        }
        const files = currentData?.files ?? [];
        const addedLinks: Array<{ source: string; target: string }> = [];
        const removedLinks: Array<{ source: string; target: string }> = [];
        try {
          for (const file of files) {
            const res = spawnSync("git", ["show", sha + ":" + file.path], { cwd: root, encoding: "utf8" });
            if (res.status !== 0 || res.error) { continue; }
            const oldImps = extractRawImports(res.stdout as string, file.path);
            const curSet = new Set(file.imports);
            const oldSet = new Set(oldImps);
            for (const imp of curSet) { if (!oldSet.has(imp)) { addedLinks.push({ source: file.path, target: imp }); } }
            for (const imp of oldSet) { if (!curSet.has(imp)) { removedLinks.push({ source: file.path, target: imp }); } }
          }
          currentPanel.webview.postMessage({ type: "diffData", sha, addedLinks, removedLinks });
        } catch (err) {
          currentPanel.webview.postMessage({ type: "diffData", sha, addedLinks: [], removedLinks: [], error: String(err) });
        }

      } else if (msg.type === "saveFile") {
        const format   = String(msg.format   ?? "");
        const content  = String(msg.content  ?? "");
        const filename = String(msg.filename ?? "file");
        const filterMap: Record<string, Record<string, string[]>> = {
          "svg":  { "SVG Image":  ["svg"]  },
          "png":  { "PNG Image":  ["png"]  },
          "json": { "JSON File":  ["json"] },
          "csv":  { "CSV File":   ["csv"]  }
        };
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.joinPath(vscode.Uri.file(root), filename),
          filters: filterMap[format] ?? { "All Files": ["*"] }
        });
        if (!saveUri) { return; }
        const bytes = format === "png"
          ? new Uint8Array(Buffer.from(content, "base64"))
          : new Uint8Array(Buffer.from(content, "utf8"));
        await vscode.workspace.fs.writeFile(saveUri, bytes);
        vscode.window.showInformationMessage(`Saved: ${saveUri.fsPath}`);

      } else if (msg.type === "loadSnapshot") {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { "JSON Snapshot": ["json"] },
          title: "Select Project Snapshot for Comparison"
        });
        if (!picked || picked.length === 0) { return; }
        let snapshot: { files?: Array<{ path: string; imports?: string[] }> };
        try {
          const raw = await vscode.workspace.fs.readFile(picked[0]);
          snapshot = JSON.parse(Buffer.from(raw).toString("utf8"));
        } catch {
          currentPanel!.webview.postMessage({ type: "snapshotError", error: "Could not read or parse the JSON file." });
          return;
        }
        const snapshotFiles = snapshot.files ?? [];
        const currentFiles  = currentData?.files ?? [];
        const snpAdded:   Array<{ source: string; target: string }> = [];
        const snpRemoved: Array<{ source: string; target: string }> = [];
        const snapshotMap = new Map(
          snapshotFiles.map((f) => [f.path, new Set(f.imports ?? [])] as [string, Set<string>])
        );
        for (const cur of currentFiles) {
          const oldImps = snapshotMap.get(cur.path) ?? new Set<string>();
          const curSet  = new Set(cur.imports);
          for (const imp of curSet)  { if (!oldImps.has(imp)) { snpAdded.push({ source: cur.path, target: imp }); } }
          for (const imp of oldImps) { if (!curSet.has(imp))  { snpRemoved.push({ source: cur.path, target: imp }); } }
        }
        const label = picked[0].fsPath.split(/[\\/]/).pop() ?? "snapshot";
        currentPanel!.webview.postMessage({ type: "snapshotDiffData", label, addedLinks: snpAdded, removedLinks: snpRemoved });
      }
    }, undefined, context.subscriptions);
  }

  currentPanel.webview.html = getDashboardHtml(currentPanel.webview, data);
  currentPanel.reveal(vscode.ViewColumn.One, true);
}

/** Extract raw import strings from file content (best-effort, for git diff). */
function extractRawImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) {
    const re = /(?:^|[\n;])\s*(?:import\s+(?:[^'"`;{}\n]+\s+from\s+)?|(?:const|let|var)\s+\S+\s*=\s*require\s*\(\s*|import\s*\(\s*)['"`]([^'"`]+)['"`]/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) { if (m[1]) { imports.push(m[1]); } }
  } else if (ext === "py") {
    const re = /^(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) { imports.push(m[1] ?? m[2]); }
  }
  return imports;
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