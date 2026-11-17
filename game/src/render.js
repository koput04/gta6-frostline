// Frostline — rendering. One canvas, top-down: the snowy city, the frozen
// lake, cars and people, police lights, falling snow, blizzard whiteout and
// night headlights, plus the HUD, the minimap and every menu screen.

import { clamp, dist } from './random.js';
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, LAKE, BAY, isIce, districtAt } from './world.js';
import { currentStep, MISSIONS } from './missions.js';

const SNOW_GROUND = '#dfe8ef';
const SNOW_GROUND_2 = '#d3dde6';
const ICE_COLOR = '#a8c8dd';
const ICE_DEEP = '#8fb4cf';
const ROAD_COLOR = '#3d4450';
const ROAD_EDGE = '#e8eef4';

export function render(G, ctx, vw, vh) {
  const p = G.player;
  const cam = G.camera;
  cam.x = clamp(p.x - vw / 2, 0, WORLD_W - vw);
  cam.y = clamp(p.y - vh / 2, 0, WORLD_H - vh);
  if (WORLD_W < vw) cam.x = (WORLD_W - vw) / 2;
  if (WORLD_H < vh) cam.y = (WORLD_H - vh) / 2;

  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  // World space: the camera follows the player.
  ctx.translate(-cam.x, -cam.y);
  drawGround(G, ctx, vw, vh);
  drawLamps(G, ctx);
  drawRaceGates(G, ctx);
  drawCaches(G, ctx);
  drawBuildings(G, ctx);
  drawTrees(G, ctx);
  drawMissionMarker(G, ctx);
  drawPeds(G, ctx);
  drawCars(G, ctx);
  drawPlayer(G, ctx);
  ctx.restore();
  // Screen space: snow, night and blizzard overlays, then the HUD.
  drawSnowfall(G, ctx, vw, vh);
  if (G.night) drawNight(G, ctx, vw, vh);
  if (G.blizzard > 0.05) drawBlizzard(G, ctx, vw, vh);

  drawHUD(G, ctx, vw, vh);
  if (G.mode === 'title') drawTitle(G, ctx, vw, vh);
  else if (G.mode === 'paused') drawPause(G, ctx, vw, vh);
  else if (G.mode === 'busted') drawEndScreen(G, ctx, vw, vh, 'BUSTED', 'The patrol took Ash in. The crew posted bail — $50.');
  else if (G.mode === 'wasted') drawEndScreen(G, ctx, vw, vh, 'WRECKED', 'Ash walked away from the wreck. The car did not.');
}

// ---- world ----

