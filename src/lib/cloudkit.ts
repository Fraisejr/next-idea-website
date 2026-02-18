// Testing: iCloud.Transformia.Next-Idea with new token
export const CLOUDKIT_CONTAINER_ID = 'iCloud.Transformia.Next-Idea';
export const CLOUDKIT_API_TOKEN = 'REDACTED_DEV_TOKEN';

// Environment configuration:
// - 'development': Use for local testing (localhost). More permissive, doesn't require domain whitelisting.
// - 'production': Use for deployed production sites. Requires domain to be whitelisted in CloudKit Dashboard.
export const CLOUDKIT_ENV = 'development';

// Type definition based on user schema
export interface ProjectRecord {
    recordName: string;
    recordChangeTag?: string;
    recordType: 'CD_Project';
    fields: {
        CD_name: { value: string };
        CD_id: { value: string };
        CD_order?: { value: number };
        CD_completed?: { value: number }; // 0 for false, 1 for true
        CD_singleactions?: { value: number }; // 0 for false, 1 for true
        CD_focus?: { value: number }; // 0 for false, 1 for true
        CD_icon?: { value: string }; // SF Symbol name
        CD_color?: { value: string }; // Hex color or name
    };
}

export interface TaskRecord {
    recordName: string;
    recordChangeTag: string;
    recordType: 'CD_Task';
    fields: {
        CD_name: { value: string };
        CD_id: { value: string };
        CD_order?: { value: number };
        CD_completed?: { value: number }; // 0 for false, 1 for true
        CD_ticked?: { value: number }; // 0 for false, 1 for true
        CD_modifieddate?: { value: number }; // Timestamp
        CD_project?: { value: string }; // Project Reference ID (String)
        CD_someday?: { value: number }; // 0/1
        CD_waitingfor?: { value: number }; // 0/1
        CD_date?: { value: number }; // Timestamp
        CD_recurring?: { value: number }; // 0/1
        CD_dateactive?: { value: number }; // 0/1
        CD_reminderactive?: { value: number }; // 0/1
        CD_recurrence?: { value: number }; // Int16
        CD_recurrencetype?: { value: string }; // String
        CD_hideuntildate?: { value: number }; // 0/1
        CD_link?: { value: string }; // URL String
        CD_note?: { value: string }; // Notes String
    };
}

export interface TagRecord {
    recordName: string;
    recordChangeTag: string;
    recordType: 'CD_Tag';
    fields: {
        CD_name: { value: string };
        CD_color?: { value: string };
    };
}

// Helper to check if window.CloudKit is available
export const isCloudKitLoaded = () => {
    return typeof window !== 'undefined' && 'CloudKit' in window;
};
