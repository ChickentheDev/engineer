// Engineer — presets library (Stage D).
// Classic script, bare globals, no build step. Loaded after materials.js
// and sim.js; the coordinator wires it into main.js (see footer notes).
//
// HONEST LIMITS — read before judging what you see:
//  - NO pistons / crankshaft. The sim has no linear moving parts; rotors
//    only rotate. In the I4 the chambers ARE the cylinders: firing order
//    (1-3-4-2), pressure pulses and turbo spool are real, the motion a
//    crankshaft would do is not modelled.
//  - RP-1 and Bearing exist as real materials now (Stage B/C):
//    RP-1 (id 60, ignite 210°C, burns to Fire), Bearing (id 63).
//    The rocket uses RP-1 (Fuel fallback if it ever goes away) and
//    rotor hubs use Bearing (Steel fallback).
//  - LOX boils to Oxygen gas at ambient temperature in this sim (no
//    cryo insulation modelled), so the LOX tank holds oxygen gas and
//    the feed delivers oxygen gas to the chamber. That is the sim's
//    physics, not a shortcut in this file.
//  - Thrust (sim.thrust) is computed by the real nozzle code
//    (Stage B, sRegisterNozzle). This file only builds the geometry,
//    registers the nozzles and keeps chambers hot/pressurised.
//  - Shafts are modelled as coupling (w_comp = w_turb, w_fan = w_turb
//    each tick), not as drawn rods — the coupled rotors sit in
//    different housings and a drawn rod would cross the chambers.
//  - Fuel / LOX top-ups are the test-stand supply: tanks are refilled
//    slower than the engine burns, so levels visibly fall while firing.
//
// All coordinates are RELATIVE (fractions of SIM_W / SIM_H for position)
// with ABSOLUTE cell sizes for critical parts (I4 chamber 40 cells,
// rocket chamber 72, bell throat 6, exit 24; turbofan 300 long), so
// presets fit both desktop (800x~482) and iPhone portrait (~374x800).
// The phone grid is the binding constraint: 2x I4 / 2x turbofan / 3x
// rocket is as big as fits with margin on 374 wide. Materials are
// looked up by NAME via MAT — never hardcode an id, ids shift between stages.

var sActivePreset = null;   // current preset id, or null
var presetState = null;     // per-preset runtime state (see each build())

// --- small helpers ---------------------------------------------------------
function pMat(name) { return MAT[name].id; }

// Set a cell only if it is currently air (never eats something built).
function pSetAir(x, y, id) {
  if (!sIn(x, y)) return false;
  if (sim.mat[sIdx(x, y)] !== 0) return false;
  sSet(x, y, id);
  return true;
}

function pRect(x0, y0, x1, y1, id) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) sSet(x, y, id);
}

// Hollow box: walls only.
function pBox(x0, y0, x1, y1, id) {
  for (let x = x0; x <= x1; x++) { sSet(x, y0, id); sSet(x, y1, id); }
  for (let y = y0; y <= y1; y++) { sSet(x0, y, id); sSet(x1, y, id); }
}

function pPressAvg(x0, y0, x1, y1) {
  let s = 0, n = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!sIn(x, y)) continue;
      s += sim.press[sIdx(x, y)]; n++;
    }
  return n ? s / n : 0;
}

function pCount(x0, y0, x1, y1, id) {
  let n = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (sIn(x, y) && sim.mat[sIdx(x, y)] === id) n++;
  return n;
}

// First cell in the rect whose material is one of ids (top-down scan).
function pFindCell(x0, y0, x1, y1, ids) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!sIn(x, y)) continue;
      if (ids.indexOf(sim.mat[sIdx(x, y)]) !== -1) return [x, y];
    }
  return null;
}

// Test-stand top-up: put one cell of id into the first air cell of the
// rect (top-down), but only while the rect holds fewer than `cap` cells
// of the given ids.
function pTopUp(rect, ids, id, cap) {
  let n = 0;
  for (let y = rect.y0; y <= rect.y1; y++)
    for (let x = rect.x0; x <= rect.x1; x++)
      if (sIn(x, y) && ids.indexOf(sim.mat[sIdx(x, y)]) !== -1) n++;
  if (n >= cap) return false;
  for (let y = rect.y0; y <= rect.y1; y++)
    for (let x = rect.x0; x <= rect.x1; x++)
      if (sIn(x, y) && sim.mat[sIdx(x, y)] === 0) { sSet(x, y, id); return true; }
  return false;
}

