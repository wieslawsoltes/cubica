# Vendored cube.js

Source: https://github.com/ldez/cubejs

Pinned upstream commit: `6b3da493894d9aed54f4c8aafccadbe676e745b5`.

`cube.js` and `solve.js` are the unmodified compiled JavaScript files from that
revision. The accompanying `LICENSE` preserves the original MIT license and
copyright notice. `UPSTREAM.md` is the upstream README.

Cubica uses these files only inside its dedicated solver worker. Cube rendering,
the NxN geometric state model, notation parser, import validation, lessons,
graphs, and interface are separate modules. The two-phase solver handles 3×3
positions; 2×2 positions use a validated corner embedding in a 3×3. Solutions
are independently checked against Cubica's geometric model before playback.

Solutions are short, but are not guaranteed to be optimal. The practice
scrambler generates random move sequences; it is not an official WCA
random-state scrambler.
