/**
 * Minimal real-world demo: One Durable Object instance per entity (User, ChatBoard), with Indexes for listing.
 */
import { IndexedEntity } from "./core-utils";
import type { User, Chat, ChatMessage, Drawing, Op, DrawingElement, Presence } from "@shared/types";
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
        if (op.data && 'id' in op.data && 'type' in op.data) {
          const el = op.data as DrawingElement;
          // Type guard to ensure it's a valid element
          if (typeof el.id === 'string' && typeof el.type === 'string') {
            elementsMap.set(el.id, el);
          }
        }
        break;
      case 'update':
        if (op.elementId && op.data) {
          const existing = elementsMap.get(op.elementId);
          if (existing) {
            const updatedElement = { ...existing, ...op.data };
            elementsMap.set(op.elementId, updatedElement);
          }
        }
        break;
      case 'delete':
        if (op.elementId) {
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
    // Sort incoming ops by timestamp to ensure deterministic order
    const sortedOps = ops.sort((a, b) => a.ts - b.ts);
    await this.mutate(s => {
      const newElements = applyOpsToElements(sortedOps, s.elements);
      const allOps = [...(s.ops || []), ...sortedOps];
      return {
        ...s,
        elements: newElements,
        ops: allOps,
        opVersion: s.opVersion + sortedOps.length,
        updatedAt: Date.now(),
      };
    });
  }
  async getOpsSince(version: number): Promise<Op[]> {
    const state = await this.getState();
    return (state.ops || []).slice(version);
  }
  async updatePresence(presence: Presence): Promise<void> {
    await this.mutate(s => {
      const now = Date.now();
      const presences = (s.presences || []).filter(p => p.userId !== presence.userId && (now - p.lastSeen < 30000)); // Keep active users
      presences.push({ ...presence, lastSeen: now });
      return { ...s, presences };
    });
  }
  async getPresences(): Promise<Presence[]> {
    const state = await this.getState();
    const now = Date.now();
    return (state.presences || []).filter(p => now - p.lastSeen < 30000);
  }
}