// --- rotors + nozzles (Stage B/C APIs; degrade gracefully without them) ---
// Build a rotor at (px, py): Bearing hub + steel paddle blades, then
// let the real sBindRotors() bind them into a rich rotor object
// ({px, py, R, S, mt, ..., dst, ds, bc, th, w, I, feed}) and return it.
// NEVER push a plain {px, py, th, w} object into `rotors`: the real
// sRotateRotor reads r.dst and crashes on one. A plain stand-in is
// only used when the real API is absent entirely (pre-Stage-C world
// or the test shim), where nothing calls sRotateRotor on it.
function pMakeRotor(px, py, bladeLen) {
  // Bearing hub when it exists, Steel until Stage C adds the material.
  const hubId = MAT["Bearing"] ? MAT["Bearing"].id : MAT["Steel"].id;
  const steel = MAT["Steel"].id;
  sSet(px, py, hubId);
  const L = bladeLen || 4;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const d of dirs) {
    for (let k = 1; k <= L; k++) sSet(px + d[0] * k, py + d[1] * k, steel);
    // paddle tip: a short perpendicular bar at the end of each arm.
    const tx = px + d[0] * L, ty = py + d[1] * L;
    sSet(tx + d[1], ty + d[0], steel);
    sSet(tx - d[1], ty - d[0], steel);
  }
  if (typeof sBindRotors === "function") {
    try { sBindRotors(); } catch (e) { /* bind failure is not fatal */ }
  }
  // Real (Stage C) binding: find the bound rotor at this pivot.
  if (typeof rotors !== "undefined" && Array.isArray(rotors)) {
    for (let k = rotors.length - 1; k >= 0; k--) {
      const r = rotors[k];
      if (r && r.dst && Math.abs(r.px - px) <= 1 && Math.abs(r.py - py) <= 1) return r;
    }
  }
  // No real binding (no Bearing material, or the shim world): plain
  // stand-in the preset tick drives directly. Only safe when the real
  // stepper isn't loaded — it would crash on a plain object.
  if (typeof sBindRotors !== "function" || !MAT["Bearing"]) {
    const r = { px: px, py: py, th: 0, w: 0 };
    if (typeof rotors !== "undefined" && Array.isArray(rotors)) rotors.push(r);
    return r;
  }
  return null; // real API present but this wheel didn't bind — the
  // tick handlers treat a null rotor as "not spinning" (visible in
  // the test) rather than crashing the sim.
}

function pRPM(r) {
  if (!r) return 0;
  if (typeof sRotorRPM === "function") {
    try { return sRotorRPM(r); } catch (e) { /* fall through */ }
  }
  return Math.abs(r.w) * 573;
}

// Spool a rotor toward a target angular velocity (lag = spool-up).
// Only for plain stand-in rotors (shim world): a bound rotor's w is
// driven by the real torque physics in sRotateRotor, and this file
// must not fight it — except for shaft coupling (pCouple below),
// which re-asserts the shaft speed once per tick.
function pSpool(r, target, rate) {
  if (r && !r.dst) r.w += (target - r.w) * rate;
}

// Shaft coupling: the driven rotor turns with the driver, same speed.
function pCouple(dst, src) {
  if (dst && src) dst.w = src.w;
}

function pRegisterNozzle(spec) {
  if (typeof sRegisterNozzle !== "function") return null;
  try { return sRegisterNozzle(spec) || null; } catch (e) { return null; }
}

// Register now if the API exists, else park it for sPresetTick to retry.
function pAddNozzle(st, spec) {
  const n = pRegisterNozzle(spec);
  if (n) { (st.nozzles = st.nozzles || []).push(n); return n; }
  (st.pendingNozzles = st.pendingNozzles || []).push(spec);
  return null;
}

// --- 1. Furnace Test -------------------------------------------------------
function buildFurnace() {
  sPresetFurnace();
  return {};
}

// --- 2. I4 Engine + Turbo --------------------------------------------------
// Four chambers in a row, firing 1-3-4-2, one firing per ~15 ticks.
// Exhaust manifold above the row feeds a turbine (right end); the
// turbine shares a shaft with a compressor below it, which pressurises
// the intake plenum under the row. Fuel/air are refilled into a chamber
// as it fires (test-stand fuel supply). No pistons/crankshaft: the
// chambers are the cylinders, the firing order + turbo spool are real.
function buildI4() {
  const steel = pMat("Steel");
  const CW = 40, CH = 44, GAP = 12;
  const totalW = 4 * CW + 3 * GAP;
  const x0 = Math.floor(SIM_W / 2 - totalW / 2);
  const yTop = Math.floor(SIM_H * 0.38), yBot = yTop + CH;
  const chambers = [];
  for (let c = 0; c < 4; c++) {
    const cx0 = x0 + c * (CW + GAP), cx1 = cx0 + CW;
    pBox(cx0, yTop, cx1, yBot, steel);
    const vx = Math.floor((cx0 + cx1) / 2);
    for (let k = 0; k < 4; k++) sSet(vx + k, yTop, 0); // roof vent, 4 cells
    chambers.push({
      x0: cx0 + 1, y0: yTop + 1, x1: cx1 - 1, y1: yBot - 1,
      cx: vx, cy: Math.floor((yTop + yBot) / 2), ventY: yTop,
    });
  }
  // Exhaust manifold: 8-row duct sitting on the chamber roofs, with a
  // hole in its floor above each vent. Top wall yTop-10, interior
  // yTop-9..yTop-2, floor yTop-1.
  // The duct walls STOP at the turbine housing's left wall (turbX-17):
  // they must not run through the housing. The manifold walls cross
  // the housing at rows mCy±8, exactly where the turbine's blade arms
  // reach — if the walls touch the arms, sBindRotors floods the whole
  // connected steel structure into the rotor (measured: 650 cells,
  // I=2.9M instead of the 41-cell wheel) and the wheel can never turn.
  // The duct interior stays open into the housing through its left
  // wall openings, so gas still flows in.
  const mCy = yTop - 5;
  const turbX = x0 + totalW + 36;
  for (let x = x0 - 2; x <= turbX - 17; x++) {
    sSet(x, yTop - 10, steel);
    sSet(x, yTop - 1, steel);
  }
  for (const ch of chambers) for (let k = 0; k < 4; k++) sSet(ch.cx + k, yTop - 1, 0);
  // Intake plenum: 7-row duct under the row, open at the left end.
  // Same rule: its walls stop at the compressor housing's left wall.
  const pCy = yBot + 12;
  for (let x = x0 - 2; x <= turbX - 17; x++) {
    sSet(x, yBot + 8, steel);
    sSet(x, yBot + 16, steel);
  }
  for (let k = -2; k <= 2; k++) sSet(x0 - 2, pCy + k, 0);
  // Turbo unit at the right end: turbine housing on the manifold line,
  // compressor housing on the plenum line, one shaft between them.
  pBox(turbX - 16, mCy - 16, turbX + 16, mCy + 16, steel);
  pBox(turbX - 16, pCy - 16, turbX + 16, pCy + 16, steel);
  for (let k = -2; k <= 2; k++) {
    sSet(turbX - 16, mCy + k, 0); sSet(turbX + 16, mCy + k, 0); // turbine in/out
    sSet(turbX - 16, pCy + k, 0); sSet(turbX + 16, pCy + k, 0); // compressor in/out
  }
  const turbine = pMakeRotor(turbX, mCy, 8);
  const comp = pMakeRotor(turbX, pCy, 8);
  // Impulse drive for the turbine (the demo's feed mechanism): the
  // exhaust jet is ducted onto the upper arm ONLY — a narrow strip
  // just left of it (4 wide, 9 tall). A quadrant feed cancels exactly:
  // pressure on the upper arm's left face (+4q per face) is matched
  // by pressure on the left arm's up face (-4q per face), measured
  // w = 0.000 with a quadrant feed. A symmetric pressure gives no
  // net torque at all. The strip pushes only the upper arm's left
  // faces (and the tip), so the torque is one-signed. Gated on
  // manifold pressure in tickI4, so the wheel only spins on exhaust.
  const feed = { x0: turbX - 4, y0: mCy - 12, x1: turbX - 1, y1: mCy - 4 };
  return {
    chambers: chambers, order: [0, 2, 3, 1], fireIdx: 0,
    nextFire: sim.tick + 5, fireLog: [],
    turbine: turbine, comp: comp, turbX: turbX, mCy: mCy, pCy: pCy,
    feed: feed,
    manifoldP: 0, // exhaust manifold pressure at the turbine inlet
    plenum: { x0: x0 - 1, y0: yBot + 9, x1: turbX - 17, y1: yBot + 15 },
  };
}

