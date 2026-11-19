// Save/load of progression in localStorage: money, weapons, mission progress, position.

const KEY = 'sol-dorado-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      weapons: state.weapons,
      ammo: state.ammo,
      armor: state.armor,
      currentWeapon: state.currentWeapon,
      missionIndex: state.missionIndex,
      completed: state.completed,
      stats: state.stats,
      px: state.player.x, py: state.player.y,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!loadGame();
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Apply a loaded save to the fresh world state (position applied by the caller).
export function applySave(state, data) {
  state.money = data.money ?? 350;
  state.weapons = data.weapons ?? ['pistol'];
  state.ammo = data.ammo ?? { pistol: 60 };
  state.armor = data.armor ?? 0;
  state.currentWeapon = data.currentWeapon ?? 'pistol';
  state.missionIndex = data.missionIndex ?? 0;
  state.completed = data.completed ?? [];
  state.stats = data.stats ?? { kills: 0, stolen: 0, earned: 0, missionsDone: 0 };
}
