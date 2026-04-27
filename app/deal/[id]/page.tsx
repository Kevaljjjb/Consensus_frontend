'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import {
    ArrowLeft,
    MapPin,
    Calendar,
    Users,
    Building2,
    Briefcase,
    DollarSign,
    TrendingUp,
    ExternalLink,
    Mail,
    Phone,
    Clock,
    CheckCircle2,
    Loader2,
    RefreshCw,
    Sparkles,
    Target,
    CheckCircle,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Brain,
    BarChart3,
    Shield,
    Zap,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import PageShell from '@/components/PageShell';
import DealChatBox from '@/components/DealChatBox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDealCache } from '@/components/DealCacheProvider';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    Radar,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

interface Listing {
    id: number;
    title: string;
    city: string;
    state: string;
    country: string;
    industry: string;
    source: string;
    price: string;
    gross_revenue: string;
    ebitda: string;
    cash_flow: string;
    inventory: string;
    description: string;
    listed_by_firm: string;
    listed_by_name: string;
    email: string;
    phone: string;
    source_link: string;
    extra_information: string;
    deal_date: string;
    scraping_date: string;
    first_seen_date: string;
    last_seen_date: string;
    [key: string]: any;
}

interface ScoreBreakdown {
    cash_flow: number;
    profitability: number;
    maturity: number;
    locality: number;
    stability: number;
}

interface DealEvaluation {
    fit_score: number;
    score_breakdown: ScoreBreakdown;
    pros: string[];
    cons: string[];
    summary: string;
    model_used: string;
    evaluated_at: string;
    cached: boolean;
}

const formatMoney = (val: string) => {
    if (!val || val === 'N/A') return 'N/A';
    const num = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return val;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
};

function scoreColor(score: number): string {
    if (score >= 80) return '#F6DF5F';
    if (score >= 60) return '#F59E0B';
    return '#94A3B8';
}

function scoreBgClass(score: number): string {
    if (score >= 80) return 'bg-[#F6DF5F]/10 border-[#F6DF5F]/30';
    if (score >= 60) return 'bg-amber-50 border-amber-200';
    return 'bg-slate-50 border-slate-200';
}

function scoreLabel(score: number): string {
    if (score >= 80) return 'Strong Fit';
    if (score >= 60) return 'Watch';
    if (score >= 40) return 'Needs Review';
    return 'Low Fit';
}

function scoreNarrative(score: number): string {
    if (score >= 80) {
        return 'This listing sits close to the core Tucker mandate and should be easy to prioritize.';
    }
    if (score >= 60) {
        return 'The opportunity is directionally attractive, but at least one core underwriting area needs confirmation.';
    }
    if (score >= 40) {
        return 'The business has a few fit signals, but the listing still leaves meaningful gaps or exceptions.';
    }
    return 'This is currently outside the default mandate or too incomplete to underwrite with confidence.';
}

const BREAKDOWN_CONFIG: { key: keyof ScoreBreakdown; label: string; max: number; icon: any }[] = [
    { key: 'cash_flow', label: 'Cash Flow', max: 25, icon: DollarSign },
    { key: 'profitability', label: 'Profitability', max: 25, icon: TrendingUp },
    { key: 'maturity', label: 'Maturity', max: 20, icon: Shield },
    { key: 'locality', label: 'Locality', max: 15, icon: MapPin },
    { key: 'stability', label: 'Stability', max: 15, icon: Zap },
];

/* ─── Radial Score Gauge ─── */
function RadialGauge({ score, animated }: { score: number; animated: boolean }) {
    const radius = 54;
    const stroke = 7;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const color = scoreColor(score);

    return (
        <div className="relative w-[140px] h-[140px] mx-auto">
            <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                <circle
                    cx="64" cy="64" r={radius}
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
                />
                <motion.circle
                    cx="64" cy="64" r={radius}
                    fill="none" stroke={color} strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: animated ? circumference : circumference - progress }}
                    animate={{ strokeDashoffset: circumference - progress }}
                    transition={{ duration: animated ? 1.2 : 0, ease: 'easeOut', delay: 0.3 }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    className="text-3xl font-black tracking-tight text-white"
                    initial={animated ? { opacity: 0, scale: 0.5 } : {}}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    {score}
                </motion.span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">/100</span>
            </div>
        </div>
    );
}

