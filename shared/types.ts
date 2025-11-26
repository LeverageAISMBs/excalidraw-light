export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
// Minimal real-world chat example types (shared by frontend and worker)
export interface User {
  id: string;
  name: string;
}
export interface Chat {
  id: string;
  title: string;
}
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  ts: number; // epoch millis
}
// --- Paperplane Drawing Types ---
export type Tool = 'select' | 'pen' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'eraser' | 'hand';
export type ElementType = 'stroke' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text';
export interface Point {
  x: number;
  y: number;
}
export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  zIndex?: number;
}
export interface StrokeElement extends BaseElement {
  type: 'stroke';
  points: Point[];
}
export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  fillColor: string;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
}
export interface EllipseElement extends BaseElement {
  type: 'ellipse';
  fillColor: string;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
}
export interface LineElement extends BaseElement {
  type: 'line';
  points: [Point, Point];
}
export interface ArrowElement extends BaseElement {
  type: 'arrow';
  points: [Point, Point];
}
export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  isEditing?: boolean;
}
export type DrawingElement = StrokeElement | RectangleElement | EllipseElement | LineElement | ArrowElement | TextElement;
// --- Collaboration & History Types ---
export interface Op {
  id: string;
  type: 'add' | 'update' | 'delete' | 'reorder';
  elementId?: string;
  data?: Partial<DrawingElement> | DrawingElement | DrawingElement[];
  ts: number;
};
export type RotationDelta = number;
export interface TransformedOp extends Op {
  originalId?: string;
  resolvedConflicts?: number;
}
export interface Drawing {
  id: string;
  title: string;
  elements: DrawingElement[];
  updatedAt: number;
  ops: Op[];
  opVersion: number;
  presences?: Presence[];
}
export interface Presence {
  userId: string;
  cursor?: Point | null;
  lastSeen: number;
}
export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  start: Point;
  end: Point;
}
export type Template = Pick<Drawing, 'id' | 'title' | 'elements'>;
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}