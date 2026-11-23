import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  FileText,
  Image as ImageIcon,
  Plus,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";
import type { ChatAttachment } from "../types/chat";

interface ChatComposerProps {
  input: string;
  onInputChange: (val: string) => void;
  attachments: ChatAttachment[];
  onUploadFiles: (files: FileList | File[]) => void;
  onUploadPictures: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onOpenAudio: () => void;
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatComposer({
  input,
  onInputChange,
  attachments,
  onUploadFiles,
  onUploadPictures,
  onRemoveAttachment,
  onOpenAudio,
  isStreaming,
  onSend,
  onStop,
}: ChatComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pictureInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && (input.trim() || attachments.length > 0)) {
        onSend();
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handlePictureChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadPictures(e.target.files);
      e.target.value = "";
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.files;
    if (items && items.length > 0) {
      const imageFiles = Array.from(items).filter((f) =>
        f.type.startsWith("image/")
      );
      if (imageFiles.length > 0) {
        onUploadPictures(imageFiles);
      }
    }
  };

  const canSend =
    !isStreaming && (input.trim().length > 0 || attachments.length > 0);

  return (
    <div className="shrink-0 bg-[#090A0F] px-4 sm:px-6 pt-2 pb-5">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl bg-[#11131C] border border-white/10 focus-within:border-[#FFC800]/60 transition-colors p-2.5">
          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5 px-1.5 pt-1 pb-2 border-b border-white/8">
              {attachments.map((att) =>
                att.kind === "image" && att.dataUrl ? (
                  <div
                    key={att.id}
                    className="relative rounded-xl overflow-hidden border border-white/12 bg-[#090A0F]"
                  >
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/80 text-white hover:bg-[#F01271] transition-colors cursor-pointer"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-xl bg-[#0B0D14] border border-white/12 px-3 py-2 text-xs text-white max-w-[220px]"
                  >
                    <FileText className="w-4 h-4 text-[#FFC800] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{att.name}</div>
                      <div className="text-[11px] text-[#7F879B] font-mono tabular-nums">
                        {formatBytes(att.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      className="p-1 rounded-md text-[#8E96AA] hover:text-[#F01271] transition-colors shrink-0 cursor-pointer"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.xml,.yaml,.yml,.pdf,text/*,application/json,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={pictureInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handlePictureChange}
            className="hidden"
          />

          <div className="flex items-end gap-2">
            {/* Left + Button & Popover */}
            <div ref={menuContainerRef} className="relative shrink-0">
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    role="menu"
                    aria-label="Chat actions"
                    className="absolute bottom-13 left-0 z-30 w-48 rounded-2xl bg-[#151824] border border-white/12 p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenAudio();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/[0.06] transition-colors text-left cursor-pointer whitespace-nowrap"
                    >
                      <Volume2 className="w-4 h-4 text-[#F01271] shrink-0" />
                      <span>Create audio</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/[0.06] transition-colors text-left cursor-pointer whitespace-nowrap"
                    >
                      <FileText className="w-4 h-4 text-[#FFC800] shrink-0" />
                      <span>Upload file</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        pictureInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/[0.06] transition-colors text-left cursor-pointer whitespace-nowrap"
                    >
                      <ImageIcon className="w-4 h-4 text-[#FF7A1A] shrink-0" />
                      <span>Upload pictures</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                disabled={isStreaming}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Add attachment or create audio"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                  menuOpen
                    ? "bg-[#1D2132] text-[#FFC800]"
                    : "bg-white/[0.05] hover:bg-white/10 text-[#C8CDDC] hover:text-white"
                }`}
              >
                <Plus
                  className={`w-5 h-5 transition-transform duration-150 ${
                    menuOpen ? "rotate-45" : ""
                  }`}
                />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                onInputChange(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message Build Buds..."
              aria-label="Message Build Buds"
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-[#6F778C] resize-none py-2 px-1 max-h-[180px] focus:outline-none leading-relaxed"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-current text-[#F01271]" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSend();
                  if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                  }
                }}
                disabled={!canSend}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F01271] hover:bg-[#D90D64] disabled:bg-white/8 disabled:text-[#6F778C] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC800]"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
