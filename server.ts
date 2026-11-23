import "dotenv/config";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = "gemini-3.1-flash-lite";

const SYSTEM_INSTRUCTION =
  "You are Build Buds, a helpful, friendly, and clear AI chat assistant. Respond naturally, accurately, and concisely, using clean formatting when helpful.";

let cachedClient: GoogleGenAI | null = null;
let cachedBetaClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets."
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedClient;
}

function getBetaAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets."
    );
  }
  if (!cachedBetaClient) {
    cachedBetaClient = new GoogleGenAI({
      apiKey,
      apiVersion: "v1beta",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedBetaClient;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (rawMessage.includes("GEMINI_API_KEY is not configured")) {
    return { status: 500, message: rawMessage };
  }
  if (rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("403")) {
    return {
      status: 403,
      message:
        "Permission denied by the Gemini API. Please verify your API key in Settings > Secrets.",
    };
  }
  if (
    rawMessage.includes("API_KEY_INVALID") ||
    rawMessage.includes("API key not valid")
  ) {
    return {
      status: 400,
      message:
        "The Gemini API key was rejected. Please check Settings > Secrets.",
    };
  }
  if (rawMessage.includes("400") || rawMessage.includes("INVALID_ARGUMENT")) {
    return {
      status: 400,
      message: rawMessage,
    };
  }
  if (rawMessage.includes("RESOURCE_EXHAUSTED") || rawMessage.includes("429")) {
    return {
      status: 429,
      message:
        "Rate limit or quota reached on the Gemini API. Please wait a moment and try again.",
    };
  }
  if (rawMessage.includes("NOT_FOUND") || rawMessage.includes("404")) {
    return {
      status: 404,
      message: rawMessage,
    };
  }
  return {
    status: 500,
    message: rawMessage || "Failed to reach the Gemini service.",
  };
}

interface IncomingAttachment {
  name?: string;
  mimeType?: string;
  base64?: string;
  textContent?: string;
}

interface IncomingHistoryItem {
  role: "user" | "model";
  content: string;
  attachments?: IncomingAttachment[];
}

interface StreamChatBody {
  message?: string;
  attachments?: IncomingAttachment[];
  history?: IncomingHistoryItem[];
}

function buildUserParts(
  text: string,
  attachments?: IncomingAttachment[]
): Part[] {
  const parts: Part[] = [];
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (!att) continue;
      if (att.textContent && att.textContent.length > 0) {
        parts.push({
          text: `[Attached file: ${att.name || "document"}]\n${att.textContent}`,
        });
      } else if (att.mimeType && att.base64) {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.base64,
          },
        });
      }
    }
  }
  if (text) {
    parts.push({ text });
  } else if (parts.length > 0) {
    parts.push({ text: "Look at this attachment and respond clearly and concisely." });
  }
  return parts;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as StreamChatBody;
    const messageText =
      typeof body.message === "string" ? body.message.trim() : "";
    const currentAttachments = Array.isArray(body.attachments)
      ? body.attachments
      : [];

    if (!messageText && currentAttachments.length === 0) {
      res
        .status(400)
        .json({ error: "Message text or an attachment is required." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let closed = false;
    res.on("close", () => {
      closed = true;
    });

    try {
      const ai = getAiClient();

      const contents: Content[] = [];
      if (Array.isArray(body.history)) {
        for (const item of body.history) {
          if (!item || (item.role !== "user" && item.role !== "model")) {
            continue;
          }
          const parts =
            item.role === "user"
              ? buildUserParts(
                  typeof item.content === "string" ? item.content : "",
                  item.attachments
                )
              : typeof item.content === "string" && item.content.length > 0
              ? [{ text: item.content }]
              : [];

          if (parts.length > 0) {
            contents.push({
              role: item.role,
              parts,
            });
          }
        }
      }

      const currentParts = buildUserParts(messageText, currentAttachments);
      contents.push({
        role: "user",
        parts: currentParts,
      });

      const stream = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      });

      for await (const chunk of stream) {
        if (closed) break;
        const c = chunk as GenerateContentResponse;
        const text = c.text ?? "";
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      if (!closed) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (err) {
      const formatted = formatApiError(err);
      if (!closed) {
        res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/chat/title", async (req: Request, res: Response) => {
    try {
      const { prompt } = (req.body ?? {}) as { prompt?: string };
      if (!prompt || typeof prompt !== "string") {
        res.status(400).json({ error: "Prompt is required." });
        return;
      }
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Summarize this user prompt into a concise 3 to 5 word title without quotes or trailing punctuation:\n\n${prompt.slice(0, 400)}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      });
      const title = (response.text ?? "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim()
        .slice(0, 60);
      res.json({ title: title || "New Chat" });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/audio/generate", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        mode?: "single" | "dialogue";
        text?: string;
        voice?: string;
        style?: string;
        speaker1Name?: string;
        speaker1Voice?: string;
        speaker1Style?: string;
        speaker1Text?: string;
        speaker2Name?: string;
        speaker2Voice?: string;
        speaker2Style?: string;
        speaker2Text?: string;
      };

      const validVoices = new Set(["Puck", "Charon", "Kore", "Fenrir", "Zephyr"]);
      const pickVoice = (v?: string, fallback = "Kore") =>
        v && validVoices.has(v) ? v : fallback;

      const ai = getBetaAiClient();

      if (body.mode === "dialogue") {
        const s1Name = (body.speaker1Name || "Alex").trim() || "Alex";
        const s2Name = (body.speaker2Name || "Sam").trim() || "Sam";
        const line1 = (body.speaker1Text || "").trim();
        const line2 = (body.speaker2Text || "").trim();
        if (!line1 || !line2) {
          res.status(400).json({
            error: "Both speaker lines are required for dialogue mode.",
          });
          return;
        }

        const interaction = await ai.interactions.create({
          model: "gemini-3.8-flash-tts",
          input: [
            {
              type: "text",
              text: `${s1Name}: ${line1}`,
              annotations: [
                {
                  type: "speech_metadata",
                  speaker: s1Name,
                  style: (body.speaker1Style || "Warm, expressive host").trim(),
                },
              ],
            },
            {
              type: "text",
              text: `${s2Name}: ${line2}`,
              annotations: [
                {
                  type: "speech_metadata",
                  speaker: s2Name,
                  style: (
                    body.speaker2Style || "Curious, articulate co-host"
                  ).trim(),
                },
              ],
            },
          ],
          response_format: { type: "audio" },
          generation_config: {
            speech_config: {
              speakers: [
                {
                  speaker: s1Name,
                  voice: pickVoice(body.speaker1Voice, "Puck"),
                },
                {
                  speaker: s2Name,
                  voice: pickVoice(body.speaker2Voice, "Kore"),
                },
              ],
            },
          },
        });

        const audio = interaction.output_audio;
        if (!audio?.data) {
          res.status(502).json({
            error: "Audio model did not return audio data. Please try again.",
          });
          return;
        }
        res.json({
          audioDataUrl: `data:${audio.mime_type || "audio/wav"};base64,${audio.data}`,
          mimeType: audio.mime_type || "audio/wav",
        });
        return;
      }

      const text = (body.text || "").trim();
      if (!text) {
        res.status(400).json({ error: "Please enter text to synthesize." });
        return;
      }

      const voiceName = pickVoice(body.voice, "Kore");
      const style = (body.style || "").trim();

      const interaction = await ai.interactions.create({
        model: "gemini-3.8-flash-lite-tts",
        input: [
          {
            type: "text",
            text,
            ...(style
              ? {
                  annotations: [
                    {
                      type: "speech_metadata",
                      style,
                    },
                  ],
                }
              : {}),
          },
        ],
        response_format: { type: "audio" },
        generation_config: {
          speech_config: [
            {
              language: "en-US",
              voice: voiceName,
            },
          ],
        },
      });

      const audio = interaction.output_audio;
      if (!audio?.data) {
        res.status(502).json({
          error: "Audio model did not return audio data. Please try again.",
        });
        return;
      }

      res.json({
        audioDataUrl: `data:${audio.mime_type || "audio/wav"};base64,${audio.data}`,
        mimeType: audio.mime_type || "audio/wav",
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Build Buds server running at http://localhost:${PORT}`);
  });
}

startServer();
