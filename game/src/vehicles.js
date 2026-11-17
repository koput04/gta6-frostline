// Frostline — vehicles. Car physics with ice: on asphalt a car grips and turns,
// on the frozen lake and bay it slides, brakes late and drifts wide.
// Traffic cars follow the road grid; police cars chase the player.

import { clamp, dist, angleDiff, angleLerp, pick } from './random.js';
import { ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, isIce, onRoad, collidesBuilding } from './world.js';

export const CAR_NAMES = ['Frosthawk', 'Icefang', 'Wolfrun', 'Snowcat', 'Glacier', 'Tundra', 'Blizzard', 'Northwind'];
export const CAR_COLORS = ['#c23a3a', '#3a6ac2', '#d8a23a', '#3a9a5a', '#8a3ac2', '#c26a2a', '#2aa8a8', '#b0b8c0'];

let nextCarId = 1;

export function makeCar(x, y, angle, kind, color, name) {
  return {
    id: nextCarId++, x, y, angle, vx: 0, vy: 0, speed: 0,
    kind, color, name: name || 'Frosthawk',
    health: 100, wrecked: false,
    // traffic brain
    roadAxis: 'x', roadDir: 1, cruise: 90,
    // police brain
    ramCooldown: 0, stuckTime: 0,
  };
}

// One physics step for a driven car. Returns nothing; mutates the car.
// throttle -1..1, steer -1..1, handbrake bool.
export function driveCar(car, throttle, steer, handbrake, dt, buildings) {
  const ice = isIce(car.x, car.y);
  const grip = ice ? 0.93 : 0.62;        // lateral grip kept per step (lower = slides)
  const damp = ice ? 0.995 : 0.982;      // forward drag per step (ice keeps speed)
  const accel = (ice ? 150 : 230) * throttle;
  const maxSpeed = ice ? 430 : 470;

  // Steering bites less at speed, and less on ice.
  const steerPower = (ice ? 1.5 : 2.1) * (1 - Math.min(0.55, Math.abs(car.speed) / 900));
  car.angle += steer * steerPower * dt * (car.speed >= 0 ? 1 : -1) * (Math.abs(car.speed) > 12 ? 1 : 0.25);

  // Forward force along the heading.
  const fx = Math.cos(car.angle) * accel;
  const fy = Math.sin(car.angle) * accel;
  car.vx += fx * dt;
  car.vy += fy * dt;

  // Split velocity into forward and lateral parts; lateral grip eats the slide.
  const fwdX = Math.cos(car.angle);
  const fwdY = Math.sin(car.angle);
  const fwdSpeed = car.vx * fwdX + car.vy * fwdY;
  let latX = car.vx - fwdX * fwdSpeed;
  let latY = car.vy - fwdY * fwdSpeed;
  const keep = Math.pow(grip, dt * 60);
  latX *= keep;
  latY *= keep;
  if (handbrake) { latX *= 0.9; latY *= 0.9; }
  let newFwd = fwdSpeed * Math.pow(damp, dt * 60);
  if (handbrake) newFwd *= Math.pow(0.94, dt * 60);
  if (throttle === 0) newFwd *= Math.pow(0.985, dt * 60);
  newFwd = clamp(newFwd, -maxSpeed * 0.45, maxSpeed);
  car.vx = fwdX * newFwd + latX;
  car.vy = fwdY * newFwd + latY;
  car.speed = newFwd;

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, WORLD_H - 30);

  const hit = collidesBuilding(buildings, car.x, car.y, 17);
  if (hit) {
    // Push out along the smallest penetration and bleed speed.
    const cx = clamp(car.x, hit.x, hit.x + hit.w);
    const cy = clamp(car.y, hit.y, hit.y + hit.h);
    const dx = car.x - cx;
    const dy = car.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const push = 18 - d;
    car.x += (dx / d) * push;
    car.y += (dy / d) * push;
    const impact = Math.abs(car.speed);
    if (impact > 90) {
      car.health -= (impact - 90) * 0.12;
      car.vx *= -0.25;
      car.vy *= -0.25;
      car.speed *= -0.25;
    } else {
      car.vx *= 0.4;
      car.vy *= 0.4;
      car.speed *= 0.4;
    }
    if (car.health <= 0) {
      car.health = 0;
      car.wrecked = true;
    }
    return { crashed: impact > 90, building: hit };
  }
  return { crashed: false };
}

