// Frostline — the story. Ash, an ice-road driver for the northern crew run by
// Old Maren, works five jobs across one long winter night in Frostline.
// Each mission is a list of steps; the engine advances steps as Ash finishes
// them, pays out on completion, and starts the next job.

import { dist } from './random.js';

export const MISSIONS = [
  {
    name: 'First Run',
    intro: 'Old Maren: "First job, Ash. Take the crate across the frozen lake to the east shore. Ice is thin near the middle — keep moving."',
    reward: 150,
    steps: [
      { kind: 'drive', x: 4400, y: 900, r: 90, text: 'Cross the frozen lake to the east-shore drop' },
    ],
  },
  {
    name: 'Cold Storage',
    intro: 'Old Maren: "The warehouse in Northgate holds our winter stock. Get in on foot, grab the crate, and bring it to the Old Town shop. Quietly."',
    reward: 250,
    steps: [
      { kind: 'drive', x: 1700, y: 520, r: 90, text: 'Drive to the Northgate warehouse' },
      { kind: 'grab', x: 1700, y: 505, r: 60, text: 'On foot — grab the crate at the loading dock (press E)' },
      { kind: 'deliver', x: 1200, y: 1500, r: 90, text: 'Deliver the crate to the Old Town shop' },
    ],
  },
  {
    name: 'Whiteout',
    intro: 'Old Maren: "A blizzard is coming off the bay. The package has to reach the Northgate depot anyway. Drive slow, drive steady."',
    reward: 300,
    steps: [
      { kind: 'drive', x: 2600, y: 500, r: 90, text: 'Drive the package to the Northgate depot — through the blizzard' },
    ],
  },
  {
    name: 'Ice Breaker',
    intro: 'Old Maren: "The patrol is onto us. Three cruisers, Ash. Break across the frozen river and lose them at the Southworks safehouse."',
    reward: 400,
    steps: [
      { kind: 'drive', x: 950, y: 3050, r: 100, text: 'Outrun the patrol — reach the Southworks safehouse' },
    ],
  },
  {
    name: 'The Long Night',
    intro: 'Old Maren: "Last night of the season. Three drops, then home to the harbor. Do this and the crew eats all winter."',
    reward: 600,
    steps: [
      { kind: 'deliver', x: 2000, y: 3000, r: 90, text: 'Drop 1 of 3 — Southworks yard' },
      { kind: 'deliver', x: 3400, y: 2600, r: 90, text: 'Drop 2 of 3 — east gate' },
      { kind: 'deliver', x: 600, y: 2500, r: 90, text: 'Drop 3 of 3 — old cannery' },
      { kind: 'drive', x: 250, y: 2050, r: 100, text: 'Come home — the Frozen Harbor' },
    ],
  },
];

export function makeMissionState() {
  return {
    index: 0,
    stepIndex: 0,
    active: false,
    done: false,
    banner: '',
    bannerTimer: 0,
    allDone: false,
  };
}

export function currentMission(mission) {
  return MISSIONS[mission.index] || null;
}

export function currentStep(mission) {
  const m = currentMission(mission);
  return m ? m.steps[mission.stepIndex] || null : null;
}

export function startMission(mission, index) {
  mission.index = index;
  mission.stepIndex = 0;
  mission.active = true;
  mission.done = false;
  const m = MISSIONS[index];
  mission.banner = `MISSION ${index + 1}: ${m.name} — $${m.reward}`;
  mission.bannerTimer = 4;
  return m;
}

// E pressed near a grab step while on foot: take the crate.
export function tryGrab(G) {
  const step = currentStep(G.mission);
  if (!G.mission.active || !step || step.kind !== 'grab') return false;
  if (G.player.inCar) return false;
  if (dist(G.player.x, G.player.y, step.x, step.y) > step.r) return false;
  advanceStep(G);
  return true;
}

function advanceStep(G) {
  const m = currentMission(G.mission);
  G.mission.stepIndex++;
  if (G.mission.stepIndex >= m.steps.length) {
    completeMission(G);
  } else {
    G.audio.blip(880, 0.12, 'sine', 0.12);
  }
}

function completeMission(G) {
  const m = currentMission(G.mission);
  G.player.cash += m.reward;
  G.mission.done = true;
  G.mission.active = false;
  G.mission.banner = `JOB DONE — ${m.name}  +$${m.reward}`;
  G.mission.bannerTimer = 4;
  G.audio.jingle();
  G.save();
  // The next job starts after a breath.
  G.mission.nextAt = G.time + 2.5;
}

// Advance steps by proximity / timers. Called every frame while playing.
export function updateMissions(G, dt) {
  const mission = G.mission;
  if (mission.bannerTimer > 0) mission.bannerTimer -= dt;

  if (!mission.active) {
    if (mission.allDone) return;
    if (mission.nextAt !== undefined && G.time >= mission.nextAt) {
      mission.nextAt = undefined;
      if (mission.index + 1 < MISSIONS.length) {
        startMission(mission, mission.index + 1);
        onMissionStart(G, mission.index);
      } else {
        mission.allDone = true;
        mission.banner = 'ALL JOBS DONE — Frostline is yours, Ash.';
        mission.bannerTimer = 6;
      }
    }
    return;
  }

  const step = currentStep(mission);
  if (!step) return;
  const p = G.player;

  if (step.kind === 'drive' || step.kind === 'deliver') {
    if (dist(p.x, p.y, step.x, step.y) < step.r) advanceStep(G);
  } else if (step.kind === 'grab') {
    // Completion happens through tryGrab (E key); the marker just waits.
  }
}

// Side effects when a mission starts: weather, heat, police.
export function onMissionStart(G, index) {
  if (index === 2) {
    // Whiteout: the blizzard rolls in for the whole job.
    G.blizzardTarget = 1;
  } else if (index === 3) {
    // Ice Breaker: the patrol is already on Ash.
    G.setWanted(3);
  } else if (index === 4) {
    G.blizzardTarget = 0.45;
  } else {
    G.blizzardTarget = 0.12;
  }
}
