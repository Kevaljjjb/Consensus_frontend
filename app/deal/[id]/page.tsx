'use client';

import { use, useState, useEffect } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import PageShell from '@/components/PageShell';
import Chatbox from '@/components/Chatbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDealCache } from '@/components/DealCacheProvider';

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

const formatMoney = (val: string) => {
    if (!val || val === 'N/A') return 'N/A';
    const num = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return val;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
};

export default function DealDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [deal, setDeal] = useState<Listing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const cache = useDealCache();

    useEffect(() => {
        // Check cache first
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

    // Parse extra information into key-value pairs
    const extraParts = (deal.extra_information && deal.extra_information !== 'N/A')
        ? deal.extra_information.split(' | ').map(p => {
            const [key, ...rest] = p.split(': ');
            return { label: key, value: rest.join(': ') };
        })
        : [];

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <PageShell activePage="deals">
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="space-y-5"
            >
                {/* Navigation & Header */}
                <div className="flex flex-col gap-3">
                    <Link href="/deal">
                        <Button variant="ghost" className="w-fit text-slate-500 hover:text-slate-900 group p-0 min-h-0 h-auto transition-colors text-sm">
                            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Deal Feed
                        </Button>
                    </Link>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <motion.div variants={itemVariants} className="space-y-1">
                            <div className="flex flex-wrap gap-2">
                                <Badge className="bg-[#F6DF5F]/10 text-slate-800 border-[#F6DF5F]/20 px-2 py-0 font-bold text-[10px] uppercase tracking-wider">
                                    {deal.source}
                                </Badge>
                                {deal.industry && deal.industry !== 'N/A' && (
                                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 px-2 py-0 font-bold text-[10px] uppercase tracking-wider">
                                        {deal.industry}
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                {deal.title}
                            </h1>
                            <div className="flex items-center gap-4 text-slate-500 font-medium text-xs">
                                {(deal.city !== 'N/A' || deal.state !== 'N/A') && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin size={14} className="text-[#F6DF5F]" />
                                        {deal.city !== 'N/A' ? deal.city : ''}{deal.state !== 'N/A' ? `, ${deal.state}` : ''}
                                    </div>
                                )}
                                {deal.scraping_date && deal.scraping_date !== 'N/A' && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} className="text-[#F6DF5F]" />
                                        {deal.scraping_date}
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            {deal.source_link && deal.source_link !== 'N/A' && (
                                <a href={deal.source_link} target="_blank" rel="noopener noreferrer">
                                    <Button className="bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900 font-bold px-6 py-5 rounded-xl shadow-md transition-all border-0 flex items-center gap-2 group text-sm">
                                        View Original
                                        <ExternalLink size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    </Button>
                                </a>
                            )}
                        </motion.div>
                    </div>
                </div>

                {/* Hero Metrics */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Asking Price', value: formatMoney(deal.price), icon: DollarSign, color: 'text-white' },
                        { label: 'Gross Revenue', value: formatMoney(deal.gross_revenue), icon: TrendingUp, color: 'text-white' },
                        { label: 'EBITDA', value: formatMoney(deal.ebitda), icon: Briefcase, color: 'text-[#F6DF5F]' },
                    ].map((metric, idx) => (
                        <Card key={idx} className="bg-[#414854] border-0 rounded-[20px] overflow-hidden shadow-md group hover:scale-[1.01] transition-transform duration-300">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-white/40 text-[8px] font-black uppercase tracking-[0.2em]">{metric.label}</p>
                                    <metric.icon className="text-white/20" size={16} />
                                </div>
                                <h2 className={`text-xl font-black ${metric.color}`}>
                                    {metric.value}
                                </h2>
                            </CardContent>
                        </Card>
                    ))}
                </motion.div>

                {/* Detailed Breakdown */}
                <div className="grid grid-cols-12 gap-5">
                    {/* Main Info */}
                    <motion.div variants={itemVariants} className="col-span-12 lg:col-span-8 space-y-5">
                        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-3">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Briefcase className="text-[#F6DF5F]" size={18} strokeWidth={2.5} />
                                Executive Summary
                            </h2>
                            <div className="prose prose-slate max-w-none prose-sm">
                                {deal.description && deal.description !== 'N/A' ? (
                                    deal.description.split('\n').map((line: string, i: number) => (
                                        <p key={i} className="text-slate-600 leading-relaxed mb-2">
                                            {line}
                                        </p>
                                    ))
                                ) : (
                                    <p className="text-slate-400 italic">No description available.</p>
                                )}
                            </div>
                        </div>

                        {/* Financial Details */}
                        <div className="bg-[#414854] p-6 rounded-[28px] shadow-lg text-white space-y-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <DollarSign className="text-[#F6DF5F]" size={18} strokeWidth={2.5} />
                                Financial Snapshot
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Cash Flow', value: formatMoney(deal.cash_flow) },
                                    { label: 'Inventory', value: formatMoney(deal.inventory) },
                                    { label: 'Price', value: formatMoney(deal.price) },
                                    { label: 'Revenue', value: formatMoney(deal.gross_revenue) },
                                ].map((item, i) => (
                                    <div key={i} className="space-y-0">
                                        <p className="text-white/40 text-[8px] uppercase font-bold tracking-widest">{item.label}</p>
                                        <p className="text-base font-bold">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Facts Sidebar */}
                    <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4 space-y-4">
                        <div className="bg-slate-50 p-5 rounded-[24px] border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">Key Information</h3>

                            <div className="space-y-3">
                                {[
                                    { label: 'Source', value: deal.source, icon: CheckCircle2 },
                                    { label: 'Industry', value: deal.industry !== 'N/A' ? deal.industry : '—', icon: Building2 },
                                    { label: 'Location', value: `${deal.city !== 'N/A' ? deal.city : ''}${deal.state !== 'N/A' ? `, ${deal.state}` : ''}` || '—', icon: MapPin },
                                    { label: 'Deal Date', value: deal.deal_date !== 'N/A' ? deal.deal_date : '—', icon: Clock },
                                    ...extraParts.slice(0, 3).map(p => ({
                                        label: p.label,
                                        value: p.value,
                                        icon: Users,
                                    })),
                                ].map((fact, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-400">
                                            <fact.icon size={16} />
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-[8px] uppercase font-bold tracking-widest leading-none mb-0.5">{fact.label}</p>
                                            <p className="text-slate-900 font-bold text-xs">{fact.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Contact info */}
                            <div className="pt-3 border-t border-slate-200">
                                <div className="space-y-2">
                                    {deal.listed_by_firm && deal.listed_by_firm !== 'N/A' && (
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Building2 size={14} className="text-[#F6DF5F]" />
                                            <span className="text-[11px] font-semibold">{deal.listed_by_firm}</span>
                                        </div>
                                    )}
                                    {deal.listed_by_name && deal.listed_by_name !== 'N/A' && (
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Users size={14} className="text-[#F6DF5F]" />
                                            <span className="text-[11px] font-semibold">{deal.listed_by_name}</span>
                                        </div>
                                    )}
                                    {deal.email && deal.email !== 'N/A' && (
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Mail size={14} className="text-[#F6DF5F]" />
                                            <span className="text-[11px] font-semibold">{deal.email}</span>
                                        </div>
                                    )}
                                    {deal.phone && deal.phone !== 'N/A' && (
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Phone size={14} className="text-[#F6DF5F]" />
                                            <span className="text-[11px] font-semibold">{deal.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {deal.source_link && deal.source_link !== 'N/A' && (
                                <a href={deal.source_link} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" className="w-full py-4 rounded-lg border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-[10px] min-h-0 h-auto">
                                        View Original Listing
                                        <ExternalLink size={14} />
                                    </Button>
                                </a>
                            )}
                        </div>
                    </motion.div>
                </div>
            </motion.div>
            <Chatbox dealData={deal} />
        </PageShell>
    );
}
