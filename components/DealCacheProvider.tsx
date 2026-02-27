'use client';

import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface ListingsCache {
    data: any[];
    total: number;
    totalPages: number;
}

interface DealCacheContextType {
    getCachedListings: (key: string) => ListingsCache | null;
    setCachedListings: (key: string, data: ListingsCache) => void;
    getCachedDeal: (id: string | number) => any | null;
    setCachedDeal: (id: string | number, data: any) => void;
    getCachedStats: () => { stats: any; recentDeals: any[] } | null;
    setCachedStats: (data: { stats: any; recentDeals: any[] }) => void;
}

const DealCacheContext = createContext<DealCacheContextType | null>(null);

function isValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export function DealCacheProvider({ children }: { children: ReactNode }) {
    const listingsCache = useRef<Map<string, CacheEntry<ListingsCache>>>(new Map());
    const dealCache = useRef<Map<string, CacheEntry<any>>>(new Map());
    const statsCache = useRef<CacheEntry<{ stats: any; recentDeals: any[] }> | undefined>(undefined);

    const getCachedListings = useCallback((key: string): ListingsCache | null => {
        const entry = listingsCache.current.get(key);
        return isValid(entry) ? entry.data : null;
    }, []);

    const setCachedListings = useCallback((key: string, data: ListingsCache) => {
        listingsCache.current.set(key, { data, timestamp: Date.now() });
    }, []);

    const getCachedDeal = useCallback((id: string | number): any | null => {
        const entry = dealCache.current.get(String(id));
        return isValid(entry) ? entry.data : null;
    }, []);

    const setCachedDeal = useCallback((id: string | number, data: any) => {
        dealCache.current.set(String(id), { data, timestamp: Date.now() });
    }, []);

    const getCachedStats = useCallback((): { stats: any; recentDeals: any[] } | null => {
        return isValid(statsCache.current) ? statsCache.current.data : null;
    }, []);

    const setCachedStats = useCallback((data: { stats: any; recentDeals: any[] }) => {
        statsCache.current = { data, timestamp: Date.now() };
    }, []);

    return (
        <DealCacheContext.Provider
            value={{
                getCachedListings,
                setCachedListings,
                getCachedDeal,
                setCachedDeal,
                getCachedStats,
                setCachedStats,
            }}
        >
            {children}
        </DealCacheContext.Provider>
    );
}

export function useDealCache(): DealCacheContextType {
    const ctx = useContext(DealCacheContext);
    if (!ctx) throw new Error('useDealCache must be used inside DealCacheProvider');
    return ctx;
}
