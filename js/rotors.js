// Engineer — rotors: moving parts (Stage 3).
// A Bearing lets the solids touching it spin around it, driven by
// pressure and liquid weight on the exposed blade faces — a paddle
// wheel, a turbine, a fan.
//
// Ported/adapted from Sam's rotor system in Powder_UI.html
// (bindRotors / rotate / demo / addWater). Engineer's names for his:
//   grid -> sim.mat, T -> sim.temp, P -> sim.press, L -> sim.life,
//   U (updated-this-frame) -> sim.moved, rot -> sRot, bm -> sBm,
//   E[t].ty 's'/'l'/'p' -> MATERIALS[t].cat "solid"/"liquid"/"powder".
//
// Differences from Sam's version (deliberate, noted where they land):
//   - Press/pressPrev travel WITH the blade material in the template
//     (mP/mPP alongside mt/mT): the adiabatic term compares a cell's
//     pressure against its own last-tick pressure, so the history must
//     move with the material, exactly like sSwap. Radiation (sim.rad)
//     is NOT carried — it is a field, it belongs to the space.
//   - A blade that melts, burns or otherwise changes material out from
//     under its rotor breaks the binding (the rotor is dropped; the
//     next sBindRotors pass picks up whatever solid is left).
//   - sDemoTurbine's feed drives only the UPPER half of the wheel.
//     A symmetric left-to-right feed gives zero net torque (the top
//     arm is pushed one way, the bottom arm the other, equally) —
//     Sam's demo works the same way, pressurising only above the
//     wheel with the lower half shielded in a cavity.
//   - The demo turbine carries a `feed` region: sStepRotors repaints
//     Wind + pressure there every tick, so the demo wheel spins
//     continuously instead of running out of wind.
//
// Load order: materials.js, sim.js, rotors.js, main.js (classic
// scripts, bare globals, no build step — like the rest of the game).
// Integration (coordinator): call sStepRotors() once per tick after
// sStep(), call sBindRotors() every 15 ticks, hook sClearRotors()
// into sClear() / the clear button, and sKillRotorAt(x, y) into erase.

// Per-cell maps: rotor id / bearing id per cell, 0 = none.
// Ids are 1-based: id = index + 1 into `rotors` (null entries stay
// null after a kill, so ids stay stable until sClearRotors).
const sRot = new Uint8Array(SIM_W * SIM_H);
const sBm = new Uint8Array(SIM_W * SIM_H);

// All bound rotors. Each: {px, py, R, S, mt, mT, mP, mPP,
//   dst, ds, bc, th, w, I, feed}
//   px,py = pivot (bearing centroid); R = template half-size,
//   S = 2R+1 (template side); mt/mT/mP/mPP = template material /
//   temp / press / pressPrev; dst = live cell indices, ds = matching
//   template slots; bc = bearing cells; th = angle, w = angular
//   velocity (rad/tick); I = moment of inertia; feed = optional
//   {x0,y0,x1,y1} region sStepRotors keeps fed with wind+pressure.
const rotors = [];

const ROTOR_NB = [[-1, -1], [0, -1], [1, -1], [-1, 0],
                  [1, 0], [-1, 1], [0, 1], [1, 1]];
// Sub-pixel sample offsets (centre first — a hit on the centre
// sample is a "primary" hit, which is what bounces on collision).
const ROTOR_SO = [[0, 0], [.25, .25], [-.25, .25],
                  [.25, -.25], [-.25, -.25]];

// Bearing material id, resolved lazily: Bearing does not exist in
// materials.js yet, so never resolve it at file top level.
function sBearingId() {
  const b = MAT["Bearing"];
  return b ? b.id : -1;
}

// 8-neighbourhood fan-out around cell c.
function sRotorNb(c, f) {
  const x = c % SIM_W, y = (c / SIM_W) | 0;
  for (const [a, b] of ROTOR_NB) {
    const xx = x + a, yy = y + b;
    if (xx >= 0 && xx < SIM_W && yy >= 0 && yy < SIM_H) f(yy * SIM_W + xx);
  }
}

// A cell that can be a rotor blade: a solid, not Wall, not Bearing,
// not already bound to another rotor.
function sIsRotatable(j, BID) {
  const t = sim.mat[j];
  if (!t || sRot[j]) return false;
  if (t === 1 || t === BID) return false;
  const m = MATERIALS[t];
  return !!m && m.cat === "solid";
}

