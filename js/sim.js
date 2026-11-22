// Engineer — Stage 1 simulation core + Stage 2 (engines: airflow,
// oxygen combustion, wind, vacuum).
// A Powder Toy-style cellular automaton on a fixed grid.
// Each cell has a material, a temperature (Celsius) and a pressure
// (sim units; ambient air = 0). Per tick:
//   1. heat conduction between neighbours + slow cooling to ambient
//   2. pressure diffusion + decay
//   3. material transitions (melt / freeze / boil / condense / ignite / shatter)
//      + fire/oxygen combustion, wind pressure, vacuum, life expiry
//   4. movement: pressure pushes loose material downwind, then powders
//      fall, liquids flow, gases rise (wind flows in the wind direction)
//
// Bare globals, classic script, like Pressure Point — no modules, no build.

// Grid size fills the stage exactly: the grid's aspect matches the
// stage's aspect (the area left after the sidebar, top bar, strip and
// bottom bar), so the canvas fills the stage with no black border.
// The long side stays ~800 cells. Measured from the real stage element
// (which already accounts for the sidebar width, safe-area insets and
// the bars); falls back to the window size if the stage isn't in the
// DOM (e.g. a test harness loading the sim standalone).
function stageSize() {
  const el = document.getElementById("stage");
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 100 && r.height > 100) return [r.width, r.height];
  }
  const sideW = window.innerWidth <= 560 ? 38 : 104;
  return [Math.max(200, window.innerWidth - sideW), Math.max(200, window.innerHeight - 92)];
}
const [STAGE_W, STAGE_H] = stageSize();
const STAGE_ASPECT = STAGE_W / STAGE_H;
let SIM_W, SIM_H;
if (STAGE_ASPECT >= 1) {
  SIM_W = 800;
  SIM_H = Math.max(200, Math.min(800, Math.round(800 / STAGE_ASPECT)));
} else {
  SIM_H = 800;
  SIM_W = Math.max(200, Math.min(800, Math.round(800 * STAGE_ASPECT)));
}
const SIM_PORTRAIT = STAGE_ASPECT < 1;
const AMBIENT_TEMP = 20;

const sim = {
  mat: new Uint8Array(SIM_W * SIM_H),      // material id per cell
  temp: new Float32Array(SIM_W * SIM_H),   // Celsius
  press: new Float32Array(SIM_W * SIM_H),  // sim pressure units
  rad: new Float32Array(SIM_W * SIM_H),    // radiation field (dose rate)
  pressPrev: new Float32Array(SIM_W * SIM_H), // pressure last tick (adiabatic)
  life: new Uint8Array(SIM_W * SIM_H),     // remaining life for fire/smoke
  moved: new Uint8Array(SIM_W * SIM_H),    // moved-this-tick flag
  tick: 0,
  running: true,
  ambient: true, // heat drifts back to ambient; the UI can turn it off
  windDir: 0, // global wind direction: 0 right, 1 down, 2 left, 3 up
  thrust: 0, // computed thrust this tick (game units; see bell nozzle)
  nozzles: [], // registered bell nozzles {chamber, throat, exit, dir, widths}
  pressActive: false, // any nonzero pressure (skip the adiabatic pass when idle)
  radActive: false, // any nonzero radiation (skip the radiation pass when idle)
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
  else if (id === 20) sim.temp[i] = 1550;                             // molten iron
  else if (id === 22) sim.temp[i] = 3450;                             // molten tungsten
  else if (id === 24) sim.temp[i] = 1080;                             // molten gold
  else if (id === 26) sim.temp[i] = 1680;                             // molten titanium
  else if (id === 28) sim.temp[i] = 970;                              // molten bronze
  else if (id === 30) sim.temp[i] = 1510;                             // molten cobalt
  else if (id === 41) sim.temp[i] = -196;                             // liquid nitrogen
  else if (id === 43) sim.temp[i] = -183;                             // liquid oxygen
  else if (id === 45) sim.temp[i] = -269;                             // liquid helium
  else if (id === 61) sim.temp[i] = -253;                             // liquid hydrogen
  else if (id === 51) { sim.temp[i] = 300; sim.life[i] = m.life; }   // exhaust
  else if (id === 52) sim.life[i] = m.life;                           // wind
  else if (id === 55 || id === 56 || id === 57) sim.life[i] = m.life; // particles
  else if (id === 59) sim.temp[i] = 340;                              // molten lead
  else if (id === 64) sim.temp[i] = 254;                              // molten polonium
  else if (id === 65) sim.temp[i] = 640;                              // molten plutonium
  else if (id === 66) sim.temp[i] = 1132;                             // molten uranium
  else if (id === 17) { sim.temp[i] = 120; sim.life[i] = m.life; }   // smoke
  else sim.temp[i] = AMBIENT_TEMP;
  sim.press[i] = 0;
  sim.pressPrev[i] = 0;
}

