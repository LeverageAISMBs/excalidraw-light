import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DrawingElement, Tool, Point, Presence, AlignmentGuide, TextElement } from '@shared/types';
import { getPathData, snapToGrid, getAlignmentGuides } from '@/lib/drawing';
interface ExcalidrawCanvasProps {
  elements: DrawingElement[];
  tool: Tool;
  color: string;
  strokeWidth: number;
  onCreateElement: (tool: Tool, start: Point, end: Point, options: { color: string; strokeWidth: number }) => void;
  onCreateStroke: (points: Point[], options: { color: string; strokeWidth: number }) => void;
  onUpdateElement: (id: string, updates: Partial<DrawingElement>) => void;
  presences?: Presence[];
  showGrid?: boolean;
  enableSnapping?: boolean;
}
function renderElement(el: DrawingElement, onUpdateElement: (id: string, updates: Partial<DrawingElement>) => void) {
  const commonProps = {
    transform: `translate(${el.x}, ${el.y}) rotate(${el.angle} ${el.width / 2} ${el.height / 2})`,
    opacity: el.opacity,
  };
  switch (el.type) {
    case 'stroke':
      return <path key={el.id} d={getPathData(el.points)} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" {...commonProps} />;
    case 'rectangle':
      return <rect key={el.id} width={el.width} height={el.height} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill={el.fillColor} {...commonProps} />;
    case 'ellipse':
      return <ellipse key={el.id} cx={el.width / 2} cy={el.height / 2} rx={el.width / 2} ry={el.height / 2} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill={el.fillColor} {...commonProps} />;
    case 'text':
      return (
        <foreignObject key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} {...commonProps}>
          <textarea
            style={{
              width: `${el.width}px`,
              height: `${el.height}px`,
              fontSize: `${el.fontSize}px`,
              fontFamily: el.fontFamily,
              color: el.strokeColor,
              background: 'transparent',
              border: 'none',
              resize: 'none',
              outline: 'none',
              padding: 0,
              overflow: 'hidden',
            }}
            value={(el as TextElement).text}
            onChange={(e) => onUpdateElement(el.id, { text: e.target.value })}
            onBlur={() => onUpdateElement(el.id, { isEditing: false })}
            autoFocus
          />
        </foreignObject>
      );
    default:
      return null;
  }
}
export function ExcalidrawCanvas({ elements, tool, color, strokeWidth, onCreateElement, onCreateStroke, onUpdateElement, presences = [], showGrid = false, enableSnapping = true }: ExcalidrawCanvasProps) {
  const targetRef = useRef<SVGSVGElement>(null);
  const [action, setAction] = useState<'none' | 'drawing'>('none');
  const currentPointsRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });
  const [previewElement, setPreviewElement] = useState<DrawingElement | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const getSvgPoint = useCallback((e: React.PointerEvent<SVGSVGElement>): Point => {
    if (!targetRef.current) return { x: 0, y: 0 };
    const svg = targetRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'select' || tool === 'hand') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setAction('drawing');
    const point = getSvgPoint(e);
    startPointRef.current = point;
    if (tool === 'pen') {
      currentPointsRef.current = [point];
    }
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (action !== 'drawing') return;
    let point = getSvgPoint(e);
    if (enableSnapping) {
      point = snapToGrid(point, 20);
    }
    if (tool === 'pen') {
      currentPointsRef.current.push(point);
      setPreviewElement({ id: 'preview-stroke', type: 'stroke', points: [...currentPointsRef.current], strokeColor: color, strokeWidth } as any);
    } else if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line' || tool === 'arrow' || tool === 'text') {
      const tempPreview = {
        id: 'preview', type: tool, x: Math.min(startPointRef.current.x, point.x), y: Math.min(startPointRef.current.y, point.y),
        width: Math.abs(startPointRef.current.x - point.x), height: Math.abs(startPointRef.current.y - point.y), angle: 0,
        strokeColor: color, strokeWidth, opacity: 1, fillColor: 'transparent', strokeStyle: 'solid',
      } as any;
      setPreviewElement(tempPreview);
      if (enableSnapping) {
        setAlignmentGuides(getAlignmentGuides(elements, tempPreview));
      }
    }
  };
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setAction('none');
    setAlignmentGuides([]);
    let endPoint = getSvgPoint(e);
    if (enableSnapping) {
      endPoint = snapToGrid(endPoint, 20);
    }
    if (tool === 'pen' && currentPointsRef.current.length > 1) {
      onCreateStroke(currentPointsRef.current, { color, strokeWidth });
    } else if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line' || tool === 'arrow' || tool === 'text') {
      onCreateElement(tool, startPointRef.current, endPoint, { color, strokeWidth });
    }
    currentPointsRef.current = [];
    setPreviewElement(null);
  };
  return (
    <svg ref={targetRef} className="w-full h-full bg-card touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      {showGrid && (
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--muted))" strokeWidth="0.5" />
        </pattern>
      )}
      <rect width="100%" height="100%" fill={showGrid ? "url(#grid)" : "transparent"} />
      {elements.map(el => renderElement(el, onUpdateElement))}
      {previewElement && renderElement(previewElement, onUpdateElement)}
      <AnimatePresence>
        {alignmentGuides.map((guide, i) => (
          <motion.line key={i} x1={guide.start.x} y1={guide.start.y} x2={guide.end.x} y2={guide.end.y} stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3 3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        ))}
      </AnimatePresence>
      {presences.map(p => p.cursor && ( <circle key={p.userId} cx={p.cursor.x} cy={p.cursor.y} r={4} fill="#f48018" className="pointer-events-none" /> ))}
    </svg>
  );
}