// Call f(n, ox, oy) for each exposed face of blade cell c: the
// neighbour in direction (ox, oy) is not part of this rotor and not
// a solid, so fluid pressure / liquid weight can push on that face.
function sRotorExposed(c, id, f) {
  const x = c % SIM_W, y = (c / SIM_W) | 0;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const xx = x + ox, yy = y + oy;
    if (xx < 0 || xx >= SIM_W || yy < 0 || yy >= SIM_H) continue;
    const n = yy * SIM_W + xx, t = sim.mat[n];
    if (sRot[n] === id) continue;
    if (t && MATERIALS[t] && MATERIALS[t].cat === "solid") continue;
    f(n, ox, oy);
  }
}

// --- Binding ---------------------------------------------------------------
// Scan the grid for bearing clusters that aren't bound yet, and bind
// the rotatable solids touching them.
//
// The full-grid scan lives in sScanBearings, kept deliberately tiny:
// it is the hot loop (every cell, every bind pass) and must stay in
// the JIT's fast path. The per-cluster work lives in sBindOneRotor.

// Per-call scratch for the bind pass: which bearing cells have been
// visited. Reused across calls (no fresh 385KB alloc per pass) and
// reset with fill(0) at the start of each pass.
const sBindSeen = new Uint8Array(SIM_W * SIM_H);

// Hot scan: collect unbound bearing cells. Lean — the only work per
// cell is the bearing-id compare (early-out on non-bearing cells).
function sScanBearings(BID) {
  const out = [];
  const mat = sim.mat;
  for (let i = 0; i < mat.length; i++) {
    if (mat[i] === BID && !sBm[i] && !sBindSeen[i]) out.push(i);
  }
  return out;
}

function sBindRotors() {
  const BID = sBearingId();
  if (BID < 0) return; // no Bearing material yet — nothing to bind
  sBindSeen.fill(0);
  const cands = sScanBearings(BID);
  for (let k = 0; k < cands.length; k++) {
    const i = cands[k];
    if (sBm[i] || sBindSeen[i]) continue; // absorbed by an earlier cluster
    sBindOneRotor(i, BID);
  }
}

// Bind one bearing cluster starting at cell i: flood-fill the cluster,
// collect the adjacent rotatable solids, and build the rotor.
function sBindOneRotor(i, BID) {
    // Flood-fill the bearing cluster (8-neighbourhood).
    const bc = [], q = [i];
    sBindSeen[i] = 1;
    while (q.length) {
      const c = q.pop();
      bc.push(c);
      sRotorNb(c, (j) => {
        if (sim.mat[j] === BID && !sBm[j] && !sBindSeen[j]) { sBindSeen[j] = 1; q.push(j); }
      });
    }
    // Collect adjacent rotatable solids, flooding through solids.
    const cells = [], vis = new Set(), q2 = [];
    const add = (j) => { if (sIsRotatable(j, BID) && !vis.has(j)) { vis.add(j); q2.push(j); } };
    bc.forEach((c) => sRotorNb(c, add));
    while (q2.length) { const c = q2.pop(); cells.push(c); sRotorNb(c, add); }
    if (!cells.length) return;
    // Pivot = bearing centroid; R covers the blades with margin.
    let sx = 0, sy = 0;
    bc.forEach((c) => { sx += c % SIM_W; sy += (c / SIM_W) | 0; });
    const px = Math.round(sx / bc.length), py = Math.round(sy / bc.length);
    let R = 1;
    cells.forEach((c) => {
      R = Math.max(R, Math.abs(c % SIM_W - px), Math.abs(((c / SIM_W) | 0) - py));
    });
    R = Math.ceil(R * 1.5) + 1;
    const S = 2 * R + 1;
    const mt = new Uint8Array(S * S), mT = new Float32Array(S * S);
    const mP = new Float32Array(S * S), mPP = new Float32Array(S * S);
    const dst = [], ds = [];
    const id = rotors.length + 1;
    let I = 0;
    cells.forEach((c) => {
      const ox = c % SIM_W - px, oy = ((c / SIM_W) | 0) - py;
      const si = (oy + R) * S + ox + R;
      mt[si] = sim.mat[c]; mT[si] = sim.temp[c];
      mP[si] = sim.press[c]; mPP[si] = sim.pressPrev[c];
      dst.push(c); ds.push(si); sRot[c] = id; I += ox * ox + oy * oy;
    });
    rotors.push({ px, py, R, S, mt, mT, mP, mPP,
                  dst, ds, bc, th: 0, w: 0, I: Math.max(I, 20), feed: null });
    bc.forEach((c) => { sBm[c] = id; });
}

