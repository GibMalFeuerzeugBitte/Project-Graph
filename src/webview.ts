import * as vscode from "vscode";
import { DashboardData, FolderNode } from "./types";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getExtBadge(filename: string): string {
  const ext = filename.includes(".") ? ("." + filename.split(".").pop()!.toLowerCase()) : "";
  const map: Record<string, [string, string]> = {
    ".ts": ["ext-ts", "TS"], ".tsx": ["ext-tsx", "TSX"],
    ".js": ["ext-js", "JS"], ".jsx": ["ext-jsx", "JSX"], ".mjs": ["ext-js", "MJS"], ".cjs": ["ext-js", "CJS"],
    ".py": ["ext-py", "PY"], ".pyw": ["ext-py", "PY"],
    ".json": ["ext-json", "JSON"], ".jsonc": ["ext-json", "JSON"],
    ".css": ["ext-css", "CSS"], ".scss": ["ext-css", "SCSS"], ".sass": ["ext-css", "SASS"],
    ".html": ["ext-html", "HTML"], ".htm": ["ext-html", "HTML"],
    ".md": ["ext-md", "MD"], ".mdx": ["ext-md", "MDX"],
    ".yaml": ["ext-yaml", "YAML"], ".yml": ["ext-yaml", "YML"],
    ".sql": ["ext-sql", "SQL"], ".go": ["ext-go", "GO"],
    ".rs": ["ext-rs", "RS"], ".java": ["ext-java", "JAVA"],
    ".cs": ["ext-cs", "CS"], ".php": ["ext-php", "PHP"], ".rb": ["ext-rb", "RB"],
  };
  const entry = map[ext];
  if (entry) return `<span class="ext-badge ${entry[0]}">${entry[1]}</span>`;
  const fallback = ext.slice(1, 5).toUpperCase() || "FILE";
  return `<span class="ext-badge ext-other">${fallback}</span>`;
}

function getFileIcon(filename: string): string {
  const ext = filename.includes(".") ? "." + filename.split(".").pop()!.toLowerCase() : "";
  const c: Record<string, string> = {
    ".ts": "#3d8fc8", ".tsx": "#3d8fc8",
    ".js": "#c9a83c", ".jsx": "#c9a83c", ".mjs": "#c9a83c", ".cjs": "#c9a83c",
    ".py": "#4a9cc7", ".pyw": "#4a9cc7",
    ".json": "#c87832", ".jsonc": "#c87832",
    ".css": "#9055a2", ".scss": "#9055a2", ".sass": "#9055a2",
    ".html": "#c8503a", ".htm": "#c8503a",
    ".md": "#7a7a8e", ".mdx": "#7a7a8e",
    ".yaml": "#b85858", ".yml": "#b85858",
    ".sql": "#38a87a", ".go": "#34a4cc",
    ".rs": "#b26030", ".java": "#c86020",
    ".cs": "#6080c8", ".php": "#7070b8", ".rb": "#b83838",
  };
  const col = c[ext] ?? "#7a7a8e";
  return `<svg class="t-file-icon" viewBox="0 0 10 13" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 0h6l3 3v9a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1z" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="0.85"/><path d="M7 0v3h3" fill="none" stroke="${col}" stroke-width="0.85"/></svg>`;
}

function countFiles(node: FolderNode): number {
  return node.files.length + node.folders.reduce((sum, f) => sum + countFiles(f), 0);
}

function renderTree(node: FolderNode, currentPath: string = ""): string {
  const folderItems = node.folders
    .map((folder) => {
      const folderPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
      const fc = countFiles(folder);
      return `<li class="t-folder-li" data-folder="${escapeHtml(folderPath)}"><details><summary><span class="t-chevron"></span><svg class="t-folder-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 13" aria-hidden="true"><path class="f-closed" d="M2 0H5.5L7 2.5H14.5C15.3 2.5 16 3.2 16 4V11C16 12.1 15.1 13 14 13H2C.9 13 0 12.1 0 11V2C0 .9.9 0 2 0Z" fill="currentColor"/><path class="f-open-back" d="M2 0H5.5L7 2.5H16V4H0V2C0 .9.9 0 2 0Z" fill="currentColor" fill-opacity="0.55"/><path class="f-open-front" d="M0 4H16V11C16 12.1 15.1 13 14 13H2C.9 13 0 12.1 0 11V4Z" fill="currentColor"/></svg><span class="t-name">${escapeHtml(folder.name)}</span><span class="t-count">${fc}</span></summary>${renderTree(folder, folderPath)}</details></li>`;
    })
    .join("");
  const fileItems = node.files
    .map((file) => {
      const filePath = currentPath ? `${currentPath}/${file}` : file;
      return `<li class="t-file" data-path="${escapeHtml(filePath)}">${getFileIcon(file)}<span class="t-name">${escapeHtml(file)}</span></li>`;
    })
    .join("");
  return `<ul class="tree">${folderItems}${fileItems}</ul>`;
}

