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

## Next stages

- **Stage 2 — engines:** combustion chambers, nozzles, thrust, airflow
- **Stage 3 — moving parts:** bearings, locked pivots, rotating assemblies
  (a fan shape with a locked centre spins when airflow hits it)
