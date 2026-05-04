'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { CloudKitProvider, useCloudKit } from '@/components/CloudKitProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ProjectRecord, TaskRecord, TagRecord, CLOUDKIT_ENV } from '@/lib/cloudkit';
import { TaskItem } from '@/components/app/TaskItem';
import { Sidebar } from '@/components/app/Sidebar';
import { TaskSection } from '@/components/app/TaskSection';
import { SFSymbolMapper } from '@/components/SFSymbolMapper';
import { Loader2, ListTodo, CheckCircle2, Pencil, Check, X, ClipboardList, Plus, Clock, RotateCcw, Calendar, Hourglass, Repeat, Moon, ChevronRight, Zap, Inbox, Keyboard, CalendarClock, CalendarDays, Tag, Trash2, Sun } from 'lucide-react';
import { SettingsModal } from '@/components/app/SettingsModal';
import { SelectedCalendar, GoogleEvent, fetchTodayEvents, formatEventTime } from '@/lib/google';

const REVIEW_ITEMS: { id: string; label: string; view: 'inbox' | 'next_actions' | 'waiting' | 'someday' | null }[] = [
    { id: 'collect', label: 'Collect ideas', view: null },
    { id: 'inbox', label: 'Empty your inbox', view: 'inbox' },
    { id: 'next', label: 'Review your next actions', view: 'next_actions' },
    { id: 'waiting', label: 'Review your waiting for list', view: 'waiting' },
    { id: 'projects', label: 'Review your project list', view: null },
    { id: 'someday', label: 'Review your someday list', view: 'someday' },
];

const getTaskSection = (task: TaskRecord) => {
    if (task.fields.CD_completed?.value === 1) return 'completed';
    if (task.fields.CD_waitingfor?.value === 1) return 'waitingFor';
    if (task.fields.CD_someday?.value === 1) return 'somedayMaybe';

    const now = Date.now();
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    const tomorrowTs = tomorrow.getTime();

    if (task.fields.CD_dateactive?.value === 1 && task.fields.CD_date?.value) {
        if (task.fields.CD_date.value < tomorrowTs) {
            return 'due'; // Due today or earlier
        }

        const taskDateStart = new Date(task.fields.CD_date.value);
        taskDateStart.setHours(0, 0, 0, 0);

        if (task.fields.CD_hideuntildate?.value === 1 && taskDateStart.getTime() > now) {
            return 'deferred'; // Hidden until future date/time
        }
        // If it has a date but is not due today and not hidden, it's just a regular next action
        // (will be caught by the nextActions return at the end)
    }

    if (!task.fields.CD_project?.value) return 'inbox';

    return 'nextActions';
};



