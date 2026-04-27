'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Database,
  Loader2,
  Search,
  ShieldCheck,
  Target,
  Clock3,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PageShell from '@/components/PageShell';
import { useDealCache } from '@/components/DealCacheProvider';

/* ─── Types ─── */

interface LegacyStats {
  total_listings: number;
  by_source: Record<string, number>;
  new_this_week: number;
  distinct_industries: number;
}

interface LegacyListing {
  id: number;
  title: string;
  source: string;
  state: string;
  country: string;
  gross_revenue: string;
  ebitda: string;
  cash_flow: string;
  first_seen_date: string;
  industry?: string;
  ai_fit_score?: number | string | null;
  [key: string]: unknown;
}

interface DashboardSnapshot {
  total_listings: number;
  new_this_week: number;
  qualified_count: number;
  pass_rate: number | null;
  active_sources: number;
  distinct_industries: number;
}

interface FunnelStep {
  stage: string;
  count: number;
}

interface SourceYieldRow {
  source: string;
  total: number;
  qualified: number | null;
  qualified_rate: number | null;
}

interface PriorityDeal {
  id: number;
  title: string;
  source: string;
  state: string;
  country: string;
  gross_revenue: string | number | null;
  ebitda: string | number | null;
  cash_flow: string | number | null;
  first_seen_date?: string;
  fit_score: number | null;
  reasons: string[];
}

interface DashboardSLA {
  response_48h_rate: number | null;
  offer_5d_rate: number | null;
  close_60d_rate: number | null;
  in_pipeline: number | null;
}

interface DashboardDataQuality {
  parseable_revenue_pct: number | null;
  parseable_ebitda_pct: number | null;
  parseable_cash_flow_pct: number | null;
  parseable_location_pct: number | null;
}

interface DashboardOverview {
  generated_at: string | null;
  snapshot: DashboardSnapshot;
  criteria_funnel: FunnelStep[];
  source_yield: SourceYieldRow[];
  priority_queue: PriorityDeal[];
  sla: DashboardSLA;
  data_quality: DashboardDataQuality;
}

interface LegacyListingsResponse {
  total?: number;
  data?: LegacyListing[];
}

/* ─── Constants ─── */

const EMPTY_OVERVIEW: DashboardOverview = {
  generated_at: null,
  snapshot: {
    total_listings: 0,
    new_this_week: 0,
    qualified_count: 0,
    pass_rate: null,
    active_sources: 0,
    distinct_industries: 0,
  },
  criteria_funnel: [],
  source_yield: [],
  priority_queue: [],
  sla: { response_48h_rate: null, offer_5d_rate: null, close_60d_rate: null, in_pipeline: null },
  data_quality: { parseable_revenue_pct: null, parseable_ebitda_pct: null, parseable_cash_flow_pct: null, parseable_location_pct: null },
};

/* ─── Helpers ─── */

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableRate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = toNumber(value, Number.NaN);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return Math.min(1, n / 100);
  return n;
}

function toOptionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = toNumber(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

function toRecord(value: unknown): Partial<Record<string, unknown>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Partial<Record<string, unknown>>;
}

function parseMoneyToNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'n/a') return null;
  const cleaned = trimmed.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown): string {
  const num = parseMoneyToNumber(value);
  if (num === null) return 'N/A';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(0)}%`;
}

function toMoneyValue(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return null;
}

function isLocalDeal(country: string): boolean {
  const normalized = country.trim().toUpperCase();
  return normalized === 'US' || normalized === 'USA' || normalized === 'UNITED STATES' || normalized === 'CA' || normalized === 'CANADA';
}

function normalizeReasonLabel(reason: string): string {
  const normalized = reason.trim().toLowerCase();
  if (!normalized) return reason;
  if (normalized === 'cash flow fit') return 'Cash Flowing';
  if (normalized === 'margin fit') return 'Profitable';
  if (normalized === 'fresh') return 'New Inbound';
  return reason;
}

function normalizeReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((reason) => normalizeReasonLabel(reason)),
    ),
  );
}

function resolvePriorityDealFitScore(raw: Partial<Record<string, unknown>>): number | null {
  const evaluation = toRecord(raw.evaluation) ?? toRecord(raw.deal_evaluation);
  const score =
    toOptionalFiniteNumber(raw.fit_score) ??
    toOptionalFiniteNumber(raw.ai_fit_score) ??
    toOptionalFiniteNumber(evaluation?.fit_score);
  if (score === null) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreDeal(deal: PriorityDeal): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const revenue = parseMoneyToNumber(deal.gross_revenue);
  const ebitda = parseMoneyToNumber(deal.ebitda);
  const cashFlow = parseMoneyToNumber(deal.cash_flow);

  if (isLocalDeal(deal.country)) { score += 25; reasons.push('Local'); }
  if (cashFlow !== null && cashFlow >= 2_000_000) { score += 35; reasons.push('Cash Flowing'); }
  else if (cashFlow !== null && cashFlow >= 1_000_000) { score += 15; }
  if (ebitda !== null && revenue !== null && revenue > 0 && (ebitda / revenue) >= 0.1) { score += 25; reasons.push('Profitable'); }
  if (deal.first_seen_date) {
    const firstSeen = new Date(deal.first_seen_date);
    if (!Number.isNaN(firstSeen.getTime()) && Date.now() - firstSeen.getTime() <= 7 * 24 * 60 * 60 * 1000) {
      score += 8; reasons.push('New Inbound');
    }
  }
  if (!reasons.length) reasons.push('Needs Review');
  return { score: Math.min(100, score), reasons: Array.from(new Set(reasons)) };
}

function normalizePriorityDeal(row: unknown): PriorityDeal | null {
  if (!row || typeof row !== 'object') return null;
  const raw = row as Partial<Record<string, unknown>>;
  const id = toNumber(raw.id, 0);
  if (!id) return null;

  const deal: PriorityDeal = {
    id,
    title: typeof raw.title === 'string' ? raw.title : `Deal #${id}`,
    source: typeof raw.source === 'string' ? raw.source : 'Unknown',
    state: typeof raw.state === 'string' ? raw.state : '',
    country: typeof raw.country === 'string' ? raw.country : 'US',
    gross_revenue: toMoneyValue(raw.gross_revenue),
    ebitda: toMoneyValue(raw.ebitda),
    cash_flow: toMoneyValue(raw.cash_flow),
    first_seen_date: typeof raw.first_seen_date === 'string' ? raw.first_seen_date : undefined,
    fit_score: resolvePriorityDealFitScore(raw),
    reasons: normalizeReasons(raw.reasons),
  };

  if (deal.fit_score === null || deal.reasons.length === 0) {
    const scored = scoreDeal(deal);
    if (deal.fit_score === null) deal.fit_score = scored.score;
    deal.reasons = deal.reasons.length ? deal.reasons : scored.reasons;
  }
  return deal;
}

