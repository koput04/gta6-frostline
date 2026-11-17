// Frostline — the player, Ash. On foot Ash walks and runs, punches, and
// steals cars; behind the wheel Ash drives with the car's own physics.
// Stealing a traffic car and punching a pedestrian both raise the wanted level.

import { clamp, dist } from './random.js';
import { WORLD_W, WORLD_H, collidesBuilding } from './world.js';
import { driveCar } from './vehicles.js';

export function makePlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y, angle: 0,
    vx: 0, vy: 0, speed: 0,
    inCar: false, car: null,
    health: 100,
    punchTimer: 0, punchCooldown: 0,
    bustedTimer: 0,
    cash: 0,
  };
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// On-foot movement: WASD/arrows, Shift to run, F to punch.
export function updateOnFoot(player, input, dt, buildings, peds, onPunch) {
  const axis = input.moveAxis();
  const run = input.isDown('Shift');
  const speed = run ? 265 : 165;
  let mx = axis.x;
  let my = axis.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    player.angle = Math.atan2(my, mx);
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
  }
  player.x = clamp(player.x, 24, WORLD_W - 24);
  player.y = clamp(player.y, 24, WORLD_H - 24);
  const hit = collidesBuilding(buildings, player.x, player.y, 12);
  if (hit) {
    const cx = clamp(player.x, hit.x, hit.x + hit.w);
    const cy = clamp(player.y, hit.y, hit.y + hit.h);
    const dx = player.x - cx;
    const dy = player.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const push = 13 - d;
    player.x += (dx / d) * push;
    player.y += (dy / d) * push;
  }

  player.punchCooldown -= dt;
  player.punchTimer -= dt;
  if (input.wasPressed('KeyF') && player.punchCooldown <= 0) {
    player.punchCooldown = 0.45;
    player.punchTimer = 0.22;
    // Hit the nearest pedestrian in front of Ash.
    for (const ped of peds) {
      if (ped.down) continue;
      const d = dist(player.x, player.y, ped.x, ped.y);
      if (d < 58) {
        const ang = Math.atan2(ped.y - player.y, ped.x - player.x);
        if (Math.abs(ang - player.angle) < 1.2 || d < 30) {
          ped.down = true;
          ped.downTimer = 5;
          ped.vx = Math.cos(ang) * 160;
          ped.vy = Math.sin(ang) * 160;
          onPunch(ped);
          break;
        }
      }
    }
  }
}

// Driving: W/S throttle, A/D steer, Space handbrake.
export function updateDriving(player, input, dt, buildings) {
  const car = player.car;
  if (!car) return { crashed: false };
  let throttle = 0;
  if (input.isDown('up')) throttle += 1;
  if (input.isDown('down')) throttle -= 1;
  let steer = 0;
  if (input.isDown('left')) steer -= 1;
  if (input.isDown('right')) steer += 1;
  const res = driveCar(car, throttle, steer, input.isDown('Space'), dt, buildings);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
  if (car.wrecked) {
    // The car died under Ash: step out, hurt.
    player.inCar = false;
    player.car = null;
    player.health -= 25;
  }
  return res;
}

// E: step into the nearest car, or step out of the one Ash drives.
// Stealing a traffic car is a crime: it raises the wanted level.
export function tryEnterExit(player, cars, onSteal) {
  if (player.inCar) {
    const car = player.car;
    player.inCar = false;
    player.car = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    player.speed = 0;
    return { entered: false };
  }
  const car = nearestCar(cars, player.x, player.y, 56);
  if (!car) return { entered: false };
  if (car.kind === 'traffic') onSteal(car);
  if (car.kind === 'police') return { entered: false }; // cannot steal a cruiser
  player.inCar = true;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  return { entered: true, car };
}
