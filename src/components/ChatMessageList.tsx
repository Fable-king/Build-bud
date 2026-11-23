import { useState } from "react";
import {
  AlertCircle,
  Brain,
  Check,
  Copy,
  FileText,
  RotateCcw,
} from "lucide-react";
import type { ChatMessage } from "../types/chat";
import { BrandLogo } from "./BrandMark";
import { MarkdownMessage } from "./MarkdownMessage";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onRegenerate: () => void;
  onRetryLast: () => void;
}

function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessageList({
  messages,
  isStreaming,
  onRegenerate,
  onRetryLast,
}: ChatMessageListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {messages.map((msg, idx) => {
        const isUser = msg.role === "user";
        const isLast = idx === messages.length - 1;
        const isActivelyStreaming = !isUser && isLast && isStreaming;

        if (isUser) {
          return (
            <div key={msg.id} className="flex justify-end gap-3">
              <div className="max-w-[85%] sm:max-w-[78%] flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1.5 text-xs text-[#8E96AA]">
                  <span className="font-medium text-[#FFC800]">You</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[11px]">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>

                <div className="rounded-2xl rounded-tr-sm bg-[#151824] border border-[#FFC800]/20 px-4 py-3 text-[15px] leading-relaxed text-[#F3F4F8] whitespace-pre-wrap break-words">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2.5">
                      {msg.attachments.map((att) =>
                        att.kind === "image" && att.dataUrl ? (
                          <img
                            key={att.id}
                            src={att.dataUrl}
                            alt={att.name}
                            referrerPolicy="no-referrer"
                            className="max-h-52 rounded-xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div
                            key={att.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0B0D14] border border-white/10 px-3 py-1.5 text-xs text-[#E6E8F0]"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#FFC800] shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {att.name}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>

              <div
                className="w-9 h-9 rounded-xl bg-[#FFC800]/15 border border-[#FFC800]/35 flex items-center justify-center shrink-0 mt-6"
                aria-hidden="true"
              >
                <Brain className="w-4 h-4 text-[#FFC800]" />
              </div>
            </div>
          );
        }

        return (
          <div key={msg.id} className="flex items-start gap-3.5">
            <BrandLogo
              size="xs"
              className="border border-white/10 mt-0.5"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 text-xs text-[#8E96AA]">
                <span className="font-semibold text-white">Build Buds</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[11px]">
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>

              {msg.error ? (
                <div className="rounded-2xl bg-[#1A1219] border border-[#F01271]/40 px-4 py-3.5 text-sm text-[#FFD2E3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[#F01271] shrink-0 mt-0.5" />
                    <span>{msg.error}</span>
                  </div>
                  {isLast && !isStreaming && (
                    <button
                      type="button"
                      onClick={onRetryLast}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F01271] hover:bg-[#D90D64] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="min-h-[24px]">
                  {msg.content ? (
                    <MarkdownMessage content={msg.content} />
                  ) : isActivelyStreaming ? (
                    <div className="flex items-center gap-2 text-sm text-[#9CA3B4] py-1">
                      <span className="inline-block w-2 h-4 rounded-xs bg-[#F01271] animate-pulse" />
                      <span>Replying...</span>
                    </div>
                  ) : null}
                </div>
              )}

              {!msg.error && msg.content && !isActivelyStreaming && (
                <div className="flex items-center gap-1 mt-3">
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#8E96AA] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                    aria-label="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#FFC800]" />
                        <span className="text-[#FFC800]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {isLast && !isStreaming && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#8E96AA] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                      aria-label="Regenerate response"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Regenerate</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
