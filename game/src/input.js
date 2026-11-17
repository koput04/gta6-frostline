// Frostline — keyboard input. Tracks held keys and edge-triggered presses.
// Keys are read by code: ArrowUp/W etc. move, E enters/exits cars and grabs,
// F punches, Space is the handbrake, Shift runs / drives faster, P or Escape
// pauses, M mutes, Enter confirms menus.

const held = new Set();
const pressed = new Set();

const ALIASES = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function initInput() {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = ALIASES[event.code] || event.code;
    held.add(key);
    pressed.add(key);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    const key = ALIASES[event.code] || event.code;
    held.delete(key);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
}

export function isDown(name) {
  return held.has(name);
}

export function wasPressed(name) {
  return pressed.has(name);
}

// True when the player is steering: one of the four movement keys is held.
export function moveAxis() {
  let x = 0;
  let y = 0;
  if (isDown('left')) x -= 1;
  if (isDown('right')) x += 1;
  if (isDown('up')) y -= 1;
  if (isDown('down')) y += 1;
  return { x, y };
}

// Call once per frame, after the game has read presses.
export function endFrameInput() {
  pressed.clear();
}