export function makeTraffic(rng, count, buildings, playerPos) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    let x, y;
    if (vertical) {
      x = pick(rng, ROADS_X);
      y = 200 + rng() * (WORLD_H - 400);
    } else {
      x = 500 + rng() * (WORLD_W - 1000);
      y = pick(rng, ROADS_Y);
    }
    if (dist(x, y, playerPos.x, playerPos.y) < 500) continue;
    const car = makeCar(x, y, vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      'traffic', pick(rng, CAR_COLORS), pick(rng, CAR_NAMES));
    car.roadAxis = vertical ? 'y' : 'x';
    car.roadDir = rng() < 0.5 ? 1 : -1;
    car.cruise = 70 + rng() * 70;
    cars.push(car);
  }
  return cars;
}

// Traffic follows the road grid: drive along its road, turn at intersections,
// slow down for the car ahead.
export function updateTraffic(car, dt, buildings, allCars) {
  if (car.wrecked) return;
  const road = car.roadAxis === 'y'
    ? ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a))
    : ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
  const targetAngle = car.roadAxis === 'y'
    ? (car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.roadDir > 0 ? 0 : Math.PI);
  car.angle = angleLerp(car.angle, targetAngle, Math.min(1, dt * 3));

  // Slow for a car ahead on the same road.
  let ahead = Infinity;
  for (const other of allCars) {
    if (other === car || other.wrecked) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 110) {
      const rel = Math.atan2(other.y - car.y, other.x - car.x);
      if (Math.abs(angleDiff(car.angle, rel)) < 0.6) ahead = Math.min(ahead, d);
    }
  }
  const want = ahead < 110 ? 0 : car.cruise;
  const throttle = car.speed < want ? 0.7 : 0;
  driveCar(car, throttle, 0, false, dt, buildings);

  // At an intersection, sometimes turn onto the crossing road.
  const onCross = car.roadAxis === 'y'
    ? ROADS_Y.some((ry) => Math.abs(car.y - ry) < 12)
    : ROADS_X.some((rx) => Math.abs(car.x - rx) < 12);
  if (onCross && Math.random() < 0.004) {
    car.roadAxis = car.roadAxis === 'y' ? 'x' : 'y';
    car.roadDir = Math.random() < 0.5 ? 1 : -1;
  }
  // Keep traffic inside the city, off the lake.
  if (car.x > 3800) { car.roadAxis = 'y'; car.roadDir = -1; }
  if (car.x < 380) { car.roadAxis = 'y'; car.roadDir = 1; }
}

export function makePolice(x, y) {
  const car = makeCar(x, y, 0, 'police', '#e8ecf0', 'Interceptor');
  car.cruise = 330;
  return car;
}

// Police chase: steer toward the player, ram, and keep pressure on.
export function updatePolice(car, dt, buildings, player, allCars) {
  if (car.wrecked) return;
  const want = Math.atan2(player.y - car.y, player.x - car.x);
  const diff = angleDiff(car.angle, want);
  const steer = clamp(diff * 2.2, -1, 1);
  const d = dist(car.x, car.y, player.x, player.y);
  const throttle = d > 60 ? 1 : 0.4;
  car.ramCooldown -= dt;
  const res = driveCar(car, throttle, steer, false, dt, buildings);
  if (res.crashed) car.health -= 6;
  // Ram the player's car: shove it and damage it.
  if (player.inCar && player.car && d < 52 && car.ramCooldown <= 0) {
    car.ramCooldown = 1.2;
    const push = Math.atan2(player.y - car.y, player.x - car.x);
    player.car.vx += Math.cos(push) * 260;
    player.car.vy += Math.sin(push) * 260;
    player.car.health -= 8;
    if (player.car.health <= 0) {
      player.car.health = 0;
      player.car.wrecked = true;
    }
    return { rammed: true };
  }
  return { rammed: false };
}
