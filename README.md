# esun-asset-management-game

玉山亞資服務配對挑戰 — a 1920 × 1080 touchscreen puzzle with opening, gameplay, and completion screens.

The playable game is in `game/dist/`. GitHub Pages publishes that directory without changing or rebuilding its content. The original artwork and design references are preserved at the project root.

## Local preview

```sh
cd game
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173/.

## Future updates

Edit `game/dist/js/config.js` for text, shapes, positions, and matching relationships. See `game/README.md` for the full editing guide.

From the project root:

```sh
git add game/dist
git commit -m "Update puzzle game"
git push
```

Each push to `main` automatically publishes the current `game/dist/` through `.github/workflows/pages.yml`. Pages must use **GitHub Actions** as its publishing source.

The public repository contains the game's source and supplied artwork; no additional license is granted for brand assets.
