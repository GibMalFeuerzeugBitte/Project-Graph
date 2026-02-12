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

function renderTree(node: FolderNode): string {
  const folderItems = node.folders
    .map(
      (folder) =>
        `<li><details open><summary><span class="tag dir">DIR</span><span class="name">${escapeHtml(folder.name)}</span></summary>${renderTree(folder)}</details></li>`
    )
    .join("");
  const fileItems = node.files
    .map((file) => `<li><span class="tag file">FILE</span><span class="name">${escapeHtml(file)}</span></li>`)
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
    :root { color-scheme: light dark; }
    body { font-family: var(--vscode-font-family); margin: 0; padding: 16px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
    .top { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .card { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 10px; background: var(--vscode-editorWidget-background); }
    .k { font-size: 12px; opacity: 0.8; margin-bottom: 4px; }
    .v { font-size: 18px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1.2fr 1.35fr; gap: 12px; margin-top: 10px; }
    .panel { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 10px; background: var(--vscode-sideBar-background); }
    h2 { margin: 0 0 8px 0; font-size: 14px; }
    h3 { margin: 8px 0; font-size: 13px; color: var(--vscode-foreground); }
    ul { margin: 4px 0 8px 16px; padding: 0; }
    li { margin: 3px 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid var(--vscode-panel-border); padding: 6px 4px; text-align: left; vertical-align: top; }
    th { color: var(--vscode-editor-foreground); background: var(--vscode-editorWidget-background); position: sticky; top: 0; }
    .small { font-size: 12px; opacity: 0.85; }
    .list-block { max-height: 280px; overflow: auto; border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 8px; background: var(--vscode-editorWidget-background); }
    .tree-block { max-height: 460px; }
    #graph { width: 100%; height: 460px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editorWidget-background); cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none; }
    #graph * { user-select: none; -webkit-user-select: none; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    summary { cursor: pointer; }
    .tree, .tree ul { list-style: none; margin: 0; padding-left: 16px; }
    .tree > li { padding: 2px 0; }
    .tree li { position: relative; }
    .tree li::before {
      content: "";
      position: absolute;
      left: -10px;
      top: 0;
      bottom: -2px;
      width: 1px;
      background: var(--vscode-panel-border);
      opacity: 0.7;
    }
    .tree li::after {
      content: "";
      position: absolute;
      left: -10px;
      top: 12px;
      width: 10px;
      height: 1px;
      background: var(--vscode-panel-border);
      opacity: 0.7;
    }
    .tree > li::before,
    .tree > li::after { display: none; }
    .tag {
      display: inline-block;
      min-width: 28px;
      text-align: center;
      font-size: 10px;
      line-height: 1;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 2px 4px;
      margin-right: 6px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      vertical-align: middle;
    }
    .tag.dir {
      color: var(--vscode-charts-blue);
      border-color: var(--vscode-panel-border);
    }
    .tag.file {
      color: var(--vscode-charts-green);
      border-color: var(--vscode-panel-border);
    }
    .name { vertical-align: middle; }
    details > summary { list-style: none; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before {
      content: "▸";
      display: inline-block;
      margin-right: 6px;
      color: var(--vscode-descriptionForeground);
      transform: rotate(0deg);
      transition: transform 0.08s linear;
    }
    details[open] > summary::before { transform: rotate(90deg); }
  </style>
</head>
<body>
  <div class="top">
    <div class="card"><div class="k">Workspace</div><div class="v">${escapeHtml(data.workspaceName)}</div></div>
    <div class="card"><div class="k">Total Files</div><div class="v">${data.totalFiles}</div></div>
    <div class="card"><div class="k">Total Size</div><div class="v">${data.totalSizeMb} MB</div><div class="small">Analyzed: ${data.analyzedSizeMb} MB across ${data.analyzedFiles} files</div></div>
    <div class="card"><div class="k">Main File</div><div class="v">${escapeHtml(data.mainFile ?? "-")}</div><div class="small">${data.mainFileSizeMb ?? 0} MB</div></div>
  </div>

  <div class="grid">
    <section class="panel">
      <h2>Folder & Program Structure</h2>
      <div class="list-block tree-block">${treeHtml}</div>
    </section>

    <section class="panel">
      <h2>Dependency Connections (Graph)</h2>
      <svg id="graph" viewBox="0 0 900 460" preserveAspectRatio="xMidYMid meet"></svg>
      <div class="small">Mouse wheel: zoom | Drag: pan | Blau = direkte Abhängigkeiten, dezente graue Linien = Kontextbeziehungen kleiner Dateien.</div>
    </section>
  </div>

  <div class="grid">
    <section class="panel">
      <h2>Program Size (All Files)</h2>
      <table>
        <thead>
          <tr><th>File</th><th>Size (MB)</th><th>Imports</th><th>Imported By</th></tr>
        </thead>
        <tbody>
          ${data.files
            .map(
              (file) => `<tr>
            <td>${escapeHtml(file.path)}</td>
            <td>${file.sizeMb}</td>
            <td>${file.imports.length}</td>
            <td>${file.importedBy.length}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Critical Files</h2>
      <div class="small">Most important files by dependency impact (and main-file relevance).</div>
      <div class="list-block">
        <ul>${data.criticalFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join("") || "<li>None</li>"}</ul>
      </div>
    </section>
  </div>

  <script nonce="${nonce}">
    const data = ${safeData};
    const svg = document.getElementById("graph");
    const width = 900;
    const height = 460;

    function drawGraph() {
      svg.innerHTML = "";
      const nodes = data.graphNodes.slice(0, 120);
      const nodeSet = new Set(nodes.map(n => n.id));
      const links = data.graphLinks.filter(link => nodeSet.has(link.source) && nodeSet.has(link.target));
      const viewport = document.createElementNS("http://www.w3.org/2000/svg", "g");
      svg.appendChild(viewport);

      let scale = 1;
      let translateX = 0;
      let translateY = 0;
      let isDragging = false;
      let lastX = 0;
      let lastY = 0;

      function updateTransform() {
        viewport.setAttribute("transform", "translate(" + translateX + " " + translateY + ") scale(" + scale + ")");
      }

      if (nodes.length === 0) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", "20");
        text.setAttribute("y", "28");
        text.setAttribute("fill", "currentColor");
        text.setAttribute("opacity", "0.8");
        text.textContent = "No dependency nodes found for the selected file extensions.";
        viewport.appendChild(text);
        return;
      }

      const index = new Map(nodes.map((n, i) => [n.id, i]));
      const perRow = Math.max(4, Math.ceil(Math.sqrt(nodes.length * 1.8)));
      const rowCount = Math.max(1, Math.ceil(nodes.length / perRow));
      const marginX = 28;
      const marginY = 28;
      const gapX = perRow > 1 ? (width - marginX * 2) / (perRow - 1) : 0;
      const gapY = rowCount > 1 ? (height - marginY * 2) / (rowCount - 1) : 0;

      const positions = nodes.map((n, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        return {
          ...n,
          x: marginX + col * gapX,
          y: marginY + row * gapY
        };
      });

      const degreeById = new Map();
      for (const node of nodes) {
        degreeById.set(node.id, 0);
      }
      for (const link of links) {
        degreeById.set(link.source, (degreeById.get(link.source) || 0) + 1);
        degreeById.set(link.target, (degreeById.get(link.target) || 0) + 1);
      }

      const sortedSizes = nodes.map((node) => node.sizeMb).sort((a, b) => a - b);
      const medianSize = sortedSizes.length > 0
        ? sortedSizes[Math.floor(sortedSizes.length / 2)]
        : 0;

      const secondaryCandidates = positions.filter((node) => {
        const degree = degreeById.get(node.id) || 0;
        return degree <= 1 && node.sizeMb <= medianSize;
      });

      const byTopFolder = new Map();
      for (const node of secondaryCandidates) {
        const topFolder = node.id.includes("/") ? node.id.split("/")[0] : "__root__";
        if (!byTopFolder.has(topFolder)) {
          byTopFolder.set(topFolder, []);
        }
        byTopFolder.get(topFolder).push(node);
      }

      const secondaryLinks = [];
      for (const groupNodes of byTopFolder.values()) {
        groupNodes.sort((a, b) => a.y - b.y || a.x - b.x);
        const maxGroupLinks = Math.min(10, groupNodes.length - 1);
        for (let index = 0; index < maxGroupLinks; index += 1) {
          secondaryLinks.push({ source: groupNodes[index], target: groupNodes[index + 1] });
        }
      }

      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("x", "0");
      bg.setAttribute("y", "0");
      bg.setAttribute("width", String(width));
      bg.setAttribute("height", String(height));
      bg.setAttribute("fill", "transparent");
      svg.appendChild(bg);

      for (const link of links) {
        const source = positions[index.get(link.source)];
        const target = positions[index.get(link.target)];
        if (!source || !target) continue;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(source.x));
        line.setAttribute("y1", String(source.y));
        line.setAttribute("x2", String(target.x));
        line.setAttribute("y2", String(target.y));
        line.setAttribute("stroke", "var(--vscode-charts-blue, currentColor)");
        line.setAttribute("stroke-opacity", "0.6");
        line.setAttribute("stroke-width", "1.4");
        viewport.appendChild(line);
      }

      for (const link of secondaryLinks) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(link.source.x));
        line.setAttribute("y1", String(link.source.y));
        line.setAttribute("x2", String(link.target.x));
        line.setAttribute("y2", String(link.target.y));
        line.setAttribute("stroke", "var(--vscode-descriptionForeground, currentColor)");
        line.setAttribute("stroke-opacity", "0.25");
        line.setAttribute("stroke-width", "0.9");
        line.setAttribute("stroke-dasharray", "3 3");
        viewport.appendChild(line);
      }

      for (const node of positions) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(node.x));
        circle.setAttribute("cy", String(node.y));
        circle.setAttribute("r", String(Math.max(3, Math.min(9, node.sizeMb * 1.8 + 3))));
        circle.setAttribute("fill", "var(--vscode-charts-green, currentColor)");
        circle.setAttribute("fill-opacity", "0.9");
        viewport.appendChild(circle);

        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = node.id + " (" + node.sizeMb + " MB)";
        circle.appendChild(title);

        if (nodes.length <= 36) {
          const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
          label.setAttribute("x", String(node.x + 6));
          label.setAttribute("y", String(node.y - 6));
          label.setAttribute("fill", "currentColor");
          label.setAttribute("font-size", "10");
          label.setAttribute("opacity", "0.9");
          label.textContent = node.label;
          viewport.appendChild(label);
        }
      }

      updateTransform();

      svg.addEventListener("wheel", (event) => {
        event.preventDefault();
        const zoom = event.deltaY < 0 ? 1.1 : 0.9;
        const nextScale = Math.max(0.4, Math.min(6, scale * zoom));
        scale = nextScale;
        updateTransform();
      }, { passive: false });

      svg.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        isDragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        svg.style.cursor = "grabbing";
        svg.setPointerCapture(event.pointerId);
      });

      svg.addEventListener("pointermove", (event) => {
        event.preventDefault();
        if (!isDragging) {
          return;
        }
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        translateX += dx;
        translateY += dy;
        lastX = event.clientX;
        lastY = event.clientY;
        updateTransform();
      });

      svg.addEventListener("pointerup", () => {
        isDragging = false;
        svg.style.cursor = "grab";
      });

      svg.addEventListener("pointercancel", () => {
        isDragging = false;
        svg.style.cursor = "grab";
      });

      svg.addEventListener("lostpointercapture", () => {
        isDragging = false;
        svg.style.cursor = "grab";
      });

      svg.addEventListener("dblclick", () => {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
      });
    }

    drawGraph();
  </script>
</body>
</html>`;
}