function sClear() {
  sim.mat.fill(0);
  sim.temp.fill(AMBIENT_TEMP);
  sim.press.fill(0);
  sim.rad.fill(0);
  sim.pressPrev.fill(0);
  sim.life.fill(0);
  sim.thrust = 0;
  sim.nozzles.length = 0;
  sim.pressActive = false;
  sim.radActive = false;
  // Rotors live in rotors.js (loaded after sim.js); the typeof guard
  // keeps sClear safe for harnesses that load sim.js alone.
  if (typeof sClearRotors === "function") sClearRotors();
  // Same for the presets library (presets.js): Clear must also stop
  // the active preset's per-tick work, or it would keep refilling
  // chambers on the cleared grid.
  if (typeof sClearPreset === "function") sClearPreset();
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
  sim.pressActive = true;
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
    sim.pressActive = true;
  } else if (sim.mat[i] !== 1) {
    sSet(x, y, 16);
    sim.press[i] += 2;
    sim.pressActive = true;
  }
}

// Spawn a particle (neutron/proton/electron) into a random adjacent air cell.
function sEmitParticle(x, y, id) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const [dx, dy] = dirs[(Math.random() * dirs.length) | 0];
  const nx = x + dx, ny = y + dy;
  if (sIn(nx, ny) && sim.mat[sIdx(nx, ny)] === 0) sSet(nx, ny, id);
}

