# Engineer — Overnight Status

Sam asked (2026-11-22 00:40 ET): work through the night — real-world material
tolerances, radiation/radioactivity, rocket fuel, compression physics, bell
nozzle physics, and a pre-made sims library (I4 + turbo, Rocket, Turbofan).
Coordinator subagent running. No releases/versions — Sam names versions himself.
All overnight stages A–E are done locally and verified; every push
(?v=9–?v=13) waits for the morning, when Sam is awake to approve the
GitHub calls (the ?v=9 push was blocked on an approval timeout ~00:55 ET).

## Starting state (verified live)
- Main at `f4c25a07` (?v=8). 55 materials. Stage 2 step 1 physics done
  (pressure airflow, oxygen combustion, Wind + direction, Exhaust, Nozzle + Vac).
  Fullscreen fix done (grid sized to stage aspect at load).
- Verify scripts in `~/workspace/engineer-test/`: verify.js, verify-ui.js,
  verify-fullscreen.js, bench.js — all passing, zero errors, busy ~7.4ms/tick.

## Stages
- [x] Stage 0 — setup: status file, research worker spawned (tolerances).
- [x] Stage A — radiation + compression physics (?v=9, commit TBD).
  - Radiation field (diffuses, absorbed as heat, lead shields 3.5x);
    neutrons/protons/electrons from decay; decay chains Po→Pb, U→Po,
    Pu→U (compressed ~1000x); Radiation view + Rad readout.
  - Adiabatic compression/expansion (T ∝ P^0.286, ambient 10 = 1 atm);
    verified: single compression 20→165°C, expansion 430→176°C.
  - New materials: Neutron, Proton, Electron (decay-only), Lead,
    Molten Lead (60 total). Perf: dirty flags keep idle tick at 5.6ms,
    busy 7.9ms.
  - Bugs found by testing: (1) rad pair factor used summed density, so
    a dense source couldn't radiate out — shielding is absorption, not
    reflection (min-density factor now); (2) pressPrev didn't travel
    with swapped materials — phantom ±hundreds of degrees (fixed in
    sSwap/sSet/wind move); (3) rad test piles fell away from the probes
    (wall floors added).
  - PUSH BLOCKED (2026-11-22 ~00:55 ET): the remote-head check
    (github list_commits) needed an approval that timed out twice, so
    the ?v=9 push has NOT happened. Local files are ready (?v=9 bumped,
    README + status updated). Next: approve/arrange the GitHub call,
    confirm remote head is still f4c25a07, push, append sync record.
- [x] Stage B — rocket fuel (RP-1/LOX, LH2) + bell nozzle + thrust readout (?v=10, NOT pushed).
  - New materials: RP-1 (60), Liquid Hydrogen (61, -253°C), Hydrogen (62).
    Total 63. RP-1 alone burns ~930°C; next to LOX it burns ~3285°C
    (hydrogen/LOX ~3200°C) straight into Exhaust — ordinary O2-gas burn
    stays at 1200°C. LH2 boils to Hydrogen gas; Hydrogen burns (49
    fire/smoke cells in sealed box, 30 ticks).
  - Bell nozzle in `js/sim.js`: `sRegisterNozzle` (chamber/throat/exit/
    direction/throatW/exitW), isentropic SI physics, 1 cell = 0.1 m,
    gamma 1.2, R 400. Chokes at throat (Mach 1), exit Mach from area
    ratio (bisection, supersonic branch); thrust = mdot*Ve + (pe-Pa)*Ae.
    Verified: ~10.7 kN at 50 press, ~25.7 kN at 100 press, exit Mach 2.62,
    Ve ~2933 m/s, mdot 5.73 kg/s; wide bell over-expanded (pe 14.3 kPa
    < Pa 101.3 kPa), narrow bell near-ambient (112.9 kPa); blocked
    throat = 0 thrust. Plume flow pushes exhaust down the bell
    (2 cells/tick, 31 cells below throat in 20 ticks).
  - Thrust readout in FPS line (`Thrust: X.X kN` when sim.thrust > 10).
  - Bugs found by testing: (1) plume flow skipped cells already moved
    by step 4 and ran throat-first, so plume never moved — fixed to
    exit-first, no moved-skip; (2) gas rose out of the bell in step 4
    before the flow ran in step 5 — fixed by running the nozzle block
    right after `sim.moved.fill(0)`, before the movement loop, and
    pushing 2 cells/tick so the flow beats buoyancy.
  - Bench note: sandbox bench is noisy — empty 13ms one run, 30ms the
    next, furnace 26–37ms, busy 19–36ms across runs with NO game change
    between them. Sandbox CPU throttling, not a regression; re-check on
    real hardware before trusting any bench number. Do not quote 7.9ms
    as current.
  - Verify: verify.js, verify-ui.js, verify-fullscreen.js all PASS,
    zero errors. New checks: rp1/hydrogen burn, LOX boost temps,
    nozzle thrust/Mach/Ve/mdot, over-expansion, blocked throat, plume.
