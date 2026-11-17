// Frostline — entry point. Wires the world, the player, traffic, police,
// missions, the race and the save together, and runs the game loop.
// Ash starts at the Frozen Harbor in a Frosthawk, first job live.

import { initInput, isDown, wasPressed, moveAxis, endFrameInput } from './input.js';
import { AudioEngine } from './audio.js';
import { buildWorld, WORLD_W, WORLD_H, ROADS_X, ROADS_Y, isIce } from './world.js';
import { makeCar, makeTraffic, makePolice, updateTraffic, updatePolice, CAR_NAMES, CAR_COLORS } from './vehicles.js';
import { makePlayer, updateOnFoot, updateDriving, tryEnterExit, nearestCar } from './player.js';
import { makePeds, updatePeds } from './peds.js';
import { makeMissionState, startMission, onMissionStart, updateMissions, tryGrab, currentStep, MISSIONS } from './missions.js';
import { render } from './render.js';
import { applyShot } from './shots.js';
import { makeRng, pick, dist, clamp } from './random.js';

const SAVE_KEY = 'frostline-save-v1';
const SEED = 20261118;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  G.vw = canvas.width;
  G.vh = canvas.height;
}

const G = {
  time: 0,
  mode: 'title',
  vw: 1280,
  vh: 800,
  camera: { x: 0, y: 0 },
  world: null,
  player: null,
  cars: [],
  police: [],
  mission: makeMissionState(),
  race: { active: false, available: true, checkpoint: 0, timeLeft: 0 },
  wanted: 0,
  wantedTimer: 0,
  blizzard: 0.12,
  blizzardTarget: 0.12,
  night: false,
  snow: [],
  cachesTaken: 0,
  racesWon: 0,
  audio: new AudioEngine(),
  save,
  setWanted,
  addWanted,
  allCars,
};

function allCars() {
  return G.cars.concat(G.police);
}

function setWanted(n) {
  G.wanted = clamp(n, 0, 5);
  G.wantedTimer = 0;
}

function addWanted(n) {
  setWanted(G.wanted + n);
}

function save() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.player.cash,
      missionIndex: G.mission.index,
      missionDone: G.mission.allDone,
      cachesTaken: G.world.caches.filter((c) => c.taken).length,
      racesWon: G.racesWon,
      takenCaches: G.world.caches.map((c) => c.taken),
    }));
  } catch {
    // Storage may be unavailable; the game still plays.
  }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.cash === 'number') G.player.cash = data.cash;
    if (Array.isArray(data.takenCaches)) {
      data.takenCaches.forEach((taken, i) => {
        if (taken && G.world.caches[i]) G.world.caches[i].taken = true;
      });
      G.cachesTaken = G.world.caches.filter((c) => c.taken).length;
    }
    if (typeof data.racesWon === 'number') G.racesWon = data.racesWon;
  } catch {
    // A bad save is ignored; the game starts fresh.
  }
}

function initWorld() {
  G.world = buildWorld(SEED);
  // Snow drifts and ice cracks, for the renderer.
  const rng = makeRng(SEED + 7);
  G.world.drifts = [];
  for (let i = 0; i < 90; i++) {
    G.world.drifts.push({
      x: rng() * WORLD_W, y: rng() * WORLD_H,
      rx: 40 + rng() * 130, ry: 18 + rng() * 46, rot: rng() * Math.PI,
    });
  }
  G.world.cracks = [];
  for (let i = 0; i < 60; i++) {
    const inLake = rng() < 0.7;
    G.world.cracks.push({
      x: inLake ? 3950 + rng() * 800 : 20 + rng() * 280,
      y: 250 + rng() * 3100,
      dx: (rng() - 0.5) * 160, dy: (rng() - 0.5) * 160,
    });
  }
  G.player = makePlayer(G.world.spawn);
  const starter = makeCar(G.world.spawn.x, G.world.spawn.y, 0, 'player', '#c23a3a', 'Frosthawk');
  G.cars.push(starter);
  G.player.car = starter;
  G.player.inCar = true;
  G.world.peds = makePeds(makeRng(SEED + 3), 26, G.world.buildings, G.player);
  G.cars.push(...makeTraffic(makeRng(SEED + 5), 16, G.world.buildings, G.player));
  // A few parked cars around the city, free to take.
  const prng = makeRng(SEED + 11);
  for (let i = 0; i < 6; i++) {
    const rx = pick(prng, ROADS_X);
    const ry = pick(prng, ROADS_Y);
    const car = makeCar(rx + (prng() < 0.5 ? -46 : 46), ry + (prng() < 0.5 ? -46 : 46),
      prng() * Math.PI * 2, 'traffic', pick(prng, CAR_COLORS), pick(prng, CAR_NAMES));
    car.cruise = 0;
    G.cars.push(car);
  }
  for (let i = 0; i < 240; i++) {
    G.snow.push({ x: Math.random() * G.vw, y: Math.random() * G.vh, s: 1 + Math.random() * 2.5, z: 0.4 + Math.random() });
  }
  loadSave();
}

// ---- wanted / police ----

let policeSpawnTimer = 0;

