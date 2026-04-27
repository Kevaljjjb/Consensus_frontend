"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Loader2,
  Bot,
  Sparkles,
  TrendingUp,
  DollarSign,
  Building2,
  Sun,
  Moon,
  Pencil,
  X,
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
} from "lucide-react";
import PageShell from "@/components/PageShell";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: ChatSource[];
  annotations?: ChatAnnotation[];
}

interface ChatSource {
  type?: string;
  url?: string;
  title?: string;
}

interface ChatAnnotation {
  type?: string;
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
}

interface StreamEventPayload {
  delta?: string;
  error?: string;
  conversation_id?: string;
  model?: string;
  sources?: ChatSource[];
  annotations?: ChatAnnotation[];
}

interface MessageReference {
  url: string;
  title: string;
  host: string;
}

interface ConversationSummary {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
}

interface StoredMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  message_order: number;
  edited_at: string | null;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: StoredMessage[];
}

const AUTO_SCROLL_THRESHOLD = 120;

const SUGGESTED_STARTERS = [
  {
    icon: TrendingUp,
    label: "Evaluate a deal",
    prompt:
      "How should I evaluate a business acquisition opportunity with $3M revenue and $500K EBITDA?",
  },
  {
    icon: DollarSign,
    label: "Cash flow analysis",
    prompt:
      "What cash flow metrics should I look for when evaluating small businesses for acquisition?",
  },
  {
    icon: Building2,
    label: "Industry insights",
    prompt:
      "Which industries typically have the best margins for business acquisitions under $10M?",
  },
  {
    icon: Sparkles,
    label: "Due diligence",
    prompt:
      "Create a due diligence checklist for acquiring a service-based business.",
  },
];

/* ─── Markdown components with dark mode ──────────────────────────────── */

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="mt-5 mb-2 text-lg font-bold tracking-tight first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mt-5 mb-2 text-base font-semibold tracking-tight first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mt-4 mb-2 text-sm font-semibold tracking-tight first:mt-0"
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="my-3 first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="my-3 list-disc space-y-1 pl-5 first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="my-3 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-4 border-l-2 border-slate-300 pl-4 italic text-slate-600 first:mt-0 last:mb-0 dark:border-slate-600 dark:text-slate-400"
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, ...props }) => (
    <a
      className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600 dark:text-slate-100 dark:decoration-slate-600 dark:hover:decoration-slate-400"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  hr: (props) => (
    <hr className="my-4 border-slate-200 dark:border-slate-700" {...props} />
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="my-4 overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-slate-100 first:mt-0 last:mb-0 dark:bg-black/60"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }) => {
    const codeContent = Array.isArray(children)
      ? children.map((child) => String(child)).join("")
      : String(children ?? "");
    const isBlock =
      Boolean(className?.includes("language-")) || codeContent.includes("\n");

    if (isBlock) {
      return (
        <code
          className={`font-mono text-[13px] ${className ?? ""}`.trim()}
          {...props}
        >
          {codeContent.replace(/\n$/, "")}
        </code>
      );
    }

    return (
      <code
        className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[13px] text-slate-900 dark:bg-slate-700/80 dark:text-slate-200"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto first:mt-0 last:mb-0">
      <table
        className="min-w-full border-collapse text-left text-xs"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead
      className="border-b border-slate-300 bg-slate-200/70 dark:border-slate-600 dark:bg-slate-800/70"
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => (
    <tr
      className="border-b border-slate-200 last:border-b-0 dark:border-slate-700"
      {...props}
    >
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th
      className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="px-3 py-2 align-top text-slate-700 dark:text-slate-300"
      {...props}
    >
      {children}
    </td>
  ),
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      skipHtml
    >
      {content}
    </ReactMarkdown>
  );
}