function drawGround(G, ctx, vw, vh) {
  const cam = G.camera;
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD_W, cam.x + vw + 40);
  const y1 = Math.min(WORLD_H, cam.y + vh + 40);

  ctx.fillStyle = SNOW_GROUND;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Snow drifts: soft patches.
  ctx.fillStyle = SNOW_GROUND_2;
  for (const d of G.world.drifts) {
    if (d.x < x0 - 80 || d.x > x1 + 80 || d.y < y0 - 80 || d.y > y1 + 80) continue;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.rx, d.ry, d.rot, 0, Math.PI * 2);
    ctx.fill();
  }

  // Frozen bay (west) and frozen lake (east).
  ctx.fillStyle = ICE_COLOR;
  ctx.fillRect(BAY.x0, BAY.y0, BAY.x1 - BAY.x0, BAY.y1 - BAY.y0);
  ctx.fillRect(LAKE.x0, LAKE.y0, LAKE.x1 - LAKE.x0, LAKE.y1 - LAKE.y0);
  // Ice cracks.
  ctx.strokeStyle = 'rgba(70,110,140,0.5)';
  ctx.lineWidth = 2;
  for (const c of G.world.cracks) {
    if (c.x < x0 - 100 || c.x > x1 + 100 || c.y < y0 - 100 || c.y > y1 + 100) continue;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + c.dx, c.y + c.dy);
    ctx.stroke();
  }
  ctx.fillStyle = ICE_DEEP;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAKE FROSTMERE', (LAKE.x0 + LAKE.x1) / 2, (LAKE.y0 + LAKE.y1) / 2);
  ctx.fillText('FROZEN BAY', (BAY.x0 + BAY.x1) / 2, 1800);

  // Roads: asphalt with snow shoulders and a dashed centre line.
  ctx.fillStyle = ROAD_COLOR;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = ROAD_EDGE;
  for (const rx of ROADS_X) {
    ctx.fillRect(rx - ROAD_W / 2 - 5, 0, 5, WORLD_H);
    ctx.fillRect(rx + ROAD_W / 2, 0, 5, WORLD_H);
  }
  for (const ry of ROADS_Y) {
    ctx.fillRect(0, ry - ROAD_W / 2 - 5, WORLD_W, 5);
    ctx.fillRect(0, ry + ROAD_W / 2, WORLD_W, 5);
  }
  ctx.fillStyle = '#e8d84a';
  for (const rx of ROADS_X) {
    for (let y = 0; y < WORLD_H; y += 90) ctx.fillRect(rx - 2, y, 4, 44);
  }
  for (const ry of ROADS_Y) {
    for (let x = 0; x < WORLD_W; x += 90) ctx.fillRect(x, ry - 2, 44, 4);
  }

  // District labels, faint, on the snow.
  ctx.fillStyle = 'rgba(60,80,100,0.55)';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('FROZEN HARBOR', 620, 200);
  ctx.fillText('OLD TOWN', 2000, 1050);
  ctx.fillText('NORTHGATE', 2300, 180);
  ctx.fillText('SOUTHWORKS', 2200, 3450);
}

function drawLamps(G, ctx) {
  ctx.fillStyle = '#2c3440';
  for (const l of G.world.lamps) {
    if (!inView(G, l.x, l.y, 30)) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    if (G.night) {
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c3440';
    }
  }
}

function drawRaceGates(G, ctx) {
  if (!G.race.active && !G.race.available) return;
  const gates = G.world.raceGates;
  gates.forEach((gate, i) => {
    if (!inView(G, gate.x, gate.y, 80)) return;
    const next = i === G.race.checkpoint;
    ctx.fillStyle = next ? '#ffd23a' : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(gate.x, gate.y, next ? 26 : 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), gate.x, gate.y + 6);
  });
}

