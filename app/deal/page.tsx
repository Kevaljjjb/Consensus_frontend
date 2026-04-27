'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search,
    Plus,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    X,
    ChevronDown,
    Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import PageShell from '@/components/PageShell';
import { useDealCache } from '@/components/DealCacheProvider';

interface Listing {
    id: number;
    title: string;
    description: string;
    source: string;
    city: string;
    state: string;
    industry: string;
    price: string;
    gross_revenue: string;
    cash_flow: string;
    ebitda: string;
    first_seen_date: string;
    [key: string]: any;
}

interface ListingsResponse {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    data: Listing[];
}

interface DealFilters {
    source: string;
    industry: string;
    state: string;
    country: string;
    minCashFlow: string;
    maxCashFlow: string;
    minEbitda: string;
    maxEbitda: string;
    minRevenue: string;
    maxRevenue: string;
}

interface PersistedDealFeedState {
    searchQuery: string;
    searchMode: 'browse' | 'search';
    page: number;
    filters: DealFilters;
    appliedFilters: DealFilters;
    scrollY: number;
    timestamp: number;
}

const DEAL_FEED_STATE_KEY = 'deal-feed-state:v1';
const DEAL_FEED_STATE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const DEFAULT_FILTERS: DealFilters = {
    source: '',
    industry: '',
    state: '',
    country: '',
    minCashFlow: '',
    maxCashFlow: '',
    minEbitda: '',
    maxEbitda: '',
    minRevenue: '',
    maxRevenue: '',
};

function normalizeFilters(filters: DealFilters): DealFilters {
    return {
        source: filters.source.trim(),
        industry: filters.industry.trim(),
        state: filters.state.trim(),
        country: filters.country.trim(),
        minCashFlow: filters.minCashFlow.trim().replaceAll(',', ''),
        maxCashFlow: filters.maxCashFlow.trim().replaceAll(',', ''),
        minEbitda: filters.minEbitda.trim().replaceAll(',', ''),
        maxEbitda: filters.maxEbitda.trim().replaceAll(',', ''),
        minRevenue: filters.minRevenue.trim().replaceAll(',', ''),
        maxRevenue: filters.maxRevenue.trim().replaceAll(',', ''),
    };
}

function parsePersistedFilters(value: unknown): DealFilters {
    if (!value || typeof value !== 'object') return DEFAULT_FILTERS;
    const raw = value as Partial<Record<keyof DealFilters, unknown>>;

    return normalizeFilters({
        source: typeof raw.source === 'string' ? raw.source : '',
        industry: typeof raw.industry === 'string' ? raw.industry : '',
        state: typeof raw.state === 'string' ? raw.state : '',
        country: typeof raw.country === 'string' ? raw.country : '',
        minCashFlow: typeof raw.minCashFlow === 'string' ? raw.minCashFlow : '',
        maxCashFlow: typeof raw.maxCashFlow === 'string' ? raw.maxCashFlow : '',
        minEbitda: typeof raw.minEbitda === 'string' ? raw.minEbitda : '',
        maxEbitda: typeof raw.maxEbitda === 'string' ? raw.maxEbitda : '',
        minRevenue: typeof raw.minRevenue === 'string' ? raw.minRevenue : '',
        maxRevenue: typeof raw.maxRevenue === 'string' ? raw.maxRevenue : '',
    });
}

function serializeFilters(filters: DealFilters) {
    const normalized = normalizeFilters(filters);
    return [
        normalized.source,
        normalized.industry,
        normalized.state,
        normalized.country,
        normalized.minCashFlow,
        normalized.maxCashFlow,
        normalized.minEbitda,
        normalized.maxEbitda,
        normalized.minRevenue,
        normalized.maxRevenue,
    ].join('|');
}

function makeBrowseCacheKey(page: number, filters: DealFilters) {
    return `browse:${page}:${serializeFilters(filters)}`;
}

function makeSearchCacheKey(query: string, filters: DealFilters) {
    return `search:${query.trim().toLowerCase()}:${serializeFilters(filters)}`;
}

