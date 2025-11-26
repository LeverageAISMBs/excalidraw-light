import { useState, useCallback, useMemo } from 'react';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import type { Drawing, DrawingElement, Tool, Point, Op } from '@shared/types';
import { simplifyPoints, smoothPath, applyOpsToElements, generateOp } from '@/lib/drawing';
const UNDO_LIMIT = 100;
export function useDraw(initialDrawing: Drawing) {
  const [drawing, setDrawing] = useState<Drawing>(initialDrawing);
  const [opHistory, setOpHistory] = useState<Op[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentElements = useMemo(() => {
    return applyOpsToElements(opHistory.slice(0, historyIndex));
  }, [opHistory, historyIndex]);
  const setDrawingAndOps = useCallback((newDrawing: Drawing) => {
    setDrawing(newDrawing);
    setOpHistory(newDrawing.ops);
    setHistoryIndex(newDrawing.ops.length);
  }, []);
  const dispatchOp = useCallback((op: Op) => {
    const newHistory = opHistory.slice(0, historyIndex);
    newHistory.push(op);
    if (newHistory.length > UNDO_LIMIT) {
      newHistory.shift();
    }
    setOpHistory(newHistory);
    setHistoryIndex(newHistory.length);
  }, [opHistory, historyIndex]);
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
    }
  }, [historyIndex]);
  const redo = useCallback(() => {
    if (historyIndex < opHistory.length) {
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex, opHistory.length]);
  const createElement = (tool: Tool, start: Point, end: Point, options: { color: string; strokeWidth: number }): void => {
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
    let element: DrawingElement | null = null;
    switch (tool) {
      case 'rectangle':
        element = { ...base, type: 'rectangle', fillColor: 'transparent', strokeStyle: 'solid' };
        break;
      case 'ellipse':
        element = { ...base, type: 'ellipse', fillColor: 'transparent', strokeStyle: 'solid' };
        break;
      case 'line':
        element = { ...base, type: 'line', points: [start, end] };
        break;
      case 'arrow':
        element = { ...base, type: 'arrow', points: [start, end] };
        break;
    }
    if (element) {
      dispatchOp(generateOp('add', undefined, element));
    }
  };
  const createStroke = (points: Point[], options: { color: string; strokeWidth: number }): void => {
    const simplified = simplifyPoints(points, 1);
    const smoothed = smoothPath(simplified);
    const xs = smoothed.map(p => p.x);
    const ys = smoothed.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const strokeElement: DrawingElement = {
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
    dispatchOp(generateOp('add', undefined, strokeElement));
  };
  const mergeRemoteOps = useCallback((ops: Op[]) => {
    // Simple merge: just append and re-render.
    // Conflict detection can be added here based on timestamps if needed.
    const newHistory = [...opHistory, ...ops];
    setOpHistory(newHistory);
    setHistoryIndex(newHistory.length);
    return { merged: ops.length, conflicts: 0 };
  }, [opHistory]);
  return {
    drawing,
    elements: currentElements,
    setDrawing: setDrawingAndOps,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < opHistory.length,
    createElement,
    createStroke,
    dispatchOp,
    mergeRemoteOps,
    pendingOps: opHistory.slice(drawing.opVersion),
  };
}