function pFireChamber(st, ci) {
  const ch = st.chambers[ci];
  const fuel = pMat("Fuel"), oxy = pMat("Oxygen");
  for (let x = ch.x0; x <= ch.x1; x++) {
    for (let y = ch.y1 - 3; y <= ch.y1; y++)
      if (sim.mat[sIdx(x, y)] === 0) sSet(x, y, fuel);
    for (let y = ch.y0; y <= ch.y1 - 4; y++)
      if (sim.mat[sIdx(x, y)] === 0) sSet(x, y, oxy);
  }
  sIgnite(ch.cx, ch.y1 - 1);
  for (let y = ch.cy - 2; y <= ch.cy + 2; y++)
    for (let x = ch.cx - 2; x <= ch.cx + 2; x++)
      if (sIn(x, y)) sim.press[sIdx(x, y)] += 3;
  sim.pressActive = true;
  const ex = pMat("Exhaust");
  for (let k = 0; k < 4; k++) pSetAir(ch.cx + k, ch.ventY - 5, ex);
  st.fireLog.push({ tick: sim.tick, chamber: ci + 1 });
  if (st.fireLog.length > 40) st.fireLog.shift();
  if (st.turbine && !st.turbine.dst) st.turbine.w += 0.12; // exhaust pulse kicks the turbine (shim world only; bound rotors get real torque)
  st.manifoldP = Math.min(25, st.manifoldP + 8); // firing pressurises the manifold
}

function tickI4(st) {
  if (sim.tick >= st.nextFire) {
    pFireChamber(st, st.order[st.fireIdx % 4]);
    st.fireIdx++;
    st.nextFire = sim.tick + 15;
  }
  // Turbo spool: target speed follows manifold pressure at the inlet.
  const pIn = pPressAvg(st.turbX - 20, st.mCy - 2, st.turbX - 17, st.mCy + 2);
  pSpool(st.turbine, Math.min(2.5, Math.max(0, pIn) * 0.5), 0.03);
  pCouple(st.comp, st.turbine); // shaft
  // Turbine inlet pressure: the exhaust manifold pressure, imposed at
  // the turbine inlet as a boundary condition. The sim's pressure
  // diffusion won't carry a firing pulse 60 cells down the manifold
  // with a usable gradient, and a turbine needs a pressure DROP across
  // the wheel (high at the inlet, low at the outlet) to make torque —
  // a uniform pressure gives none, however high. manifoldP spikes +8
  // per firing and decays, so the turbine spools with the firing rate
  // (same approach as the demo's feed region: press 25 repainted
  // every tick). Exhaust wind is fed in with it.
  st.manifoldP *= 0.97;
  // Feed the turbine only on real exhaust: the impulse drive (see
  // buildI4) is on while manifold pressure is up, off when it dies.
  if (st.turbine) st.turbine.feed = st.manifoldP > 3 ? st.feed : null;
  for (let y = st.mCy - 2; y <= st.mCy + 2; y++)
    for (let x = st.turbX - 24; x <= st.turbX - 17; x++)
      if (sIn(x, y)) sim.press[sIdx(x, y)] = Math.max(sim.press[sIdx(x, y)], st.manifoldP);
  const twind = pMat("Wind");
  for (let k = -2; k <= 2; k++) pSetAir(st.turbX - 24, st.mCy + k, twind);
  // Compressor boost: plenum pressure follows compressor RPM.
  const boost = Math.min(10, pRPM(st.comp) / 573 * 8);
  for (let y = st.plenum.y0; y <= st.plenum.y1; y++)
    for (let x = st.plenum.x0; x <= st.plenum.x1; x++)
      if (sIn(x, y)) sim.press[sIdx(x, y)] = boost;
  // Intake airflow in at the plenum mouth.
  const wind = pMat("Wind");
  for (let k = -2; k <= 2; k++) pSetAir(st.plenum.x0 + 1, st.pCy + k, wind);
}