/* ─── Interactive Radar Chart ─── */
function BreakdownRadar({ breakdown, animated }: { breakdown: ScoreBreakdown; animated: boolean }) {
    const data = BREAKDOWN_CONFIG.map(item => ({
        subject: item.label,
        value: Math.round((breakdown[item.key] / item.max) * 100),
        fullMark: 100,
        raw: breakdown[item.key],
        max: item.max,
    }));

    return (
        <motion.div
            initial={animated ? { opacity: 0, scale: 0.8 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full h-[220px]"
        >
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}
                    />
                    <Radar
                        name="Score"
                        dataKey="value"
                        stroke="#F6DF5F"
                        fill="#F6DF5F"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#F6DF5F', strokeWidth: 0 }}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'rgba(30,34,42,0.95)',
                            border: '1px solid rgba(246,223,95,0.2)',
                            borderRadius: '12px',
                            padding: '8px 14px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        }}
                        itemStyle={{ color: '#F6DF5F', fontSize: '12px', fontWeight: 700 }}
                        labelStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600 }}
                        formatter={((value: number, _name: string, props: any) => [
                            `${props.payload.raw}/${props.payload.max} pts (${value}%)`,
                            props.payload.subject,
                        ]) as any}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </motion.div>
    );
}

/* ─── Score Breakdown Bars (compact) ─── */
function CompactBreakdown({ breakdown, animated }: { breakdown: ScoreBreakdown; animated: boolean }) {
    return (
        <div className="space-y-2.5">
            {BREAKDOWN_CONFIG.map((item, idx) => {
                const value = breakdown[item.key];
                const pct = (value / item.max) * 100;
                const Icon = item.icon;
                return (
                    <motion.div
                        key={item.key}
                        initial={animated ? { opacity: 0, x: -15 } : {}}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: animated ? 0.5 + idx * 0.08 : 0 }}
                        className="group"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <Icon size={12} className="text-white/30" />
                                <span className="text-[11px] font-semibold text-white/60">{item.label}</span>
                            </div>
                            <span className="text-[11px] font-bold text-white/80">{value}/{item.max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{
                                    background: pct >= 75
                                        ? 'linear-gradient(90deg, #F6DF5F, #FBBF24)'
                                        : pct >= 50
                                            ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                                            : 'linear-gradient(90deg, #94A3B8, #64748B)',
                                }}
                                initial={animated ? { width: 0 } : { width: `${pct}%` }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: animated ? 0.8 : 0, delay: animated ? 0.6 + idx * 0.08 : 0, ease: 'easeOut' }}
                            />
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}

/* ─── AI Loading Pulse ─── */
function AiLoadingPulse() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12 gap-5"
        >
            <div className="relative">
                <motion.div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F6DF5F]/20 to-[#F59E0B]/10 flex items-center justify-center"
                    animate={{
                        scale: [1, 1.05, 1],
                        rotate: [0, 3, -3, 0],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <Brain size={28} className="text-[#F6DF5F]" />
                </motion.div>
                {[0, 1, 2].map(i => (
                    <motion.div
                        key={i}
                        className="absolute inset-0 rounded-2xl border border-[#F6DF5F]/20"
                        animate={{
                            scale: [1, 1.8],
                            opacity: [0.4, 0],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.5,
                            ease: 'easeOut',
                        }}
                    />
                ))}
            </div>
            <div className="text-center space-y-1.5">
                <p className="text-sm font-bold text-slate-700">Analyzing this deal…</p>
                <p className="text-xs text-slate-400">AI is evaluating cash flow, profitability, maturity & more</p>
            </div>
            <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                    <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#F6DF5F]"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                    />
                ))}
            </div>
        </motion.div>
    );
}