function normalizeOverview(payload: unknown): DashboardOverview {
  if (!payload || typeof payload !== 'object') return EMPTY_OVERVIEW;
  const raw = payload as Partial<Record<string, unknown>>;
  const snapshotRaw = raw.snapshot && typeof raw.snapshot === 'object'
    ? (raw.snapshot as Partial<Record<string, unknown>>) : {};
  const fallbackBySource = raw.by_source && typeof raw.by_source === 'object'
    ? (raw.by_source as Record<string, unknown>) : {};

  const snapshot: DashboardSnapshot = {
    total_listings: toNumber(snapshotRaw.total_listings ?? raw.total_listings),
    new_this_week: toNumber(snapshotRaw.new_this_week ?? raw.new_this_week),
    qualified_count: toNumber(snapshotRaw.qualified_count),
    pass_rate: toNullableRate(snapshotRaw.pass_rate ?? raw.pass_rate),
    active_sources: toNumber(snapshotRaw.active_sources, Object.keys(fallbackBySource).length),
    distinct_industries: toNumber(snapshotRaw.distinct_industries ?? raw.distinct_industries),
  };

  const funnelRaw = Array.isArray(raw.criteria_funnel) ? raw.criteria_funnel : [];
  const criteriaFunnel: FunnelStep[] = funnelRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Partial<Record<string, unknown>>;
      const stage = (typeof row.stage === 'string' && row.stage) || (typeof row.label === 'string' && row.label) || (typeof row.name === 'string' && row.name) || '';
      if (!stage) return null;
      return { stage, count: toNumber(row.count) };
    })
    .filter((item): item is FunnelStep => Boolean(item));

  const sourceYieldRaw = Array.isArray(raw.source_yield) ? raw.source_yield : [];
  const sourceYield: SourceYieldRow[] = sourceYieldRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Partial<Record<string, unknown>>;
      const source = typeof row.source === 'string' ? row.source : '';
      if (!source) return null;
      return {
        source,
        total: toNumber(row.total),
        qualified: row.qualified === null || row.qualified === undefined ? null : toNumber(row.qualified),
        qualified_rate: toNullableRate(row.qualified_rate),
      };
    })
    .filter((item): item is SourceYieldRow => Boolean(item));

  const priorityRaw = Array.isArray(raw.priority_queue) ? raw.priority_queue : Array.isArray(raw.recent_deals) ? raw.recent_deals : [];
  const priorityQueue = priorityRaw
    .map(normalizePriorityDeal)
    .filter((deal): deal is PriorityDeal => Boolean(deal))
    .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));

  const slaRaw = raw.sla && typeof raw.sla === 'object' ? (raw.sla as Partial<Record<string, unknown>>) : {};
  const sla: DashboardSLA = {
    response_48h_rate: toNullableRate(slaRaw.response_48h_rate),
    offer_5d_rate: toNullableRate(slaRaw.offer_5d_rate),
    close_60d_rate: toNullableRate(slaRaw.close_60d_rate),
    in_pipeline: slaRaw.in_pipeline === null || slaRaw.in_pipeline === undefined ? null : toNumber(slaRaw.in_pipeline),
  };

  const dqRaw = raw.data_quality && typeof raw.data_quality === 'object' ? (raw.data_quality as Partial<Record<string, unknown>>) : {};
  const dataQuality: DashboardDataQuality = {
    parseable_revenue_pct: toNullableRate(dqRaw.parseable_revenue_pct),
    parseable_ebitda_pct: toNullableRate(dqRaw.parseable_ebitda_pct),
    parseable_cash_flow_pct: toNullableRate(dqRaw.parseable_cash_flow_pct),
    parseable_location_pct: toNullableRate(dqRaw.parseable_location_pct),
  };

  return { generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : null, snapshot, criteria_funnel: criteriaFunnel, source_yield: sourceYield, priority_queue: priorityQueue, sla, data_quality: dataQuality };
}

async function fetchJsonSafe<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}