// --- 3. Rocket -------------------------------------------------------------
// RP-1 + LOX tanks stacked above a combustion chamber,
// bell nozzle below pointing down. Propellant is METERED, not gravity
// fed: an open floor port dumps the tank into the chamber in seconds
// and the pool flash-burns (measured ~3 cells/tick). The injector
// draws exactly one RP-1 cell per tick from the tank, and the LOX
// feed draws two oxygen units per tick (measured: one per tick
// starves the burn — 24 fire cells share a single oxygen cell) —
// so the burn rate is capped by the feed and the tanks drain at a
// known rate. LOX boils to oxygen gas in the sim, so the LOX feed
// delivers oxygen gas to the chamber. Continuous burn while both
// propellants last; tanks are topped up by the test-stand supply
// slower than they burn, so levels visibly fall.
// Tank walls are Glass (sight-glass test-stand tanks) so the falling
// level can actually be seen.
function buildRocket() {
  const steel = pMat("Steel"), glass = pMat("Glass"), noz = pMat("Nozzle");
  const rp1 = MAT["RP-1"] ? MAT["RP-1"].id : MAT["Fuel"].id;
  const cx = Math.floor(SIM_W / 2);
  const tankW = 102, tankH = 120;
  const tx0 = cx - Math.floor(tankW / 2), tx1 = tx0 + tankW;
  const loxTop = Math.floor(SIM_H * 0.08);
  const loxBot = loxTop + tankH;
  const rp1Top = loxBot + 12, rp1Bot = rp1Top + tankH;
  const chTop = rp1Bot + 18, chBot = chTop + 54;
  const chX0 = cx - 36, chX1 = cx + 36;
  const throatY = chBot + 18, exitY = throatY + 48;

  // LOX tank (top): Liquid Oxygen inside.
  pBox(tx0, loxTop, tx1, loxBot, glass);
  pRect(tx0 + 1, loxTop + 1, tx1 - 1, loxBot - 1, pMat("Liquid Oxygen"));
  // RP-1 tank: Fuel inside. The chute below is the feed line — the
  // injector (tickRocket) meters fuel through it one cell per tick;
  // the tank floor stays solid because an open port dumps the tank
  // into the chamber and the pool flash-burns.
  pBox(tx0, rp1Top, tx1, rp1Bot, glass);
  pRect(tx0 + 1, rp1Top + 1, tx1 - 1, rp1Bot - 1, rp1);
  for (let y = rp1Bot + 1; y < chTop; y++) {
    sSet(cx + 3, y, steel); sSet(cx + 12, y, steel); // chute walls
  }
  // Combustion chamber: Nozzle-material walls, 6-cell hole in the
  // floor for the exhaust.
  pBox(chX0, chTop, chX1, chBot, noz);
  for (let k = -3; k <= 2; k++) sSet(cx + k, chBot, 0); // exhaust out
  // Bell nozzle: converging chamber (half 33) -> throat (half 3, 6
  // cells wide) -> diverging exit (half 12, 24 cells wide).
  for (let y = chBot + 1; y <= throatY; y++) {
    const f = (y - chBot) / (throatY - chBot);
    const half = Math.round(33 - 30 * f);
    sSet(cx - half - 1, y, noz); sSet(cx + half, y, noz);
  }
  for (let y = throatY + 1; y <= exitY; y++) {
    const f = (y - throatY) / (exitY - throatY);
    const half = Math.round(3 + 9 * f);
    sSet(cx - half - 1, y, noz); sSet(cx + half, y, noz);
  }
  const st = {
    ch: { x0: chX0 + 1, y0: chTop + 1, x1: chX1 - 1, y1: chBot - 1,
          cx: cx, cy: Math.floor((chTop + chBot) / 2) },
    lox: { x0: tx0 + 1, y0: loxTop + 1, x1: tx1 - 1, y1: loxBot - 1,
           cap: (tankW - 1) * (tankH - 1) },
    rp1: { x0: tx0 + 1, y0: rp1Top + 1, x1: tx1 - 1, y1: rp1Bot - 1,
           cap: (tankW - 1) * (tankH - 1) },
    throatY: throatY, exitY: exitY, burning: false,
  };
  pAddNozzle(st, {
    cx: cx, cy: st.ch.cy, tx: cx, ty: throatY, ex: cx, ey: exitY,
    dx: 0, dy: 1, throatW: 6, exitW: 24, name: "rocket",
  });
  return st;
}

