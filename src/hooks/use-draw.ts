import { useState, useCallback } from 'react';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import type { Drawing, DrawingElement, Tool, Point } from '@shared/types';
import { simplifyPoints, smoothPath } from '@/lib/drawing';
const UNDO_LIMIT = 50;
export function useDraw(initialDrawing: Drawing) {
  const [drawing, setDrawing] = useState<Drawing>(initialDrawing);
  const [history, setHistory] = useState<DrawingElement[][]>([initialDrawing.elements]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const updateDrawing = useCallback((updater: (draft: Drawing) => void, addToHistory = true) => {
    const nextDrawing = produce(drawing, updater);
    setDrawing(nextDrawing);
    if (addToHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(nextDrawing.elements);
      if (newHistory.length > UNDO_LIMIT) {
        newHistory.shift();
      }
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [drawing, history, historyIndex]);
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      updateDrawing(draft => {
        draft.elements = history[newIndex];
      }, false);
    }
  }, [history, historyIndex, updateDrawing]);
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      updateDrawing(draft => {
        draft.elements = history[newIndex];
      }, false);
    }
  }, [history, historyIndex, updateDrawing]);
  const createElement = (tool: Tool, start: Point, end: Point, options: { color: string; strokeWidth: number }): DrawingElement | null => {
    const base = {
      id: uuidv4(),
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(start.x - end.x),
      height: Math.abs(start.y - end.y),
      angle: 0,
      strokeColor: options.color,
      strokeWidth: options.strokeWidth,
      opacity: 1,
    };
    switch (tool) {
      case 'rectangle':
        return { ...base, type: 'rectangle', fillColor: 'transparent', strokeStyle: 'solid' };
      case 'ellipse':
        return { ...base, type: 'ellipse', fillColor: 'transparent', strokeStyle: 'solid' };
      case 'line':
        return { ...base, type: 'line', points: [start, end] };
      case 'arrow':
        return { ...base, type: 'arrow', points: [start, end] };
      default:
        return null;
    }
  };
  const createStroke = (points: Point[], options: { color: string; strokeWidth: number }): DrawingElement => {
    const simplified = simplifyPoints(points, 1);
    const smoothed = smoothPath(simplified);
    const xs = smoothed.map(p => p.x);
    const ys = smoothed.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      id: uuidv4(),
      type: 'stroke',
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
      angle: 0,
      strokeColor: options.color,
      strokeWidth: options.strokeWidth,
      opacity: 1,
      points: smoothed.map(p => ({ x: p.x - minX, y: p.y - minY })),
    };
  };
  return {
    drawing,
    setDrawing,
    updateDrawing,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    createElement,
    createStroke,
  };
}