- [x] Stage C — rotors ported from Sam's Powder_UI.html + Bearing (?v=11, NOT pushed).
  - New file `js/rotors.js` (port of Sam's bindRotors/rotate): Bearing
    material id 63 (Devices, density 4, cond 0.5, melt 3000, tol 300 —
    Sam's BRNG values). Solids touching a bearing bind into a wheel;
    torque from pressure + liquid weight/hydrostatic push on exposed
    blade faces; w clamp ±0.5 rad/tick, friction 0.995, bounce w *= -0.3
    on solid/edge collision; displaced loose material pushed aside;
    moving faces push air (pressure/suction clamped ±40); 5-sample
    sub-pixel rotation. API: rotors[], sBindRotors(), sStepRotors(),
    sRotorRPM() (|w|*573), sClearRotors(), sKillRotorAt(x,y),
    sDemoTurbine(), per-cell maps sRot/sBm.
  - Integration: script tag between sim/main; frame loop calls
    sStepRotors() every sim tick + sBindRotors() every 15 ticks;
    sClear() calls sClearRotors() (typeof-guarded, so sim.js alone
    still works); erase calls sKillRotorAt() first (kills the whole
    rotor; next bind pass rebinds what's left).
  - Deliberate deviations from Sam's code: press/pressPrev travel with
    the blade in template arrays (adiabatic history must move with
    material, like sSwap); sim.rad never carried (field, belongs to
    space); a blade that melts/burns breaks its rotor (rebind picks up
    the rest); demo feed drives only the UPPER half (symmetric feed
    gives zero net torque — same reason Sam pressurises only above his
    wheel); demo carries a `feed` region repainted with Wind + press 25
    every tick so it spins continuously.
  - Perf: sStepRotors 0.30 ms/tick with demo wheel live; sBindRotors
    1.0–4.6 ms/call after the worker fixed a real perf bug (closure-
    heavy scan ran 38–105 ms/call; split into sScanBearings +
    sBindOneRotor + reused sBindSeen buffer). At every-15-ticks that's
    ~0.1–0.3 ms/tick amortised.
  - Verify: fan 4-arm steel, 32 blades, R=15, I=1136 — peak RPM 29.4,
    turned 0.75 rad/300 ticks; sDemoTurbine 44 blades, peak RPM 40.0,
    turned 3.84 rad/300 ticks; clear/kill/rebind all pass; zero errors.
    (Instant RPM pulses with arm angle, so peak + total turn are the
    assertions, not single-tick RPM. Blade dst count oscillates with
    angle — nearest-neighbour resampling aliasing, not growth.)
  - Bench unchanged vs Stage B (empty ~13ms, busy ~19ms, sandbox-noisy).
- [x] Stage D — presets library: I4 + turbo, Rocket, Turbofan + Library UI (?v=12, NOT pushed).
  - New file `js/presets.js` (819 lines): PRESETS (furnace/i4/rocket/
    turbofan/turbine), sLoadPreset(id), sPresetTick(), sActivePreset,
    sInitLibraryUI() (Library button in #top + dropdown with name +
    one-line desc). All coords relative (fractions of SIM_W/SIM_H for
    position, absolute cells for critical sizes: chamber ~20, throat 2,
    exit ~8). Materials looked up by name via MAT, never hardcoded ids.
  - I4 Engine + Turbo: 4 steel chambers firing 1-3-4-2, one firing per
    15 ticks; each firing refills fuel+oxygen, ignites, pulses pressure
    into an exhaust manifold feeding a turbine; turbine shares a shaft
    with a compressor (w_comp = w_turb) pressurising the intake plenum
    proportional to RPM. Verified: fire order 1,3,4,2 x4 clean at both
    sizes, exhaust ~1340, turbine 63–66 RPM.
  - Rocket: real RP-1 + LOX glass sight-tanks over a chamber, bell
    nozzle (throat 2, exit 8) via sRegisterNozzle. Propellant METERED
    (injector 1 RP-1/tick, LOX feed 2 O2/tick; gravity feed flash-burns
    the pool ~3 cells/tick, oxygen is the limiting reagent). Test-stand
    top-ups slower than burn, so tanks visibly drain (LOX 687/1287,
    RP-1 987/1287 after 600 ticks). Verified: max thrust ~7.84 kN,
    sustained ~2.2 kN, burning, both sizes.
  - Turbofan: intake fan + bypass duct around a core (compressor →
    burner → turbine, one shaft), TWO nozzles (core + bypass). Verified:
    rotors 40–51 RPM, max thrust ~6.6 kN, core nozzle ~5.3 kN.
    KNOWN LIMIT: bypass nozzle reads 0 N — the thrust model is hot-gas
    isentropic (chamber gas must be ≥500 K) and bypass air is cool. Fan
    thrust shows as bypass pressurisation + airflow; core carries the
    Newtons. Documented in presets.js.
  - Turbine Demo: wraps the real sDemoTurbine() (33–50 RPM).
  - Furnace Test: wraps sPresetFurnace().
  - Integration: script tag after rotors.js; frame loop calls
    sPresetTick() once per sStep; sInitLibraryUI() once after the top
    bar is built; sClear() now also calls sClearPreset() (typeof-
    guarded — Clear stops the active preset's per-tick work and resets
    the Library button text, or it would keep refilling chambers on
    the cleared grid). sLoadPreset clears first, then sets state, so
    the ordering is safe. verify-presets.js fixed to skip re-injecting
    presets.js when Index.html already loaded it (const PRESETS
    redeclaration would throw).
  - Bugs found by testing (fixed in the preset, not shims): plain rotor
    objects crash sRotateRotor (r.dst) — pMakeRotor now returns the
    BOUND rotor; I4 rotors bound the whole steel structure (650 cells,
    I ~3M) — walls now stop at housing left wall, binding clean
    (cells [40,40]); turbine torque needs asymmetry (quadrant feed
    cancels exactly, w=0.000) — narrow strip left of upper arm only,
    gated on firing pressure + vent sink past the turbofan turbine;
    rocket starved twice — metered injector + 2 O2/tick + disc
    pressure hold (+3/tick to 40).
  - Honest flags: turbos spin slowly (33–75 RPM; physics clamp is
    286 RPM) — feed pressure 25 gives modest torque; rotor dst count
    oscillates with angle (24→40, 44→80) — nearest-neighbour
    resampling aliasing, bounded, cosmetic, shape preserved.
  - Verify: verify-presets.js ALL PRESETS PASS at desktop 800x482 and
    iPhone portrait 374x800, 0 page errors. verify.js / verify-ui /
    verify-fullscreen / bench all PASS, zero errors, no regressions.
- [x] Stage E — real-world tolerances (?v=13, NOT pushed).
  Patch applied (~/workspace/engineer-test/tolerances-patch.md,
  apply script: apply-stage-e.py): 83 field changes across 44
  materials + 3 new molten radioactives (ids 64–66), Molten Glass
  freezeTo fix (Sand→Glass). 67 materials total (Solids 19, Powders 7,
  Liquids 21, Gases 13, Devices 3; 63 paintable). Biggest fixes: gold
  k 3.1→0.84 (no longer above copper), ceramic k 0.08→0.41, steam
  density 0.05→0.015 (now lighter than nitrogen/oxygen), molten
  freeze gaps uniform ~10 °C (Molten Glass 1400 is the deliberate
  exception — real glass behaviour).
  - New: Molten Polonium (64, melts 254 °C, selfHeat 3.0), Molten
    Plutonium (65, 640 °C), Molten Uranium (66, 1132 °C). Polonium
    pile self-melts with no outside heat (25/25 cells in 900 ticks,
    family max temp 960 °C in a sealed box). Molten polonium freezes
    back to Polonium; molten glass freezes to Glass (bug fix verified).
    Uranium stays solid after 300 ticks and still radiates (pile rad
    0.26–0.48, same order as Stage A).
  - Four defaults applied (Sam can flip any in the morning — see
    "Decisions needing Sam"): (1) radiation DECOUPLED from selfHeat
    (new radEmission field in sim.js; Pu 0.8, U 0.5, Po 1.5 and the
    three molten forms keep their Stage A levels); (2) Gas = propane
    (ignite 470 °C); (3) Titanium = Ti-6Al-4V alloy (pressureTol 200,
    not pure-Ti 90); (4) uranium selfHeat 0.05 accepted (nearly inert
    thermally, still radiates).
  - Verify: verify.js / verify-ui / verify-fullscreen / verify-presets
    / bench ALL PASS, zero errors (verify.js run 4×). Radiation field
    UNCHANGED by the patch (radNear 0.24 / mid 0.08 / far 0.02 in every
    run — the decoupling works). New Stage E baselines, measured not
    guessed: ceramic shatters at press 120 (Debris), uranium rise
    11 °C/60 ticks, insulation 90 °C vs steel 149 °C (gap holds),
    steam sorts above nitrogen (top y 91 vs 97), radiation particles
    6–13 per run (snapshot count, geometry-sensitive), lead shields
    3.5–10× (probe-sensitive; always clear shielding).
  - Corrections to the patch plan found by testing: (a) §I.1 press 80
    does NOT shatter ceramic — pressure diffuses ~25% away in the
    first tick before the shatter check, so 80 reads ~60 < tol 65;
    the test now uses 120 (reads ~90). (b) §I.2 uranium 1–5 °C was
    wrong: the real rise is 11 °C because the uranium cell absorbs
    its OWN radiation field as heat (~8 °C/60 ticks on top of the
    3 °C direct self-heat) — the patch derived 3 °C from selfHeat
    alone. (c) §I.3 insulation 90 °C, not the estimated 120–160 °C:
    the iron source's k also dropped (0.8→0.56), so the iron→
    insulation bottleneck got slower even though insulation's own k
    rose; the relationship (insulation < steel, 59 ° gap) is what
    matters and it holds. (d) §I.9.1 rise-rate test was redesigned:
    every gas rises at the 1 cell/tick cap through air, so both hit
    the chimney top together — the test is now STACKING (steam
    bubbles up through nitrogen in a sealed column), which is the
    real assertion for the density-order fix.
  - Bench: empty ~14 ms, furnace ~27 ms, busy ~19 ms — same noisy
    sandbox range as Stage B/C (CPU throttling, not a regression);
    re-check on real hardware before trusting any bench number.

## Push log
| Stage | Commit | ?v= | Notes |
|---|---|---|---|
| (start) | f4c25a07 | 8 | Stage 2 step 1 + fullscreen, verified live |

## Design decisions (for Sam)
- Plain canvas JS, no rewrite. Other languages only for tooling/checks.
- Neutrons/Protons/Electrons come from radioactive decay only, never painted.
- Real half-lives are far too long to see (U-238: 4.5 billion years), so game
  decay is compressed ~1000x — piles visibly transmute over minutes. Noted in code.
- Thrust is a computed readout (mass flow x exhaust velocity + pressure thrust),
  shown in the FPS line when an engine is firing.
- Presets use relative coordinates (grid size varies with screen).
- I4 preset: 4 chambers fire in order 1-3-4-2, turbo spools from exhaust.
  Pistons/crankshaft are NOT modelled — the sim has no linear moving parts
  (rotors only rotate). Flagged for Sam.

## Decisions needing Sam (defaults applied in Stage E — flip any in the morning)
- Radiation vs selfHeat: DECOUPLED (radEmission field). Uranium keeps
  its Stage A radiation (0.5) while its selfHeat is the real 0.05.
  Flip: delete radEmission and re-tie emission to selfHeat in sim.js —
  uranium would go ~10x dimmer.
- Gas identity: PROPANE (ignite 470 °C, comment on the row). Flip:
  methane 537 °C — but methane already exists as its own material.
  Sam may also want the palette label renamed to "Propane".
- Titanium: Ti-6Al-4V ALLOY (pressureTol 200). Flip: pure Ti 90
  (one-line change in materials.js).
- Uranium selfHeat 0.05 (real) makes uranium piles nearly inert
  thermally — accepted as written; it still radiates. Flip: raise
  selfHeat for playability (one line).
- Open (not decided): molten radioactives don't decay while liquid
  (they freeze back to powders, which decay); new molten colours and
  densities/k are estimates from sibling-molten ratios, not measured
  liquid Po/Pu/U data; air density 0.1 kept (research proposed 0.05,
  not applied — it would change buoyancy feel everywhere).

## How to run each preset
- Library button in the top bar → pick a preset (Furnace Test, I4 Engine + Turbo,
  Rocket, Turbofan, Turbine Demo). Presets are in `js/presets.js`.
- **Furnace Test** — sealed steel chamber, fuel + gunpowder. Light it
  (Ignite tool) and watch pressure climb.
- **I4 Engine + Turbo** — four chambers fire 1-3-4-2, one firing per 15
  ticks; exhaust spools the turbo, compressor pressurises the intake.
  No pistons/crankshaft — chambers ARE the cylinders; firing order and
  turbo spool are real, the crank motion is not modelled.
- **Rocket** — RP-1 + LOX tanks drain as it burns; bell nozzle below the
  chamber. Thrust readout in the FPS line (~7.8 kN peak, ~2.2 kN sustained).
  Tanks are glass so the falling level is visible.
- **Turbofan** — fan + bypass duct around a compressor-burner-turbine
  core; twin nozzles. Core nozzle carries the thrust (~5 kN); the bypass
  nozzle reads 0 N because bypass air is cool and the thrust model is
  hot-gas isentropic — fan thrust shows as bypass airflow instead.
- **Turbine Demo** — paddle-wheel turbine in a duct, driven by wind.
- Clear stops the active preset (button goes back to plain "Library").
