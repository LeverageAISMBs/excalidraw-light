import React, { useRef, useState, useCallback } from 'react';
import type { DrawingElement, Tool, Point, Presence } from '@shared/types';
import { getPathData } from '@/lib/drawing';
interface ExcalidrawCanvasProps {
  elements: DrawingElement[];
  tool: Tool;
  color: string;
  strokeWidth: number;
  onCreateElement: (tool: Tool, start: Point, end: Point, options: { color: string; strokeWidth: number }) => void;
  onCreateStroke: (points: Point[], options: { color: string; strokeWidth: number }) => void;
  presences?: Presence[];
}
function renderElement(el: DrawingElement) {
  const commonProps = {
    transform: `translate(${el.x}, ${el.y}) rotate(${el.angle} ${el.width / 2} ${el.height / 2})`,
    opacity: el.opacity,
  };
  switch (el.type) {
    case 'stroke':
      return (
        <path
          key={el.id}
          d={getPathData(el.points)}
          stroke={el.strokeColor}
          strokeWidth={el.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...commonProps}
        />
      );
    case 'rectangle':
      return (
        <rect
          key={el.id}
          width={el.width}
          height={el.height}
          stroke={el.strokeColor}
          strokeWidth={el.strokeWidth}
          fill={el.fillColor}
          {...commonProps}
        />
      );
    case 'ellipse':
      return (
        <ellipse
          key={el.id}
          cx={el.width / 2}
          cy={el.height / 2}
          rx={el.width / 2}
          ry={el.height / 2}
          stroke={el.strokeColor}
          strokeWidth={el.strokeWidth}
          fill={el.fillColor}
          {...commonProps}
        />
      );
    default:
      return null;
  }
}
export function ExcalidrawCanvas({ elements, tool, color, strokeWidth, onCreateElement, onCreateStroke, presences = [] }: ExcalidrawCanvasProps) {
  const targetRef = useRef<SVGSVGElement>(null);
  const [action, setAction] = useState<'none' | 'drawing'>('none');
  const currentPointsRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });
  const [previewElement, setPreviewElement] = useState<DrawingElement | null>(null);
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
    const point = getSvgPoint(e);
    if (tool === 'pen') {
      currentPointsRef.current.push(point);
      // For performance, we can throttle the preview path update with requestAnimationFrame
      // but for simplicity, we'll re-render on each move for now.
      // A better approach is to draw on a separate canvas or update path data directly.
      setPreviewElement({
        id: 'preview-stroke',
        type: 'stroke',
        points: [...currentPointsRef.current],
        strokeColor: color,
        strokeWidth,
      } as any);
    } else if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line' || tool === 'arrow') {
      setPreviewElement({
        id: 'preview',
        type: tool,
        x: Math.min(startPointRef.current.x, point.x),
        y: Math.min(startPointRef.current.y, point.y),
        width: Math.abs(startPointRef.current.x - point.x),
        height: Math.abs(startPointRef.current.y - point.y),
        angle: 0,
        strokeColor: color,
        strokeWidth,
        opacity: 1,
        fillColor: 'transparent',
        strokeStyle: 'solid',
      } as any);
    }
  };
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setAction('none');
    const endPoint = getSvgPoint(e);
    if (tool === 'pen' && currentPointsRef.current.length > 1) {
      onCreateStroke(currentPointsRef.current, { color, strokeWidth });
    } else if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line' || tool === 'arrow') {
      onCreateElement(tool, startPointRef.current, endPoint, { color, strokeWidth });
    }
    currentPointsRef.current = [];
    setPreviewElement(null);
  };
  return (
    <svg
      ref={targetRef}
      className="w-full h-full bg-card touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {elements.map(renderElement)}
      {previewElement && renderElement(previewElement)}
      {presences.map(p => p.cursor && (
        <circle key={p.userId} cx={p.cursor.x} cy={p.cursor.y} r={4} fill="#f48018" className="pointer-events-none" />
      ))}
    </svg>
  );
}