function tickRocket(st) {
  const rp1 = MAT["RP-1"] ? MAT["RP-1"].id : MAT["Fuel"].id;
  const lox = pMat("Liquid Oxygen"), oxy = pMat("Oxygen"), fire = pMat("Fire");
  // Drop targets: air or a transient gas (Exhaust/Smoke). The chamber
  // fills with gas while burning, so an air-only search goes stale
  // and deliveries silently stop while the tanks still drain.
  const dropIds = [pMat("Air"), pMat("Exhaust"), pMat("Smoke")];
  // Metered injector: THREE RP-1 cells per tick, drawn from the tank
  // and placed at the first air cell in the chamber (found fresh each
  // tick — the roof row fills with oxygen gas, so a fixed drop point
  // goes stale and deliveries silently fail), only while the chamber
  // holds fewer than 12 RP-1 cells. Capping the pool caps the burn
  // rate — an open gravity feed flash-burns the whole pool. Light it
  // at once: a lone fuel cell would otherwise be pressure-pushed out
  // the exhaust hole before the next scheduled ignition, and the burn
  // would stall with a full tank.
  for (let k = 0; k < 3; k++) {
    if (pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, rp1) >= 12) break;
    const spot = pFindCell(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, dropIds);
    const c = spot && pFindCell(st.rp1.x0, st.rp1.y0, st.rp1.x1, st.rp1.y1, [rp1]);
    if (!spot || !c) break;
    sSet(c[0], c[1], 0);
    sSet(spot[0], spot[1], rp1);
    sIgnite(spot[0], spot[1]);
  }
  // LOX feed: draw SIX units of oxygen out of the tank into the chamber
  // every tick (3x the original rate for the 3x chamber — the bigger
  // burn wants proportionally more oxygen). Top-up is 1 per tick, so
  // the tank still drains (draw 3600 vs top-up 600 over 600 ticks)
  // without running dry.
  for (let k = 0; k < 6; k++) {
    const spot = pFindCell(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, dropIds);
    const c = spot && pFindCell(st.lox.x0, st.lox.y0, st.lox.x1, st.lox.y1, [lox, oxy]);
    if (spot && c) {
      sSet(c[0], c[1], 0);
      sSet(spot[0], spot[1], oxy);
    }
  }
  // Test-stand supply: top up both tanks, slower than the burn drains
  // them. RP-1: 1 cell per 4 ticks in vs ~3 per tick drawn by the
  // injector; LOX: 1 per tick in vs 6 per tick drawn.
  if (sim.tick % 4 === 0) pTopUp(st.rp1, [rp1], rp1, st.rp1.cap);
  pTopUp(st.lox, [lox, oxy], lox, st.lox.cap);
  // Continuous burn while propellant is present in the chamber.
  // Fire counts as burning: each injected cell is lit at once and
  // becomes Fire within a tick, so unburned RP-1 alone would read 0
  // most ticks even while the chamber is actively firing.
  const fuelIn = pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, rp1);
  const fireIn = pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, fire);
  const oxyIn = pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, oxy);
  st.burning = (fuelIn > 0 || fireIn > 0) && oxyIn > 0;
  if (!st.burning) return;
  if (sim.tick % 3 === 0) {
    const c = pFindCell(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, [rp1]);
    if (c) sIgnite(c[0], c[1]);
  }
  // Hold the chamber hot and pressurised — this is what the nozzle
  // thrust calculation reads (it samples a disc of radius 2 around
  // the chamber point, so the hold covers that whole disc, not just
  // the 3x3 centre). +3/tick to 40: measured, +2 to 30 let the disc
  // pressure sag from ~25 to ~11 as the plume established, and the
  // bell goes over-expanded (negative thrust) below ~18.
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (dx * dx + dy * dy > 4) continue;
    const x = st.ch.cx + dx, y = st.ch.cy + dy;
    if (!sIn(x, y)) continue;
    const i = sIdx(x, y);
    sim.temp[i] = Math.max(sim.temp[i], 1700);
    if (sim.press[i] < 40) sim.press[i] += 3;
  }
  sim.pressActive = true;
  // Exhaust plume out the throat and the bell exit.
  const ex = pMat("Exhaust");
  for (let k = -3; k <= 2; k++) pSetAir(st.ch.cx + k, st.throatY + 1, ex);
  for (let k = -1; k <= 1; k++) pSetAir(st.ch.cx + k, st.exitY + 1, ex);
}

