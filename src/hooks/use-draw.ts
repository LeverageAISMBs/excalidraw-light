import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import type { Drawing, DrawingElement, Tool, Point, Op, RectangleElement, EllipseElement, LineElement, ArrowElement, TextElement } from '@shared/types';
import { simplifyPoints, smoothPath, applyOpsToElements, generateOp } from '@/lib/drawing';
const UNDO_LIMIT = 100;
export function useDraw(initialDrawing: Drawing) {
  const [drawing, setDrawing] = useState<Drawing>(initialDrawing);
  const [opHistory, setOpHistory] = useState<Op[]>(initialDrawing.ops || []);
  const [historyIndex, setHistoryIndex] = useState(initialDrawing.ops?.length || 0);
  const [localCursor, setLocalCursor] = useState<Point | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const currentElements = useMemo(() => {
    const safeHistory = opHistory || [];
    return applyOpsToElements(safeHistory.slice(0, historyIndex));
  }, [opHistory, historyIndex]);
  const elementsRef = useRef(currentElements);
  useEffect(() => {
    elementsRef.current = currentElements;
  }, [currentElements]);
  const selectedElements = useMemo(() => currentElements.filter(el => selectedIds.includes(el.id)), [currentElements, selectedIds]);
  const setDrawingAndOps = useCallback((newDrawing: Drawing) => {
    setDrawing(newDrawing);
    const newOps = newDrawing.ops || [];
    setOpHistory(newOps);
    setHistoryIndex(newOps.length);
    setSelectedIds([]);
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
        element = { ...base, type: 'line', points: [{ x: start.x - base.x, y: start.y - base.y }, { x: end.x - base.x, y: end.y - base.y }] };
        break;
      case 'arrow':
        element = { ...base, type: 'arrow', points: [{ x: start.x - base.x, y: start.y - base.y }, { x: end.x - base.x, y: end.y - base.y }] };
        break;
      case 'text':
        element = { ...base, type: 'text', text: 'Text', fontSize: 24, fontFamily: 'Inter', width: Math.max(base.width, 100), height: Math.max(base.height, 30) };
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
    const current = opHistory || [];
    const newHistory = [...current, ...ops];
    setOpHistory(newHistory);
    setHistoryIndex(newHistory.length);
  }, [opHistory]);
  const onSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      if (multi) {
        return prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id];
      }
      return [id];
    });
  }, []);
  const onDeselectAll = useCallback(() => setSelectedIds([]), []);
  const onDragMove = useCallback((delta: Point) => {
    if (selectedIds.length === 0) return;
    const elementsToUpdate = elementsRef.current.filter(el => selectedIds.includes(el.id));
    elementsToUpdate.forEach(el => {
      dispatchOp(generateOp('update', el.id, { x: el.x + delta.x, y: el.y + delta.y }));
    });
  }, [selectedIds, dispatchOp]);
  const onResize = useCallback((handle: string, delta: Point, elementId: string) => {
    const el = elementsRef.current.find(e => e.id === elementId);
    if (!el) return;
    let { x, y, width, height } = el;
    if (handle.includes('right')) width += delta.x;
    if (handle.includes('left')) { x += delta.x; width -= delta.x; }
    if (handle.includes('bottom')) height += delta.y;
    if (handle.includes('top')) { y += delta.y; height -= delta.y; }
    if (width > 10 && height > 10) {
      dispatchOp(generateOp('update', elementId, { x, y, width, height }));
    }
  }, [dispatchOp]);
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
    selectedIds,
    selectedElements,
    onSelect,
    onDeselectAll,
    onDragMove,
    onResize,
  };
}