# 玉山亞資服務配對挑戰

A local, dependency-free touchscreen puzzle. All three screens live in `dist/index.html`.

## Run

From this `game` directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. The start button requests browser fullscreen; Esc exits fullscreen. For an exhibition, use the browser's kiosk/fullscreen launch mode so the opening screen also fills the display. No hosting, accounts, or internet are required.

## Edit

- **`dist/js/config.js`** is the single configuration section: all wording, five target IDs, eight pieces, SVG paths, sizes, positions, theme, artwork paths, and interaction settings.
- **`dist/styles.css`** controls typography, surfaces, shadows, and feedback.
- **`dist/js/game.js`** controls screen transitions, pointer/tap input, matching, snapping, and reset.
- **`dist/assets/`** contains local artwork copies. Original reference files in the parent directory are unchanged.

Coordinates use a 1920 × 1080 stage, uniformly scaled and centered in the viewport. Other aspect ratios show margins rather than distorting shapes. Correct pieces inherit their target's shape and dimensions automatically; edit the target once to change both. Change a piece's `x` and `y` to move its starting location. IDs determine matching, independently of text. Each description is an array of editable lines.

Drag with mouse or touch, or tap a piece and then its target. Enter/Space selects a focused piece; activate its target to attempt a match. Only one drag is active at a time. Correct pieces lock, missed drops return, and cancelled drags return safely. After five matches, completion opens automatically. Returning home clears every match and pending transition.

The logo is a CSS/SVG-filtered crop of the supplied reference image, preserving the supplied brand design. Replace `CONFIG.assets.brand` and the `.brand img` crop styling with an official standalone logo when available. The transparent mascot is a derived imagegen cutout; its original JPG is preserved.

Mascot asset prompt (built-in imagegen): Remove only the exterior white background; preserve the black bear character, white facial details, hands/pose, tiny puff, proportions, expression, and colors. Output transparent PNG.

For touchscreen installation, verify physical readability and drop tolerance on the actual 43-inch panel. `behavior.snapTolerance` is measured in design pixels; `completionDelay` is in milliseconds. Set `fullscreenOnStart` to false for embedded previews.