// --- Rotation --------------------------------------------------------------
// Rotate one rotor one tick: torque from pressure + liquid weight /
// hydrostatic push on exposed blade faces, then rigidly rotate the
// template (sub-pixel sampled) into its new position.
function sRotateRotor(r) {
  const BID = sBearingId();
  const id = rotors.indexOf(r) + 1;
  if (id < 1) return;
  const { px, py, R, S, mt, mT, mP, mPP } = r;
  // A blade that changed material (melted, burned, shattered) breaks
  // the binding — drop the rotor so a rebind can pick up the rest.
  for (let k = 0; k < r.dst.length; k++) {
    if (sim.mat[r.dst[k]] !== mt[r.ds[k]] || sRot[r.dst[k]] !== id) {
      sKillRotor(id - 1);
      return;
    }
  }
  // Torque from pressure + liquid weight and hydrostatic push on each
  // exposed blade face. A liquid/powder neighbour pushes with its
  // pressure plus the weight of the column stacked above it.
  let tq = 0;
  for (const c of r.dst) {
    const dx = c % SIM_W - px, dy = ((c / SIM_W) | 0) - py;
    sRotorExposed(c, id, (n, ox, oy) => {
      let q = sim.press[n];
      const g = sim.mat[n];
      const lq = (t) => t && MATERIALS[t] &&
        (MATERIALS[t].cat === "liquid" || MATERIALS[t].cat === "powder");
      if (lq(g)) {
        let h = 1, xx = n % SIM_W, yy = ((n / SIM_W) | 0) - 1;
        while (yy >= 0 && h < 14 && lq(sim.mat[yy * SIM_W + xx])) { h++; yy--; }
        q += MATERIALS[g].density * h * 0.7;
      }
      tq += dx * (-q * oy) - dy * (-q * ox);
    });
  }
  // Angular velocity: clamp +-0.5 rad/tick, friction 0.995.
  r.w = Math.max(-0.5, Math.min(0.5, (r.w + tq / r.I * 0.04) * 0.995));
  if (Math.abs(r.w) < 2e-4) return;
  const th = r.th + r.w, cs = Math.cos(th), sn = Math.sin(th);
  const nd = [], ns = [];
  let dp = null; // displaced loose material: [cell, mat, temp, press, pressPrev, life]
  for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
    let si = -1, prim = false;
    for (let q = 0; q < 5; q++) {
      const fx = ox + ROTOR_SO[q][0], fy = oy + ROTOR_SO[q][1];
      const sx = Math.round(fx * cs + fy * sn), sy = Math.round(-fx * sn + fy * cs);
      if (sx < -R || sx > R || sy < -R || sy > R) continue;
      const s = (sy + R) * S + sx + R;
      if (mt[s]) { si = s; prim = q === 0; break; }
    }
    if (si < 0) continue;
    const x = px + ox, y = py + oy;
    if (x < 0 || x >= SIM_W || y < 0 || y >= SIM_H) {
      if (prim) { r.w *= -0.3; return; } // bounce off the edge
      continue;
    }
    const d = y * SIM_W + x, g = sim.mat[d];
    if (g && sRot[d] !== id) {
      if (g === BID) continue; // the bearing never moves
      if (MATERIALS[g] && MATERIALS[g].cat === "solid") {
        if (prim) { r.w *= -0.3; return; } // bounce off a solid
        continue;
      }
    }
    // Loose material in the way gets pushed aside after the move.
    if (g && sRot[d] !== id) {
      (dp = dp || []).push([d, g, sim.temp[d], sim.press[d], sim.pressPrev[d], sim.life[d]]);
    }
    nd.push(d); ns.push(si);
  }
  // Sync the template's carried state from the cells about to move.
  for (let k = 0; k < r.dst.length; k++) {
    mT[r.ds[k]] = sim.temp[r.dst[k]];
    mP[r.ds[k]] = sim.press[r.dst[k]];
    mPP[r.ds[k]] = sim.pressPrev[r.dst[k]];
  }
  // Clear the old cells (they become air; pressure history travels
  // with the blade, radiation stays where it was — it is a field).
  for (const c of r.dst) {
    if (sRot[c] === id) {
      sRot[c] = 0; sim.mat[c] = 0;
      sim.temp[c] = AMBIENT_TEMP; sim.press[c] = 0; sim.pressPrev[c] = 0;
    }
  }
  // Place the blades at their new positions.
  for (let k = 0; k < nd.length; k++) {
    const d = nd[k], si = ns[k];
    sim.mat[d] = mt[si]; sim.temp[d] = mT[si];
    sim.press[d] = mP[si]; sim.pressPrev[d] = mPP[si];
    sim.life[d] = 0; sRot[d] = id; sim.moved[d] = 1;
  }
  r.dst = nd; r.ds = ns; r.th = th;
  // Put displaced loose material back into a neighbouring empty cell.
  if (dp) {
    for (const [d, g, tt, pp, ppr, ll] of dp) {
      let ok = false;
      sRotorNb(d, (e) => {
        if (!ok && !sim.mat[e]) {
          sim.mat[e] = g; sim.temp[e] = tt; sim.press[e] = pp;
          sim.pressPrev[e] = ppr; sim.life[e] = ll; sim.moved[e] = 1;
          ok = true;
        }
      });
    }
  }
  // Moving faces push air: pressure on the side they move into,
  // suction on the other, clamped +-40.
  for (const c of nd) {
    const dx = c % SIM_W - px, dy = ((c / SIM_W) | 0) - py;
    const vx = -dy * r.w, vy = dx * r.w;
    sRotorExposed(c, id, (n, ox, oy) => {
      sim.press[n] = Math.max(-40, Math.min(40, sim.press[n] + (vx * ox + vy * oy) * 3));
    });
  }
}