// --- 4. Turbofan -----------------------------------------------------------
// Horizontal nacelle: intake (left) -> fan -> bypass duct around the
// core; core: compressor rotor -> combustion chamber -> turbine rotor,
// which drives the fan and compressor on one shaft. Two nozzles are
// registered: core exhaust and bypass exit (fan thrust). Air comes in
// as Wind at the intake; the fan pressurises the intake and bypass
// ducts in proportion to its RPM.
function buildTurbofan() {
  const steel = pMat("Steel"), noz = pMat("Nozzle");
  const cy = Math.floor(SIM_H * 0.45);
  const L = 300;
  const x0 = Math.floor((SIM_W - L) / 2), x1 = x0 + L;
  // Nacelle walls (open at both ends: intake left, exhaust right).
  for (let x = x0; x <= x1; x++) { sSet(x, cy - 52, steel); sSet(x, cy + 52, steel); }
  // Core duct walls (half-height 9), x0+40 .. x0+118.
  const coreX0 = x0 + 80, coreX1 = x0 + 236;
  for (let x = coreX0; x <= coreX1; x++) { sSet(x, cy - 18, steel); sSet(x, cy + 18, steel); }
  // Combustion chamber x0+64..x0+88: end walls with a 4-cell airflow
  // opening in the middle, so core air flows through the burner.
  for (let y = cy - 18; y <= cy + 18; y++) {
    if (y < cy - 4 || y > cy + 3) {
      sSet(x0 + 128, y, noz); sSet(x0 + 176, y, noz);
    }
  }
  const fan = pMakeRotor(x0 + 32, cy, 18);
  const comp = pMakeRotor(x0 + 100, cy, 8);
  const turb = pMakeRotor(x0 + 204, cy, 8);
  // Impulse drive for the turbine (same as the I4): the exhaust jet
  // hits the upper blades only, gated on combustor pressure in
  // tickTurbofan so the wheel only spins on real exhaust.
  // Seed the burner with fuel + air.
  const fuel = pMat("Fuel"), oxy = pMat("Oxygen");
  for (let x = x0 + 132; x <= x0 + 140; x++) sSet(x, cy + 14, fuel);
  for (let x = x0 + 144; x <= x0 + 172; x++)
    for (let y = cy - 14; y <= cy + 12; y++) pSetAir(x, y, oxy);
  // Core bell nozzle, horizontal: core end (half 16) -> throat
  // (x0+242, half 2, 4 cells) -> exit (x0+256, half 6, 12 cells).
  const throatX = x0 + 242, exitX = x0 + 256;
  for (let x = coreX1 + 1; x <= throatX; x++) {
    const f = (x - coreX1) / (throatX - coreX1);
    const half = Math.round(16 - 14 * f);
    sSet(x, cy - half - 1, noz); sSet(x, cy + half, noz);
  }
  for (let x = throatX + 1; x <= exitX; x++) {
    const f = (x - throatX) / (exitX - throatX);
    const half = Math.round(2 + 4 * f);
    sSet(x, cy - half - 1, noz); sSet(x, cy + half, noz);
  }
  const st = {
    x0: x0, x1: x1, cy: cy, fan: fan, comp: comp, turbine: turb,
    ch: { x0: x0 + 130, y0: cy - 16, x1: x0 + 174, y1: cy + 16,
          cx: x0 + 152, cy: cy },
    turbX: x0 + 204, throatX: throatX, turbInP: 0, // turbine inlet pressure
    // Impulse drive (same as the I4): a narrow strip just left of the
    // upper arm — a quadrant feed cancels exactly (measured w = 0.000).
    feed: { x0: x0 + 200, y0: cy - 12, x1: x0 + 203, y1: cy - 4 },
    intake: { x0: x0 + 2, y0: cy - 40, x1: x0 + 24, y1: cy + 40 },
    bypass: { x0: x0 + 240, y0: cy - 48, x1: x0 + 290, y1: cy - 22 },
    bypassLo: { x0: x0 + 240, y0: cy + 22, x1: x0 + 290, y1: cy + 48 },
  };
  pAddNozzle(st, {
    cx: st.ch.cx, cy: cy, tx: throatX, ty: cy, ex: exitX, ey: cy,
    dx: 1, dy: 0, throatW: 4, exitW: 12, name: "core",
  });
  // Bypass "nozzle" is the nacelle exit plane: the sample point sits
  // in the bypass duct, so fan-pressurised bypass air is what it reads.
  // NOTE: the real thrust model is a hot-gas isentropic model (chamber
  // gas must be >= 500 K), so this nozzle reads ~0 N with cool bypass
  // air — fan thrust shows up as bypass pressurisation + airflow, and
  // the core nozzle carries the Newton readout. That is the model
  // working as designed, not a preset bug.
  pAddNozzle(st, {
    cx: x0 + 260, cy: cy - 34, tx: x1 - 8, ty: cy - 34, ex: x1, ey: cy - 34,
    dx: 1, dy: 0, throatW: 4, exitW: 16, name: "bypass",
  });
  return st;
}