function ProjectsList() {
    const { container, isAuthenticated, isLoading, login } = useCloudKit();
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [tags, setTags] = useState<TagRecord[]>([]);
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
    const [viewMode, setViewMode] = useState<'project' | 'history' | 'inbox' | 'next_actions' | 'someday' | 'due' | 'waiting' | 'deferred' | 'all_tasks' | 'review' | 'today'>('next_actions'); // Default to next_actions
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

    // Weekly Review State (persisted to localStorage)
    const [reviewChecked, setReviewChecked] = useState<Record<string, boolean>>(() => {
        if (typeof window === 'undefined') return {};
        try { return JSON.parse(localStorage.getItem('gtd-review-checked') || '{}'); } catch { return {}; }
    });
    const [lastReviewDate, setLastReviewDate] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        try { const v = localStorage.getItem('gtd-review-date'); return v ? parseInt(v) : null; } catch { return null; }
    });

    // Google Calendar State
    const [showSettings, setShowSettings] = useState(false);
    const [googleToken, setGoogleToken] = useState<string | null>(null);
    const [selectedCalendars, setSelectedCalendars] = useState<SelectedCalendar[]>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem('google-calendars') || '[]'); } catch { return []; }
    });
    const [todayEvents, setTodayEvents] = useState<GoogleEvent[]>([]);
    const [loadingTodayEvents, setLoadingTodayEvents] = useState(false);

    // Details Panel State
    const [selectedTaskDetails, setSelectedTaskDetails] = useState<TaskRecord | null>(null);
    const [selectedProjectDetails, setSelectedProjectDetails] = useState<ProjectRecord | null>(null);
    const [projectDetailsSaveState, setProjectDetailsSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [linkInput, setLinkInput] = useState('');
    const [noteInput, setNoteInput] = useState('');
    const [detailsSaveState, setDetailsSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const detailsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const noteDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [taskTagMap, setTaskTagMap] = useState<Record<string, string[]>>({});
    // Holds tag IDs chosen via the @ picker, bridging TaskItem's onTagsAdd → handleTaskSave
    const pendingTagIdsRef = useRef<string[]>([]);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Tag Filter State
    const [selectedFilterTags, setSelectedFilterTags] = useState<Set<string>>(new Set());
    const [excludedFilterTags, setExcludedFilterTags] = useState<Set<string>>(new Set());

    // Refresh State
    const [isRefreshing, setIsRefreshing] = useState(false);



    // Sync link/note input when selected task changes
    useEffect(() => {
        if (selectedTaskDetails) {
            setLinkInput(selectedTaskDetails.fields.CD_link?.value || '');
            setNoteInput(selectedTaskDetails.fields.CD_note?.value || '');
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
            allTasks: 0,
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
            if (task.fields.CD_completed?.value === 1) {
                return;
            }

            // Count for All Tasks
            counts.allTasks++;

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
                // Due/Overdue: always count if due today or earlier
                if (task.fields.CD_date.value < tomorrowTs) {
                    counts.due++;
                }

                // Get start of the task date
                const taskDateStart = new Date(task.fields.CD_date.value);
                taskDateStart.setHours(0, 0, 0, 0);

                // Priority 1: Deferred (Hidden until future date uses START of date)
                if (task.fields.CD_hideuntildate?.value === 1 && taskDateStart.getTime() > now) {
                    counts.deferred++;
                }
                // Priority 2: Next Actions / Waiting / Someday
                else {
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
    // Use a ref for lastCacheRefresh — it's only used for throttling inside the interval,
    // never rendered. Keeping it as state would add it to the deps array and cause the
    // interval to be recreated every 15s, which prevents it from ever firing.
    const lastCacheRefreshRef = useRef<number>(0);
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

    const handleManualRefresh = async () => {
        if (!container || !isAuthenticated) return;
        setIsRefreshing(true);
        try {
            const privateDB = container.privateCloudDatabase;
            const options = { zoneID: { zoneName: 'com.apple.coredata.cloudkit.zone' } };

            const fetchProjAndTags = async () => {
                const query = {
                    recordType: 'CD_Project',
                    filterBy: [{ fieldName: 'CD_name', comparator: 'NOT_EQUALS', fieldValue: { value: '' } }],
                    desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_completed', 'CD_singleactions', 'CD_focus', 'CD_icon', 'CD_color'],
                    resultsLimit: 100
                };
                const projResult = await privateDB.performQuery(query, options);
                if (!projResult.hasErrors) {
                    let records = projResult.records as ProjectRecord[];
                    records = records.filter(p => !p.fields.CD_completed || p.fields.CD_completed.value !== 1);
                    records.sort((a, b) => {
                        const isSingleA = a.fields.CD_singleactions?.value === 1;
                        const isSingleB = b.fields.CD_singleactions?.value === 1;
                        if (isSingleA && !isSingleB) return -1;
                        if (!isSingleA && isSingleB) return 1;
                        return (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0);
                    });
                    setProjects(records);
                }

                const tagQuery = { recordType: 'CD_Tag', sortBy: [{ fieldName: 'CD_name', ascending: true }], resultsLimit: 100 };
                const tagResult = await privateDB.performQuery(tagQuery, options);
                if (!tagResult.hasErrors) setTags(tagResult.records as TagRecord[]);
            };

            const fetchTasks = async () => {
                const query = {
                    recordType: 'CD_Task',
                    filterBy: [{ fieldName: 'CD_completed', comparator: 'NOT_EQUALS', fieldValue: { value: 1 } }],
                    desiredKeys: [
                        'CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed',
                        'CD_someday', 'CD_waitingfor', 'CD_dateactive',
                        'CD_date', 'CD_hideuntildate', 'CD_recurring', 'CD_recurrence', 'CD_recurrencetype',
                        'CD_modifieddate', 'CD_link', 'CD_note'
                    ],
                    resultsLimit: 500
                };
                const result = await privateDB.performQuery(query, options);
                if (!result.hasErrors) {
                    const tasks = result.records as TaskRecord[];
                    const cacheObject: Record<string, TaskRecord> = {};
                    tasks.forEach(task => { cacheObject[task.recordName] = task; });
                    updateTaskCache(() => cacheObject);
                    lastCacheRefreshRef.current = Date.now();
                }
            };

            const fetchRelations = async () => {
                const query = { recordType: 'CDMR', sortBy: [{ fieldName: 'CD_entityNames', ascending: true }], resultsLimit: 500 };
                const result = await privateDB.performQuery(query, options);
                if (!result.hasErrors) {
                    const records = result.records;
                    const mapping: Record<string, string[]> = {};
                    records.forEach((rel: any) => {
                        const fields = rel.fields;
                        if (fields.CD_entityNames && fields.CD_recordNames) {
                            const entities = fields.CD_entityNames.value;
                            const recordNames = fields.CD_recordNames.value;
                            if (entities.includes('Task') && entities.includes('Tag')) {
                                const entityParts = entities.split(':');
                                const recordParts = recordNames.split(':');
                                let taskRef = '';
                                let tagRef = '';
                                entityParts.forEach((part: string, index: number) => {
                                    if (part.includes('Task')) taskRef = recordParts[index];
                                    if (part.includes('Tag')) tagRef = recordParts[index];
                                });
                                if (taskRef && tagRef) {
                                    if (!mapping[taskRef]) mapping[taskRef] = [];
                                    mapping[taskRef].push(tagRef);
                                }
                            }
                        }
                    });
                    setTaskTagMap(mapping);
                }
            };

            await Promise.all([fetchProjAndTags(), fetchTasks(), fetchRelations()]);
        } catch (error) {
            console.error('[Manual Refresh] ❌ Error:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Keyboard Shortcuts Modal
    const [showShortcuts, setShowShortcuts] = useState(false);

    const handleEditClick = (project: ProjectRecord) => {
        // Use recordName as ID for editing state
        setEditingId(project.recordName);
        setEditName(project.fields.CD_name?.value || '');
    };

    const handleCancel = () => {
        // If we were creating a new project, remove the unsaved placeholder
        setProjects(prev => prev.filter(p => p.recordName !== 'new-project'));
        setEditingId(null);
        setEditName('');
    };

    const handleSave = async (project: ProjectRecord) => {
        if (!editName.trim() || !container) return;

        const previousName = project.fields.CD_name?.value || '';

        // Optimistic: reflect the new name immediately and close the editor.
        setProjects(prev => prev.map(p =>
            p.recordName === project.recordName
                ? { ...p, fields: { ...p.fields, CD_name: { value: editName } } }
                : p
        ));
        setEditingId(null);
        setEditName('');

        // Persist in the background — any error reverts the optimistic state.
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            const fetchResult = await privateDB.fetchRecords([project.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);

            const fullRecord = fetchResult.records[0];
            fullRecord.fields.CD_name = { value: editName };

            const saveResult = await privateDB.saveRecords([fullRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // Update recordChangeTag with the authoritative value from CloudKit.
            const savedRecord = saveResult.records[0];
            setProjects(prev => prev.map(p =>
                p.recordName === savedRecord.recordName
                    ? { ...p, recordChangeTag: savedRecord.recordChangeTag }
                    : p
            ));

        } catch (err: any) {
            console.error('Save error:', err);
            setProjects(prev => prev.map(p =>
                p.recordName === project.recordName
                    ? { ...p, fields: { ...p.fields, CD_name: { value: previousName } } }
                    : p
            ));
            alert('Failed to save changes — the name has been reverted.');
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

    // Create new project just below the Single Actions list (Shift+P)
    const handleCreateProjectAtTop = () => {
        if (!container) return;

        const regularProjects = projects.filter(p => p.fields.CD_singleactions?.value !== 1);
        const minOrder = regularProjects.reduce((min, p) => Math.min(min, p.fields.CD_order?.value || 0), 0);
        const newOrder = minOrder - 1;

        const newProject: ProjectRecord = {
            recordName: 'new-project',
            recordType: 'CD_Project',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-project' },
                CD_order: { value: newOrder },
                CD_singleactions: { value: 0 },
                CD_icon: { value: 'list.clipboard' },
                CD_color: { value: 'blue' }
            }
        };

        // Insert new project and re-sort
        const updatedProjects = [...projects, newProject].sort((a, b) => {
            const isSingleA = a.fields.CD_singleactions?.value === 1;
            const isSingleB = b.fields.CD_singleactions?.value === 1;
            if (isSingleA && !isSingleB) return -1;
            if (!isSingleA && isSingleB) return 1;
            return (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0);
        });

        setProjects(updatedProjects);
        setEditingId('new-project');
        setEditName('');
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

    // Called from TaskItem when @ picker selects tags. Stores them in ref for handleTaskSave.
    const handleTagsAdd = (task: TaskRecord, tagIds: string[]) => {
        pendingTagIdsRef.current = tagIds;
    };

    // Creates CDMR relationship records for each tag, then updates local taskTagMap.
    const createTagRelationships = async (taskRecordName: string, tagIds: string[]) => {
        if (!container || tagIds.length === 0) return;
        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        const cdmrRecords = tagIds.map(tagId => {
            const recordName = crypto.randomUUID();
            return {
                recordName,
                recordID: { recordName, zoneID },  // explicitly place in Core Data zone
                recordType: 'CDMR',
                fields: {
                    CD_entityNames: { value: 'CD_Tag:CD_Task' },
                    CD_recordNames: { value: `${tagId}:${taskRecordName}` }
                }
            };
        });

        try {
            const result = await privateDB.saveRecords(cdmrRecords, { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            console.log('[Tags] Saved CDMR records:', result.records.map((r: any) => ({
                recordName: r.recordName,
                zoneID: r.recordID?.zoneID ?? r.zoneID ?? JSON.stringify(r).slice(0, 200),
            })));

            // Optimistically update local taskTagMap (deduplicate to avoid duplicate keys)
            setTaskTagMap(prev => ({
                ...prev,
                [taskRecordName]: [...new Set([...(prev[taskRecordName] || []), ...tagIds])]
            }));
        } catch (e) {
            console.error('[Tags] Failed to save CDMR relationships:', e);
        }
    };

    // Build CDMR records for a task-tag relationship to include in a saveRecords batch.
    // Format must match NSPersistentCloudKitContainer expectations:
    //   CD_entityNames: alphabetically sorted bare entity names (e.g. "Tag:Task")
    //   CD_relationships: relationship property names matching entity order (e.g. "tasks:tags")
    //   CD_recordNames: record IDs matching entity order (e.g. "tagId:taskId")
    const buildCdmrRecords = (taskRecordName: string, tagIds: string[]) => {
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
        return tagIds.map(tagId => {
            const recordName = crypto.randomUUID();
            return {
                recordName,
                recordType: 'CDMR',
                fields: {
                    CD_entityNames: { value: 'Tag:Task' },
                    CD_relationships: { value: 'tasks:tags' },
                    CD_recordNames: { value: `${tagId}:${taskRecordName}` }
                }
            };
        });
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


                // Read and clear pending tags
                const tagIds = pendingTagIdsRef.current;
                pendingTagIdsRef.current = [];

                // Build CDMR records and save them in the SAME batch as the task
                const cdmrRecords = buildCdmrRecords(recordName, tagIds);
                const saveResult = await privateDB.saveRecords([newRecord, ...cdmrRecords], { zoneID });

                if (saveResult.hasErrors) {
                    console.error('[CloudKit Sync] Failed to save new task:', saveResult.errors);
                    throw new Error(saveResult.errors[0].message);
                }

                const savedRecord = saveResult.records[0];

                // Optimistically update taskTagMap for the new tags
                if (tagIds.length > 0) {
                    setTaskTagMap(prev => ({
                        ...prev,
                        [recordName]: [...new Set([...(prev[recordName] || []), ...tagIds])]
                    }));
                }


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

            // Snapshot the old name so we can revert if the save fails.
            const previousName = task.fields.CD_name?.value || '';

            // Read and clear pending tags synchronously — must happen before any await
            // so a concurrent edit can't clobber pendingTagIdsRef.
            const tagIds = pendingTagIdsRef.current;
            pendingTagIdsRef.current = [];

            // Optimistic: reflect the new name immediately and close the editor.
            // Both tasks state AND allTasksCache must be updated together — any effect
            // that rebuilds tasks from the cache (e.g. on view switch) would otherwise
            // flash the old name for one render before the cache catches up.
            const optimisticTask = {
                ...task,
                fields: { ...task.fields, CD_name: { value: editTaskName }, CD_modifieddate: { value: Date.now() } }
            };
            setTasks(prev => prev.map(t => t.recordName === task.recordName ? optimisticTask : t));
            upsertTaskInCache(optimisticTask);
            if (tagIds.length > 0) {
                setTaskTagMap(prev => ({
                    ...prev,
                    [task.recordName]: [...new Set([...(prev[task.recordName] || []), ...tagIds])]
                }));
            }
            setEditingTaskId(null);
            setEditTaskName('');

            // Persist in the background — any error reverts the optimistic state.
            try {
                const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
                if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);

                const fullRecord = fetchResult.records[0];
                fullRecord.fields.CD_name = { value: editTaskName };
                fullRecord.fields.CD_modifieddate = { value: Date.now() };
                if (task.fields.CD_project?.value) {
                    fullRecord.fields.CD_project = { value: task.fields.CD_project.value };
                }

                const cdmrRecords = buildCdmrRecords(task.recordName, tagIds);
                const saveResult = await privateDB.saveRecords([fullRecord, ...cdmrRecords], { zoneID });
                if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

                // Update recordChangeTag and cache with the authoritative saved record.
                const savedRecord = saveResult.records[0];
                setTasks(prev => prev.map(t =>
                    t.recordName === savedRecord.recordName
                        ? { ...t, recordChangeTag: savedRecord.recordChangeTag }
                        : t
                ));
                upsertTaskInCache(savedRecord);

            } catch (err: any) {
                console.error('Save task error:', err);
                const revertedTask = { ...task, fields: { ...task.fields, CD_name: { value: previousName } } };
                setTasks(prev => prev.map(t => t.recordName === task.recordName ? revertedTask : t));
                upsertTaskInCache(revertedTask);
                alert('Failed to save task — the name has been reverted.');
            }

        } catch (err: any) {
            console.error('Save task error:', err);
            alert('Failed to save task: ' + err.message);
        }
    };

    const handleTaskNoteChange = async (task: TaskRecord, newNote: string) => {
        if (!container) return;

        // Optimistic UI update
        const updatedTask = {
            ...task,
            fields: {
                ...task.fields,
                CD_note: { value: newNote },
                CD_modifieddate: { value: Date.now() }
            }
        };
        setTasks(prev => prev.map(t => t.recordName === task.recordName ? updatedTask : t));
        upsertTaskInCache(updatedTask);

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            const tasksToSave = [{
                recordName: updatedTask.recordName,
                recordType: 'CD_Task',
                recordChangeTag: updatedTask.recordChangeTag,
                fields: { CD_note: { value: newNote } }
            }];

            const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);

            const fetchedRecord = fetchResult.records[0];
            const freshTaskToSave = { ...tasksToSave[0], recordChangeTag: fetchedRecord.recordChangeTag };
            
            const saveResult = await privateDB.saveRecords([freshTaskToSave], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            const savedRecord = saveResult.records[0];
            setTasks(prev => prev.map(t => t.recordName === task.recordName ? { ...t, recordChangeTag: savedRecord.recordChangeTag } : t));
            upsertTaskInCache(savedRecord);
        } catch (e: any) {
             console.error("Failed to save inline note update:", e);
        }
    };

    const handleCreateTask = () => {
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred' && viewMode !== 'all_tasks') || editingTaskId) return; // Don't start if already editing

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
                // all_tasks / Inbox: omit project. Next Actions/Someday: use Single Actions project. Project mode: use selectedProject.
                ...(viewMode === 'inbox' || viewMode === 'all_tasks' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
                CD_completed: { value: 0 },
                CD_order: { value: Object.values(allTasksCache).filter(t => t.fields.CD_completed?.value !== 1).reduce((max, t) => Math.max(max, t.fields.CD_order?.value || 0), 0) + 1 }
            }
        };

        setTasks(prev => [...prev, newTask]);
        setEditingTaskId('new-task');
        setEditTaskName('');
    };

    const handleInsertTask = async (afterTask: TaskRecord) => {
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred' && viewMode !== 'all_tasks') || editingTaskId || !container) return;

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
                // Inbox / all_tasks: omit project. Next Actions/Someday: use Single Actions project. Project mode: use selectedProject.
                ...(viewMode === 'inbox' || viewMode === 'all_tasks' ? {}
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
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred' && viewMode !== 'all_tasks') || editingTaskId) return;

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
                ...(viewMode === 'inbox' || viewMode === 'all_tasks' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
                CD_completed: { value: 0 },
                CD_order: { value: (() => { const allUncompleted = Object.values(allTasksCache).filter(t => t.fields.CD_completed?.value !== 1); return allUncompleted.length > 0 ? Math.min(...allUncompleted.map(t => t.fields.CD_order?.value || 0)) - 1 : 0; })() }
            }
        };

        setTasks(prev => [...prev, newTask].sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0)));
        setEditingTaskId('new-task');
        setEditTaskName('');
    };

    // Keyboard Shortcuts Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // N - Create task at top
            if (e.key === 'n' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateTaskAtTop();
            }

            // Shift+N - Create task at bottom
            if (e.key === 'N' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateTask();
            }

            // P - Create project at top
            if (e.key === 'p' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateProjectAtTop();
            }

            // Shift+P - Create project at bottom
            if (e.key === 'P' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateProject();
            }

            // ? - Show keyboard shortcuts
            if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
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

                return;
            }


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

                const result = await privateDB.performQuery(query, options);
                if (result.hasErrors) {
                    console.error('[CloudKit] ❌ Error fetching projects:', result.errors);
                    throw new Error(result.errors[0].message);
                }

                let records = result.records as ProjectRecord[];
                records = records.filter(p => !p.fields.CD_completed || p.fields.CD_completed.value !== 1);
                records.sort((a, b) => {
                    const isSingleA = a.fields.CD_singleactions?.value === 1;
                    const isSingleB = b.fields.CD_singleactions?.value === 1;
                    if (isSingleA && !isSingleB) return -1;
                    if (!isSingleA && isSingleB) return 1;
                    return (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0);
                });

                setProjects(records);
                if (records.length > 0 && !selectedProject) {
                    setSelectedProject(records[0]);
                }

                // --- FETCH TAGS ---
                const tagQuery = {
                    recordType: 'CD_Tag',
                    sortBy: [{ fieldName: 'CD_name', ascending: true }],
                    resultsLimit: 100
                };
                const tagResult = await privateDB.performQuery(tagQuery, { zoneID: { zoneName: 'com.apple.coredata.cloudkit.zone' } });
                if (!tagResult.hasErrors) {
                    setTags(tagResult.records as TagRecord[]);
                } else {
                    console.error('[CloudKit] ❌ Error fetching tags:', tagResult.errors[0]);
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

    // Debounced Note Save
    useEffect(() => {
        if (!selectedTaskDetails) return;

        // Don't save if value hasn't changed from source
        const currentNote = selectedTaskDetails.fields.CD_note?.value || '';
        if (noteInput === currentNote) return;

        const timeoutId = setTimeout(() => {
            handleUpdateTaskDetail('CD_note', noteInput);
        }, 1500);

        noteDebounceTimerRef.current = timeoutId;
        return () => {
            clearTimeout(timeoutId);
            noteDebounceTimerRef.current = null;
        };
    }, [noteInput, selectedTaskDetails]);
    const handleCloseProjectDetailsPanel = () => {
        setSelectedProjectDetails(null);
    };

    const handleUpdateProjectDetail = async (field: keyof ProjectRecord['fields'], value: any) => {
        if (!selectedProjectDetails || !container) return;

        setProjectDetailsSaveState('saving');
        
        const updatedProject = {
            ...selectedProjectDetails,
            fields: {
                ...selectedProjectDetails.fields,
                [field]: { value },
                CD_modifieddate: { value: Date.now() }
            }
        };

        setSelectedProjectDetails(updatedProject as ProjectRecord);
        setProjects(prev => prev.map(p => p.recordName === updatedProject.recordName ? updatedProject as ProjectRecord : p));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            
            const fetchResult = await privateDB.fetchRecords([updatedProject.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            
            const freshRecord = fetchResult.records[0];

            const recordToSave = {
                recordName: updatedProject.recordName,
                recordType: 'CD_Project',
                recordChangeTag: freshRecord.recordChangeTag,
                fields: {
                    [field]: { value },
                    CD_modifieddate: { value: Date.now() }
                }
            };

            const saveResult = await privateDB.saveRecords([recordToSave], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            const savedRecord = saveResult.records[0];
            const totallyUpdatedProject = { ...updatedProject, recordChangeTag: savedRecord.recordChangeTag } as ProjectRecord;
            
            setSelectedProjectDetails(totallyUpdatedProject);
            setProjects(prev => prev.map(p => p.recordName === totallyUpdatedProject.recordName ? totallyUpdatedProject : p));
            setProjectDetailsSaveState('saved');
            setTimeout(() => setProjectDetailsSaveState('idle'), 2000);
        } catch (err) {
            console.error('Failed to update project detail:', err);
            setProjectDetailsSaveState('idle');
        }
    };

    const handleCompleteProject = async () => {
        if (!selectedProjectDetails || !container) return;
        const projectId = selectedProjectDetails.recordName;
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            const fetchResult = await privateDB.fetchRecords([projectId], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const freshRecord = fetchResult.records[0];
            const recordToSave = {
                recordName: projectId,
                recordType: 'CD_Project',
                recordChangeTag: freshRecord.recordChangeTag,
                fields: { CD_completed: { value: 1 }, CD_modifieddate: { value: Date.now() } }
            };
            const saveResult = await privateDB.saveRecords([recordToSave], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);
            setProjects(prev => prev.filter(p => p.recordName !== projectId));
            setSelectedProjectDetails(null);
        } catch (err) {
            console.error('Failed to complete project:', err);
        }
    };
    const handleDeleteTask = async () => {
        if (!selectedTaskDetails || !container) return;
        if (!window.confirm(`Delete "${selectedTaskDetails.fields.CD_name?.value}"? This cannot be undone.`)) return;
        
        const taskId = selectedTaskDetails.recordName;
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            
            // Delete the task record
            await privateDB.deleteRecords([{ recordName: taskId }], { zoneID });
            
            // Update local state
            setTasks(prev => prev.filter(t => t.recordName !== taskId));
            
            // Clear from cache
            removeTaskFromCache(taskId);
            
            // Close panel
            setSelectedTaskDetails(null);
        } catch (err) {
            console.error('Failed to delete task:', err);
            alert('Failed to delete task. Please try again.');
        }
    };


    const handleDeleteProject = async () => {
        if (!selectedProjectDetails || !container) return;
        if (!window.confirm(`Delete "${selectedProjectDetails.fields.CD_name?.value}"? This cannot be undone.`)) return;
        const projectId = selectedProjectDetails.recordName;
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            await privateDB.deleteRecords([{ recordName: projectId }], { zoneID });
            setProjects(prev => prev.filter(p => p.recordName !== projectId));
            setSelectedProjectDetails(null);
        } catch (err) {
            console.error('Failed to delete project:', err);
        }
    };

    // Close the details panel, flushing any pending debounced note saves first.
    // The save runs in the background AFTER closing — we never call setSelectedTaskDetails
    // again so the panel doesn't reopen.
    const handleCloseDetailsPanel = () => {
        const hasPendingNote = noteDebounceTimerRef.current !== null;
        const taskSnapshot = selectedTaskDetails; // capture before nulling
        const noteSnapshot = noteInput;

        // Cancel the debounce timer
        if (hasPendingNote) {
            clearTimeout(noteDebounceTimerRef.current!);
            noteDebounceTimerRef.current = null;
        }

        // Close the panel immediately
        setSelectedTaskDetails(null);

        // If there was a pending note change, save it in the background
        if (hasPendingNote && taskSnapshot && container) {
            const currentNote = taskSnapshot.fields.CD_note?.value || '';
            if (noteSnapshot !== currentNote) {
                // Fire-and-forget save — intentionally doesn't touch selectedTaskDetails
                (async () => {
                    try {
                        const privateDB = container.privateCloudDatabase;
                        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
                        const fetchResult = await privateDB.fetchRecords([taskSnapshot.recordName], { zoneID });
                        if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
                        const latestRecord = fetchResult.records[0];
                        const recordToSave = {
                            recordName: latestRecord.recordName,
                            recordChangeTag: latestRecord.recordChangeTag,
                            fields: {
                                CD_note: { value: noteSnapshot },
                                CD_modifieddate: { value: Date.now() },
                            }
                        };
                        const result = await privateDB.saveRecords([recordToSave], { zoneID });
                        if (!result.hasErrors) {
                            // Update tasks list and cache with new note + change tag
                            const savedRecord = result.records[0];
                            const updatedFields = {
                                ...taskSnapshot.fields,
                                CD_note: { value: noteSnapshot },
                                CD_modifieddate: { value: Date.now() },
                            };
                            const finalTask = { ...taskSnapshot, fields: updatedFields, recordChangeTag: savedRecord.recordChangeTag };
                            setTasks(prev => prev.map(t => t.recordName === taskSnapshot.recordName ? finalTask : t));
                            upsertTaskInCache(finalTask);
                        }
                    } catch (err) {
                        console.error('Background note save failed:', err);
                    }
                })();
            }
        }
    };

    // ========== WEEKLY REVIEW ==========
    const handleReviewItemClick = (id: string) => {
        const newChecked = { ...reviewChecked, [id]: !reviewChecked[id] };
        setReviewChecked(newChecked);
        localStorage.setItem('gtd-review-checked', JSON.stringify(newChecked));
    };

    const handleFinishReview = () => {
        setReviewChecked({});
        const now = Date.now();
        setLastReviewDate(now);
        localStorage.setItem('gtd-review-checked', '{}');
        localStorage.setItem('gtd-review-date', String(now));
    };

    // ========== GOOGLE CALENDAR ==========
    const handleGoogleToken = (token: string | null) => {
        setGoogleToken(token);
        if (!token) {
            setTodayEvents([]);
        }
    };

    const handleSaveCalendars = (calendars: SelectedCalendar[]) => {
        setSelectedCalendars(calendars);
        localStorage.setItem('google-calendars', JSON.stringify(calendars));
    };

    useEffect(() => {
        if (!googleToken || selectedCalendars.length === 0) {
            setTodayEvents([]);
            return;
        }
        setLoadingTodayEvents(true);
        Promise.all(selectedCalendars.map(cal => fetchTodayEvents(googleToken, cal.id, cal.color)))
            .then(results => {
                const all = results.flat().sort((a, b) => {
                    const aTime = a.start.dateTime || a.start.date || '';
                    const bTime = b.start.dateTime || b.start.date || '';
                    return aTime.localeCompare(bTime);
                });
                setTodayEvents(all);
            })
            .catch(err => {
                if (err.message === '401') setGoogleToken(null);
            })
            .finally(() => setLoadingTodayEvents(false));
    }, [googleToken, selectedCalendars]);

    // ========== CACHE INITIALIZATION & REFRESH ==========
    // Initialize cache from localStorage and fetch all tasks on authentication
    useEffect(() => {
        const initializeCache = async () => {
            if (!container || !isAuthenticated) return;



            // 1. Hydrate from localStorage first for instant display
            try {
                const cachedData = localStorage.getItem(LOCALSTORAGE_CACHE_KEY);
                const cachedTimestamp = localStorage.getItem(LOCALSTORAGE_TIMESTAMP_KEY);

                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    setAllTasksCache(parsed);
                    lastCacheRefreshRef.current = cachedTimestamp ? parseInt(cachedTimestamp) : 0;

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
                        'CD_modifieddate', 'CD_link', 'CD_note'
                    ],
                    resultsLimit: 500 // Fetch all active tasks
                };

                const result = await privateDB.performQuery(query, { zoneID });

                if (result.hasErrors) {
                    console.error('[Cache] ❌ Failed to fetch tasks:', result.errors);
                    throw new Error(result.errors[0].message);
                }

                const tasks = result.records as TaskRecord[];
                const cacheObject: Record<string, TaskRecord> = {};
                tasks.forEach(task => { cacheObject[task.recordName] = task; });

                updateTaskCache(() => cacheObject);
                lastCacheRefreshRef.current = Date.now();
                setCacheInitialized(true);
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

    // Fetch Task-Tag Relationships using CDMR Discovery
    const fetchTaskTagRelations = useCallback(async () => {
        if (!container) return;

        const privateDB = container.privateCloudDatabase;
        const options = { zoneID: { zoneName: 'com.apple.coredata.cloudkit.zone' } };

        const query = {
            recordType: 'CDMR',
            sortBy: [{ fieldName: 'CD_entityNames', ascending: true }],
            resultsLimit: 500
        };

        try {
            const result = await privateDB.performQuery(query, options);

            if (result.hasErrors) {
                console.error('[CloudKit Relations] ❌ Error fetching CDMR records:', result.errors[0]);
                return;
            }

            const mapping: Record<string, string[]> = {};

            result.records.forEach((rel: any) => {
                const fields = rel.fields;
                if (fields.CD_entityNames && fields.CD_recordNames) {
                    const entities = fields.CD_entityNames.value;
                    const recordNames = fields.CD_recordNames.value;

                    if (entities.includes('Task') && entities.includes('Tag')) {
                        const entityParts = entities.split(':');
                        const recordParts = recordNames.split(':');
                        let taskRef = '', tagRef = '';
                        entityParts.forEach((part: string, index: number) => {
                            if (part.includes('Task')) taskRef = recordParts[index];
                            if (part.includes('Tag')) tagRef = recordParts[index];
                        });
                        if (taskRef && tagRef) {
                            if (!mapping[taskRef]) mapping[taskRef] = [];
                            mapping[taskRef].push(tagRef);
                        }
                    }
                }
            });

            setTaskTagMap(mapping);
        } catch (err) {
            console.error('[CloudKit Relations] ❌ Unexpected error:', err);
        }
    }, [container]);

    useEffect(() => {
        if (isAuthenticated) fetchTaskTagRelations();
    }, [isAuthenticated, container, fetchTaskTagRelations]);

    // ── Background Sync ────────────────────────────────────────────────────
    // Driven by CloudKit push notifications (silent data-change pushes via APNs).
    // Falls back to a 5-minute poll and also syncs whenever the tab becomes visible.
    useEffect(() => {
        if (!container || !isAuthenticated || !cacheInitialized) return;

        const privateDB = container.privateCloudDatabase;
        const ZONE_ID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        // Track the last sync time in a ref so callbacks always read the latest value.
        // Initialize to "now minus one interval" so the first run fetches recent changes.
        const lastSyncTimeRef = { current: Date.now() - CACHE_REFRESH_INTERVAL };

        const fetchChanges = async () => {
            if (document.hidden) return;
            if (editingTaskId || editingId) return;

            const since = lastSyncTimeRef.current;
            console.log(`[Sync] 🔄 Checking for changes since ${new Date(since).toLocaleTimeString()}...`);

            try {
                // ── Task changes ──────────────────────────────────────────────
                const taskQuery = {
                    recordType: 'CD_Task',
                    filterBy: [{ fieldName: 'CD_modifieddate', comparator: 'GREATER_THAN', fieldValue: { value: since } }],
                    desiredKeys: [
                        'CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed',
                        'CD_someday', 'CD_waitingfor', 'CD_dateactive',
                        'CD_date', 'CD_hideuntildate', 'CD_recurring', 'CD_recurrence',
                        'CD_recurrencetype', 'CD_modifieddate', 'CD_link', 'CD_note'
                    ],
                    resultsLimit: 100
                };

                // ── Project changes ───────────────────────────────────────────
                const projectQuery = {
                    recordType: 'CD_Project',
                    filterBy: [{ fieldName: 'CD_modifieddate', comparator: 'GREATER_THAN', fieldValue: { value: since } }],
                    desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_completed', 'CD_singleactions', 'CD_focus', 'CD_icon', 'CD_color', 'CD_modifieddate'],
                    resultsLimit: 100
                };

                const [taskResult, projectResult] = await Promise.all([
                    privateDB.performQuery(taskQuery, { zoneID: ZONE_ID }),
                    privateDB.performQuery(projectQuery, { zoneID: ZONE_ID }),
                ]);

                // Advance timestamp after both queries complete
                lastSyncTimeRef.current = Date.now();

                // ── Process task changes ──────────────────────────────────────
                if (taskResult.hasErrors) {
                    console.error('[Sync] Task query error:', taskResult.errors?.[0]);
                } else {
                    const changed: TaskRecord[] = taskResult.records as TaskRecord[];
                    if (changed.length > 0) {
                        console.log(`[Sync] ⚡️ ${changed.length} updated task${changed.length > 1 ? 's' : ''}:`);
                        changed.forEach(r => console.log(`  ↳ ${r.fields?.CD_name?.value ?? r.recordName}`));
                        updateTaskCache(prev => {
                            const next = { ...prev };
                            changed.forEach(record => {
                                if (!record.fields?.CD_completed || record.fields.CD_completed.value !== 1) {
                                    next[record.recordName] = record;
                                } else {
                                    delete next[record.recordName];
                                }
                            });
                            return next;
                        });
                        // Re-fetch tag associations — CDMR records have no modifieddate,
                        // so we refresh the full mapping whenever any task changes.
                        fetchTaskTagRelations();
                    }
                }

                // ── Process project changes ───────────────────────────────────
                if (projectResult.hasErrors) {
                    console.error('[Sync] Project query error:', projectResult.errors?.[0]);
                } else {
                    const changedProjects: ProjectRecord[] = projectResult.records as ProjectRecord[];
                    if (changedProjects.length > 0) {
                        console.log(`[Sync] 📁 ${changedProjects.length} updated project${changedProjects.length > 1 ? 's' : ''}:`);
                        changedProjects.forEach(r => console.log(`  ↳ ${r.fields?.CD_name?.value ?? r.recordName}`));
                        setProjects(prev => {
                            const next = [...prev];
                            changedProjects.forEach(record => {
                                const idx = next.findIndex(p => p.recordName === record.recordName);
                                const isCompleted = record.fields?.CD_completed?.value === 1;
                                if (isCompleted) {
                                    if (idx !== -1) next.splice(idx, 1);
                                } else if (idx !== -1) {
                                    next[idx] = record;
                                } else {
                                    next.push(record);
                                }
                            });
                            // Re-sort: Single Actions list first, then by CD_order
                            next.sort((a, b) => {
                                const isSingleA = a.fields.CD_singleactions?.value === 1;
                                const isSingleB = b.fields.CD_singleactions?.value === 1;
                                if (isSingleA && !isSingleB) return -1;
                                if (!isSingleA && isSingleB) return 1;
                                return (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0);
                            });
                            return next;
                        });
                    }
                }

            } catch (err: any) {
                if (err?._ckErrorCode === 'NETWORK_ERROR') {
                    console.warn('[Sync] Network blip — will retry next tick');
                } else {
                    console.error('[Sync] Unexpected error:', err);
                }
            }
        };

        // ── CloudKit push subscriptions ───────────────────────────────────
        // Subscriptions are keyed by ID — CloudKit updates them if they exist, so
        // calling this on every effect run is safe (idempotent).
        const setupPushNotifications = async () => {
            if (!('serviceWorker' in navigator)) return;
            if (CLOUDKIT_ENV !== 'development') {
                console.log('[Sync] Push subscriptions skipped (production container does not support web subscriptions)');
                return;
            }
            try {
                await container.registerForNotifications();
                const result = await privateDB.saveSubscriptions([
                    {
                        subscriptionType: 'query',
                        subscriptionID: 'next-idea-task-changes-v1',
                        zoneID: ZONE_ID,
                        query: { recordType: 'CD_Task' },
                        firesOn: ['create', 'update', 'delete'],
                        firesOnce: false,
                        notificationInfo: { shouldSendContentAvailable: true },
                    },
                    {
                        subscriptionType: 'query',
                        subscriptionID: 'next-idea-project-changes-v1',
                        zoneID: ZONE_ID,
                        query: { recordType: 'CD_Project' },
                        firesOn: ['create', 'update', 'delete'],
                        firesOnce: false,
                        notificationInfo: { shouldSendContentAvailable: true },
                    },
                ]);
                if (!result.hasErrors) {
                    console.log('[Sync] ✅ CloudKit push subscriptions active');
                } else {
                    console.warn('[Sync] Subscription save errors:', result.errors);
                }
            } catch (err) {
                console.warn('[Sync] Push notification setup failed (fallback polling active):', err);
            }
        };
        setupPushNotifications();

        // ── Sync triggers ─────────────────────────────────────────────────
        // 1. Service worker forwards push events from Apple as a window message.
        const handlePushMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOUDKIT_PUSH') {
                console.log('[Sync] 🔔 Push received — syncing');
                fetchChanges();
            }
        };
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handlePushMessage);
        }

        // 2. Sync immediately whenever the tab becomes visible (catches changes
        //    made on another device while this tab was in the background).
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('[Sync] 👁 Tab visible — syncing');
                fetchChanges();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 3. Thirty-second fallback poll — covers push-delivery failures and
        //    browsers that block push notifications entirely.
        const FALLBACK_INTERVAL = 30 * 1000;
        const intervalId = setInterval(fetchChanges, FALLBACK_INTERVAL);
        const initialRun = setTimeout(fetchChanges, 1000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(initialRun);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handlePushMessage);
            }
        };

    }, [container, isAuthenticated, cacheInitialized, editingTaskId, editingId, fetchTaskTagRelations]);


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

            // Put at top of Next Actions list
            const nextActionsTasks = Object.values(allTasksCache).filter(t => {
                if (t.fields.CD_completed?.value === 1) return false;
                const section = getTaskSection(t);
                return section === 'nextActions' || section === 'due';
            });
            const minOrder = nextActionsTasks.length > 0 ? Math.min(...nextActionsTasks.map(t => t.fields.CD_order?.value ?? 0)) : 0;
            updates.CD_order = { value: minOrder - 1 };

            updates.CD_modifieddate = { value: Date.now() };

            // Apply updates to task record
            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);



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



        } catch (err: any) {
            console.error('Move to Waiting for error:', err);
            alert('Failed to move task to Waiting for: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleDropInbox = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.recordName === id) {
                return {
                    ...t,
                    fields: {
                        ...t.fields,
                        CD_project: { value: '' }, // Remove project
                        CD_waitingfor: { value: 0 },
                        CD_someday: { value: 0 }
                    }
                };
            }
            return t;
        }));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            const updates: any = {
                CD_project: { value: '' },
                CD_waitingfor: { value: 0 },
                CD_someday: { value: 0 },
                CD_modifieddate: { value: Date.now() }
            };

            Object.assign(taskRecord.fields, updates);

            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);

        } catch (err: any) {
            console.error('Move to Inbox error:', err);
            alert('Failed to move task to Inbox: ' + err.message);
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

            // Put at top of Someday list
            const somedayTasks = Object.values(allTasksCache).filter(t => t.fields.CD_someday?.value === 1 && t.fields.CD_completed?.value !== 1);
            const minOrder = somedayTasks.length > 0 ? Math.min(...somedayTasks.map(t => t.fields.CD_order?.value ?? 0)) : 0;
            updates.CD_order = { value: minOrder - 1 };

            updates.CD_modifieddate = { value: Date.now() };

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            upsertTaskInCache(savedRecord);


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

        const draggedTask = tasks[oldIndex];

        // Enforce Section Constraints (Project View / all_tasks)
        if ((viewMode === 'project' && selectedProject) || viewMode === 'all_tasks') {
            const draggedSection = getTaskSection(draggedTask);
            const targetSection = getTaskSection(targetTask);
            if (draggedSection !== targetSection) return;
        }

        // Establish the segment of tasks we are allowed to reorder (the current visual section)
        let sectionTasks = tasks;
        if ((viewMode === 'project' && selectedProject) || viewMode === 'all_tasks') {
            const draggedSection = getTaskSection(draggedTask);
            sectionTasks = tasks.filter(t => getTaskSection(t) === draggedSection);
        }

        const itemToMove = sectionTasks.findIndex(t => t.recordName === draggedTaskId);
        let destination = sectionTasks.findIndex(t => t.recordName === targetTask.recordName);
        if (dragOverPosition === 'bottom') destination += 1;

        if (itemToMove === -1 || destination === -1) return;

        const tasksToSave: TaskRecord[] = [];
        
        if (itemToMove < destination) {
            // Moving down
            destination -= 1; // adjust because we are replacing, not inserting before
            if (itemToMove === destination) return;

            let startIndex = itemToMove + 1;
            const endIndex = destination;
            let startOrder = sectionTasks[itemToMove].fields.CD_order?.value ?? 0;
            
            while (startIndex <= endIndex) {
                const t = sectionTasks[startIndex];
                const updated = { ...t, fields: { ...t.fields, CD_order: { value: startOrder }, CD_modifieddate: { value: Date.now() } } };
                tasksToSave.push(updated);
                upsertTaskInCache(updated);
                
                startOrder += 1;
                startIndex += 1;
            }
            const moved = { ...draggedTask, fields: { ...draggedTask.fields, CD_order: { value: startOrder }, CD_modifieddate: { value: Date.now() } } };
            tasksToSave.push(moved);
            upsertTaskInCache(moved);
            
        } else if (itemToMove > destination) {
            // Moving up
            let startIndex = destination;
            const endIndex = itemToMove - 1;
            const newOrder = sectionTasks[destination].fields.CD_order?.value ?? 0;
            let startOrder = newOrder + 1;
            
            while (startIndex <= endIndex) {
                const t = sectionTasks[startIndex];
                const updated = { ...t, fields: { ...t.fields, CD_order: { value: startOrder }, CD_modifieddate: { value: Date.now() } } };
                tasksToSave.push(updated);
                upsertTaskInCache(updated);
                
                startOrder += 1;
                startIndex += 1;
            }
            const moved = { ...draggedTask, fields: { ...draggedTask.fields, CD_order: { value: newOrder }, CD_modifieddate: { value: Date.now() } } };
            tasksToSave.push(moved);
            upsertTaskInCache(moved);
        } else {
            return; // No movement
        }

        // Apply visual resorting optimistic UI
        setTasks(prev => {
            const saveMap = new Map(tasksToSave.map(t => [t.recordName, t]));
            return prev.map(t => saveMap.has(t.recordName) ? saveMap.get(t.recordName)! : t)
                       .sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));
        });

        if (tasksToSave.length > 0) {
            try {
                const privateDB = container.privateCloudDatabase;
                const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

                // CRITICAL FIX: Fetch latest versions of tasks before saving to avoid CAS Op-Lock failures
                const recordNamesToFetch = tasksToSave.map(t => t.recordName);
                const fetchResult = await privateDB.fetchRecords(recordNamesToFetch, { zoneID });

                if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);

                const fetchedRecordsMap = new Map();
                fetchResult.records.forEach((r: any) => fetchedRecordsMap.set(r.recordName, r));

                const freshTasksToSave = tasksToSave.map(t => {
                    const freshRecord = fetchedRecordsMap.get(t.recordName);
                    if (!freshRecord) return t;

                    return {
                        ...t,
                        recordChangeTag: freshRecord.recordChangeTag
                    };
                });

                const result = await privateDB.saveRecords(freshTasksToSave, { zoneID });

                if (result.hasErrors) {
                    // It can still fail if modified right between fetch and save
                    throw new Error(result.errors[0].message);
                }

                // Update local state with new change tags to prevent conflict on next save
                const savedRecords = result.records;
                setTasks(currentTasks => currentTasks.map(t => {
                    const saved = savedRecords.find((r: any) => r.recordName === t.recordName);
                    return saved ? { ...t, recordChangeTag: saved.recordChangeTag } : t;
                }));

            } catch (err: any) {
                console.error('Reorder failed:', err);
                alert('Failed to save task order: ' + err.message);
            }
        }
    };

    // ========== CACHE-FIRST VIEW FILTERING ==========
    // Filter tasks from cache based on current view/project - NO CloudKit fetches!
    useEffect(() => {
        // Wait for cache to be initialized
        if (!cacheInitialized) {

            setLoadingTasks(true);
            return;
        }

        // PAUSE filtering if user is editing a task to prevent overwriting the task list
        if (editingTaskId || editingId) {

            return;
        }



        // Filter cache based on current view
        let filtered = Object.values(allTasksCache);

        // If in project mode but no project selected, show empty
        if (viewMode === 'project' && !selectedProject) {

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


        setTasks(filtered);
        setLoadingTasks(false);
    }, [selectedProject, viewMode, cacheInitialized, allTasksCache, editingTaskId, editingId]);


    const handleToggleComplete = async (task: TaskRecord) => {
        if (!container) return;

        const isCompleting = task.fields.CD_completed?.value !== 1;
        const isRecurring = task.fields.CD_recurring?.value === 1;
        const optimisticCompletion = { ...task, fields: { ...task.fields, CD_completed: { value: isCompleting ? 1 : 0 } } };

        // Optimistic UI updates
        // Show animation for all list views (Project, Inbox, Next Actions, Due, Waiting, Deferred, Someday)
        // Only exclude 'history' view if we ever add toggling there (which usually just un-completes)
        if (viewMode !== 'history' && isCompleting) {
            setCompletingTaskIds(prev => new Set(prev).add(task.recordName));
            setTimeout(() => {
                setCompletingTaskIds(prev => {
                    const next = new Set(prev);
                    next.delete(task.recordName);
                    return next;
                });
                // Recurring tasks manage their own cache state; only update here for standard tasks
                if (!isRecurring) {
                    upsertTaskInCache(optimisticCompletion);
                }
            }, 1000);
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
                        ? { ...t, fields: { ...t.fields, CD_date: { value: nextTimestamp }, CD_completed: { value: 1 } } }
                        : t
                );
                // We typically don't show the history item in 'project' view, so no need to insert it into 'tasks' state
                // unless we are in history view? But we are "completing" it, so it goes to history.
                return updatedList;
            });

            // After animation finishes, revert completion.
            // If "hide until due" is set AND the new date is strictly in the future,
            // remove the task immediately so it doesn't blink back into view.
            // If the new date is today or in the past, reappear it normally.
            const hideUntilDue = task.fields.CD_hideuntildate?.value === 1;
            const tomorrowStart = new Date();
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            tomorrowStart.setHours(0, 0, 0, 0);
            const nextDateIsFuture = nextTimestamp >= tomorrowStart.getTime();
            setTimeout(() => {
                setTasks(currentTasks => {
                    if (hideUntilDue && nextDateIsFuture) {
                        // Remove from the visible list — cache already has the updated record,
                        // so it will reappear correctly when the view is switched or the cache refreshes.
                        return currentTasks.filter(t => t.recordName !== task.recordName);
                    }
                    return currentTasks.map(t =>
                        t.recordName === task.recordName
                            ? { ...t, fields: { ...t.fields, CD_completed: { value: 0 } } }
                            : t
                    );
                });
            }, 1000);

            // Persist Batch
            try {
                // CRITICAL FIX: Fetch the latest version of the original task before saving
                // to avoid CAS (conflict) errors when the background cache refresh has updated
                // the record's change tag since we last loaded it.
                const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
                if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
                const latestOriginal = fetchResult.records[0];

                // Use the freshly-fetched change tag for the update
                originalUpdate.recordChangeTag = latestOriginal.recordChangeTag;

                const result = await privateDB.saveRecords([historyRecord, originalUpdate], { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);



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
                // Revert optimistic local state so the task reappears as incomplete
                setTasks(currentTasks => currentTasks.map(t =>
                    t.recordName === task.recordName
                        ? { ...t, fields: { ...t.fields, CD_completed: { value: 0 } } }
                        : t
                ));
            }

            return;
        }

        // STANDARD TOGGLE LOGIC (Non-recurring or Un-completing)

        // Update Local State array
        setTasks(prev => prev.map(t => t.recordName === task.recordName ? optimisticCompletion : t));
        // For completing tasks with animation, defer the cache update to the setTimeout so
        // the sidebar count only changes after the task disappears. For un-completing, update immediately.
        if (!isCompleting || viewMode === 'history') {
            upsertTaskInCache(optimisticCompletion);
        }

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
            upsertTaskInCache({ ...task, fields: { ...task.fields, CD_completed: task.fields.CD_completed } });
        }
    };

    // Derived Lists
    // In 'project' mode: show tasks that are NOT completed OR are in the 'completing' animation state.
    // In 'inbox' mode: show tasks with no project and NOT completed.
    // In 'next_actions' mode: show tasks that are NOT completed (already filtered by query).
    // In 'history' mode: show tasks that ARE completed (and NOT uncompleted, though local state update handles that).

    const visibleTasks = tasks.filter(t => {
        if (viewMode === 'project' || viewMode === 'all_tasks') {
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

    const tasksMatchingSearch = useMemo(() => {
        return visibleTasks.filter(task => {
            if (searchQuery.trim() && !matchingTaskIds.has(task.recordName)) return false;
            return true;
        });
    }, [visibleTasks, searchQuery, matchingTaskIds]);

    const availableTags = useMemo(() => {
        const tagIds = new Set<string>();
        tasksMatchingSearch.forEach(task => {
            const taskTags = taskTagMap[task.recordName] || [];
            taskTags.forEach(t => tagIds.add(t));
        });
        return tags.filter(tag => tagIds.has(tag.recordName)).sort((a,b) => (a.fields.CD_name?.value || '').localeCompare(b.fields.CD_name?.value || ''));
    }, [tasksMatchingSearch, taskTagMap, tags]);

    const sections = useMemo(() => {
        if (viewMode !== 'project' && viewMode !== 'all_tasks') return null;

        const due: TaskRecord[] = [];
        const nextActions: TaskRecord[] = [];
        const waitingFor: TaskRecord[] = [];
        const deferred: TaskRecord[] = [];
        const somedayMaybe: TaskRecord[] = [];
        const inbox: TaskRecord[] = [];

        visibleTasks.forEach(t => {
            // If the task is in the completing animation (optimistically marked done),
            // getTaskSection returns 'completed', which would incorrectly fall into nextActions.
            // Instead, derive the section as if it weren't completed so it stays in place.
            let section = getTaskSection(t);
            if (section === 'completed') {
                // Re-derive section ignoring the completed flag
                if (t.fields.CD_waitingfor?.value === 1) section = 'waitingFor';
                else if (t.fields.CD_someday?.value === 1) section = 'somedayMaybe';
                else if (t.fields.CD_dateactive?.value === 1 && t.fields.CD_date?.value) {
                    const now = Date.now();
                    const tomorrow = new Date();
                    tomorrow.setHours(24, 0, 0, 0);
                    if (t.fields.CD_date.value < tomorrow.getTime()) section = 'due';
                    else {
                        const taskDateStart = new Date(t.fields.CD_date.value);
                        taskDateStart.setHours(0, 0, 0, 0);
                        section = (t.fields.CD_hideuntildate?.value === 1 && taskDateStart.getTime() > now)
                            ? 'deferred'
                            : 'nextActions';
                    }
                } else if (!t.fields.CD_project?.value) section = 'inbox';
                else section = 'nextActions';
            }

            // In all_tasks mode: a task that is due today or earlier should always appear in
            // Due / Overdue, regardless of whether it is also marked Someday or Waiting For.
            // This matches the behaviour of the standalone Due view.
            if (viewMode === 'all_tasks' && section !== 'due') {
                if (t.fields.CD_dateactive?.value === 1 && t.fields.CD_date?.value) {
                    const tomorrow = new Date();
                    tomorrow.setHours(24, 0, 0, 0);
                    if (t.fields.CD_date.value < tomorrow.getTime()) {
                        section = 'due';
                    }
                }
            }

            if (viewMode === 'all_tasks' && section === 'inbox') {
                inbox.push(t);
            }
            else if (section === 'due') {
                due.push(t);
            }
            else if (section === 'waitingFor') waitingFor.push(t);
            else if (section === 'somedayMaybe') somedayMaybe.push(t);
            else if (section === 'deferred') deferred.push(t);
            else nextActions.push(t); // Covers generic 'nextActions' return from getTaskSection
        });

        // Ensure tasks within due are sorted by date
        due.sort((a, b) => (a.fields.CD_date?.value || 0) - (b.fields.CD_date?.value || 0));

        return { due, nextActions, waitingFor, deferred, someday: somedayMaybe, inbox };
    }, [visibleTasks, viewMode]);

    // Details Side Panel Handlers
    const handleTaskClick = (task: TaskRecord) => {
        setSelectedTaskDetails(task);
    };

    const handleMoveDueToTop = async () => {
        if (!container) return;
        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        const uncompleted = Object.values(allTasksCache).filter(t => t.fields.CD_completed?.value !== 1);
        if (uncompleted.length === 0) return;
        
        const sortedUncompleted = [...uncompleted].sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));
        let nextOrder = (sortedUncompleted[0]?.fields.CD_order?.value ?? 0) - 1;

        const now = Date.now();
        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        const tomorrowTs = tomorrow.getTime();

        const dueTasks = uncompleted.filter(task => {
            if (task.fields.CD_dateactive?.value === 1 && task.fields.CD_date?.value) {
                return task.fields.CD_date.value < tomorrowTs;
            }
            return false;
        });

        if (dueTasks.length === 0) return;

        // Sort chronologically (oldest / most overdue first)
        dueTasks.sort((a, b) => (a.fields.CD_date?.value || 0) - (b.fields.CD_date?.value || 0));

        // We want the oldest task to be at the absolute top (lowest order).
        // If minOrder is 0, and we have 2 tasks:
        // Task 1 (Oldest) gets -2
        // Task 2 (Newer) gets -1
        let currentNextOrder = (sortedUncompleted[0]?.fields.CD_order?.value ?? 0) - dueTasks.length;

        const updatedTasksMap = new Map<string, TaskRecord>();

        dueTasks.forEach(task => {
            const fieldsUpdates: any = {
                CD_order: { value: currentNextOrder },
                CD_modifieddate: { value: Date.now() }
            };

            if (task.fields.CD_someday?.value === 1) {
                fieldsUpdates.CD_someday = { value: 0 };
            }

            const updatedTask: TaskRecord = { 
                ...task, 
                fields: { 
                    ...task.fields, 
                    ...fieldsUpdates
                } 
            };
            
            updatedTasksMap.set(task.recordName, updatedTask);
            currentNextOrder += 1;
        });

        setTasks(prev => {
            const nextTasks = prev.map(t => {
                if (updatedTasksMap.has(t.recordName)) {
                    return updatedTasksMap.get(t.recordName)!;
                }
                return t;
            });
            return nextTasks.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));
        });
        
        updatedTasksMap.forEach(t => upsertTaskInCache(t));

        try {
            const fetchResult = await privateDB.fetchRecords(Array.from(updatedTasksMap.keys()), { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            
            const fetchedRecords = fetchResult.records;
            const recordsToSave = fetchedRecords.map((fetchedRecord: any) => {
                const updatedTask = updatedTasksMap.get(fetchedRecord.recordName)!;
                return {
                    recordName: fetchedRecord.recordName,
                    recordChangeTag: fetchedRecord.recordChangeTag,
                    fields: {
                        CD_order: updatedTask.fields.CD_order,
                        CD_someday: updatedTask.fields.CD_someday,
                        CD_modifieddate: updatedTask.fields.CD_modifieddate
                    }
                };
            });

            const result = await privateDB.saveRecords(recordsToSave, { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            const savedRecords = result.records;
            setTasks(prev => prev.map(t => {
                const savedRecord = savedRecords.find((sr: any) => sr.recordName === t.recordName);
                return savedRecord
                    ? { ...t, recordChangeTag: savedRecord.recordChangeTag }
                    : t;
            }));
        } catch (err) {
            console.error('Failed to move due tasks to top', err);
        }
    };

    const handleMoveToTop = async (task: TaskRecord) => {
        if (!container) return;
        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        const uncompleted = Object.values(allTasksCache).filter(t => t.fields.CD_completed?.value !== 1);
        if (uncompleted.length === 0) return;
        const minOrder = Math.min(...uncompleted.map(t => t.fields.CD_order?.value ?? 0));
        const newOrder = minOrder - 1;

        const updatedTask = { ...task, fields: { ...task.fields, CD_order: { value: newOrder }, CD_modifieddate: { value: Date.now() } } };
        setTasks(prev => {
            const nextTasks = prev.map(t =>
                t.recordName === task.recordName ? updatedTask : t
            );
            return nextTasks.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));
        });
        upsertTaskInCache(updatedTask);

        try {
            const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const latestRecord = fetchResult.records[0];

            const recordToSave = {
                recordName: latestRecord.recordName,
                recordChangeTag: latestRecord.recordChangeTag,
                fields: {
                    CD_order: { value: newOrder },
                    CD_modifieddate: { value: Date.now() }
                }
            };

            const result = await privateDB.saveRecords([recordToSave], { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            const savedRecord = result.records[0];
            setTasks(prev => prev.map(t =>
                t.recordName === savedRecord.recordName
                    ? { ...t, recordChangeTag: savedRecord.recordChangeTag }
                    : t
            ));
        } catch (err) {
            console.error('Failed to move task to top', err);
        }
    };

    const handleMoveToBottom = async (task: TaskRecord) => {
        if (!container) return;
        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        const uncompleted = Object.values(allTasksCache).filter(t => t.fields.CD_completed?.value !== 1);
        if (uncompleted.length === 0) return;
        const maxOrder = Math.max(...uncompleted.map(t => t.fields.CD_order?.value ?? 0));
        const newOrder = maxOrder + 1;

        const updatedTask = { ...task, fields: { ...task.fields, CD_order: { value: newOrder }, CD_modifieddate: { value: Date.now() } } };
        setTasks(prev => {
            const nextTasks = prev.map(t =>
                t.recordName === task.recordName ? updatedTask : t
            );
            return nextTasks.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));
        });
        upsertTaskInCache(updatedTask);

        try {
            const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const latestRecord = fetchResult.records[0];

            const recordToSave = {
                recordName: latestRecord.recordName,
                recordChangeTag: latestRecord.recordChangeTag,
                fields: {
                    CD_order: { value: newOrder },
                    CD_modifieddate: { value: Date.now() }
                }
            };

            const result = await privateDB.saveRecords([recordToSave], { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            const savedRecord = result.records[0];
            setTasks(prev => prev.map(t =>
                t.recordName === savedRecord.recordName
                    ? { ...t, recordChangeTag: savedRecord.recordChangeTag }
                    : t
            ));
        } catch (err) {
            console.error('Failed to move task to bottom', err);
        }
    };

    const handleToggleToday = async (task: TaskRecord) => {
        if (!container) return;
        const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
        const isDueToday = task.fields.CD_dateactive?.value === 1
            && task.fields.CD_date?.value != null
            && task.fields.CD_date.value <= endOfToday.getTime();

        const newDateActive = isDueToday ? 0 : 1;
        const newDate = Date.now();

        const optimistic: TaskRecord = {
            ...task,
            fields: {
                ...task.fields,
                CD_dateactive: { value: newDateActive },
                ...(!isDueToday ? { CD_date: { value: newDate }, CD_hideuntildate: { value: 0 } } : {}),
            }
        };
        setTasks(prev => prev.map(t => t.recordName === task.recordName ? optimistic : t));
        upsertTaskInCache(optimistic);

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const latest = fetchResult.records[0];
            const fieldsToSave: Record<string, any> = {
                CD_dateactive: { value: newDateActive },
                CD_modifieddate: { value: Date.now() },
            };
            if (!isDueToday) {
                fieldsToSave.CD_date = { value: newDate };
                fieldsToSave.CD_hideuntildate = { value: 0 };
            }
            const result = await privateDB.saveRecords([{
                recordName: latest.recordName,
                recordChangeTag: latest.recordChangeTag,
                fields: fieldsToSave,
            }], { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);
            const saved = result.records[0];
            const final: TaskRecord = { ...optimistic, recordChangeTag: saved.recordChangeTag };
            setTasks(prev => prev.map(t => t.recordName === final.recordName ? final : t));
            upsertTaskInCache(final);
        } catch (err) {
            console.error('Failed to toggle today:', err);
            setTasks(prev => prev.map(t => t.recordName === task.recordName ? task : t));
            upsertTaskInCache(task);
        }
    };

    const renderTaskList = (tasksToRender: TaskRecord[]) => {
        // Filter passed tasks based on search and tags
        const filteredTasks = tasksToRender.filter(task => {
            if (searchQuery.trim() && !matchingTaskIds.has(task.recordName)) {
                return false;
            }
            
            const taskTags = taskTagMap[task.recordName] || [];
            
            // Exclude FIRST: if task has ANY excluded tag, hide it
            if (excludedFilterTags.size > 0 && taskTags.some(tagId => excludedFilterTags.has(tagId))) {
                return false;
            }

            if (selectedFilterTags.size > 0) {
                // ONLY show if it has at least one of the selected tags //
                if (!taskTags.some(tagId => selectedFilterTags.has(tagId))) {
                    return false;
                }
            }
            return true;
        });

        return (
            <div>
                {filteredTasks.map(task => (
                    <TaskItem
                        key={task.recordName}
                        task={task}
                        viewMode={viewMode}
                        editingTaskId={editingTaskId}
                        dragOverTaskId={dragOverTaskId}
                        dragOverPosition={dragOverPosition}
                        projects={projects}
                        tags={tags}
                        taskTagMap={taskTagMap}
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
                        onMoveToTop={handleMoveToTop}
                        onMoveToBottom={handleMoveToBottom}
                        onToggleToday={handleToggleToday}
                        onNoteChange={handleTaskNoteChange}
                        onTagsAdd={handleTagsAdd}
                        isCompleting={completingTaskIds.has(task.recordName)}
                    />
                ))}
            </div>
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
            // Show saving indicator
            if (detailsSaveTimerRef.current) clearTimeout(detailsSaveTimerRef.current);
            setDetailsSaveState('saving');

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

            // Only update the panel if the user hasn't closed it since this save was started
            setSelectedTaskDetails(prev => prev?.recordName === finalTask.recordName ? finalTask : prev);
            setTasks(prev => prev.map(t => t.recordName === finalTask.recordName ? finalTask : t));
            upsertTaskInCache(finalTask);

            // Show 'saved' for 2 seconds then return to idle
            setDetailsSaveState('saved');
            detailsSaveTimerRef.current = setTimeout(() => setDetailsSaveState('idle'), 2000);

        } catch (err) {
            console.error('Failed to update task details:', err);
            setDetailsSaveState('idle');
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


    if (isLoading || !isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                    <ListTodo className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Log in to Next Idea</h1>
                <p className="text-gray-600 mb-8 max-w-md">Access your projects and tasks directly from your browser.</p>
                {/* Always in DOM so CloudKit can inject the button during setUpAuth() */}
                <div id="apple-sign-in-button" className="transition-transform hover:scale-105 min-h-[44px] flex items-center justify-center"></div>
                {isLoading && (
                    <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting...</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex h-full bg-white overflow-hidden relative">
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
                onDropInbox={handleDropInbox}
                onShowShortcuts={(show) => setShowShortcuts(show)}
                counts={sidebarCounts}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                projectsWithMatches={projectsWithMatches}
                listsWithMatches={listsWithMatches}
                onRefresh={handleManualRefresh}
                isRefreshing={isRefreshing}
                onMoveDueToTop={handleMoveDueToTop}
                onInfoClick={setSelectedProjectDetails}
                lastReviewDate={lastReviewDate}
                onShowSettings={() => setShowSettings(true)}
                todayEventCount={todayEvents.length}
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
                                                        : viewMode === 'all_tasks' ? 'All tasks'
                                                            : viewMode === 'review' ? 'Review tasks'
                                                                : viewMode === 'today' ? 'Today'
                                                                    : 'Completed Tasks'
                            }
                        </h1>
                        {(viewMode === 'project' && selectedProject || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'all_tasks') && (
                            <button
                                onClick={handleCreateTaskAtTop}
                                className="p-1 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                title="New Task (Cmd+N)"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tag Filter Bar */}
                {availableTags.length > 0 && (
                    <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 overflow-x-auto bg-gray-50/50">
                        <Tag className="w-4 h-4 text-gray-400 shrink-0" />
                        {availableTags.map(tag => {
                            const isIncluded = selectedFilterTags.has(tag.recordName);
                            const isExcluded = excludedFilterTags.has(tag.recordName);
                            
                            const toggleInclude = () => {
                                setSelectedFilterTags(prev => {
                                    const next = new Set(prev);
                                    if (next.has(tag.recordName)) next.delete(tag.recordName);
                                    else next.add(tag.recordName);
                                    return next;
                                });
                                if (!isIncluded) {
                                    setExcludedFilterTags(prev => {
                                        const next = new Set(prev);
                                        next.delete(tag.recordName);
                                        return next;
                                    });
                                }
                            };

                            const toggleExclude = () => {
                                setExcludedFilterTags(prev => {
                                    const next = new Set(prev);
                                    if (next.has(tag.recordName)) next.delete(tag.recordName);
                                    else next.add(tag.recordName);
                                    return next;
                                });
                                if (!isExcluded) {
                                    setSelectedFilterTags(prev => {
                                        const next = new Set(prev);
                                        next.delete(tag.recordName);
                                        return next;
                                    });
                                }
                            };

                            return (
                                <div
                                    key={tag.recordName}
                                    className={`flex items-center rounded-full text-xs font-medium transition-colors border overflow-hidden shrink-0 ${
                                        isIncluded 
                                            ? 'bg-blue-50 border-blue-200' 
                                            : isExcluded
                                                ? 'bg-red-50 border-red-200 opacity-80'
                                                : 'bg-white border-gray-200'
                                    }`}
                                >
                                    <button
                                        onClick={toggleInclude}
                                        className={`px-2 py-1 transition-colors hover:bg-blue-100 ${
                                            isIncluded ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-600'
                                        }`}
                                        title="Include tag"
                                    >
                                        +
                                    </button>
                                    
                                    <span className={`px-1 py-1 ${
                                        isIncluded ? 'text-blue-700' : isExcluded ? 'text-red-700 line-through' : 'text-gray-600'
                                    }`}>
                                        {tag.fields.CD_name?.value}
                                    </span>

                                    <button
                                        onClick={toggleExclude}
                                        className={`px-2.5 py-1 transition-colors hover:bg-red-100 ${
                                            isExcluded ? 'bg-red-100 text-red-700' : 'text-gray-400 hover:text-red-600'
                                        }`}
                                        title="Exclude tag"
                                    >
                                        −
                                    </button>
                                </div>
                            );
                        })}
                        {(selectedFilterTags.size > 0 || excludedFilterTags.size > 0) && (
                            <button
                                onClick={() => {
                                    setSelectedFilterTags(new Set());
                                    setExcludedFilterTags(new Set());
                                }}
                                className="px-2 py-1 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-auto shrink-0"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {taskError && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                        <X className="w-4 h-4" />
                        <span>{taskError}</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6">
                    {viewMode === 'review' ? (
                        <div className="max-w-lg mx-auto pt-4">
                            {lastReviewDate && (
                                <p className="text-sm text-gray-400 mb-6">
                                    Last completed: {new Date(lastReviewDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            )}
                            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <h2 className="font-semibold text-gray-900">Review checklist</h2>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {REVIEW_ITEMS.map((item) => {
                                        const checked = !!reviewChecked[item.id];
                                        return (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                                            >
                                                <div
                                                    onClick={() => handleReviewItemClick(item.id)}
                                                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}
                                                >
                                                    {checked && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                {item.view ? (
                                                    <span
                                                        onClick={() => { setViewMode(item.view!); setSelectedProject(null); }}
                                                        className={`flex-1 transition-colors cursor-pointer ${checked ? 'line-through text-gray-400' : 'text-gray-800 hover:text-violet-600'}`}
                                                    >
                                                        {item.label}
                                                    </span>
                                                ) : (
                                                    <span className={`flex-1 transition-colors ${checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                        {item.label}
                                                    </span>
                                                )}
                                                {item.view && !checked && (
                                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <button
                                onClick={handleFinishReview}
                                className="mt-5 w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors"
                            >
                                Finish review
                            </button>
                        </div>
                    ) : viewMode === 'today' ? (
                        <div className="max-w-lg mx-auto pt-4">
                            <p className="text-sm text-gray-400 mb-5">
                                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                            {!googleToken ? (
                                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <Sun className="w-12 h-12 text-yellow-200 mx-auto mb-4" />
                                    <p className="text-gray-500 mb-3">Connect Google Calendar to see today's events.</p>
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Open Settings
                                    </button>
                                </div>
                            ) : loadingTodayEvents ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                                </div>
                            ) : todayEvents.length === 0 ? (
                                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <Sun className="w-12 h-12 text-yellow-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No events today.</p>
                                </div>
                            ) : (
                                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">
                                    {todayEvents.map(event => (
                                        <div key={`${event.calendarId}-${event.id}`} className="flex items-start gap-3 px-5 py-3.5">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                                                style={{ backgroundColor: event.calendarColor }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {event.summary || '(No title)'}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {formatEventTime(event)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : loadingTasks ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : visibleTasks.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            {viewMode === 'project' || viewMode === 'all_tasks' ? (
                                <>
                                    <ListTodo className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">No active tasks {viewMode === 'project' ? 'in this project' : 'found'}.</p>
                                </>
                            ) : viewMode === 'inbox' ? (
                                <>
                                    <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">Inbox is empty.</p>
                                </>
                            ) : viewMode === 'next_actions' ? (
                                <>
                                    <Zap className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No next actions.</p>
                                </>
                            ) : viewMode === 'due' ? (
                                <>
                                    <Calendar className="w-12 h-12 text-green-200 mx-auto mb-4" />
                                    <p className="text-gray-500">Nothing due or overdue.</p>
                                </>
                            ) : viewMode === 'waiting' ? (
                                <>
                                    <Hourglass className="w-12 h-12 text-orange-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No waiting for tasks.</p>
                                </>
                            ) : viewMode === 'deferred' ? (
                                <>
                                    <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">No deferred tasks.</p>
                                </>
                            ) : viewMode === 'someday' ? (
                                <>
                                    <Moon className="w-12 h-12 text-amber-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No someday / maybe tasks.</p>
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
                            {(viewMode === 'project' || viewMode === 'all_tasks') && sections ? (
                                <>
                                    {viewMode === 'all_tasks' && sections.inbox.length > 0 && (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={handleDropInbox}
                                        >
                                            <TaskSection key={`${viewMode}-${selectedProject?.recordName ?? 'all'}-inbox`} title="Inbox" count={sections.inbox.length} colorClass="text-gray-700">
                                                {renderTaskList(sections.inbox)}
                                            </TaskSection>
                                        </div>
                                    )}

                                    {sections.due.length > 0 && (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={handleDropDue}
                                        >
                                            <TaskSection key={`${viewMode}-${selectedProject?.recordName ?? 'all'}-due`} title="Due / Overdue" count={sections.due.length} colorClass="text-green-700">
                                                {renderTaskList(sections.due)}
                                            </TaskSection>
                                        </div>
                                    )}

                                    {sections.nextActions.length > 0 && (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={handleDropNextActions}
                                        >
                                            <TaskSection key={`${viewMode}-${selectedProject?.recordName ?? 'all'}-next`} title="Next Actions" count={sections.nextActions.length} colorClass="text-blue-700">
                                                {renderTaskList(sections.nextActions)}
                                            </TaskSection>
                                        </div>
                                    )}

                                    {sections.waitingFor.length > 0 && (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={handleDropWaiting}
                                        >
                                            <TaskSection key={`${viewMode}-${selectedProject?.recordName ?? 'all'}-waiting`} title="Waiting For" count={sections.waitingFor.length} colorClass="text-orange-500">
                                                {renderTaskList(sections.waitingFor)}
                                            </TaskSection>
                                        </div>
                                    )}

                                    {sections.deferred.length > 0 && (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={handleDropDeferred}
                                        >
                                            <TaskSection key={`${viewMode}-${selectedProject?.recordName ?? 'all'}-deferred`} title="Deferred" count={sections.deferred.length} colorClass="text-gray-600">
                                                {renderTaskList(sections.deferred)}
                                            </TaskSection>
                                        </div>
                                    )}

                                    {sections.someday.length > 0 && (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={handleDropSomeday}
                                        >
                                            <TaskSection key={`${viewMode}-${selectedProject?.recordName ?? 'all'}-someday`} title="Someday / Maybe" count={sections.someday.length} colorClass="text-[#92400e]">
                                                {renderTaskList(sections.someday)}
                                            </TaskSection>
                                        </div>
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

            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    googleToken={googleToken}
                    onGoogleToken={handleGoogleToken}
                    selectedCalendars={selectedCalendars}
                    onSaveCalendars={handleSaveCalendars}
                />
            )}

            {/* Keyboard Shortcuts Modal */}
            {
                showShortcuts && (
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
                                            <span className="text-gray-700">Create task at the top</span>
                                            <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">N</kbd>
                                        </div>
                                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-700">Create task at the bottom</span>
                                            <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">Shift + N</kbd>
                                        </div>
                                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-700">Select a project while typing a task name</span>
                                            <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">&</kbd>
                                        </div>
                                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-700">Select one or several tags while typing a task name</span>
                                            <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">@</kbd>
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
                                            <span className="text-gray-700">Create project at the top</span>
                                            <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">P</kbd>
                                        </div>
                                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-700">Create project at the bottom</span>
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
                                            <span className="text-gray-700">Show this help screen</span>
                                            <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">?</kbd>
                                        </div>
                                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-700">Search for tasks and projects</span>
                                            <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">F</kbd>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-sm text-gray-600">
                                Press <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded shadow-sm font-mono text-xs">Esc</kbd> to close
                            </div>
                        </div>
                    </div>
                )
            }

            {
                selectedTaskDetails && (
                    <div className="absolute inset-0 z-50 bg-black/10 backdrop-blur-[1px] flex justify-end">
                        {/* Click backdrop to close */}
                        <div className="absolute inset-0" onClick={handleCloseDetailsPanel} />

                        <div className="relative w-96 bg-white shadow-2xl border-l border-gray-100 h-full flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                                <div>
                                    <h2 className="font-bold text-lg text-gray-900 break-words line-clamp-2">
                                        {selectedTaskDetails.fields.CD_name?.value}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-400">Details</p>
                                        {detailsSaveState === 'saving' && (
                                            <span className="flex items-center gap-1 text-xs text-gray-400 animate-pulse">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                                                Saving…
                                            </span>
                                        )}
                                        {detailsSaveState === 'saved' && (
                                            <span className="flex items-center gap-1 text-xs text-green-500 animate-in fade-in duration-200">
                                                <Check className="w-3 h-3" />
                                                Saved
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={handleCloseDetailsPanel} className="text-gray-400 hover:text-gray-600 mt-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">


                                {/* Link Field */}
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
                                                value={selectedTaskDetails.fields.CD_date?.value ? (() => {
                                                    const d = new Date(selectedTaskDetails.fields.CD_date.value);
                                                    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                                                    return selectedTaskDetails.fields.CD_reminderactive?.value === 1
                                                        ? local.toISOString().slice(0, 16)
                                                        : local.toISOString().slice(0, 10);
                                                })() : ''}
                                                onChange={(e) => {
                                                    const dateVal = e.target.value ? new Date(e.target.value).getTime() : 0;
                                                    handleUpdateTaskDetail('CD_date', dateVal);
                                                }}
                                            />

                                            <div className="mt-4 flex items-center justify-between">
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer group w-fit"
                                                    onClick={() => {
                                                        const turningOn = selectedTaskDetails.fields.CD_recurring?.value !== 1;
                                                        if (turningOn) {
                                                            // Also write defaults for recurrence/recurrencetype if not already set,
                                                            // so CloudKit never stores them as undefined/0.
                                                            handleUpdateTaskDetail({
                                                                CD_recurring: 1,
                                                                CD_recurrence: selectedTaskDetails.fields.CD_recurrence?.value || 1,
                                                                CD_recurrencetype: selectedTaskDetails.fields.CD_recurrencetype?.value || 'days',
                                                            });
                                                        } else {
                                                            handleUpdateTaskDetail('CD_recurring', 0);
                                                        }
                                                    }}
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
                                                        <span className={`text-xs ${selectedTaskDetails.fields.CD_hideuntildate?.value === 1 ? 'text-blue-600 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>Hide until due</span>
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

                                {/* Notes Field */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Notes
                                    </label>
                                    <textarea
                                        value={noteInput}
                                        onChange={(e) => setNoteInput(e.target.value)}
                                        placeholder="Add notes..."
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y min-h-[300px]"
                                    />
                                    <div className="flex justify-end mt-1">
                                        <span className="text-[10px] text-gray-400">
                                            {noteInput === (selectedTaskDetails?.fields.CD_note?.value || '') ? 'Saved' : 'Typing...'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* Delete Task Button */}
                            <div className="px-6 py-4 border-t border-gray-100">
                                <button
                                    onClick={handleDeleteTask}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Task
                                </button>
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

            {
                selectedProjectDetails && (
                    <div className="absolute inset-0 z-50 bg-black/10 backdrop-blur-[1px] flex justify-end">
                        <div className="absolute inset-0" onClick={handleCloseProjectDetailsPanel} />

                        <div className="relative w-96 bg-white shadow-2xl border-l border-gray-100 h-full flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                                <div>
                                    <h2 className="font-bold text-lg text-gray-900 break-words line-clamp-2">
                                        {selectedProjectDetails.fields.CD_name?.value || 'Untitled Project'}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-400">Project Details</p>
                                        {projectDetailsSaveState === 'saving' && (
                                            <span className="flex items-center gap-1 text-xs text-gray-400 animate-pulse">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                                                Saving…
                                            </span>
                                        )}
                                        {projectDetailsSaveState === 'saved' && (
                                            <span className="flex items-center gap-1 text-xs text-green-500 animate-in fade-in duration-200">
                                                <Check className="w-3 h-3" />
                                                Saved
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={handleCloseProjectDetailsPanel} className="text-gray-400 hover:text-gray-600 mt-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Color Picker */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'gray', 'black', 'brown'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => handleUpdateProjectDetail('CD_color', c)}
                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${selectedProjectDetails.fields.CD_color?.value === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-gray-100" />

                                {/* Icon Picker */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Icon</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {[
                                            "1.circle.fill", "2.circle.fill", "3.circle.fill", "4.circle.fill", "pencil", "calendar", "checkmark.seal", "folder.fill", "lightbulb", "gearshape.fill", "hammer.fill", "paintpalette", "music.note", "film", "book.fill", "graduationcap.fill", "leaf.fill", "heart.fill", "house.fill", "car.fill", "airplane.circle.fill", "briefcase.fill", "gamecontroller.fill", "cup.and.saucer.fill", "dollarsign.circle.fill", "doc.fill", "cart.fill", "person.2.fill"
                                        ].map(iconName => {
                                            const isSelected = selectedProjectDetails.fields.CD_icon?.value === iconName;
                                            return (
                                                <button
                                                    key={iconName}
                                                    onClick={() => handleUpdateProjectDetail('CD_icon', iconName)}
                                                    className={`p-2 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                    title={iconName}
                                                >
                                                    <SFSymbolMapper symbol={iconName} size={20} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Complete / Delete — only when no open tasks */}
                                {(() => {
                                    const hasOpenTasks = tasks.some(
                                        t => t.fields.CD_project?.value === selectedProjectDetails.recordName
                                            && t.fields.CD_completed?.value !== 1
                                    );
                                    if (hasOpenTasks) return null;
                                    return (
                                        <>
                                            <hr className="border-gray-100" />
                                            <div className="space-y-2">
                                                <p className="text-xs text-gray-400 text-center">No open tasks — you can finalise this project.</p>
                                                <button
                                                    onClick={handleCompleteProject}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Mark Project as Complete
                                                </button>
                                                <button
                                                    onClick={handleDeleteProject}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete Project
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
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
            <div className="h-screen overflow-hidden bg-white flex flex-col">
                <Navbar />
                <div className="flex-1 overflow-hidden mt-16">
                    <ProjectsList />
                </div>
            </div>
        </CloudKitProvider>
    );
}
