// Testing: iCloud.Transformia.Next-Idea with new token
export const CLOUDKIT_CONTAINER_ID = 'iCloud.Transformia.Next-Idea';
export const CLOUDKIT_API_TOKEN = 'a995469eb8a8140f9c343a34a6e9656d666adb6baf70f85133fb75ca372e5e68';

// Environment configuration:
// - 'development': Use for local testing (localhost). More permissive, doesn't require domain whitelisting.
// - 'production': Use for deployed production sites. Requires domain to be whitelisted in CloudKit Dashboard.
export const CLOUDKIT_ENV = 'development';

// Type definition based on user schema
export interface ProjectRecord {
    recordName: string;
    recordType: 'CD_Project';
    fields: {
        CD_name: { value: string };
        CD_id: { value: string };
        CD_order?: { value: number };
        CD_completed?: { value: number }; // 0 for false, 1 for true
        CD_singleactions?: { value: number }; // 0 for false, 1 for true
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
        CD_project?: { value: { recordName: string, action: string, zoneID?: any } }; // Reference
    };
}

// Helper to check if window.CloudKit is available
export const isCloudKitLoaded = () => {
    return typeof window !== 'undefined' && 'CloudKit' in window;
};
