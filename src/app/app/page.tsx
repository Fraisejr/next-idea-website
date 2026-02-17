'use client';

import { useEffect, useState, useMemo } from 'react';
import { CloudKitProvider, useCloudKit } from '@/components/CloudKitProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ProjectRecord, TaskRecord } from '@/lib/cloudkit';
import { TaskItem } from '@/components/app/TaskItem';
import { Sidebar } from '@/components/app/Sidebar';
import { TaskSection } from '@/components/app/TaskSection';
import { Loader2, ListTodo, CheckCircle2, Pencil, Check, X, ClipboardList, Plus, Clock, RotateCcw, Calendar, Hourglass, Repeat, Moon, ChevronRight, Zap, Inbox, Keyboard, CalendarClock, CalendarDays } from 'lucide-react';

// Helper to categorize tasks
const getTaskSection = (task: TaskRecord): 'due' | 'nextActions' | 'waitingFor' | 'deferred' | 'somedayMaybe' => {
    // Priority 1: Deferred (Hidden until future date)
    // Must come BEFORE 'due' because deferred tasks also have active dates, but shouldn't be shown as 'due' yet
    if (task.fields.CD_hideuntildate?.value === 1 && task.fields.CD_date?.value && task.fields.CD_date.value > Date.now()) {
        return 'deferred';
    }

    // Priority 2: Due/Overdue (has active date AND is due today or past)
    if (task.fields.CD_dateactive?.value === 1 && task.fields.CD_date?.value) {
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        if (task.fields.CD_date.value <= todayEnd.getTime()) {
            return 'due';
        }
        // If future date, fall through to Next Actions (or Waiting/Someday if checked)
    }

    // Priority 3: Waiting For
    if (task.fields.CD_waitingfor?.value === 1) return 'waitingFor';

    // Priority 4: Someday/Maybe
    if (task.fields.CD_someday?.value === 1) return 'somedayMaybe';

    return 'nextActions';
};

