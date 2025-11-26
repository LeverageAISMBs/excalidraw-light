import React, { useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DrawingElement, Tool, Point, Presence, AlignmentGuide, TextElement, Viewport } from '@shared/types';
import { getPathData, snapToGrid, getAlignmentGuides } from '@/lib/drawing';
interface ExcalidrawCanvasProps {
  elements: DrawingElement[];
  tool: Tool;
  color: string;
  strokeWidth: number;
  onCreateElement: (tool: Tool, start: Point, end: Point, options: { color: string; strokeWidth: number }) => void;
  onCreateStroke: (points: Point[], options: { color: string; strokeWidth: number }) => void;
  onUpdateElement: (id: string, updates: Partial<DrawingElement>) => void;
  onCursorMove: (point: Point) => void;
  presences?: Presence[];
  showGrid?: boolean;
  enableSnapping?: boolean;
  viewport: Viewport;
  selectedIds: string[];
  onSelect: (id: string, multi: boolean) => void;
  onDeselectAll: () => void;
  onDragMove: (delta: Point) => void;
  onResize: (handle: string, delta: Point, elementId: string) => void;
  onPan: (delta: Point) => void;
}
type Action = { type: 'none' } | { type: 'drawing' } | { type: 'panning' } | { type: 'dragging' } | { type: 'resizing'; elementId: string; handle: string };
const RESIZE_HANDLES = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];
function getHandleCursor(handle: string) {
  if (handle.includes('top') && handle.includes('left')) return 'cursor-nwse-resize';
  if (handle.includes('top') && handle.includes('right')) return 'cursor-nesw-resize';
  if (handle.includes('bottom') && handle.includes('left')) return 'cursor-nesw-resize';
  if (handle.includes('bottom') && handle.includes('right')) return 'cursor-nwse-resize';
  if (handle.includes('top') || handle.includes('bottom')) return 'cursor-ns-resize';
  if (handle.includes('left') || handle.includes('right')) return 'cursor-ew-resize';
  return 'cursor-default';
}
function renderElement(el: DrawingElement, onUpdateElement: (id: string, updates: Partial<DrawingElement>) => void, isSelected: boolean) {
  const commonProps = {
    transform: `translate(${el.x}, ${el.y}) rotate(${el.angle} ${el.width / 2} ${el.height / 2})`,
    opacity: el.opacity,
    'data-element-id': el.id,
  };
  const selectionRect = isSelected ? (
    <rect width={el.width} height={el.height} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none" />
  ) : null;
  switch (el.type) {
    case 'stroke':
      return <g key={el.id} {...commonProps}><path d={getPathData(el.points)} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />{selectionRect}</g>;
    case 'rectangle':
      return <g key={el.id} {...commonProps}><rect width={el.width} height={el.height} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill={el.fillColor} />{selectionRect}</g>;
    case 'ellipse':
      return <g key={el.id} {...commonProps}><ellipse cx={el.width / 2} cy={el.height / 2} rx={el.width / 2} ry={el.height / 2} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill={el.fillColor} />{selectionRect}</g>;
    case 'text':
      return (
        <g key={el.id} transform={`translate(${el.x}, ${el.y})`}>
          <foreignObject width={el.width} height={el.height} data-element-id={el.id}>
            <textarea
              style={{ width: '100%', height: '100%', fontSize: `${el.fontSize}px`, fontFamily: el.fontFamily, color: el.strokeColor, background: 'transparent', border: 'none', resize: 'none', outline: 'none', padding: 0, overflow: 'hidden' }}
              value={(el as TextElement).text} onChange={(e) => onUpdateElement(el.id, { text: e.target.value })} onBlur={() => onUpdateElement(el.id, { isEditing: false })} autoFocus
            />
          </foreignObject>
          {selectionRect}
        </g>
      );
    default: return null;
  }
}
const boundsIntersect = (b1: Viewport, b2: { x: number; y: number; width: number; height: number; }) => !(b2.x > b1.x + b1.width || b2.x + b2.width < b1.x || b2.y > b1.y + b1.height || b2.y + b2.height < b1.y);
export function ExcalidrawCanvas({ elements, tool, color, strokeWidth, onCreateElement, onCreateStroke, onUpdateElement, onCursorMove, presences = [], showGrid = false, enableSnapping = true, viewport, selectedIds, onSelect, onDeselectAll, onDragMove, onResize, onPan }: ExcalidrawCanvasProps) {
  const targetRef = useRef<SVGSVGElement>(null);
  const [action, setAction] = useState<Action>({ type: 'none' });
  const currentPointsRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });
  const lastPointRef = useRef<Point>({ x: 0, y: 0 });
  const [previewElement, setPreviewElement] = useState<DrawingElement | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const getSvgPoint = useCallback((e: React.PointerEvent): Point => {
    if (!targetRef.current) return { x: 0, y: 0 };
    const svg = targetRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x - viewport.x, y: transformed.y - viewport.y };
  }, [viewport.x, viewport.y]);
  const virtualizedElements = useMemo(() => elements.filter(el => boundsIntersect({ ...viewport, x: 0, y: 0 }, { x: el.x - viewport.x, y: el.y - viewport.y, width: el.width, height: el.height })), [elements, viewport]);
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const point = getSvgPoint(e);
    startPointRef.current = point;
    lastPointRef.current = point;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'hand') { setAction({ type: 'panning' }); return; }
    const target = e.target as SVGElement;
    const handle = target.getAttribute('data-handle');
    const elementId = target.closest('[data-element-id]')?.getAttribute('data-element-id');
    if (tool === 'select') {
      if (handle && elementId) { setAction({ type: 'resizing', elementId, handle }); }
      else if (elementId && selectedIds.includes(elementId)) { setAction({ type: 'dragging' }); }
      else if (elementId) { onSelect(elementId, e.shiftKey); setAction({ type: 'dragging' }); }
      else { onDeselectAll(); }
    } else { setAction({ type: 'drawing' }); if (tool === 'pen') currentPointsRef.current = [point]; }
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const point = getSvgPoint(e);
    const delta = { x: point.x - lastPointRef.current.x, y: point.y - lastPointRef.current.y };
    onCursorMove(point);
    switch (action.type) {
      case 'panning': onPan({ x: e.movementX, y: e.movementY }); break;
      case 'dragging': onDragMove(delta); break;
      case 'resizing': onResize(action.handle, delta, action.elementId); break;
      case 'drawing':
        let snappedPoint = enableSnapping ? snapToGrid(point, 20) : point;
        if (tool === 'pen') { currentPointsRef.current.push(snappedPoint); setPreviewElement({ id: 'preview-stroke', type: 'stroke', points: [...currentPointsRef.current], strokeColor: color, strokeWidth } as any); }
        else if (tool !== 'select' && tool !== 'hand') {
          const tempPreview = { id: 'preview', type: tool, x: Math.min(startPointRef.current.x, snappedPoint.x), y: Math.min(startPointRef.current.y, snappedPoint.y), width: Math.abs(startPointRef.current.x - snappedPoint.x), height: Math.abs(startPointRef.current.y - snappedPoint.y), angle: 0, strokeColor: color, strokeWidth, opacity: 1, fillColor: 'transparent', strokeStyle: 'solid' } as any;
          setPreviewElement(tempPreview);
          if (enableSnapping) setAlignmentGuides(getAlignmentGuides(elements, tempPreview));
        }
        break;
    }
    lastPointRef.current = point;
  };
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setAction({ type: 'none' });
    setAlignmentGuides([]);
    let endPoint = getSvgPoint(e);
    if (enableSnapping) endPoint = snapToGrid(endPoint, 20);
    if (tool === 'pen' && currentPointsRef.current.length > 1) { onCreateStroke(currentPointsRef.current, { color, strokeWidth }); }
    else if (tool !== 'select' && tool !== 'hand' && tool !== 'pen') { onCreateElement(tool, startPointRef.current, endPoint, { color, strokeWidth }); }
    currentPointsRef.current = [];
    setPreviewElement(null);
  };
  const singleSelectedElement = useMemo(() => selectedIds.length === 1 ? elements.find(el => el.id === selectedIds[0]) : null, [selectedIds, elements]);
  return (
    <svg ref={targetRef} className="w-full h-full bg-card touch-none" style={{ cursor: tool === 'hand' ? 'grab' : 'default' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      {showGrid && <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--muted))" strokeWidth="0.5" /></pattern>}
      <rect width="100%" height="100%" fill={showGrid ? "url(#grid)" : "transparent"} />
      <g transform={`translate(${viewport.x}, ${viewport.y})`}>
        {virtualizedElements.map(el => renderElement(el, onUpdateElement, selectedIds.includes(el.id)))}
        {previewElement && renderElement(previewElement, () => {}, false)}
        <AnimatePresence>{alignmentGuides.map((guide, i) => <motion.line key={i} x1={guide.start.x} y1={guide.start.y} x2={guide.end.x} y2={guide.end.y} stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3 3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />)}</AnimatePresence>
        {singleSelectedElement && RESIZE_HANDLES.map(handle => {
          const { x, y, width, height } = singleSelectedElement;
          let hx = x, hy = y;
          if (handle.includes('right')) hx = x + width;
          if (handle.includes('bottom')) hy = y + height;
          if (handle.includes('left')) hx = x;
          if (handle.includes('top')) hy = y;
          if (handle === 'top' || handle === 'bottom') hx = x + width / 2;
          if (handle === 'left' || handle === 'right') hy = y + height / 2;
          return <motion.circle key={handle} cx={hx} cy={hy} r={6} fill="hsl(var(--primary))" data-handle={handle} data-element-id={singleSelectedElement.id} className={getHandleCursor(handle)} whileHover={{ scale: 1.5 }} />;
        })}
        {presences.map(p => p.cursor && <motion.g key={p.userId} initial={{ x: p.cursor.x, y: p.cursor.y }} animate={{ x: p.cursor.x, y: p.cursor.y }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}><circle r={6} fill="#f48018" className="pointer-events-none" /><text x="10" y="5" fontSize="10" fill="#f48018">{p.userId}</text></motion.g>)}
      </g>
    </svg>
  );
}