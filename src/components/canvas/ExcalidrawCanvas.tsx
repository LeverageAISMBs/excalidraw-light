import React, { useRef, useState, useLayoutEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import type { Drawing, DrawingElement, Tool, Point } from '@shared/types';
import { getPathData } from '@/lib/drawing';
interface ExcalidrawCanvasProps {
  drawing: Drawing;
  tool: Tool;
  color: string;
  strokeWidth: number;
  onUpdateElement: (element: DrawingElement) => void;
  onCreateElement: (element: DrawingElement) => void;
}
function renderElement(el: DrawingElement) {
  const commonProps = {
    transform: `translate(${el.x}, ${el.y}) rotate(${el.angle})`,
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
export function ExcalidrawCanvas({ drawing, tool, color, strokeWidth, onCreateElement }: ExcalidrawCanvasProps) {
  const targetRef = useRef<SVGSVGElement>(null);
  const [action, setAction] = useState<'none' | 'drawing'>('none');
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [previewElement, setPreviewElement] = useState<DrawingElement | null>(null);
  useGesture(
    {
      onDragStart: ({ xy: [x, y] }) => {
        setAction('drawing');
        setStartPoint({ x, y });
        if (tool === 'pen') {
          setCurrentPoints([{ x, y }]);
        }
      },
      onDrag: ({ xy: [x, y], movement: [mx, my] }) => {
        if (action !== 'drawing') return;
        if (tool === 'pen') {
          setCurrentPoints(prev => [...prev, { x, y }]);
        } else if (tool === 'rectangle' || tool === 'ellipse') {
          setPreviewElement({
            id: 'preview',
            type: tool,
            x: Math.min(startPoint.x, x),
            y: Math.min(startPoint.y, y),
            width: Math.abs(mx),
            height: Math.abs(my),
            angle: 0,
            strokeColor: color,
            strokeWidth,
            opacity: 1,
            fillColor: 'transparent',
            strokeStyle: 'solid',
          });
        }
      },
      onDragEnd: ({ xy: [x, y] }) => {
        setAction('none');
        if (tool === 'pen' && currentPoints.length > 1) {
          onCreateElement({
            id: 'temp', // will be replaced by hook
            type: 'stroke',
            points: currentPoints,
            strokeColor: color,
            strokeWidth,
          } as any);
        } else if ((tool === 'rectangle' || tool === 'ellipse') && previewElement) {
          onCreateElement(previewElement);
        }
        setCurrentPoints([]);
        setPreviewElement(null);
      },
    },
    { target: targetRef, eventOptions: { passive: false } }
  );
  return (
    <svg ref={targetRef} className="w-full h-full bg-white dark:bg-gray-800 touch-none">
      {drawing.elements.map(renderElement)}
      {previewElement && renderElement(previewElement)}
      {tool === 'pen' && currentPoints.length > 0 && (
        <path
          d={getPathData(currentPoints)}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}