import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { AudioStudio } from "./components/AudioStudio";
import { BrandLogo, BrandWordmark } from "./components/BrandMark";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessageList } from "./components/ChatMessageList";
import { Sidebar, type WorkspaceTab } from "./components/Sidebar";
import { WelcomeCanvas } from "./components/WelcomeCanvas";
import type { ChatAttachment, ChatMessage, Conversation } from "./types/chat";

const STORAGE_KEY = "build-buds:conversations:v1";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyConversation(): Conversation {
  const now = Date.now();
  return {
    id: createId(),
    title: "New Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadSavedConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MAX_IMAGE_DIM = 896;
const IMAGE_JPEG_QUALITY = 0.78;

async function readPictureFile(file: File): Promise<ChatAttachment | null> {
  if (!file.type.startsWith("image/")) return null;

  // Compress & resize non-GIF images via offscreen canvas for instant upload & fast AI vision
  if (file.type !== "image/gif" && typeof document !== "undefined") {
    try {
      const bitmap = await createImageBitmap(file);
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = longest > MAX_IMAGE_DIM ? MAX_IMAGE_DIM / longest : 1;
      const targetW = Math.max(1, Math.round(bitmap.width * scale));
      const targetH = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        bitmap.close();
        const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY);
        const commaIdx = dataUrl.indexOf(",");
        if (commaIdx !== -1) {
          const base64 = dataUrl.slice(commaIdx + 1);
          return {
            id: createId(),
            kind: "image",
            name: file.name || "picture.jpg",
            mimeType: "image/jpeg",
            size: Math.round((base64.length * 3) / 4),
            dataUrl,
            base64,
          };
        }
      } else {
        bitmap.close();
      }
    } catch {
      // Fall back to FileReader if createImageBitmap fails for an exotic format
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const commaIdx = dataUrl.indexOf(",");
      if (!dataUrl || commaIdx === -1) {
        resolve(null);
        return;
      }
      resolve({
        id: createId(),
        kind: "image",
        name: file.name || "picture.png",
        mimeType: file.type,
        size: file.size,
        dataUrl,
        base64: dataUrl.slice(commaIdx + 1),
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function readGenericFile(file: File): Promise<ChatAttachment | null> {
  if (file.type.startsWith("image/")) {
    return readPictureFile(file);
  }
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        const commaIdx = dataUrl.indexOf(",");
        if (!dataUrl || commaIdx === -1) {
          resolve(null);
          return;
        }
        resolve({
          id: createId(),
          kind: "file",
          name: file.name || "document.pdf",
          mimeType: "application/pdf",
          size: file.size,
          base64: dataUrl.slice(commaIdx + 1),
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const textContent =
        typeof reader.result === "string" ? reader.result.slice(0, 120000) : "";
      resolve({
        id: createId(),
        kind: "file",
        name: file.name || "file.txt",
        mimeType: file.type || "text/plain",
        size: file.size,
        textContent,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadSavedConversations()
  );
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadSavedConversations();
    return saved.length > 0 ? saved[0].id : null;
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );

  const abortRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      try {
        const stripped = conversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({ ...m, attachments: undefined })),
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
      } catch {
        // Ignore storage errors
      }
    }
  }, [conversations]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !shouldAutoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [activeConversation?.messages]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleNewChat = useCallback(() => {
    stopStreaming();
    setActiveId(null);
    setInput("");
    setAttachments([]);
  }, [stopStreaming]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeId) return;
      stopStreaming();
      setActiveId(id);
      shouldAutoScrollRef.current = true;
    },
    [activeId, stopStreaming]
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (id === activeId) {
        stopStreaming();
      }
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) {
          setActiveId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    },
    [activeId, stopStreaming]
  );

  const handleClearAll = useCallback(() => {
    stopStreaming();
    setConversations([]);
    setActiveId(null);
  }, [stopStreaming]);

  const handleUploadPictures = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 4);
    const results = await Promise.all(list.map(readPictureFile));
    const valid = results.filter((a): a is ChatAttachment => a !== null);
    if (valid.length > 0) {
      setAttachments((prev) => [...prev, ...valid].slice(0, 6));
    }
  }, []);

  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 4);
    const results = await Promise.all(list.map(readGenericFile));
    const valid = results.filter((a): a is ChatAttachment => a !== null);
    if (valid.length > 0) {
      setAttachments((prev) => [...prev, ...valid].slice(0, 6));
    }
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const autoGenerateTitle = useCallback(
    async (convId: string, firstPrompt: string) => {
      try {
        const res = await fetch("/api/chat/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: firstPrompt }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { title?: string };
        if (data.title) {
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title: data.title! } : c))
          );
        }
      } catch {
        // Non-critical title naming failure
      }
    },
    []
  );

  const runStreamTurn = useCallback(
    async ({
      convId,
      historyMessages,
      userMessage,
      shouldAutoTitle,
    }: {
      convId: string;
      historyMessages: ChatMessage[];
      userMessage: ChatMessage;
      shouldAutoTitle: boolean;
    }) => {
      const assistantId = createId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "model",
        content: "",
        createdAt: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [...historyMessages, userMessage, assistantPlaceholder],
                updatedAt: Date.now(),
              }
            : c
        )
      );

      shouldAutoScrollRef.current = true;
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const serializeAtts = (atts?: ChatAttachment[]) =>
          atts?.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            base64: a.base64,
            textContent: a.textContent,
          }));

        const validHistory = historyMessages.filter(
          (m) => !m.error && (m.content || m.attachments?.length)
        );
        const recentStartIdx = Math.max(0, validHistory.length - 4);
        const historyPayload = validHistory.map((m, idx) => ({
          role: m.role,
          content:
            m.content ||
            (m.attachments?.length && idx < recentStartIdx
              ? `[Previously shared ${m.attachments.map((a) => a.name).join(", ")}]`
              : ""),
          // Only re-send heavy image/file blobs from the latest 2 turns to keep multi-turn chats instant
          attachments: idx >= recentStartIdx ? serializeAtts(m.attachments) : undefined,
        }));

        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: userMessage.content,
            attachments: serializeAtts(userMessage.attachments),
            history: historyPayload,
          }),
        });

        if (!res.ok || !res.body) {
          let errMsg = `Request failed (${res.status})`;
          try {
            const errJson = (await res.json()) as { error?: string };
            if (errJson.error) errMsg = errJson.error;
          } catch {
            // Keep HTTP status fallback
          }
          throw new Error(errMsg);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payloadRaw = line.slice(6).trim();
              if (!payloadRaw) continue;
              const parsed = JSON.parse(payloadRaw) as {
                text?: string;
                error?: string;
                done?: boolean;
              };

              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulated += parsed.text;
                const snapshot = accumulated;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          updatedAt: Date.now(),
                          messages: c.messages.map((m) =>
                            m.id === assistantId ? { ...m, content: snapshot } : m
                          ),
                        }
                      : c
                  )
                );
              }
            }
          }
        }

        if (shouldAutoTitle) {
          const titleSeed =
            userMessage.content ||
            userMessage.attachments?.[0]?.name ||
            "New Chat";
          void autoGenerateTitle(convId, titleSeed);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: c.messages.filter(
                      (m) => m.id !== assistantId || m.content.trim().length > 0
                    ),
                  }
                : c
            )
          );
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong reaching Build Buds.";
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, error: message } : m
                  ),
                }
              : c
          )
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [autoGenerateTitle]
  );

  const sendMessage = useCallback(async () => {
    if (isStreaming) return;

    const textToSend = input.trim();
    const attsToSend = attachments;
    if (!textToSend && attsToSend.length === 0) return;

    let targetConv = activeConversation;
    let isFirstTurn = false;

    if (!targetConv) {
      isFirstTurn = true;
      targetConv = createEmptyConversation();
      const seed = textToSend || attsToSend[0]?.name || "New Chat";
      targetConv.title = seed.slice(0, 40) + (seed.length > 40 ? "…" : "");
      setConversations((prev) => [targetConv!, ...prev]);
      setActiveId(targetConv.id);
    } else if (targetConv.messages.length === 0) {
      isFirstTurn = true;
    }

    setInput("");
    setAttachments([]);

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: textToSend,
      attachments: attsToSend.length > 0 ? attsToSend : undefined,
      createdAt: Date.now(),
    };

    await runStreamTurn({
      convId: targetConv.id,
      historyMessages: targetConv.messages,
      userMessage,
      shouldAutoTitle: isFirstTurn,
    });
  }, [activeConversation, attachments, input, isStreaming, runStreamTurn]);

  const handleRegenerateOrRetry = useCallback(async () => {
    if (!activeConversation || isStreaming) return;
    const msgs = activeConversation.messages;
    if (msgs.length === 0) return;

    let lastUserIndex = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return;

    const userMsg = msgs[lastUserIndex];
    const priorHistory = msgs.slice(0, lastUserIndex);

    await runStreamTurn({
      convId: activeConversation.id,
      historyMessages: priorHistory,
      userMessage: userMsg,
      shouldAutoTitle: false,
    });
  }, [activeConversation, isStreaming, runStreamTurn]);

  const hasMessages = Boolean(
    activeConversation && activeConversation.messages.length > 0
  );

  const secondaryLabel =
    activeTab === "audio"
      ? "Audio Creation"
      : activeConversation
      ? activeConversation.title
      : null;

  return (
    <div className="h-dvh w-full flex overflow-hidden bg-[#090A0F] text-[#F3F4F8]">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        activeTab={activeTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectTab={setActiveTab}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConversation}
        onClearAll={handleClearAll}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-white/8 flex items-center justify-between gap-4 bg-[#090A0F]/90 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="p-2 -ml-2 rounded-lg text-[#9CA3B4] hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("chat");
                handleNewChat();
              }}
              className="flex items-center gap-2.5 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FFC800] rounded-lg"
            >
              <BrandLogo size="xs" />
              <BrandWordmark size="sm" />
            </button>
          </div>

          {secondaryLabel && (
            <div className="text-xs font-medium text-[#8E96AA] truncate max-w-[220px] sm:max-w-xs">
              {secondaryLabel}
            </div>
          )}
        </header>

        {activeTab === "audio" ? (
          <AudioStudio />
        ) : (
          <>
            <main
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto flex flex-col"
            >
              {hasMessages && activeConversation ? (
                <ChatMessageList
                  messages={activeConversation.messages}
                  isStreaming={isStreaming}
                  onRegenerate={handleRegenerateOrRetry}
                  onRetryLast={handleRegenerateOrRetry}
                />
              ) : (
                <WelcomeCanvas />
              )}
            </main>

            <ChatComposer
              input={input}
              onInputChange={setInput}
              attachments={attachments}
              onUploadFiles={handleUploadFiles}
              onUploadPictures={handleUploadPictures}
              onRemoveAttachment={handleRemoveAttachment}
              onOpenAudio={() => setActiveTab("audio")}
              isStreaming={isStreaming}
              onSend={() => void sendMessage()}
              onStop={stopStreaming}
            />
          </>
        )}
      </div>
    </div>
  );
}