// Keep a demo turbine's feed region supplied: wind + pressure, every
// tick, so the wheel spins continuously. Only used by rotors whose
// `feed` was set (sDemoTurbine); ordinary player-built rotors have
// feed === null and this is a no-op.
function sFeedRotor(r) {
  const f = r.feed;
  if (!f) return;
  const WIND = MAT["Wind"] ? MAT["Wind"].id : 52;
  for (let y = f.y0; y <= f.y1; y++) {
    for (let x = f.x0; x <= f.x1; x++) {
      if (!sIn(x, y)) continue;
      const i = sIdx(x, y);
      if (sim.mat[i] === 0) sSet(x, y, WIND);
      sim.press[i] = 25;
    }
  }
}

// --- Public API ------------------------------------------------------------

// Rotate every bound rotor once per tick.
function sStepRotors() {
  for (let k = 0; k < rotors.length; k++) {
    const r = rotors[k];
    if (!r) continue;
    if (r.feed) sFeedRotor(r);
    sRotateRotor(r);
  }
}

// Revolutions per minute for a rotor (w is rad/tick at 30 ticks/sec).
function sRotorRPM(r) {
  return Math.abs(r.w) * 573;
}

// Drop every rotor and clear the per-cell maps.
function sClearRotors() {
  rotors.length = 0;
  sRot.fill(0);
  sBm.fill(0);
}

// Kill the rotor whose bearing or blade is at (x, y) — for erase.
// Returns true if a rotor was killed.
function sKillRotorAt(x, y) {
  if (!sIn(x, y)) return false;
  const k = sRot[sIdx(x, y)] || sBm[sIdx(x, y)];
  if (!k) return false;
  sKillRotor(k - 1);
  return true;
}

// Kill rotor index k (0-based): clear its maps, leave a null slot.
function sKillRotor(k) {
  const r = rotors[k];
  if (!r) return;
  for (const c of r.dst) if (sRot[c] === k + 1) sRot[c] = 0;
  for (const c of r.bc) if (sBm[c] === k + 1) sBm[c] = 0;
  rotors[k] = null;
}

// --- Demo ------------------------------------------------------------------
// Paddle-wheel turbine (adapted from Sam's demo() + addWater(), kept
// simpler): a wall duct, an 8-arm steel wheel on a bearing, and a
// steady wind/pressure feed on the left. The feed covers only the
// UPPER half of the wheel — that asymmetry is what makes it spin
// (see the header note). All coordinates are fractions of the grid,
// so it works in landscape and portrait. Returns the wheel rotor
// (or null if Bearing doesn't exist yet).
function sDemoTurbine() {
  sClear();
  sClearRotors();
  sim.windDir = 0; // feed blows right
  const STEEL = MAT["Steel"] ? MAT["Steel"].id : 2;
  const BID = sBearingId();
  const cx = Math.floor(SIM_W * 0.5), cy = Math.floor(SIM_H * 0.55);
  const hw = 30; // duct half-width
  // Duct: wall roof and floor, open at both ends.
  for (let x = cx - hw; x <= cx + hw; x++) {
    for (const y of [cy - 14, cy - 13]) sSet(x, y, 1);
    for (const y of [cy + 13, cy + 14]) sSet(x, y, 1);
  }
  // Bearing cluster at the centre.
  if (BID >= 0) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) sSet(cx + dx, cy + dy, BID);
  }
  // 8 arms, alternating length 8 / 6.
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    const len = (k % 2) ? 6 : 8;
    for (let rr = 2; rr <= len; rr++)
      sSet(Math.round(cx + rr * Math.cos(a)), Math.round(cy + rr * Math.sin(a)), STEEL);
  }
  sBindRotors();
  const r = rotors.find((v) => v && Math.abs(v.px - cx) <= 1 && Math.abs(v.py - cy) <= 1);
  // Steady feed just left of the wheel, upper half only.
  if (r) r.feed = { x0: cx - 26, y0: cy - 11, x1: cx - 22, y1: cy - 1 };
  return r || null;
}