async function fetchLegacyOverview(): Promise<DashboardOverview> {
  const [statsPayload, listingsPayload] = await Promise.all([
    fetchJsonSafe<LegacyStats>('/api/stats'),
    fetchJsonSafe<LegacyListingsResponse>('/api/listings?per_page=100'),
  ]);

  if (!statsPayload && !listingsPayload) return { ...EMPTY_OVERVIEW, generated_at: new Date().toISOString() };
  const listings = Array.isArray(listingsPayload?.data) ? listingsPayload.data : [];

  const bySourceFromListings: Record<string, number> = {};
  const industries = new Set<string>();
  let newThisWeekFromListings = 0;
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const row of listings) {
    const source = typeof row.source === 'string' && row.source ? row.source : 'Unknown';
    bySourceFromListings[source] = (bySourceFromListings[source] || 0) + 1;
    if (typeof row.industry === 'string' && row.industry !== 'N/A' && row.industry.trim()) industries.add(row.industry.trim());
    if (typeof row.first_seen_date === 'string') {
      const firstSeen = new Date(row.first_seen_date);
      if (!Number.isNaN(firstSeen.getTime()) && now - firstSeen.getTime() <= oneWeekMs) newThisWeekFromListings += 1;
    }
  }

  const stats: LegacyStats = statsPayload ?? {
    total_listings: typeof listingsPayload?.total === 'number' ? listingsPayload.total : listings.length,
    by_source: bySourceFromListings,
    new_this_week: newThisWeekFromListings,
    distinct_industries: industries.size,
  };

  const normalizedDeals = listings.map((row) => normalizePriorityDeal(row)).filter((deal): deal is PriorityDeal => Boolean(deal));
  const scoredDeals = normalizedDeals.map((deal) => {
    const scored = scoreDeal(deal);
    return {
      ...deal,
      fit_score: deal.fit_score ?? scored.score,
      reasons: deal.reasons.length > 0 ? deal.reasons : scored.reasons,
    };
  }).sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));

  const localCount = scoredDeals.filter((d) => isLocalDeal(d.country)).length;
  const cashFlowFitCount = scoredDeals.filter((d) => { const cf = parseMoneyToNumber(d.cash_flow); return cf !== null && cf >= 2_000_000; }).length;
  const marginFitCount = scoredDeals.filter((d) => { const r = parseMoneyToNumber(d.gross_revenue); const e = parseMoneyToNumber(d.ebitda); return r !== null && r > 0 && e !== null && (e / r) >= 0.1; }).length;
  const shortlistCount = scoredDeals.filter((d) => { const r = parseMoneyToNumber(d.gross_revenue); const e = parseMoneyToNumber(d.ebitda); const cf = parseMoneyToNumber(d.cash_flow); return isLocalDeal(d.country) && cf !== null && cf >= 2_000_000 && r !== null && r > 0 && e !== null && (e / r) >= 0.1; }).length;

  const sourceYield: SourceYieldRow[] = Object.entries(stats.by_source || {}).map(([source, total]) => {
    const sourceDeals = scoredDeals.filter((d) => d.source === source);
    const qualified = sourceDeals.filter((d) => (d.fit_score ?? 0) >= 60).length;
    return { source, total, qualified: sourceDeals.length ? qualified : null, qualified_rate: sourceDeals.length ? qualified / sourceDeals.length : null };
  });

  const sampleTotal = scoredDeals.length || 1;
  const totalListings = stats.total_listings || scoredDeals.length;
  const qualifiedCount = shortlistCount;
  const passRate = totalListings > 0 ? qualifiedCount / totalListings : null;

  return {
    generated_at: new Date().toISOString(),
    snapshot: { total_listings: totalListings, new_this_week: stats.new_this_week || 0, qualified_count: qualifiedCount, pass_rate: passRate, active_sources: Object.keys(stats.by_source || {}).length, distinct_industries: stats.distinct_industries || 0 },
    criteria_funnel: [
      { stage: 'All Listings', count: totalListings },
      { stage: 'Local (US/CA)', count: localCount },
      { stage: 'Cash Flow Fit', count: cashFlowFitCount },
      { stage: 'Margin Fit', count: marginFitCount },
      { stage: 'Shortlist', count: qualifiedCount },
    ],
    source_yield: sourceYield.sort((a, b) => b.total - a.total),
    priority_queue: scoredDeals.slice(0, 12),
    sla: { response_48h_rate: null, offer_5d_rate: null, close_60d_rate: null, in_pipeline: null },
    data_quality: {
      parseable_revenue_pct: scoredDeals.filter((d) => parseMoneyToNumber(d.gross_revenue) !== null).length / sampleTotal,
      parseable_ebitda_pct: scoredDeals.filter((d) => parseMoneyToNumber(d.ebitda) !== null).length / sampleTotal,
      parseable_cash_flow_pct: scoredDeals.filter((d) => parseMoneyToNumber(d.cash_flow) !== null).length / sampleTotal,
      parseable_location_pct: scoredDeals.filter((d) => Boolean(d.state?.trim()) && Boolean(d.country?.trim())).length / sampleTotal,
    },
  };
}

