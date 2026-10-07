import type { Point } from './types';
export const PLANE = { width: 1672, height: 941 };
export interface Camera { scale: number; width: number; height: number; left: number; top: number }
/** One transform for artwork, feet, doors and objects. Nothing is independently clamped. */
export function cameraFor(width: number, height: number, focus: Point, keepVisible: readonly Point[] = []): Camera {
  const scale = Math.max(width / PLANE.width, height / PLANE.height);
  const sceneWidth = PLANE.width * scale, sceneHeight = PLANE.height * scale;
  let left = Math.max(width - sceneWidth, Math.min(0, width * .5 - focus.x * scale));
  // If the attended object and people fit together, frame the whole group rather
  // than cutting the actionable door off to keep a person exactly centered.
  if (keepVisible.length) {
    const lower = Math.max(...keepVisible.map(point => 26 - point.x * scale));
    const upper = Math.min(...keepVisible.map(point => width - 26 - point.x * scale));
    if (lower <= upper) left = Math.max(width - sceneWidth, Math.min(0, Math.max(lower, Math.min(upper, left))));
  }
  const top = Math.max(height - sceneHeight, Math.min(0, height * .82 - focus.y * scale));
  return { scale, width: sceneWidth, height: sceneHeight, left, top };
}
export function screenToPlane(point: Point, camera: Camera): Point {
  return { x: (point.x - camera.left) / camera.scale, y: (point.y - camera.top) / camera.scale };
}
export function pointOnScreen(point: Point, camera: Camera, size: {width: number;height: number}, inset = 24): boolean {
  const x = camera.left + point.x * camera.scale, y = camera.top + point.y * camera.scale;
  return x >= inset && x <= size.width - inset && y >= 80 && y <= size.height - 95;
}

/** A clipped physical marker is replaced by its explicit route control. */
export function partiallyCropped(point: Point, camera: Camera, size: { width: number; height: number }, radius = 22): boolean {
  const x = camera.left + point.x * camera.scale, y = camera.top + point.y * camera.scale;
  const intersects = x + radius > 0 && x - radius < size.width && y + radius > 0 && y - radius < size.height;
  return intersects && (x - radius < 0 || x + radius > size.width || y - radius < 0 || y + radius > size.height);
}
