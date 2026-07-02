import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Velocity-aware drawing on a single canvas. Faster strokes → thinner lines
 * (mimics ink pen behavior). Extracted from advanced-sign.html's initCanvas().
 *
 * Maintains its own paths[] so undo/clear work cleanly without re-recording.
 * Handles DPI scaling so 1px stroke looks 1px regardless of devicePixelRatio.
 */

export interface DrawPoint { x: number; y: number; t: number }
export interface DrawPath  { points: DrawPoint[]; color: string; thickness: number }

export type PenColor = '#1A1A1A' | '#1B3A6B' | '#2B5C9E';
export type PenThickness = 2 | 3 | 5;

export interface UseSignatureCanvasOptions {
  /** Canvas display height in CSS pixels. Width tracks the parent's clientWidth. */
  height?: number;
  /** Velocity factor: higher → more thinning at speed. Default 0.15. */
  velocityFactor?: number;
  /** Floor (fraction of base thickness) so very fast strokes don't disappear. Default 0.4. */
  thicknessFloor?: number;
}

export interface UseSignatureCanvasResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  paths: DrawPath[];
  color: PenColor;
  thickness: PenThickness;
  setColor: (c: PenColor) => void;
  setThickness: (t: PenThickness) => void;
  undo: () => void;
  clear: () => void;
  /** Export the canvas to a PNG data URL with white background (for receipt rendering). */
  exportPng: () => string;
  isEmpty: boolean;
}

export function useSignatureCanvas(opts: UseSignatureCanvasOptions = {}): UseSignatureCanvasResult {
  const { height = 200, velocityFactor = 0.15, thicknessFloor = 0.4 } = opts;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{ currentPath: DrawPoint[]; drawing: boolean }>({ currentPath: [], drawing: false });
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [color, setColor] = useState<PenColor>('#1A1A1A');
  const [thickness, setThickness] = useState<PenThickness>(3);

  // Resize on mount + viewport resize. DPI-aware.
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    redraw(ctx, paths, w, h, velocityFactor, thicknessFloor);
  }, [height, paths, velocityFactor, thicknessFloor]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  // Drawing handlers.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const getPos = (e: MouseEvent | TouchEvent): DrawPoint => {
      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : undefined;
      const clientX = touch ? touch.clientX : (e as MouseEvent).clientX;
      const clientY = touch ? touch.clientY : (e as MouseEvent).clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
        t: Date.now(),
      };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      stateRef.current.drawing = true;
      stateRef.current.currentPath = [getPos(e)];
    };

    const move = (e: MouseEvent | TouchEvent) => {
      if (!stateRef.current.drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      const prev = stateRef.current.currentPath[stateRef.current.currentPath.length - 1];
      stateRef.current.currentPath.push(pos);
      if (!prev) return;

      const dx = pos.x - prev.x;
      const dy = pos.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = pos.t - prev.t || 1;
      const speed = dist / dt;
      const t = Math.max(thickness * thicknessFloor, thickness * (1 - speed * velocityFactor));

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = t;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    const end = () => {
      if (!stateRef.current.drawing) return;
      stateRef.current.drawing = false;
      if (stateRef.current.currentPath.length > 1) {
        setPaths((p) => [...p, { points: stateRef.current.currentPath.slice(), color, thickness }]);
      }
      stateRef.current.currentPath = [];
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [color, thickness, velocityFactor, thicknessFloor]);

  const undo = useCallback(() => {
    setPaths((p) => p.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setPaths([]);
  }, []);

  // Re-render whenever paths change (e.g. undo/clear).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    redraw(ctx, paths, canvas.width / dpr, canvas.height / dpr, velocityFactor, thicknessFloor);
  }, [paths, velocityFactor, thicknessFloor]);

  const exportPng = useCallback((): string => {
    const src = canvasRef.current;
    if (!src) return '';
    const dpr = window.devicePixelRatio || 1;
    const w = src.width / dpr;
    const h = src.height / dpr;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    return out.toDataURL('image/png');
  }, []);

  return {
    canvasRef,
    paths,
    color,
    thickness,
    setColor,
    setThickness,
    undo,
    clear,
    exportPng,
    isEmpty: paths.length === 0,
  };
}

function redraw(
  ctx: CanvasRenderingContext2D,
  paths: DrawPath[],
  w: number,
  h: number,
  velocityFactor: number,
  thicknessFloor: number,
): void {
  ctx.clearRect(0, 0, w, h);
  for (const path of paths) {
    for (let i = 1; i < path.points.length; i++) {
      const prev = path.points[i - 1];
      const cur = path.points[i];
      if (!prev || !cur) continue;
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = cur.t - prev.t || 1;
      const speed = dist / dt;
      const t = Math.max(path.thickness * thicknessFloor, path.thickness * (1 - speed * velocityFactor));
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.strokeStyle = path.color;
      ctx.lineWidth = t;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
}