function updateWanted(dt) {
  const p = G.player;
  // The patrol closes in while wanted; it drifts away when Ash lays low.
  const desired = G.wanted > 0 ? Math.min(G.wanted, 4) : 0;
  policeSpawnTimer -= dt;
  if (G.police.length < desired && policeSpawnTimer <= 0) {
    policeSpawnTimer = 1.4;
    const spot = policeSpawnSpot();
    if (spot) G.police.push(makePolice(spot.x, spot.y));
  }
  if (G.wanted === 0 && G.police.length > 0) {
    G.police = G.police.filter((cop) => dist(cop.x, cop.y, p.x, p.y) < 700);
    if (G.police.length === 0) return;
  }
  let nearest = Infinity;
  for (const cop of G.police) nearest = Math.min(nearest, dist(cop.x, cop.y, p.x, p.y));
  if (nearest > 550) {
    G.wantedTimer += dt;
    if (G.wantedTimer > 14 && G.wanted > 0) {
      G.wanted -= 1;
      G.wantedTimer = 0;
    }
  } else {
    G.wantedTimer = 0;
  }
  // Busted: on foot, a cruiser sits on Ash.
  if (!p.inCar && G.wanted > 0) {
    const close = G.police.some((cop) => dist(cop.x, cop.y, p.x, p.y) < 48 && Math.abs(cop.speed) < 80);
    if (close) {
      p.bustedTimer += dt;
      if (p.bustedTimer > 1.2) bustPlayer();
    } else {
      p.bustedTimer = 0;
    }
  }
}

function policeSpawnSpot() {
  const p = G.player;
  // Spawn on a road, just out of sight of the player.
  for (let tries = 0; tries < 12; tries++) {
    const vertical = Math.random() < 0.5;
    const x = vertical ? pick(Math.random, ROADS_X) : 400 + Math.random() * 3200;
    const y = vertical ? 200 + Math.random() * 3200 : pick(Math.random, ROADS_Y);
    if (dist(x, y, p.x, p.y) > 620 && dist(x, y, p.x, p.y) < 1400) return { x, y };
  }
  return { x: clamp(p.x + 800, 400, 3600), y: clamp(p.y, 300, 3300) };
}

function bustPlayer() {
  const p = G.player;
  p.cash = Math.max(0, p.cash - 50);
  setWanted(0);
  G.police = [];
  G.mission.stepIndex = 0;
  p.bustedTimer = 0;
  p.health = 100;
  G.mode = 'busted';
  G.audio.sting();
  save();
}

function wreckPlayer() {
  const p = G.player;
  p.cash = Math.max(0, p.cash - 50);
  setWanted(0);
  G.police = [];
  p.health = 100;
  G.mode = 'wasted';
  G.audio.sting();
  save();
}

// ---- race + caches ----

function updateRace(dt) {
  const race = G.race;
  const p = G.player;
  if (!race.active) {
    // The ice race starts at gate 1 on the frozen lake, in a car.
    if (race.available && p.inCar && dist(p.x, p.y, G.world.raceGates[0].x, G.world.raceGates[0].y) < 80) {
      race.active = true;
      race.checkpoint = 1;
      race.timeLeft = 90;
      G.mission.banner = 'ICE RACE — six gates, 90 seconds, $150';
      G.mission.bannerTimer = 3;
      G.audio.blip(660, 0.15, 'square', 0.1);
    }
    return;
  }
  race.timeLeft -= dt;
  const gate = G.world.raceGates[race.checkpoint];
  if (gate && dist(p.x, p.y, gate.x, gate.y) < 62) {
    race.checkpoint++;
    G.audio.blip(990, 0.1, 'sine', 0.12);
    if (race.checkpoint >= G.world.raceGates.length) {
      race.active = false;
      race.available = false;
      G.racesWon++;
      p.cash += 150;
      G.mission.banner = 'RACE WON — +$150';
      G.mission.bannerTimer = 3;
      G.audio.jingle();
      save();
    }
  }
  if (race.timeLeft <= 0) {
    race.active = false;
    G.mission.banner = 'RACE OVER — too slow. Try the lake gate again.';
    G.mission.bannerTimer = 3;
  }
}

function updateCaches() {
  const p = G.player;
  for (const c of G.world.caches) {
    if (c.taken) continue;
    if (dist(p.x, p.y, c.x, c.y) < 34) {
      c.taken = true;
      G.cachesTaken++;
      p.cash += 25;
      G.audio.blip(1320, 0.12, 'sine', 0.14);
      G.mission.banner = 'FROZEN CACHE — +$25';
      G.mission.bannerTimer = 2;
      save();
    }
  }
}