function drawCaches(G, ctx) {
  for (const c of G.world.caches) {
    if (c.taken || !inView(G, c.x, c.y, 60)) continue;
    const pulse = 0.6 + 0.4 * Math.sin(G.time * 3 + c.id);
    ctx.fillStyle = `rgba(80,200,255,${0.25 + 0.35 * pulse})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 26 + 6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a7ab0';
    ctx.fillRect(c.x - 13, c.y - 10, 26, 20);
    ctx.fillStyle = '#bfe8ff';
    ctx.fillRect(c.x - 13, c.y - 10, 26, 5);
  }
}

function drawBuildings(G, ctx) {
  for (const b of G.world.buildings) {
    if (!inView(G, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    // Shadow on the snow.
    ctx.fillStyle = 'rgba(40,60,80,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    // Walls.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Snow-capped roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = '#f2f7fb';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 10);
    // Windows, lit at night.
    ctx.fillStyle = G.night ? '#ffd97a' : '#2c3a4a';
    const cols = Math.max(1, Math.floor(b.w / 46));
    const rows = Math.max(1, Math.floor(b.h / 46));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 12 + i * 44, b.y + 22 + j * 44, 16, 12);
      }
    }
  }
}

function drawTrees(G, ctx) {
  for (const t of G.world.trees) {
    if (!inView(G, t.x, t.y, 40)) continue;
    ctx.fillStyle = '#1e4a2e';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - t.r - 8);
    ctx.lineTo(t.x - t.r, t.y + t.r);
    ctx.lineTo(t.x + t.r, t.y + t.r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eef4f8';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - t.r - 8);
    ctx.lineTo(t.x - t.r * 0.55, t.y - t.r * 0.1);
    ctx.lineTo(t.x + t.r * 0.55, t.y - t.r * 0.1);
    ctx.closePath();
    ctx.fill();
  }
}

function drawMissionMarker(G, ctx) {
  const step = currentStep(G.mission);
  if (!G.mission.active || !step || step.kind === 'grab') {
    if (!G.mission.active || !step) return;
  }
  if (!step) return;
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 4);
  ctx.strokeStyle = `rgba(255,210,58,${0.5 + 0.5 * pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(step.x, step.y, 34 + 10 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,58,0.9)';
  ctx.beginPath();
  ctx.arc(step.x, step.y, 6, 0, Math.PI * 2);
  ctx.fill();
  // Beacon column so the target is visible from far away.
  const grad = ctx.createLinearGradient(step.x, step.y, step.x, step.y - 260);
  grad.addColorStop(0, 'rgba(255,210,58,0.35)');
  grad.addColorStop(1, 'rgba(255,210,58,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(step.x - 10, step.y - 260, 20, 260);
}

function drawPeds(G, ctx) {
  for (const ped of G.world.peds) {
    if (!inView(G, ped.x, ped.y, 30)) continue;
    const bob = ped.down ? 0 : Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = 'rgba(40,60,80,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.coat;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob, ped.down ? 7 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c89a';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 8 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCars(G, ctx) {
  for (const car of G.allCars()) {
    if (car.wrecked && car.kind !== 'police') {
      // Wreck: dark, tilted, smoking.
      drawCarBody(G, ctx, car, '#22262c', true);
      continue;
    }
    if (!inView(G, car.x, car.y, 60)) continue;
    drawCarBody(G, ctx, car, car.color, false);
    if (car.kind === 'police') drawPoliceLights(G, ctx, car);
    if (G.night && car === G.player.car) drawHeadlights(G, ctx, car);
  }
}

function drawCarBody(G, ctx, car, color, wrecked) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle + (wrecked ? 0.5 : 0));
  ctx.fillStyle = 'rgba(40,60,80,0.3)';
  ctx.fillRect(-22, -12, 44, 26);
  ctx.fillStyle = color;
  roundRect(ctx, -22, -13, 44, 26, 7);
  ctx.fill();
  ctx.fillStyle = '#20262e';
  roundRect(ctx, -6, -11, 16, 22, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(6, -10, 5, 20);
  ctx.fillStyle = '#111';
  ctx.fillRect(-22, -15, 8, 4);
  ctx.fillRect(-22, 11, 8, 4);
  ctx.fillRect(14, -15, 8, 4);
  ctx.fillRect(14, 11, 8, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 4);
  }
  ctx.restore();
}

function drawPoliceLights(G, ctx, car) {
  const phase = Math.floor(G.time * 6) % 2 === 0;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = phase ? '#ff2a2a' : '#2a6aff';
  ctx.beginPath();
  ctx.arc(-2, -8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = phase ? '#2a6aff' : '#ff2a2a';
  ctx.beginPath();
  ctx.arc(-2, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Glow on the snow.
  ctx.fillStyle = phase ? 'rgba(255,42,42,0.18)' : 'rgba(42,106,255,0.18)';
  ctx.beginPath();
  ctx.arc(car.x, car.y, 46, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeadlights(G, ctx, car) {
  const hx = car.x + Math.cos(car.angle) * 24;
  const hy = car.y + Math.sin(car.angle) * 24;
  const grad = ctx.createRadialGradient(hx, hy, 10, hx, hy, 190);
  grad.addColorStop(0, 'rgba(255,240,180,0.5)');
  grad.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(hx, hy, 190, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (p.inCar) return;
  if (!inView(G, p.x, p.y, 30)) return;
  const bob = Math.sin(G.time * 9) * 1.5;
  ctx.fillStyle = 'rgba(40,60,80,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ash: rust-red parka, dark trousers.
  ctx.fillStyle = '#a83a2a';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c89a';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 4, p.y - 8 + bob, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(p.x - 7, p.y + 6 + bob, 14, 5);
  if (p.punchTimer > 0) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSnowfall(G, ctx, vw, vh) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const wind = 30 + G.blizzard * 120;
  for (const flake of G.snow) {
    ctx.fillRect(flake.x, flake.y, flake.s, flake.s);
    flake.x += (wind * flake.z + 12) * 0.016;
    flake.y += (26 + 40 * flake.z) * 0.016;
    if (flake.y > vh + 4) { flake.y = -4; flake.x = Math.random() * vw; }
    if (flake.x > vw + 4) flake.x = -4;
  }
}

function drawBlizzard(G, ctx, vw, vh) {
  const a = G.blizzard * 0.34;
  ctx.fillStyle = `rgba(235,242,248,${a})`;
  ctx.fillRect(0, 0, vw, vh);
  // Whiteout vignette: the world fades at the edges of the screen.
  const grad = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.22, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
  grad.addColorStop(0, 'rgba(235,242,248,0)');
  grad.addColorStop(1, `rgba(235,242,248,${a * 1.4})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
}

function drawNight(G, ctx, vw, vh) {
  const p = G.player;
  const cam = G.camera;
  const sx = p.x - cam.x;
  const sy = p.y - cam.y;
  const grad = ctx.createRadialGradient(sx, sy, 60, sx, sy, 420);
  grad.addColorStop(0, 'rgba(8,14,28,0)');
  grad.addColorStop(1, 'rgba(8,14,28,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
}

// ---- HUD ----

function drawHUD(G, ctx, vw, vh) {
  if (G.mode === 'title') return;
  const p = G.player;

  // Top-left: cash, wanted stars, car health.
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 26, 44);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfe0ee';
  ctx.fillText(districtAt(p.x, p.y), 26, 68);
  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffcf3a' : 'rgba(255,255,255,0.25)';
    ctx.font = '20px sans-serif';
    ctx.fillText('★', 26 + i * 24, 94);
  }
  if (p.inCar && p.car) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(150, 84, 96, 8);
    ctx.fillStyle = p.car.health > 30 ? '#4ac25a' : '#e03a3a';
    ctx.fillRect(150, 84, 96 * (p.car.health / 100), 8);
    ctx.fillStyle = '#cfe0ee';
    ctx.font = '11px sans-serif';
    ctx.fillText(p.car.name, 150, 78);
  }

  // Objective panel, top centre.
  const step = currentStep(G.mission);
  if (G.mission.active && step) {
    ctx.fillStyle = 'rgba(10,18,28,0.72)';
    const text = step.text;
    ctx.font = 'bold 15px sans-serif';
    const w = Math.max(320, ctx.measureText(text).width + 40);
    roundRect(ctx, vw / 2 - w / 2, 12, w, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.textAlign = 'center';
    ctx.fillText(`JOB ${G.mission.index + 1} — ${MISSIONS[G.mission.index].name}`, vw / 2, 32);
    ctx.fillStyle = '#eef4f8';
    ctx.font = '15px sans-serif';
    ctx.fillText(text, vw / 2, 52);
  }

  // Mission banner.
  if (G.mission.bannerTimer > 0) {
    ctx.fillStyle = 'rgba(10,18,28,0.8)';
    ctx.font = 'bold 26px sans-serif';
    const w = ctx.measureText(G.mission.banner).width + 60;
    roundRect(ctx, vw / 2 - w / 2, vh * 0.3, w, 56, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.textAlign = 'center';
    ctx.fillText(G.mission.banner, vw / 2, vh * 0.3 + 37);
  }

  // Bottom-left: speed + car / on-foot state.
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  roundRect(ctx, 12, vh - 64, 190, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#eef4f8';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  const speedKmh = Math.round(Math.abs(p.inCar ? p.speed : 0) * 0.55);
  ctx.fillText(p.inCar ? `${speedKmh} km/h` : 'ON FOOT', 26, vh - 30);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#9fb4c6';
  ctx.fillText(p.inCar ? 'SPACE handbrake' : 'E — enter car   F — punch', 26, vh - 16 + 0);

  // Race timer.
  if (G.race.active) {
    ctx.fillStyle = 'rgba(10,18,28,0.72)';
    roundRect(ctx, vw / 2 - 130, 76, 260, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#7ad8ff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ICE RACE  ${G.race.checkpoint}/6   ${G.race.timeLeft.toFixed(1)}s`, vw / 2, 104);
  }

  drawMinimap(G, ctx, vw, vh);

  // Controls hint, bottom centre.
  ctx.fillStyle = 'rgba(10,18,28,0.55)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD drive / walk   E enter car   F punch   SPACE handbrake   P pause   M sound', vw / 2, vh - 10);
}

function drawMinimap(G, ctx, vw, vh) {
  const mw = 210;
  const mh = 158;
  const mx = vw - mw - 12;
  const my = vh - mh - 12;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,18,28,0.78)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  // Lake + bay.
  ctx.fillStyle = '#8fb4cf';
  ctx.fillRect(mx + LAKE.x0 * sx, my + LAKE.y0 * sy, (LAKE.x1 - LAKE.x0) * sx, (LAKE.y1 - LAKE.y0) * sy);
  ctx.fillRect(mx + BAY.x0 * sx, my + BAY.y0 * sy, (BAY.x1 - BAY.x0) * sx, (BAY.y1 - BAY.y0) * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(220,228,236,0.85)';
  ctx.lineWidth = 2;
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Caches.
  ctx.fillStyle = '#50c8ff';
  for (const c of G.world.caches) {
    if (c.taken) continue;
    ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  }
  // Mission marker.
  const step = currentStep(G.mission);
  if (G.mission.active && step) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(mx + step.x * sx, my + step.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff5a5a';
  for (const car of G.police) {
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#cfe0ee';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FROSTLINE', mx, my - 10);
}

// ---- screens ----

function drawTitle(G, ctx, vw, vh) {
  ctx.fillStyle = 'rgba(8,16,28,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  // Falling snow behind the title.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const flake of G.snow) ctx.fillRect(flake.x, flake.y, flake.s, flake.s);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bfe0f5';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('A NORTHERN SMUGGLING STORY', vw / 2, vh * 0.2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('FROSTLINE', vw / 2, vh * 0.36);
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('❄  ICE ROADS  •  FIVE JOBS  •  ONE LONG NIGHT  ❄', vw / 2, vh * 0.44);
  ctx.fillStyle = '#dfeaf2';
  ctx.font = '17px sans-serif';
  const lines = [
    'You are Ash, ice-road driver for Old Maren’s crew.',
    'Drive the frozen lake, work the five jobs, outrun the patrol,',
    'and bring the crew home before the thaw.',
    '',
    'WASD / arrows — drive & walk      E — enter a car, grab a crate',
    'F — punch      SPACE — handbrake      P — pause      M — sound',
    'Steal a car or punch a local and the patrol comes running.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh * 0.54 + i * 26));
  const blink = Math.floor(G.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('— PRESS ENTER TO START —', vw / 2, vh * 0.82);
  }
  ctx.fillStyle = '#8fa8bc';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game. No network, no files leave this page. Progress saves on this machine.', vw / 2, vh * 0.9);
}

function drawPause(G, ctx, vw, vh) {
  ctx.fillStyle = 'rgba(8,16,28,0.7)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh * 0.4);
  ctx.fillStyle = '#dfeaf2';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Cash $${G.player.cash}   •   Job ${G.mission.index + 1} of 5   •   Caches ${G.cachesTaken}/12   •   Races won ${G.racesWon}`, vw / 2, vh * 0.5);
  ctx.fillText('ENTER — resume      R — restart job      M — sound', vw / 2, vh * 0.58);
}

function drawEndScreen(G, ctx, vw, vh, title, sub) {
  ctx.fillStyle = 'rgba(20,8,10,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, vw / 2, vh * 0.42);
  ctx.fillStyle = '#eef4f8';
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, vw / 2, vh * 0.52);
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('PRESS ENTER TO GET BACK OUT THERE', vw / 2, vh * 0.64);
}

// ---- helpers ----

function inView(G, x, y, pad) {
  const cam = G.camera;
  return x > cam.x - pad && x < cam.x + G.vw + pad && y > cam.y - pad && y < cam.y + G.vh + pad;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
