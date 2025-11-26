import { useState, useCallback, useMemo } from 'react';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import type { Drawing, DrawingElement, Tool, Point, Op } from '@shared/types';
import { simplifyPoints, smoothPath, applyOpsToElements, generateOp } from '@/lib/drawing';
const UNDO_LIMIT = 100;
export function useDraw(initialDrawing: Drawing) {
  const [drawing, setDrawing] = useState<Drawing>(initialDrawing);
  const [opHistory, setOpHistory] = useState<Op[]>(initialDrawing.ops || []);
  const [historyIndex, setHistoryIndex] = useState(initialDrawing.ops?.length || 0);
  const [localCursor, setLocalCursor] = useState<Point | null>(null);
  const currentElements = useMemo(() => {
    const safeHistory = opHistory || [];
    return applyOpsToElements(safeHistory.slice(0, historyIndex));
  }, [opHistory, historyIndex]);
  const setDrawingAndOps = useCallback((newDrawing: Drawing) => {
    setDrawing(newDrawing);
    const newOps = newDrawing.ops || [];
    setOpHistory(newOps);
    setHistoryIndex(newOps.length);
  }, []);
  const dispatchOp = useCallback((op: Op) => {
    const currentHistory = opHistory || [];
    const newHistory = currentHistory.slice(0, historyIndex);
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
    if (historyIndex < (opHistory?.length || 0)) {
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex, opHistory]);
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
      case 'text':
        element = { ...base, type: 'text', text: 'Text', fontSize: 24, fontFamily: 'Inter', width: 100, height: 30 };
        break;
    }
    if (element) {
      dispatchOp(generateOp('add', undefined, element));
    }
  };
  const createStroke = (points: Point[], options: { color: string; strokeWidth: number }): void => {
    if (points.length < 2) return;
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
    if (ops.length === 0) return;
    // Simple merge: append remote ops. A true OT/CRDT would involve transformation.
    const current = opHistory || [];
    const newHistory = [...current, ...ops];
    setOpHistory(newHistory);
    setHistoryIndex(newHistory.length);
  }, [opHistory]);
  return {
    drawing,
    elements: currentElements,
    setDrawing: setDrawingAndOps,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < (opHistory?.length || 0),
    createElement,
    createStroke,
    dispatchOp,
    mergeRemoteOps,
    pendingOps: (opHistory || []).slice(drawing.opVersion),
    localCursor,
    setLocalCursor,
  };
}