// --- One simulation tick ---------------------------------------------------
function sStep() {
  sim.tick++;
  const W = SIM_W, H = SIM_H;
  const mat = sim.mat, temp = sim.temp, press = sim.press, life = sim.life, rad = sim.rad;

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
          const k = (MAT_COND[mat[i]] + MAT_COND[mat[j]]) * 0.5 * 0.08;
          const f = k * (tj - ti);
          temp[i] += f; temp[j] -= f;
        }
      }
      if (y + 1 < H) {
        const j = i + W;
        const tj = temp[j];
        if (!(airAmbient && mat[j] === 0 && tj > 19.9 && tj < 20.1)) {
          const k = (MAT_COND[mat[i]] + MAT_COND[mat[j]]) * 0.5 * 0.08;
          const f = k * (tj - ti);
          temp[i] += f; temp[j] -= f;
        }
      }
      // Slow drift back to ambient temperature (off when the UI
      // disables ambient heat).
      if (sim.ambient) temp[i] += (AMBIENT_TEMP - temp[i]) * 0.002;
    }
  }

  // 2. Pressure diffusion + decay.
  // Fast path: a pair of cells both at exactly zero pressure diffuses
  // nothing. Tiny pressures snap to zero in the decay step so this
  // skip keeps working once a blast has faded.
  let anyPress = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (press[i] !== 0) anyPress = true;
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
  // The adiabatic pass (2c) runs only while pressure is live anywhere;
  // pressActive is re-derived here each tick from the actual field, so
  // pressure set directly (a test, an explosion) arms it the same tick.
  sim.pressActive = anyPress;

  // 2b. Radiation diffusion + absorption.
  // The field spreads through air almost freely but dense materials
  // shield it: the exchange between two cells is divided by their
  // combined density, and dense materials absorb the field and turn it
  // into heat (that's why a lead wall gets warm and the far side stays
  // cool). Fast path: skip pairs where both cells have no radiation.
  // The whole pass is skipped when the field is dead (radActive flag).
  if (sim.radActive) {
  let anyRad = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (rad[i] !== 0) anyRad = true;
      if (x + 1 < W) {
        const j = i + 1;
        if (rad[i] !== 0 || rad[j] !== 0) {
          // Shielding is absorption, not reflection: radiation enters a
          // dense wall freely and gets eaten there, so the pair factor
          // uses the LIGHTER side (a dense source still radiates out).
          const sh = 1 / (1 + Math.min(MAT_DENSITY[mat[i]], MAT_DENSITY[mat[j]]) * 0.3);
          const f = 0.15 * sh * (rad[j] - rad[i]);
          rad[i] += f; rad[j] -= f;
        }
      }
      if (y + 1 < H) {
        const j = i + W;
        if (rad[i] !== 0 || rad[j] !== 0) {
          const sh = 1 / (1 + Math.min(MAT_DENSITY[mat[i]], MAT_DENSITY[mat[j]]) * 0.3);
          const f = 0.15 * sh * (rad[j] - rad[i]);
          rad[i] += f; rad[j] -= f;
        }
      }
      if (rad[i] > 0) {
        // Absorption: dense materials soak the field up as heat.
        const absorb = Math.min(0.5, MAT_DENSITY[mat[i]] * 0.03);
        const taken = rad[i] * absorb;
        temp[i] += taken * 2;
        rad[i] = (rad[i] - taken) * 0.995;
        if (rad[i] < 0.001) rad[i] = 0;
      }
    }
  }
  if (!anyRad) sim.radActive = false;
  }

  // 2c. Adiabatic compression/expansion: squeezing a gas heats it,
  // letting it expand cools it. T follows P^((γ-1)/γ), γ = 1.4 for air,
  // with absolute pressure = sim pressure + 10 (so ambient air = 10
  // units = 1 atm; a gunpowder blast at +30 is ~4 atm). Only gases are
  // compressible enough for this to matter. This is what makes a
  // compressor heat intake air and a nozzle bell cool exhaust.
  // Skipped when no pressure is active anywhere.
  if (sim.pressActive) {
  const pressPrev = sim.pressPrev;
  for (let i = 0; i < W * H; i++) {
    if (MAT_IS_GAS[mat[i]]) {
      const pAbs = Math.max(0.5, press[i] + 10);
      const pPrev = Math.max(0.5, pressPrev[i] + 10);
      const ratio = pAbs / pPrev;
      if (ratio > 1.01 || ratio < 0.99) {
        const tK = Math.max(1, temp[i] + 273.15) * Math.pow(ratio, 0.2857);
        temp[i] = Math.max(-273, tK - 273.15);
      }
    }
    pressPrev[i] = press[i];
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
      const id0 = mat[i]; // material before any transition this tick
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
          // Liquid oxygen next to a burning fuel is a rocket
          // propellant: it is consumed straight into exhaust and the
          // burn runs at ~3000°C (hydrogen/oxygen ~3200°C) with a much
          // bigger pressure spike. This is what makes RP-1/LOX and
          // LH2/LOX chambers work; the ordinary O2-gas burn stays
          // at 1200°C (see the fire branch below).
          let loxJ = -1;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!sIn(nx, ny)) continue;
            if (mat[sIdx(nx, ny)] === 43) { loxJ = sIdx(nx, ny); break; }
          }
          sSet(x, y, m.burnTo); life[i] = MATERIALS[m.burnTo].life || 0;
          if (loxJ >= 0) {
            sSet(loxJ % W, (loxJ / W) | 0, 51); temp[loxJ] = 300;
            temp[i] = (id0 === 61 || id0 === 62 || id0 === 40) ? 3200 : 3000;
            press[i] += 5;
          } else {
            temp[i] = 900; press[i] += 1.5;
          }
        }
      } else if (m.pressureTol !== undefined && press[i] > m.pressureTol && m.breakTo !== undefined) {
        // Brittle failure: the material shatters into debris.
        sSet(x, y, m.breakTo); temp[i] = t;
        press[i] *= 0.5;
      }
      // Radioactive materials heat themselves (and everything around
      // them, through conduction).
      if (m.selfHeat) temp[i] += m.selfHeat;
      // Radioactivity: emit into the radiation field, occasionally spit
      // out a neutron, and rarely decay into the next material down
      // the chain (emitting a neutron burst as it does).
      // Stage E: radiation emission is decoupled from selfHeat
      // (radEmission) — real uranium barely self-heats (selfHeat 0.05)
      // but is still a strong radiation source (radEmission 0.5).
      // Tying emission to selfHeat would have cut uranium's radiation
      // ~10x when its selfHeat was corrected to the real value.
      const re = m.radEmission;
      if (re) {
        rad[i] += re;
        sim.radActive = true;
        if (Math.random() < re * 0.005) sEmitParticle(x, y, 55);
        if (m.decayTo !== undefined && Math.random() < m.decayP) {
          sSet(x, y, m.decayTo); temp[i] = t;
          sEmitParticle(x, y, 55); sEmitParticle(x, y, 55);
        }
      }
      // Radiation particles heat the solid/liquid neighbours they touch.
      if (mat[i] === 55 || mat[i] === 56 || mat[i] === 57) {
        const dose = mat[i] === 55 ? 2 : 0.5;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!sIn(nx, ny)) continue;
          const j = sIdx(nx, ny);
          const cj = MATERIALS[mat[j]].cat;
          if (cj === "solid" || cj === "liquid" || cj === "powder" || cj === "static") temp[j] += dose;
        }
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
        // Oxygen-fed combustion: fire next to oxygen burns hotter and
        // pressurises the chamber — the oxygen is consumed into exhaust.
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!sIn(nx, ny)) continue;
          const j = sIdx(nx, ny);
          if (mat[j] === 44) {
            sSet(nx, ny, 51); temp[j] = 300;
            press[i] += 1.0; temp[i] = 1200;
            break;
          }
        }
        if (--life[i] <= 0 || temp[i] < 300) { sSet(x, y, 17); temp[i] = 150; }
      } else if (mat[i] === 17) {
        if (--life[i] <= 0) { sSet(x, y, 0); temp[i] = AMBIENT_TEMP; }
      } else if (mat[i] === 55) {
        // Free neutrons beta-decay: proton + electron.
        if (--life[i] <= 0) {
          sSet(x, y, 56); temp[i] = t;
          sEmitParticle(x, y, 57);
        }
      } else if (MATERIALS[mat[i]].life) {
        // Other short-lived materials (exhaust, wind): on expiry they
        // become their lifeTo material, or plain air.
        if (--life[i] <= 0) {
          const fm = MATERIALS[mat[i]];
          if (fm.lifeTo !== undefined) { sSet(x, y, fm.lifeTo); temp[i] = t; }
          else { sSet(x, y, 0); temp[i] = AMBIENT_TEMP; }
        }
      }
      // Wind pushes air ahead of it: each wind cell pressurises the
      // cell downwind, and the pressure-push in step 4 shoves loose
      // material along with it.
      if (mat[i] === 52) {
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][sim.windDir];
        const nx = x + dx, ny = y + dy;
        if (sIn(nx, ny)) {
          const j = sIdx(nx, ny);
          press[j] = Math.min(40, press[j] + 2);
        }
      }
      // Vac: eats adjacent gas and pulls the local pressure down.
      if (mat[i] === 54) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!sIn(nx, ny)) continue;
          const j = sIdx(nx, ny);
          if (mat[j] !== 0 && MATERIALS[mat[j]].cat === "gas") sSet(nx, ny, 0);
          press[j] = Math.max(-10, press[j] - 0.5);
        }
        press[i] = Math.max(-10, press[i] - 0.5);
      }
    }
  }

  // 4. Movement — bottom-up so falling things don't get processed twice.
  // Fast path: air never moves on its own — it only gets displaced when
  // something denser falls into it (handled by the swap in the falling
  // cell's move), so skip air cells outright. Same for walls and solids.
  sim.moved.fill(0);
  // Bell nozzles run here, before the normal movement: thrust is
  // computed from the fresh combustion state, and the plume flow shoves
  // bell gas toward the exit BEFORE it can rise away (gas rises in the
  // movement loop below — if the flow ran after it, the throat gas
  // would already have left the bell). Cells the flow moves are marked
  // moved, so the movement loop doesn't also rise them this tick.
  let totalThrust = 0;
  for (const n of sim.nozzles) {
    totalThrust += sNozzleThrust(n);
    sNozzleFlow(n);
  }
  sim.thrust = sim.thrust * 0.9 + totalThrust * 0.1;
  const leftFirst = (sim.tick % 2) === 0;
  for (let y = H - 1; y >= 0; y--) {
    for (let xi = 0; xi < W; xi++) {
      const x = leftFirst ? xi : (W - 1 - xi);
      const i = y * W + x;
      if (sim.moved[i]) continue;
      const id = mat[i];
      if (id === 0 || id === 1) continue;
      const m = MATERIALS[id];
      // Airflow: a strong pressure gradient shoves loose material toward
      // lower pressure — this is what makes combustion chambers vent,
      // explosions blow debris downwind, and wind push things along.
      if (m.cat === "powder" || m.cat === "liquid" || m.cat === "gas") {
        if (sPressurePush(x, y, i)) continue;
      }
      if (m.cat === "powder") sMovePowder(x, y, i);
      else if (m.cat === "liquid") sMoveLiquid(x, y, i);
      else if (m.cat === "gas") sMoveGas(x, y, i);
    }
  }
}

