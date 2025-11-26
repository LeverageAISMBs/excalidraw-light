/**
 * Minimal real-world demo: One Durable Object instance per entity (User, ChatBoard), with Indexes for listing.
 */
import { IndexedEntity } from "./core-utils";
import type { User, Chat, ChatMessage, Drawing, Op, DrawingElement, Presence, StrokeElement, RectangleElement, EllipseElement, LineElement, ArrowElement, TextElement } from "@shared/types";
import { MOCK_CHAT_MESSAGES, MOCK_CHATS, MOCK_USERS, MOCK_DRAWINGS } from "@shared/mock-data";
// USER ENTITY: one DO instance per user
export class UserEntity extends IndexedEntity<User> {
  static readonly entityName = "user";
  static readonly indexName = "users";
  static readonly initialState: User = { id: "", name: "" };
  static seedData = MOCK_USERS;
}
// CHAT BOARD ENTITY: one DO instance per chat board, stores its own messages
export type ChatBoardState = Chat & { messages: ChatMessage[] };
const SEED_CHAT_BOARDS: ChatBoardState[] = MOCK_CHATS.map(c => ({
  ...c,
  messages: MOCK_CHAT_MESSAGES.filter(m => m.chatId === c.id),
}));
export class ChatBoardEntity extends IndexedEntity<ChatBoardState> {
  static readonly entityName = "chat";
  static readonly indexName = "chats";
  static readonly initialState: ChatBoardState = { id: "", title: "", messages: [] };
  static seedData = SEED_CHAT_BOARDS;
  async listMessages(): Promise<ChatMessage[]> {
    const { messages } = await this.getState();
    return messages;
  }
  async sendMessage(userId: string, text: string): Promise<ChatMessage> {
    const msg: ChatMessage = { id: crypto.randomUUID(), chatId: this.id, userId, text, ts: Date.now() };
    await this.mutate(s => ({ ...s, messages: [...s.messages, msg] }));
    return msg;
  }
}
// Helper to apply ops to an element list with type safety
function applyOpsToElements(ops: Op[], initialElements: DrawingElement[] = []): DrawingElement[] {
  const elementsMap = new Map(initialElements.map(el => [el.id, el]));
  ops.forEach(op => {
    switch (op.type) {
      case 'add':
        if (op.data && typeof op.data === 'object' && 'type' in op.data && 'id' in op.data) {
          const el = op.data as DrawingElement;
          // Use discriminated union type guards
          switch (el.type) {
            case 'stroke':
              if ('points' in el) elementsMap.set(el.id, el as StrokeElement);
              break;
            case 'rectangle':
              if ('fillColor' in el) elementsMap.set(el.id, el as RectangleElement);
              break;
            case 'ellipse':
              if ('fillColor' in el) elementsMap.set(el.id, el as EllipseElement);
              break;
            case 'line':
              if ('points' in el) elementsMap.set(el.id, el as LineElement);
              break;
            case 'arrow':
              if ('points' in el) elementsMap.set(el.id, el as ArrowElement);
              break;
            case 'text':
              if ('text' in el) elementsMap.set(el.id, el as TextElement);
              break;
            default:
              console.warn('Invalid element type in op data:', el);
          }
        }
        break;
      case 'update':
        if (op.elementId && op.data && elementsMap.has(op.elementId)) {
          const existing = elementsMap.get(op.elementId)!;
          const updatedElement = { ...existing, ...op.data };
          elementsMap.set(op.elementId, updatedElement as DrawingElement);
        }
        break;
      case 'delete':
        if (op.elementId && elementsMap.has(op.elementId)) {
          elementsMap.delete(op.elementId);
        }
        break;
    }
  });
  return Array.from(elementsMap.values());
}
// DRAWING ENTITY
export class DrawingEntity extends IndexedEntity<Drawing> {
  static readonly entityName = "drawing";
  static readonly indexName = "drawings";
  static readonly initialState: Drawing = { id: "", title: "Untitled", elements: [], updatedAt: 0, ops: [], opVersion: 0, presences: [] };
  static seedData = MOCK_DRAWINGS;
  async appendOps(ops: Op[]): Promise<void> {
    if (ops.length === 0) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sortedOps = ops.sort((a, b) => a.ts - b.ts);
        await this.mutate(s => {
          const newElements = applyOpsToElements(sortedOps, s.elements);
          const allOps = [...(s.ops || []), ...sortedOps];
          return {
            ...s,
            elements: newElements,
            ops: allOps,
            opVersion: (s.opVersion || 0) + sortedOps.length,
            updatedAt: Date.now(),
          };
        });
        return; // Success
      } catch (err: any) {
        if (err.message.includes('Concurrent') && attempt < 2) {
          console.warn(`DO contention on appendOps (attempt ${attempt + 1}), retrying...`);
          await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
          continue;
        }
        throw err;
      }
    }
  }
  async getOpsSince(version: number): Promise<Op[]> {
    const state = await this.getState();
    return (state.ops || []).slice(version);
  }
  async updatePresence(presence: Presence): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.mutate(s => {
          const now = Date.now();
          const presences = (s.presences || []).filter(p => p.userId !== presence.userId && (now - p.lastSeen < 30000)); // Keep active users
          presences.push({ ...presence, lastSeen: now });
          return { ...s, presences };
        });
        return; // Success
      } catch (err: any) {
        if (err.message.includes('Concurrent') && attempt < 2) {
          console.warn(`DO contention on updatePresence (attempt ${attempt + 1}), retrying...`);
          await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
          continue;
        }
        throw err;
      }
    }
  }
  async getPresences(): Promise<Presence[]> {
    const state = await this.getState();
    const now = Date.now();
    return (state.presences || []).filter(p => now - p.lastSeen < 30000);
  }
}