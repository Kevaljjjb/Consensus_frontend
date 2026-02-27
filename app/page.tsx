'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MoreHorizontal,
  TrendingUp,
  Activity,
  X,
  Filter,
  ChevronDown,
  Plus,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from 'motion/react';
import PageShell from '@/components/PageShell';
import Link from 'next/link';
import { useDealCache } from '@/components/DealCacheProvider';

interface Stats {
  total_listings: number;
  by_source: Record<string, number>;
  new_this_week: number;
  distinct_industries: number;
  top_industries: { industry: string; count: number }[];
}

interface Listing {
  id: number;
  title: string;
  source: string;
  ebitda: string;
  gross_revenue: string;
  cash_flow: string;
  [key: string]: any;
}

const formatMoney = (val: string) => {
  if (!val || val === 'N/A') return 'N/A';
  const num = parseFloat(val.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return val;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDeals, setRecentDeals] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const cache = useDealCache();

  useEffect(() => {
    // Check cache first
    const cached = cache.getCachedStats();
    if (cached) {
      setStats(cached.stats);
      setRecentDeals(cached.recentDeals);
      setLoading(false);
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        const [statsRes, dealsRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/listings?per_page=6&sort_by=last_seen_date&sort_order=desc'),
        ]);
        const statsData = await statsRes.json();
        const dealsData = await dealsRes.json();
        setStats(statsData);
        setRecentDeals(dealsData.data || []);
        cache.setCachedStats({ stats: statsData, recentDeals: dealsData.data || [] });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [cache]);

  // Generate sparkline data from source counts
  const sourceEntries = stats ? Object.entries(stats.by_source) : [];
  const dealFlowData = sourceEntries.map(([, count]) => ({ value: count }));
  const industryData = stats?.top_industries?.map(i => ({ value: i.count })) || [];

  if (loading) {
    return (
      <PageShell activePage="dashboard">
        <div className="flex items-center justify-center py-32">
          <Loader2 size={48} className="animate-spin text-[#F6DF5F]" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell activePage="dashboard">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            type="text"
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                window.location.href = `/deal?q=${encodeURIComponent(searchQuery)}`;
              }
            }}
            className="pl-11 pr-4 py-6 rounded-[20px] border-slate-200 bg-slate-50 focus-visible:ring-[#F6DF5F] focus-visible:ring-2 w-80 text-sm shadow-sm"
          />
        </div>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card className="bg-[#414854] border-0 rounded-[24px] relative overflow-hidden border-b-[6px] border-b-[#F6DF5F] shadow-lg shadow-slate-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
            <CardTitle className="text-slate-300 text-sm font-medium">Total Listings</CardTitle>
            <button className="text-slate-400 hover:text-white bg-white/5 rounded-md p-1 transition-colors"><MoreHorizontal size={16} /></button>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">{stats?.total_listings ?? 0}</span>
              <span className="text-slate-300 text-sm font-medium">deals</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#414854] border-0 rounded-[24px] relative overflow-hidden border-b-[6px] border-b-[#F6DF5F] shadow-lg shadow-slate-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
            <CardTitle className="text-slate-300 text-sm font-medium">New This Week</CardTitle>
            <button className="text-slate-400 hover:text-white bg-white/5 rounded-md p-1 transition-colors"><MoreHorizontal size={16} /></button>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">{stats?.new_this_week ?? 0}</span>
              <span className="text-slate-300 text-sm font-medium">Weekly</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#414854] border-0 rounded-[24px] relative overflow-hidden border-b-[6px] border-b-[#F6DF5F] shadow-lg shadow-slate-200/50 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-0 pt-6 px-6">
            <CardTitle className="text-slate-300 text-sm font-medium">Sources</CardTitle>
            <TrendingUp size={18} className="text-[#F6DF5F]" />
          </CardHeader>
          <CardContent className="px-6 pb-4 mt-2 flex flex-wrap gap-2">
            {sourceEntries.map(([name, count]) => (
              <span key={name} className="text-xs bg-white/10 text-white/80 px-3 py-1 rounded-full">
                {name}: {count}
              </span>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[#414854] border-0 rounded-[24px] relative overflow-hidden border-b-[6px] border-b-[#F6DF5F] shadow-lg shadow-slate-200/50 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-0 pt-6 px-6">
            <CardTitle className="text-slate-300 text-sm font-medium">Industries</CardTitle>
            <Activity size={18} className="text-[#F6DF5F]" />
          </CardHeader>
          <CardContent className="px-6 pb-4 mt-2">
            <span className="text-3xl font-bold text-white tracking-tight">{stats?.distinct_industries ?? 0}</span>
            <span className="text-slate-300 text-sm font-medium ml-2">unique</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <div className="bg-[#414854] relative rounded-[32px] p-2 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-1/2 h-full bg-[#F6DF5F]/10 blur-[100px] pointer-events-none" />

        <div className="flex justify-between items-center p-6 pb-4 relative z-10">
          <h2 className="text-xl font-semibold text-white">Recent Listings</h2>
          <Link href="/deal/upload">
            <Button className="flex items-center gap-2 px-5 py-6 bg-[#F6DF5F] text-[#414854] rounded-2xl font-semibold hover:bg-[#e5ce50] transition-colors shadow-sm border-0">
              <Plus size={18} /> Add Deal
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto relative rounded-[24px] mx-2 mb-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
          <Table>
            <TableHeader className="bg-white/10 backdrop-blur-3xl border-b border-white/10 sticky top-0 z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-slate-200 font-medium py-5 px-6 rounded-tl-[24px] border-r border-white/5">Deal</TableHead>
                <TableHead className="text-slate-200 font-medium py-5 px-6 border-r border-white/5">EBITDA</TableHead>
                <TableHead className="text-slate-200 font-medium py-5 px-6 border-r border-white/5">Revenue</TableHead>
                <TableHead className="text-slate-200 font-medium py-5 px-6 border-r border-white/5">Source</TableHead>
                <TableHead className="text-slate-200 font-medium py-5 px-6 rounded-tr-[24px]">Cash Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-white relative">
              {recentDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-white/50">
                    No listings yet. Run the scraper or upload deals to get started.
                  </TableCell>
                </TableRow>
              ) : (
                recentDeals.map((row, i) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/[0.12] hover:backdrop-blur-3xl cursor-pointer transition-all duration-300 group"
                    onClick={() => window.location.href = `/deal/${row.id}`}
                  >
                    <TableCell className="py-5 px-6 font-medium border-r border-white/5 bg-white/[0.01] group-hover:bg-white/[0.05] transition-colors max-w-[300px] truncate">
                      {row.title}
                    </TableCell>
                    <TableCell className="py-5 px-6 border-r border-white/5 group-hover:bg-white/[0.05] transition-colors">{formatMoney(row.ebitda)}</TableCell>
                    <TableCell className="py-5 px-6 border-r border-white/5 bg-white/[0.01] group-hover:bg-white/[0.05] transition-colors">{formatMoney(row.gross_revenue)}</TableCell>
                    <TableCell className="py-5 px-6 border-r border-white/5 group-hover:bg-white/[0.05] transition-colors">{row.source}</TableCell>
                    <TableCell className="py-5 px-6 bg-white/[0.01] group-hover:bg-white/[0.05] transition-colors">{formatMoney(row.cash_flow)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageShell>
  );
}