// --- Bell nozzles + thrust -------------------------------------------------
// A nozzle is registered with chamber/throat/exit geometry (presets do
// this; a player-built nozzle still flows gas through pressure, but has
// no thrust meter). Thrust uses real isentropic relations in SI units
// with 1 cell = 0.1 m: flow chokes at the throat (Mach 1), expands
// supersonically in the bell, and ambient pressure decides
// over/under-expansion (Pe < Pa costs thrust, Pe > Pa adds it).
// Gamma 1.2 and R 400 J/kg·K are RP-1/LOX exhaust values.
const NOZ_GAMMA = 1.2;
const NOZ_R = 400;
const NOZ_CELL = 0.1; // metres per cell
const NOZ_PA = 101325; // ambient pressure, Pa

function sRegisterNozzle(o) {
  const n = { cx: o.cx, cy: o.cy, tx: o.tx, ty: o.ty, ex: o.ex, ey: o.ey,
    dx: o.dx, dy: o.dy, throatW: o.throatW, exitW: o.exitW,
    name: o.name || "Nozzle", thrust: 0, mdot: 0, ve: 0, me: 0, pe: 0 };
  sim.nozzles.push(n);
  return n;
}

// Thrust of one registered nozzle this tick (Newtons). Returns 0 when
// the chamber isn't firing or the throat is blocked.
function sNozzleThrust(n) {
  n.thrust = 0; n.mdot = 0; n.ve = 0; n.me = 0; n.pe = 0;
  // Sample chamber pressure/temp over a small disc around the chamber
  // point (pressure is a field; temperature counts gas cells only).
  let pSum = 0, pN = 0, tSum = 0, tN = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (dx * dx + dy * dy > 4) continue;
    const x = n.cx + dx, y = n.cy + dy;
    if (!sIn(x, y)) continue;
    const i = sIdx(x, y);
    pSum += sim.press[i]; pN++;
    if (MAT_IS_GAS[sim.mat[i]]) { tSum += sim.temp[i]; tN++; }
  }
  if (!pN) return 0;
  const pcPa = Math.max(0.5, (pSum / pN + 10) / 10) * NOZ_PA; // absolute
  const tcK = Math.max(300, (tN ? tSum / tN : AMBIENT_TEMP) + 273.15);
  if (pcPa <= NOZ_PA * 1.05 || tcK < 500) return 0; // not firing
  // Throat blocked? No gas in the throat cross-section (checked over
  // a 3-cell band along the axis, since gas flows through it) = no flow.
  let throatGas = 0;
  for (let a = -1; a <= 1; a++) for (let k = 0; k < n.throatW; k++) {
    const off = k - (n.throatW - 1) / 2;
    const x = Math.round(n.tx + n.dx * a + (n.dy !== 0 ? off : 0));
    const y = Math.round(n.ty + n.dy * a + (n.dx !== 0 ? off : 0));
    if (sIn(x, y) && MAT_IS_GAS[sim.mat[sIdx(x, y)]]) throatGas++;
  }
  if (!throatGas) return 0;
  const g = NOZ_GAMMA, R = NOZ_R;
  const At = n.throatW * NOZ_CELL * NOZ_CELL;
  const Ae = n.exitW * NOZ_CELL * NOZ_CELL;
  // Choked mass flow at the throat (Mach 1).
  const choke = Math.pow(1 + (g - 1) / 2, -(g + 1) / (2 * (g - 1)));
  const mdot = pcPa * At * Math.sqrt(g / (R * tcK)) * choke;
  // Exit Mach from the area ratio (supersonic branch, bisection).
  const areaRatio = Ae / At;
  let me = 1;
  if (areaRatio > 1) {
    const areaMach = (m) => (1 / m) * Math.sqrt(Math.pow((2 / (g + 1)) * (1 + (g - 1) / 2 * m * m), (g + 1) / (g - 1)));
    let lo = 1, hi = 6;
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      if (areaMach(mid) < areaRatio) lo = mid; else hi = mid;
    }
    me = (lo + hi) / 2;
  }
  const te = tcK / (1 + (g - 1) / 2 * me * me);
  const ve = me * Math.sqrt(g * R * te);
  const pe = pcPa / Math.pow(1 + (g - 1) / 2 * me * me, g / (g - 1));
  const thrust = mdot * ve + (pe - NOZ_PA) * Ae;
  n.mdot = mdot; n.ve = ve; n.me = me; n.pe = pe;
  n.thrust = thrust;
  return thrust;
}

