// Service worker for CloudKit push notifications.
// When Apple delivers a data-change push, we forward it to all open windows
// so the app can run an incremental sync without any visible notification.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                if (clients.length > 0) {
                    clients.forEach(c => c.postMessage({ type: 'CLOUDKIT_PUSH' }));
                }
                // If no window is open the push is silently discarded —
                // the app will catch up via the visibility-change sync on next open.
            })
    );
});
