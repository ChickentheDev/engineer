# Engineer

A voxel sandbox game about engines — rocket engines, turbofans, and the
materials they are built from. Powder Toy-style cellular simulation, with
real heat and pressure fields and materials that melt, burn, or shatter
when you push them past their tolerances.

Play it in the browser: open `Index.html` (or GitHub Pages once enabled).
No build step, no dependencies — plain canvas + JavaScript.

## v0.1 (Stage 1)

- Grid sim: 200×120 cells, powders fall, liquids flow, gases rise
- Heat: conduction between neighbours, ambient cooling, hot materials glow
- Pressure: a diffusing pressure field; combustion and explosions raise it
- Materials with heat tolerance, pressure tolerance, conductivity, density:
  Wall, Steel, Molten Steel, Copper, Molten Copper, Ceramic, Debris, Sand,
  Molten Glass, Water, Steam, Fuel, Wood, Ash, Ice, Fire, Smoke, Gunpowder
- Tools: paint, heat, cool, ignite, erase; brush size; Normal / Temperature /
  Pressure views; pause; clear; "Furnace test" preset
- Layout: the sandbox fills the whole screen with a menu on the left —
  Solids / Powders / Liquids / Gases categories (hover or tap to see the
  materials), tools, views and controls below. On phones there is no menu
  button: the four categories are buttons at the bottom left, tapping one
  pops its materials up in a strip above, and brush size is − / + buttons
  right next to them. The grid is 800×450 landscape / 450×800 portrait
  (canvas backing 1600×900 / 900×1600), and the sim skips idle air cells
  in its hot loops so it runs faster than the old 200×120 grid did.
- Smoke and gases move randomly (diagonal rise + sideways diffusion
  through other gases) instead of stacking into straight lines.
- Paint only fills empty space (air) or transient gas (fire, smoke,
  steam) — painting over something you built no longer removes it;
  use Erase to clear a material first.
- Mobile: touch painting, 44px touch targets, 2x canvas zoom for precise
  finger painting; play it at https://chickenthedev.github.io/engineer/

## Next stages

- **Stage 2 — engines:** combustion chambers, nozzles, thrust, airflow
- **Stage 3 — moving parts:** bearings, locked pivots, rotating assemblies
  (a fan shape with a locked centre spins when airflow hits it)