// Plume flow: gas cells inside the bell get shoved toward the exit,
// up to 2 cells per tick — exhaust is fast, and 1 cell/tick barely
// beats buoyancy. Moves by flowing forward (not swapping) so the
// pressure it built up ahead stays ahead.
function sNozzleFlow(n) {
  if (n.thrust <= 0) return;
  const steps = Math.max(1, Math.round(Math.hypot(n.ex - n.tx, n.ey - n.ty)));
  // Iterate exit-first so a cell pushed toward the exit lands in a
  // spot already processed this pass (no double-push).
  for (let s = steps; s >= 0; s--) {
    const ax = Math.round(n.tx + n.dx * s), ay = Math.round(n.ty + n.dy * s);
    const hw = Math.round((n.throatW + (n.exitW - n.throatW) * (s / steps)) / 2);
    for (let k = -hw; k <= hw; k++) {
      const x = ax + (n.dy !== 0 ? k : 0), y = ay + (n.dx !== 0 ? k : 0);
      if (!sIn(x, y)) continue;
      let ci = sIdx(x, y);
      if (!MAT_IS_GAS[sim.mat[ci]]) continue;
      let cx = x, cy = y;
      for (let push = 0; push < 2; push++) {
        const nx = cx + n.dx, ny = cy + n.dy;
        if (!sIn(nx, ny)) break;
        const j = sIdx(nx, ny);
        if (sim.mat[j] !== 0) break;
        sim.mat[j] = sim.mat[ci]; sim.temp[j] = sim.temp[ci]; sim.life[j] = sim.life[ci];
        sim.pressPrev[j] = sim.pressPrev[ci]; sim.moved[j] = 1;
        sim.mat[ci] = 0; sim.temp[ci] = AMBIENT_TEMP; sim.press[ci] = 0; sim.life[ci] = 0;
        sim.pressPrev[ci] = 0; sim.moved[ci] = 1;
        cx = nx; cy = ny; ci = j;
      }
    }
  }
}

