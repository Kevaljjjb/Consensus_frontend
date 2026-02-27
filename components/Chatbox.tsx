'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import styles from './Chatbox.module.css';

// Configure marked for safe rendering
marked.setOptions({
    breaks: true,
    gfm: true,
});

interface DealData {
    title?: string;
    industry?: string;
    source?: string;
    city?: string;
    state?: string;
    country?: string;
    price?: string;
    gross_revenue?: string;
    ebitda?: string;
    cash_flow?: string;
    inventory?: string;
    description?: string;
    listed_by_firm?: string;
    listed_by_name?: string;
    email?: string;
    phone?: string;
    deal_date?: string;
    source_link?: string;
    extra_information?: string;
    [key: string]: any;
}

interface ChatMessage {
    content: string;
    sender: 'user' | 'bot';
    time: string;
}

interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatboxProps {
    dealData?: DealData | null;
}

export default function Chatbox({ dealData }: ChatboxProps) {
    const dealTitle = dealData?.title || 'this deal';

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            content: `<p>Hi there! 👋 I'm the <strong>Consensus AI Assistant</strong>. I can help you analyze <strong>${dealTitle}</strong>. Ask me about financials, valuation, industry details, or anything about this deal!</p>`,
            sender: 'bot',
            time: 'Just now',
        },
    ]);
    const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    // Close chat when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                isOpen &&
                containerRef.current &&
                toggleRef.current &&
                !containerRef.current.contains(e.target as Node) &&
                !toggleRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const escapeHtml = (text: string) => {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    const sendMessage = useCallback(async () => {
        const message = inputValue.trim();
        if (!message) return;

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Add user message to UI
        const userMsg: ChatMessage = {
            content: escapeHtml(message),
            sender: 'user',
            time: timeString,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        // Update conversation history
        const updatedHistory = [...conversationHistory, { role: 'user' as const, content: message }];

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    dealContext: dealData || null,
                    conversationHistory: updatedHistory.slice(-10), // Keep last 10 messages for context
                }),
            });
            const data = await res.json();
            const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const botReply = data.reply || 'I could not generate a response.';

            const botMsg: ChatMessage = {
                content: marked.parse(botReply) as string,
                sender: 'bot',
                time: replyTime,
            };
            setMessages((prev) => [...prev, botMsg]);

            // Update conversation history with assistant response
            setConversationHistory([
                ...updatedHistory,
                { role: 'assistant' as const, content: botReply },
            ]);
        } catch {
            const errorTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const botMsg: ChatMessage = {
                content: '<p>Sorry, something went wrong. Please try again later.</p>',
                sender: 'bot',
                time: errorTime,
            };
            setMessages((prev) => [...prev, botMsg]);
            // Still keep user message in history
            setConversationHistory(updatedHistory);
        } finally {
            setIsTyping(false);
        }
    }, [inputValue, dealData, conversationHistory]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        // Auto-resize
        e.target.style.height = '44px';
        e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
    };

    return (
        <>
            {/* Toggle Button */}
            <div
                ref={toggleRef}
                className={`${styles.chatToggle} ${isOpen ? styles.chatToggleActive : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <svg viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                </svg>
            </div>

            {/* Chat Container */}
            <div
                ref={containerRef}
                className={`${styles.chatContainer} ${isOpen ? styles.chatContainerActive : ''}`}
            >
                {/* Header */}
                <div className={styles.chatHeader}>
                    <div className={styles.avatar}>AI</div>
                    <div className={styles.headerInfo}>
                        <div className={styles.headerTitle}>Consensus AI</div>
                        <div className={styles.headerStatus}>
                            <span className={styles.onlineDot}></span>
                            Deal Analyst
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className={styles.chatMessages}>
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`${styles.message} ${msg.sender === 'user' ? styles.messageUser : ''}`}
                        >
                            <div
                                className={`${styles.messageAvatar} ${msg.sender === 'user' ? styles.messageUserAvatar : ''}`}
                            >
                                {msg.sender === 'user' ? 'You' : 'AI'}
                            </div>
                            <div className={`${styles.messageWrapper} ${msg.sender === 'user' ? styles.messageWrapperUser : ''}`}>
                                <div
                                    className={`${styles.messageContent} ${msg.sender === 'user' ? styles.messageContentUser : ''}`}
                                    dangerouslySetInnerHTML={{ __html: msg.content }}
                                />
                                <div className={styles.timestamp}>{msg.time}</div>
                            </div>
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    <div
                        className={`${styles.typingIndicator} ${styles.message} ${isTyping ? styles.typingIndicatorActive : ''}`}
                    >
                        <div className={styles.messageAvatar}>AI</div>
                        <div className={styles.typingDots}>
                            <div className={styles.typingDot}></div>
                            <div className={styles.typingDot}></div>
                            <div className={styles.typingDot}></div>
                        </div>
                    </div>

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className={styles.chatInput}>
                    <div className={styles.inputContainer}>
                        <textarea
                            ref={inputRef}
                            className={styles.inputField}
                            placeholder="Ask about this deal..."
                            rows={1}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                        />
                        <button className={styles.sendButton} onClick={sendMessage}>
                            <svg viewBox="0 0 24 24">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
