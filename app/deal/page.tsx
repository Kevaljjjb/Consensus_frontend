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

function makeCacheKey(page: number, source: string, industry: string) {
    return `browse:${page}:${source}:${industry}`;
}

export default function DealPage() {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'browse' | 'search'>('browse');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [sourceFilter, setSourceFilter] = useState<string>('');
    const [industryFilter, setIndustryFilter] = useState<string>('');

    const cache = useDealCache();
    const initialMount = useRef(true);

    const fetchListings = useCallback(async () => {
        const key = makeCacheKey(page, sourceFilter, industryFilter);

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
            if (sourceFilter) params.set('source', sourceFilter);
            if (industryFilter) params.set('industry', industryFilter);

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
    }, [page, sourceFilter, industryFilter, cache]);

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchMode('browse');
            return;
        }

        const key = `search:${query.trim().toLowerCase()}`;
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
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
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
    }, [cache]);

    useEffect(() => {
        if (searchMode === 'browse') {
            fetchListings();
        }
    }, [fetchListings, searchMode]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                performSearch(searchQuery);
            } else {
                setSearchMode('browse');
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, performSearch]);

    const formatMoney = (val: string) => {
        if (!val || val === 'N/A') return 'N/A';
        const num = parseFloat(val.replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return val;
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
                                onClick={() => { setSourceFilter(''); setIndustryFilter(''); setPage(1); }}
                                className="text-[#F6DF5F] text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
                            >
                                Reset
                            </button>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <label className="block text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Source</label>
                                <div className="relative">
                                    <select
                                        value={sourceFilter}
                                        onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
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
                                    value={industryFilter}
                                    onChange={(e) => { setIndustryFilter(e.target.value); setPage(1); }}
                                    placeholder="e.g. Construction"
                                    className="bg-white/10 border-white/10 text-white rounded-xl w-full py-3 px-4 text-sm placeholder-white/30 focus:bg-white/20 transition-all border-0"
                                />
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <div className="col-span-12 lg:col-span-9 space-y-6">
                    {/* Active filters */}
                    {(sourceFilter || industryFilter) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {sourceFilter && (
                                <Badge className="bg-[#F6DF5F]/10 border border-[#F6DF5F]/20 text-slate-800 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all">
                                    {sourceFilter} <X size={14} className="cursor-pointer hover:text-red-500" onClick={() => setSourceFilter('')} />
                                </Badge>
                            )}
                            {industryFilter && (
                                <Badge className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-full text-sm font-semibold text-slate-600 flex items-center gap-2 hover:bg-slate-200 transition-all">
                                    {industryFilter} <X size={14} className="cursor-pointer" onClick={() => setIndustryFilter('')} />
                                </Badge>
                            )}
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
                            {listings.map((deal) => (
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
                                            <Link href={`/deal/${deal.id}`} className="w-full xl:w-auto">
                                                <Button className="w-full xl:w-auto px-8 py-7 bg-white/10 hover:bg-[#F6DF5F] hover:text-[#414854] text-white font-bold rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-2 group/btn">
                                                    View Details
                                                    <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
