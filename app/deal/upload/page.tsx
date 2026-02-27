'use client';

import { useState, useRef } from 'react';
import {
    ArrowLeft,
    Upload,
    Plus,
    Check,
    X,
    FileText,
    Database,
    Info,
    DollarSign,
    Globe,
    Briefcase,
    User,
    AlertTriangle,
    Loader2
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import PageShell from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SimilarListing {
    id: number;
    title: string;
    url: string;
    source: string;
    distance: number;
}

interface UploadResult {
    inserted: boolean;
    id?: number;
    duplicate_url: boolean;
    similar_listings: SimilarListing[];
    message: string;
}

interface CsvResult {
    inserted: number;
    skipped_duplicates: number;
    errors: { row: number; error: string }[];
    potential_duplicates: any[];
    message: string;
}

export default function UploadDealPage() {
    const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [csvResult, setCsvResult] = useState<CsvResult | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvUploading, setCsvUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Form state
    const [form, setForm] = useState({
        title: '', url: '', source: '', industry: '',
        city: '', state: '', country: 'US', description: '',
        listed_by_firm: '', listed_by_name: '', phone: '', email: '',
        price: '', gross_revenue: '', cash_flow: '', ebitda: '',
        inventory: '', deal_date: '', financial_data: '',
        source_link: '', extra_information: '',
    });

    const updateField = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setResult(null);
        try {
            const res = await fetch('/api/upload/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data: UploadResult = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ inserted: false, duplicate_url: false, similar_listings: [], message: 'Network error. Is the backend running?' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCsvUpload = async () => {
        if (!csvFile) return;
        setCsvUploading(true);
        setCsvResult(null);
        try {
            const formData = new FormData();
            formData.append('file', csvFile);
            const res = await fetch('/api/upload/csv', {
                method: 'POST',
                body: formData,
            });
            const data: CsvResult = await res.json();
            setCsvResult(data);
        } catch (err) {
            setCsvResult({ inserted: 0, skipped_duplicates: 0, errors: [{ row: 0, error: 'Network error. Is the backend running?' }], potential_duplicates: [], message: 'Upload failed.' });
        } finally {
            setCsvUploading(false);
        }
    };

    return (
        <PageShell activePage="deals">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <Link href="/deal">
                        <Button variant="ghost" className="text-slate-500 hover:text-slate-900 mb-4 p-0 min-h-0 h-auto gap-2 group transition-colors">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            Back to Deal Feed
                        </Button>
                    </Link>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Add New Investment</h1>
                    <p className="text-slate-500 font-medium">Add a single deal manually or upload a CSV for bulk processing.</p>
                </header>

                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-2xl w-fit mb-8 shadow-inner">
                    <button
                        onClick={() => setActiveTab('single')}
                        className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Plus size={16} />
                            Single Deal
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('bulk')}
                        className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'bulk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Upload size={16} />
                            Bulk CSV Upload
                        </div>
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'single' ? (
                        <motion.div
                            key="single"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Result banner */}
                            {result && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`mb-6 p-6 rounded-2xl border ${result.inserted ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        {result.inserted ? <Check size={20} className="text-green-600" /> : <AlertTriangle size={20} className="text-amber-600" />}
                                        <p className={`font-bold ${result.inserted ? 'text-green-800' : 'text-amber-800'}`}>{result.message}</p>
                                    </div>
                                    {result.similar_listings.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-sm font-semibold text-amber-700 mb-2">⚠️ Potentially similar listings found:</p>
                                            {result.similar_listings.map((s) => (
                                                <div key={s.id} className="text-sm text-amber-600 ml-4">
                                                    • <strong>{s.title}</strong> ({s.source}) — similarity: {((1 - s.distance) * 100).toFixed(0)}%
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            <Card className="border-0 shadow-2xl rounded-[32px] overflow-hidden bg-white">
                                <CardContent className="p-8 md:p-12">
                                    <form onSubmit={handleSingleSubmit} className="space-y-10">
                                        {/* General Info */}
                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-[#F6DF5F]/20 flex items-center justify-center text-[#F6DF5F]">
                                                    <Info size={20} strokeWidth={2.5} />
                                                </div>
                                                <h2 className="text-xl font-bold text-slate-900">General Information</h2>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Deal Title</Label>
                                                    <Input placeholder="e.g. Design-Build Construction Firm" className="rounded-xl border-slate-200 py-6" required value={form.title} onChange={e => updateField('title', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Industry</Label>
                                                    <Input placeholder="e.g. Construction" className="rounded-xl border-slate-200 py-6" value={form.industry} onChange={e => updateField('industry', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Deal URL</Label>
                                                    <Input placeholder="https://..." className="rounded-xl border-slate-200 py-6" value={form.url} onChange={e => updateField('url', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Source Name</Label>
                                                    <Input placeholder="e.g. Manual" className="rounded-xl border-slate-200 py-6" value={form.source} onChange={e => updateField('source', e.target.value)} />
                                                </div>
                                            </div>
                                        </section>

                                        {/* Location */}
                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                    <Globe size={20} strokeWidth={2.5} />
                                                </div>
                                                <h2 className="text-xl font-bold text-slate-900">Location</h2>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">City</Label>
                                                    <Input placeholder="e.g. New York" className="rounded-xl border-slate-200 py-6" value={form.city} onChange={e => updateField('city', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">State / Region</Label>
                                                    <Input placeholder="e.g. NY" className="rounded-xl border-slate-200 py-6" value={form.state} onChange={e => updateField('state', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Country</Label>
                                                    <Input placeholder="United States" className="rounded-xl border-slate-200 py-6" value={form.country} onChange={e => updateField('country', e.target.value)} />
                                                </div>
                                            </div>
                                        </section>

                                        {/* Financials */}
                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                                                    <DollarSign size={20} strokeWidth={2.5} />
                                                </div>
                                                <h2 className="text-xl font-bold text-slate-900">Financial Performance</h2>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {[
                                                    { label: 'Asking Price', field: 'price' },
                                                    { label: 'Gross Revenue', field: 'gross_revenue' },
                                                    { label: 'EBITDA', field: 'ebitda' },
                                                    { label: 'Cash Flow', field: 'cash_flow' },
                                                    { label: 'Inventory Value', field: 'inventory' },
                                                ].map(({ label, field }) => (
                                                    <div key={field} className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</Label>
                                                        <div className="relative">
                                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                            <Input placeholder="0.00" className="rounded-xl border-slate-200 py-6 pl-10" value={(form as any)[field]} onChange={e => updateField(field, e.target.value)} />
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Deal Date</Label>
                                                    <Input type="date" className="rounded-xl border-slate-200 py-6 h-auto" value={form.deal_date} onChange={e => updateField('deal_date', e.target.value)} />
                                                </div>
                                            </div>
                                        </section>

                                        {/* Contact */}
                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                                    <User size={20} strokeWidth={2.5} />
                                                </div>
                                                <h2 className="text-xl font-bold text-slate-900">Contact / Firm Details</h2>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Broker Name</Label>
                                                    <Input placeholder="John Doe" className="rounded-xl border-slate-200 py-6" value={form.listed_by_name} onChange={e => updateField('listed_by_name', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Firm Name</Label>
                                                    <Input placeholder="Energia Consulting" className="rounded-xl border-slate-200 py-6" value={form.listed_by_firm} onChange={e => updateField('listed_by_firm', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Email Address</Label>
                                                    <Input type="email" placeholder="john@example.com" className="rounded-xl border-slate-200 py-6" value={form.email} onChange={e => updateField('email', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Phone Number</Label>
                                                    <Input placeholder="+1 (555) 000-0000" className="rounded-xl border-slate-200 py-6" value={form.phone} onChange={e => updateField('phone', e.target.value)} />
                                                </div>
                                            </div>
                                        </section>

                                        {/* Description */}
                                        <section>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-500">
                                                    <FileText size={20} strokeWidth={2.5} />
                                                </div>
                                                <h2 className="text-xl font-bold text-slate-900">Executive Summary</h2>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Full Description</Label>
                                                <textarea
                                                    rows={6}
                                                    placeholder="Provide a detailed description of the deal..."
                                                    className="w-full rounded-xl border-slate-200 p-4 focus:ring-2 focus:ring-[#F6DF5F] focus:border-transparent outline-none transition-all resize-none border"
                                                    value={form.description}
                                                    onChange={e => updateField('description', e.target.value)}
                                                />
                                            </div>
                                        </section>

                                        {/* Actions */}
                                        <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                                            <p className="text-slate-400 text-sm italic">Duplicate detection runs automatically on submit.</p>
                                            <div className="flex items-center gap-4">
                                                <Link href="/deal">
                                                    <Button type="button" variant="ghost" className="rounded-xl px-8 py-6 font-bold text-slate-500">Cancel</Button>
                                                </Link>
                                                <Button
                                                    disabled={isSubmitting}
                                                    className="rounded-xl px-10 py-6 font-bold shadow-lg transition-all min-w-[180px] bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900"
                                                >
                                                    {isSubmitting ? (
                                                        <Loader2 size={20} className="animate-spin" />
                                                    ) : (
                                                        'Create Deal'
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="bulk"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* CSV result banner */}
                            {csvResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-6 p-6 rounded-2xl border bg-blue-50 border-blue-200"
                                >
                                    <p className="font-bold text-blue-800 mb-2">{csvResult.message}</p>
                                    <div className="grid grid-cols-3 gap-4 mt-3">
                                        <div className="bg-white rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-green-600">{csvResult.inserted}</p>
                                            <p className="text-xs text-slate-500 font-bold uppercase">Inserted</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-amber-600">{csvResult.skipped_duplicates}</p>
                                            <p className="text-xs text-slate-500 font-bold uppercase">Duplicates Skipped</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-red-600">{csvResult.errors.length}</p>
                                            <p className="text-xs text-slate-500 font-bold uppercase">Errors</p>
                                        </div>
                                    </div>
                                    {csvResult.potential_duplicates.length > 0 && (
                                        <div className="mt-4 text-sm text-amber-700">
                                            <p className="font-semibold">⚠️ {csvResult.potential_duplicates.length} row(s) have potential semantic duplicates.</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            <Card className="border-0 shadow-2xl rounded-[32px] overflow-hidden bg-white">
                                <CardContent className="p-8 md:p-16 text-center">
                                    <div className="max-w-xl mx-auto space-y-8">
                                        <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto text-slate-300 border-2 border-dashed border-slate-200">
                                            <Upload size={40} strokeWidth={1.5} />
                                        </div>
                                        <div className="space-y-2">
                                            <h2 className="text-2xl font-bold text-slate-900">Upload your CSV file</h2>
                                            <p className="text-slate-500">Drag and drop your file here, or click to browse. Supported format: .csv</p>
                                        </div>

                                        <div
                                            onClick={() => fileRef.current?.click()}
                                            className="p-10 border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer group"
                                        >
                                            <input
                                                ref={fileRef}
                                                type="file"
                                                accept=".csv"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) setCsvFile(e.target.files[0]);
                                                }}
                                            />
                                            <div className="flex flex-col items-center gap-4">
                                                {csvFile ? (
                                                    <>
                                                        <div className="bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md">
                                                            <Check size={24} strokeWidth={3} />
                                                        </div>
                                                        <span className="font-bold text-slate-900">{csvFile.name}</span>
                                                        <span className="text-sm text-slate-500">{(csvFile.size / 1024).toFixed(1)} KB</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="bg-[#F6DF5F] text-slate-900 w-12 h-12 rounded-full flex items-center justify-center shadow-md">
                                                            <Plus size={24} strokeWidth={3} />
                                                        </div>
                                                        <span className="font-bold text-slate-600 group-hover:text-slate-900">Select File</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {csvFile && (
                                            <Button
                                                onClick={handleCsvUpload}
                                                disabled={csvUploading}
                                                className="bg-[#F6DF5F] hover:bg-[#e9d14a] text-slate-900 font-bold px-10 py-6 rounded-2xl shadow-lg min-w-[200px]"
                                            >
                                                {csvUploading ? <Loader2 size={20} className="animate-spin" /> : 'Upload & Process'}
                                            </Button>
                                        )}

                                        <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                            <div className="p-4 bg-slate-50 rounded-2xl flex gap-3 items-start">
                                                <Database className="text-[#F6DF5F] mt-1" size={18} />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">20 Required Columns</p>
                                                    <p className="text-xs text-slate-500">Ensure your CSV matches the scraper schema headers.</p>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-2xl flex gap-3 items-start">
                                                <Check className="text-green-500 mt-1" size={18} />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">Smart Duplicate Detection</p>
                                                    <p className="text-xs text-slate-500">URL matching + semantic similarity check on every row.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </PageShell>
    );
}
