import * as path from "node:path";
import * as vscode from "vscode";
import { DashboardData, FileRecord, FolderNode } from "./types";

const DEFAULT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".pyw",
  ".json",
  ".jsonc",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sql",
  ".db",
  ".sqlite",
  ".yaml",
  ".yml",
  ".xml",
  ".vsix",
  ".exe",
  ".java",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb"
]);

const JS_TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const ALWAYS_INCLUDED_EXTENSIONS = new Set([".exe"]);

function toPosixRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).replace(/\\/g, "/");
}

function pathKey(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase();
}

function bytesToMb(bytes: number): number {
  return Number((bytes / (1024 * 1024)).toFixed(3));
}

function splitPathSegments(relativePath: string): string[] {
  return relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
}

function isExcludedPath(relativePath: string, excludedFolders: Set<string>): boolean {
  const segments = splitPathSegments(relativePath).map((segment) => segment.toLowerCase());
  return segments.some((segment) => excludedFolders.has(segment));
}

function mainFilePriority(pathValue: string, extension: string): number {
  const lower = pathValue.toLowerCase();
  const baseName = path.basename(lower);
  let score = 0;

  if (extension === ".exe") {
    score += 50;
  }
  if (extension === ".vsix") {
    score += 48;
  }
  if (extension === ".pyw") {
    score += 25;
  }
  if (extension === ".html" || extension === ".htm") {
    score += 20;
  }
  if (extension === ".sql" || extension === ".db" || extension === ".sqlite") {
    score += 18;
  }
  if (extension === ".json" || extension === ".jsonc") {
    score += 14;
  }

  if (
    baseName === "package.json" ||
    baseName === "package-lock.json" ||
    baseName === "extension.ts" ||
    baseName === "extension.js" ||
    baseName === "manifest.json" ||
    baseName === "theme.json" ||
    baseName === "launch.json" ||
    baseName === "index.html" ||
    baseName === "main.html" ||
    baseName === "app.html" ||
    baseName === "main.sql" ||
    baseName === "schema.sql"
  ) {
    score += 35;
  }

  if (
    lower.includes("/src/") ||
    lower.includes("/core/") ||
    lower.includes("/app/") ||
    lower.includes("/extension/") ||
    lower.includes("/database/")
  ) {
    score += 10;
  }

  if (lower.includes("main") || lower.includes("app") || lower.includes("dashboard") || lower.includes("start")) {
    score += 15;
  }
  if (lower.includes("core/")) {
    score += 12;
  }

  return score;
}

function buildFolderTree(filePaths: string[]): FolderNode {
  const root: FolderNode = { name: "/", files: [], folders: [] };

  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    let current = root;

    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      let next = current.folders.find((folder) => folder.name === part);
      if (!next) {
        next = { name: part, files: [], folders: [] };
        current.folders.push(next);
      }
      current = next;
    }

    current.files.push(parts[parts.length - 1]);
  }

  const sortNode = (node: FolderNode): void => {
    node.files.sort((a, b) => a.localeCompare(b));
    node.folders.sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of node.folders) {
      sortNode(folder);
    }
  };

  sortNode(root);
  return root;
}

