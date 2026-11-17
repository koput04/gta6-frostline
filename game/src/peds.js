// Frostline — pedestrians. Frostline folk walk the snowy sidewalks, hurry
// away from speeding cars, and go down (and stay down a while) when punched.

import { makeRng, range, pick, dist, clamp } from './random.js';
import { ROADS_X, ROADS_Y, WORLD_W, WORLD_H, onRoad, collidesBuilding } from './world.js';

const COATS = ['#b03a3a', '#3a6ab0', '#3a9a5a', '#d8a23a', '#7a4a9a', '#c26a2a', '#4a4a4a', '#2a8a8a'];

export function makePeds(rng, count, buildings, playerPos) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    // Stand just off a road (sidewalk), never on the lake centre.
    const vertical = rng() < 0.5;
    let x, y;
    if (vertical) {
      x = pick(rng, ROADS_X) + (rng() < 0.5 ? -48 : 48);
      y = 150 + rng() * (WORLD_H - 300);
    } else {
      x = 420 + rng() * (WORLD_W - 900);
      y = pick(rng, ROADS_Y) + (rng() < 0.5 ? -48 : 48);
    }
    if (x > 3850 || x < 380) continue;
    if (dist(x, y, playerPos.x, playerPos.y) < 350) continue;
    if (collidesBuilding(buildings, x, y, 16)) continue;
    peds.push({
      x, y, angle: rng() * Math.PI * 2,
      vx: 0, vy: 0,
      coat: pick(rng, COATS),
      down: false, downTimer: 0,
      wanderTimer: range(rng, 1, 4),
      walkPhase: rng() * 6,
      fleeing: false,
    });
  }
  return peds;
}

export function updatePeds(peds, dt, buildings, cars) {
  for (const ped of peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      ped.x += ped.vx * dt;
      ped.y += ped.vy * dt;
      ped.vx *= 0.9;
      ped.vy *= 0.9;
      if (ped.downTimer <= 0) ped.down = false;
      continue;
    }
    // Flee a fast car that is close.
    let threat = null;
    for (const car of cars) {
      if (car.wrecked) continue;
      if (Math.abs(car.speed) > 140 && dist(ped.x, ped.y, car.x, car.y) < 100) {
        threat = car;
        break;
      }
    }
    ped.wanderTimer -= dt;
    if (threat) {
      const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.angle = away;
      ped.fleeing = true;
    } else if (ped.wanderTimer <= 0) {
      ped.wanderTimer = range(Math.random, 2, 6);
      ped.angle = Math.random() * Math.PI * 2;
      ped.fleeing = false;
    }
    const speed = ped.fleeing ? 150 : 55;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (!onRoad(nx, ny) || ped.fleeing) {
      if (!collidesBuilding(buildings, nx, ny, 12)) {
        ped.x = clamp(nx, 30, WORLD_W - 30);
        ped.y = clamp(ny, 30, WORLD_H - 30);
      } else {
        ped.angle += Math.PI / 2;
      }
    } else {
      ped.angle += Math.PI / 2;
    }
    ped.walkPhase += dt * (ped.fleeing ? 10 : 5);
  }
}