function sSwap(a, b) {
  const mat = sim.mat, temp = sim.temp, press = sim.press, life = sim.life;
  let t = mat[a]; mat[a] = mat[b]; mat[b] = t;
  t = temp[a]; temp[a] = temp[b]; temp[b] = t;
  t = press[a]; press[a] = press[b]; press[b] = t;
  t = life[a]; life[a] = life[b]; life[b] = t;
  // pressPrev travels with the material too: the adiabatic term compares
  // a cell's pressure against ITS OWN last-tick pressure, so a swap
  // must not leave a stale history behind (that read as a phantom
  // pressure jump and heated/cooled cells by hundreds of degrees).
  t = sim.pressPrev[a]; sim.pressPrev[a] = sim.pressPrev[b]; sim.pressPrev[b] = t;
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

// Push a loose cell one step toward lower pressure, if the gradient is
// strong enough. Returns true if the cell moved.
function sPressurePush(x, y, i) {
  const W = SIM_W, H = SIM_H, press = sim.press;
  const gx = (x > 0 ? press[i - 1] : 0) - (x < W - 1 ? press[i + 1] : 0);
  const gy = (y > 0 ? press[i - W] : 0) - (y < H - 1 ? press[i + W] : 0);
  if (Math.abs(gx) < 1.5 && Math.abs(gy) < 1.5) return false;
  if (Math.random() >= 0.7) return false;
  const nx = x + (gx > 1.5 ? 1 : gx < -1.5 ? -1 : 0);
  const ny = y + (gy > 1.5 ? 1 : gy < -1.5 ? -1 : 0);
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) return false;
  const j = ny * W + nx;
  if (sim.mat[j] !== 0) return false; // only into empty space
  sSwap(i, j);
  return true;
}

