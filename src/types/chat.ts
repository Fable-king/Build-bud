export interface ChatAttachment {
  id: string;
  kind: "image" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  base64?: string;
  textContent?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  attachments?: ChatAttachment[];
  createdAt: number;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
