import type { Drawing, DrawingElement, Point, Op, AlignmentGuide, TextElement } from "@shared/types";
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
// Basic path simplification using Ramer-Douglas-Peucker algorithm
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;
  const { x, y } = point;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  }
  const numerator = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1);
  const denominator = Math.sqrt(dy ** 2 + dx ** 2);
  return numerator / denominator;
}
export function simplifyPoints(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > tolerance) {
    const recResults1 = simplifyPoints(points.slice(0, index + 1), tolerance);
    const recResults2 = simplifyPoints(points.slice(index), tolerance);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}
// Catmull-Rom spline for smoothing
function getCatmullRomPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}
export function smoothPath(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const smoothed: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[0];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;
    for (let t = 0; t < 1; t += 0.1) {
      smoothed.push(getCatmullRomPoint(t, p0, p1, p2, p3));
    }
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}
// Convert points to SVG path data
export function getPathData(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ` + rest.map(p => `L ${p.x} ${p.y}`).join(' ');
}
// SVG Export helpers
function elementToSvg(el: DrawingElement): string {
  const common = `stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${el.opacity}" transform="translate(${el.x} ${el.y}) rotate(${el.angle} ${el.width / 2} ${el.height / 2})"`;
  switch (el.type) {
    case 'stroke':
      return `<path d="${getPathData(el.points)}" fill="none" ${common} />`;
    case 'rectangle':
      return `<rect width="${el.width}" height="${el.height}" fill="${el.fillColor}" ${common} />`;
    case 'ellipse':
      return `<ellipse cx="${el.width / 2}" cy="${el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${el.fillColor}" ${common} />`;
    case 'line':
    case 'arrow': {
      const pathData = `M ${el.points[0].x} ${el.points[0].y} L ${el.points[1].x} ${el.points[1].y}`;
      return `<path d="${pathData}" fill="none" ${common} />`;
    }
    case 'text':
      return `<text x="0" y="${el.fontSize}" font-family="${el.fontFamily}" font-size="${el.fontSize}" fill="${el.strokeColor}" ${common}>${el.text}</text>`;
    default:
      return '';
  }
}
export function exportToSvg(drawing: Drawing, width: number, height: number, viewport: { x: number, y: number }): string {
  const elementsSvg = drawing.elements.map(elementToSvg).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewport.x} ${viewport.y} ${width} ${height}">
  <rect width="100%" height="100%" fill="white" />
  ${elementsSvg}
</svg>`;
}
export async function exportToPng(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context not available');
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
// --- Operation Log Utilities ---
export function applyOpsToElements(ops: Op[], initialElements: DrawingElement[] = []): DrawingElement[] {
  return produce(initialElements, draft => {
    ops.forEach(op => {
      switch (op.type) {
        case 'add':
          if (op.data && !Array.isArray(op.data)) {
            draft.push(op.data as DrawingElement);
          }
          break;
        case 'update':
          if (op.elementId && op.data && !Array.isArray(op.data)) {
            const idx = draft.findIndex(e => e.id === op.elementId);
            if (idx !== -1) {
              const elementToUpdate = draft[idx];
              Object.assign(elementToUpdate, op.data);
              // This fixes the Immer bug by ensuring `isEditing` is only on TextElements
              if (elementToUpdate.type !== 'text' && 'isEditing' in elementToUpdate) {
                delete (elementToUpdate as any).isEditing;
              }
            }
          }
          break;
        case 'delete':
          if (op.elementId) {
            const delIdx = draft.findIndex(e => e.id === op.elementId);
            if (delIdx !== -1) {
              draft.splice(delIdx, 1);
            }
          }
          break;
        case 'reorder':
          if (op.data && Array.isArray(op.data)) {
             return op.data as DrawingElement[];
          }
          break;
      }
    });
  });
}
export function generateOp(type: Op['type'], elementId?: string, data?: Partial<DrawingElement> | DrawingElement | DrawingElement[]): Op {
  return {
    id: uuidv4(),
    type,
    elementId,
    data,
    ts: Date.now(),
  };
}
// --- Advanced Tools Utilities ---
export function snapToGrid(p: Point, gridSize: number): Point {
  return {
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize,
  };
}
export function getAlignmentGuides(elements: DrawingElement[], preview: DrawingElement): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];
  const threshold = 5;
  const previewBounds = {
    left: preview.x,
    right: preview.x + preview.width,
    top: preview.y,
    bottom: preview.y + preview.height,
    centerX: preview.x + preview.width / 2,
    centerY: preview.y + preview.height / 2,
  };
  for (const el of elements) {
    if (el.id === preview.id) continue;
    const elBounds = {
      left: el.x,
      right: el.x + el.width,
      top: el.y,
      bottom: el.y + el.height,
      centerX: el.x + el.width / 2,
      centerY: el.y + el.height / 2,
    };
    // Vertical guides
    if (Math.abs(previewBounds.left - elBounds.left) < threshold) guides.push({ type: 'vertical', start: { x: elBounds.left, y: Math.min(previewBounds.top, elBounds.top) }, end: { x: elBounds.left, y: Math.max(previewBounds.bottom, elBounds.bottom) } });
    if (Math.abs(previewBounds.right - elBounds.right) < threshold) guides.push({ type: 'vertical', start: { x: elBounds.right, y: Math.min(previewBounds.top, elBounds.top) }, end: { x: elBounds.right, y: Math.max(previewBounds.bottom, elBounds.bottom) } });
    if (Math.abs(previewBounds.centerX - elBounds.centerX) < threshold) guides.push({ type: 'vertical', start: { x: elBounds.centerX, y: Math.min(previewBounds.top, elBounds.top) }, end: { x: elBounds.centerX, y: Math.max(previewBounds.bottom, elBounds.bottom) } });
    // Horizontal guides
    if (Math.abs(previewBounds.top - elBounds.top) < threshold) guides.push({ type: 'horizontal', start: { x: Math.min(previewBounds.left, elBounds.left), y: elBounds.top }, end: { x: Math.max(previewBounds.right, elBounds.right), y: elBounds.top } });
    if (Math.abs(previewBounds.bottom - elBounds.bottom) < threshold) guides.push({ type: 'horizontal', start: { x: Math.min(previewBounds.left, elBounds.left), y: elBounds.bottom }, end: { x: Math.max(previewBounds.right, elBounds.right), y: elBounds.bottom } });
    if (Math.abs(previewBounds.centerY - elBounds.centerY) < threshold) guides.push({ type: 'horizontal', start: { x: Math.min(previewBounds.left, elBounds.left), y: elBounds.centerY }, end: { x: Math.max(previewBounds.right, elBounds.right), y: elBounds.centerY } });
  }
  return guides;
}
export function pointInElement(point: Point, el: DrawingElement): boolean {
  // Guard against undefined/null inputs (e.g., during eraser throttling)
  if (!point || !el) return false;
  // A simple bounding box check for now
  return (
    point.x >= el.x &&
    point.x <= el.x + el.width &&
    point.y >= el.y &&
    point.y <= el.y + el.height
  );
}
export function computeRotationDelta(center: Point, start: Point, current: Point): number {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const currentAngle = Math.atan2(current.y - center.y, current.x - center.x);
  return (currentAngle - startAngle) * (180 / Math.PI); // convert to degrees
}