// ---- main loop ----

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;

  // Blizzard drifts toward its target; the wind answers slowly.
  G.blizzard += (G.blizzardTarget - G.blizzard) * Math.min(1, dt * 0.5);

  if (G.mode === 'title') {
    if (wasPressed('Enter')) {
      G.audio.ensure();
      G.mode = 'playing';
      startMission(G.mission, G.mission.index);
      onMissionStart(G, G.mission.index);
    }
  } else if (G.mode === 'playing') {
    if (wasPressed('KeyP') || wasPressed('Escape')) {
      G.mode = 'paused';
    } else {
      updatePlaying(dt);
    }
  } else if (G.mode === 'paused') {
    if (wasPressed('Enter') || wasPressed('KeyP') || wasPressed('Escape')) G.mode = 'playing';
    if (wasPressed('KeyR')) {
      G.mission.stepIndex = 0;
      G.mode = 'playing';
    }
  } else if (G.mode === 'busted' || G.mode === 'wasted') {
    if (wasPressed('Enter')) {
      // Back on the street at the harbor, in a fresh Frosthawk.
      const spawn = G.world.spawn;
      const car = makeCar(spawn.x, spawn.y, 0, 'player', '#c23a3a', 'Frosthawk');
      G.cars.push(car);
      G.player.x = spawn.x;
      G.player.y = spawn.y;
      G.player.car = car;
      G.player.inCar = true;
      G.player.health = 100;
      G.mode = 'playing';
    }
  }

  if (wasPressed('KeyM')) {
    G.audio.ensure();
    G.audio.toggleMute();
  }

  render(G, ctx, G.vw, G.vh);
  endFrameInput();
  window.__frostlineReady = true;
  requestAnimationFrame(frame);
}

function updatePlaying(dt) {
  const p = G.player;
  G.audio.ensure();

  // E: grab a crate first, else enter/exit a car.
  if (wasPressed('KeyE')) {
    const grabbed = tryGrab(G);
    if (grabbed && G.mission.index === 1) {
      setWanted(2); // the warehouse alarm
      G.mission.banner = 'ALARM — the patrol is coming';
      G.mission.bannerTimer = 3;
    }
    if (!grabbed) {
      tryEnterExit(p, G.cars, () => {
        addWanted(1);
        G.audio.blip(330, 0.1, 'square', 0.1);
      });
    }
  }

  let crash = null;
  if (p.inCar) {
    crash = updateDriving(p, { isDown, wasPressed, moveAxis }, dt, G.world.buildings);
    if (crash && crash.crashed) {
      G.audio.crash();
      if (p.car && p.car.wrecked) wreckPlayer();
    }
  } else {
    updateOnFoot(p, { isDown, wasPressed, moveAxis }, dt, G.world.buildings, G.world.peds, () => {
      addWanted(1);
      G.audio.thud();
    });
    if (p.health <= 0) wreckPlayer();
  }

  // Traffic, pedestrians, police.
  for (const car of G.cars) {
    if (car === p.car) continue;
    if (car.cruise > 0) updateTraffic(car, dt, G.world.buildings, G.allCars());
  }
  updatePeds(G.world.peds, dt, G.world.buildings, G.allCars());
  for (const cop of G.police) {
    const res = updatePolice(cop, dt, G.world.buildings, p, G.allCars());
    if (res && res.rammed) G.audio.crash();
  }
  G.police = G.police.filter((cop) => !cop.wrecked);
  // Parked traffic cars that got wrecked stay as wrecks; remove far wrecks.
  G.cars = G.cars.filter((car) => !(car.wrecked && car !== p.car && dist(car.x, car.y, p.x, p.y) > 1500));

  updateWanted(dt);
  updateMissions(G, dt);
  updateRace(dt);
  updateCaches();

  // Health: a wrecked player car ends the run.
  if (p.inCar && p.car && p.car.wrecked) wreckPlayer();

  G.audio.update(p.inCar ? p.speed : 0, G.wanted, G.blizzard, p.inCar);
}

// ---- debug + shot hooks (used by the automated play-test) ----

window.FROSTLINE = {
  state() {
    const step = currentStep(G.mission);
    return {
      mode: G.mode,
      missionIndex: G.mission.index,
      missionName: MISSIONS[G.mission.index] ? MISSIONS[G.mission.index].name : null,
      missionActive: G.mission.active,
      missionAllDone: G.mission.allDone,
      objective: step ? { x: step.x, y: step.y, kind: step.kind, text: step.text } : null,
      player: {
        x: Math.round(G.player.x), y: Math.round(G.player.y),
        angle: G.player.angle, speed: Math.round(G.player.speed || 0),
        inCar: G.player.inCar, health: G.player.health,
      },
      wanted: G.wanted,
      cash: G.player.cash,
      cachesLeft: G.world.caches.filter((c) => !c.taken).length,
      race: { active: G.race.active, checkpoint: G.race.checkpoint, timeLeft: G.race.timeLeft },
      blizzard: G.blizzard,
    };
  },
  game: {
    get cars() { return G.cars.map((c) => ({ x: c.x, y: c.y, kind: c.kind, name: c.name, wrecked: c.wrecked })); },
    get caches() { return G.world.caches.map((c) => ({ x: c.x, y: c.y, taken: c.taken })); },
    get raceGates() { return G.world.raceGates; },
    get police() { return G.police.map((c) => ({ x: c.x, y: c.y })); },
  },
};

// ---- boot ----

initInput();
initWorld();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pointerdown', () => G.audio.ensure(), { once: true });

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) applyShot(G, shot);

requestAnimationFrame(frame);
