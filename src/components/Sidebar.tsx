import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { Conversation } from "../types/chat";
import { BrandLogo, BrandWordmark } from "./BrandMark";

export type WorkspaceTab = "chat" | "audio";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  activeTab: WorkspaceTab;
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: WorkspaceTab) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const EXTENSIONS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof MessageSquare;
  accent: string;
}> = [
  { id: "chat", label: "Chat", icon: MessageSquare, accent: "text-[#FFC800]" },
  { id: "audio", label: "Audio Creation", icon: Volume2, accent: "text-[#F01271]" },
];

export function Sidebar({
  conversations,
  activeId,
  activeTab,
  isOpen,
  onClose,
  onSelectTab,
  onSelect,
  onNewChat,
  onDelete,
  onClearAll,
}: SidebarProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 shrink-0 bg-[#0D0F17] border-r border-white/8 flex flex-col transition-all duration-200 ease-out overflow-hidden ${
          isOpen
            ? "w-[264px] translate-x-0"
            : "w-[264px] -translate-x-full md:w-0 md:border-r-0 md:translate-x-0"
        }`}
      >
        <div className="w-[264px] h-full flex flex-col">
          <div className="p-4 flex items-center justify-between gap-3 border-b border-white/8">
            <button
              type="button"
              onClick={() => {
                onSelectTab("chat");
                onNewChat();
                onClose();
              }}
              className="flex items-center gap-2.5 text-left min-w-0 focus-visible:outline-2 focus-visible:outline-[#FFC800] rounded-lg cursor-pointer"
            >
              <BrandLogo size="sm" />
              <BrandWordmark size="sm" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#9CA3B4] hover:text-white hover:bg-white/5 cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3 border-b border-white/8">
            <button
              type="button"
              onClick={() => {
                onSelectTab("chat");
                onNewChat();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F01271] hover:bg-[#D90D64] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC800]"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>

            {/* Extensions */}
            <div className="space-y-1">
              <div className="px-2 pb-1 text-xs font-medium text-[#7F879B]">
                Extensions
              </div>
              {EXTENSIONS.map((ext) => {
                const Icon = ext.icon;
                const active = activeTab === ext.id;
                return (
                  <button
                    key={ext.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(ext.id);
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? "bg-[#181B27] text-white border border-white/10"
                        : "text-[#B5BCCB] hover:bg-white/[0.04] hover:text-white border border-transparent"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? ext.accent : "text-[#7F879B]"}`} />
                    <span>{ext.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1">
            <div className="px-2 pb-1 text-xs font-medium text-[#7F879B]">
              Chats
            </div>
            {conversations.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#788096]">
                No chats yet.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeTab === "chat" && conv.id === activeId;
                return (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                      isActive
                        ? "bg-[#181B27] text-white border border-white/10"
                        : "text-[#B5BCCB] hover:bg-white/[0.04] hover:text-white border border-transparent"
                    }`}
                  >
                    <MessageSquare
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-[#F01271]" : "text-[#6F778C]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTab("chat");
                        onSelect(conv.id);
                        if (window.innerWidth < 768) onClose();
                      }}
                      className="flex-1 text-left text-sm font-medium truncate focus-visible:outline-none cursor-pointer"
                    >
                      {conv.title}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className={`p-1 rounded-lg text-[#7F879B] hover:text-[#F01271] hover:bg-white/5 transition-opacity shrink-0 ${
                        isActive
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      }`}
                      aria-label="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {conversations.length > 0 && (
            <div className="p-3 border-t border-white/8">
              {confirmClear ? (
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[#161926] border border-white/10">
                  <span className="text-xs text-[#D1D5E2]">Clear all?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClearAll();
                        setConfirmClear(false);
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[#F01271] text-white hover:bg-[#D90D64]"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg text-[#9CA3B4] hover:text-white hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#8C94AA] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Chats</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
