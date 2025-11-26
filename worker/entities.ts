/**
 * Minimal real-world demo: One Durable Object instance per entity (User, ChatBoard), with Indexes for listing.
 */
import { IndexedEntity } from "./core-utils";
import type { User, Chat, ChatMessage, Drawing, Op, DrawingElement, StrokeElement, RectangleElement, EllipseElement, LineElement, ArrowElement, TextElement } from "@shared/types";
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
// Helper to apply ops to an element list
function applyOpsToElements(ops: Op[], initialElements: DrawingElement[] = []): DrawingElement[] {
  const elementsMap = new Map(initialElements.map(el => [el.id, el]));
  ops.forEach(op => {
    switch (op.type) {
      case 'add':
        if (op.data && 'id' in op.data && 'type' in op.data) {
          // Basic validation to ensure it's a valid element structure
          elementsMap.set(op.data.id as string, op.data as DrawingElement);
        }
        break;
      case 'update':
        if (op.elementId && op.data) {
          const existing = elementsMap.get(op.elementId);
          if (existing) {
            // Create a new object to avoid mutation issues and ensure type correctness
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
  static readonly initialState: Drawing = { id: "", title: "Untitled", elements: [], updatedAt: 0, ops: [], opVersion: 0 };
  static seedData = MOCK_DRAWINGS;
  async appendOps(ops: Op[]): Promise<void> {
    await this.mutate(s => {
      const newElements = applyOpsToElements(ops, s.elements);
      return {
        ...s,
        elements: newElements,
        ops: [...s.ops, ...ops],
        opVersion: s.opVersion + ops.length,
        updatedAt: Date.now(),
      };
    });
  }
  async getOpsSince(version: number): Promise<Op[]> {
    const state = await this.getState();
    return state.ops.slice(version);
  }
}