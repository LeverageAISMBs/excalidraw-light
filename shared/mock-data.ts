import type { User, Chat, ChatMessage, Drawing } from './types';
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'User A' },
  { id: 'u2', name: 'User B' }
];
export const MOCK_CHATS: Chat[] = [
  { id: 'c1', title: 'General' },
];
export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'm1', chatId: 'c1', userId: 'u1', text: 'Hello', ts: Date.now() },
];
export const MOCK_DRAWINGS: Drawing[] = [
  {
    id: 'd1',
    title: 'Welcome to Paperplane',
    updatedAt: Date.now(),
    elements: [
      {
        id: 'rect1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 250,
        height: 120,
        angle: -5,
        strokeColor: '#455572',
        strokeWidth: 2,
        opacity: 1,
        fillColor: 'rgba(99, 102, 241, 0.1)',
        strokeStyle: 'solid',
      },
      {
        id: 'text1',
        type: 'text',
        x: 120,
        y: 140,
        width: 210,
        height: 80,
        angle: -5,
        strokeColor: '#455572',
        strokeWidth: 0,
        opacity: 1,
        text: 'Hello, world!',
        fontSize: 32,
        fontFamily: 'Cal Sans',
      },
      {
        id: 'stroke1',
        type: 'stroke',
        x: 380,
        y: 120,
        width: 150,
        height: 100,
        angle: 10,
        strokeColor: '#f48018',
        strokeWidth: 4,
        opacity: 1,
        points: [
          { x: 0, y: 50 },
          { x: 20, y: 20 },
          { x: 50, y: 0 },
          { x: 80, y: 30 },
          { x: 110, y: 80 },
          { x: 150, y: 60 },
        ],
      },
    ],
  },
];