function appendFilterParams(params: URLSearchParams, filters: DealFilters) {
    const normalized = normalizeFilters(filters);

    if (normalized.source) params.set('source', normalized.source);
    if (normalized.industry) params.set('industry', normalized.industry);
    if (normalized.state) params.set('state', normalized.state);
    if (normalized.country) params.set('country', normalized.country);
    if (normalized.minCashFlow) params.set('min_cash_flow', normalized.minCashFlow);
    if (normalized.maxCashFlow) params.set('max_cash_flow', normalized.maxCashFlow);
    if (normalized.minEbitda) params.set('min_ebitda', normalized.minEbitda);
    if (normalized.maxEbitda) params.set('max_ebitda', normalized.maxEbitda);
    if (normalized.minRevenue) params.set('min_revenue', normalized.minRevenue);
    if (normalized.maxRevenue) params.set('max_revenue', normalized.maxRevenue);
}

function toOptionalNumber(value: string): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function validateFilterRanges(filters: DealFilters): string {
    const checks = [
        { min: filters.minCashFlow, max: filters.maxCashFlow, label: 'Cash Flow' },
        { min: filters.minEbitda, max: filters.maxEbitda, label: 'EBITDA' },
        { min: filters.minRevenue, max: filters.maxRevenue, label: 'Revenue' },
    ];

    for (const check of checks) {
        const min = toOptionalNumber(check.min);
        const max = toOptionalNumber(check.max);
        if (min !== null && max !== null && min > max) {
            return `${check.label} min cannot be greater than max.`;
        }
    }

    return '';
}

function formatRangeValue(min: string, max: string): string {
    const left = min ? `$${Number(min).toLocaleString()}` : 'Any';
    const right = max ? `$${Number(max).toLocaleString()}` : 'Any';
    return `${left} - ${right}`;
}

function parseOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function toRecord(value: unknown): Partial<Record<string, unknown>> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Partial<Record<string, unknown>>;
}

