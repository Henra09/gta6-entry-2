// Bootstrapping and the app-level state machine: title / controls / credits / play /
// pause, menu selection with keyboard and mouse, save-and-continue, weapon cycling,
// and the staged screenshot scenes (?shot=<name>).

import { initInput, isDown, wasPressed, mouse } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createWorld } from './world.js';
import { applyShot } from './core/shot-stager.js';
import { hasSave, loadGame, applySave, saveGame } from './core/save.js';
import { menuState, titleItems } from './ui/menus.js';
import { shopMove, shopOpen, buyCurrent, closeShop } from './systems/economy.js';
import { playUiBlip, toggleMute, resumeAudio, initAudio, setRadioStation, RADIO_STATIONS } from './audio/audio.js';
import { screenToWorld } from './render/camera.js';
import { WEAPON_ORDER } from './entities/player.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
canvas.width = 1280;
canvas.height = 720;
initInput(canvas);
initAudio();
window.addEventListener('pointerdown', resumeAudio);
window.addEventListener('keydown', resumeAudio);

const main = {
  canvas,
  screen: 'title',
  hasSave: hasSave(),
  world: null,
  shot: shotName,
  prevScreen: 'title',

  setMenu(mode) { this.screen = mode; menuState.selected = 0; },

  readInput() {
    const w = this.world;
    if (!w) return;
    const inp = {
      up: isDown('KeyW', 'ArrowUp'),
      down: isDown('KeyS', 'ArrowDown'),
      left: isDown('KeyA', 'ArrowLeft'),
      right: isDown('KeyD', 'ArrowRight'),
      sprint: isDown('ShiftLeft', 'ShiftRight'),
      brake: isDown('Space'),
      aiming: mouse.down || isDown('KeyF'),
      fire: mouse.down || isDown('KeyF'),
      interact: wasPressed('KeyE'),
      rawMouseWorld: () => screenToWorld(mouse.x, mouse.y),
    };
    w.input = inp;
  },

  menuItems() {
    if (this.screen === 'title') return titleItems.filter((i) => i !== 'CONTINUE' || this.hasSave);
    if (this.screen === 'pause') return ['RESUME', 'CONTROLS', 'CREDITS'];
    return [];
  },

  handleMenus(w, h) {
    if (this.screen === 'title' || this.screen === 'pause') {
      const items = this.menuItems();
      if (wasPressed('KeyW', 'ArrowUp')) { menuState.selected = (menuState.selected - 1 + items.length) % items.length; playUiBlip(false); }
      if (wasPressed('KeyS', 'ArrowDown')) { menuState.selected = (menuState.selected + 1) % items.length; playUiBlip(false); }
      const baseY = this.screen === 'title' ? h * 0.56 : h * 0.45;
      for (let i = 0; i < items.length; i++) {
        const y = baseY + i * 44;
        if (mouse.y > y - 30 && mouse.y < y + 12 && mouse.x > w / 2 - 200 && mouse.x < w / 2 + 200) {
          menuState.selected = i;
          if (mouse.clicked) this.chooseMenu(items[i]);
        }
      }
      if (wasPressed('Enter')) this.chooseMenu(items[menuState.selected]);
    } else if (this.screen === 'controls' || this.screen === 'credits') {
      if (wasPressed('Escape', 'Enter')) this.screen = this.prevScreen || 'title';
    } else if (this.screen === 'play') {
      if (wasPressed('Escape', 'KeyP')) {
        if (shopOpen()) closeShop();
        else { this.prevScreen = 'play'; this.setMenu('pause'); playUiBlip(false); }
      }
      if (wasPressed('KeyQ')) cycleWeapon(this.world);
      if (wasPressed('KeyR')) {
        this.world.radioStation = (this.world.radioStation + 1) % RADIO_STATIONS.length;
        this.world.radio.name = RADIO_STATIONS[this.world.radioStation].name;
        this.world.notify('Radio: ' + this.world.radio.name);
        setRadioStation(RADIO_STATIONS[this.world.radioStation].rootHz);
      }
      if (wasPressed('KeyM')) {
        const muted = toggleMute();
        this.world.notify(muted ? 'Audio muted' : 'Audio on');
      }
      if (shopOpen()) {
        if (wasPressed('KeyW', 'ArrowUp')) shopMove(-1);
        if (wasPressed('KeyS', 'ArrowDown')) shopMove(1);
        if (wasPressed('KeyE', 'Enter')) this.world.notify(buyCurrent(this.world));
        if (wasPressed('Escape')) closeShop();
      }
    }
  },

  chooseMenu(item) {
    playUiBlip(true);
    if (item === 'PLAY' || item === 'RESUME') {
      if (!this.world) this.startWorld(false);
      this.screen = 'play';
      resumeAudio();
    } else if (item === 'CONTINUE') {
      this.startWorld(true);
      this.screen = 'play';
      resumeAudio();
    } else if (item === 'CONTROLS' || item === 'CREDITS') {
      this.prevScreen = this.screen;
      this.screen = item === 'CONTROLS' ? 'controls' : 'credits';
    }
  },

  startWorld(fromSave) {
    const world = createWorld(1);
    if (fromSave) {
      const data = loadGame();
      if (data) {
        applySave(world, data);
        if (data.px) { world.player.x = data.px; world.player.y = data.py; }
        world.notify('Save loaded');
      }
    }
    this.world = world;
    if (this.shot) applyShot(world, this, this.shot);
    saveGame(world);
  },
};

createLoop(canvas, main);
// debug/testing hook
window.__sol = { main, canvas };
