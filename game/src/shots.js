// Frostline — screenshot scenes. The ?shot= query param stages a scene so a
// screenshot shows a real moment of the game: the cover, a mission, a police
// chase, or a blizzard night. Every scene is the game itself, playing.

import { makeCar, makePolice } from './vehicles.js';
import { startMission, onMissionStart } from './missions.js';

// Stages a scene and returns a short label. Called once after the game loads.
export function applyShot(G, shot) {
  const p = G.player;
  const placeInCar = (x, y, angle) => {
    if (!p.car) return;
    p.car.x = x; p.car.y = y; p.car.angle = angle;
    p.car.vx = 0; p.car.vy = 0; p.car.speed = 0;
    p.x = x; p.y = y; p.angle = angle;
    p.inCar = true;
  };
  const placeOnFoot = (x, y, angle) => {
    p.inCar = false; p.car = null;
    p.x = x; p.y = y; p.angle = angle;
  };

  if (shot === 'cover') {
    // Ash driving the ice road along the lake, traffic around, first job live.
    G.mode = 'playing';
    placeInCar(3700, 1300, 0);
    p.car.speed = 120;
    startMission(G.mission, 0);
    onMissionStart(G, 0);
    G.blizzard = 0.12;
    G.blizzardTarget = 0.12;
    return 'cover';
  }
  if (shot === 'mission') {
    // Cold Storage: Ash on foot at the Northgate warehouse, crate to grab.
    G.mode = 'playing';
    startMission(G.mission, 1);
    onMissionStart(G, 1);
    G.mission.stepIndex = 1;
    placeOnFoot(1700, 540, -Math.PI / 2);
    // Park the car nearby so the scene reads as a job in progress.
    const car = makeCar(1620, 560, 0.3, 'player', '#3a6ac2', 'Icefang');
    G.cars.push(car);
    G.blizzard = 0.15;
    G.blizzardTarget = 0.15;
    return 'mission';
  }
  if (shot === 'chase') {
    // Ice Breaker: wanted 3, three cruisers closing in on the lake road.
    G.mode = 'playing';
    placeInCar(3400, 1800, 0);
    p.car.speed = 260;
    startMission(G.mission, 3);
    onMissionStart(G, 3);
    G.setWanted(3);
    const spots = [
      [3180, 1720, 0.2], [3260, 1900, -0.2], [3120, 1840, 0.1],
    ];
    for (const [x, y, a] of spots) {
      const cop = makePolice(x, y);
      cop.angle = a;
      G.police.push(cop);
    }
    G.blizzard = 0.2;
    G.blizzardTarget = 0.2;
    return 'chase';
  }
  if (shot === 'night') {
    // A blizzard night on the frozen lake: headlights, snow, the long night.
    G.mode = 'playing';
    G.night = true;
    placeInCar(4200, 2000, Math.PI);
    p.car.speed = 90;
    startMission(G.mission, 4);
    onMissionStart(G, 4);
    G.blizzard = 0.75;
    G.blizzardTarget = 0.75;
    return 'night';
  }
  // Default: the title screen.
  G.mode = 'title';
  return 'start';
}
