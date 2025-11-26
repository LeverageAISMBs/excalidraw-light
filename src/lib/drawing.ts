import type { Drawing, DrawingElement, Point, Op } from "@shared/types";
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
    case 'arrow':
      // Note: line/arrow points are relative to element x/y, but width/height define the bounding box.
      // This simple implementation might need refinement for rotated lines.
      return `<path d="M 0 0 L ${el.width} ${el.height}" fill="none" ${common} />`;
    case 'text':
      return `<text x="0" y="${el.fontSize}" font-family="${el.fontFamily}" font-size="${el.fontSize}" fill="${el.strokeColor}" ${common}>${el.text}</text>`;
    default:
      return '';
  }
}
export function exportToSvg(drawing: Drawing): string {
  const elementsSvg = drawing.elements.map(elementToSvg).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <rect width="100%" height="100%" fill="white" />
  ${elementsSvg}
</svg>`;
}
export async function exportToPng(svgString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context not available');
      ctx.drawImage(img, 0, 0);
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
          if (op.data) {
            draft.push(op.data as DrawingElement);
          }
          break;
        case 'update':
          if (op.elementId && op.data) {
            const idx = draft.findIndex(e => e.id === op.elementId);
            if (idx >= 0) {
              Object.assign(draft[idx], op.data);
            }
          }
          break;
        case 'delete':
          if (op.elementId) {
            const delIdx = draft.findIndex(e => e.id === op.elementId);
            if (delIdx >= 0) {
              draft.splice(delIdx, 1);
            }
          }
          break;
      }
    });
  });
}
export function generateOp(type: Op['type'], elementId?: string, data?: Partial<DrawingElement> | DrawingElement): Op {
  return {
    id: uuidv4(),
    type,
    elementId,
    data,
    ts: Date.now(),
  };
}