import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { pagesConfig } from '@/pages.config';

export default function NavigationTracker() {
    const location = useLocation();
    const auth = useAuth();
    if (!auth) return null;
    const { isAuthenticated } = auth;
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];

    // Rastreia navegação localmente (sem Backend Base44)
    useEffect(() => {
        const pathname = location.pathname;
        let pageName;

        if (pathname === '/' || pathname === '') {
            pageName = mainPageKey;
        } else {
            const pathSegment = pathname.replace(/^\//, '').split('/')[0];
            const pageKeys = Object.keys(Pages);
            const matchedKey = pageKeys.find(
                key => key.toLowerCase() === pathSegment.toLowerCase()
            );
            pageName = matchedKey || null;
        }

        if (isAuthenticated && pageName) {
            // Log local apenas — sem chamadas ao Base44
            console.debug(`[Nav] Página: ${pageName}`);
        }
    }, [location, isAuthenticated, Pages, mainPageKey]);

    return null;
}