/* ─── Theme Toggle Button ─────────────────────────────────────────────── */

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:scale-105 hover:border-slate-300 hover:shadow-md active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === "dark" ? (
          <motion.div
            key="sun"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <Sun size={16} className="text-amber-400" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: 90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <Moon size={16} className="text-slate-600" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function formatConversationTitle(conversation: ConversationSummary) {
  if (conversation.title?.trim()) return conversation.title.trim();
  if (conversation.preview?.trim()) return conversation.preview.trim();
  return "New chat";
}

function toUiMessages(messages: StoredMessage[]): Message[] {
  return messages
    .filter(
      (message): message is StoredMessage & { role: "user" | "assistant" } =>
        message.role === "user" || message.role === "assistant",
    )
    .sort((a, b) => a.message_order - b.message_order)
    .map((message) => ({
      role: message.role,
      content: message.content,
      timestamp: new Date(message.created_at),
    }));
}

function formatReferenceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getMessageReferences(message: Message): MessageReference[] {
  const references = new Map<string, MessageReference>();

  for (const annotation of message.annotations ?? []) {
    if (!annotation.url) continue;

    references.set(annotation.url, {
      url: annotation.url,
      title: annotation.title?.trim() || formatReferenceHost(annotation.url),
      host: formatReferenceHost(annotation.url),
    });
  }

  for (const source of message.sources ?? []) {
    if (!source.url) continue;

    const existing = references.get(source.url);
    references.set(source.url, {
      url: source.url,
      title:
        existing?.title ||
        source.title?.trim() ||
        formatReferenceHost(source.url),
      host: formatReferenceHost(source.url),
    });
  }

  return [...references.values()];
}

function MessageSources({ message }: { message: Message }) {
  const references = getMessageReferences(message);

  if (references.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        Sources
      </p>
      <div className="flex flex-wrap gap-2">
        {references.map((reference) => (
          <a
            key={reference.url}
            href={reference.url}
            target="_blank"
            rel="noreferrer"
            className="group flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{reference.title}</p>
              <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                {reference.host}
              </p>
            </div>
            <ExternalLink
              size={12}
              className="shrink-0 text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

/* ─── Chat Page ───────────────────────────────────────────────────────── */

export default function ChatPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(
    null,
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [chatError, setChatError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const initialLoadDoneRef = useRef(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const refreshConversationList = useCallback(async () => {
    if (!user?.id) return;

    setHistoryError("");

    try {
      const res = await fetch(
        `${apiBase}/api/chat/conversations?user_id=${encodeURIComponent(user.id)}`,
        {
          cache: "no-store",
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to load chat history (${res.status})`);
      }

      const data = (await res.json()) as ConversationSummary[];
      setConversations(data);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Failed to load chat history",
      );
    }
  }, [apiBase, user?.id]);

  const loadConversation = useCallback(
    async (nextConversationId: string) => {
      if (!user?.id || isLoading) return;

      setHistoryError("");
      setChatError("");
      setEditingMessageIndex(null);

      try {
        const res = await fetch(
          `${apiBase}/api/chat/conversations/${nextConversationId}?user_id=${encodeURIComponent(user.id)}`,
          {
            cache: "no-store",
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to load conversation (${res.status})`);
        }

        const data = (await res.json()) as ConversationDetail;
        setConversationId(data.id);
        setMessages(toUiMessages(data.messages));
        setInput("");
        shouldAutoScrollRef.current = true;
      } catch (error) {
        setHistoryError(
          error instanceof Error
            ? error.message
            : "Failed to load conversation",
        );
      }
    },
    [apiBase, isLoading, user?.id],
  );

  const createConversation = useCallback(async () => {
    if (!user?.id || isLoading) return;

    setHistoryError("");
    setChatError("");
    setEditingMessageIndex(null);

    try {
      const res = await fetch(`${apiBase}/api/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          title: "New chat",
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create conversation (${res.status})`);
      }

      const data = (await res.json()) as ConversationDetail;
      setConversationId(data.id);
      setMessages([]);
      setInput("");
      await refreshConversationList();
      shouldAutoScrollRef.current = true;
      textareaRef.current?.focus();
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Failed to create conversation",
      );
    }
  }, [apiBase, isLoading, refreshConversationList, user?.id]);

  const deleteConversation = useCallback(
    async (targetConversationId: string) => {
      if (!user?.id || isLoading) return;

      setHistoryError("");

      try {
        const res = await fetch(
          `${apiBase}/api/chat/conversations/${targetConversationId}?user_id=${encodeURIComponent(user.id)}`,
          {
            method: "DELETE",
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to delete conversation (${res.status})`);
        }

        const remaining = conversations.filter(
          (conversation) => conversation.id !== targetConversationId,
        );
        setConversations(remaining);

        if (conversationId === targetConversationId) {
          setConversationId(null);
          setMessages([]);
          setInput("");
          setEditingMessageIndex(null);
        }
      } catch (error) {
        setHistoryError(
          error instanceof Error
            ? error.message
            : "Failed to delete conversation",
        );
      }
    },
    [apiBase, conversationId, conversations, isLoading, user?.id],
  );

  // Initial history load — runs once when auth resolves, NOT on conversationId changes
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user?.id) {
      setConversations([]);
      setConversationId(null);
      setMessages([]);
      setInput("");
      setIsHistoryLoading(false);
      initialLoadDoneRef.current = false;
      return;
    }

    // Only run the initial load once per user session
    if (initialLoadDoneRef.current) return;

    let cancelled = false;

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryError("");

      try {
        const res = await fetch(
          `${apiBase}/api/chat/conversations?user_id=${encodeURIComponent(user.id)}`,
          {
            cache: "no-store",
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to load chat history (${res.status})`);
        }

        const data = (await res.json()) as ConversationSummary[];
        if (cancelled) return;

        setConversations(data);

        if (data.length > 0) {
          const newestConversationId = data[0].id;
          const detailRes = await fetch(
            `${apiBase}/api/chat/conversations/${newestConversationId}?user_id=${encodeURIComponent(user.id)}`,
            {
              cache: "no-store",
            },
          );

          if (!detailRes.ok) {
            throw new Error(
              `Failed to load conversation (${detailRes.status})`,
            );
          }

          const detail = (await detailRes.json()) as ConversationDetail;
          if (cancelled) return;

          setConversationId(detail.id);
          setMessages(toUiMessages(detail.messages));
        } else {
          setMessages([]);
        }
      } catch (error) {
        if (cancelled) return;
        setHistoryError(
          error instanceof Error
            ? error.message
            : "Failed to load chat history",
        );
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
          initialLoadDoneRef.current = true;
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [apiBase, isAuthLoading, user?.id]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, isLoading, isStreaming, scrollToBottom]);

  const handleChatScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "0";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(
    async (content: string, messageIndexToEdit?: number | null) => {
      if (!content.trim() || isLoading || !user) return;

      setChatError("");
      shouldAutoScrollRef.current = true;

      const trimmedContent = content.trim();
      const isEditing = messageIndexToEdit != null;
      const baseMessages = isEditing
        ? messages.slice(0, messageIndexToEdit)
        : messages;

      const userMessage: Message = {
        role: "user",
        content: trimmedContent,
        timestamp: new Date(),
      };

      const updatedMessages = [...baseMessages, userMessage];
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);
      setInput("");
      setEditingMessageIndex(null);
      setIsLoading(true);
      setIsStreaming(false);

      try {
        const res = await fetch(`${apiBase}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            conversation_id: conversationId,
            edited_message_index: isEditing ? messageIndexToEdit : null,
            title:
              updatedMessages.find((message) => message.role === "user")
                ?.content ?? "New chat",
            messages: updatedMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let streamErrored = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") break;

            let parsed: StreamEventPayload | undefined;

            try {
              parsed = JSON.parse(data) as StreamEventPayload;
            } catch {
              continue;
            }

            if (parsed.conversation_id) {
              setConversationId(parsed.conversation_id);
            }

            if (parsed.error) {
              const message = parsed.error;
              streamErrored = true;
              setChatError(message);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant" && last.content === "") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: message,
                  };
                } else {
                  updated.push({
                    role: "assistant",
                    content: message,
                    timestamp: new Date(),
                  });
                }
                return updated;
              });
              break;
            }

            if (parsed.delta) {
              setIsStreaming(true);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.delta,
                  };
                }
                return updated;
              });
            }

            if (parsed.sources || parsed.annotations) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];

                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    sources: parsed?.sources ?? last.sources,
                    annotations: parsed?.annotations ?? last.annotations,
                  };
                }

                return updated;
              });
            }
          }

          if (streamErrored) {
            break;
          }
        }

        await refreshConversationList();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Sorry, something went wrong. Please try again.";

        setChatError(message);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            updated[updated.length - 1] = {
              ...last,
              content: "Sorry, something went wrong. Please try again.",
            };
          } else {
            updated.push({
              role: "assistant",
              content: "Sorry, something went wrong. Please try again.",
              timestamp: new Date(),
            });
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        textareaRef.current?.focus();
      }
    },
    [
      apiBase,
      conversationId,
      isLoading,
      messages,
      refreshConversationList,
      user?.id,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input, editingMessageIndex);
    }
  };

  const startEditingLastMessage = () => {
    const lastUserMessageIndex = [...messages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => message.role === "user")?.index;

    if (lastUserMessageIndex == null || isLoading) return;

    setInput(messages[lastUserMessageIndex].content);
    setEditingMessageIndex(lastUserMessageIndex);
    shouldAutoScrollRef.current = true;
    textareaRef.current?.focus();
  };

  const cancelEditingLastMessage = () => {
    setInput("");
    setEditingMessageIndex(null);
    textareaRef.current?.focus();
  };

  const lastUserMessageIndex = useMemo(
    () =>
      [...messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => message.role === "user")?.index ?? null,
    [messages],
  );

  const isEditingLastMessage = editingMessageIndex != null;
  const isEmpty = messages.length === 0;
  const selectedConversationTitle = useMemo(() => {
    const selected = conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    return selected ? formatConversationTitle(selected) : "New chat";
  }, [conversationId, conversations]);

  return (
    <PageShell activePage="chat" mainClassName="max-w-none p-0">
      <div className="flex h-[100dvh] min-w-0 bg-[radial-gradient(circle_at_top,_rgba(246,223,95,0.14),_transparent_24%),linear-gradient(180deg,_#fafaf7_0%,_#ffffff_22%,_#ffffff_100%)] transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top,_rgba(246,223,95,0.06),_transparent_24%),linear-gradient(180deg,_#0f1117_0%,_#141720_22%,_#141720_100%)]">
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="hidden h-full shrink-0 overflow-hidden border-r border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-[#11151d]/80 lg:block"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <MessageSquare
                        size={16}
                        className="text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Chat History
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Access your previous conversations
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
                    aria-label="Close chat history"
                  >
                    <PanelLeftClose size={15} />
                  </button>
                </div>

                <div className="px-4 py-4">
                  <button
                    onClick={() => void createConversation()}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-[#F6DF5F] transition-all duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-[#F6DF5F] dark:text-slate-900 dark:hover:bg-[#e5d44a] dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                  >
                    <Plus size={15} />
                    New chat
                  </button>
                </div>

                {historyError && (
                  <div className="px-4 pb-3">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                      {historyError}
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                  {isHistoryLoading ? (
                    <div className="space-y-2 px-1">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={index}
                          className="animate-pulse rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                          <div className="mt-2 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                        </div>
                      ))}
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <MessageSquare
                          size={20}
                          className="text-slate-500 dark:text-slate-400"
                        />
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        No chats yet
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        Start a conversation and it will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {conversations.map((conversation) => {
                        const isSelected = conversation.id === conversationId;

                        return (
                          <button
                            key={conversation.id}
                            onClick={() =>
                              void loadConversation(conversation.id)
                            }
                            className={`group w-full rounded-[22px] border p-4 text-left transition-all duration-200 ${
                              isSelected
                                ? "border-slate-300 bg-slate-100/90 shadow-sm dark:border-slate-600 dark:bg-slate-800/90"
                                : "border-slate-200/80 bg-white/85 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/65 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <MessageSquare size={15} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {formatConversationTitle(conversation)}
                                  </p>
                                  <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                    {conversation.message_count}
                                  </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                  {conversation.preview?.trim() ||
                                    "No messages yet"}
                                </p>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                    {new Date(
                                      conversation.updated_at,
                                    ).toLocaleString()}
                                  </span>
                                  <span
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void deleteConversation(conversation.id);
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                                    role="button"
                                    aria-label="Delete conversation"
                                  >
                                    <Trash2 size={13} />
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative z-10 flex items-center justify-between px-4 pt-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                aria-label={
                  isSidebarOpen ? "Hide chat history" : "Show chat history"
                }
              >
                {isSidebarOpen ? (
                  <PanelLeftClose
                    size={16}
                    className="text-slate-600 dark:text-slate-300"
                  />
                ) : (
                  <PanelLeftOpen
                    size={16}
                    className="text-slate-600 dark:text-slate-300"
                  />
                )}
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedConversationTitle}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {conversationId ? "Saved conversation" : "Unsaved draft"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void createConversation()}
                disabled={isLoading}
                className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white sm:inline-flex"
              >
                <Plus size={14} />
                New chat
              </button>
              <ThemeToggle />
            </div>
          </div>

          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto overscroll-contain"
          >
            <AnimatePresence mode="popLayout">
              {isEmpty ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-6 pb-40 pt-8 text-center"
                >
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800">
                    <Sparkles
                      size={24}
                      className="text-[#b8a730] dark:text-[#e5d44a]"
                    />
                  </div>
                  <h1 className="text-[clamp(2rem,4vw,3.4rem)] font-semibold tracking-[-0.03em] text-slate-900 transition-colors duration-300 dark:text-slate-50">
                    How can I help today?
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500 transition-colors duration-300 dark:text-slate-400">
                    Ask about acquisition strategy, deal quality, financial
                    metrics, diligence, or anything else you want to reason
                    through.
                  </p>
                  <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
                    {SUGGESTED_STARTERS.map((starter) => (
                      <button
                        key={starter.label}
                        onClick={() => void sendMessage(starter.prompt)}
                        className="group rounded-[28px] border border-slate-200/80 bg-white/90 p-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800/60 dark:shadow-[0_10px_30px_rgba(0,0,0,0.2)] dark:hover:border-slate-600 dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 transition-colors group-hover:bg-[#F6DF5F]/20 dark:bg-slate-700/60 dark:group-hover:bg-[#F6DF5F]/10">
                            <starter.icon
                              size={18}
                              className="text-slate-500 transition-colors group-hover:text-[#b8a730] dark:text-slate-400 dark:group-hover:text-[#e5d44a]"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 transition-colors group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white">
                              {starter.label}
                            </p>
                            <p className="mt-1 text-[15px] leading-7 text-slate-500 dark:text-slate-400">
                              {starter.prompt}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="pb-28 pt-8">
                  {messages.map((msg, idx) => {
                    if (
                      msg.role === "assistant" &&
                      msg.content === "" &&
                      isLoading &&
                      !isStreaming
                    ) {
                      return null;
                    }

                    const isUser = msg.role === "user";
                    const canEditThisMessage =
                      isUser && idx === lastUserMessageIndex;

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24 }}
                        className="px-4"
                      >
                        <div
                          className={`mx-auto flex w-full max-w-4xl gap-4 py-6 ${
                            isUser ? "justify-end" : "items-start"
                          }`}
                        >
                          {!isUser && (
                            <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800">
                              <Bot
                                size={15}
                                className="text-slate-700 dark:text-slate-300"
                              />
                            </div>
                          )}
                          <div
                            className={
                              isUser
                                ? "flex max-w-[min(78%,44rem)] flex-col items-end gap-2"
                                : "min-w-0 max-w-3xl flex-1"
                            }
                          >
                            <div
                              className={
                                isUser
                                  ? "whitespace-pre-wrap rounded-[28px] bg-[#414854] px-5 py-3 text-base leading-7 text-white shadow-[0_12px_30px_rgba(15,23,42,0.14)] dark:bg-[#F6DF5F]/90 dark:text-slate-900 dark:shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
                                  : "text-base leading-8 text-slate-800 transition-colors duration-300 dark:text-slate-200"
                              }
                            >
                              {isUser ? (
                                msg.content
                              ) : (
                                <>
                                  <MarkdownMessage content={msg.content} />
                                  <MessageSources message={msg} />
                                </>
                              )}
                            </div>
                            {canEditThisMessage && (
                              <button
                                onClick={startEditingLastMessage}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:text-white"
                              >
                                <Pencil size={12} />
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isLoading && !isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="px-4 pb-28"
                >
                  <div className="mx-auto flex w-full max-w-4xl items-start gap-4 py-2">
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800">
                      <Bot
                        size={15}
                        className="text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center gap-1.5">
                        <motion.span
                          className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.8,
                            delay: 0,
                          }}
                        />
                        <motion.span
                          className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.8,
                            delay: 0.2,
                          }}
                        />
                        <motion.span
                          className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.8,
                            delay: 0.4,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-6" />
          </div>

          <div className="relative px-4 pb-6 pt-4">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/96 to-white/0 transition-colors duration-300 dark:from-[#141720] dark:via-[#141720]/96 dark:to-[#141720]/0" />
            <div className="relative mx-auto w-full max-w-4xl">
              {chatError && (
                <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                  {chatError}
                </div>
              )}
              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 focus-within:border-slate-300 focus-within:shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:focus-within:border-slate-600 dark:focus-within:shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Consensus..."
                  rows={1}
                  className="max-h-48 w-full resize-none bg-transparent px-5 pb-3 pt-4 text-base leading-7 text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <div className="flex items-center justify-between border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700/60">
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Press Enter to send
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      Shift + Enter for a new line
                    </p>
                    {isEditingLastMessage && (
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Editing your last message and regenerating the reply
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingLastMessage && (
                      <button
                        onClick={cancelEditingLastMessage}
                        disabled={isLoading}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        void sendMessage(input, editingMessageIndex)
                      }
                      disabled={
                        !input.trim() || isLoading
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-[#F6DF5F] transition-all duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:bg-[#F6DF5F] dark:text-slate-900 dark:hover:bg-[#e5d44a] dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed bottom-24 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white lg:hidden"
            aria-label="Open chat history"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
      </div>
    </PageShell>
  );
}