function ProjectsList() {
    const { container, isAuthenticated, isLoading, login } = useCloudKit();
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Task Edit State
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskName, setEditTaskName] = useState('');

    // Task & Selection State
    const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
    const [tasks, setTasks] = useState<TaskRecord[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [taskError, setTaskError] = useState<string | null>(null);

    // View Mode
    const [viewMode, setViewMode] = useState<'project' | 'history' | 'inbox' | 'next_actions' | 'someday' | 'due' | 'waiting' | 'deferred'>('next_actions'); // Default to next_actions
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

    // Details Panel State
    const [selectedTaskDetails, setSelectedTaskDetails] = useState<TaskRecord | null>(null);
    const [linkInput, setLinkInput] = useState('');

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Sync link input when selected task changes
    useEffect(() => {
        if (selectedTaskDetails) {
            setLinkInput(selectedTaskDetails.fields.CD_link?.value || '');
        }
    }, [selectedTaskDetails?.recordName]);

    // Sync link input when selected task changes
    // ============ TASK CACHE SYSTEM ============
    // Global cache for all active (non-completed) tasks
    const [allTasksCache, setAllTasksCache] = useState<Record<string, TaskRecord>>({});

    // Calculate Counts for Sidebar
    const sidebarCounts = useMemo(() => {
        const counts = {
            inbox: 0,
            due: 0,
            nextActions: 0,
            waiting: 0,
            deferred: 0,
            someday: 0,
            history: 0,
            projects: {} as Record<string, number>
        };

        // Initialize project counts
        projects.forEach(p => {
            counts.projects[p.recordName] = 0;
        });

        const now = Date.now();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const tomorrowTs = tomorrow.getTime();

        Object.values(allTasksCache).forEach(task => {
            // Skip completed tasks for active counts, but count for history (if we want history count)
            // History count usually implies "Completed Today" or similar, but here let's just count total completed?
            // Actually users usually want to see "Completed Today" or just a link. 
            // The sidebar item says "Completed Tasks", often users like a count of total completed or recent.
            // For now, let's count ALL completed tasks in cache (which are fetched if they were active recently or specifically fetched)
            // But wait, our cache only has ACTIVE tasks (filtered by CD_completed !== 1). 
            // So history count will be 0 unless we change cache logic or specific fetch.
            // Let's leave history count as 0 for now as cache doesn't have them.

            if (task.fields.CD_completed?.value === 1) {
                // counts.history++; // Cache doesn't have completed tasks usually
                return;
            }

            // Project Counts
            if (task.fields.CD_project?.value) {
                const pid = task.fields.CD_project.value;
                if (counts.projects[pid] !== undefined) {
                    counts.projects[pid]++;
                }
            }

            // Inbox: No Project, not waiting, not someday
            if (!task.fields.CD_project?.value && task.fields.CD_waitingfor?.value !== 1 && task.fields.CD_someday?.value !== 1) {
                counts.inbox++;
            }

            // Due/Overdue: Date Active
            if (task.fields.CD_dateactive?.value === 1 && task.fields.CD_date?.value) {
                // Priority 1: Deferred (Hidden until future date)
                if (task.fields.CD_hideuntildate?.value === 1 && task.fields.CD_date.value > now) {
                    counts.deferred++;
                }
                // Priority 2: Due/Overdue (has active date) - if not deferred (or deferred date passed)
                else {
                    if (task.fields.CD_date.value < tomorrowTs) {
                        counts.due++;
                    }
                    // User Request: Include Due/Overdue in Next Actions count
                    if (task.fields.CD_waitingfor?.value === 1) {
                        counts.waiting++;
                    }
                    else if (task.fields.CD_someday?.value === 1) {
                        counts.someday++;
                    }
                    else {
                        // Only count as next action if not waiting/someday
                        counts.nextActions++;
                    }
                }
            } else {
                // No active date

                // Waiting For
                if (task.fields.CD_waitingfor?.value === 1) {
                    counts.waiting++;
                }
                // Someday/Maybe
                else if (task.fields.CD_someday?.value === 1) {
                    counts.someday++;
                }
                // Next Actions: Has project (or assigned to Single Actions implicitly), not waiting, not someday, not deferred/due
                else if (task.fields.CD_project?.value) {
                    counts.nextActions++;
                }
            }
        });

        return counts;
    }, [allTasksCache, projects]);

    // Search Logic
    const { projectsWithMatches, listsWithMatches, matchingTaskIds } = useMemo(() => {
        if (!searchQuery.trim()) {
            return {
                projectsWithMatches: new Set<string>(),
                listsWithMatches: new Set<string>(),
                matchingTaskIds: new Set<string>()
            };
        }

        const query = searchQuery.toLowerCase();
        const projMatches = new Set<string>();
        const listMatches = new Set<string>();
        const taskMatches = new Set<string>();

        Object.values(allTasksCache).forEach(task => {
            if (task.fields.CD_name?.value.toLowerCase().includes(query)) {
                taskMatches.add(task.recordName);

                // Identify which list/project this task belongs to
                // Logic mirrors getTaskSection / Sidebar counts logic but simplified for matching
                if (task.fields.CD_project?.value) {
                    projMatches.add(task.fields.CD_project.value);
                }

                // Add to generic lists if applicable
                const section = getTaskSection(task);
                if (section === 'due') listMatches.add('due');
                if (section === 'nextActions') listMatches.add('next_actions');
                if (section === 'waitingFor') listMatches.add('waiting');
                if (section === 'somedayMaybe') listMatches.add('someday');
                if (section === 'deferred') listMatches.add('deferred');

                // Inbox check
                if (!task.fields.CD_project?.value && task.fields.CD_waitingfor?.value !== 1 && task.fields.CD_someday?.value !== 1) {
                    listMatches.add('inbox');
                }
            }
        });

        return { projectsWithMatches: projMatches, listsWithMatches: listMatches, matchingTaskIds: taskMatches };
    }, [searchQuery, allTasksCache]);
    const [cacheInitialized, setCacheInitialized] = useState(false);
    const [lastCacheRefresh, setLastCacheRefresh] = useState<number>(0);
    const CACHE_REFRESH_INTERVAL = 15000; // 15 seconds
    const LOCALSTORAGE_CACHE_KEY = 'next-idea-task-cache';
    const LOCALSTORAGE_TIMESTAMP_KEY = 'next-idea-cache-timestamp';

    // Helper: Update cache and localStorage
    const updateTaskCache = (updater: (prev: Record<string, TaskRecord>) => Record<string, TaskRecord>) => {
        setAllTasksCache(prev => {
            const updated = updater(prev);
            // Persist to localStorage
            try {
                localStorage.setItem(LOCALSTORAGE_CACHE_KEY, JSON.stringify(updated));
                localStorage.setItem(LOCALSTORAGE_TIMESTAMP_KEY, Date.now().toString());
            } catch (error) {
                console.warn('[Cache] Failed to persist to localStorage:', error);
            }
            return updated;
        });
    };

    // Helper: Add or update a single task in cache
    const upsertTaskInCache = (task: TaskRecord) => {
        updateTaskCache(prev => ({
            ...prev,
            [task.recordName]: task
        }));
    };

    // Helper: Remove a task from cache
    const removeTaskFromCache = (recordName: string) => {
        updateTaskCache(prev => {
            const updated = { ...prev };
            delete updated[recordName];
            return updated;
        });
    };

    // Keyboard Shortcuts Modal
    const [showShortcuts, setShowShortcuts] = useState(false);

    const handleEditClick = (project: ProjectRecord) => {
        // Use recordName as ID for editing state
        setEditingId(project.recordName);
        setEditName(project.fields.CD_name?.value || '');
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSave = async (project: ProjectRecord) => {
        if (!editName.trim() || !container) return;

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            const recordID = {
                recordName: project.recordName,
                zoneID: zoneID
            };

            // 1. Fetch the full record to ensure we don't overwrite unseen fields
            // We typically need to pass the Record ID object correctly for custom zones
            // FIX: Must pass zoneID in the options object (second arg) for custom zones!
            const fetchResult = await privateDB.fetchRecords([project.recordName], { zoneID });

            if (fetchResult.hasErrors) {
                // Fallback: if fetching by ID logic fails (CloudKit JS ID structure is tricky), 
                // we might try just saving the partial with merge? 
                // But let's assume fetch works if ID is correct.
                throw new Error(fetchResult.errors[0].message);
            }

            const fullRecord = fetchResult.records[0];

            // 2. Update the field
            fullRecord.fields.CD_name = { value: editName };

            // 3. Save
            const saveResult = await privateDB.saveRecords([fullRecord], { zoneID });
            if (saveResult.hasErrors) {
                throw new Error(saveResult.errors[0].message);
            }

            // Success: Update local state with the new name
            // We keep our local partial fields but update the name and change tag
            const savedRecord = saveResult.records[0];
            setProjects(prev => prev.map(p =>
                p.recordName === savedRecord.recordName ?
                    {
                        ...p,
                        fields: { ...p.fields, CD_name: { value: editName } },
                        recordChangeTag: savedRecord.recordChangeTag
                    } : p
            ));

            setEditingId(null);
            setEditName('');

        } catch (err: any) {
            console.error('Save error:', err);
            alert('Failed to save changes: ' + err.message);
        }
    };

    // Create new project at bottom of list
    const handleCreateProject = () => {
        if (!container) return;

        const maxOrder = projects.reduce((max, p) => Math.max(max, p.fields.CD_order?.value || 0), 0);
        const newProject: ProjectRecord = {
            recordName: 'new-project',
            recordType: 'CD_Project',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-project' },
                CD_order: { value: maxOrder + 1 },
                CD_singleactions: { value: 0 },
                CD_icon: { value: 'list.clipboard' },
                CD_color: { value: 'blue' }
            }
        };

        setProjects(prev => [...prev, newProject]);
        setEditingId('new-project');
        setEditName('');
    };

    // Create new project at top of list
    const handleCreateProjectAtTop = async () => {
        if (!container) return;

        const newProject: ProjectRecord = {
            recordName: 'new-project',
            recordType: 'CD_Project',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-project' },
                CD_order: { value: 0 },
                CD_singleactions: { value: 0 },
                CD_icon: { value: 'list.clipboard' },
                CD_color: { value: 'blue' }
            }
        };

        // Shift all existing projects down
        const shiftedProjects = projects.map(p => ({
            ...p,
            fields: { ...p.fields, CD_order: { value: (p.fields.CD_order?.value || 0) + 1 } }
        }));

        setProjects([newProject, ...shiftedProjects]);
        setEditingId('new-project');
        setEditName('');

        // Persist shifts in background
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            const recordsToUpdate = projects.map(p => ({
                recordName: p.recordName,
                fields: {
                    CD_order: { value: (p.fields.CD_order?.value || 0) + 1 }
                }
            }));

            if (recordsToUpdate.length > 0) {
                await privateDB.saveRecords(recordsToUpdate, { zoneID });
            }
        } catch (err) {
            console.error('Failed to shift projects:', err);
        }
    };

    // Save new or edited project
    const handleProjectSave = async () => {
        if (!editName.trim() || !container || !editingId) return;

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            if (editingId === 'new-project') {
                // Create new project
                const recordName = crypto.randomUUID();
                const project = projects.find(p => p.recordName === 'new-project');

                const newRecord = {
                    recordName: recordName,
                    recordType: 'CD_Project',
                    fields: {
                        CD_name: { value: editName },
                        CD_id: { value: crypto.randomUUID() },
                        CD_order: { value: project?.fields.CD_order?.value || 0 },
                        CD_singleactions: { value: 0 },
                        CD_focus: { value: 1 },
                        CD_icon: { value: 'list.clipboard' },
                        CD_color: { value: 'blue' }
                    }
                };

                const result = await privateDB.saveRecords([newRecord], { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                const savedRecord = result.records[0];
                setProjects(prev => prev.map(p =>
                    p.recordName === 'new-project'
                        ? { ...savedRecord, fields: savedRecord.fields }
                        : p
                ));
            } else {
                // Update existing project - use existing handleSave logic
                const project = projects.find(p => p.recordName === editingId);
                if (project) {
                    await handleSave(project);
                    return;
                }
            }

            setEditingId(null);
            setEditName('');
        } catch (err: any) {
            console.error('Save project error:', err);
            alert('Failed to save project: ' + err.message);
        }
    };

    const handleTaskSave = async (task: TaskRecord) => {
        if (!editTaskName.trim() || !container) return;

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // Handle New Task Creation
            if (task.recordName === 'new-task') {
                // CRITICAL: Generate a proper recordName (UUID) for CloudKit compatibility
                // Without this, CloudKit sync fails on iOS
                const recordName = crypto.randomUUID();

                console.log('[CloudKit Sync] Creating new task with recordName:', recordName);

                // Find Single Actions project for Next Actions view or Someday view
                const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                    ? projects.find(p => p.fields.CD_singleactions?.value === 1)
                    : null;

                const newRecord = {
                    recordName: recordName, // FIXED: Added recordName for CloudKit compatibility
                    recordType: 'CD_Task',
                    fields: {
                        // Inherit all fields from the local task state (which was initialized correctly in handleInsertTask)
                        ...task.fields,
                        CD_name: { value: editTaskName },
                        // Ensure we have a valid ID (though one was likely set in insert)
                        CD_id: { value: crypto.randomUUID() },
                        // Ensure completion is 0
                        CD_completed: { value: 0 },
                        // CRITICAL FIX: Set modified date so cache protection logic works (prevents disappearing)
                        CD_modifieddate: { value: Date.now() }
                    }
                };

                console.log('[CloudKit Sync] Saving new task:', newRecord);
                const saveResult = await privateDB.saveRecords([newRecord], { zoneID });

                if (saveResult.hasErrors) {
                    console.error('[CloudKit Sync] Failed to save new task:', saveResult.errors);
                    throw new Error(saveResult.errors[0].message);
                }

                const savedRecord = saveResult.records[0];
                console.log('[CloudKit Sync] ✅ Task created successfully:', savedRecord.recordName);

                // Replace temp task with real one
                setTasks(prev => prev.map(t =>
                    t.recordName === 'new-task' ? {
                        ...savedRecord,
                        fields: {
                            ...savedRecord.fields,
                            ...((viewMode === 'due' && !savedRecord.fields.CD_date) ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                            ...((viewMode === 'waiting' && !savedRecord.fields.CD_waitingfor) ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                            ...((viewMode === 'deferred' && !savedRecord.fields.CD_date) ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {})
                        }
                    } : t
                ));

                // Add to cache to prevent flickering and enable instant view switching
                upsertTaskInCache(savedRecord);

                setEditingTaskId(null);
                setEditTaskName('');
                return;
            }

            // Handle Existing Task Update
            // 1. Fetch full record
            const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);

            const fullRecord = fetchResult.records[0];

            // 2. Update field
            fullRecord.fields.CD_name = { value: editTaskName };
            fullRecord.fields.CD_modifieddate = { value: Date.now() }; // Update modified date

            // 3. Save
            const saveResult = await privateDB.saveRecords([fullRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // Success: Update local state
            const savedRecord = saveResult.records[0];
            setTasks(prev => prev.map(t =>
                t.recordName === savedRecord.recordName ?
                    {
                        ...t,
                        fields: {
                            ...t.fields,
                            CD_name: { value: editTaskName },
                            CD_modifieddate: { value: Date.now() }
                        },
                        recordChangeTag: savedRecord.recordChangeTag
                    } : t
            ));

            // Add to cache to prevent flickering/reversion
            upsertTaskInCache(savedRecord);

            setEditingTaskId(null);
            setEditTaskName('');

        } catch (err: any) {
            console.error('Save task error:', err);
            alert('Failed to save task: ' + err.message);
        }
    };

    const handleCreateTask = () => {
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred') || editingTaskId) return; // Don't start if already editing

        // Find Single Actions project for Next Actions view or Someday view
        const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
            ? projects.find(p => p.fields.CD_singleactions?.value === 1)
            : null;

        const newTask: TaskRecord = {
            recordName: 'new-task',
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-task' },
                // Inbox: omit project. Next Actions/Someday: use Single Actions project. Project mode: use selectedProject.
                ...(viewMode === 'inbox' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
                CD_completed: { value: 0 },
                CD_order: { value: tasks.reduce((max, t) => Math.max(max, t.fields.CD_order?.value || 0), 0) + 1 }
            }
        };

        setTasks(prev => [...prev, newTask]);
        setEditingTaskId('new-task');
        setEditTaskName('');
    };

    const handleInsertTask = async (afterTask: TaskRecord) => {
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred') || editingTaskId || !container) return;

        // Find index of afterTask
        const index = tasks.findIndex(t => t.recordName === afterTask.recordName);
        if (index === -1) return;

        const currentOrder = afterTask.fields.CD_order?.value || 0;
        const newOrder = currentOrder + 1;

        // Prepare batch: New Task + Shifting Tasks
        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        // Local State Update (Shifted Tasks + New Task)
        const updatedTasks = [...tasks];
        const shiftedRecordsToSave: any[] = [];

        // Shift local items and prepare for DB save
        updatedTasks.forEach(t => {
            const tOrder = t.fields.CD_order?.value || 0;
            if (tOrder >= newOrder) {
                // Update local task object
                t.fields.CD_order = { value: tOrder + 1 };

                // Prepare for DB save (only send changed fields for update)
                shiftedRecordsToSave.push({
                    recordName: t.recordName,
                    recordType: 'CD_Task',
                    recordChangeTag: t.recordChangeTag, // Important for updates
                    fields: {
                        CD_order: { value: tOrder + 1 }
                    }
                });
            }
        });

        // Find Single Actions project for Next Actions view or Someday view
        const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
            ? projects.find(p => p.fields.CD_singleactions?.value === 1)
            : null;

        // Create new task object for local state
        const newTask: TaskRecord = {
            recordName: 'new-task', // Temporary ID for local state
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: crypto.randomUUID() }, // Client-side UUID for new task
                // Inbox: omit project. Next Actions/Someday: use Single Actions project. Project mode: use selectedProject.
                ...(viewMode === 'inbox' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),

                // View specific defaults
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),

                // Project View Contextual Defaults (Inherit from Sibling)
                ...(viewMode === 'project' ? (
                    // If sibling is Waiting For
                    afterTask.fields.CD_waitingfor?.value === 1 ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } :
                        // If sibling is Someday
                        afterTask.fields.CD_someday?.value === 1 ? { CD_someday: { value: 1 } } :
                            // If sibling is Deferred (Hide Until + Active Date)
                            (afterTask.fields.CD_hideuntildate?.value === 1 && afterTask.fields.CD_dateactive?.value === 1) ? {
                                CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, // Default to tomorrow like Deferred view
                                CD_dateactive: { value: 1 },
                                CD_hideuntildate: { value: 1 },
                                CD_someday: { value: 0 }
                            } :
                                // If sibling is Due/Overdue (Active Date w/o Hide Until)
                                (afterTask.fields.CD_dateactive?.value === 1 && afterTask.fields.CD_date?.value && afterTask.fields.CD_hideuntildate?.value !== 1) ? {
                                    CD_date: { value: Date.now() }, // Default to Today
                                    CD_dateactive: { value: 1 }
                                } :
                                    // Default to Next Actions (No flags)
                                    { CD_someday: { value: 0 }, CD_waitingfor: { value: 0 }, CD_dateactive: { value: 0 } }
                ) : {}),
                CD_completed: { value: 0 },
                CD_order: { value: newOrder }
            }
        };

        // Insert new task into the local array at the correct position
        updatedTasks.splice(index + 1, 0, newTask);

        // Sort the updatedTasks array to ensure correct display order
        updatedTasks.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));

        setTasks(updatedTasks);
        setEditingTaskId('new-task');
        setEditTaskName('');

        // Persist shifts in background
        // Persist shifts in background
        if (shiftedRecordsToSave.length > 0) {
            try {
                // CRITICAL FIX: Fetch latest versions of shifted tasks before saving to avoid CAS Op-Lock failures
                const recordNamesToFetch = shiftedRecordsToSave.map(r => r.recordName);

                // Fetch in batches if necessary (though usually < 400 is fine)
                const fetchResult = await privateDB.fetchRecords(recordNamesToFetch, { zoneID });

                if (fetchResult.hasErrors) {
                    console.error('Failed to fetch records for shifting:', fetchResult.errors);
                    // If fetch fails, we can't save safely. 
                    // Since this is a background optimization (order fix), we could abort or retry.
                    // Let's abort to avoid corrupting data with "force save" attempt.
                    return;
                }

                const fetchedRecordsMap = new Map();
                fetchResult.records.forEach((r: any) => fetchedRecordsMap.set(r.recordName, r));

                const freshRecordsToSave = shiftedRecordsToSave.map(localShift => {
                    const freshRecord = fetchedRecordsMap.get(localShift.recordName);
                    if (!freshRecord) return null; // Should not happen if fetch succeeded

                    return {
                        recordName: freshRecord.recordName,
                        recordType: 'CD_Task',
                        recordChangeTag: freshRecord.recordChangeTag, // Use FRESH tag
                        fields: {
                            // We only want to update the order. 
                            // The logic was: t.fields.CD_order = value + 1.
                            // We trust our calculation of "new order" based on the insertion point relative to others.
                            // If order changed on server, this might overwrite it. 
                            // But usually "insert here" implies relative order.
                            CD_order: localShift.fields.CD_order
                        }
                    };
                }).filter(Boolean);

                if (freshRecordsToSave.length > 0) {
                    const result = await privateDB.saveRecords(freshRecordsToSave, { zoneID });
                    if (result.hasErrors) throw new Error(result.errors[0].message);

                    // Update local tags for shifted items
                    const savedRecords = result.records;
                    setTasks(currentTasks => currentTasks.map(t => {
                        const saved = savedRecords.find((r: any) => r.recordName === t.recordName);
                        return saved ? { ...t, recordChangeTag: saved.recordChangeTag } : t;
                    }));
                }
            } catch (err) {
                console.error('Failed to shift tasks:', err);
            }
        }
    };

    // Create task at top
    const handleCreateTaskAtTop = () => {
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred') || editingTaskId) return;

        const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
            ? projects.find(p => p.fields.CD_singleactions?.value === 1)
            : null;

        const newTask: TaskRecord = {
            recordName: 'new-task',
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-task' },
                ...(viewMode === 'inbox' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
                CD_completed: { value: 0 },
                CD_order: { value: 0 } // Top of the list
            }
        };

        // Shift all existing tasks down
        setTasks(prev => {
            const shifted = prev.map(t => ({
                ...t,
                fields: { ...t.fields, CD_order: { value: (t.fields.CD_order?.value || 0) + 1 } }
            }));
            return [newTask, ...shifted];
        });
        setEditingTaskId('new-task');
        setEditTaskName('');
    };

    // Keyboard Shortcuts Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // N - Create task at bottom
            if (e.key === 'n' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateTask();
            }

            // Shift+N - Create task at top
            if (e.key === 'N' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateTaskAtTop();
            }

            // P - Create project at bottom
            if (e.key === 'p' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateProject();
            }

            // Shift+P - Create project at top
            if (e.key === 'P' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateProjectAtTop();
            }

            // ? - Show keyboard shortcuts
            if (e.key === '?' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setShowShortcuts(true);
            }

            // Escape - Close shortcuts modal
            if (e.key === 'Escape' && showShortcuts) {
                setShowShortcuts(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedProject, editingTaskId, tasks, projects, viewMode, showShortcuts]);


    const handleTaskEditClick = (task: TaskRecord) => {
        setEditingTaskId(task.recordName);
        setEditTaskName(task.fields.CD_name?.value || '');
    };

    const handleTaskCancel = () => {
        // If cancelling a new task, remove it from the list
        if (editingTaskId === 'new-task') {
            setTasks(prev => prev.filter(t => t.recordName !== 'new-task'));
        }
        setEditingTaskId(null);
        setEditTaskName('');
    };


    useEffect(() => {
        // Mount listeners
        if (container && !isAuthenticated && !isLoading) {
            // (Listeners are already set up in Provider or we rely on promise results usually)
            // But we can keep whenUserSignsIn just in case
            container.whenUserSignsIn().then(() => {
                window.location.reload();
            });
        }
    }, [container, isAuthenticated, isLoading]);

    // Fetch Projects using Query (Works)
    useEffect(() => {
        const fetchProjects = async () => {
            if (!container) {
                console.log('[CloudKit Projects] Container not available');
                return;
            }

            console.log('[CloudKit Projects] 🚀 Fetching projects from CloudKit...');
            setFetching(true);
            setError(null);
            try {
                const privateDB = container.privateCloudDatabase;
                const query = {
                    recordType: 'CD_Project',
                    filterBy: [{ fieldName: 'CD_name', comparator: 'NOT_EQUALS', fieldValue: { value: '' } }],
                    desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_completed', 'CD_singleactions', 'CD_focus', 'CD_icon', 'CD_color'],
                    resultsLimit: 100
                };
                const options = { zoneID: { zoneName: 'com.apple.coredata.cloudkit.zone' } };

                console.log('[CloudKit Projects] Executing query:', query);
                const result = await privateDB.performQuery(query, options);

                if (result.hasErrors) {
                    console.error('[CloudKit Projects] ❌ Query errors:', result.errors);
                    throw new Error(result.errors[0].message);
                }

                let records = result.records as ProjectRecord[];
                console.log(`[CloudKit Projects] ✅ Received ${records.length} total projects from CloudKit`);
                console.log('[CloudKit Projects] Raw projects:', records.map(p => ({
                    name: p.fields.CD_name?.value,
                    completed: p.fields.CD_completed?.value,
                    singleActions: p.fields.CD_singleactions?.value,
                    order: p.fields.CD_order?.value
                })));

                const beforeFilter = records.length;
                records = records.filter(p => !p.fields.CD_completed || p.fields.CD_completed.value !== 1);
                console.log(`[CloudKit Projects] 🔍 Filtered out ${beforeFilter - records.length} completed projects`);

                records.sort((a, b) => {
                    const isSingleA = a.fields.CD_singleactions?.value === 1;
                    const isSingleB = b.fields.CD_singleactions?.value === 1;
                    if (isSingleA && !isSingleB) return -1;
                    if (!isSingleA && isSingleB) return 1;
                    const orderA = a.fields.CD_order?.value ?? 0;
                    const orderB = b.fields.CD_order?.value ?? 0;
                    return orderA - orderB;
                });

                console.log(`[CloudKit Projects] 📋 Final project list (${records.length} projects):`);
                records.forEach((p, i) => {
                    console.log(`  ${i + 1}. "${p.fields.CD_name?.value}" (order: ${p.fields.CD_order?.value})`);
                });

                setProjects(records);
                // Select first project by default if none selected
                if (records.length > 0 && !selectedProject) {
                    setSelectedProject(records[0]);
                }
            } catch (err: any) {
                console.error('[CloudKit Projects] ❌ Fetch error:', err);
                setError(err.message || 'Failed to fetch projects');
            } finally {
                setFetching(false);
            }
        };

        if (isAuthenticated) {
            fetchProjects();
        }
    }, [isAuthenticated, container]); // Run once on auth

    // ========== CACHE INITIALIZATION & REFRESH ==========
    // Initialize cache from localStorage and fetch all tasks on authentication
    useEffect(() => {
        const initializeCache = async () => {
            if (!container || !isAuthenticated) return;

            console.log('[Cache] 🚀 Initializing task cache...');

            // 1. Hydrate from localStorage first for instant display
            try {
                const cachedData = localStorage.getItem(LOCALSTORAGE_CACHE_KEY);
                const cachedTimestamp = localStorage.getItem(LOCALSTORAGE_TIMESTAMP_KEY);

                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    setAllTasksCache(parsed);
                    setLastCacheRefresh(cachedTimestamp ? parseInt(cachedTimestamp) : 0);
                    console.log(`[Cache] ✅ Hydrated ${Object.keys(parsed).length} tasks from localStorage`);
                }
            } catch (error) {
                console.warn('[Cache] Failed to hydrate from localStorage:', error);
                localStorage.removeItem(LOCALSTORAGE_CACHE_KEY);
                localStorage.removeItem(LOCALSTORAGE_TIMESTAMP_KEY);
            }

            // 2. Fetch all active tasks from CloudKit to populate/refresh cache
            try {
                const privateDB = container.privateCloudDatabase;
                const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

                const query = {
                    recordType: 'CD_Task',
                    filterBy: [{
                        fieldName: 'CD_completed',
                        comparator: 'NOT_EQUALS',
                        fieldValue: { value: 1 }
                    }],
                    desiredKeys: [
                        'CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed',
                        'CD_someday', 'CD_waitingfor', 'CD_dateactive',
                        'CD_date', 'CD_hideuntildate', 'CD_recurring', 'CD_recurrence', 'CD_recurrencetype',
                        'CD_modifieddate', 'CD_link'
                    ],
                    resultsLimit: 500 // Fetch all active tasks
                };

                console.log('[Cache] Fetching all active tasks from CloudKit...');
                const result = await privateDB.performQuery(query, { zoneID });

                if (result.hasErrors) {
                    console.error('[Cache] ❌ Failed to fetch tasks:', result.errors);
                    throw new Error(result.errors[0].message);
                }

                const tasks = result.records as TaskRecord[];
                console.log(`[Cache] ✅ Fetched ${tasks.length} active tasks from CloudKit`);

                // Build cache object indexed by recordName
                const cacheObject: Record<string, TaskRecord> = {};
                tasks.forEach(task => {
                    cacheObject[task.recordName] = task;
                });

                // Update cache and localStorage
                updateTaskCache(() => cacheObject);
                setLastCacheRefresh(Date.now());
                setCacheInitialized(true);

                console.log('[Cache] 🎉 Cache initialization complete');
            } catch (error: any) {
                console.error('[Cache] ❌ Initialization failed:', error);
                // Still mark as initialized to prevent infinite loops
                setCacheInitialized(true);
            }
        };

        if (!cacheInitialized) {
            initializeCache();
        }
    }, [container, isAuthenticated, cacheInitialized]);

    // Background refresh every 15 seconds (paused during editing)
    useEffect(() => {
        if (!container || !isAuthenticated || !cacheInitialized) return;

        // PAUSE refresh if user is editing a task to prevent overwriting their changes
        if (editingTaskId || editingId) {
            console.log('[Cache] ⏸️ Background refresh paused during editing');
            return;
        }

        const refreshCache = async () => {
            const now = Date.now();
            if (now - lastCacheRefresh < CACHE_REFRESH_INTERVAL) return;

            console.log('[Cache] 🔄 Background refresh started...');

            try {
                const privateDB = container.privateCloudDatabase;
                const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

                const query = {
                    recordType: 'CD_Task',
                    filterBy: [{
                        fieldName: 'CD_completed',
                        comparator: 'NOT_EQUALS',
                        fieldValue: { value: 1 }
                    }],
                    desiredKeys: [
                        'CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed',
                        'CD_someday', 'CD_waitingfor', 'CD_dateactive',
                        'CD_date', 'CD_hideuntildate', 'CD_recurring', 'CD_recurrence', 'CD_recurrencetype',
                        'CD_modifieddate', 'CD_link'
                    ],
                    resultsLimit: 500
                };
                const result = await privateDB.performQuery(query, { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                const tasks = result.records as TaskRecord[];
                const freshTaskIds = new Set(tasks.map(t => t.recordName));

                // MERGE with existing cache instead of replacing
                // This preserves any tasks being created/edited that haven't been saved yet
                updateTaskCache(prev => {
                    const merged = { ...prev }; // Start with existing cache

                    // Update with fresh data from CloudKit
                    tasks.forEach(task => {
                        merged[task.recordName] = task;
                    });

                    // Remove tasks that disappeared from CloudKit (likely completed on another device)
                    // But keep tasks that are currently being edited locally
                    Object.keys(merged).forEach(recordName => {
                        if (!freshTaskIds.has(recordName) && recordName !== editingTaskId && recordName !== 'new-task') {
                            // Protect tasks modified locally in the last 10 seconds (likely just saved but not yet indexed by CloudKit query)
                            const localTask = merged[recordName];
                            const lastModified = localTask.fields.CD_modifieddate?.value || 0;
                            const isRecent = (Date.now() - lastModified) < 10000;

                            if (isRecent) {
                                console.log(`[Cache] 🛡️ Protecting recent task ${recordName} from removal (waiting for index)`);
                            } else {
                                console.log(`[Cache] 🗑️ Removing task ${recordName} (no longer in CloudKit, likely completed elsewhere)`);
                                delete merged[recordName];
                            }
                        }
                    });

                    return merged;
                });
                setLastCacheRefresh(now);
                console.log(`[Cache] ✅ Refreshed ${tasks.length} tasks (merged with existing cache)`);
            } catch (error) {
                console.error('[Cache] ❌ Background refresh failed:', error);
            }
        };

        // Refresh immediately if stale, then set up interval
        refreshCache();
        const intervalId = setInterval(refreshCache, CACHE_REFRESH_INTERVAL);

        return () => clearInterval(intervalId);
    }, [container, isAuthenticated, cacheInitialized, lastCacheRefresh, editingTaskId, editingId]);

    // Drag and Drop Handlers
    const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
    const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);
    const [isDraggingProject, setIsDraggingProject] = useState(false);
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, item: TaskRecord | ProjectRecord, type: 'task' | 'project') => {
        e.dataTransfer.setData('text/plain', item.recordName);
        e.dataTransfer.setData('application/type', type);
        e.dataTransfer.effectAllowed = 'move';
        if (type === 'project') {
            setIsDraggingProject(true);
        }
    };

    const handleDragEnd = () => {
        setIsDraggingProject(false);
        setDragOverProjectId(null);
        setDragOverPosition(null);
    };

    const handleDragOver = (e: React.DragEvent, project: ProjectRecord) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';

        // Calculate if top or bottom half
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const isTop = y < rect.height / 2;

        let position: 'top' | 'bottom' = isTop ? 'top' : 'bottom';

        // Constraint: Cannot drop ABOVE Single Actions project (must stay at top)
        if (project.fields.CD_singleactions?.value === 1 && position === 'top') {
            // If we try to drop above Single Actions, force to bottom or prevent?
            // User said "don't let me drop... above it".
            // We'll treat Top zone as invalid or map to Bottom?
            // Actually, simplest is to just not set position/id if it's invalid top drop, 
            // but that flickers. 
            // Better: Force to bottom? No, that's confusing.
            // We'll check in handleDrop to preventing saving. 
            // But visually we want to hide the Top indicator.
            // So here we won't set dragOverPosition if it's top on Single Actions.
            if (isDraggingProject) {
                // Only relevant for project reordering. Tasks drop ON the project.
                // So if dragging project, and target is Single Actions top, invalid.
                // But wait, if I can't drop above, I can't start a drag there.
                // We'll just ignore setting state for 'top' on SE project.
                setDragOverProjectId(null);
                setDragOverPosition(null);
                return;
            }
        }

        if (dragOverPosition !== position) {
            setDragOverPosition(position);
        }

        if (dragOverProjectId !== project.recordName) {
            setDragOverProjectId(project.recordName);
        }
    };

    const handleDragEnter = (project: ProjectRecord) => {
        if (project.recordName !== selectedProject?.recordName) {
            setDragOverProjectId(project.recordName);
        }
    };

    const handleDragLeave = () => {
        setDragOverProjectId(null);
        setDragOverPosition(null);
    };

    const handleDrop = async (e: React.DragEvent, targetProject: ProjectRecord) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        const type = e.dataTransfer.getData('application/type') || 'task'; // Default to task for backward compatibility

        if (!id || !container) return;

        // --- Handle Project Reordering ---
        if (type === 'project') {
            if (id === targetProject.recordName) return; // Drop on self

            const sourceProject = projects.find(p => p.recordName === id);
            if (!sourceProject) return;

            // Boundary Check: Ensure we stay within same section (Active vs On Hold)
            const isActive = (p: ProjectRecord) => (!p.fields.CD_focus || p.fields.CD_focus.value !== 0) || p.fields.CD_singleactions?.value === 1;

            const sourceIsActive = isActive(sourceProject);
            const targetIsActive = isActive(targetProject);

            if (sourceIsActive !== targetIsActive) {
                // Prevent dragging across sections
                return;
            }

            // Reorder
            const newProjects = [...projects];
            const sourceIndex = newProjects.findIndex(p => p.recordName === id);
            const targetIndex = newProjects.findIndex(p => p.recordName === targetProject.recordName);

            if (sourceIndex === -1 || targetIndex === -1) return;

            // Recalculate position to be safe (state might be cleared by dragLeave)
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const isTop = y < rect.height / 2;
            const position = isTop ? 'top' : 'bottom';

            let insertIndex = targetIndex + (position === 'bottom' ? 1 : 0);
            // If we're moving it down, we need to account for the removal shifting indices
            if (sourceIndex < insertIndex) insertIndex--;

            // Move project
            newProjects.splice(sourceIndex, 1);
            newProjects.splice(insertIndex, 0, sourceProject);

            // Optimistic Update
            // We must update the CD_order field in the state objects so the UI reflects the new numbers immediately
            const updatedProjects = newProjects.map((p, index) => ({
                ...p,
                fields: {
                    ...p.fields,
                    CD_order: { value: index }
                }
            }));

            setProjects(updatedProjects);

            // Save new order
            try {
                const privateDB = container.privateCloudDatabase;
                const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

                // CRITICAL FIX: Fetch latest versions of ALL projects involved to prevent CAS Op-Lock failures
                // We need to fetch all projects that are being updated. 
                // Since we are updating CD_order for potentially all projects (or a subset), 
                // let's fetch the ones we are about to save. 
                // For simplicity/safety, we are updating ALL projects in the list to ensure consistent 0-based indexing.
                const recordNamesToFetch = updatedProjects.map(p => p.recordName);

                // CloudKit fetchRecords might have a limit (usually 200-400), if we have many projects this might need batching.
                // Assuming < 100 projects for now.
                const fetchResult = await privateDB.fetchRecords(recordNamesToFetch, { zoneID });

                if (fetchResult.hasErrors) {
                    // Only throw if critical? Or try to proceed with what we have? 
                    // If we can't get fresh tokens, we WILL fail the save. So throw.
                    throw new Error(fetchResult.errors[0].message);
                }

                const fetchedRecordsMap = new Map();
                fetchResult.records.forEach((r: any) => fetchedRecordsMap.set(r.recordName, r));

                const recordsToUpdate = updatedProjects.map(p => {
                    const freshRecord = fetchedRecordsMap.get(p.recordName);
                    if (!freshRecord) {
                        // Should not happen if fetch succeeded, unless project deleted in background
                        // Fallback to local (will likely fail save but better than crashing)
                        return {
                            recordName: p.recordName,
                            recordType: 'CD_Project',
                            recordChangeTag: p.recordChangeTag,
                            fields: {
                                CD_order: p.fields.CD_order
                            }
                        };
                    }

                    return {
                        recordName: freshRecord.recordName,
                        recordType: 'CD_Project',
                        recordChangeTag: freshRecord.recordChangeTag, // Use FRESH tag
                        fields: {
                            CD_order: p.fields.CD_order // Use NEW order
                        }
                    };
                });

                // Only save if order actually changed (optimization)
                // But for now, save simply
                const result = await privateDB.saveRecords(recordsToUpdate, { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                // Update change tags
                const savedRecords = result.records;
                setProjects(currentProjects => currentProjects.map(p => {
                    const saved = savedRecords.find((r: any) => r.recordName === p.recordName);
                    return saved ? { ...p, recordChangeTag: saved.recordChangeTag } : p;
                }));

                console.log('Project order updated successfully');
            } catch (err: any) {
                console.error('Failed to reorder projects:', err);
                alert('Failed to reorder projects: ' + err.message);
                // Revert on error?
                // For now, let's just log. Reloading might be needed.
            }
            return;
        }

        // --- Handle Task Move (Legacy Logic) ---
        // Don't do anything if dropped on same project
        if (targetProject.recordName === selectedProject?.recordName) return;

        // Optimistic update: Remove task from current list immediately
        setTasks(prev => prev.filter(t => t.recordName !== id));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update project reference
            if (targetProject.recordName === 'inbox-pseudo-project') {
                // Remove the field entirely (send null or undefined? CloudKit JS usually expects value: null to delete)
                taskRecord.fields.CD_project = { value: null };
            } else {
                taskRecord.fields.CD_project = {
                    value: targetProject.recordName
                };
            }
            taskRecord.fields.CD_modifieddate = { value: Date.now() };

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);

            console.log('Task reassigned successfully');

        } catch (err: any) {
            console.error('Reassign error:', err);
            alert('Failed to reassign task: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleDropNextActions = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId || !container) return;

        // Optimistic update: Remove task from current list immediately
        setTasks(prev => prev.filter(t => t.recordName !== taskId));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            const fetchResult = await privateDB.fetchRecords([taskId], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Apply Next Actions logic
            const updates: any = {};

            // If task has no project, assign to Single Actions project
            if (!taskRecord.fields.CD_project?.value) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                if (singleActionsProject) {
                    updates.CD_project = { value: singleActionsProject.recordName };
                }
            }
            // If task already has a project, don't change it

            // If someday is set, remove it
            if (taskRecord.fields.CD_someday?.value === 1) {
                updates.CD_someday = { value: 0 };
            }

            // If waiting for is set, remove it
            if (taskRecord.fields.CD_waitingfor?.value === 1) {
                updates.CD_waitingfor = { value: 0 };
            }

            // Remove date constraints to make task immediately available
            if (taskRecord.fields.CD_dateactive?.value === 1) {
                updates.CD_dateactive = { value: 0 };
            }
            if (taskRecord.fields.CD_hideuntildate?.value === 1) {
                updates.CD_hideuntildate = { value: 0 };
            }

            updates.CD_modifieddate = { value: Date.now() };

            // Apply updates to task record
            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);

            console.log('Task moved to Next Actions successfully');

        } catch (err: any) {
            console.error('Move to Next Actions error:', err);
            alert('Failed to move task to Next Actions: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleDropWaiting = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.recordName === id) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                // If it doesn't have a project, assign Single Actions
                const needsProject = !t.fields.CD_project?.value;

                return {
                    ...t,
                    fields: {
                        ...t.fields,
                        CD_waitingfor: { value: 1 },
                        CD_someday: { value: 0 },
                        CD_completed: { value: 0 },
                        ...(needsProject && singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                    }
                };
            }
            return t;
        }));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update fields
            const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
            const needsProject = !taskRecord.fields.CD_project?.value;

            const updates: any = {
                CD_waitingfor: { value: 1 },
                CD_someday: { value: 0 },
                CD_completed: { value: 0 },
                CD_modifieddate: { value: Date.now() }
            };

            if (needsProject && singleActionsProject) {
                updates.CD_project = { value: singleActionsProject.recordName };
            }

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);

            console.log('Task moved to Waiting for successfully');

        } catch (err: any) {
            console.error('Move to Waiting for error:', err);
            alert('Failed to move task to Waiting for: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleDropDeferred = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Calculate Tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0); // Start of day
        const tomorrowTs = tomorrow.getTime();

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.recordName === id) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                const needsProject = !t.fields.CD_project?.value;

                return {
                    ...t,
                    fields: {
                        ...t.fields,
                        CD_date: { value: tomorrowTs },
                        CD_dateactive: { value: 1 },
                        CD_hideuntildate: { value: 1 },
                        CD_someday: { value: 0 },
                        CD_waitingfor: { value: 0 },
                        CD_completed: { value: 0 },
                        ...(needsProject && singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                    }
                };
            }
            return t;
        }));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update
            const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
            const needsProject = !taskRecord.fields.CD_project?.value;

            const updates: any = {
                CD_date: { value: tomorrowTs },
                CD_dateactive: { value: 1 },
                CD_hideuntildate: { value: 1 },
                CD_someday: { value: 0 },
                CD_waitingfor: { value: 0 },
                CD_completed: { value: 0 },
                CD_modifieddate: { value: Date.now() }
            };

            if (needsProject && singleActionsProject) {
                updates.CD_project = { value: singleActionsProject.recordName };
            }

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);

            console.log('Task moved to Deferred successfully');

        } catch (err: any) {
            console.error('Move to Deferred error:', err);
            alert('Failed to move task to Deferred: ' + err.message);
            window.location.reload();
        }
    };

    const handleDropDue = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Set to Today
        const todayTs = Date.now();

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.recordName === id) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                const needsProject = !t.fields.CD_project?.value;

                return {
                    ...t,
                    fields: {
                        ...t.fields,
                        CD_date: { value: todayTs },
                        CD_dateactive: { value: 1 },
                        CD_someday: { value: 0 },
                        CD_waitingfor: { value: 0 },
                        CD_completed: { value: 0 },
                        ...(needsProject && singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                    }
                };
            }
            return t;
        }));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update
            const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
            const needsProject = !taskRecord.fields.CD_project?.value;

            const updates: any = {
                CD_date: { value: todayTs },
                CD_dateactive: { value: 1 },
                CD_someday: { value: 0 },
                CD_waitingfor: { value: 0 },
                CD_completed: { value: 0 },
                CD_modifieddate: { value: Date.now() }
            };

            if (needsProject && singleActionsProject) {
                updates.CD_project = { value: singleActionsProject.recordName };
            }

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);

            console.log('Task moved to Due successfully');

        } catch (err: any) {
            console.error('Move to Due error:', err);
            alert('Failed to move task to Due: ' + err.message);
            window.location.reload();
        }
    };

    const handleDropSomeday = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Optimistic update
        setTasks(prev => prev.filter(t => t.recordName !== id));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Updates
            const updates: any = {};
            updates.CD_someday = { value: 1 };
            // Clear waiting
            if (taskRecord.fields.CD_waitingfor?.value === 1) updates.CD_waitingfor = { value: 0 };
            // If no project, assign to Single Actions
            if (!taskRecord.fields.CD_project?.value) {
                const singleActions = projects.find(p => p.fields.CD_singleactions?.value === 1);
                if (singleActions) updates.CD_project = { value: singleActions.recordName };
            }
            updates.CD_modifieddate = { value: Date.now() };

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);

            console.log('Task moved to Someday successfully');
        } catch (err: any) {
            console.error('Move to Someday error:', err);
            alert('Failed to move task to Someday: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleTaskDragOver = (e: React.DragEvent, task: TaskRecord) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Calculate if top or bottom half
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const isTop = y < rect.height / 2;
        const position = isTop ? 'top' : 'bottom';

        if (dragOverPosition !== position) {
            setDragOverPosition(position);
        }

        if (task.recordName !== editingTaskId && dragOverTaskId !== task.recordName) {
            setDragOverTaskId(task.recordName);
        }
    };

    const handleTaskDragLeave = () => {
        setDragOverTaskId(null);
        setDragOverPosition(null);
    };

    const handleTaskDrop = async (e: React.DragEvent, targetTask: TaskRecord) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverTaskId(null);
        setDragOverPosition(null);

        const draggedTaskId = e.dataTransfer.getData('text/plain');
        if (!draggedTaskId || draggedTaskId === targetTask.recordName || !container) return;

        // Ensure we are reordering within the same list (check if dragged task is in current list)
        // If not found, it might be a reassignment drop (handled elsewhere) - but here we are dropping ON A TASK.
        const oldIndex = tasks.findIndex(t => t.recordName === draggedTaskId);
        if (oldIndex === -1) return; // Task not in current list (maybe separate window?)

        let newIndex = tasks.findIndex(t => t.recordName === targetTask.recordName);
        if (newIndex === -1) return;

        // If dropped on bottom half, insert AFTER target
        if (dragOverPosition === 'bottom') {
            newIndex += 1;
        }

        // If moving down, we need to adjust index because removal shifts indices
        // But splice logic handles this if we do remove first then insert?
        // Let's use standard array move logic
        if (oldIndex < newIndex) {
            // Moving down. e.g. 0 -> 2 (insert at 2). 
            // If we remove 0, 1 becomes 0, 2 becomes 1. 
            // So if we wanted to insert after 2, 2 is now at 1.
            // Actually, if we use splice, we remove then insert.
            newIndex -= 1;
        }

        // Enforce Section Constraints (Project View)
        if (viewMode === 'project' && selectedProject) {
            const draggedTask = tasks[oldIndex];
            const draggedSection = getTaskSection(draggedTask);
            const targetSection = getTaskSection(targetTask);

            if (draggedSection !== targetSection) {
                console.log(`[Drag] Cannot move task between sections (${draggedSection} -> ${targetSection})`);
                return;
            }
        }

        // Reorder locally
        const newTasks = [...tasks];
        const [movedTask] = newTasks.splice(oldIndex, 1);
        newTasks.splice(newIndex, 0, movedTask);

        // Normalize Orders (1-based index)
        const tasksToSave: any[] = [];
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        newTasks.forEach((t, i) => {
            const newOrder = i + 1;
            // Update if changed (always update dragged task, and shifted ones)
            if (t.fields.CD_order?.value !== newOrder) {
                // Update local
                t.fields.CD_order = { value: newOrder };

                // Prepare for DB
                tasksToSave.push({
                    recordName: t.recordName,
                    recordType: 'CD_Task',
                    recordChangeTag: t.recordChangeTag,
                    fields: {
                        CD_order: { value: newOrder }
                    }
                });
            }
        });

        setTasks(newTasks);

        // Batch Save
        if (tasksToSave.length > 0) {
            try {
                const privateDB = container.privateCloudDatabase;
                const result = await privateDB.saveRecords(tasksToSave, { zoneID });

                if (result.hasErrors) throw new Error(result.errors[0].message);

                // Update local state with new change tags to prevent conflict on next save
                const savedRecords = result.records;
                setTasks(currentTasks => currentTasks.map(t => {
                    const saved = savedRecords.find((r: any) => r.recordName === t.recordName);
                    return saved ? { ...t, recordChangeTag: saved.recordChangeTag } : t;
                }));

                console.log('Reorder saved');
            } catch (err) {
                console.error('Reorder failed:', err);
                alert('Failed to save order');
            }
        }
    };

    // ========== CACHE-FIRST VIEW FILTERING ==========
    // Filter tasks from cache based on current view/project - NO CloudKit fetches!
    useEffect(() => {
        // Wait for cache to be initialized
        if (!cacheInitialized) {
            console.log('[View Filter] ⏳ Waiting for cache initialization...');
            setLoadingTasks(true);
            return;
        }

        // PAUSE filtering if user is editing a task to prevent overwriting the task list
        if (editingTaskId || editingId) {
            console.log('[View Filter] ⏸️ Filtering paused during editing');
            return;
        }

        console.log('[View Filter] 🔍 Filtering cache for view:', viewMode, selectedProject?.fields.CD_name?.value || '');

        // Filter cache based on current view
        let filtered = Object.values(allTasksCache);

        // If in project mode but no project selected, show empty
        if (viewMode === 'project' && !selectedProject) {
            console.log('[View Filter] No project selected, showing empty');
            setTasks([]);
            setLoadingTasks(false);
            return;
        }

        // Filter based on view mode
        if (viewMode === 'project' && selectedProject) {
            // Project view: tasks belonging to selected project
            // We now include ALL tasks (Next, Waiting, Someday, Deferred) because we have sections for them
            filtered = filtered.filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                // if (t.fields.CD_someday?.value === 1) return false; // REMOVED
                // if (t.fields.CD_waitingfor?.value === 1) return false; // REMOVED
                return t.fields.CD_project?.value === selectedProject.recordName;
            });

            // REMOVED deferred exclusion logic as well
        } else if (viewMode === 'inbox') {
            // Inbox: tasks without project, not someday, not waiting
            filtered = filtered.filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                if (t.fields.CD_someday?.value === 1) return false;
                if (t.fields.CD_waitingfor?.value === 1) return false;
                return !t.fields.CD_project?.value;
            });
        } else if (viewMode === 'next_actions') {
            // Next Actions: has project, not someday, not waiting, not deferred
            filtered = filtered.filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                if (t.fields.CD_someday?.value === 1) return false;
                if (t.fields.CD_waitingfor?.value === 1) return false;
                if (!t.fields.CD_project?.value) return false;

                // Exclude deferred (hidden until future date)
                if (t.fields.CD_dateactive?.value === 1 &&
                    t.fields.CD_hideuntildate?.value === 1 &&
                    t.fields.CD_date?.value) {
                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);
                    const taskDate = new Date(t.fields.CD_date.value);
                    if (taskDate > todayEnd) return false;
                }

                return true;
            });
        } else if (viewMode === 'waiting') {
            // Waiting For: has waitingfor flag
            filtered = filtered.filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                if (t.fields.CD_waitingfor?.value !== 1) return false;

                // Exclude if hidden until future (User Request: shouldn't show in Waiting)
                if (t.fields.CD_dateactive?.value === 1 &&
                    t.fields.CD_hideuntildate?.value === 1 &&
                    t.fields.CD_date?.value) {
                    const now = Date.now();
                    // Note: Use exact comparison to now, similar to deferred logic
                    if (t.fields.CD_date.value > now) return false;
                }

                return true;
            });
        } else if (viewMode === 'someday') {
            // Someday: has someday flag
            filtered = filtered.filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                return t.fields.CD_someday?.value === 1;
            });
        } else if (viewMode === 'due') {
            // Due: has date, date is today or earlier, not deferred
            filtered = filtered.filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                // REMOVED: if (t.fields.CD_someday?.value === 1) return false;
                // REMOVED: if (t.fields.CD_waitingfor?.value === 1) return false;
                if (!t.fields.CD_dateactive?.value || t.fields.CD_dateactive.value !== 1) return false;
                if (!t.fields.CD_date?.value) return false;

                // Exclude if hidden until future
                if (t.fields.CD_hideuntildate?.value === 1) {
                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);
                    const taskDate = new Date(t.fields.CD_date.value);
                    if (taskDate > todayEnd) return false;
                }

                // Include if date is today or past
                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);
                const taskDate = new Date(t.fields.CD_date.value);
                return taskDate <= todayEnd;
            });
        } else if (viewMode === 'deferred') {
            // Deferred: has project, hidden until future date
            filtered = filtered.filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                // REMOVED: if (t.fields.CD_someday?.value === 1) return false;
                // REMOVED: if (t.fields.CD_waitingfor?.value === 1) return false;
                if (!t.fields.CD_project?.value) return false;

                // Must be hidden until future date
                if (t.fields.CD_dateactive?.value !== 1) return false;
                if (t.fields.CD_hideuntildate?.value !== 1) return false;
                if (!t.fields.CD_date?.value) return false;

                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);
                const taskDate = new Date(t.fields.CD_date.value);
                return taskDate > todayEnd;
            });
        } else if (viewMode === 'history') {
            // History: completed tasks only
            filtered = filtered.filter(t => t.fields.CD_completed?.value === 1);
        }

        // Sort by order (or by modified date for history)
        if (viewMode === 'history') {
            filtered.sort((a, b) => {
                const dateA = a.fields.CD_modifieddate?.value ?? 0;
                const dateB = b.fields.CD_modifieddate?.value ?? 0;
                return dateB - dateA; // DESC
            });
        } else {
            filtered.sort((a, b) => {
                const orderA = a.fields.CD_order?.value ?? 0;
                const orderB = b.fields.CD_order?.value ?? 0;
                return orderA - orderB;
            });
        }

        console.log(`[View Filter] ✅ Filtered ${filtered.length} tasks from cache`);
        setTasks(filtered);
        setLoadingTasks(false);
    }, [selectedProject, viewMode, cacheInitialized, allTasksCache, editingTaskId, editingId]);


    const handleToggleComplete = async (task: TaskRecord) => {
        if (!container) return;

        const isCompleting = task.fields.CD_completed?.value !== 1;
        const isRecurring = task.fields.CD_recurring?.value === 1;

        // Optimistic UI updates
        // Show animation for all list views (Project, Inbox, Next Actions, Due, Waiting, Deferred, Someday)
        // Only exclude 'history' view if we ever add toggling there (which usually just un-completes)
        if (viewMode !== 'history' && isCompleting) {
            setCompletingTaskIds(prev => new Set(prev).add(task.recordName));
            if (!isRecurring) {
                // Only hide if not recurring (recurrence stays in list but updates date)
                setTimeout(() => {
                    setCompletingTaskIds(prev => {
                        const next = new Set(prev);
                        next.delete(task.recordName);
                        return next;
                    });
                }, 1000);
            } else {
                // Clean up the completing ID immediately after state update so it doesn't stay "faded"
                setTimeout(() => {
                    setCompletingTaskIds(prev => {
                        const next = new Set(prev);
                        next.delete(task.recordName);
                        return next;
                    });
                }, 500); // Shorter flash for update

            }
        }

        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        // RECURRING TASK LOGIC
        if (isRecurring && isCompleting) {
            // 1. Calculate New Date
            const currentTimestamp = task.fields.CD_date?.value || Date.now();
            const recurrenceVal = task.fields.CD_recurrence?.value || 1;
            const recurrenceType = task.fields.CD_recurrencetype?.value || 'days';

            const nextDate = new Date(currentTimestamp);

            switch (recurrenceType) {
                case 'weeks':
                    nextDate.setDate(nextDate.getDate() + (recurrenceVal * 7));
                    break;
                case 'months':
                    nextDate.setMonth(nextDate.getMonth() + recurrenceVal);
                    break;
                case 'years':
                    nextDate.setFullYear(nextDate.getFullYear() + recurrenceVal);
                    break;
                case 'days':
                default:
                    nextDate.setDate(nextDate.getDate() + recurrenceVal);
                    break;
            }

            const nextTimestamp = nextDate.getTime();

            // 2. Create History Record (Completed Duplicate)
            // Generate a random UUID-like string for the new record name
            const historyRecordName = crypto.randomUUID();

            const historyRecord = {
                recordName: historyRecordName,
                recordType: 'CD_Task',
                fields: {
                    ...task.fields,
                    CD_recurring: { value: 0 },
                    CD_completed: { value: 1 },
                    CD_ticked: { value: 1 },
                    CD_modifieddate: { value: Date.now() },
                    CD_id: { value: crypto.randomUUID() }, // New unique ID for the history instance
                    // Ensure we don't carry over cloudkit system fields if they were in fields (they usually aren't directly)
                }
            };

            // 3. Update Original Record
            const originalUpdate = {
                recordName: task.recordName,
                recordChangeTag: task.recordChangeTag,
                fields: {
                    CD_date: { value: nextTimestamp },
                    CD_modifieddate: { value: Date.now() }
                    // CD_completed remains 0
                }
            };

            // Local Update
            setTasks(prev => {
                const updatedList = prev.map(t =>
                    t.recordName === task.recordName
                        ? { ...t, fields: { ...t.fields, CD_date: { value: nextTimestamp } } }
                        : t
                );
                // We typically don't show the history item in 'project' view, so no need to insert it into 'tasks' state
                // unless we are in history view? But we are "completing" it, so it goes to history.
                return updatedList;
            });

            // Persist Batch
            try {
                const result = await privateDB.saveRecords([historyRecord, originalUpdate], { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                console.log('Recurring task processed: duplicated history and rescheduled original.');

                // Update local change tag for original task
                const savedOriginal = result.records.find((r: any) => r.recordName === task.recordName);
                if (savedOriginal) {
                    setTasks(currentTasks => currentTasks.map(t =>
                        t.recordName === task.recordName
                            ? { ...t, recordChangeTag: savedOriginal.recordChangeTag }
                            : t
                    ));
                }

            } catch (err) {
                console.error('Recurring task save failed:', err);
                alert('Failed to process recurring task');
                // Revert local state?
                window.location.reload();
            }

            return;
        }

        // STANDARD TOGGLE LOGIC (Non-recurring or Un-completing)

        // Update Local State array
        setTasks(prev => prev.map(t =>
            t.recordName === task.recordName
                ? { ...t, fields: { ...t.fields, CD_completed: { value: isCompleting ? 1 : 0 } } }
                : t
        ));

        // Persist
        try {
            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            // Background sync might have updated the record tag since we last saw it
            const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);

            const latestRecord = fetchResult.records[0];

            const recordToSave = {
                recordName: latestRecord.recordName,
                recordChangeTag: latestRecord.recordChangeTag, // Use the fresh tag!
                fields: {
                    ...latestRecord.fields, // Keep existing fields
                    CD_completed: { value: isCompleting ? 1 : 0 },
                    CD_ticked: { value: isCompleting ? 1 : 0 },
                    CD_modifieddate: { value: Date.now() }
                }
            };

            const result = await privateDB.saveRecords([recordToSave], { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            // Update local state with new change tag
            const savedRecord = result.records[0];
            setTasks(currentTasks => currentTasks.map(t =>
                t.recordName === savedRecord.recordName
                    ? { ...t, recordChangeTag: savedRecord.recordChangeTag }
                    : t
            ));
        } catch (err) {
            console.error('Toggle complete failed:', err);
            alert('Network error: Failed to update task status. Please check your connection.');

            // Revert optimistic update using original task state
            setTasks(prev => prev.map(t =>
                t.recordName === task.recordName
                    ? { ...t, fields: { ...t.fields, CD_completed: task.fields.CD_completed } }
                    : t
            ));
        }
    };

    // Derived Lists
    // In 'project' mode: show tasks that are NOT completed OR are in the 'completing' animation state.
    // In 'inbox' mode: show tasks with no project and NOT completed.
    // In 'next_actions' mode: show tasks that are NOT completed (already filtered by query).
    // In 'history' mode: show tasks that ARE completed (and NOT uncompleted, though local state update handles that).

    const visibleTasks = tasks.filter(t => {
        if (viewMode === 'project') {
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'inbox') {
            // Inbox: Show tasks with NO project (or empty string) AND not completed
            return (!t.fields.CD_project?.value) && (t.fields.CD_completed?.value !== 1 || completingTaskIds.has(t.recordName));
        } else if (viewMode === 'next_actions') {
            // Next Actions: Show non-completed tasks (already filtered by query for someday/waiting/etc)
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'someday') {
            // Someday: Show non-completed tasks
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'due') {
            // Due: Show non-completed tasks with date <= Today
            if (t.fields.CD_completed?.value === 1 && !completingTaskIds.has(t.recordName)) return false;
            if (!t.fields.CD_date?.value) return false;
            if (t.fields.CD_dateactive?.value !== 1) return false;

            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            const taskDate = new Date(t.fields.CD_date.value);
            return taskDate <= todayEnd;
        } else if (viewMode === 'waiting') {
            // Waiting: Show non-completed tasks (filtered by query)
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'deferred') {
            // Deferred: Show non-completed tasks (filtered by query)
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else {
            // History mode
            return t.fields.CD_completed?.value === 1;
        }
    });

    const sections = useMemo(() => {
        if (viewMode !== 'project') return null;

        const due: TaskRecord[] = [];
        const nextActions: TaskRecord[] = [];
        const waitingFor: TaskRecord[] = [];
        const deferred: TaskRecord[] = [];
        const somedayMaybe: TaskRecord[] = [];

        visibleTasks.forEach(t => {
            const section = getTaskSection(t);
            if (section === 'due') {
                due.push(t);
                // ALSO add to Next Actions if it's not blocked (Waiting/Someday)
                // This allows users to see it in their main list flow as well
                if (!t.fields.CD_waitingfor?.value && !t.fields.CD_someday?.value) {
                    nextActions.push(t);
                }
            }
            else if (section === 'waitingFor') waitingFor.push(t);
            else if (section === 'somedayMaybe') somedayMaybe.push(t);
            else if (section === 'deferred') deferred.push(t);
            else nextActions.push(t);
        });

        // Ensure tasks within due are sorted by date
        due.sort((a, b) => (a.fields.CD_date?.value || 0) - (b.fields.CD_date?.value || 0));

        return { due, nextActions, waitingFor, deferred, someday: somedayMaybe };
    }, [visibleTasks, viewMode]);

    // Details Side Panel Handlers
    const handleTaskClick = (task: TaskRecord) => {
        setSelectedTaskDetails(task);
    };

    const renderTaskList = (tasksToRender: TaskRecord[]) => {
        // Filter passed tasks based on search
        const filteredTasks = tasksToRender.filter(task => {
            if (searchQuery.trim() && !matchingTaskIds.has(task.recordName)) {
                return false;
            }
            return true;
        });

        return (
            <>
                {filteredTasks.map(task => (
                    <TaskItem
                        key={task.recordName}
                        task={task}
                        viewMode={viewMode}
                        editingTaskId={editingTaskId}
                        dragOverTaskId={dragOverTaskId}
                        dragOverPosition={dragOverPosition}
                        projects={projects}
                        editTaskName={editTaskName}
                        setEditTaskName={setEditTaskName}
                        onDragStart={handleDragStart}
                        onDragOver={(e) => handleTaskDragOver(e, task)}
                        onDragEnter={() => { }}
                        onDragLeave={handleTaskDragLeave}
                        onDrop={handleTaskDrop}
                        onToggleComplete={handleToggleComplete}
                        onTaskClick={handleTaskClick}
                        onSave={handleTaskSave}
                        onCancel={handleTaskCancel}
                        onInsertTask={handleInsertTask}
                        onEditClick={handleTaskEditClick}
                    />
                ))}
            </>
        );
    };

    // Modified to accept batch updates or single field
    const handleUpdateTaskDetail = async (fieldOrUpdates: keyof TaskRecord['fields'] | Record<string, any>, value?: any) => {
        if (!selectedTaskDetails || !container) return;

        let updates: Record<string, any> = {};
        if (typeof fieldOrUpdates === 'string') {
            updates[fieldOrUpdates] = value;
        } else {
            updates = fieldOrUpdates;
        }

        const updatedTask = { ...selectedTaskDetails };

        // Update local state details immediately
        Object.entries(updates).forEach(([key, val]) => {
            const field = key as keyof TaskRecord['fields'];
            if (!updatedTask.fields[field]) {
                (updatedTask.fields as any)[field] = { value: val };
            } else {
                (updatedTask.fields as any)[field].value = val;
            }
        });

        // Always update modified date
        updatedTask.fields.CD_modifieddate = { value: Date.now() };

        setSelectedTaskDetails(updatedTask);

        // Update main list state
        setTasks(prev => prev.map(t => t.recordName === updatedTask.recordName ? updatedTask : t));

        // Persist
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // CRITICAL FIX: Fetch latest version before saving to avoid CAS Op-Lock failures
            const fetchResult = await privateDB.fetchRecords([updatedTask.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const latestRecord = fetchResult.records[0];

            const fieldsToSave: Record<string, any> = {
                CD_modifieddate: { value: Date.now() }
            };

            Object.entries(updates).forEach(([key, val]) => {
                fieldsToSave[key] = { value: val };
            });

            // Use fetched record's change tag
            const recordToSave = {
                recordName: latestRecord.recordName,
                recordChangeTag: latestRecord.recordChangeTag, // Use fresh tag
                fields: fieldsToSave // CloudKit merges fields, so we only send what changed + modifieddate
            };

            const result = await privateDB.saveRecords([recordToSave], { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            // Sync change tag
            const savedRecord = result.records[0];
            const finalTask = { ...updatedTask, recordChangeTag: savedRecord.recordChangeTag };

            setSelectedTaskDetails(finalTask);
            setTasks(prev => prev.map(t => t.recordName === finalTask.recordName ? finalTask : t));

        } catch (err) {
            console.error('Failed to update task details:', err);
            // Revert UI if needed or show error toast
        }
    };

    // Status Helper Logic
    const toggleStatus = (type: 'next' | 'someday' | 'waiting') => {
        if (!selectedTaskDetails) return;

        const isSomeday = selectedTaskDetails.fields.CD_someday?.value === 1;
        const isWaiting = selectedTaskDetails.fields.CD_waitingfor?.value === 1;
        const isNext = !isSomeday && !isWaiting;

        let updates: Record<string, any> = {};

        if (type === 'next') {
            if (isNext) {
                // Untick Next -> Toggle Someday (as requested)
                updates = { CD_someday: 1, CD_waitingfor: 0 };
            } else {
                // Tick Next -> Clear others
                updates = { CD_someday: 0, CD_waitingfor: 0 };
            }
        } else if (type === 'someday') {
            if (isSomeday) {
                // Untick Someday -> Next
                updates = { CD_someday: 0, CD_waitingfor: 0 };
            } else {
                // Tick Someday -> Clear others
                updates = { CD_someday: 1, CD_waitingfor: 0 };
            }
        } else if (type === 'waiting') {
            if (isWaiting) {
                // Untick Waiting -> Next
                updates = { CD_someday: 0, CD_waitingfor: 0 };
            } else {
                // Tick Waiting -> Clear others
                updates = { CD_someday: 0, CD_waitingfor: 1 };
            }
        }

        handleUpdateTaskDetail(updates);
    };

    const handleToggleDate = () => {
        if (!selectedTaskDetails) return;
        const isActive = selectedTaskDetails.fields.CD_dateactive?.value === 1;

        let updates: Record<string, any> = {};
        if (isActive) {
            // Turning OFF: Disable Date AND Reminder AND Recurring
            updates = { CD_dateactive: 0, CD_reminderactive: 0, CD_recurring: 0 };
        } else {
            // Turning ON: Enable Date, ensure date value exists (default to today if null)
            updates = { CD_dateactive: 1 };
            if (!selectedTaskDetails.fields.CD_date?.value) {
                updates.CD_date = Date.now();
            }
        }
        handleUpdateTaskDetail(updates);
    };

    const handleToggleReminder = () => {
        if (!selectedTaskDetails) return;
        const isActive = selectedTaskDetails.fields.CD_reminderactive?.value === 1;

        let updates: Record<string, any> = {};
        if (isActive) {
            // Turning OFF: Just disable Reminder
            updates = { CD_reminderactive: 0 };
        } else {
            // Turning ON: Enable Reminder AND Date
            updates = { CD_reminderactive: 1, CD_dateactive: 1 };
            if (!selectedTaskDetails.fields.CD_date?.value) {
                updates.CD_date = Date.now();
            }
        }
        handleUpdateTaskDetail(updates);
    };


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        // [Existing Login UI]
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                    <ListTodo className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Log in to Next Idea</h1>
                <p className="text-gray-600 mb-8 max-w-md">Access your projects and tasks directly from your browser.</p>
                <div id="apple-sign-in-button" className="transition-transform hover:scale-105 empty:before:content-['Coming_soon'] empty:before:text-3xl empty:before:text-gray-400 empty:before:font-bold"></div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] mt-16 bg-white overflow-hidden relative">
            {/* Sidebar: Projects */}
            <Sidebar
                viewMode={viewMode}
                setViewMode={(mode) => setViewMode(mode)}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                fetching={fetching}
                dragOverProjectId={dragOverProjectId}
                setDragOverProjectId={setDragOverProjectId}
                dragOverPosition={dragOverPosition}
                isDraggingProject={isDraggingProject}
                editingId={editingId}
                editName={editName}
                setEditName={setEditName}
                onCreateProject={handleCreateProject}
                onProjectSave={handleProjectSave}
                onCancel={handleCancel}
                onEditClick={handleEditClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDropDue={handleDropDue}
                onDropNextActions={handleDropNextActions}
                onDropWaiting={handleDropWaiting}
                onDropDeferred={handleDropDeferred}
                onDropSomeday={handleDropSomeday}
                onShowShortcuts={(show) => setShowShortcuts(show)}
                counts={sidebarCounts}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                projectsWithMatches={projectsWithMatches}
                listsWithMatches={listsWithMatches}
            />
            {/* Main Content: Tasks */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {viewMode === 'project'
                                ? (selectedProject?.fields.CD_name?.value || 'Select a Project')
                                : viewMode === 'inbox' ? 'Inbox'
                                    : viewMode === 'next_actions' ? 'Next actions'
                                        : viewMode === 'waiting' ? 'Waiting for'
                                            : viewMode === 'deferred' ? 'Deferred'
                                                : viewMode === 'someday' ? 'Someday / Maybe'
                                                    : viewMode === 'due' ? 'Due and Overdue'
                                                        : 'Completed Tasks'
                            }
                        </h1>
                        {(viewMode === 'project' && selectedProject || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred') && (
                            <button
                                onClick={handleCreateTask}
                                className="p-1 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                title="New Task (Cmd+N)"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>

                {taskError && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                        <X className="w-4 h-4" />
                        <span>{taskError}</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6">
                    {loadingTasks ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : visibleTasks.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            {viewMode === 'project' ? (
                                <>
                                    <ListTodo className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">No active tasks in this project.</p>
                                </>
                            ) : viewMode === 'inbox' ? (
                                <>
                                    <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">Inbox is empty.</p>
                                </>
                            ) : viewMode === 'next_actions' ? (
                                <>
                                    <Zap className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No next actions available.</p>
                                </>
                            ) : viewMode === 'someday' ? (
                                <>
                                    <CalendarClock className="w-12 h-12 text-amber-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No someday tasks.</p>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-12 h-12 text-green-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No completed tasks yet.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {viewMode === 'project' && sections ? (
                                <>
                                    {sections.due.length > 0 && (
                                        <TaskSection title="Due / Overdue" count={sections.due.length} colorClass="text-green-700">
                                            {renderTaskList(sections.due)}
                                        </TaskSection>
                                    )}

                                    {sections.nextActions.length > 0 && (
                                        <TaskSection title="Next Actions" count={sections.nextActions.length} colorClass="text-blue-700">
                                            {renderTaskList(sections.nextActions)}
                                        </TaskSection>
                                    )}

                                    {sections.waitingFor.length > 0 && (
                                        <TaskSection title="Waiting For" count={sections.waitingFor.length} colorClass="text-orange-500">
                                            {renderTaskList(sections.waitingFor)}
                                        </TaskSection>
                                    )}

                                    {sections.deferred.length > 0 && (
                                        <TaskSection title="Deferred" count={sections.deferred.length} colorClass="text-gray-600">
                                            {renderTaskList(sections.deferred)}
                                        </TaskSection>
                                    )}

                                    {sections.someday.length > 0 && (
                                        <TaskSection title="Someday / Maybe" count={sections.someday.length} colorClass="text-[#92400e]">
                                            {renderTaskList(sections.someday)}
                                        </TaskSection>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-2">
                                    {renderTaskList(visibleTasks)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Keyboard Shortcuts Modal */}
            {showShortcuts && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Keyboard className="w-6 h-6 text-blue-600" />
                                <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2>
                            </div>
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Tasks Section */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <ListTodo className="w-5 h-5 text-blue-600" />
                                    Tasks
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create task at bottom</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">N</kbd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create task at top</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">Shift + N</kbd>
                                    </div>
                                </div>
                            </div>

                            {/* Projects Section */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-blue-600" />
                                    Projects
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create project at bottom</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">P</kbd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create project at top</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">Shift + P</kbd>
                                    </div>
                                </div>
                            </div>

                            {/* General Section */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Keyboard className="w-5 h-5 text-blue-600" />
                                    General
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Show this help</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">?</kbd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Close modals</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">Esc</kbd>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-sm text-gray-600">
                            Press <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded shadow-sm font-mono text-xs">Esc</kbd> to close
                        </div>
                    </div>
                </div>
            )}

            {selectedTaskDetails && (
                <div className="absolute inset-0 z-50 bg-black/10 backdrop-blur-[1px] flex justify-end">
                    {/* Click backdrop to close */}
                    <div className="absolute inset-0" onClick={() => setSelectedTaskDetails(null)} />

                    <div className="relative w-96 bg-white shadow-2xl border-l border-gray-100 h-full flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                            <div>
                                <h2 className="font-bold text-lg text-gray-900 break-words line-clamp-2">
                                    {selectedTaskDetails.fields.CD_name?.value}
                                </h2>
                                <p className="text-xs text-gray-400 mt-1">Details</p>
                            </div>
                            <button onClick={() => setSelectedTaskDetails(null)} className="text-gray-400 hover:text-gray-600 mt-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Date Field */}
                            {/* Date & Reminder Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    {/* Date Toggle */}
                                    <div className="flex-1 flex items-center justify-between p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={handleToggleDate}>
                                        <div className="flex items-center gap-2">
                                            <Calendar className={`w-4 h-4 ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'text-blue-500' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-medium ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'text-gray-900' : 'text-gray-500'}`}>Date</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'translate-x-4' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Reminder Toggle */}
                                    <div className="flex-1 flex items-center justify-between p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={handleToggleReminder}>
                                        <div className="flex items-center gap-2">
                                            <Clock className={`w-4 h-4 ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'text-blue-500' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-medium ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'text-gray-900' : 'text-gray-500'}`}>Reminder</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'translate-x-4' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Conditional Input */}
                                {selectedTaskDetails.fields.CD_dateactive?.value === 1 && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                        <input
                                            type={selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? "datetime-local" : "date"}
                                            className="w-full text-sm p-2 border border-blue-100 bg-blue-50/30 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-700"
                                            value={selectedTaskDetails.fields.CD_date?.value ?
                                                (selectedTaskDetails.fields.CD_reminderactive?.value === 1
                                                    ? new Date(selectedTaskDetails.fields.CD_date.value).toISOString().slice(0, 16)
                                                    : new Date(selectedTaskDetails.fields.CD_date.value).toISOString().slice(0, 10)
                                                ) : ''}
                                            onChange={(e) => {
                                                const dateVal = e.target.value ? new Date(e.target.value).getTime() : 0;
                                                handleUpdateTaskDetail('CD_date', dateVal);
                                            }}
                                        />

                                        <div className="mt-4 flex items-center justify-between">
                                            <div
                                                className="flex items-center gap-2 cursor-pointer group w-fit"
                                                onClick={() => handleUpdateTaskDetail('CD_recurring', selectedTaskDetails.fields.CD_recurring?.value === 1 ? 0 : 1)}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedTaskDetails.fields.CD_recurring?.value === 1 ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                                    {selectedTaskDetails.fields.CD_recurring?.value === 1 && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={`text-xs ${selectedTaskDetails.fields.CD_recurring?.value === 1 ? 'text-blue-600 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>Recurring Task</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer group w-fit"
                                                    onClick={() => handleUpdateTaskDetail('CD_hideuntildate', selectedTaskDetails.fields.CD_hideuntildate?.value === 1 ? 0 : 1)}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedTaskDetails.fields.CD_hideuntildate?.value === 1 ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                                        {selectedTaskDetails.fields.CD_hideuntildate?.value === 1 && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className={`text-xs ${selectedTaskDetails.fields.CD_hideuntildate?.value === 1 ? 'text-blue-600 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>Hide until date</span>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedTaskDetails.fields.CD_recurring?.value === 1 && (
                                            <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="w-16">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="w-full text-xs p-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={selectedTaskDetails.fields.CD_recurrence?.value || 1}
                                                        onChange={(e) => handleUpdateTaskDetail('CD_recurrence', parseInt(e.target.value) || 1)}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <select
                                                        className="w-full text-xs p-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                                                        value={selectedTaskDetails.fields.CD_recurrencetype?.value || 'days'}
                                                        onChange={(e) => handleUpdateTaskDetail('CD_recurrencetype', e.target.value)}
                                                    >
                                                        <option value="days">Days</option>
                                                        <option value="weeks">Weeks</option>
                                                        <option value="months">Months</option>
                                                        <option value="years">Years</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />


                            <div className="space-y-4">
                                {/* Next Action (Calculated: !someday && !waiting) */}
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleStatus('next')}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${(!selectedTaskDetails.fields.CD_someday?.value && !selectedTaskDetails.fields.CD_waitingfor?.value) ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <Zap className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">Next Action</p>
                                            <p className="text-xs text-gray-500">Do this as soon as possible</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${(!selectedTaskDetails.fields.CD_someday?.value && !selectedTaskDetails.fields.CD_waitingfor?.value) ? 'bg-yellow-500' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${(!selectedTaskDetails.fields.CD_someday?.value && !selectedTaskDetails.fields.CD_waitingfor?.value) ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleStatus('someday')}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${selectedTaskDetails.fields.CD_someday?.value === 1 ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <Moon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">Someday / Maybe</p>
                                            <p className="text-xs text-gray-500">No immediate action</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${selectedTaskDetails.fields.CD_someday?.value === 1 ? 'bg-purple-500' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_someday?.value === 1 ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleStatus('waiting')}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${selectedTaskDetails.fields.CD_waitingfor?.value === 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <Hourglass className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">Waiting For</p>
                                            <p className="text-xs text-gray-500">Waiting on someone else</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${selectedTaskDetails.fields.CD_waitingfor?.value === 1 ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_waitingfor?.value === 1 ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>

                                {/* Link Field */}
                                <div className="pt-2 border-t border-gray-50">
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Link</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all placeholder:text-gray-400"
                                                placeholder="Add a link..."
                                                value={linkInput}
                                                onChange={(e) => setLinkInput(e.target.value)}
                                                onBlur={() => {
                                                    if (selectedTaskDetails && linkInput !== (selectedTaskDetails.fields.CD_link?.value || '')) {
                                                        handleUpdateTaskDetail('CD_link', linkInput);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.currentTarget.blur(); // Trigger blur to save
                                                    }
                                                }}
                                            />
                                        </div>
                                        {selectedTaskDetails.fields.CD_link?.value && (
                                            <a
                                                href={selectedTaskDetails.fields.CD_link.value.startsWith('http') ? selectedTaskDetails.fields.CD_link.value : `https://${selectedTaskDetails.fields.CD_link.value}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center"
                                                title="Open Link"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                    <polyline points="15 3 21 3 21 9"></polyline>
                                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                </div>


                            </div>
                        </div>





                        {/* Footer info */}
                        <div className="p-4 bg-gray-50 text-xs text-gray-400 border-t border-gray-100 flex justify-between">
                            <span>Change Tag: {selectedTaskDetails.recordChangeTag.slice(0, 8)}...</span>
                            <span>{selectedTaskDetails.fields.CD_modifieddate?.value ? new Date(selectedTaskDetails.fields.CD_modifieddate.value).toLocaleTimeString() : 'No date'}</span>
                        </div>
                    </div>
                </div>
            )
            }

        </div >
    );
}

export default function AppPage() {
    return (
        <CloudKitProvider>
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="pt-20">
                    <ProjectsList />
                </div>
                <Footer />
            </main>
        </CloudKitProvider>
    );
}