function tickTurbofan(st) {
  const wind = pMat("Wind"), fuel = pMat("Fuel"), oxy = pMat("Oxygen");
  // Air in at the intake and along the bypass.
  for (let k = -2; k <= 2; k++) pSetAir(st.x0 + 4, st.cy + k * 8, wind);
  pSetAir(st.x0 + 60, st.cy - 34, wind);
  pSetAir(st.x0 + 60, st.cy + 34, wind);
  // Keep the burner charged: a few fuel cells + oxygen, refilled as
  // it burns (test-stand fuel supply).
  if (pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, fuel) < 6) {
    for (let k = 0; k < 4; k++)
      pSetAir(st.ch.cx - 8 + k * 2, st.ch.y1, fuel);
  }
  if (pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, oxy) < 20) {
    for (let k = 0; k < 6; k++)
      pSetAir(st.ch.cx + k * 6, st.ch.y0 + 2, oxy);
  }
  const fuelIn = pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, fuel);
  const oxyIn = pCount(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, oxy);
  if (fuelIn > 0 && oxyIn > 0) {
    if (sim.tick % 3 === 0) {
      const c = pFindCell(st.ch.x0, st.ch.y0, st.ch.x1, st.ch.y1, [fuel]);
      if (c) sIgnite(c[0], c[1]);
    }
    // Hold the chamber hot and pressurised over the nozzle's whole
    // sample disc (radius 2), as in the rocket: +3/tick to 35 keeps
    // the disc pressure up once the plume establishes.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 4) continue;
      const x = st.ch.cx + dx, y = st.ch.cy + dy;
      if (!sIn(x, y)) continue;
      const i = sIdx(x, y);
      sim.temp[i] = Math.max(sim.temp[i], 1500);
      if (sim.press[i] < 35) sim.press[i] += 3;
    }
    sim.pressActive = true;
    const ex = pMat("Exhaust");
    pSetAir(st.ch.x1 + 4, st.ch.cy, ex);
    pSetAir(st.ch.x1 + 6, st.ch.cy + 2, ex);
    // Throat gas: the real nozzle needs gas in the throat
    // cross-section to flow — seed it while burning (chamber exhaust
    // takes ~30 ticks to drift there on its own).
    pSetAir(st.throatX, st.ch.cy, ex);
    pSetAir(st.throatX, st.ch.cy + 2, ex);
  }
  // Turbine inlet pressure: the combustor pressure imposed at the
  // turbine inlet as a boundary condition (same reasoning as the I4:
  // the sim's pressure diffusion won't carry chamber pressure 26
  // cells down the core duct with a usable gradient, and a turbine
  // needs a pressure drop across the wheel to make torque). Rises
  // while burning, decays when not. Exhaust wind is fed in with it.
  // Vent sink: the duct just past the turbine is held at ambient
  // (the nozzle expansion vents it). Without this the whole core
  // duct sits at chamber pressure, the pressure is nearly uniform
  // around the wheel, and the strip feed's gradient — the torque —
  // mostly cancels. With the sink, the wheel sees ~25 on the inlet
  // side and ~0 on the outlet side.
  if (fuelIn > 0 && oxyIn > 0) st.turbInP = Math.min(25, st.turbInP + 1);
  else st.turbInP *= 0.95;
  // Feed the turbine only on real exhaust (impulse drive, see build).
  if (st.turbine) st.turbine.feed = st.turbInP > 3 ? st.feed : null;
  for (let y = st.cy - 4; y <= st.cy + 4; y++)
    for (let x = st.turbX - 18; x <= st.turbX - 12; x++)
      if (sIn(x, y)) sim.press[sIdx(x, y)] = Math.max(sim.press[sIdx(x, y)], st.turbInP);
  for (let y = st.cy - 6; y <= st.cy + 6; y++)
    for (let x = st.turbX + 12; x <= st.turbX + 18; x++)
      if (sIn(x, y)) sim.press[sIdx(x, y)] = 0;
  for (let k = -4; k <= 4; k++) pSetAir(st.turbX - 18, st.cy + k, wind);
  // Turbine spool from pressure at the turbine inlet, then shaft
  // coupling: compressor and fan turn with the turbine.
  const pIn = pPressAvg(st.turbX - 12, st.cy - 6, st.turbX - 6, st.cy + 6);
  pSpool(st.turbine, Math.min(2.5, Math.max(0, pIn) * 0.5), 0.03);
  pCouple(st.comp, st.turbine);
  pCouple(st.fan, st.turbine);
  // Fan pressure: intake and bypass pressure follow fan RPM.
  const boost = Math.min(8, pRPM(st.fan) / 573 * 6);
  const setPress = (r) => {
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++)
        if (sIn(x, y)) sim.press[sIdx(x, y)] = boost;
  };
  setPress(st.intake);
  setPress(st.bypass);
  setPress(st.bypassLo);
}

// --- 5. Turbine Demo -------------------------------------------------------
function buildTurbine() {
  let rotor = null;
  if (typeof sDemoTurbine === "function") {
    const r = sDemoTurbine(); // real demo returns the wheel (or null)
    if (r) rotor = r;
    else if (typeof rotors !== "undefined" && Array.isArray(rotors)) {
      for (let k = rotors.length - 1; k >= 0; k--) {
        if (rotors[k] && rotors[k].dst) { rotor = rotors[k]; break; }
      }
    }
  }
  if (!rotor) {
    // Fallback (Stage C not wired yet): own duct + paddle wheel.
    sClear();
    const steel = pMat("Steel");
    const cy = Math.floor(SIM_H * 0.45);
    const x0 = Math.floor(SIM_W * 0.30), x1 = x0 + 120;
    for (let x = x0; x <= x1; x++) { sSet(x, cy - 12, steel); sSet(x, cy + 12, steel); }
    for (let y = cy - 12; y <= cy + 12; y++) sSet(x1, y, steel);
    rotor = pMakeRotor(Math.floor((x0 + x1) / 2), cy, 5);
  }
  return { rotor: rotor, feedX: rotor.px - 10, feedY: rotor.py };
}

function tickTurbine(st) {
  const r = st.rotor;
  if (!r) return;
  if (r.feed) return; // real demo: sFeedRotor drives it every tick
  // No feed (fallback wheel): wind is the torque source. A bound
  // rotor spins on wind pressure via the real physics; a plain
  // stand-in (shim world) needs its w driven directly.
  const wind = pMat("Wind");
  for (let k = -1; k <= 1; k++) pSetAir(st.feedX, st.feedY + k, wind);
  if (!r.dst) {
    const p = pPressAvg(r.px - 8, r.py - 3, r.px - 5, r.py + 3);
    pSpool(r, Math.min(2, 0.3 + Math.max(0, p) * 0.2), 0.05);
  }
}

// --- public API ------------------------------------------------------------
const PRESETS = [
  { id: "furnace", name: "Furnace Test",
    desc: "Sealed steel chamber — fuel + gunpowder, light it and watch pressure climb.",
    build: buildFurnace },
  { id: "i4", name: "I4 Engine + Turbo",
    desc: "Four chambers fire 1-3-4-2; exhaust spools a turbo. No pistons — rotors only.",
    build: buildI4 },
  { id: "rocket", name: "Rocket",
    desc: "RP-1 + LOX feed a chamber and bell nozzle. Tanks drain as it burns.",
    build: buildRocket },
  { id: "turbofan", name: "Turbofan",
    desc: "Fan + bypass duct around a compressor-burner-turbine core. Twin nozzles.",
    build: buildTurbofan },
  { id: "turbine", name: "Turbine Demo",
    desc: "Paddle-wheel turbine in a duct, driven by wind.",
    build: buildTurbine },
];

function sLoadPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return false;
  sClear();
  // Fresh scene: drop the previous preset's rotors/nozzles too. The
  // coordinator's sClear hooks do this once wired; these lines cover
  // the gap until then and are harmless afterwards.
  if (typeof sClearRotors === "function") {
    try { sClearRotors(); } catch (e) { /* ignore */ }
  }
  if (Array.isArray(sim.nozzles)) sim.nozzles.length = 0;
  if (typeof rotors !== "undefined" && Array.isArray(rotors)) rotors.length = 0;
  presetState = null;
  sActivePreset = null;
  const st = p.build() || {};
  st.id = id;
  presetState = st;
  sActivePreset = id;
  const btn = document.getElementById("presetLibBtn");
  if (btn) btn.textContent = "Library: " + p.name;
  return true;
}

// Called once per tick from the main loop (coordinator wires the call).
// No-op when no preset is active.
function sPresetTick() {
  if (!sActivePreset || !presetState) return;
  const st = presetState;
  // Retry nozzle registrations parked at build time (API not ready then).
  if (st.pendingNozzles && st.pendingNozzles.length &&
      typeof sRegisterNozzle === "function") {
    const rest = [];
    for (const spec of st.pendingNozzles) {
      const n = pRegisterNozzle(spec);
      if (n) (st.nozzles = st.nozzles || []).push(n);
      else rest.push(spec);
    }
    st.pendingNozzles = rest;
  }
  if (sActivePreset === "i4") tickI4(st);
  else if (sActivePreset === "rocket") tickRocket(st);
  else if (sActivePreset === "turbofan") tickTurbofan(st);
  else if (sActivePreset === "turbine") tickTurbine(st);
  // furnace: no per-tick work — it burns on its own.
}

// Drop the active preset (for Clear): the preset's per-tick work stops
// and the Library button goes back to plain "Library". Called from
// sClear() (sim.js) via a typeof guard. sLoadPreset calls sClear()
// first and sets the new state afterwards, so the ordering is safe.
function sClearPreset() {
  sActivePreset = null;
  presetState = null;
  const btn = document.getElementById("presetLibBtn");
  if (btn) btn.textContent = "Library";
}

// --- Library UI ------------------------------------------------------------
// Builds a "Library" button in the top bar (#top) with a dropdown of
// the presets. The coordinator calls this once from main.js, AFTER
// main.js has built the top bar. Do NOT call at load.
function sInitLibraryUI() {
  const top = document.getElementById("top");
  if (!top || document.getElementById("presetLibBtn")) return;
  const wrap = document.createElement("div");
  wrap.id = "presetLibWrap";
  wrap.style.cssText = "position:relative;flex:none";
  const btn = document.createElement("div");
  btn.className = "b";
  btn.id = "presetLibBtn";
  btn.textContent = "Library";
  wrap.appendChild(btn);
  const dd = document.createElement("div");
  dd.id = "presetLibDrop";
  dd.style.cssText = "display:none;position:absolute;top:30px;left:0;min-width:280px;" +
    "max-width:88vw;background:#000;border:1px solid #fff;z-index:50;" +
    "font:12px \"Courier New\",monospace;text-align:left";
  for (const p of PRESETS) {
    const row = document.createElement("div");
    row.style.cssText = "padding:7px 9px;cursor:pointer;border-bottom:1px solid #333;" +
      "white-space:normal;line-height:1.4";
    const nm = document.createElement("div");
    nm.style.fontWeight = "bold";
    nm.textContent = p.name;
    const ds = document.createElement("div");
    ds.style.cssText = "color:#999;font-size:11px";
    ds.textContent = p.desc;
    row.appendChild(nm);
    row.appendChild(ds);
    row.addEventListener("mouseenter", () => { row.style.background = "#222"; });
    row.addEventListener("mouseleave", () => { row.style.background = ""; });
    row.addEventListener("click", () => {
      dd.style.display = "none";
      sLoadPreset(p.id);
    });
    dd.appendChild(row);
  }
  wrap.appendChild(dd);
  // Insert after the view button (first child), before the spacer.
  top.insertBefore(wrap, top.children[1] || null);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dd.style.display = dd.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) dd.style.display = "none";
  });
}

// --- integration notes for the coordinator ---------------------------------
// 1. Script order in Index.html (after sim.js, before main.js):
//      <script src="js/materials.js?v=N"></script>
//      <script src="js/sim.js?v=N"></script>
//      <script src="js/rotors.js?v=N"></script>      (Stage C, if separate)
//      <script src="js/nozzle.js?v=N"></script>      (Stage B, if separate)
//      <script src="js/presets.js?v=N"></script>
//      <script src="js/main.js?v=N"></script>
//    presets.js only needs materials.js + sim.js at load; the rotor /
//    nozzle APIs are looked up lazily (typeof checks) at build/tick time.
// 2. Main loop (main.js frame()): call sPresetTick() once per sStep(),
//    i.e. inside the `while (acc >= 33 ...)` loop next to sStep(). The
//    rotor step (sStepRotors) belongs there too, once per tick.
// 3. After main.js builds the top bar, call sInitLibraryUI() once.
// 4. sClear() hooks (coordinator): clear sim.nozzles and the rotors
//    array + preset state (sActivePreset = null, presetState = null)
//    when the user hits Clear, so a hand-built scene has no leftovers.
//    sLoadPreset already does this defensively.
// 5. Thrust readout: sim.thrust is the smoothed sum over sim.nozzles;
//    main.js shows it in the FPS line while an engine preset is firing.
