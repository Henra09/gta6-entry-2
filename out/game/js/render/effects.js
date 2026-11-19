// Post-processing over the whole frame: warm late-afternoon colour grade, vignette,
// and subtle scanline-free grain. Drawn in screen space after the world.

const canvas = document.createElement('canvas');
const bctx = canvas.getContext('2d');

function ensure(w, h) {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    const g = bctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,5,25,0.42)');
    bctx.clearRect(0, 0, w, h);
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, w, h);
  }
  return canvas;
}

// Call after the world + HUD-eligible world overlays are drawn (before HUD text).
export function applyGrade(ctx, w, h, state) {
  // warm highlight / teal shadow grade
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const g = ctx.createLinearGradient(0, h, w * 0.5, 0);
  g.addColorStop(0, 'rgba(255,150,40,0.16)');
  g.addColorStop(1, 'rgba(40,160,170,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // low-health red pulse
  if (state && state.player && state.player.health < 35 && state.screen === 'play') {
    const pulse = 0.18 + 0.12 * Math.sin(performance.now() / 180);
    ctx.fillStyle = `rgba(160,20,20,${pulse})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.drawImage(ensure(w, h), 0, 0);
}

// Fullscreen letterboxed wipe for busted/wasted screens.
export function applyFlash(ctx, w, h, color, alpha) {
  ctx.fillStyle = color.replace('ALPHA', alpha.toFixed(3));
  ctx.fillRect(0, 0, w, h);
}
