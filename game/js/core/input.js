// Keyboard and mouse state for one frame: pressed-this-frame edges included.

const keys = Object.create(null);
const pressed = Object.create(null);
export const mouse = { x: 640, y: 360, down: false, clicked: false };

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) mouse.rightClicked = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
}

export function isDown(...codes) {
  return codes.some((c) => keys[c]);
}

// True only on the frame the key went down.
export function wasPressed(...codes) {
  let hit = false;
  for (const c of codes) if (pressed[c]) hit = true;
  return hit;
}

// Called by the loop once per frame after the game has read input.
export function endFrameInput() {
  for (const k in pressed) pressed[k] = false;
  mouse.clicked = false;
  mouse.rightClicked = false;
}

// A menu needs clicks mapped through the camera; hud code converts when needed.
export function consumeClick() {
  const c = mouse.clicked;
  mouse.clicked = false;
  return c;
}