function sMoveGas(x, y, i) {
  const W = SIM_W;
  const myD = MATERIALS[sim.mat[i]].density;
  // Radiation particles zip: up to 3 steps per tick in random
  // directions through air, so they cross a room in a second or two.
  if (sim.mat[i] === 55 || sim.mat[i] === 56 || sim.mat[i] === 57) {
    let cx = x, cy = y, ci = i;
    for (let s = 0; s < 3; s++) {
      const dx = ((Math.random() * 3) | 0) - 1, dy = ((Math.random() * 3) | 0) - 1;
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= SIM_H) break;
      const j = ny * W + nx;
      if (sim.mat[j] === 0) { sSwap(ci, j); cx = nx; cy = ny; ci = j; }
      else break;
    }
    return;
  }
  // Wind flows in the global wind direction first, then diffuses like
  // any other gas. It moves by flowing forward, not by swapping: the
  // pressure it built up in front of it stays in front of it (a swap
  // would drag that pressure back behind the wind, and nothing
  // downwind would ever get pushed).
  if (sim.mat[i] === 52) {
    const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][sim.windDir];
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < W && ny >= 0 && ny < SIM_H) {
      const j = ny * W + nx;
      if (sim.mat[j] === 0) {
        sim.mat[j] = 52; sim.temp[j] = sim.temp[i]; sim.life[j] = sim.life[i];
        sim.pressPrev[j] = sim.pressPrev[i];
        sim.moved[j] = 1;
        sim.mat[i] = 0; sim.temp[i] = AMBIENT_TEMP; sim.press[i] = 0; sim.life[i] = 0;
        sim.pressPrev[i] = 0;
        sim.moved[i] = 1;
        return;
      }
    }
  }
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