/* ─── Display helpers ─── */

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-slate-100 text-slate-500 border-slate-200';
  if (score >= 80) return 'bg-[#F6DF5F]/20 text-slate-900 border-[#F6DF5F]/45';
  if (score >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function scoreBarColor(score: number | null): string {
  if (score === null) return '#CBD5E1';
  if (score >= 80) return '#F6DF5F';
  if (score >= 60) return '#F59E0B';
  return '#94A3B8';
}

const compactNumberFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
type ScoreBucketKey = 'strong' | 'watch' | 'review' | 'low';

function formatCompactNumber(value: number): string { return Number.isFinite(value) ? compactNumberFormatter.format(value) : '0'; }
function formatChartPercent(value: number | string): string { const n = typeof value === 'number' ? value : Number(value); return Number.isFinite(n) ? `${Math.round(n)}%` : '0%'; }
function shortenLabel(label: string, max = 16): string { return label.length <= max ? label : `${label.slice(0, max - 1)}…`; }

function funnelStageMeta(stage: string): { label: string } {
  const n = stage.trim().toLowerCase();
  if (n.includes('all')) return { label: 'Reviewed' };
  if (n.includes('local')) return { label: 'Local' };
  if (n.includes('cash')) return { label: 'Cash Flowing' };
  if (n.includes('margin') || n.includes('profit')) return { label: 'Profitable' };
  if (n.includes('short') || n.includes('qualif')) return { label: 'Durable Fit' };
  return { label: stage };
}

function scoreBucketKey(score: number | null): ScoreBucketKey {
  if (score === null) return 'review';
  if (score >= 80) return 'strong';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'review';
  return 'low';
}

function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => String(v) }: {
  active?: boolean; payload?: Array<{ name?: string; value?: string | number; color?: string }>; label?: string;
  labelFormatter?: (value?: string) => string; valueFormatter?: (value: string | number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((e): e is { name?: string; value: string | number; color?: string } => e.value !== undefined && e.value !== null);
  if (!visible.length) return null;
  return (
    <div className="min-w-[160px] rounded-2xl border border-white/10 bg-[#2F3640]/95 p-3 shadow-2xl backdrop-blur">
      {label && <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{labelFormatter ? labelFormatter(label) : label}</p>}
      <div className="mt-1.5 space-y-1.5">
        {visible.map((entry, i) => (
          <div key={`${entry.name ?? 'v'}-${i}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-white/75">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || '#F6DF5F' }} />
              {entry.name}
            </span>
            <span className="text-xs font-semibold text-white">{valueFormatter(entry.value, entry.name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   DASHBOARD COMPONENT
   ════════════════════════════════════════════ */

export default function Dashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<DashboardOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'overview' | 'legacy'>('overview');
  const [sourceChartMode, setSourceChartMode] = useState<'volume' | 'yield'>('volume');
  const [selectedFunnelIndex, setSelectedFunnelIndex] = useState(0);
  const [selectedScoreIndex, setSelectedScoreIndex] = useState(0);
  const [hasTouchedScoreMix, setHasTouchedScoreMix] = useState(false);
  const cache = useDealCache();

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/overview');
      if (!res.ok) throw new Error(`Overview endpoint failed: ${res.status}`);
      const data = normalizeOverview(await res.json());
      setOverview(data); setMode('overview');
      cache.setCachedStats({ stats: data, recentDeals: data.priority_queue });
    } catch {
      const fallback = await fetchLegacyOverview();
      setOverview(fallback); setMode('legacy');
      cache.setCachedStats({ stats: fallback, recentDeals: fallback.priority_queue });
    } finally { setLoading(false); }
  }, [cache]);

  useEffect(() => {
    const cached = cache.getCachedStats();
    if (cached?.stats && typeof cached.stats === 'object' && 'snapshot' in cached.stats) {
      setOverview(normalizeOverview(cached.stats));
      setMode('overview'); setLoading(false); return;
    }
    loadOverview().catch(() => setLoading(false));
  }, [cache, loadOverview]);

  /* ── Derived Data ── */

  const mandateFacts = [
    { label: 'Reviewed', value: overview.snapshot.total_listings.toLocaleString(), icon: Database },
    { label: 'Durable Fits', value: overview.snapshot.qualified_count.toLocaleString(), icon: Target },
    { label: '7-Day Inflow', value: overview.snapshot.new_this_week.toLocaleString(), icon: Clock3 },
    { label: 'Durability Rate', value: formatPercent(overview.snapshot.pass_rate), icon: ShieldCheck },
  ];

  const funnelBase = overview.criteria_funnel[0]?.count || 0;
  const funnelChartData = overview.criteria_funnel.map((step, i) => {
    const prev = i === 0 ? step.count : overview.criteria_funnel[i - 1]?.count ?? step.count;
    const meta = funnelStageMeta(step.stage);
    return {
      stage: step.stage, displayStage: meta.label, shortStage: shortenLabel(meta.label, 12),
      count: step.count,
      retention: funnelBase > 0 ? Number(((step.count / funnelBase) * 100).toFixed(1)) : 0,
      dropOff: i === 0 ? 0 : Math.max(prev - step.count, 0),
    };
  });

  const sourceChartData = [...overview.source_yield]
    .sort((a, b) => sourceChartMode === 'yield' ? (b.qualified_rate ?? 0) - (a.qualified_rate ?? 0) : b.total - a.total)
    .slice(0, 6)
    .map((row) => ({ source: row.source, label: shortenLabel(row.source, 15), total: row.total, qualified: row.qualified ?? 0, rate: Number(((row.qualified_rate ?? 0) * 100).toFixed(1)) }));

  const scoreMix = [
    { key: 'strong' as const, label: '80+ Core Fit', shortLabel: 'Core Fit', value: overview.priority_queue.filter((d) => scoreBucketKey(d.fit_score) === 'strong').length, fill: '#F6DF5F' },
    { key: 'watch' as const, label: '60-79 Watchlist', shortLabel: 'Watchlist', value: overview.priority_queue.filter((d) => scoreBucketKey(d.fit_score) === 'watch').length, fill: '#D8C66F' },
    { key: 'review' as const, label: '40-59 Exceptions', shortLabel: 'Exceptions', value: overview.priority_queue.filter((d) => scoreBucketKey(d.fit_score) === 'review').length, fill: '#8D98AA' },
    { key: 'low' as const, label: '<40 Low Fit', shortLabel: 'Low Fit', value: overview.priority_queue.filter((d) => scoreBucketKey(d.fit_score) === 'low').length, fill: '#5C6675' },
  ];

  const defaultScoreIndex = scoreMix.findIndex((b) => b.value > 0);
  useEffect(() => { if (!hasTouchedScoreMix && defaultScoreIndex >= 0) setSelectedScoreIndex(defaultScoreIndex); }, [defaultScoreIndex, hasTouchedScoreMix]);

  const activeScoreBucket = scoreMix[selectedScoreIndex] ?? scoreMix[defaultScoreIndex >= 0 ? defaultScoreIndex : 0] ?? scoreMix[0];
  const activeScoreDeals = overview.priority_queue.filter((d) => scoreBucketKey(d.fit_score) === activeScoreBucket.key).slice(0, 4);

  const topPriorityDeal = overview.priority_queue[0] ?? null;
  const queueCoverage = overview.snapshot.total_listings > 0 ? Math.round((overview.priority_queue.length / overview.snapshot.total_listings) * 100) : 0;

  const qualityMetrics = [
    { label: 'Revenue', value: overview.data_quality.parseable_revenue_pct },
    { label: 'EBITDA', value: overview.data_quality.parseable_ebitda_pct },
    { label: 'Cash Flow', value: overview.data_quality.parseable_cash_flow_pct },
    { label: 'Location', value: overview.data_quality.parseable_location_pct },
  ];

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
      <div className="space-y-5">

        {/* ─── Hero Strip ─── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e222a] via-[#272c36] to-[#2e343f] p-5 md:p-6 shadow-lg border border-white/[0.04]">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #F6DF5F 0.8px, transparent 0.8px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-[#F6DF5F]/[0.04] blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">Sourcing Dashboard</p>
              <h1 className="mt-1 text-xl md:text-2xl font-extrabold text-white tracking-tight">
                Tucker&apos;s Farm — Acquisition Queue
              </h1>
            </div>

            {/* Search */}
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <Input
                type="text" placeholder="Search deals..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) router.push(`/deal?q=${encodeURIComponent(searchQuery.trim())}`); }}
                className="h-10 rounded-xl border-white/10 bg-white/[0.07] pl-10 pr-4 text-xs text-white placeholder:text-white/30 shadow-none focus-visible:ring-1 focus-visible:ring-[#F6DF5F]"
              />
            </div>
          </div>
        </div>

        {/* ─── KPI Strip ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {mandateFacts.map((fact) => {
            const Icon = fact.icon;
            return (
              <div key={fact.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{fact.label}</p>
                  <Icon size={14} className="text-slate-300" />
                </div>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{fact.value}</p>
              </div>
            );
          })}
        </div>

        {/* ─── Row: Funnel + Fit Mix ─── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Pipeline Funnel */}
          <div className="col-span-12 xl:col-span-7 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="p-5 pb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Pipeline Funnel</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">How the queue narrows at each filter stage</h2>
            </div>
            <div className="bg-[#414854] mx-3 mb-3 rounded-xl p-3">
              {funnelChartData.length === 0 ? (
                <div className="py-12 text-xs text-white/50 text-center">No funnel data yet.</div>
              ) : (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={funnelChartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
                        onMouseMove={(state) => { if (typeof state.activeTooltipIndex === 'number') setSelectedFunnelIndex(state.activeTooltipIndex); }}
                      >
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="shortStage" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={(v: number) => formatCompactNumber(v)} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={(v: number) => formatChartPercent(v)} />
                        <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                          content={<ChartTooltip
                            labelFormatter={(v) => funnelChartData.find((i) => i.shortStage === v)?.displayStage ?? v ?? ''}
                            valueFormatter={(v, n) => n === 'Retention' ? formatChartPercent(v) : typeof v === 'number' ? formatCompactNumber(v) : String(v)}
                          />}
                        />
                        <Bar yAxisId="left" dataKey="count" name="Listings" fill="rgba(255,255,255,0.14)" radius={[8, 8, 0, 0]} barSize={24} />
                        <Line yAxisId="right" type="monotone" dataKey="retention" name="Retention" stroke="#F6DF5F" strokeWidth={2.5}
                          dot={{ r: 3, fill: '#F6DF5F', stroke: '#414854', strokeWidth: 2 }}
                          activeDot={{ r: 5, fill: '#F6DF5F', stroke: '#FFF', strokeWidth: 2 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {funnelChartData.map((step, i) => (
                      <button key={step.displayStage} type="button"
                        onMouseEnter={() => setSelectedFunnelIndex(i)} onFocus={() => setSelectedFunnelIndex(i)}
                        className={`rounded-lg px-2 py-2 text-left transition text-[10px] ${selectedFunnelIndex === i ? 'bg-[#F6DF5F]/12 border border-[#F6DF5F]/30 text-white' : 'bg-white/[0.04] border border-transparent text-white/60 hover:bg-white/[0.06]'}`}
                      >
                        <p className="font-bold">{formatChartPercent(step.retention)}</p>
                        <p className="text-white/40 mt-0.5">{step.count.toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fit Mix (Donut) */}
          <div className="col-span-12 xl:col-span-5 rounded-2xl bg-[#414854] p-5 shadow-lg text-white">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Fit Distribution</p>
            <h2 className="mt-1 text-base font-bold text-white">Score mix across the queue</h2>

            {overview.priority_queue.length === 0 ? (
              <div className="py-12 text-xs text-white/50 text-center">No deals scored yet.</div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-[160px_minmax(0,1fr)] items-center gap-3">
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip content={<ChartTooltip valueFormatter={(v) => typeof v === 'number' ? `${v} deals` : String(v)} />} />
                        <Pie data={scoreMix} dataKey="value" nameKey="label" innerRadius={42} outerRadius={68} paddingAngle={4}
                          onMouseEnter={(_: unknown, i: number) => { setHasTouchedScoreMix(true); setSelectedScoreIndex(i); }}
                          onClick={(_: unknown, i: number) => { setHasTouchedScoreMix(true); setSelectedScoreIndex(i); }}
                        >
                          {scoreMix.map((b, i) => (
                            <Cell key={b.key} fill={b.fill} opacity={selectedScoreIndex === i ? 1 : 0.5}
                              stroke={selectedScoreIndex === i ? '#FFF' : 'transparent'} strokeWidth={selectedScoreIndex === i ? 2 : 0} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-bold text-white/80">{activeScoreBucket.label}</p>
                      <p className="text-2xl font-extrabold text-white">{activeScoreBucket.value} <span className="text-sm font-semibold text-white/40">deals</span></p>
                    </div>
                    {activeScoreDeals.slice(0, 2).map((deal) => (
                      <button key={deal.id} type="button" onClick={() => router.push(`/deal/${deal.id}`)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2 text-left hover:bg-white/[0.08] transition"
                      >
                        <p className="text-[11px] font-semibold text-white truncate">{deal.title}</p>
                        <span className="text-[11px] font-bold text-[#F6DF5F] flex-shrink-0">{deal.fit_score ?? '—'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {scoreMix.map((b, i) => (
                    <button key={b.key} type="button"
                      onClick={() => { setHasTouchedScoreMix(true); setSelectedScoreIndex(i); }}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[10px] transition ${selectedScoreIndex === i ? 'bg-[#F6DF5F]/12 border border-[#F6DF5F]/30 text-white' : 'bg-white/[0.04] border border-transparent text-white/60 hover:bg-white/[0.06]'}`}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.fill }} />{b.shortLabel}
                      </span>
                      <span className="font-bold">{b.value}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── Row: Channel Quality + Data Quality ─── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Channel Quality */}
          <div className="col-span-12 xl:col-span-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Channel Quality</p>
                <h2 className="mt-1 text-base font-bold text-slate-900">Source performance breakdown</h2>
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
                <button type="button" onClick={() => setSourceChartMode('volume')}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${sourceChartMode === 'volume' ? 'bg-[#414854] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >Volume</button>
                <button type="button" onClick={() => setSourceChartMode('yield')}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${sourceChartMode === 'yield' ? 'bg-[#F6DF5F] text-[#414854] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >Yield</button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              {sourceChartData.length === 0 ? (
                <div className="py-12 text-xs text-slate-400 text-center">No source data yet.</div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceChartData} layout="vertical" margin={{ top: 6, right: 12, left: 16, bottom: 4 }} barCategoryGap={14}>
                      <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }}
                        tickFormatter={(v: number) => sourceChartMode === 'yield' ? formatChartPercent(v) : formatCompactNumber(v)} />
                      <YAxis type="category" dataKey="label" width={80} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                      <RechartsTooltip cursor={{ fill: 'rgba(65,72,84,0.04)' }}
                        content={<ChartTooltip
                          labelFormatter={(v) => sourceChartData.find((r) => r.label === v)?.source ?? v ?? ''}
                          valueFormatter={(v, n) => n === 'Qualified Rate' ? formatChartPercent(v) : typeof v === 'number' ? formatCompactNumber(v) : String(v)}
                        />}
                      />
                      {sourceChartMode === 'volume' ? (
                        <>
                          <Bar dataKey="total" name="Total Listings" fill="rgba(65,72,84,0.14)" radius={[0, 8, 8, 0]} barSize={14} />
                          <Bar dataKey="qualified" name="Qualified" fill="#414854" radius={[0, 8, 8, 0]} barSize={14} />
                        </>
                      ) : (
                        <Bar dataKey="rate" name="Qualified Rate" fill="#F6DF5F" radius={[0, 8, 8, 0]} barSize={14} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Data Quality */}
          <div className="col-span-12 xl:col-span-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Data Quality</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">Underwriting hygiene</h2>
            <div className="mt-4 space-y-3">
              {qualityMetrics.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-600">{m.label}</span>
                    <span className="text-[11px] font-bold text-slate-900">{formatPercent(m.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#414854] transition-all" style={{ width: `${m.value !== null && Number.isFinite(m.value) ? Math.round(m.value * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Priority Queue Table ─── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Priority Queue</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">Top deals ranked by fit score</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                <span>{overview.snapshot.qualified_count} shortlisted</span>
                <span>•</span>
                <span>{queueCoverage}% coverage</span>
                <span>•</span>
                <span>Best: {topPriorityDeal?.fit_score ?? '—'}</span>
              </div>
              <Button asChild className="rounded-lg border-0 bg-[#414854] px-4 py-2 text-xs font-bold text-white hover:bg-[#363c45]">
                <Link href="/deal">All Deals <ChevronRight size={14} /></Link>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-b border-slate-100 hover:bg-transparent">
                  <TableHead className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Deal</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Fit</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Flow</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">EBITDA</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Revenue</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.priority_queue.length === 0 ? (
                  <TableRow className="border-b-0">
                    <TableCell colSpan={6} className="py-12 text-center text-slate-400 text-sm">No prioritized deals yet.</TableCell>
                  </TableRow>
                ) : (
                  overview.priority_queue.map((deal) => (
                    <TableRow key={deal.id}
                      className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/80"
                      onClick={() => router.push(`/deal/${deal.id}`)}
                    >
                      <TableCell className="max-w-[280px] px-5 py-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{deal.title}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {deal.source}{deal.state ? ` • ${deal.state}` : ''}{deal.country ? ` • ${deal.country}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Badge className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${scoreColor(deal.fit_score)}`}>
                            {deal.fit_score === null ? 'N/A' : deal.fit_score}
                          </Badge>
                          <div className="h-1 w-12 rounded-full bg-slate-100">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, deal.fit_score ?? 0))}%`, backgroundColor: scoreBarColor(deal.fit_score) }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-sm text-slate-700 font-medium">{formatMoney(deal.cash_flow)}</TableCell>
                      <TableCell className="px-5 py-3 text-sm text-slate-700 font-medium">{formatMoney(deal.ebitda)}</TableCell>
                      <TableCell className="px-5 py-3 text-sm text-slate-700 font-medium">{formatMoney(deal.gross_revenue)}</TableCell>
                      <TableCell className="px-5 py-3">{
                        <div className="flex flex-wrap gap-1">
                          {deal.reasons.slice(0, 3).map((r) => (
                            <span key={r} className="rounded-full bg-slate-50 border border-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{r}</span>
                          ))}
                        </div>
                      }</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>
    </PageShell>
  );
}
