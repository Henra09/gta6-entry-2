// The fixed-step game loop: advances the world in 1/60 s steps (several per slow
// frame), renders every frame, and delegates screen state to main's handlers.

import { endFrameInput } from './input.js';
import { drawHUD } from '../ui/hud.js';
import { drawTitle, drawInfoScreen, drawPause, drawShop } from '../ui/menus.js';
import { applyGrade } from '../render/effects.js';
import { updateWorld, drawWorld } from '../world.js';
import { shopOpen } from '../systems/economy.js';

const STEP = 1 / 60;

export function createLoop(canvas, main) {
  const ctx = canvas.getContext('2d');
  let acc = 0;
  let last = performance.now();
  let running = true;
  const placeholder = { draw() {}, update() {}, player: {} };

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.25);
    const w = canvas.width, h = canvas.height;

    const world = main.world || placeholder;
    main.readInput();
    main.handleMenus(w, h);

    if (main.screen === 'play' && main.world) {
      if (!shopOpen()) {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          updateWorld(main.world, STEP);
          acc -= STEP;
          steps++;
        }
      } else {
        acc = 0;
      }
      drawWorld(main.world, ctx, w, h);
      applyGrade(ctx, w, h, { player: main.world.player, screen: main.screen });
      drawHUD(ctx, main.world, w, h);
      if (shopOpen()) drawShop(ctx, w, h, main.world);
    } else {
      acc = 0;
      if (main.screen === 'title') drawTitle(ctx, w, h, main.hasSave, now);
      else if (main.screen === 'controls' || main.screen === 'credits') drawInfoScreen(ctx, w, h, main.screen, now);
      else if (main.screen === 'pause') {
        drawWorld(main.world, ctx, w, h);
        applyGrade(ctx, w, h, { player: main.world.player, screen: main.screen });
        drawPause(ctx, w, h);
      }
    }

    endFrameInput();
  }

  requestAnimationFrame(frame);
  return {
    stop() { running = false; },
  };
}
