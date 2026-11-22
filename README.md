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

## Next stages

- **Stage 2 (continued):** thrust — a measurable push from exhaust
  (needs something to push; lands with moving parts), Pump device,
  Airstream (steady duct flow, alongside Wind)
- **Stage 3 — moving parts:** bearings, locked pivots, rotating assemblies
  (a fan shape with a locked centre spins when airflow hits it)