function extractImports(content: string, extension: string): string[] {
  const imports = new Set<string>();

  if (JS_TS_EXTENSIONS.includes(extension)) {
    const importFromRegex = /import\s+[^"'`]*?from\s+["'`]([^"'`]+)["'`]/g;
    const sideEffectRegex = /import\s+["'`]([^"'`]+)["'`]/g;
    const requireRegex = /require\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
    const dynamicImportRegex = /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

    for (const regex of [importFromRegex, sideEffectRegex, requireRegex, dynamicImportRegex]) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        imports.add(match[1]);
      }
    }
  } else if (extension === ".py" || extension === ".pyw") {
    const fromRegex = /^\s*from\s+([\.\w]+)\s+import\s+/gm;
    const importRegex = /^\s*import\s+([\.\w\s,]+)$/gm;

    let match: RegExpExecArray | null;
    while ((match = fromRegex.exec(content)) !== null) {
      imports.add(match[1].trim());
    }

    while ((match = importRegex.exec(content)) !== null) {
      const rawItems = match[1].split(",").map((item) => item.trim()).filter(Boolean);
      for (const rawItem of rawItems) {
        const [moduleName] = rawItem.split(/\s+as\s+/i);
        imports.add(moduleName.trim());
      }
    }
  }

  return [...imports];
}

function resolveJsTsImport(
  importerAbsolute: string,
  specifier: string,
  rootPath: string,
  byAbsoluteKey: Map<string, FileRecord>
): string | undefined {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return undefined;
  }

  const importerDir = path.dirname(importerAbsolute);
  const base = specifier.startsWith(".")
    ? path.resolve(importerDir, specifier)
    : path.resolve(rootPath, `.${specifier}`);

  const candidatePaths = new Set<string>();
  candidatePaths.add(base);
  for (const ext of JS_TS_EXTENSIONS) {
    candidatePaths.add(`${base}${ext}`);
    candidatePaths.add(path.join(base, `index${ext}`));
  }

  for (const candidate of candidatePaths) {
    const key = pathKey(candidate);
    const file = byAbsoluteKey.get(key);
    if (file) {
      return file.path;
    }
  }

  return undefined;
}

function resolvePythonImport(
  importerAbsolute: string,
  specifier: string,
  rootPath: string,
  byAbsoluteKey: Map<string, FileRecord>
): string | undefined {
  const importerDir = path.dirname(importerAbsolute);

  const pythonModuleCandidates = (basePath: string): string[] => [
    `${basePath}.py`,
    `${basePath}.pyw`,
    path.join(basePath, "__init__.py")
  ];

  const tryPaths = (modulePath: string): string | undefined => {
    const dotted = modulePath.replace(/\./g, "/");
    const baseFromRoot = path.resolve(rootPath, dotted);
    const baseFromImporter = path.resolve(importerDir, dotted);
    const candidates = [
      ...pythonModuleCandidates(baseFromRoot),
      ...pythonModuleCandidates(baseFromImporter)
    ];

    for (const candidate of candidates) {
      const file = byAbsoluteKey.get(pathKey(candidate));
      if (file) {
        return file.path;
      }
    }

    return undefined;
  };

  if (specifier.startsWith(".")) {
    const dotCount = specifier.match(/^\.+/)?.[0].length ?? 0;
    const moduleName = specifier.slice(dotCount);
    let baseDir = importerDir;
    for (let index = 1; index < dotCount; index += 1) {
      baseDir = path.dirname(baseDir);
    }
    const modulePath = moduleName ? moduleName.replace(/\./g, "/") : "";
    const base = path.resolve(baseDir, modulePath);
    const candidates = pythonModuleCandidates(base);

    for (const candidate of candidates) {
      const file = byAbsoluteKey.get(pathKey(candidate));
      if (file) {
        return file.path;
      }
    }
    return undefined;
  }

  return tryPaths(specifier);
}

export async function analyzeWorkspace(): Promise<DashboardData | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }

  const config = vscode.workspace.getConfiguration("projectGraph");
  const configuredExtensions = config.get<string[]>("includeExtensions", []);
  const configuredExcludedFolders = config.get<string[]>("excludeFolders", []);
  const excludedFolders = new Set(configuredExcludedFolders.map((folderName) => folderName.toLowerCase()));
  const activeExtensions = new Set(
    (configuredExtensions.length > 0 ? configuredExtensions : [...DEFAULT_EXTENSIONS]).map((ext) =>
      ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    )
  );
  for (const extension of ALWAYS_INCLUDED_EXTENSIONS) {
    activeExtensions.add(extension);
  }

  const allUris = await vscode.workspace.findFiles("**/*");

  const rootPath = folder.uri.fsPath;
  const allRootFilePaths: string[] = [];
  let allRootSizeBytes = 0;
  const allFilePaths: string[] = [];
  const fileRecords: FileRecord[] = [];
  const byAbsoluteKey = new Map<string, FileRecord>();
  const byRelativePath = new Map<string, string>();

  for (const uri of allUris) {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type !== vscode.FileType.File) {
      continue;
    }

    const relativePath = toPosixRelative(rootPath, uri.fsPath);
    allRootFilePaths.push(relativePath);
    allRootSizeBytes += stat.size;

    if (isExcludedPath(relativePath, excludedFolders)) {
      continue;
    }

    allFilePaths.push(relativePath);

    const extension = path.extname(uri.fsPath).toLowerCase();
    if (!activeExtensions.has(extension)) {
      continue;
    }

    const record: FileRecord = {
      path: relativePath,
      extension,
      sizeBytes: stat.size,
      sizeMb: bytesToMb(stat.size),
      imports: [],
      importedBy: []
    };

    fileRecords.push(record);
    byAbsoluteKey.set(pathKey(uri.fsPath), record);
    byRelativePath.set(relativePath, uri.fsPath);
  }

  for (const record of fileRecords) {
    const absolutePath = byRelativePath.get(record.path);
    if (!absolutePath) {
      continue;
    }

    const content = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath))).toString("utf8");
    const specs = extractImports(content, record.extension);

    for (const specifier of specs) {
      let resolved: string | undefined;

      if (JS_TS_EXTENSIONS.includes(record.extension)) {
        resolved = resolveJsTsImport(absolutePath, specifier, rootPath, byAbsoluteKey);
      } else if (record.extension === ".py" || record.extension === ".pyw") {
        resolved = resolvePythonImport(absolutePath, specifier, rootPath, byAbsoluteKey);
      }

      if (resolved && resolved !== record.path) {
        record.imports.push(resolved);
      }
    }

    record.imports = [...new Set(record.imports)].sort((a, b) => a.localeCompare(b));
  }

  for (const record of fileRecords) {
    for (const imported of record.imports) {
      const importedFile = fileRecords.find((entry) => entry.path === imported);
      if (importedFile) {
        importedFile.importedBy.push(record.path);
      }
    }
  }

  for (const record of fileRecords) {
    record.importedBy = [...new Set(record.importedBy)].sort((a, b) => a.localeCompare(b));
  }

  const analyzedSizeBytes = fileRecords.reduce((sum, item) => sum + item.sizeBytes, 0);
  const folderTree = buildFolderTree(allFilePaths);

  const configuredMain = config.get<string>("mainFile", "").trim().replace(/\\/g, "/");
  const sortedByPriority = [...fileRecords].sort((a, b) => {
    const priorityDiff = mainFilePriority(b.path, b.extension) - mainFilePriority(a.path, a.extension);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return b.sizeBytes - a.sizeBytes;
  });
  const mainFile =
    (configuredMain && fileRecords.find((file) => file.path === configuredMain)?.path) ||
    sortedByPriority[0]?.path;
  const mainFileSizeMb = mainFile
    ? fileRecords.find((file) => file.path === mainFile)?.sizeMb
    : undefined;

  const criticalFileCandidates = fileRecords
    .map((file) => {
      const inbound = file.importedBy.length;
      const outbound = file.imports.length;
      const entryBonus = file.path === mainFile ? 5 : 0;
      const score = inbound * 3 + outbound * 1.5 + Math.log10(file.sizeBytes + 1) + entryBonus;

      return {
        path: file.path,
        inbound,
        outbound,
        sizeBytes: file.sizeBytes,
        score
      };
    })
    .filter((item) => item.inbound > 0 || item.outbound > 0 || item.path === mainFile)
    .sort((a, b) => b.score - a.score || b.inbound - a.inbound || b.sizeBytes - a.sizeBytes);

  const criticalFiles = (
    criticalFileCandidates.length > 0
      ? criticalFileCandidates
      : fileRecords
          .map((file) => ({ path: file.path, sizeBytes: file.sizeBytes }))
          .sort((a, b) => b.sizeBytes - a.sizeBytes)
  )
    .slice(0, 12)
    .map((item) => item.path);

  const graphNodes = fileRecords.map((file) => ({
    id: file.path,
    label: path.basename(file.path),
    sizeMb: file.sizeMb
  }));

  const graphLinks = fileRecords.flatMap((file) =>
    file.imports.map((target) => ({
      source: file.path,
      target
    }))
  );

  return {
    workspaceName: folder.name,
    rootPath,
    generatedAt: new Date().toISOString(),
    totalFiles: allRootFilePaths.length,
    analyzedFiles: fileRecords.length,
    totalSizeMb: bytesToMb(allRootSizeBytes),
    analyzedSizeMb: bytesToMb(analyzedSizeBytes),
    mainFile,
    mainFileSizeMb,
    folderTree,
    files: fileRecords.sort((a, b) => b.sizeBytes - a.sizeBytes),
    graphNodes,
    graphLinks,
    criticalFiles
  };
}