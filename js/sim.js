// Engineer — Stage 1 simulation core.
// A Powder Toy-style cellular automaton on a fixed grid.
// Each cell has a material, a temperature (Celsius) and a pressure
// (sim units; ambient air = 0). Per tick:
//   1. heat conduction between neighbours + slow cooling to ambient
//   2. pressure diffusion + decay
//   3. material transitions (melt / freeze / boil / condense / ignite / shatter)
//   4. movement: powders fall, liquids flow, gases rise
//
// Bare globals, classic script, like Pressure Point — no modules, no build.

// Grid size adapts to the screen: landscape gets a wide 16:9 sandbox,
// portrait (a phone held upright) gets a tall 9:16 one, so the sandbox
// fills the whole screen either way. 800 cells across the long side
// (canvas backing 1600x900 / 900x1600 at CELL = 2).
const SIM_PORTRAIT = window.innerHeight > window.innerWidth;
const SIM_W = SIM_PORTRAIT ? 450 : 800;
const SIM_H = SIM_PORTRAIT ? 800 : 450;
const AMBIENT_TEMP = 20;

const sim = {
  mat: new Uint8Array(SIM_W * SIM_H),      // material id per cell
  temp: new Float32Array(SIM_W * SIM_H),   // Celsius
  press: new Float32Array(SIM_W * SIM_H),  // sim pressure units
  life: new Uint8Array(SIM_W * SIM_H),     // remaining life for fire/smoke
  moved: new Uint8Array(SIM_W * SIM_H),    // moved-this-tick flag
  tick: 0,
  running: true,
};

function sIdx(x, y) { return y * SIM_W + x; }
function sIn(x, y) { return x >= 0 && x < SIM_W && y >= 0 && y < SIM_H; }

// Place a material, giving it a sensible starting temperature.
function sSet(x, y, id) {
  if (!sIn(x, y)) return;
  const i = sIdx(x, y);
  sim.mat[i] = id;
  sim.life[i] = 0;
  const m = MATERIALS[id];
  if (id === 16) { sim.temp[i] = 900; sim.life[i] = m.life; }       // fire
  else if (id === 3) sim.temp[i] = 1500;                              // molten steel
  else if (id === 5) sim.temp[i] = 1100;                              // molten copper
  else if (id === 9) sim.temp[i] = 1600;                              // molten glass
  else if (id === 17) { sim.temp[i] = 120; sim.life[i] = m.life; }   // smoke
  else sim.temp[i] = AMBIENT_TEMP;
  sim.press[i] = 0;
}

function sClear() {
  sim.mat.fill(0);
  sim.temp.fill(AMBIENT_TEMP);
  sim.press.fill(0);
  sim.life.fill(0);
}

// --- Explosions -----------------------------------------------------------
// A blast: big pressure spike that falls off with distance, a fireball in
// the core, and a lot of heat. Pressure is what breaks brittle materials
// and shoves loose powder and gas around.
function sExplode(cx, cy, radius, power) {
  for (let y = Math.max(0, cy - radius); y <= Math.min(SIM_H - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(SIM_W - 1, cx + radius); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;
      const i = sIdx(x, y);
      const fall = 1 - d / radius;
      sim.press[i] += power * fall;
      sim.temp[i] += 600 * fall;
      if (d < radius * 0.45 && sim.mat[i] !== 1) sSet(x, y, 16);
    }
  }
}

function sIgnite(x, y) {
  if (!sIn(x, y)) return;
  const i = sIdx(x, y);
  const m = MATERIALS[sim.mat[i]];
  if (m.igniteTemp !== undefined) {
    // Heat a flammable material past its ignition point so it catches
    // through its own behaviour (gunpowder explodes, fuel burns).
    sim.temp[i] = Math.max(sim.temp[i], m.igniteTemp + 100);
    sim.press[i] += 2;
  } else if (sim.mat[i] !== 1) {
    sSet(x, y, 16);
    sim.press[i] += 2;
  }
}

