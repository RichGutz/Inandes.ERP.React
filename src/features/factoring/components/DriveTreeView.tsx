import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface DriveFolderNode {
  id: string;
  name: string;
}

export interface DriveTreeViewProps {
  rootFolderId: string;
  rootFolderName?: string;
  selectedFolderId: string;
  onSelectFolder: (folder: { id: string; name: string; path: string[] }) => void;
  apiBaseUrl?: string;
}

interface TreeNodeProps {
  id: string;
  name: string;
  level: number;
  path: string[];
  selectedFolderId: string;
  onSelectFolder: (folder: { id: string; name: string; path: string[] }) => void;
  apiBaseUrl: string;
}

const DriveTreeNode: React.FC<TreeNodeProps> = ({
  id,
  name,
  level,
  path,
  selectedFolderId,
  onSelectFolder,
  apiBaseUrl,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [children, setChildren] = useState<DriveFolderNode[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const isSelected = selectedFolderId === id;
  const currentPath = [...path, name];

  const fetchChildren = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/originacion/drive/list?folder_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setChildren(data.folders || []);
      } else {
        setChildren([]);
      }
    } catch (e) {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectFolder({ id, name, path: currentPath });
    if (!isOpen) {
      if (children === null) {
        await fetchChildren();
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectFolder({ id, name, path: currentPath });
  };

  const handleRefreshNode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchChildren();
    setIsOpen(true);
  };

  return (
    <div className="select-none">
      <div
        onClick={handleSelect}
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
          isSelected
            ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 font-bold'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}
        style={{ paddingLeft: `${Math.max(8, level * 18)}px` }}
      >
        {/* Toggle Arrow */}
        <button
          onClick={handleToggle}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 shrink-0"
        >
          {loading ? (
            <RefreshCw className="animate-spin h-3.5 w-3.5 text-red-600" />
          ) : isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>

        {/* Folder Icon */}
        {isOpen ? (
          <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 shrink-0" />
        )}

        {/* Folder Name */}
        <span className="truncate flex-1">{name}</span>

        {/* Badge when selected */}
        {isSelected && (
          <span className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 flex items-center gap-1 bg-red-100 dark:bg-red-900/80 px-2 py-0.5 rounded-full shrink-0">
            <CheckCircle2 className="h-3 w-3" /> Seleccionado
          </span>
        )}

        {/* Refresh Node */}
        {isOpen && (
          <button
            onClick={handleRefreshNode}
            title="Recargar subcarpetas"
            className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Children Tree Nodes */}
      {isOpen && children && (
        <div className="border-l border-slate-200 dark:border-slate-800 ml-4 pl-1">
          {children.length === 0 ? (
            <div
              className="py-1 px-2 text-[11px] italic text-slate-400"
              style={{ paddingLeft: `${(level + 1) * 18}px` }}
            >
              (Sin subcarpetas)
            </div>
          ) : (
            children.map((child) => (
              <DriveTreeNode
                key={child.id}
                id={child.id}
                name={child.name}
                level={level + 1}
                path={currentPath}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                apiBaseUrl={apiBaseUrl}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const DriveTreeView: React.FC<DriveTreeViewProps> = ({
  rootFolderId,
  rootFolderName = 'Repositorio InAndes',
  selectedFolderId,
  onSelectFolder,
  apiBaseUrl = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech',
}) => {
  return (
    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-h-80 overflow-y-auto space-y-1 shadow-inner">
      <DriveTreeNode
        id={rootFolderId}
        name={rootFolderName}
        level={0}
        path={[]}
        selectedFolderId={selectedFolderId}
        onSelectFolder={onSelectFolder}
        apiBaseUrl={apiBaseUrl}
      />
    </div>
  );
};