function getListingFitScore(listing: Listing): number | null {
    const evaluation = toRecord(listing.evaluation) ?? toRecord(listing.deal_evaluation);
    const score =
        parseOptionalNumber(listing.ai_fit_score) ??
        parseOptionalNumber(listing.fit_score) ??
        parseOptionalNumber(evaluation?.fit_score);

    if (score === null) return null;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreBadgeClass(score: number): string {
    if (score >= 80) return 'bg-[#F6DF5F]/20 text-[#F6DF5F] border-[#F6DF5F]/30';
    if (score >= 60) return 'bg-amber-500/15 text-amber-200 border-amber-400/25';
    return 'bg-slate-400/15 text-slate-200 border-slate-200/15';
}

function scoreBarClass(score: number): string {
    if (score >= 80) return 'bg-[#F6DF5F]';
    if (score >= 60) return 'bg-amber-300';
    return 'bg-slate-300';
}

function scoreTextClass(score: number): string {
    if (score >= 80) return 'text-[#F6DF5F]';
    if (score >= 60) return 'text-amber-200';
    return 'text-slate-200';
}

function scoreLabel(score: number): string {
    if (score >= 80) return 'Strong fit with the mandate';
    if (score >= 60) return 'Worth watching closely';
    if (score >= 40) return 'Needs more diligence';
    return 'Low-fit or incomplete';
}

export default function DealPage() {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'browse' | 'search'>('browse');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState<DealFilters>(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<DealFilters>(DEFAULT_FILTERS);
    const [filterError, setFilterError] = useState('');
    const [isHydrated, setIsHydrated] = useState(false);

    const cache = useDealCache();
    const initialMount = useRef(true);
    const pendingScrollRestore = useRef<number | null>(null);

    const persistDealFeedState = useCallback((scrollY?: number) => {
        if (typeof window === 'undefined' || !isHydrated) return;

        const state: PersistedDealFeedState = {
            searchQuery,
            searchMode,
            page,
            filters: normalizeFilters(filters),
            appliedFilters: normalizeFilters(appliedFilters),
            scrollY: scrollY ?? window.scrollY,
            timestamp: Date.now(),
        };

        sessionStorage.setItem(DEAL_FEED_STATE_KEY, JSON.stringify(state));
    }, [searchQuery, searchMode, page, filters, appliedFilters, isHydrated]);

    const fetchListings = useCallback(async () => {
        const key = makeBrowseCacheKey(page, appliedFilters);

        // Check cache first
        const cached = cache.getCachedListings(key);
        if (cached) {
            setListings(cached.data);
            setTotalPages(cached.totalPages);
            setTotal(cached.total);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '10',
            });
            appendFilterParams(params, appliedFilters);

            const res = await fetch(`/api/listings?${params}`);
            const data: ListingsResponse = await res.json();
            setListings(data.data);
            setTotalPages(data.total_pages);
            setTotal(data.total);

            // Store in cache
            cache.setCachedListings(key, {
                data: data.data,
                total: data.total,
                totalPages: data.total_pages,
            });
        } catch (err) {
            console.error('Failed to fetch listings:', err);
        } finally {
            setLoading(false);
        }
    }, [page, appliedFilters, cache]);

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchMode('browse');
            return;
        }

        const key = makeSearchCacheKey(query, appliedFilters);
        const cached = cache.getCachedListings(key);
        if (cached) {
            setListings(cached.data);
            setTotal(cached.total);
            setTotalPages(1);
            setSearchMode('search');
            setLoading(false);
            return;
        }

        setLoading(true);
        setSearchMode('search');
        try {
            const params = new URLSearchParams({ q: query, limit: '20' });
            appendFilterParams(params, appliedFilters);

            const res = await fetch(`/api/search?${params}`);
            const data = await res.json();
            setListings(data.data);
            setTotal(data.total);
            setTotalPages(1);

            cache.setCachedListings(key, {
                data: data.data,
                total: data.total,
                totalPages: 1,
            });
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, cache]);

    const updateFilter = useCallback((key: keyof DealFilters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const applyFilters = useCallback(() => {
        const normalized = normalizeFilters(filters);
        const validationError = validateFilterRanges(normalized);

        if (validationError) {
            setFilterError(validationError);
            return;
        }

        setFilterError('');
        setPage(1);
        setFilters(normalized);
        setAppliedFilters(normalized);
    }, [filters]);

    const resetFilters = useCallback(() => {
        setFilterError('');
        setPage(1);
        setFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
    }, []);

    const clearAppliedFilter = useCallback((keys: Array<keyof DealFilters>) => {
        setFilterError('');
        setPage(1);
        setFilters((prev) => {
            const next = { ...prev };
            for (const key of keys) next[key] = '';
            return next;
        });
        setAppliedFilters((prev) => {
            const next = { ...prev };
            for (const key of keys) next[key] = '';
            return next;
        });
    }, []);

    const applyOnEnter = useCallback((key: string, preventDefault: () => void) => {
        if (key !== 'Enter') return;
        preventDefault();
        applyFilters();
    }, [applyFilters]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const raw = sessionStorage.getItem(DEAL_FEED_STATE_KEY);
        if (!raw) {
            setIsHydrated(true);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<PersistedDealFeedState>;
            const isFresh = typeof parsed.timestamp === 'number' && (Date.now() - parsed.timestamp) < DEAL_FEED_STATE_TTL_MS;

            if (!isFresh) {
                sessionStorage.removeItem(DEAL_FEED_STATE_KEY);
                setIsHydrated(true);
                return;
            }

            if (typeof parsed.searchQuery === 'string') setSearchQuery(parsed.searchQuery);
            if (parsed.searchMode === 'browse' || parsed.searchMode === 'search') setSearchMode(parsed.searchMode);
            if (typeof parsed.page === 'number' && Number.isFinite(parsed.page) && parsed.page > 0) setPage(Math.floor(parsed.page));

            if (parsed.filters && typeof parsed.filters === 'object') {
                const restoredFilters = parsePersistedFilters(parsed.filters);
                setFilters(restoredFilters);
                setAppliedFilters(parsed.appliedFilters ? parsePersistedFilters(parsed.appliedFilters) : restoredFilters);
            } else {
                // Backward compatibility with previously persisted shape.
                const legacy = parsed as Partial<{ sourceFilter: string; industryFilter: string }>;
                const legacyFilters = normalizeFilters({
                    ...DEFAULT_FILTERS,
                    source: typeof legacy.sourceFilter === 'string' ? legacy.sourceFilter : '',
                    industry: typeof legacy.industryFilter === 'string' ? legacy.industryFilter : '',
                });
                setFilters(legacyFilters);
                setAppliedFilters(legacyFilters);
            }

            if (typeof parsed.scrollY === 'number' && Number.isFinite(parsed.scrollY) && parsed.scrollY >= 0) {
                pendingScrollRestore.current = parsed.scrollY;
            }
        } catch {
            sessionStorage.removeItem(DEAL_FEED_STATE_KEY);
        } finally {
            setIsHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!isHydrated) return;
        if (searchMode === 'browse') {
            fetchListings();
        }
    }, [fetchListings, searchMode, isHydrated]);

    // Debounced search
    useEffect(() => {
        if (!isHydrated) return;

        if (initialMount.current) {
            initialMount.current = false;
            if (searchMode === 'search' && searchQuery.trim()) {
                performSearch(searchQuery);
                return;
            }
        }

        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                performSearch(searchQuery);
            } else {
                setSearchMode('browse');
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, searchMode, performSearch, isHydrated]);

    useEffect(() => {
        if (!isHydrated) return;
        persistDealFeedState();
    }, [isHydrated, persistDealFeedState]);

    useEffect(() => {
        if (!isHydrated || typeof window === 'undefined') return;

        let rafId: number | null = null;

        const onScroll = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(() => {
                persistDealFeedState(window.scrollY);
                rafId = null;
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, [isHydrated, persistDealFeedState]);

    useEffect(() => {
        if (!isHydrated || loading || pendingScrollRestore.current === null || typeof window === 'undefined') return;

        const targetY = pendingScrollRestore.current;
        pendingScrollRestore.current = null;

        const rafId = window.requestAnimationFrame(() => {
            window.scrollTo({ top: targetY, behavior: 'auto' });
        });

        return () => window.cancelAnimationFrame(rafId);
    }, [isHydrated, loading, listings.length]);

    const formatMoney = (val: string | number | null | undefined) => {
        if (val === null || val === undefined || val === '' || val === 'N/A') return 'N/A';
        if (typeof val === 'number' && Number.isFinite(val)) {
            if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
            if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
            return `$${val.toFixed(0)}`;
        }
        const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return String(val);
        if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
        if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
        return `$${num.toFixed(0)}`;
    };

    const isNew = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        return diff < 7 * 24 * 60 * 60 * 1000; // 7 days
    };

    const hasPendingFilterChanges = serializeFilters(filters) !== serializeFilters(appliedFilters);
    const hasActiveFilters = serializeFilters(appliedFilters) !== serializeFilters(DEFAULT_FILTERS);

    const activeFilterBadges: Array<{ key: string; label: string; value: string; clearKeys: Array<keyof DealFilters> }> = [];
    if (appliedFilters.source) activeFilterBadges.push({ key: 'source', label: 'Source', value: appliedFilters.source, clearKeys: ['source'] });
    if (appliedFilters.industry) activeFilterBadges.push({ key: 'industry', label: 'Industry', value: appliedFilters.industry, clearKeys: ['industry'] });
    if (appliedFilters.state) activeFilterBadges.push({ key: 'state', label: 'State', value: appliedFilters.state, clearKeys: ['state'] });
    if (appliedFilters.country) activeFilterBadges.push({ key: 'country', label: 'Country', value: appliedFilters.country, clearKeys: ['country'] });
    if (appliedFilters.minRevenue || appliedFilters.maxRevenue) {
        activeFilterBadges.push({
            key: 'revenue',
            label: 'Revenue',
            value: formatRangeValue(appliedFilters.minRevenue, appliedFilters.maxRevenue),
            clearKeys: ['minRevenue', 'maxRevenue'],
        });
    }
    if (appliedFilters.minEbitda || appliedFilters.maxEbitda) {
        activeFilterBadges.push({
            key: 'ebitda',
            label: 'EBITDA',
            value: formatRangeValue(appliedFilters.minEbitda, appliedFilters.maxEbitda),
            clearKeys: ['minEbitda', 'maxEbitda'],
        });
    }
    if (appliedFilters.minCashFlow || appliedFilters.maxCashFlow) {
        activeFilterBadges.push({
            key: 'cash-flow',
            label: 'Cash Flow',
            value: formatRangeValue(appliedFilters.minCashFlow, appliedFilters.maxCashFlow),
            clearKeys: ['minCashFlow', 'maxCashFlow'],
        });
    }

    return (
        <PageShell activePage="deals">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">Deal Feed</h1>
                    <p className="text-slate-500 font-medium">
                        {total > 0 ? `${total} listings found` : 'Discover investment opportunities'}
                        {searchMode === 'search' && searchQuery && (
                            <span className="text-[#F6DF5F] ml-2">• Semantic search active</span>
                        )}
                        {hasPendingFilterChanges && (
                            <span className="text-amber-500 ml-2">• Filter changes pending</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-[400px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <Input
                            className="w-full pl-12 pr-4 py-6 rounded-2xl border-slate-200 bg-white focus:ring-2 focus:ring-[#F6DF5F] focus:border-transparent outline-none transition-all placeholder-slate-400 shadow-sm"
                            placeholder="Search by industry, name or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setSearchMode('browse'); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <Link href="/deal/upload">
                        <Button className="bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900 font-bold px-6 py-6 rounded-2xl flex items-center gap-2 transition-all shadow-sm border-0">
                            <Plus size={20} strokeWidth={3} />
                            <span>Add Deal</span>
                        </Button>
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* Filters Sidebar */}
                <aside className="col-span-12 lg:col-span-3">
                    <div className="bg-[#414854] p-8 rounded-[32px] shadow-lg sticky top-6">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-white font-bold text-xl tracking-tight">Filters</h2>
                            <button
                                onClick={resetFilters}
                                disabled={!hasActiveFilters && !hasPendingFilterChanges}
                                className="text-[#F6DF5F] text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Reset
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Source</label>
                                <div className="relative">
                                    <select
                                        value={filters.source}
                                        onChange={(e) => updateFilter('source', e.target.value)}
                                        className="w-full bg-white/10 border border-white/10 text-white rounded-xl py-3 px-4 appearance-none focus:ring-[#F6DF5F] focus:border-[#F6DF5F] outline-none cursor-pointer"
                                    >
                                        <option value="" className="bg-[#414854]">All Sources</option>
                                        <option value="BizBen" className="bg-[#414854]">BizBen</option>
                                        <option value="BizBuySell" className="bg-[#414854]">BizBuySell</option>
                                        <option value="Manual" className="bg-[#414854]">Manual Upload</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={18} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Industry</label>
                                <Input
                                    value={filters.industry}
                                    onChange={(e) => updateFilter('industry', e.target.value)}
                                    onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                    placeholder="e.g. Construction"
                                    className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0"
                                />
                            </div>

                            <div>
                                <label className="block text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Location</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        value={filters.state}
                                        onChange={(e) => updateFilter('state', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="State"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0"
                                    />
                                    <Input
                                        value={filters.country}
                                        onChange={(e) => updateFilter('country', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="Country"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Revenue Range</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={filters.minRevenue}
                                        onChange={(e) => updateFilter('minRevenue', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="Min"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        value={filters.maxRevenue}
                                        onChange={(e) => updateFilter('maxRevenue', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="Max"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-white/50 text-xs font-bold uppercase tracking-widest mb-4">EBITDA Range</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={filters.minEbitda}
                                        onChange={(e) => updateFilter('minEbitda', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="Min"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        value={filters.maxEbitda}
                                        onChange={(e) => updateFilter('maxEbitda', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="Max"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Cash Flow Range</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={filters.minCashFlow}
                                        onChange={(e) => updateFilter('minCashFlow', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="Min"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        value={filters.maxCashFlow}
                                        onChange={(e) => updateFilter('maxCashFlow', e.target.value)}
                                        onKeyDown={(e) => applyOnEnter(e.key, () => e.preventDefault())}
                                        placeholder="Max"
                                        className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                            </div>

                            {filterError && (
                                <p className="text-red-200 text-xs font-semibold bg-red-500/10 border border-red-300/20 rounded-xl px-3 py-2">
                                    {filterError}
                                </p>
                            )}

                            <div className="flex gap-2 pt-2">
                                <Button
                                    onClick={applyFilters}
                                    disabled={!hasPendingFilterChanges}
                                    className="flex-1 bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Apply Filters
                                </Button>
                                <Button
                                    onClick={resetFilters}
                                    disabled={!hasActiveFilters && !hasPendingFilterChanges}
                                    className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <div className="col-span-12 lg:col-span-9 space-y-6">
                    {/* Active filters */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {activeFilterBadges.map((badge) => (
                                <Badge
                                    key={badge.key}
                                    className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-full text-sm font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-200 transition-all"
                                >
                                    {badge.label}: {badge.value}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${badge.label} filter`}
                                        className="inline-flex items-center justify-center rounded-full text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            clearAppliedFilter(badge.clearKeys);
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <Loader2 size={40} className="animate-spin text-[#F6DF5F]" />
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="text-center py-32">
                            <p className="text-slate-500 text-lg">No listings found.</p>
                            <p className="text-slate-400 text-sm mt-2">Try adjusting your filters or search query.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {listings.map((deal) => {
                                const fitScore = getListingFitScore(deal);

                                return (
                                    <div key={deal.id} className="bg-[#414854] p-8 rounded-[32px] shadow-lg group transition-all hover:translate-y-[-4px] hover:shadow-2xl border border-white/5 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#F6DF5F]/10 blur-[80px] pointer-events-none" />

                                        <div className="flex flex-col xl:flex-row justify-between gap-8">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-4">
                                                    {isNew(deal.first_seen_date) && (
                                                        <span className="px-2 py-1 rounded bg-[#F6DF5F] text-slate-900 text-[10px] font-black uppercase tracking-widest">New</span>
                                                    )}
                                                    <h3 className="text-2xl font-bold text-white group-hover:text-[#F6DF5F] transition-colors">{deal.title}</h3>
                                                </div>
                                                <p className="text-white/70 text-base leading-relaxed mb-6 max-w-3xl line-clamp-3">
                                                    {deal.description !== 'N/A' ? deal.description : 'No description available.'}
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <span className="inline-flex items-center px-4 py-2 rounded-full bg-[#F6DF5F]/20 text-[#F6DF5F] text-xs font-bold border border-[#F6DF5F]/30">
                                                        Source: {deal.source}
                                                    </span>
                                                    {fitScore !== null && (
                                                        <span className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-bold border ${scoreBadgeClass(fitScore)}`}>
                                                            Fit: {fitScore}
                                                        </span>
                                                    )}
                                                    {deal.city && deal.city !== 'N/A' && (
                                                        <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 text-white/60 text-xs font-semibold border border-white/10">
                                                            📍 {deal.city}{deal.state && deal.state !== 'N/A' ? `, ${deal.state}` : ''}
                                                        </span>
                                                    )}
                                                    {deal.industry && deal.industry !== 'N/A' && (
                                                        <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 text-white/60 text-xs font-semibold border border-white/10">
                                                            {deal.industry}
                                                        </span>
                                                    )}
                                                    {(deal as any).similarity_score !== undefined && (
                                                        <span className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                                                            Match: {((deal as any).similarity_score * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col md:flex-row xl:flex-col md:items-center xl:items-end justify-between min-w-[240px] gap-6">
                                                <div className="flex gap-12">
                                                    <div className="text-left xl:text-right">
                                                        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Revenue</p>
                                                        <p className="text-white text-3xl font-bold">{formatMoney(deal.gross_revenue)}</p>
                                                    </div>
                                                    <div className="text-left xl:text-right">
                                                        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">EBITDA</p>
                                                        <p className="text-[#F6DF5F] text-3xl font-bold">{formatMoney(deal.ebitda)}</p>
                                                    </div>
                                                </div>
                                                {fitScore !== null && (
                                                    <div className="w-full xl:w-[220px] rounded-[20px] border border-white/10 bg-white/[0.06] px-4 py-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.22em]">AI Fit</p>
                                                            <p className={`text-base font-black ${scoreTextClass(fitScore)}`}>{fitScore}/100</p>
                                                        </div>
                                                        <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${scoreBarClass(fitScore)}`}
                                                                style={{ width: `${fitScore}%` }}
                                                            />
                                                        </div>
                                                        <p className="mt-2 text-[11px] font-medium text-white/55">{scoreLabel(fitScore)}</p>
                                                    </div>
                                                )}
                                                <Link href={`/deal/${deal.id}`} className="w-full xl:w-auto" onClick={() => persistDealFeedState()}>
                                                    <Button className="w-full xl:w-auto px-8 py-7 bg-white/10 hover:bg-[#F6DF5F] hover:text-[#414854] text-white font-bold rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-2 group/btn">
                                                        View Details
                                                        <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {searchMode === 'browse' && totalPages > 1 && (
                        <div className="flex items-center justify-center py-12 gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#414854] text-white hover:bg-[#F6DF5F] hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (page <= 3) {
                                    pageNum = i + 1;
                                } else if (page >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = page - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-12 h-12 flex items-center justify-center rounded-2xl font-bold shadow-md transition-all ${pageNum === page ? 'bg-[#F6DF5F] text-slate-900' : 'bg-[#414854] text-white hover:bg-[#F6DF5F] hover:text-slate-900'}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {totalPages > 5 && page < totalPages - 2 && (
                                <>
                                    <span className="text-slate-400 px-3 font-bold">...</span>
                                    <button
                                        onClick={() => setPage(totalPages)}
                                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#414854] text-white hover:bg-[#F6DF5F] hover:text-slate-900 transition-colors shadow-sm"
                                    >
                                        {totalPages}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page >= totalPages}
                                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#414854] text-white hover:bg-[#F6DF5F] hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
