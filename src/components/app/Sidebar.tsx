import { ProjectRecord } from '@/lib/cloudkit';
import {
    Inbox,
    CalendarClock,
    Zap,
    Hourglass,
    CalendarDays,
    ClipboardList,
    Plus,
    Loader2,
    Check,
    X,
    Pencil,
    Clock,
    Keyboard
} from 'lucide-react';
import React from 'react';

type SidebarProps = {
    viewMode: 'project' | 'history' | 'inbox' | 'next_actions' | 'someday' | 'due' | 'waiting' | 'deferred';
    setViewMode: (mode: 'project' | 'history' | 'inbox' | 'next_actions' | 'someday' | 'due' | 'waiting' | 'deferred') => void;
    selectedProject: ProjectRecord | null;
    setSelectedProject: (project: ProjectRecord | null) => void;
    projects: ProjectRecord[];
    fetching: boolean;
    dragOverProjectId: string | null;
    setDragOverProjectId: (id: string | null) => void;
    dragOverPosition: 'top' | 'bottom' | null;
    isDraggingProject: boolean;
    editingId: string | null;
    editName: string;
    setEditName: (name: string) => void;

    // Handlers
    onCreateProject: () => void;
    onProjectSave: () => void;
    onCancel: () => void;
    onEditClick: (project: ProjectRecord) => void;
    onDragStart: (e: React.DragEvent, item: any, type: 'project') => void;
    onDragEnd: () => void;
    onDrop: (e: React.DragEvent, project: any) => void;
    onDropDue: (e: React.DragEvent) => void;
    onDropNextActions: (e: React.DragEvent) => void;
    onDropWaiting: (e: React.DragEvent) => void;
    onDropDeferred: (e: React.DragEvent) => void;
    onDropSomeday: (e: React.DragEvent) => void;
    onShowShortcuts: (show: boolean) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
    viewMode,
    setViewMode,
    selectedProject,
    setSelectedProject,
    projects,
    fetching,
    dragOverProjectId,
    setDragOverProjectId,
    dragOverPosition,
    isDraggingProject,
    editingId,
    editName,
    setEditName,
    onCreateProject,
    onProjectSave,
    onCancel,
    onEditClick,
    onDragStart,
    onDragEnd,
    onDrop,
    onDropDue,
    onDropNextActions,
    onDropWaiting,
    onDropDeferred,
    onDropSomeday,
    onShowShortcuts
}) => {
    return (
        <div className="w-64 bg-gray-50 border-r border-gray-100 flex flex-col fixed md:relative h-full z-10 transition-transform md:translate-x-0 -translate-x-full">
            <div className="p-4 border-b border-gray-100 bg-white">
                <h1 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Next Idea
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Standard Views */}
                <div className="space-y-1">
                    <div
                        onClick={() => {
                            setViewMode('inbox');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverProjectId !== 'inbox-pseudo-project') {
                                setDragOverProjectId('inbox-pseudo-project');
                            }
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'inbox-pseudo-project') {
                                setDragOverProjectId('inbox-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            // Prevent flickering when hovering over children
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={(e) => onDrop(e, { recordName: 'inbox-pseudo-project', recordType: 'CD_Project', fields: { CD_name: { value: 'Inbox' }, CD_id: { value: 'inbox' } } })}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'inbox'
                            ? 'bg-blue-50 text-blue-700'
                            : dragOverProjectId === 'inbox-pseudo-project'
                                ? 'bg-blue-100 ring-2 ring-blue-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Inbox className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">Inbox</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('due');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'due-pseudo-project') {
                                setDragOverProjectId('due-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={onDropDue}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'due'
                            ? 'bg-orange-50 text-orange-700'
                            : dragOverProjectId === 'due-pseudo-project'
                                ? 'bg-orange-100 ring-2 ring-orange-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <CalendarClock className={`w-5 h-5 ${viewMode === 'due' ? 'text-orange-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Due and Overdue</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('next_actions');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'next-actions-pseudo-project') {
                                setDragOverProjectId('next-actions-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            // Prevent flickering when hovering over children
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={onDropNextActions}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'next_actions'
                            ? 'bg-purple-50 text-purple-700'
                            : dragOverProjectId === 'next-actions-pseudo-project'
                                ? 'bg-purple-100 ring-2 ring-purple-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Zap className={`w-5 h-5 ${viewMode === 'next_actions' ? 'text-purple-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Next actions</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('waiting');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'waiting-pseudo-project') {
                                setDragOverProjectId('waiting-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={onDropWaiting}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'waiting'
                            ? 'bg-indigo-50 text-indigo-700'
                            : dragOverProjectId === 'waiting-pseudo-project'
                                ? 'bg-indigo-100 ring-2 ring-indigo-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Hourglass className={`w-5 h-5 ${viewMode === 'waiting' ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Waiting for</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('deferred');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'deferred-pseudo-project') {
                                setDragOverProjectId('deferred-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={onDropDeferred}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'deferred'
                            ? 'bg-teal-50 text-teal-700'
                            : dragOverProjectId === 'deferred-pseudo-project'
                                ? 'bg-teal-100 ring-2 ring-teal-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <CalendarDays className={`w-5 h-5 ${viewMode === 'deferred' ? 'text-teal-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Deferred</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('someday');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'someday-pseudo-project') {
                                setDragOverProjectId('someday-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={onDropSomeday}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'someday'
                            ? 'bg-amber-50 text-amber-700'
                            : dragOverProjectId === 'someday-pseudo-project'
                                ? 'bg-amber-100 ring-2 ring-amber-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <CalendarClock className={`w-5 h-5 ${viewMode === 'someday' ? 'text-amber-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Someday / Maybe</span>
                    </div>
                </div>

                <div className="p-4 border-b border-gray-100 border-t mt-2">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        Projects ({projects.length})
                        <button
                            onClick={onCreateProject}
                            className="ml-auto p-1 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="New Project (P)"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {fetching ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <>
                            {/* Active Projects */}
                            {projects
                                .filter(p => (!p.fields.CD_focus || p.fields.CD_focus.value !== 0) || p.fields.CD_singleactions?.value === 1)
                                .map(project => (
                                    <div
                                        key={project.recordName}
                                        draggable={project.fields.CD_singleactions?.value !== 1}
                                        onDragStart={(e) => onDragStart(e, project, 'project')}
                                        onDragEnd={onDragEnd}
                                        onClick={() => {
                                            setSelectedProject(project);
                                            setViewMode('project');
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (dragOverProjectId !== project.recordName) {
                                                setDragOverProjectId(project.recordName);
                                            }
                                        }}
                                        onDragEnter={(e) => {
                                            e.preventDefault();
                                            if (dragOverProjectId !== project.recordName) {
                                                setDragOverProjectId(project.recordName);
                                            }
                                        }}
                                        onDragLeave={(e) => {
                                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                setDragOverProjectId(null);
                                            }
                                        }}
                                        onDrop={(e) => onDrop(e, project)}
                                        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'project' && selectedProject?.recordName === project.recordName
                                            ? 'bg-blue-50 text-blue-700'
                                            : dragOverProjectId === project.recordName
                                                ? isDraggingProject
                                                    ? dragOverPosition === 'top' ? 'border-t-2 border-blue-500' : 'border-b-2 border-blue-500'
                                                    : 'bg-blue-100 ring-2 ring-blue-300 ring-inset'
                                                : 'hover:bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 font-medium truncate">
                                            {editingId === project.recordName ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="block w-full text-sm rounded border-gray-300 px-1 py-0.5"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') onProjectSave();
                                                            if (e.key === 'Escape') onCancel();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <button onClick={(e) => { e.stopPropagation(); onProjectSave(); }} className="text-green-600"><Check className="w-4 h-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="text-red-600"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="truncate">{project.fields.CD_name?.value || 'Untitled'}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEditClick(project);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 rounded"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                            {/* Projects on Hold */}
                            {projects.some(p => p.fields.CD_focus?.value === 0 && p.fields.CD_singleactions?.value !== 1) && (
                                <>
                                    <div className="p-4 border-b border-gray-100 border-t mt-4 mb-2">
                                        <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider">
                                            Projects on hold
                                        </h3>
                                    </div>
                                    {projects
                                        .filter(p => p.fields.CD_focus?.value === 0 && p.fields.CD_singleactions?.value !== 1)
                                        .map(project => (
                                            <div
                                                key={project.recordName}
                                                draggable={true}
                                                onDragStart={(e) => onDragStart(e, project, 'project')}
                                                onDragEnd={onDragEnd}
                                                onClick={() => {
                                                    setSelectedProject(project);
                                                    setViewMode('project');
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.dataTransfer.dropEffect = 'move';
                                                    if (dragOverProjectId !== project.recordName) {
                                                        setDragOverProjectId(project.recordName);
                                                    }
                                                }}
                                                onDragEnter={(e) => {
                                                    e.preventDefault();
                                                    if (dragOverProjectId !== project.recordName) {
                                                        setDragOverProjectId(project.recordName);
                                                    }
                                                }}
                                                onDragLeave={(e) => {
                                                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                        setDragOverProjectId(null);
                                                    }
                                                }}
                                                onDrop={(e) => onDrop(e, project)}
                                                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors opacity-75 ${viewMode === 'project' && selectedProject?.recordName === project.recordName
                                                    ? 'bg-gray-100 text-gray-900'
                                                    : dragOverProjectId === project.recordName
                                                        ? isDraggingProject
                                                            ? dragOverPosition === 'top' ? 'border-t-2 border-blue-500' : 'border-b-2 border-blue-500'
                                                            : 'bg-gray-100 ring-2 ring-gray-300 ring-inset'
                                                        : 'hover:bg-gray-50 text-gray-600'
                                                    }`}
                                            >
                                                <div className="flex-1 min-w-0 font-medium truncate">
                                                    {editingId === project.recordName ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                className="block w-full text-sm rounded border-gray-300 px-1 py-0.5"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') onProjectSave();
                                                                    if (e.key === 'Escape') onCancel();
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <button onClick={(e) => { e.stopPropagation(); onProjectSave(); }} className="text-green-600"><Check className="w-4 h-4" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="text-red-600"><X className="w-4 h-4" /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="truncate">{project.fields.CD_name?.value || 'Untitled'}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditClick(project);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 rounded"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Sidebar Footer: Global Views */}
                <div className="p-2 border-t border-gray-100 bg-white">
                    <div
                        onClick={() => {
                            setViewMode('history');
                            setSelectedProject(null);
                        }}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'history'
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Clock className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                        <span className="font-medium">Completed Tasks</span>
                    </div>
                </div>

                {/* Keyboard Shortcuts Button */}
                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={() => onShowShortcuts(true)}
                        className="w-full flex items-center gap-2 p-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Keyboard className="w-4 h-4" />
                        <span>Keyboard Shortcuts</span>
                        <span className="ml-auto text-xs text-gray-400">?</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
