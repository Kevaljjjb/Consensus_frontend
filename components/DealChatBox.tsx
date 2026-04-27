'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
    MessageCircle,
    X,
    Sparkles,
    Bot,
    User,
    ArrowUp,
    Building2,
    MapPin,
    DollarSign,
    TrendingUp,
    AlertTriangle,
    Search,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './deal-chat.css';

/* ─── Types ─── */
interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface DealChatBoxProps {
    dealId: string;
    deal: {
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
        extra_information: string;
        [key: string]: any;
    };
}

interface QuickAction {
    label: string;
    description: string;
    icon: LucideIcon;
}

interface MetaChip {
    label: string;
    icon: LucideIcon;
}

/* ─── Helpers ─── */
const INVALID_VALUES = new Set([
    'n/a', 'na', 'null', 'undefined',
    'not available', 'not disclosed', 'unknown',
]);

function clean(value?: string | null) {
    const t = value?.trim();
    if (!t || INVALID_VALUES.has(t.toLowerCase())) return null;
    return t;
}

function isChip(c: MetaChip | null): c is MetaChip {
    return c !== null;
}

/* ─── Component ─── */
export default function DealChatBox({ dealId, deal }: DealChatBoxProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const panelId = `deal-chat-panel-${dealId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const dealTitle = clean(deal.title) ?? 'Selected deal';
    const locationLabel = [clean(deal.city), clean(deal.state), clean(deal.country)]
        .filter(Boolean)
        .join(', ');

    const metaChips = [
        clean(deal.industry)
            ? { icon: Building2, label: clean(deal.industry) as string }
            : null,
        locationLabel ? { icon: MapPin, label: locationLabel } : null,
        clean(deal.price)
            ? { icon: DollarSign, label: clean(deal.price) as string }
            : clean(deal.source)
              ? { icon: Search, label: clean(deal.source) as string }
              : null,
    ].filter(isChip);

    const quickActions: QuickAction[] = [
        {
            label: 'Summarize this deal',
            description: 'Get a sharp 30-second read.',
            icon: Sparkles,
        },
        {
            label: 'What are the risks?',
            description: 'Surface the biggest red flags.',
            icon: AlertTriangle,
        },
        {
            label: 'Is the valuation fair?',
            description: 'Pressure-test the asking price.',
            icon: TrendingUp,
        },
    ];

    /* ─── Scroll ─── */
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, []);

    useEffect(() => {
        scrollToBottom(isStreaming ? 'auto' : 'smooth');
    }, [messages, scrollToBottom, isStreaming]);

    /* ─── Lifecycle ─── */
    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (!isOpen) return;
        const t = window.setTimeout(() => textareaRef.current?.focus(), 280);
        return () => window.clearTimeout(t);
    }, [isOpen]);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = '0px';
        ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }, [input, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen]);

    /* ─── Streaming ─── */
    const submitMessage = useCallback(
        async (nextText?: string) => {
            const text = (nextText ?? input).trim();
            if (!text || isStreaming) return;

            const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
            const assistantId = (Date.now() + 1).toString();
            const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' };

            setMessages(prev => [...prev, userMsg, assistantMsg]);
            setInput('');
            setIsStreaming(true);

            try {
                const allMessages = [...messages, userMsg].map(m => ({
                    role: m.role,
                    content: m.content,
                }));

                const res = await fetch('/api/deal-chat/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deal, messages: allMessages }),
                });

                if (!res.ok) throw new Error('Stream failed');
                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader) throw new Error('No reader');

                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') break;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.delta) {
                                setMessages(prev =>
                                    prev.map(m =>
                                        m.id === assistantId
                                            ? { ...m, content: m.content + parsed.delta }
                                            : m
                                    )
                                );
                            }
                            if (parsed.error) {
                                setMessages(prev =>
                                    prev.map(m =>
                                        m.id === assistantId
                                            ? { ...m, content: `Error: ${parsed.error}` }
                                            : m
                                    )
                                );
                            }
                        } catch {
                            // skip malformed JSON
                        }
                    }
                }
            } catch {
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantId
                            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
                            : m
                    )
                );
            } finally {
                setIsStreaming(false);
            }
        },
        [deal, input, isStreaming, messages]
    );

    const handleSend = useCallback(() => { void submitMessage(); }, [submitMessage]);
    const handleQuickAction = useCallback((prompt: string) => { void submitMessage(prompt); }, [submitMessage]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const statusLabel = isStreaming
        ? 'Thinking…'
        : messages.length > 0
          ? 'Active'
          : 'Ready';

    if (!isMounted) return null;

    /* ─── Render ─── */
    return createPortal(
        <>
            {/* ═══ FAB Button ═══ */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        whileHover={{ scale: 1.04, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        onClick={() => setIsOpen(true)}
                        className="deal-chat-fab fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-[#181b22]/92 text-left shadow-[0_24px_64px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:h-auto sm:w-auto sm:gap-3 sm:rounded-[999px] sm:px-5 sm:py-3.5"
                        aria-controls={panelId}
                        aria-expanded={isOpen}
                        aria-label="Open deal chat"
                    >
                        <span className="deal-chat-fab-icon">
                            <MessageCircle size={17} className="text-[#F6DF5F]" />
                        </span>
                        <span className="hidden min-w-0 sm:flex sm:flex-col">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                                Deal AI
                            </span>
                            <span className="text-[13px] font-semibold text-white/88">
                                Ask about this deal
                            </span>
                        </span>
                        <span className="deal-chat-fab-dot" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ═══ Backdrop ═══ */}
            <AnimatePresence>
                {isOpen && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
                        aria-label="Close deal chat"
                    />
                )}
            </AnimatePresence>

            {/* ═══ Chat Panel ═══ */}
            <AnimatePresence>
                {isOpen && (
                    <motion.section
                        id={panelId}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Deal assistant chat"
                        initial={{ opacity: 0, y: 32, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 28, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                        className="deal-chat-panel fixed inset-x-3 bottom-3 top-[72px] z-50 flex flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0f1118]/92 backdrop-blur-[32px] sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[660px] sm:w-[400px]"
                    >
                        {/* Ambient orbs */}
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                            <div className="deal-chat-orb deal-chat-orb--top" />
                            <div className="deal-chat-orb deal-chat-orb--bottom" />
                        </div>

                        {/* ─── Header ─── */}
                        <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-5 pb-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="deal-chat-header-icon">
                                    <Sparkles size={15} className="text-[#F6DF5F]" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/28">
                                        Deal Intelligence
                                    </p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <p className="text-[15px] font-semibold leading-tight text-white/95">
                                            Deal Assistant
                                        </p>
                                        <span className="deal-chat-status-pill">{statusLabel}</span>
                                    </div>
                                    <p className="deal-chat-clamp-1 mt-0.5 text-[11px] text-white/30">
                                        {dealTitle}
                                    </p>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.08, rotate: 90 }}
                                whileTap={{ scale: 0.92 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                                onClick={() => setIsOpen(false)}
                                className="deal-chat-close-btn"
                                aria-label="Close chat"
                            >
                                <X size={14} className="text-white/50" />
                            </motion.button>
                        </header>

                        {/* Divider */}
                        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

                        {/* ─── Scrollable Content ─── */}
                        <div className="deal-chat-scroll relative z-10 flex-1 overflow-y-auto px-5 py-4">
                            {messages.length === 0 ? (
                                /* ── Empty State ── */
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.06, duration: 0.3 }}
                                    className="flex min-h-full flex-col gap-4"
                                >
                                    {/* Context Card */}
                                    <div className="deal-chat-glass-card p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/28">
                                                    Loaded deal
                                                </p>
                                                <p className="deal-chat-clamp-2 mt-1.5 text-[13px] font-semibold leading-snug text-white/88">
                                                    {dealTitle}
                                                </p>
                                            </div>
                                            <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#F6DF5F]" />
                                                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/50 whitespace-nowrap">
                                                    Live context
                                                </span>
                                            </span>
                                        </div>

                                        {metaChips.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {metaChips.map(chip => {
                                                    const Icon = chip.icon;
                                                    return (
                                                        <span key={chip.label} className="deal-chat-chip">
                                                            <Icon size={11} className="flex-shrink-0 text-white/40" />
                                                            <span className="deal-chat-clamp-1">{chip.label}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Welcome + Quick Actions */}
                                    <div className="deal-chat-glass-card p-5">
                                        <div className="mb-4 flex items-center gap-2.5">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F6DF5F]/15 to-[#F6DF5F]/5 border border-[#F6DF5F]/8">
                                                <Bot size={20} className="text-[#F6DF5F]/70" />
                                            </div>
                                            <div>
                                                <p className="text-[15px] font-semibold tracking-tight text-white/92">
                                                    What can I help with?
                                                </p>
                                                <p className="text-[11px] text-white/35 leading-snug">
                                                    Insight, risk signals, or diligence questions.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {quickActions.map((action, i) => {
                                                const Icon = action.icon;
                                                return (
                                                    <motion.button
                                                        key={action.label}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.12 + i * 0.06 }}
                                                        onClick={() => handleQuickAction(action.label)}
                                                        disabled={isStreaming}
                                                        className="deal-chat-action text-left"
                                                    >
                                                        <span className="deal-chat-action-icon">
                                                            <Icon size={14} className="text-[#F6DF5F]" />
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-[12.5px] font-semibold text-white/85">
                                                                {action.label}
                                                            </span>
                                                            <span className="mt-0.5 block text-[10.5px] text-white/35">
                                                                {action.description}
                                                            </span>
                                                        </span>
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Bottom Capability Pills */}
                                    <div className="mt-auto grid grid-cols-3 gap-2 pt-1">
                                        <div className="deal-chat-feature-pill">
                                            <TrendingUp size={12} className="text-[#F6DF5F]/60" />
                                            <span>Valuation</span>
                                        </div>
                                        <div className="deal-chat-feature-pill">
                                            <AlertTriangle size={12} className="text-[#F6DF5F]/60" />
                                            <span>Risks</span>
                                        </div>
                                        <div className="deal-chat-feature-pill">
                                            <Sparkles size={12} className="text-[#F6DF5F]/60" />
                                            <span>Summary</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                /* ── Messages ── */
                                <div className="space-y-4 pb-1">
                                    {messages.map(msg => (
                                        <motion.div
                                            key={msg.id}
                                            layout
                                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                                            className={`flex items-end gap-2 ${
                                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="deal-chat-avatar deal-chat-avatar--bot">
                                                    <Bot size={11} className="text-white/50" />
                                                </div>
                                            )}

                                            <div
                                                className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                                                    msg.role === 'user'
                                                        ? 'deal-chat-bubble-user rounded-[20px] rounded-br-[8px] text-[#141820] font-medium'
                                                        : 'deal-chat-bubble-ai rounded-[20px] rounded-bl-[8px] text-white/85'
                                                }`}
                                            >
                                                {msg.content ? (
                                                    msg.role === 'user' ? (
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    ) : (
                                                        <div className="deal-chat-md">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="deal-chat-thinking">
                                                        <span className="deal-chat-dots">
                                                            <span />
                                                            <span />
                                                            <span />
                                                        </span>
                                                        <span className="text-[10px] font-medium text-white/32">
                                                            Thinking
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {msg.role === 'user' && (
                                                <div className="deal-chat-avatar deal-chat-avatar--user">
                                                    <User size={11} className="text-[#141820]" />
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Divider */}
                        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

                        {/* ─── Footer / Composer ─── */}
                        <div className="relative z-10 px-5 pt-3 pb-4">
                            {/* Input Composer */}
                            <div className="deal-chat-composer">
                                <textarea
                                    ref={textareaRef}
                                    rows={1}
                                    placeholder="Ask about valuation, risks, diligence…"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isStreaming}
                                    className="deal-chat-textarea"
                                />

                                <motion.button
                                    whileHover={{ scale: input.trim() && !isStreaming ? 1.05 : 1 }}
                                    whileTap={{ scale: input.trim() && !isStreaming ? 0.93 : 1 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                                    onClick={handleSend}
                                    disabled={!input.trim() || isStreaming}
                                    className={`deal-chat-send ${
                                        input.trim() && !isStreaming
                                            ? 'deal-chat-send--active'
                                            : 'deal-chat-send--idle'
                                    }`}
                                    aria-label="Send message"
                                >
                                    <ArrowUp size={14} />
                                </motion.button>
                            </div>

                            {/* Footer Info */}
                            <div className="mt-2.5 flex items-center justify-between px-0.5">
                                <p className="text-[9px] font-medium text-white/18">
                                    Shift + Enter for newline
                                </p>
                                <p className="text-[9px] font-medium text-white/12">
                                    Powered by GPT-5.4-mini
                                </p>
                            </div>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>
        </>,
        document.body
    );
}
