# Engineer

A voxel sandbox game about engines — rocket engines, turbofans, and the
materials they are built from. Powder Toy-style cellular simulation, with
real heat and pressure fields and materials that melt, burn, or shatter
when you push them past their tolerances.

Play it in the browser: open `Index.html` (or GitHub Pages once enabled).
No build step, no dependencies — plain canvas + JavaScript.

## v0.1 (Stage 1)

- Grid sim: 800×450 landscape / 450×800 portrait (canvas backing
  1600×900 / 900×1600), powders fall, liquids flow, gases rise
- Heat: conduction between neighbours, ambient cooling (toggleable),
  hot materials glow
- Pressure: a diffusing pressure field; combustion and explosions raise it
- Materials with heat tolerance, pressure tolerance, conductivity, density:
  Wall, Steel, Molten Steel, Copper, Molten Copper, Ceramic, Debris, Sand,
  Molten Glass, Water, Steam, Fuel, Wood, Ash, Ice, Fire, Smoke, Gunpowder
  (19 total, 18 paintable + Air)
- Tools: paint, heat, cool, ignite, erase; rect and line tools; brush
  size cycler; Normal / Temperature / Pressure views; ambient-heat and
  grid-overlay toggles; FPS counter; pause; clear; "Furnace test" preset
- Left and right materials: click a material to paint with the left
  button, long-press or right-click to set the right button's material
  (red border = left, blue border = right)
- Layout (Powder Toy style): the sandbox fills the screen with an icon
  sidebar on the right — Solids / Powders / Liquids / Gases / Tools
  (tap to see the materials in the strip below), a top bar for the view
  switcher, ambient heat and grid overlay, and a bottom icon bar for
  clear, furnace, brush size, rect, line and pause. On phones the
  sidebar collapses to icons only. The sim skips idle air cells in its
  hot loops so it runs faster than the old 200×120 grid did.
- Smoke and gases move randomly (diagonal rise + sideways diffusion
  through other gases) instead of stacking into straight lines.
- Paint only fills empty space (air) or transient gas (fire, smoke,
  steam) — painting over something you built no longer removes it;
  use Erase to clear a material first.
- Mobile: touch painting; play it at https://chickenthedev.github.io/engineer/

## v0.2 — materials expansion

- 32 new materials (51 total, 50 paintable + Air):
  Iron, Molten Iron, Tungsten, Molten Tungsten, Gold, Molten Gold,
  Titanium, Molten Titanium, Bronze, Molten Bronze, Cobalt, Molten Cobalt,
  Quartz (melts to Molten Glass), Glass, Insulation, Graphite,
  Titanium Carbide, Tungsten Carbide, Plutonium, Uranium, Polonium,
  Deuterium, Liquid Nitrogen, Nitrogen, Liquid Oxygen, Oxygen,
  Liquid Helium, Helium, Methane, Diesel, Gas, Toxic Gas
- Radioactive powders (Plutonium, Uranium, Polonium) heat themselves;
  cryo liquids (Liquid Nitrogen / Oxygen / Helium) boil far below zero
  into their gases, which condense back when cooled enough
- New categories: Solids 18, Powders 7, Liquids 15, Gases 10

## Stage 2 — engines (in progress)

- **Airflow:** a strong pressure gradient now shoves loose material
  (powders, liquids, gases) toward lower pressure — explosions blow
  debris downwind, combustion chambers vent through their openings
- **Oxygen combustion:** fire next to Oxygen burns at 1200°C and
  pressurises harder; the oxygen is consumed into Exhaust gas, which
  cools into Smoke
- **Wind:** a paintable gas that flows in the global wind direction
  (bottom-bar arrow button cycles → ↓ ← ↑); wind pressurises the air
  ahead of it, pushing loose material downwind. Fades after a while
- **Devices:** Nozzle (heat-proof engine block for chambers and
  nozzles) and Vac (vacuum block — eats adjacent gas, pulls local
  pressure negative, so it sucks loose material toward it)

## Overnight — radiation, compression, rocket fuel, bell nozzle, rotors

- **Radiation:** Plutonium/Uranium/Polonium emit a radiation field
  (new Radiation view, green; Rad readout in the cursor info). The field
  diffuses through air, is absorbed as heat by dense materials, and is
  blocked by shielding — Lead (new, melts 327°C) is the best shield.
  Radioactive cells spit neutrons, which zip around heating what they
  touch and beta-decay into protons + electrons. Piles decay over
  minutes (Polonium → Lead, Uranium → Polonium, Plutonium → Uranium);
  real half-lives are far too long to watch, so game decay is compressed
  ~1000x. Neutrons/protons/electrons come from decay only — not paintable.
