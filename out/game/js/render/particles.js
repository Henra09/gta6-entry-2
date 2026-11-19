// Particles and transient world-space effects: muzzle flashes, sparks, blood,
// smoke, skid marks, explosions, pickups bobbing. One array, cheap updates.

import { randRange } from '../core/util.js';

const MAX = 900;

export function createEffects() {
  const parts = [];
  const skids = []; // persistent short line segments
  return {
    parts,
    skids,
    update(dt, world) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94; p.vy *= 0.94;
        if (p.grow) p.size += p.grow * dt;
      }
      if (skids.length > 600) skids.splice(0, skids.length - 600);
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
    },
    draw(ctx) {
      // skid marks under everything else in the world layer
      for (const s of skids) {
        ctx.strokeStyle = `rgba(20,18,22,${Math.min(0.5, s.life / 6)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }
      for (const p of parts) {
        const t = p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, Math.min(1, t));
        ctx.fillStyle = p.color;
        if (p.kind === 'flash') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (2 - t), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'line') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.04, p.y + p.vy * 0.04);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },

    muzzle(x, y, ang) {
      parts.push({ kind: 'flash', x, y, vx: 0, vy: 0, size: 7, life: 0.07, maxLife: 0.07, color: '#ffdf8a' });
      for (let i = 0; i < 4; i++) {
        const a = ang + randRange(Math.random, -0.3, 0.3);
        parts.push({ kind: 'line', x, y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, life: 0.08, maxLife: 0.08, color: '#ffb84a' });
      }
    },
    spark(x, y) {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        parts.push({ x, y, vx: Math.cos(a) * randRange(Math.random, 60, 220), vy: Math.sin(a) * randRange(Math.random, 60, 220), size: 2, life: randRange(Math.random, 0.2, 0.4), maxLife: 0.4, color: Math.random() < 0.5 ? '#ffd23a' : '#ff8a3a' });
      }
    },
    blood(x, y, ang) {
      for (let i = 0; i < 8; i++) {
        const a = ang + randRange(Math.random, -0.7, 0.7);
        parts.push({ x, y, vx: Math.cos(a) * randRange(Math.random, 40, 160), vy: Math.sin(a) * randRange(Math.random, 40, 160), size: randRange(Math.random, 1.5, 3), life: randRange(Math.random, 0.3, 0.5), maxLife: 0.5, color: '#8a1a1a' });
      }
    },
    smoke(x, y, big) {
      parts.push({ x, y, vx: randRange(Math.random, -15, 15), vy: randRange(Math.random, -25, -8), size: big ? 10 : 5, grow: big ? 14 : 7, life: randRange(Math.random, 0.8, 1.6), maxLife: 1.6, color: 'rgba(70,66,62,0.55)' });
    },
    skid(x0, y0, x1, y1) {
      skids.push({ x0, y0, x1, y1, life: 6 });
    },
    explosion(x, y) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = randRange(Math.random, 80, 420);
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: randRange(Math.random, 3, 8), life: randRange(Math.random, 0.4, 0.9), maxLife: 0.9, color: Math.random() < 0.5 ? '#ffb04a' : '#ff6a2a' });
      }
      for (let i = 0; i < 10; i++) {
        parts.push({ x: x + randRange(Math.random, -14, 14), y: y + randRange(Math.random, -14, 14), vx: randRange(Math.random, -20, 20), vy: randRange(Math.random, -30, -5), size: 14, grow: 22, life: randRange(Math.random, 1, 2), maxLife: 2, color: 'rgba(50,45,42,0.6)' });
      }
      parts.push({ kind: 'flash', x, y, vx: 0, vy: 0, size: 42, life: 0.18, maxLife: 0.18, color: '#fff0c0' });
    },
    count: () => parts.length,
  };
}
