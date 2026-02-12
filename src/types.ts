export interface FileRecord {
  path: string;
  extension: string;
  sizeBytes: number;
  sizeMb: number;
  imports: string[];
  importedBy: string[];
}

export interface FolderNode {
  name: string;
  files: string[];
  folders: FolderNode[];
}

export interface GraphNode {
  id: string;
  label: string;
  sizeMb: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface DashboardData {
  workspaceName: string;
  rootPath: string;
  generatedAt: string;
  totalFiles: number;
  analyzedFiles: number;
  totalSizeMb: number;
  analyzedSizeMb: number;
  mainFile?: string;
  mainFileSizeMb?: number;
  folderTree: FolderNode;
  files: FileRecord[];
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
  criticalFiles: string[];
}