// --- One simulation tick ---------------------------------------------------
function sStep() {
  sim.tick++;
  const W = SIM_W, H = SIM_H;
  const mat = sim.mat, temp = sim.temp, press = sim.press, life = sim.life;

  // 1. Heat conduction — exchange with right and down neighbours only
  // (symmetric update, so each pair is handled once).
  // Fast path: an air-air pair both sitting at ambient temperature
  // exchanges nothing worth computing, so skip it.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ti = temp[i];
      const airAmbient = mat[i] === 0 && ti > 19.9 && ti < 20.1;
      if (x + 1 < W) {
        const j = i + 1;
        const tj = temp[j];
        if (!(airAmbient && mat[j] === 0 && tj > 19.9 && tj < 20.1)) {
          const k = (MATERIALS[mat[i]].conductivity + MATERIALS[mat[j]].conductivity) * 0.5 * 0.08;
          const f = k * (tj - ti);
          temp[i] += f; temp[j] -= f;
        }
      }
      if (y + 1 < H) {
        const j = i + W;
        const tj = temp[j];
        if (!(airAmbient && mat[j] === 0 && tj > 19.9 && tj < 20.1)) {
          const k = (MATERIALS[mat[i]].conductivity + MATERIALS[mat[j]].conductivity) * 0.5 * 0.08;
          const f = k * (tj - ti);
          temp[i] += f; temp[j] -= f;
        }
      }
      // Slow drift back to ambient temperature.
      temp[i] += (AMBIENT_TEMP - temp[i]) * 0.002;
    }
  }

  // 2. Pressure diffusion + decay.
  // Fast path: a pair of cells both at exactly zero pressure diffuses
  // nothing. Tiny pressures snap to zero in the decay step so this
  // skip keeps working once a blast has faded.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x + 1 < W) {
        const j = i + 1;
        if (press[i] !== 0 || press[j] !== 0) {
          const f = 0.06 * (press[j] - press[i]);
          press[i] += f; press[j] -= f;
        }
      }
      if (y + 1 < H) {
        const j = i + W;
        if (press[i] !== 0 || press[j] !== 0) {
          const f = 0.06 * (press[j] - press[i]);
          press[i] += f; press[j] -= f;
        }
      }
      if (press[i] > -0.01 && press[i] < 0.01) press[i] = 0;
      else press[i] *= 0.99;
    }
  }

  // 3. Material transitions.
  // Fast path: air cells have no transitions at all (fire and smoke are
  // their own materials), so skip them outright.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mat[i] === 0) continue;
      const m = MATERIALS[mat[i]];
      const t = temp[i];
      if (m.meltPoint !== undefined && t > m.meltPoint && m.meltTo !== undefined) {
        sSet(x, y, m.meltTo); temp[i] = t;
      } else if (m.freezePoint !== undefined && t < m.freezePoint && m.freezeTo !== undefined) {
        sSet(x, y, m.freezeTo); temp[i] = t;
      } else if (m.boilPoint !== undefined && t > m.boilPoint && m.boilTo !== undefined) {
        sSet(x, y, m.boilTo); temp[i] = t;
      } else if (m.condensePoint !== undefined && t < m.condensePoint && m.condenseTo !== undefined) {
        sSet(x, y, m.condenseTo); temp[i] = t;
      } else if (m.igniteTemp !== undefined && t > m.igniteTemp) {
        if (m.explosive) {
          sSet(x, y, 0);
          sExplode(x, y, 9, 30);
        } else {
          sSet(x, y, m.burnTo); temp[i] = 900; life[i] = MATERIALS[m.burnTo].life || 0;
          press[i] += 1.5;
        }
      } else if (m.pressureTol !== undefined && press[i] > m.pressureTol && m.breakTo !== undefined) {
        // Brittle failure: the material shatters into debris.
        sSet(x, y, m.breakTo); temp[i] = t;
        press[i] *= 0.5;
      }
      // Fire burns out into smoke; smoke fades into air.
      if (mat[i] === 16) {
        press[i] += 0.4; // combustion pressurises the cell
        // Direct flame heating: conduction alone is too slow to spread a
        // fire (a rising flame only touches each fuel cell for a tick or
        // two), so a burning cell heats flammable neighbours hard.
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!sIn(nx, ny)) continue;
          const j = sIdx(nx, ny);
          if (MATERIALS[mat[j]].igniteTemp !== undefined) temp[j] += 200;
        }
        if (--life[i] <= 0 || temp[i] < 300) { sSet(x, y, 17); temp[i] = 150; }
      } else if (mat[i] === 17) {
        if (--life[i] <= 0) { sSet(x, y, 0); temp[i] = AMBIENT_TEMP; }
      }
    }
  }

  // 4. Movement — bottom-up so falling things don't get processed twice.
  // Fast path: air never moves on its own — it only gets displaced when
  // something denser falls into it (handled by the swap in the falling
  // cell's move), so skip air cells outright. Same for walls and solids.
  sim.moved.fill(0);
  const leftFirst = (sim.tick % 2) === 0;
  for (let y = H - 1; y >= 0; y--) {
    for (let xi = 0; xi < W; xi++) {
      const x = leftFirst ? xi : (W - 1 - xi);
      const i = y * W + x;
      if (sim.moved[i]) continue;
      const id = mat[i];
      if (id === 0 || id === 1) continue;
      const m = MATERIALS[id];
      if (m.cat === "powder") sMovePowder(x, y, i);
      else if (m.cat === "liquid") sMoveLiquid(x, y, i);
      else if (m.cat === "gas") sMoveGas(x, y, i);
    }
  }
}