export default function DealDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [deal, setDeal] = useState<Listing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [evaluation, setEvaluation] = useState<DealEvaluation | null>(null);
    const [evalLoading, setEvalLoading] = useState(false);
    const [evalRefreshing, setEvalRefreshing] = useState(false);
    const [evalAnimated, setEvalAnimated] = useState(false);
    const [showFullDesc, setShowFullDesc] = useState(false);
    const [aiRequested, setAiRequested] = useState(false);
    const cache = useDealCache();
    const aiSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cached = cache.getCachedDeal(id);
        if (cached) {
            setDeal(cached);
            setLoading(false);
            return;
        }

        async function fetchDeal() {
            try {
                const res = await fetch(`/api/listings/${id}`);
                if (!res.ok) throw new Error('Listing not found');
                const data = await res.json();
                setDeal(data);
                cache.setCachedDeal(id, data);
            } catch (err: any) {
                setError(err.message || 'Failed to load listing');
            } finally {
                setLoading(false);
            }
        }
        fetchDeal();
    }, [id, cache]);

    const fetchEvaluation = useCallback(async (forceRefresh = false) => {
        setEvalLoading(true);
        try {
            const endpoint = forceRefresh
                ? `/api/listings/${id}/evaluation/refresh`
                : `/api/listings/${id}/evaluation`;
            const options = forceRefresh ? { method: 'POST' as const } : {};
            const res = await fetch(endpoint, options);
            if (!res.ok) throw new Error('Evaluation failed');
            const data: DealEvaluation = await res.json();
            setEvaluation(data);
            setEvalAnimated(true);
        } catch {
            setEvaluation(null);
        } finally {
            setEvalLoading(false);
            setEvalRefreshing(false);
        }
    }, [id]);

    const handleAiSummary = useCallback(() => {
        setAiRequested(true);
        fetchEvaluation(false);
        setTimeout(() => {
            aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }, [fetchEvaluation]);

    const handleRefresh = useCallback(() => {
        setEvalRefreshing(true);
        fetchEvaluation(true);
    }, [fetchEvaluation]);

    if (loading) {
        return (
            <PageShell activePage="deals">
                <div className="flex items-center justify-center py-32">
                    <Loader2 size={48} className="animate-spin text-[#F6DF5F]" />
                </div>
            </PageShell>
        );
    }

    if (error || !deal) {
        return (
            <PageShell activePage="deals">
                <div className="text-center py-32">
                    <p className="text-slate-500 text-lg">{error || 'Listing not found.'}</p>
                    <Link href="/deal">
                        <Button className="mt-4 bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900 font-bold rounded-xl">
                            Back to Deal Feed
                        </Button>
                    </Link>
                </div>
            </PageShell>
        );
    }

    const descLines = (deal.description && deal.description !== 'N/A')
        ? deal.description.split('\n').filter(Boolean)
        : [];
    const descPreview = descLines.slice(0, 3);
    const hasMoreDesc = descLines.length > 3;

    const financialMetrics = [
        { label: 'Asking Price', value: formatMoney(deal.price), icon: DollarSign, accent: true },
        { label: 'Revenue', value: formatMoney(deal.gross_revenue), icon: TrendingUp, accent: false },
        { label: 'EBITDA', value: formatMoney(deal.ebitda), icon: Briefcase, accent: true },
        { label: 'Cash Flow', value: formatMoney(deal.cash_flow), icon: BarChart3, accent: false },
        { label: 'Inventory', value: formatMoney(deal.inventory), icon: CheckCircle2, accent: false },
    ];

    const evaluationUpdatedLabel = evaluation?.evaluated_at
        ? new Date(evaluation.evaluated_at).toLocaleString()
        : 'Unavailable';

    return (
        <PageShell activePage="deals">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
            >
                {/* ─── Navigation ─── */}
                <Link href="/deal">
                    <Button variant="ghost" className="w-fit text-slate-500 hover:text-slate-900 group p-0 min-h-0 h-auto transition-colors text-sm">
                        <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Deal Feed
                    </Button>
                </Link>

                {/* ─── Hero Header Banner ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.08 }}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e222a] via-[#272c36] to-[#2e343f] p-5 md:p-6 shadow-lg border border-white/[0.04]"
                >
                    {/* Subtle dot pattern overlay */}
                    <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
                        backgroundImage: 'radial-gradient(circle, #F6DF5F 0.8px, transparent 0.8px)',
                        backgroundSize: '20px 20px',
                    }} />
                    {/* Accent glow */}
                    <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-[#F6DF5F]/[0.04] blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-3 flex-1 min-w-0">
                            {/* Title */}
                            <motion.h1
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                                className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight"
                            >
                                {deal.title}
                            </motion.h1>

                            {/* Tag pills */}
                            <div className="flex flex-wrap gap-2">
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, delay: 0.2 }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6DF5F]/10 border border-[#F6DF5F]/20 backdrop-blur-sm"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#F6DF5F] animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F6DF5F]">{deal.source}</span>
                                </motion.span>

                                {deal.industry && deal.industry !== 'N/A' && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3, delay: 0.25 }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm"
                                    >
                                        <Building2 size={11} className="text-white/40" />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">{deal.industry}</span>
                                    </motion.span>
                                )}

                                {(deal.city !== 'N/A' || deal.state !== 'N/A') && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3, delay: 0.3 }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm"
                                    >
                                        <MapPin size={11} className="text-[#F6DF5F]/60" />
                                        <span className="text-[10px] font-semibold text-white/60">
                                            {deal.city !== 'N/A' ? deal.city : ''}{deal.state !== 'N/A' ? `, ${deal.state}` : ''}
                                        </span>
                                    </motion.span>
                                )}

                                {deal.scraping_date && deal.scraping_date !== 'N/A' && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3, delay: 0.35 }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm"
                                    >
                                        <Calendar size={11} className="text-white/40" />
                                        <span className="text-[10px] font-semibold text-white/60">{deal.scraping_date}</span>
                                    </motion.span>
                                )}
                            </div>
                        </div>

                        {/* CTA button */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.3 }}
                            className="flex-shrink-0"
                        >
                            {deal.source_link && deal.source_link !== 'N/A' && (
                                <a href={deal.source_link} target="_blank" rel="noopener noreferrer">
                                    <Button className="bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-[#F6DF5F]/10 transition-all border-0 flex items-center gap-2 group text-xs hover:shadow-[#F6DF5F]/20 hover:shadow-xl">
                                        View Original
                                        <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </Button>
                                </a>
                            )}
                        </motion.div>
                    </div>
                </motion.div>

                {/* ─── Executive Summary (compact + See More) ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Briefcase className="text-[#F6DF5F]" size={16} strokeWidth={2.5} />
                                Executive Summary
                            </h2>
                            {/* Contact chips */}
                            <div className="flex items-center gap-2">
                                {deal.listed_by_firm && deal.listed_by_firm !== 'N/A' && (
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                                        {deal.listed_by_firm}
                                    </span>
                                )}
                                {deal.email && deal.email !== 'N/A' && (
                                    <a href={`mailto:${deal.email}`} className="text-slate-400 hover:text-[#F6DF5F] transition-colors">
                                        <Mail size={14} />
                                    </a>
                                )}
                                {deal.phone && deal.phone !== 'N/A' && (
                                    <a href={`tel:${deal.phone}`} className="text-slate-400 hover:text-[#F6DF5F] transition-colors">
                                        <Phone size={14} />
                                    </a>
                                )}
                            </div>
                        </div>

                        {descLines.length > 0 ? (
                            <div className="text-sm text-slate-600 leading-relaxed">
                                {(showFullDesc ? descLines : descPreview).map((line, i) => (
                                    <p key={i} className="mb-1.5">{line}</p>
                                ))}
                                {hasMoreDesc && (
                                    <button
                                        onClick={() => setShowFullDesc(!showFullDesc)}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-[#d4a017] hover:text-[#b8880e] transition-colors mt-1"
                                    >
                                        {showFullDesc ? (
                                            <>Show Less <ChevronUp size={14} /></>
                                        ) : (
                                            <>See More <ChevronDown size={14} /></>
                                        )}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-slate-400 italic text-sm">No description available.</p>
                        )}
                    </div>
                </motion.div>

                {/* ─── Financial Snapshot (always visible, right below summary) ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="grid grid-cols-2 sm:grid-cols-5 gap-2"
                >
                    {financialMetrics.map((metric, idx) => {
                        const Icon = metric.icon;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.25 + idx * 0.06 }}
                                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                                className={`relative overflow-hidden rounded-xl p-3.5 border transition-shadow
                                    ${metric.accent
                                        ? 'bg-[#414854] border-[#414854] text-white shadow-md'
                                        : 'bg-white border-slate-100 text-slate-900 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Icon size={12} className={metric.accent ? 'text-[#F6DF5F]' : 'text-slate-400'} />
                                    <p className={`text-[9px] font-bold uppercase tracking-[0.15em] ${metric.accent ? 'text-white/40' : 'text-slate-400'}`}>
                                        {metric.label}
                                    </p>
                                </div>
                                <p className={`text-lg font-black ${metric.accent ? 'text-white' : 'text-slate-900'}`}>
                                    {metric.value}
                                </p>
                            </motion.div>
                        );
                    })}
                </motion.div>

                {/* ─── Deal Fit Score + Key Info Row ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="grid grid-cols-12 gap-3"
                >
                    {/* Key Information (compact) */}
                    <div className="col-span-12 lg:col-span-5">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-full">
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Key Information</h3>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                {[
                                    { label: 'Source', value: deal.source, icon: CheckCircle2 },
                                    { label: 'Industry', value: deal.industry !== 'N/A' ? deal.industry : '—', icon: Building2 },
                                    { label: 'Location', value: `${deal.city !== 'N/A' ? deal.city : ''}${deal.state !== 'N/A' ? `, ${deal.state}` : ''}` || '—', icon: MapPin },
                                    { label: 'Deal Date', value: deal.deal_date !== 'N/A' ? deal.deal_date : '—', icon: Clock },
                                    ...(deal.listed_by_name && deal.listed_by_name !== 'N/A' ? [{ label: 'Contact', value: deal.listed_by_name, icon: Users }] : []),
                                    ...(deal.listed_by_firm && deal.listed_by_firm !== 'N/A' ? [{ label: 'Firm', value: deal.listed_by_firm, icon: Building2 }] : []),
                                ].map((fact, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
                                            <fact.icon size={12} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-slate-400 text-[8px] uppercase font-bold tracking-widest leading-none">{fact.label}</p>
                                            <p className="text-slate-900 font-semibold text-[11px] truncate">{fact.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* AI Summary CTA */}
                    <div className="col-span-12 lg:col-span-7">
                        {!aiRequested ? (
                            <motion.div
                                className="relative h-full min-h-[180px] rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-[#1e222a] to-[#2a2f3a] flex flex-col items-center justify-center gap-4 p-6 cursor-pointer group"
                                whileHover={{ scale: 1.005 }}
                                onClick={handleAiSummary}
                            >
                                {/* Animated grid bg */}
                                <div className="absolute inset-0 opacity-[0.03]" style={{
                                    backgroundImage: 'radial-gradient(circle, #F6DF5F 1px, transparent 1px)',
                                    backgroundSize: '24px 24px',
                                }} />
                                <motion.div
                                    className="w-14 h-14 rounded-2xl bg-[#F6DF5F]/10 border border-[#F6DF5F]/20 flex items-center justify-center"
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <Brain size={26} className="text-[#F6DF5F]" />
                                </motion.div>
                                <div className="text-center z-10">
                                    <p className="text-white font-bold text-sm">Generate AI Summary</p>
                                    <p className="text-white/40 text-xs mt-0.5">Deal fit score • Assessment • Pros & Cons</p>
                                </div>
                                <Button className="bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900 font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all border-0 flex items-center gap-2 text-xs z-10 group-hover:shadow-[#F6DF5F]/20 group-hover:shadow-xl">
                                    <Sparkles size={14} />
                                    Analyze with AI
                                </Button>
                            </motion.div>
                        ) : (
                            <div className="h-full min-h-[180px] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm flex items-center justify-center">
                                {evalLoading ? (
                                    <AiLoadingPulse />
                                ) : evaluation ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.5 }}
                                        className="w-full h-full bg-gradient-to-br from-[#1e222a] to-[#2a2f3a] p-5 flex flex-col"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Target size={14} className="text-[#F6DF5F]" />
                                                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Deal Fit Score</span>
                                                <Badge className={`ml-1 px-2 py-0 text-[9px] font-bold uppercase tracking-wider border ${scoreBgClass(evaluation.fit_score)}`}>
                                                    {scoreLabel(evaluation.fit_score)}
                                                </Badge>
                                            </div>
                                            <button
                                                onClick={handleRefresh}
                                                disabled={evalRefreshing}
                                                className="flex items-center gap-1 text-[9px] font-bold text-white/30 uppercase tracking-wider hover:text-white/60 disabled:opacity-30 transition-colors"
                                            >
                                                <RefreshCw size={11} className={evalRefreshing ? 'animate-spin' : ''} />
                                                Re-evaluate
                                            </button>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-4 items-center">
                                            <RadialGauge score={evaluation.fit_score} animated={evalAnimated} />
                                            <CompactBreakdown breakdown={evaluation.score_breakdown} animated={evalAnimated} />
                                        </div>
                                        <p className="text-[10px] text-white/25 mt-2">
                                            {evaluation.cached ? 'Cached' : 'Fresh'} • {evaluationUpdatedLabel}
                                        </p>
                                    </motion.div>
                                ) : (
                                    <div className="text-center p-8">
                                        <p className="text-sm text-slate-400">Evaluation unavailable</p>
                                        <Button
                                            onClick={() => fetchEvaluation(false)}
                                            className="mt-3 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold rounded-lg"
                                        >
                                            Retry
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ─── AI Deep Dive (loaded after button click) ─── */}
                <div ref={aiSectionRef}>
                    <AnimatePresence>
                        {aiRequested && evaluation && !evalLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="space-y-3 overflow-hidden"
                            >
                                {/* Interactive Radar + AI Assessment side by side */}
                                <div className="grid grid-cols-12 gap-3">
                                    {/* Radar chart */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="col-span-12 lg:col-span-5 bg-gradient-to-br from-[#1e222a] to-[#2a2f3a] rounded-2xl border border-white/5 p-5 shadow-lg"
                                    >
                                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2 mb-1">
                                            <BarChart3 size={13} className="text-[#F6DF5F]" />
                                            Score Breakdown
                                        </h3>
                                        <BreakdownRadar breakdown={evaluation.score_breakdown} animated={evalAnimated} />
                                        <p className="text-[10px] text-white/25 text-center mt-1">
                                            Hover on chart for details
                                        </p>
                                    </motion.div>

                                    {/* AI Assessment */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 15 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.5, delay: 0.3 }}
                                        className="col-span-12 lg:col-span-7 bg-gradient-to-br from-[#1e222a] to-[#2a2f3a] rounded-2xl border border-white/5 p-5 shadow-lg"
                                    >
                                        <div className="flex items-start gap-3 h-full">
                                            <div className="w-8 h-8 rounded-lg bg-[#F6DF5F]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Sparkles size={14} className="text-[#F6DF5F]" />
                                            </div>
                                            <div className="flex-1 flex flex-col">
                                                <p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.2em] mb-2">AI Assessment</p>
                                                <motion.p
                                                    className="text-white/85 text-sm leading-relaxed font-medium flex-1"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.6, delay: 0.5 }}
                                                >
                                                    {evaluation.summary}
                                                </motion.p>
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                                    <p className="text-white/20 text-[10px] font-medium">
                                                        Powered by {evaluation.model_used}
                                                    </p>
                                                    <p className="text-white/20 text-[10px] font-medium">
                                                        {scoreNarrative(evaluation.fit_score)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Pros & Cons */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Strengths */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.4 }}
                                        className="bg-white border border-emerald-100/60 rounded-2xl p-4 shadow-sm"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                <CheckCircle size={13} className="text-emerald-500" strokeWidth={2.5} />
                                            </div>
                                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Strengths</h3>
                                        </div>
                                        <ul className="space-y-2">
                                            {evaluation.pros.map((pro, i) => (
                                                <motion.li
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.6 + i * 0.08 }}
                                                    className="flex items-start gap-2"
                                                >
                                                    <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                                                    <p className="text-[13px] text-slate-600 leading-relaxed">{pro}</p>
                                                </motion.li>
                                            ))}
                                        </ul>
                                    </motion.div>

                                    {/* Risks */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.45 }}
                                        className="bg-white border border-amber-100/60 rounded-2xl p-4 shadow-sm"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                                                <AlertTriangle size={13} className="text-amber-500" strokeWidth={2.5} />
                                            </div>
                                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Risks</h3>
                                        </div>
                                        <ul className="space-y-2">
                                            {evaluation.cons.map((con, i) => (
                                                <motion.li
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.6 + i * 0.08 }}
                                                    className="flex items-start gap-2"
                                                >
                                                    <div className="w-1 h-1 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                                                    <p className="text-[13px] text-slate-600 leading-relaxed">{con}</p>
                                                </motion.li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

                {/* ─── Floating AI Chatbox ─── */}
                <DealChatBox dealId={id} deal={deal} />
        </PageShell>
    );
}
