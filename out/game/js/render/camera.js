// Chase camera: follows the player (or their car), leads the direction of travel,
// zooms out with speed, and carries screen-shake from the effects system.

import { lerp, clamp } from '../core/util.js';

export const camera = {
  x: 0, y: 0,
  zoom: 1,
  shakeX: 0, shakeY: 0,
  viewW: 1280, viewH: 720,
  shakeMag: 0,
};

export function resizeCamera(w, h) {
  camera.viewW = w;
  camera.viewH = h;
}

export function addShake(mag) {
  camera.shakeMag = Math.min(18, camera.shakeMag + mag);
}

export function followCamera(tx, ty, leadX, leadY, dt, baseZoom) {
  const speedLead = Math.hypot(leadX, leadY);
  const zoom = clamp(baseZoom - speedLead * 0.0004, 0.72, 1.15);
  camera.zoom = lerp(camera.zoom, zoom, 1 - Math.exp(-3 * dt));
  const targetX = tx + leadX * 0.45;
  const targetY = ty + leadY * 0.45;
  const k = 1 - Math.exp(-6 * dt);
  camera.x = lerp(camera.x, targetX, k);
  camera.y = lerp(camera.y, targetY, k);
  camera.shakeMag = Math.max(0, camera.shakeMag - camera.shakeMag * 6 * dt - 2 * dt);
  camera.shakeX = (Math.random() * 2 - 1) * camera.shakeMag;
  camera.shakeY = (Math.random() * 2 - 1) * camera.shakeMag;
}

// Snap instantly (used on respawn and staged shots).
export function snapCamera(tx, ty, zoom) {
  camera.x = tx;
  camera.y = ty;
  if (zoom) camera.zoom = zoom;
}

// Apply the camera to a 2D context: translate + scale so world coords draw directly.
export function applyCamera(ctx) {
  ctx.translate(camera.viewW / 2 + camera.shakeX, camera.viewH / 2 + camera.shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

export function screenToWorld(sx, sy) {
  return {
    x: (sx - camera.viewW / 2 - camera.shakeX) / camera.zoom + camera.x,
    y: (sy - camera.viewH / 2 - camera.shakeY) / camera.zoom + camera.y,
  };
}

export function worldToScreen(wx, wy) {
  return {
    x: (wx - camera.x) * camera.zoom + camera.viewW / 2 + camera.shakeX,
    y: (wy - camera.y) * camera.zoom + camera.viewH / 2 + camera.shakeY,
  };
}