- **Compression:** squeezing a gas heats it, expanding it cools it
  (adiabatic, T ∝ P^0.286, ambient = 10 units = 1 atm). A compressor
  heats intake air; a nozzle bell cools exhaust. One real bug found by
  testing: pressure history must travel with a material when it swaps
  cells, or moving gas reads phantom pressure jumps and heats/cools by
  hundreds of degrees — fixed in sSwap/sSet.
- **Rocket fuel:** RP-1 (rocket kerosene) and Liquid Hydrogen (boils
  at -253°C into Hydrogen gas, the lightest gas in the game). Burning
  any fuel next to liquid oxygen runs at ~3000°C (hydrogen/oxygen
  ~3200°C) with a much bigger pressure spike — that is what makes
  RP-1/LOX and LH2/LOX chambers work. Ordinary oxygen-gas burning
  stays at 1200°C.
- **Bell nozzle + thrust:** a registered nozzle (chamber, throat,
  exit, direction) computes thrust from real isentropic relations in
  SI units (1 cell = 0.1 m): flow chokes at the throat (Mach 1),
  expands supersonically in the bell (exit Mach ~2.6 for an 8:2 bell),
  and ambient pressure decides over/under-expansion — a wide bell at
  sea level is over-expanded and loses pressure thrust. Thrust scales
  with chamber pressure; a blocked throat gives zero thrust. The
  exhaust plume is shoved down the bell (up to 2 cells/tick) so it
  visibly accelerates. Thrust readout in the FPS line (kN) while an
  engine fires. Player-built nozzles still flow gas through pressure,
  but only registered nozzles (presets) get a thrust meter.
- **Rotors:** paint a **Bearing** (Devices) and put solids against it
  — they bind into a wheel that spins on pressure and liquid weight
  (a paddle wheel / turbine / fan). Torque comes from pressure and
  hydrostatic push on the exposed blade faces; moving blades push air
  ahead of them and suck it in behind, so a spinning fan actually
  moves air. The demo turbine (`sDemoTurbine`, Library → Turbine Demo)
  is a steel paddle wheel in a duct with a steady wind feed on its
  upper half — a symmetric feed gives zero net torque, so only the
  top half is driven. Erasing a bearing or a blade kills that rotor
  (the next bind pass rebinds whatever is left). A blade that melts or
  burns breaks its rotor the same way.
- **Presets library (top-bar Library button):** five ready-made sims
  that actually run — **Furnace Test** (sealed chamber, light it and
  watch pressure climb), **I4 Engine + Turbo** (four chambers fire
  1-3-4-2, exhaust spools a turbo that pressurises the intake),
  **Rocket** (RP-1 + LOX tanks drain as it burns, ~7.8 kN peak thrust),
  **Turbofan** (fan + bypass duct around a compressor-burner-turbine
  core, twin nozzles), **Turbine Demo**. Honest limit: no
  pistons/crankshaft — the sim has no linear moving parts, so the I4's
  chambers ARE the cylinders and the firing order + turbo spool are
  real while the crank motion is not modelled. Clear stops the active
  preset.
- **Real-world tolerances (Stage E):** every material's conductivity,
  pressure tolerance, melt/freeze point, density and ignition point
  was checked against real data and corrected where it was wrong —
  gold no longer out-conducts copper (it never did in real life),
  ceramic conducts ~5× faster than the old value, steam is now
  lighter than nitrogen and oxygen so it sorts above them, molten
  metals freeze ~10 °C below their melt point. Three new molten
  radioactives (Molten Polonium, Molten Plutonium, Molten Uranium;
  67 materials total) — a polonium pile now self-heats past its own
  254 °C melt point with no outside heat. Bug fix: molten glass
  used to freeze into sand; it freezes into glass now. Radiation is
  now a separate property from self-heating (radEmission): uranium
  barely self-heats in real life (0.05 °C/tick) but is still a strong
  radiation source. Gas is propane (LPG, ignites 470 °C); titanium
  is the Ti-6Al-4V alloy.

## Next stages

- **Devices:** Pump, Airstream (steady duct flow, alongside Wind)
- **Electrical system:** conductivity, Batt/Spark, logic gates,
  IC designer + processor design
