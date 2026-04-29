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
    Calendar,
    Search,
    XCircle,
    RotateCcw,
    ArrowUpDown,
    Info
} from 'lucide-react';
import React from 'react';

type SidebarProps = {
    viewMode: 'project' | 'history' | 'inbox' | 'next_actions' | 'someday' | 'due' | 'waiting' | 'deferred' | 'all_tasks';
    setViewMode: (mode: 'project' | 'history' | 'inbox' | 'next_actions' | 'someday' | 'due' | 'waiting' | 'deferred' | 'all_tasks') => void;
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
    onDragOver: (e: React.DragEvent, project: ProjectRecord) => void;
    onDrop: (e: React.DragEvent, project: any) => void;
    onDropDue: (e: React.DragEvent) => void;
    onDropNextActions: (e: React.DragEvent) => void;
    onDropWaiting: (e: React.DragEvent) => void;
    onDropDeferred: (e: React.DragEvent) => void;
    onDropSomeday: (e: React.DragEvent) => void;
    onDropInbox?: (e: React.DragEvent) => void;
    onShowShortcuts: (show: boolean) => void;
    counts?: {
        inbox: number;
        due: number;
        nextActions: number;
        waiting: number;
        deferred: number;
        someday: number;
        history: number;
        allTasks: number;
        projects: Record<string, number>;
    };
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    projectsWithMatches: Set<string>;
    listsWithMatches: Set<string>;
    onRefresh: () => void;
    isRefreshing: boolean;
    onMoveDueToTop: () => void;
    onInfoClick: (project: ProjectRecord) => void;
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
    onDragOver,
    onDrop,
    onDropDue,
    onDropNextActions,
    onDropWaiting,
    onDropDeferred,
    onDropSomeday,
    onDropInbox,
    onShowShortcuts,
    counts,
    searchQuery,
    setSearchQuery,
    projectsWithMatches,
    listsWithMatches,
    onRefresh,
    isRefreshing,
    onMoveDueToTop,
    onInfoClick
}) => {
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    // Toggle search with 'f' key
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'f' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                // Determine if we should hijack 'f'
                // If user is properly typing in an input, don't hijack.
                // But we want to allow 'f' to OPEN search.
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                    return;
                }

                e.preventDefault();
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }

            // ESC to close search — single press clears query and closes bar
            if (e.key === 'Escape' && isSearchOpen) {
                setSearchQuery('');
                setIsSearchOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen, searchQuery, setSearchQuery]);

    const handleClearSearch = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSearchQuery('');
        // If bar is closed, stays closed. If open, stays open?
    };

    const isHighlightList = (mode: string) => {
        // Highlight if list contains matches (listsWithMatches) AND we are not currently in that mode
        // Actually user said: "highlight that list or project so that it's clear that I can click on it to switch to that list or project"
        // If we are already selected, we don't necessarily need highlight or maybe we do to show "matches here".
        // Let's highlight if matches exist.
        return searchQuery.trim() && listsWithMatches.has(mode);
    };

    const isHighlightProject = (pid: string) => {
        return searchQuery.trim() && projectsWithMatches.has(pid);
    };

    return (
        <div className="w-[28rem] bg-gray-50 border-r border-gray-100 flex flex-col fixed md:relative h-full z-10 transition-transform md:translate-x-0 -translate-x-full">
            <div className="p-4 border-b border-gray-100 bg-white flex items-center justify-between h-[60px]">
                {isSearchOpen ? (
                    <div className="flex items-center w-full gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Filter tasks... (Esc to close)"
                            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setIsSearchOpen(false);
                                }
                            }}
                            autoFocus
                        />
                        <button onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        <h1 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
                            Next Idea
                        </h1>
                        <div className="flex items-center gap-1">
                            {searchQuery && (
                                <button
                                    onClick={handleClearSearch}
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                    title="Clear Filter"
                                >
                                    <XCircle className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={onMoveDueToTop}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded-full transition-colors"
                                title="Move Due to Top"
                            >
                                <ArrowUpDown className="w-5 h-5" />
                            </button>
                            <button
                                onClick={onRefresh}
                                disabled={isRefreshing}
                                className={`p-1.5 rounded-full transition-colors ${isRefreshing ? 'text-blue-500' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                title="Refresh"
                            >
                                <RotateCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className={`p-1.5 rounded-full transition-colors ${searchQuery ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                title="Search (F)"
                            >
                                <Search className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Standard Views */}
                <div className="space-y-1">
                    <div
                        onClick={() => {
                            setViewMode('all_tasks');
                            setSelectedProject(null);
                        }}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'all_tasks'
                            ? 'bg-purple-50 text-purple-700'
                            : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <List className={`w-5 h-5 ${viewMode === 'all_tasks' ? 'text-purple-500' : 'text-gray-400'}`} />
                        <span className={`font-medium flex-1 ${isHighlightList('all_tasks') ? 'text-indigo-600 font-semibold' : ''}`}>All tasks</span>
                        {counts?.allTasks ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isHighlightList('all_tasks') ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-600'}`}>
                                {counts.allTasks}
                            </span>
                        ) : null}
                    </div>

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
                        onDrop={(e) => onDropInbox && onDropInbox(e)}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'inbox'
                            ? 'bg-gray-100 text-gray-900'
                            : dragOverProjectId === 'inbox-pseudo-project'
                                ? 'bg-gray-200 ring-2 ring-gray-400 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Inbox className="w-5 h-5 text-gray-800" />
                        <span className={`font-medium flex-1 ${isHighlightList('inbox') ? 'text-indigo-600 font-semibold' : ''}`}>Inbox</span>
                        {counts?.inbox ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isHighlightList('inbox') ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-700'}`}>
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
                        <span className={`font-medium flex-1 ${isHighlightList('due') ? 'text-indigo-600 font-semibold' : ''}`}>Due</span>
                        {counts?.due ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isHighlightList('due') ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-600'}`}>
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
                        <span className={`font-medium flex-1 ${isHighlightList('next_actions') ? 'text-indigo-600 font-semibold' : ''}`}>Next</span>
                        {counts?.nextActions ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isHighlightList('next_actions') ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-600'}`}>
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
                        <span className={`font-medium flex-1 ${isHighlightList('waiting') ? 'text-indigo-600 font-semibold' : ''}`}>Waiting for</span>
                        {counts?.waiting ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isHighlightList('waiting') ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-600 '}`}>
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
                        <span className={`font-medium flex-1 ${isHighlightList('deferred') ? 'text-indigo-600 font-semibold' : ''}`}>Deferred</span>
                        {counts?.deferred ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isHighlightList('deferred') ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
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
                        <span className={`font-medium flex-1 ${isHighlightList('someday') ? 'text-indigo-600 font-semibold' : ''}`}>Someday</span>
                        {counts?.someday ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isHighlightList('someday') ? 'bg-indigo-100 text-indigo-700' : 'bg-[#fdf4eb] text-[#92400e]'}`}>
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
                                .filter(p => {
                                    const isActive = (!p.fields.CD_focus || p.fields.CD_focus.value !== 0) || p.fields.CD_singleactions?.value === 1;
                                    if (!isActive) return false;

                                    // Search Filter: Show if name matches OR if project contains matching tasks
                                    if (searchQuery.trim()) {
                                        const nameMatch = p.fields.CD_name?.value.toLowerCase().includes(searchQuery.toLowerCase());
                                        const hasMatchingTasks = projectsWithMatches.has(p.recordName);
                                        return nameMatch || hasMatchingTasks;
                                    }
                                    return true;
                                })
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
                                        onDragOver={(e) => onDragOver(e, project)}
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
                                        className={`group relative flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'project' && selectedProject?.recordName === project.recordName
                                            ? 'bg-blue-50 text-blue-700'
                                            : dragOverProjectId === project.recordName && !isDraggingProject
                                                ? 'bg-blue-100 ring-2 ring-blue-300 ring-inset'
                                                : 'hover:bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        {dragOverProjectId === project.recordName && isDraggingProject && dragOverPosition === 'top' && (
                                            <div className="absolute -top-[2px] left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
                                        )}
                                        {dragOverProjectId === project.recordName && isDraggingProject && dragOverPosition === 'bottom' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
                                        )}
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
                                                    <span className={`truncate flex-1 ${isHighlightProject(project.recordName) ? 'text-indigo-600 font-semibold' : ''}`}>{project.fields.CD_name?.value || 'Untitled'}</span>
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
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded flex-shrink-0 transition-colors"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onInfoClick(project);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded flex-shrink-0 transition-colors"
                                                        >
                                                            <Info className="w-3 h-3" />
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
                                        .filter(p => {
                                            const isHold = p.fields.CD_focus?.value === 0 && p.fields.CD_singleactions?.value !== 1;
                                            if (!isHold) return false;

                                            // Search Filter for Hold Projects too
                                            if (searchQuery.trim()) {
                                                const nameMatch = p.fields.CD_name?.value.toLowerCase().includes(searchQuery.toLowerCase());
                                                const hasMatchingTasks = projectsWithMatches.has(p.recordName);
                                                return nameMatch || hasMatchingTasks;
                                            }
                                            return true;
                                        })
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
                                                            <span className={`truncate ${isHighlightProject(project.recordName) ? 'text-indigo-600 font-semibold' : ''}`}>{project.fields.CD_name?.value || 'Untitled'}</span>
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
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded flex-shrink-0 transition-colors"
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onInfoClick(project);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded flex-shrink-0 transition-colors"
                                                                >
                                                                    <Info className="w-3 h-3" />
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
