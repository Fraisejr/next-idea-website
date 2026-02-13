import { ProjectRecord } from '@/lib/cloudkit';
import { SFSymbolMapper } from '@/components/SFSymbolMapper';
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
    Keyboard,
    List,
    SquarePlay,
    Users,
    Calendar
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
    counts?: {
        inbox: number;
        due: number;
        nextActions: number;
        waiting: number;
        deferred: number;
        someday: number;
        history: number;
        projects: Record<string, number>;
    };
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
    onShowShortcuts,
    counts
}) => {
    return (
        <div className="w-80 bg-gray-50 border-r border-gray-100 flex flex-col fixed md:relative h-full z-10 transition-transform md:translate-x-0 -translate-x-full">
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
                        <span className="font-medium flex-1">Inbox</span>
                        {counts?.inbox ? (
                            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                {counts.inbox}
                            </span>
                        ) : null}
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
                            ? 'bg-green-50 text-green-700'
                            : dragOverProjectId === 'due-pseudo-project'
                                ? 'bg-green-100 ring-2 ring-green-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Calendar className={`w-5 h-5 ${viewMode === 'due' ? 'text-green-500' : 'text-gray-400'}`} />
                        <span className="font-medium flex-1">Due</span>
                        {counts?.due ? (
                            <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                {counts.due}
                            </span>
                        ) : null}
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
                            ? 'bg-blue-50 text-blue-700'
                            : dragOverProjectId === 'next-actions-pseudo-project'
                                ? 'bg-blue-100 ring-2 ring-blue-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <SquarePlay className={`w-5 h-5 ${viewMode === 'next_actions' ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className="font-medium flex-1">Next</span>
                        {counts?.nextActions ? (
                            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                {counts.nextActions}
                            </span>
                        ) : null}
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
                            ? 'bg-orange-50 text-orange-700'
                            : dragOverProjectId === 'waiting-pseudo-project'
                                ? 'bg-orange-100 ring-2 ring-orange-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Users className={`w-5 h-5 ${viewMode === 'waiting' ? 'text-orange-500' : 'text-gray-400'}`} />
                        <span className="font-medium flex-1">Waiting for</span>
                        {counts?.waiting ? (
                            <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                {counts.waiting}
                            </span>
                        ) : null}
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
                            ? 'bg-gray-100 text-gray-900'
                            : dragOverProjectId === 'deferred-pseudo-project'
                                ? 'bg-gray-200 ring-2 ring-gray-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <CalendarClock className={`w-5 h-5 ${viewMode === 'deferred' ? 'text-gray-600' : 'text-gray-400'}`} />
                        <span className="font-medium flex-1">Deferred</span>
                        {counts?.deferred ? (
                            <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                {counts.deferred}
                            </span>
                        ) : null}
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
                            ? 'bg-[#fdf4eb] text-[#92400e]'
                            : dragOverProjectId === 'someday-pseudo-project'
                                ? 'bg-[#fdf4eb] ring-2 ring-[#92400e] ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <List className={`w-5 h-5 ${viewMode === 'someday' ? 'text-[#92400e]' : 'text-gray-400'}`} />
                        <span className="font-medium flex-1">Someday</span>
                        {counts?.someday ? (
                            <span className="bg-[#fdf4eb] text-[#92400e] px-2 py-0.5 rounded-full text-xs font-medium">
                                {counts.someday}
                            </span>
                        ) : null}
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
                                                <div className="flex items-center w-full gap-2">
                                                    <SFSymbolMapper
                                                        symbol={project.fields.CD_icon?.value}
                                                        color={project.fields.CD_color?.value}
                                                        className="w-4 h-4 text-gray-400"
                                                        style={project.fields.CD_color?.value ? { color: project.fields.CD_color.value } : {}}
                                                    />
                                                    <span className="truncate flex-1">{project.fields.CD_name?.value || 'Untitled'}</span>
                                                    <div className="flex items-center gap-2">
                                                        {counts?.projects?.[project.recordName] ? (
                                                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium group-hover:bg-white group-hover:text-blue-600 transition-colors">
                                                                {counts.projects[project.recordName]}
                                                            </span>
                                                        ) : null}
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
                                                            <div className="flex items-center gap-2">
                                                                {counts?.projects?.[project.recordName] ? (
                                                                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                        {counts.projects[project.recordName]}
                                                                    </span>
                                                                ) : null}
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
                        <span className="font-medium flex-1">Completed Tasks</span>
                        {counts?.history ? (
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium group-hover:bg-blue-100 group-hover:text-blue-600">
                                {counts.history}
                            </span>
                        ) : null}
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
