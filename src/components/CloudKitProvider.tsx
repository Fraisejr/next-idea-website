'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CLOUDKIT_API_TOKEN, CLOUDKIT_CONTAINER_ID, CLOUDKIT_ENV } from '@/lib/cloudkit';

// Define CloudKit types loosely to avoid full type definition overhead
type CloudKitContextType = {
    container: any | null;
    isAuthenticated: boolean;
    currentUser: any | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
};

const CloudKitContext = createContext<CloudKitContextType>({
    container: null,
    isAuthenticated: false,
    currentUser: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
});

export const useCloudKit = () => useContext(CloudKitContext);

export function CloudKitProvider({ children }: { children: ReactNode }) {
    const [container, setContainer] = useState<any | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initCloudKit = async () => {
            // Poll for CloudKit script to be loaded
            let attempts = 0;
            while (!window.CloudKit && attempts < 20) {
                await new Promise(r => setTimeout(r, 200));
                attempts++;
            }

            if (!window.CloudKit) {
                console.error('CloudKit script failed to load');
                setIsLoading(false);
                return;
            }

            try {
                // Configure CloudKit
                window.CloudKit.configure({
                    containers: [{
                        containerIdentifier: CLOUDKIT_CONTAINER_ID,
                        apiTokenAuth: {
                            apiToken: CLOUDKIT_API_TOKEN,
                            persist: true,
                            signInButton: {
                                id: 'apple-sign-in-button',
                                theme: 'black'
                            }
                        },
                        environment: CLOUDKIT_ENV
                    }]
                });

                console.log('CloudKit configured successfully');
                console.log('  Container ID:', CLOUDKIT_CONTAINER_ID);
                console.log('  Environment:', CLOUDKIT_ENV);

                const ckContainer = window.CloudKit.getDefaultContainer();
                if (!ckContainer) {
                    throw new Error("Failed to get default container");
                }

                setContainer(ckContainer);

                // Initialize Auth
                console.log('Setting up CloudKit authentication...');
                const authInfo = await ckContainer.setUpAuth();
                console.log('Auth setup complete:', authInfo);

                if (authInfo && authInfo.userIdentity) {
                    console.log('User is authenticated:', authInfo.userIdentity);
                    setIsAuthenticated(true);
                    setCurrentUser(authInfo.userIdentity);
                } else if (authInfo) {
                    console.log('Auth info received but no userIdentity:', authInfo);
                    setIsAuthenticated(true);
                    setCurrentUser(authInfo);
                } else {
                    console.log('User is not authenticated. CloudKit should auto-render button via signInButton config.');
                }
            } catch (err: any) {
                console.error('CloudKit initialization error:', err);
                console.error('Error details:', {
                    message: err.message,
                    stack: err.stack,
                    name: err.name
                });
            } finally {
                setIsLoading(false);
            }
        };

        initCloudKit();
    }, []);

    const login = async () => {
        if (!container) return;
        // The Sign in with Apple button (rendered by CloudKit) handles the flow.
        // We don't need to trigger it programmatically (and usually can't).
        console.log('User should click the Apple Sign In button.');
    };

    const logout = async () => {
        if (!container) {
            console.warn('Logout called but container is null');
            return;
        }
        console.log('Attempting to sign out...');
        try {
            // signOut is directly on the container in CloudKit JS 2.0+
            await container.signOut();
            console.log('Sign out successful');
            setIsAuthenticated(false);
            setCurrentUser(null);
        } catch (err) {
            console.error('Logout error', err);
        }
    };

    // Listen for auth changes
    useEffect(() => {
        if (!container) return;

        // CloudKit JS often exposes event listeners
        // We can use the promise returned by setUpAuth in the init for initial state.
        // For runtime changes (like signing out elsewhere), we might poll or listen to events if documented.
        // Basic implementation: trust the internal state we set.

        // One key thing: CloudKit JS usually renders a button div. 
        // We will let the `app/page.tsx` handle the button rendering using the container.
    }, [container]);

    return (
        <CloudKitContext.Provider value={{
            container,
            isAuthenticated,
            currentUser,
            isLoading,
            login,
            logout
        }}>
            {children}
        </CloudKitContext.Provider>
    );
}