export function getDashboardHtml(webview: vscode.Webview, data: DashboardData): string {
  const nonce = String(Date.now());
  const treeHtml = renderTree(data.folderTree);
  const safeData = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Graph</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root { color-scheme: light dark; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      margin: 0; padding: 18px 20px 28px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-size: 13px; line-height: 1.5;
    }
    /* ── Stats ───────────────────────────────────────── */
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .stat-card { background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 13px 15px; }
    .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--vscode-descriptionForeground); margin-bottom: 5px; }
    .stat-value { font-size: 21px; font-weight: 700; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stat-unit { font-size: 13px; font-weight: 400; }
    .stat-sub  { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 3px; }
    /* ── Layout ──────────────────────────────────────── */
    .main-grid { display: grid; grid-template-columns: 255px 1fr; gap: 12px; align-items: stretch; }
    .mt { margin-top: 12px; }
    /* ── Panels ──────────────────────────────────── */
    .panel { background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; overflow: hidden; }
    #structure-panel { display: flex; flex-direction: column; }
    #structure-panel .tree-scroll { flex: 1; max-height: none; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 14px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
    .panel-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--vscode-descriptionForeground); flex-shrink: 0; }
    /* ── Folder tree ─────────────────────────────────── */
    .tree-scroll { max-height: 430px; overflow-y: auto; padding: 6px 8px 8px 4px; }
    .tree, .tree ul { list-style: none; margin: 0; padding-left: 16px; }
    .tree { padding-left: 4px; }
    .tree li { position: relative; }
    .tree li::before { content: ""; position: absolute; left: -10px; top: 0; bottom: 2px; width: 1px; background: var(--vscode-panel-border); opacity: .28; }
    .tree li::after  { content: ""; position: absolute; left: -10px; top: 12px; width: 10px; height: 1px; background: var(--vscode-panel-border); opacity: .28; }
    .tree > li::before, .tree > li::after { display: none; }
    details > summary { list-style: none; cursor: pointer; padding: 3px 4px; display: flex; align-items: center; gap: 5px; border-radius: 4px; user-select: none; transition: background .09s; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary:hover { background: var(--vscode-list-hoverBackground); }
    .t-chevron { width: 12px; height: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .t-chevron::before { content: ""; display: block; width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; opacity: 0.48; transform: rotate(-45deg); margin-top: 1px; transition: transform .12s ease, margin-top .12s ease; }
    details[open] > summary .t-chevron::before { transform: rotate(45deg); margin-top: -1px; }
    .t-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .t-file { display: flex; align-items: center; gap: 5px; padding: 3px 4px; cursor: pointer; border-radius: 4px; transition: background .08s; }
    .t-file:hover { background: var(--vscode-list-hoverBackground); }
    .t-file.t-active { background: var(--vscode-list-activeSelectionBackground); }
    .t-file.t-active .t-name { color: var(--vscode-list-activeSelectionForeground); }
    /* ── Graph panel ─────────────────────────────────── */
    .graph-header-right { display: flex; align-items: center; gap: 8px; }
    .graph-badge { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 11px; font-family: var(--vscode-editor-font-family, monospace); background: var(--vscode-badge-background, #0e639c); color: var(--vscode-badge-foreground, #fff); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #graph { width: 100%; height: 430px; display: block; cursor: grab; background: var(--vscode-editorWidget-background); touch-action: none; user-select: none; -webkit-user-select: none; }
    #graph:active { cursor: grabbing; }
    .graph-footer { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); gap: 8px; }
    .footer-right { display: flex; align-items: center; gap: 10px; }
    .export-wrap { display: flex; gap: 4px; }
    .export-btn { background: transparent; border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); padding: 2px 8px; border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; transition: background .1s; }
    .export-btn:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
    .graph-legend { display: flex; align-items: center; gap: 16px; font-size: 11px; color: var(--vscode-descriptionForeground); }
    .leg { display: flex; align-items: center; gap: 5px; }
    .leg-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .graph-hint { font-size: 11px; color: var(--vscode-descriptionForeground); opacity: .55; }
    /* ── File table ──────────────────────────────────── */
    .search-input { background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); color: var(--vscode-input-foreground); padding: 4px 9px; border-radius: 4px; font-size: 12px; font-family: inherit; outline: none; width: 220px; }
    .search-input::placeholder { opacity: .55; }
    .search-input:focus { border-color: var(--vscode-focusBorder); }
    .table-scroll { max-height: 270px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { position: sticky; top: 0; z-index: 1; background: var(--vscode-editorWidget-background); padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); white-space: nowrap; }
    tbody tr { cursor: pointer; }
    tbody tr:hover td { background: var(--vscode-list-hoverBackground); }
    tbody tr.row-active td { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    tbody td { padding: 5px 10px; border-bottom: 1px solid var(--vscode-panel-border); vertical-align: middle; }
    .td-path { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .td-num  { text-align: right; color: var(--vscode-descriptionForeground); width: 80px; }
    .num-badge { display: inline-block; min-width: 22px; padding: 1px 5px; border-radius: 9px; font-size: 10px; font-weight: 600; text-align: center; background: var(--vscode-badge-background, #0e639c); color: var(--vscode-badge-foreground, #fff); opacity: .85; }
    .num-badge.zero { background: transparent; border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); opacity: .6; }
    /* ── Critical files ─────────────────────────────── */
    .panel-hint { font-size: 11px; color: var(--vscode-descriptionForeground); opacity: .6; }
    .critical-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1px; padding: 6px 0; background: var(--vscode-panel-border); }
    .critical-item { display: flex; align-items: center; gap: 10px; padding: 7px 14px; cursor: pointer; background: var(--vscode-sideBar-background); }
    .critical-item:hover { background: var(--vscode-list-hoverBackground); }
    .critical-item.c-active { background: var(--vscode-list-activeSelectionBackground); }
    .critical-item.c-active .critical-path { color: var(--vscode-list-activeSelectionForeground); }
    .critical-rank { font-size: 10px; font-weight: 700; min-width: 18px; text-align: right; color: var(--vscode-descriptionForeground); flex-shrink: 0; }
    .critical-path { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* ── Workspace tabs ──────────────────────────────── */
    .ws-tabs { display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
    .ws-tab { background: transparent; border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-family: inherit; transition: background .1s, color .1s; }
    .ws-tab:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
    .ws-tab.active { background: var(--vscode-badge-background, #0e639c); color: var(--vscode-badge-foreground, #fff); border-color: var(--vscode-badge-background, #0e639c); }
    /* ── Mode buttons ────────────────────────────────── */
    .mode-btns { display: flex; gap: 2px; }
    .mode-btn { background: transparent; border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); padding: 3px 9px; border-radius: 3px; font-size: 11px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .1s; }
    .mode-btn:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
    .mode-btn.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-background); }
    /* ── Multi-select row ────────────────────────────── */
    .file-row.multi-on td { background: var(--vscode-list-inactiveSelectionBackground, rgba(78,155,224,0.18)); }
    .file-row.multi-on:hover td { background: rgba(78,155,224,0.18); }
    /* ── Tree: folder active + folder mode ──────────── */
    .tree-scroll.mode-folder .t-folder-li > details > summary { cursor: pointer; }
    .t-folder-li.t-folder-on > details > summary .t-name { color: var(--vscode-button-background, #0e639c); font-weight: 600; }
    .t-folder-on > details > summary .t-chevron::before { border-color: var(--vscode-button-background, #0e639c); opacity: 0.9; }
    .t-count { margin-left: auto; font-size: 10px; color: var(--vscode-descriptionForeground); opacity: .45; padding-left: 6px; flex-shrink: 0; }
    .t-folder-svg { width: 15px; height: 13px; flex-shrink: 0; color: var(--vscode-charts-blue, #4e9be0); opacity: 0.70; display: inline-block; }
    .t-folder-on > details > summary .t-folder-svg { color: var(--vscode-button-background, #0e639c); opacity: 0.95; }
    .f-open-back, .f-open-front { display: none; }
    details[open] > summary .f-closed { display: none; }
    details[open] > summary .f-open-back { display: block; }
    details[open] > summary .f-open-front { display: block; }
    .t-file-icon { width: 11px; height: 14px; flex-shrink: 0; display: inline-block; overflow: visible; }
    /* ── Ext badges ──────────────────────────────────── */
    .ext-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 14px; padding: 0 3px; border-radius: 2px; font-size: 8px; font-weight: 700; flex-shrink: 0; letter-spacing: .01em; }
    .ext-ts   { background: rgba(49,120,198,.18);  color: #4e90d8; }
    .ext-tsx  { background: rgba(49,120,198,.18);  color: #4e90d8; }
    .ext-js   { background: rgba(247,223,30,.18);  color: #a89000; }
    .ext-jsx  { background: rgba(247,223,30,.18);  color: #a89000; }
    .ext-py   { background: rgba(53,114,165,.18);  color: #5b9dc9; }
    .ext-json { background: rgba(233,120,38,.18);  color: #e08040; }
    .ext-css  { background: rgba(156,91,185,.18);  color: #b070cc; }
    .ext-html { background: rgba(228,75,35,.18);   color: #e06040; }
    .ext-md   { background: rgba(120,120,120,.15); color: #909090; }
    .ext-yaml { background: rgba(200,50,50,.15);   color: #d07070; }
    .ext-sql  { background: rgba(0,180,120,.15);   color: #40c090; }
    .ext-go   { background: rgba(0,173,216,.15);   color: #40b0d8; }
    .ext-rs   { background: rgba(222,100,40,.15);  color: #c87040; }
    .ext-java { background: rgba(255,100,0,.15);   color: #e07030; }
    .ext-cs   { background: rgba(100,140,200,.15); color: #7090d0; }
    .ext-php  { background: rgba(119,123,180,.15); color: #8080c0; }
    .ext-rb   { background: rgba(204,52,45,.15);   color: #cc4040; }
    .ext-other{ background: rgba(120,120,120,.12); color: #888; }
    /* ── Git diff panel ──────────────────────────────── */
    .git-panel { display: none; padding: 7px 14px 8px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); gap: 8px; align-items: center; flex-wrap: wrap; }
    .git-panel.visible { display: flex; }
    .git-commit-sel { background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); color: var(--vscode-input-foreground); padding: 3px 7px; border-radius: 4px; font-size: 11px; font-family: var(--vscode-editor-font-family, monospace); cursor: pointer; min-width: 260px; }
    .git-status-txt { font-size: 11px; color: var(--vscode-descriptionForeground); flex: 1; }
    .git-leg-add { font-size: 11px; font-weight: 600; color: #4ec94e; }
    .git-leg-rem { font-size: 11px; font-weight: 600; color: #e04e4e; }
    /* ── Scrollbar ───────────────────────────────────── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
  </style>
</head>
<body>

  <!-- Stats row -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-label">Workspace</div>
      <div class="stat-value">${escapeHtml(data.workspaceName)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Files</div>
      <div class="stat-value">${data.totalFiles}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Size</div>
      <div class="stat-value">${data.totalSizeMb} <span class="stat-unit">MB</span></div>
      <div class="stat-sub">Analyzed: ${data.analyzedSizeMb} MB &bull; ${data.analyzedFiles} files</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Main File</div>
      <div class="stat-value" style="font-size:15px">${escapeHtml(data.mainFile ?? "—")}</div>
      <div class="stat-sub">${data.mainFileSizeMb ?? 0} MB</div>
    </div>
  </div>

  ${data.workspaceFolders && data.workspaceFolders.length > 1 ? `<div class="ws-tabs">
    <button class="ws-tab active" data-ws="">All Workspaces</button>
    ${data.workspaceFolders.map((ws) => `<button class="ws-tab" data-ws="${escapeHtml(ws.name)}">${escapeHtml(ws.name)}</button>`).join("")}
  </div>` : ""}
  <!-- Main grid: tree + graph -->
  <div class="main-grid">

    <section class="panel" id="structure-panel">
      <div class="panel-header">
        <span class="panel-title">Structure</span>
      </div>
      <div class="tree-scroll" id="tree-scroll">${treeHtml}</div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <span class="panel-title">Dependency Map</span>
        <div class="graph-header-right">
          <div class="mode-btns">
            <button class="mode-btn active" data-mode="multi" title="Select multiple files">Multi</button>
            <button class="mode-btn" data-mode="folder" title="Show all files in a folder">Folder</button>
            <button class="mode-btn" data-mode="diff" title="Compare with a git commit">Git Diff</button>
          </div>
          <span id="graph-badge" class="graph-badge" style="display:none"></span>
        </div>
      </div>
      <div id="git-panel" class="git-panel">
        <select id="git-commit-sel" class="git-commit-sel" disabled><option value="">Loading…</option></select>
        <span style="color:var(--vscode-descriptionForeground);font-size:11px;flex-shrink:0">or</span>
        <button id="git-load-snapshot-btn" class="export-btn" title="Compare current state with a previously exported JSON snapshot">Load JSON Snapshot…</button>
        <span id="git-status-txt" class="git-status-txt"></span>
        <span class="git-leg-add">● Added</span>
        <span class="git-leg-rem">● Removed</span>
      </div>
      <svg id="graph" viewBox="0 0 860 430" preserveAspectRatio="xMidYMid meet"></svg>
      <div class="graph-footer">
        <div class="graph-legend">
          <div class="leg"><div class="leg-dot" style="background:#4e9be0"></div><span>Imports (outgoing)</span></div>
          <div class="leg"><div class="leg-dot" style="background:#e09a4e"></div><span>Imported by (incoming)</span></div>
        </div>
        <div class="footer-right">
          <span class="graph-hint">Scroll: zoom &bull; Drag: pan &bull; Dblclick: reset</span>
          <div class="export-wrap">
            <button class="export-btn" id="export-svg-btn" title="Export graph as SVG">&#8595; SVG</button>
            <button class="export-btn" id="export-png-btn" title="Export graph as PNG (2&times;)">&#8595; PNG</button>
            <button class="export-btn" id="export-json-btn" title="Export dependency data as JSON">&#8595; JSON</button>
            <button class="export-btn" id="export-csv-btn" title="Export dependency links as CSV">&#8595; CSV</button>
          </div>
        </div>
      </div>
    </section>

  </div>

  <!-- File table -->
  <section class="panel mt">
    <div class="panel-header">
      <span class="panel-title">Files</span>
      <input type="search" id="file-search" class="search-input" placeholder="Filter files…" autocomplete="off" spellcheck="false" />
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th style="text-align:right;width:95px">Size (MB)</th>
            <th style="text-align:right;width:80px">Imports</th>
            <th style="text-align:right;width:105px">Imported By</th>
          </tr>
        </thead>
        <tbody id="file-tbody">
          ${data.files
            .map(
              (file) =>
                `<tr class="file-row" data-id="${escapeHtml(file.path)}">
              <td class="td-path">${escapeHtml(file.path)}</td>
              <td class="td-num">${file.sizeMb}</td>
              <td class="td-num"><span class="num-badge${file.imports.length === 0 ? " zero" : ""}">${file.imports.length}</span></td>
              <td class="td-num"><span class="num-badge${file.importedBy.length === 0 ? " zero" : ""}">${file.importedBy.length}</span></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Critical Files -->
  <section class="panel mt">
    <div class="panel-header">
      <span class="panel-title">Critical Files</span>
      <span class="panel-hint">Ranked by dependency impact &bull; click to explore</span>
    </div>
    <div class="critical-grid">
      ${data.criticalFiles.map((file, i) => `<div class="critical-item" data-path="${escapeHtml(file)}"><span class="critical-rank">${i + 1}</span><span class="critical-path" title="${escapeHtml(file)}">${escapeHtml(file)}</span></div>`).join("") || `<div style="padding:12px 14px;font-size:12px;opacity:.5">No critical files detected</div>`}
    </div>
  </section>

  <script nonce="${nonce}">
  window.onerror = function(msg, src, line) {
    var d = document.createElement("div");
    d.setAttribute("style", "position:fixed;top:0;left:0;right:0;padding:8px 16px;background:#c0392b;color:#fff;font-family:monospace;font-size:11px;z-index:9999;white-space:pre-wrap");
    d.textContent = "\u26a0 JS-Fehler: " + msg + " (Zeile " + line + ")";
    document.body.appendChild(d);
  };
  </script>
  <script nonce="${nonce}">
  (function () {
    const data  = ${safeData};
    const svg   = document.getElementById("graph");
    const W = 860, H = 430;
    const NS = "http://www.w3.org/2000/svg";

    /* ── state ───────────────────────────────────────── */
    let graphMode  = "multi"; // "multi" | "folder" | "diff"
    let multiSel   = new Set();
    let curFolder  = null;
    let viewport   = null;
    let diffData   = null;
    const vscodeApi = (typeof acquireVsCodeApi !== 'undefined') ? acquireVsCodeApi() : null;
    let scale = 1, tx = 0, ty = 0;
    let isDragging = false, lastX = 0, lastY = 0;
    let panZoomReady = false;

    /* ── helpers ─────────────────────────────────────── */
    function escapeHtml(s) {
      return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    }
    function svgEl(tag, attrs) {
      const e = document.createElementNS(NS, tag);
      if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      return e;
    }
    function shortLabel(id) {
      const base = (id.split(/[/\\\\]/).pop() || id);
      return base.length > 26 ? base.slice(0, 24) + "\u2026" : base;
    }
    function applyTx() {
      if (viewport) viewport.setAttribute("transform", "translate(" + tx + " " + ty + ") scale(" + scale + ")");
      updateMinimap();
    }

    /* ── minimap ─────────────────────────────────────── */
    function updateMinimap() {
      const existing = document.getElementById("mm-layer");
      if (existing) existing.remove();
      if (!viewport || (scale < 1.35 && tx === 0 && ty === 0)) return;
      const circles = Array.from(viewport.querySelectorAll("circle")).filter(function(c) {
        const r = +(c.getAttribute("r") || 0); return r >= 2 && r <= 20;
      });
      if (circles.length === 0) return;
      const MMX = W - 142, MMY = H - 76, MMW = 128, MMH = 62;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      circles.forEach(function(c) {
        const cx = +(c.getAttribute("cx") || 0), cy = +(c.getAttribute("cy") || 0);
        minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      });
      if (!isFinite(minX)) return;
      const pad = 6;
      const rangeX = Math.max(maxX - minX, 40), rangeY = Math.max(maxY - minY, 20);
      const sc = Math.min((MMW - pad * 2) / rangeX, (MMH - pad * 2) / rangeY);
      const ox = MMX + pad + (MMW - pad * 2 - rangeX * sc) / 2 - minX * sc;
      const oy = MMY + pad + (MMH - pad * 2 - rangeY * sc) / 2 - minY * sc;
      const ml = svgEl("g", { id: "mm-layer" });
      ml.appendChild(svgEl("rect", { x: MMX - 2, y: MMY - 2, width: MMW + 4, height: MMH + 4,
        fill: "var(--vscode-editorWidget-background)", opacity: "0.92", rx: "4",
        stroke: "var(--vscode-panel-border)", "stroke-width": "1" }));
      circles.forEach(function(c) {
        const cx = +(c.getAttribute("cx") || 0), cy = +(c.getAttribute("cy") || 0);
        const r = +(c.getAttribute("r") || 6);
        const fill = c.getAttribute("fill") || "#888";
        ml.appendChild(svgEl("circle", { cx: cx * sc + ox, cy: cy * sc + oy, r: r > 10 ? 3 : 2, fill: fill, "fill-opacity": "0.78" }));
      });
      const vx = (-tx / scale) * sc + ox;
      const vy = (-ty / scale) * sc + oy;
      const vw = (W / scale) * sc;
      const vh = (H / scale) * sc;
      ml.appendChild(svgEl("rect", { x: vx, y: vy, width: vw, height: vh,
        fill: "none", stroke: "rgba(255,255,255,0.55)", "stroke-width": "1", rx: "1" }));
      svg.appendChild(ml);
    }

    /* ── pan / zoom ──────────────────────────────────── */
    function initPanZoom() {
      if (panZoomReady) return;
      panZoomReady = true;
      svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        scale = Math.max(0.25, Math.min(10, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
        applyTx();
      }, { passive: false });
      svg.addEventListener("pointerdown", (e) => {
        e.preventDefault(); isDragging = true;
        lastX = e.clientX; lastY = e.clientY;
        svg.setPointerCapture(e.pointerId);
      });
      svg.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        tx += e.clientX - lastX; ty += e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY; applyTx();
      });
      const endDrag = () => { isDragging = false; };
      svg.addEventListener("pointerup",          endDrag);
      svg.addEventListener("pointercancel",      endDrag);
      svg.addEventListener("lostpointercapture", endDrag);
      svg.addEventListener("dblclick", () => { scale = 1; tx = 0; ty = 0; applyTx(); });
    }

    /* ── arrow markers ───────────────────────────────── */
    function addArrowDefs() {
      const defs = svgEl("defs");
      [["arr-imp", "#4e9be0"], ["arr-iby", "#e09a4e"]].forEach(function(pair) {
        const id = pair[0], col = pair[1];
        const m = svgEl("marker", { id: id, markerWidth: 7, markerHeight: 5, refX: 6, refY: 2.5, orient: "auto" });
        m.appendChild(svgEl("polygon", { points: "0 0, 7 2.5, 0 5", fill: col, opacity: "0.9" }));
        defs.appendChild(m);
      });
      svg.appendChild(defs);
    }

    /* ── draw edge ───────────────────────────────────── */
    function drawEdge(parent, x1, y1, x2, y2, role, rFrom, rTo) {
      const color    = role === "import" ? "#4e9be0" : "#e09a4e";
      const markerId = role === "import" ? "arr-imp"  : "arr-iby";
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const sx = x1 + dx / len * (rFrom + 2);
      const sy = y1 + dy / len * (rFrom + 2);
      const ex = x2 - dx / len * (rTo + 8);
      const ey = y2 - dy / len * (rTo + 8);
      if (Math.sqrt((ex - sx) * (ex - sx) + (ey - sy) * (ey - sy)) < 4) return;
      parent.appendChild(svgEl("line", {
        x1: sx, y1: sy, x2: ex, y2: ey,
        stroke: color, "stroke-width": "1.6", "stroke-opacity": "0.7",
        "marker-end": "url(#" + markerId + ")"
      }));
    }

    /* ── draw node (multi / folder view) ────────────── */
    function drawNodeFlat(parent, id, x, y, isPrimary, isKnown) {
      const r    = isPrimary ? 13 : 8;
      const fill = isPrimary ? "var(--vscode-button-background, #0e639c)" : "#777";
      const g    = svgEl("g");
      g.style.cursor = "pointer";
      if (isPrimary) {
        g.appendChild(svgEl("circle", { cx: x, cy: y, r: r + 5, fill: fill, "fill-opacity": "0.12" }));
      }
      const circle = svgEl("circle", {
        cx: x, cy: y, r: r,
        fill: fill, "fill-opacity": isKnown ? (isPrimary ? "0.9" : "0.55") : "0.3",
        stroke: "var(--vscode-editor-background)", "stroke-width": isPrimary ? "2" : "1.5"
      });
      const tip = svgEl("title"); tip.textContent = id; circle.appendChild(tip);
      g.appendChild(circle);
      const textEl = svgEl("text", {
        x: x, y: y + r + 13, "text-anchor": "middle",
        "font-size": isPrimary ? 10 : 9,
        "font-weight": isPrimary ? "600" : "400",
        fill: "currentColor", opacity: isKnown ? (isPrimary ? "0.85" : "0.5") : "0.3"
      });
      textEl.textContent = shortLabel(id);
      g.appendChild(textEl);
      g.addEventListener("click", function(e) { e.stopPropagation(); toggleMulti(id); });
      parent.appendChild(g);
    }

    /* ── welcome / empty state ───────────────────────── */
    function renderEmpty() {
      svg.innerHTML = "";
      viewport = null;
      const g = svgEl("g");
      const defs = svgEl("defs");
      const pat = svgEl("pattern", { id: "dots", width: 22, height: 22, patternUnits: "userSpaceOnUse" });
      pat.appendChild(svgEl("circle", { cx: 1, cy: 1, r: 1, fill: "currentColor", opacity: "0.06" }));
      defs.appendChild(pat); g.appendChild(defs);
      g.appendChild(svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#dots)" }));
      const cx = W / 2, cy = H / 2;
      const hex = svgEl("text", { x: cx, y: cy - 16, "text-anchor": "middle", "font-size": 34, fill: "currentColor", opacity: "0.18" });
      hex.textContent = "\u2B21"; g.appendChild(hex);
      const t1 = svgEl("text", { x: cx, y: cy + 18, "text-anchor": "middle", "font-size": 14, fill: "currentColor", opacity: "0.38" });
      t1.textContent = "Select a file to explore its dependencies";
      const t2 = svgEl("text", { x: cx, y: cy + 38, "text-anchor": "middle", "font-size": 11, fill: "currentColor", opacity: "0.26" });
      t2.textContent = "Click a file in the table or tree \u2014 Ctrl-click to add more";
      g.appendChild(t1); g.appendChild(t2);
      svg.appendChild(g);
    }

    /* ── mode hint ───────────────────────────────────── */
    function showModeHint(line1, line2) {
      svg.innerHTML = "";
      viewport = null;
      const g = svgEl("g");
      const cx = W / 2, cy = H / 2;
      const t1 = svgEl("text", { x: cx, y: cy + 8, "text-anchor": "middle", "font-size": 13, fill: "currentColor", opacity: "0.38" });
      t1.textContent = line1; g.appendChild(t1);
      if (line2) {
        const t2 = svgEl("text", { x: cx, y: cy + 30, "text-anchor": "middle", "font-size": 11, fill: "currentColor", opacity: "0.26" });
        t2.textContent = line2; g.appendChild(t2);
      }
      svg.appendChild(g);
    }

    /* ── force-directed layout ───────────────────────── */
    function forceLayout(nodes, edges) {
      const n = nodes.length;
      if (!n) return;
      if (n === 1) { nodes[0].x = W / 2; nodes[0].y = H / 2; return; }
      nodes.forEach(function(nd, i) {
        const a = (2 * Math.PI * i) / n;
        const r = Math.min(W, H) * 0.3;
        nd.x = W / 2 + Math.cos(a) * r;
        nd.y = H / 2 + Math.sin(a) * r;
        nd.vx = 0; nd.vy = 0;
      });
      const nodeMap = {};
      nodes.forEach(function(nd) { nodeMap[nd.id] = nd; });
      for (let it = 0; it < 180; it++) {
        const alpha = 1 - it / 200;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
            const d2 = dx * dx + dy * dy + 1;
            const d  = Math.sqrt(d2);
            const k  = 5000 / d2;
            const fx = dx / d * k, fy = dy / d * k;
            nodes[i].vx -= fx; nodes[i].vy -= fy;
            nodes[j].vx += fx; nodes[j].vy += fy;
          }
        }
        edges.forEach(function(e) {
          const s = nodeMap[e.source], t = nodeMap[e.target];
          if (!s || !t) return;
          const dx = t.x - s.x, dy = t.y - s.y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          const f  = (d - 130) * 0.05 * alpha;
          s.vx += dx / d * f; s.vy += dy / d * f;
          t.vx -= dx / d * f; t.vy -= dy / d * f;
        });
        nodes.forEach(function(nd) {
          nd.vx += (W / 2 - nd.x) * 0.01 * alpha;
          nd.vy += (H / 2 - nd.y) * 0.01 * alpha;
        });
        nodes.forEach(function(nd) {
          nd.x += nd.vx * 0.5; nd.y += nd.vy * 0.5;
          nd.vx *= 0.8; nd.vy *= 0.8;
          nd.x = Math.max(55, Math.min(W - 55, nd.x));
          nd.y = Math.max(40, Math.min(H - 40, nd.y));
        });
      }
    }

    /* ── multi-file graph ────────────────────────────── */
    function renderMultiGraph() {
      if (!multiSel.size) {
        showModeHint("Click files in the table or tree to add them", "Click again to remove — graph updates live");
        return;
      }
      svg.innerHTML = ""; scale = 1; tx = 0; ty = 0;
      const knownIds   = new Set(data.files.map(function(f) { return f.path; }));
      const primarySet = new Set(multiSel);
      const nodeIds    = new Set(multiSel);
      const edgeList   = [];
      multiSel.forEach(function(id) {
        const fd = data.files.find(function(f) { return f.path === id; });
        if (!fd) return;
        (fd.imports || []).forEach(function(imp) {
          if (knownIds.has(imp)) { edgeList.push({ source: id, target: imp, role: "import" }); nodeIds.add(imp); }
        });
        (fd.importedBy || []).forEach(function(iby) {
          if (knownIds.has(iby)) { edgeList.push({ source: iby, target: id, role: "importedBy" }); nodeIds.add(iby); }
        });
      });
      const nodes = [...nodeIds].map(function(id) {
        return { id: id, primary: primarySet.has(id), known: knownIds.has(id), x: 0, y: 0, vx: 0, vy: 0 };
      });
      forceLayout(nodes, edgeList);
      addArrowDefs();
      viewport = svgEl("g", { id: "vp" }); svg.appendChild(viewport);
      const nodePos = {}; nodes.forEach(function(nd) { nodePos[nd.id] = nd; });
      edgeList.forEach(function(e) {
        const s = nodePos[e.source], t = nodePos[e.target];
        if (s && t) drawEdge(viewport, s.x, s.y, t.x, t.y, e.role, s.primary ? 13 : 8, t.primary ? 13 : 8);
      });
      nodes.forEach(function(nd) { drawNodeFlat(viewport, nd.id, nd.x, nd.y, nd.primary, nd.known); });
      const info = svgEl("text", { x: 10, y: H - 10, "font-size": 10, fill: "currentColor", opacity: "0.4" });
      info.textContent = multiSel.size + " selected  \u2014  " + nodes.length + " nodes, " + edgeList.length + " connections";
      svg.appendChild(info);
      applyTx();
    }

    /* ── folder graph ────────────────────────────────── */
    function renderFolderGraph() {
      if (!curFolder) {
        showModeHint("Click a folder in the tree to view its files", "All intra-folder dependencies are shown as edges");
        return;
      }
      svg.innerHTML = ""; scale = 1; tx = 0; ty = 0;
      const prefix    = curFolder + "/";
      const inFolder  = data.files.filter(function(f) { return f.path === curFolder || f.path.startsWith(prefix); });
      if (!inFolder.length) { showModeHint("No analyzed files in this folder", ""); return; }
      const folderIds = new Set(inFolder.map(function(f) { return f.path; }));
      const edgeList  = [];
      inFolder.forEach(function(fd) {
        (fd.imports || []).forEach(function(imp) {
          if (folderIds.has(imp)) edgeList.push({ source: fd.path, target: imp, role: "import" });
        });
      });
      const nodes = inFolder.map(function(fd) {
        return { id: fd.path, primary: true, known: true, x: 0, y: 0, vx: 0, vy: 0 };
      });
      forceLayout(nodes, edgeList);
      addArrowDefs();
      viewport = svgEl("g", { id: "vp" }); svg.appendChild(viewport);
      const nodePos = {}; nodes.forEach(function(nd) { nodePos[nd.id] = nd; });
      edgeList.forEach(function(e) {
        const s = nodePos[e.source], t = nodePos[e.target];
        if (s && t) drawEdge(viewport, s.x, s.y, t.x, t.y, e.role, 11, 11);
      });
      nodes.forEach(function(nd) { drawNodeFlat(viewport, nd.id, nd.x, nd.y, true, true); });
      const lbl = svgEl("text", { x: 10, y: H - 10, "font-size": 10, fill: "currentColor", opacity: "0.4" });
      lbl.textContent = curFolder + "/  \u2014  " + inFolder.length + " files, " + edgeList.length + " connections";
      svg.appendChild(lbl);
      applyTx();
    }

    /* ── git diff graph ──────────────────────────────── */
    function addDiffArrowDefs() {
      const defs = svgEl("defs");
      [["arr-add", "#4ec94e"], ["arr-rem", "#e04e4e"]].forEach(function(pair) {
        const id = pair[0], col = pair[1];
        const m = svgEl("marker", { id: id, markerWidth: 7, markerHeight: 5, refX: 6, refY: 2.5, orient: "auto" });
        m.appendChild(svgEl("polygon", { points: "0 0, 7 2.5, 0 5", fill: col, opacity: "0.9" }));
        defs.appendChild(m);
      });
      svg.appendChild(defs);
    }
    function drawDiffEdge(parent, x1, y1, x2, y2, role) {
      const color    = role === "added" ? "#4ec94e" : "#e04e4e";
      const markerId = role === "added" ? "arr-add"  : "arr-rem";
      const r = 11;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const sx = x1 + dx / len * (r + 2), sy = y1 + dy / len * (r + 2);
      const ex = x2 - dx / len * (r + 8), ey = y2 - dy / len * (r + 8);
      if (Math.sqrt((ex - sx) * (ex - sx) + (ey - sy) * (ey - sy)) < 4) return;
      parent.appendChild(svgEl("line", {
        x1: sx, y1: sy, x2: ex, y2: ey,
        stroke: color, "stroke-width": "1.8", "stroke-opacity": "0.85",
        "marker-end": "url(#" + markerId + ")"
      }));
    }
    function renderDiffGraph() {
      svg.innerHTML = "";
      scale = 1; tx = 0; ty = 0;
      if (!diffData) { renderEmpty(); return; }
      const { addedLinks, removedLinks } = diffData;
      const involvedIds = new Set();
      addedLinks.concat(removedLinks).forEach(function(lnk) {
        involvedIds.add(lnk.source); involvedIds.add(lnk.target);
      });
      if (involvedIds.size === 0) {
        showModeHint("No dependency changes detected", "The import graph is identical at commit " + diffData.sha);
        return;
      }
      const knownIds = new Set(data.files.map(function(f) { return f.path; }));
      const nodes = Array.from(involvedIds).map(function(id) {
        return { id: id, primary: knownIds.has(id), known: true, x: 0, y: 0, vx: 0, vy: 0 };
      });
      const edges = addedLinks.map(function(l) { return { source: l.source, target: l.target, role: "added" }; })
        .concat(removedLinks.map(function(l) { return { source: l.source, target: l.target, role: "removed" }; }));
      forceLayout(nodes, edges);
      addDiffArrowDefs();
      viewport = svgEl("g", { id: "vp" });
      svg.appendChild(viewport);
      const nodePos = {};
      nodes.forEach(function(nd) { nodePos[nd.id] = nd; });
      edges.forEach(function(e) {
        const s = nodePos[e.source], t = nodePos[e.target];
        if (s && t) drawDiffEdge(viewport, s.x, s.y, t.x, t.y, e.role);
      });
      nodes.forEach(function(nd) { drawNodeFlat(viewport, nd.id, nd.x, nd.y, nd.primary, nd.known); });
      const lbl = svgEl("text", { x: 10, y: H - 10, "font-size": 10, fill: "currentColor", opacity: "0.4" });
      lbl.textContent = diffData.sha + "  \u2014  \u25cf " + addedLinks.length + " added  \u25cf " + removedLinks.length + " removed";
      svg.appendChild(lbl);
      applyTx();
    }

    /* ── mode management ─────────────────────────────── */
    function updateBadge() {
      const badge = document.getElementById("graph-badge");
      if (graphMode === "multi" && multiSel.size > 0) {
        badge.textContent = multiSel.size + " file" + (multiSel.size !== 1 ? "s" : "") + " selected";
        badge.style.display = "inline-block";
      } else if (graphMode === "folder" && curFolder) {
        badge.textContent = (curFolder.split("/").pop() || curFolder) + "/";
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }

    function setMode(mode) {
      graphMode = mode;
      document.querySelectorAll(".mode-btn").forEach(function(b) {
        b.classList.toggle("active", b.dataset.mode === mode);
      });
      document.getElementById("tree-scroll").classList.toggle("mode-folder", mode === "folder");
      const gitPanel = document.getElementById("git-panel");
      if (mode !== "diff") { gitPanel.classList.remove("visible"); diffData = null; }
      if (mode === "multi") {
        curFolder = null;
        document.querySelectorAll(".t-folder-li.t-folder-on").forEach(function(r) { r.classList.remove("t-folder-on"); });
        renderMultiGraph(); updateBadge();
      } else if (mode === "folder") {
        multiSel.clear();
        document.querySelectorAll(".file-row.multi-on, .file-row.row-active").forEach(function(r) { r.classList.remove("multi-on"); r.classList.remove("row-active"); });
        document.querySelectorAll(".t-file.t-active").forEach(function(r) { r.classList.remove("t-active"); });
        renderFolderGraph(); updateBadge();
      } else if (mode === "diff") {
        multiSel.clear(); curFolder = null;
        document.querySelectorAll(".file-row.multi-on, .file-row.row-active").forEach(function(r) { r.classList.remove("multi-on"); r.classList.remove("row-active"); });
        document.querySelectorAll(".t-file.t-active").forEach(function(r) { r.classList.remove("t-active"); });
        document.querySelectorAll(".t-folder-li.t-folder-on").forEach(function(r) { r.classList.remove("t-folder-on"); });
        gitPanel.classList.add("visible");
        const sel = document.getElementById("git-commit-sel");
        sel.disabled = true; sel.innerHTML = '<option value="">Loading…</option>';
        document.getElementById("git-status-txt").textContent = "Fetching git log…";
        if (vscodeApi) vscodeApi.postMessage({ type: "getGitLog" });
        renderEmpty();
      }
    }

    /* ── select a file (clears multi-sel, shows neighbours) ── */
    function selectFile(fileId) {
      if (graphMode !== "multi") setMode("multi");
      multiSel.clear();
      document.querySelectorAll(".file-row.multi-on, .file-row.row-active").forEach(function(r) { r.classList.remove("multi-on"); r.classList.remove("row-active"); });
      document.querySelectorAll(".t-file.t-active").forEach(function(r) { r.classList.remove("t-active"); });
      multiSel.add(fileId);
      document.querySelectorAll(".file-row").forEach(function(r) {
        if (r.dataset.id === fileId) { r.classList.add("row-active"); r.scrollIntoView({ block: "nearest" }); }
      });
      document.querySelectorAll(".t-file").forEach(function(r) {
        if (r.dataset.path === fileId) r.classList.add("t-active");
      });
      document.querySelectorAll(".critical-item.c-active").forEach(function(r) { r.classList.remove("c-active"); });
      document.querySelectorAll(".critical-item").forEach(function(r) {
        if (r.dataset.path === fileId) r.classList.add("c-active");
      });
      updateBadge(); renderMultiGraph();
    }

    /* ── toggle file in multi selection ─────────────── */
    function toggleMulti(fileId) {
      if (graphMode !== "multi") setMode("multi");
      if (multiSel.has(fileId)) {
        multiSel.delete(fileId);
        document.querySelectorAll(".file-row").forEach(function(r) { if (r.dataset.id === fileId) { r.classList.remove("multi-on"); r.classList.remove("row-active"); } });
        document.querySelectorAll(".t-file").forEach(function(r) { if (r.dataset.path === fileId) r.classList.remove("t-active"); });
      } else {
        multiSel.add(fileId);
        document.querySelectorAll(".file-row").forEach(function(r) { if (r.dataset.id === fileId) { r.classList.add("row-active"); r.classList.remove("multi-on"); } });
        document.querySelectorAll(".t-file").forEach(function(r) { if (r.dataset.path === fileId) r.classList.add("t-active"); });
      }
      updateBadge(); renderMultiGraph();
    }

    /* ── select a folder ─────────────────────────────── */
    function selectFolder(folderPath) {
      curFolder = folderPath;
      document.querySelectorAll(".t-folder-li.t-folder-on").forEach(function(el) { el.classList.remove("t-folder-on"); });
      document.querySelectorAll(".t-folder-li").forEach(function(el) {
        if (el.dataset.folder === folderPath) el.classList.add("t-folder-on");
      });
      updateBadge(); renderFolderGraph();
    }

    /* ── mode button clicks ──────────────────────────── */
    document.querySelectorAll(".mode-btn").forEach(function(btn) {
      btn.addEventListener("click", function() { setMode(btn.dataset.mode); });
    });

    /* ── tree clicks ─────────────────────────────────── */
    document.getElementById("tree-scroll").addEventListener("click", function(e) {
      const file = e.target.closest(".t-file");
      if (file && file.dataset.path) {
        toggleMulti(file.dataset.path); return;
      }
      if (graphMode === "folder") {
        const folderLi = e.target.closest(".t-folder-li");
        if (folderLi && folderLi.dataset.folder) selectFolder(folderLi.dataset.folder);
      }
    });

    /* ── file table rows ─────────────────────────────── */
    document.querySelectorAll(".file-row").forEach(function(row) {
      row.addEventListener("click", function() {
        toggleMulti(row.dataset.id);
      });
    });

    /* ── critical file items ─────────────────────────── */
    document.querySelectorAll(".critical-item").forEach(function(item) {
      item.addEventListener("click", function() { toggleMulti(item.dataset.path); });
    });

    /* ── file search ─────────────────────────────────── */
    document.getElementById("file-search").addEventListener("input", function() {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll(".file-row").forEach(function(row) {
        row.style.display = (!q || row.querySelector(".td-path").textContent.toLowerCase().includes(q)) ? "" : "none";
      });
    });
    /* ── workspace tabs ─────────────────────────────── */
    let activeWs = "";
    document.querySelectorAll(".ws-tab").forEach(function(tab) {
      tab.addEventListener("click", function() {
        activeWs = tab.dataset.ws || "";
        document.querySelectorAll(".ws-tab").forEach(function(t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.querySelectorAll(".file-row").forEach(function(row) {
          const id = row.dataset.id || "";
          row.style.display = (!activeWs || id.startsWith(activeWs + "/")) ? "" : "none";
        });
        multiSel.clear();
        document.querySelectorAll(".file-row.multi-on, .file-row.row-active").forEach(function(r) { r.classList.remove("multi-on"); r.classList.remove("row-active"); });
        document.querySelectorAll(".t-file.t-active").forEach(function(r) { r.classList.remove("t-active"); });
        setMode("multi");
      });
    });

    /* ── SVG / PNG / JSON / CSV export ─────────────── */
    function postSaveFile(format, content, filename) {
      if (vscodeApi) {
        vscodeApi.postMessage({ type: "saveFile", format: format, content: content, filename: filename });
      } else {
        // fallback outside VS Code
        const mimeMap = { svg: "image/svg+xml", json: "application/json", csv: "text/csv" };
        const a = document.createElement("a");
        if (format === "png") {
          a.href = "data:image/png;base64," + content;
        } else {
          a.href = "data:" + (mimeMap[format] || "application/octet-stream") + ";charset=utf-8," + encodeURIComponent(content);
        }
        a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    }
    function resolveGraphSvg() {
      const clone = svg.cloneNode(true);
      clone.setAttribute("width", "860");
      clone.setAttribute("height", "430");
      const cs = getComputedStyle(document.body);
      const fg  = cs.color || "#c8c8c8";
      const bg  = cs.getPropertyValue("--vscode-editor-background").trim()  || "#1e1e1e";
      const acc = cs.getPropertyValue("--vscode-button-background").trim() || "#0e639c";
      let s = new XMLSerializer().serializeToString(clone);
      s = s.replace(/currentColor/g, fg);
      s = s.replace(/var\(--vscode-editor-background[^)]*\)/g, bg);
      s = s.replace(/var\(--vscode-button-background(?:,[^)]*)?\)/g, acc);
      s = s.replace(/var\(--vscode-[^)]+\)/g, "#888");
      return s;
    }
    const exportSvgBtn = document.getElementById("export-svg-btn");
    if (exportSvgBtn) {
      exportSvgBtn.addEventListener("click", function() {
        postSaveFile("svg", resolveGraphSvg(), "project-graph.svg");
      });
    }
    const exportPngBtn = document.getElementById("export-png-btn");
    if (exportPngBtn) {
      exportPngBtn.addEventListener("click", function() {
        const s = resolveGraphSvg();
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement("canvas");
          canvas.width = 1720; canvas.height = 860;
          const ctx = canvas.getContext("2d");
          const cs2 = getComputedStyle(document.body);
          ctx.fillStyle = cs2.getPropertyValue("--vscode-editor-background").trim() || "#1e1e1e";
          ctx.fillRect(0, 0, 1720, 860);
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          postSaveFile("png", dataUrl.split(",")[1] || "", "project-graph.png");
        };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
      });
    }
    const exportJsonBtn = document.getElementById("export-json-btn");
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", function() {
        const payload = {
          workspace: data.workspaceName,
          generatedAt: data.generatedAt,
          files: data.files.map(function(f) {
            return { path: f.path, extension: f.extension, sizeMb: f.sizeMb, imports: f.imports, importedBy: f.importedBy };
          })
        };
        postSaveFile("json", JSON.stringify(payload, null, 2), "project-dependencies.json");
      });
    }
    const exportCsvBtn = document.getElementById("export-csv-btn");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", function() {
        const rows = ["source,target"];
        data.files.forEach(function(f) {
          (f.imports || []).forEach(function(imp) {
            rows.push('"' + f.path.replace(/"/g, '""') + '","' + imp.replace(/"/g, '""') + '"');
          });
        });
        postSaveFile("csv", rows.join("\\n"), "project-dependencies.csv");
      });
    }
    /* ── git load snapshot ───────────────────────────── */
    const gitLoadSnapshotBtn = document.getElementById("git-load-snapshot-btn");
    if (gitLoadSnapshotBtn) {
      gitLoadSnapshotBtn.addEventListener("click", function() {
        if (vscodeApi) {
          vscodeApi.postMessage({ type: "loadSnapshot" });
          document.getElementById("git-status-txt").textContent = "Select a JSON snapshot file…";
        } else {
          document.getElementById("git-status-txt").textContent = "Not available outside VS Code";
        }
      });
    }
    /* ── git commit select ───────────────────────────── */
    document.getElementById("git-commit-sel").addEventListener("change", function() {
      const sha = this.value;
      if (!sha) return;
      document.getElementById("git-status-txt").textContent = "Comparing with " + sha + "\u2026";
      diffData = null;
      if (vscodeApi) { vscodeApi.postMessage({ type: "getDiffAt", sha: sha }); }
      else { document.getElementById("git-status-txt").textContent = "Git bridge unavailable"; }
    });
    /* ── messages from extension ─────────────────────── */
    window.addEventListener("message", function(e) {
      const msg = e.data;
      if (!msg || !msg.type) return;
      if (msg.type === "gitLog") {
        const sel = document.getElementById("git-commit-sel");
        const statusEl = document.getElementById("git-status-txt");
        if (msg.error || !msg.commits || msg.commits.length === 0) {
          sel.innerHTML = '<option value="">' + escapeHtml(msg.error || "No commits found") + '</option>';
          statusEl.textContent = msg.error || "No commits found";
          return;
        }
        sel.disabled = false;
        sel.innerHTML = '<option value="">Select a commit\u2026</option>' +
          msg.commits.map(function(c) {
            return '<option value="' + escapeHtml(c.sha) + '">' + escapeHtml(c.sha) + ' \u2013 ' + escapeHtml(c.message) + '</option>';
          }).join("");
        statusEl.textContent = msg.commits.length + " commits loaded";
      } else if (msg.type === "diffData") {
        const statusEl = document.getElementById("git-status-txt");
        if (msg.error) { statusEl.textContent = "Error: " + msg.error; return; }
        if (graphMode !== "diff") return;
        diffData = msg;
        renderDiffGraph();
        statusEl.textContent = "\u25cf " + msg.addedLinks.length + " added  \u25cf " + msg.removedLinks.length + " removed";
      } else if (msg.type === "snapshotDiffData") {
        const statusEl = document.getElementById("git-status-txt");
        if (graphMode !== "diff") return;
        diffData = { sha: msg.label || "snapshot", addedLinks: msg.addedLinks || [], removedLinks: msg.removedLinks || [] };
        renderDiffGraph();
        statusEl.textContent = "\u25cf " + (msg.addedLinks || []).length + " added  \u25cf " + (msg.removedLinks || []).length + " removed  (\u2195 " + msg.label + ")";
      } else if (msg.type === "snapshotError") {
        document.getElementById("git-status-txt").textContent = "Error: " + (msg.error || "Unknown error");
      }
    });
    /* ── init ────────────────────────────────────────── */
    initPanZoom();
    renderEmpty();
  })();
  </script>
</body>
</html>`;
}