export { };

declare global {
    interface Window {
        CloudKit: any;
        ck_resolvedZoneID?: any;
    }
}