function sSwap(a, b) {
  const mat = sim.mat, temp = sim.temp, press = sim.press, life = sim.life;
  let t = mat[a]; mat[a] = mat[b]; mat[b] = t;
  t = temp[a]; temp[a] = temp[b]; temp[b] = t;
  t = press[a]; press[a] = press[b]; press[b] = t;
  t = life[a]; life[a] = life[b]; life[b] = t;
  sim.moved[a] = 1; sim.moved[b] = 1;
}

// Can cell `a` displace cell `b` by falling into it? (b is fluid or gas
// with lower density, or air.)
function sCanFallInto(a, b) {
  if (b < 0 || b >= sim.mat.length) return false;
  const mb = MATERIALS[sim.mat[b]];
  if (mb.cat === "static" || mb.cat === "solid") return false;
  return MATERIALS[sim.mat[a]].density > mb.density;
}

function sMovePowder(x, y, i) {
  const W = SIM_W;
  const below = (y + 1 < SIM_H) ? i + W : -1;
  if (below >= 0 && sCanFallInto(i, below)) { sSwap(i, below); return; }
  const dir = (sim.tick + x) % 2 === 0 ? -1 : 1;
  for (const dx of [dir, -dir]) {
    const nx = x + dx, ny = y + 1;
    if (nx < 0 || nx >= W || ny >= SIM_H) continue;
    const j = ny * W + nx;
    if (sCanFallInto(i, j)) { sSwap(i, j); return; }
  }
}

function sMoveLiquid(x, y, i) {
  const W = SIM_W;
  const below = (y + 1 < SIM_H) ? i + W : -1;
  if (below >= 0 && sCanFallInto(i, below)) { sSwap(i, below); return; }
  const dir = (sim.tick + x) % 2 === 0 ? -1 : 1;
  for (const dx of [dir, -dir]) {
    const nx = x + dx;
    if (nx < 0 || nx >= W) continue;
    const j = y * W + nx;
    if (sCanFallInto(i, j)) { sSwap(i, j); return; }
  }
}

function sMoveGas(x, y, i) {
  const W = SIM_W;
  const myD = MATERIALS[sim.mat[i]].density;
  // Gases rise with random sideways wander instead of straight columns:
  // try diagonal-up, straight up, then sideways, with a random left/right
  // lean each move. Sideways, a gas also diffuses through other gases of
  // equal or lower density (that's what makes smoke billow instead of
  // stacking into lines). Rising into a denser fluid still works as
  // buoyancy; air is always displaceable.
  const dir = Math.random() < 0.5 ? -1 : 1;
  const cands = [[dir, -1], [-dir, -1], [0, -1], [dir, 0], [-dir, 0]];
  for (const [dx, dy] of cands) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= W || ny < 0 || ny >= SIM_H) continue;
    const j = ny * W + nx;
    const tm = sim.mat[j];
    if (tm === 0) {
      if (sim.mat[i] !== 0) { sSwap(i, j); return; }
    } else {
      const t = MATERIALS[tm];
      if (dy === -1 && (t.cat === "liquid" || t.cat === "powder" || t.cat === "gas")
        && t.density > myD) { sSwap(i, j); return; }
      if (dy === 0 && t.cat === "gas" && t.density <= myD && Math.random() < 0.5) {
        sSwap(i, j); return;
      }
    }
  }
}

// --- Preset scenes ---------------------------------------------------------
// A sealed steel test chamber with a fuel pool and a gunpowder pile.
// Light it and watch heat and pressure do their work: the fuel burns,
// pressure climbs, and anything brittle inside shatters.
function sPresetFurnace() {
  sClear();
  // Chamber sized relative to the grid so the preset works in both
  // landscape (200x120) and portrait (120x200) shapes.
  const x0 = Math.floor(SIM_W * 0.35), x1 = Math.floor(SIM_W * 0.65);
  const y0 = SIM_H - 35, y1 = SIM_H - 5;
  const cx = Math.floor((x0 + x1) / 2);
  for (let x = x0; x <= x1; x++) {
    sSet(x, y1, 2);            // floor: steel
    sSet(x, y0, 2);            // roof: steel
  }
  for (let y = y0; y <= y1; y++) {
    sSet(x0, y, 2);            // left wall
    sSet(x1, y, 2);            // right wall
  }
  // Ceramic lining on the inside floor (brittle — watch it under pressure).
  for (let x = x0 + 2; x <= x1 - 2; x++) sSet(x, y1 - 1, 6);
  // Fuel pool on the floor.
  for (let x = x0 + 3; x <= x1 - 3; x++) {
    sSet(x, y1 - 2, 12);
    sSet(x, y1 - 3, 12);
  }
  // A gunpowder pile in the middle.
  for (let x = cx - 4; x <= cx + 4; x++) { sSet(x, y1 - 4, 18); sSet(x, y1 - 5, 18); }
  // Light the fuel.
  sIgnite(cx, y1 - 3);
}
