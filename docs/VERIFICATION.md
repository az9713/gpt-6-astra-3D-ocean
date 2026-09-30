# Verification and limits

## Local implementation evidence — 2026-09-30

The local browser suite passed 27 checks covering the scene presets, slider extremes, switches, help, audio gestures, camera movement, pause/resume, underwater view, 72-second tour handoff, irregular QA time steps, finite state at simulation time 100000 seconds, and layouts at 1152×720, 844×390 and 390×844. Final local checks reported zero uncaught browser errors; the final console review reported zero errors and warnings.

Actual production output was served and checked locally. A separate GPT-6 Astra agent at xhigh inspected source and screenshots. It found no remaining execution blocker after fixes, but described clouds, water highlights, fish, light shafts, and yacht dynamics as visibly procedural. This was an independent automated review, not a human assessment or realism certification.

The curated screenshots in `public/media/` are actual browser renders. Private reference material, desktop captures, local paths, and tool transcripts are not part of the public repository.

## Performance measurement

The primary sample ran Storm, cinematic camera, yacht, rain and natural lightning for 45.006 seconds after two seconds of warmup. Environment: Windows, Headless Chrome 154, NVIDIA GeForce RTX 3050 Laptop GPU, ANGLE Direct3D11, 1600×1000 viewport, DPR 1.

| Metric | Result |
| --- | ---: |
| Frames | 5257 |
| Mean cadence | 116.81 FPS |
| Slowest one-second interval | 108.26 FPS |
| Median / p95 / p99 frame interval | 7.0 / 14.0 / 14.1 ms |
| Maximum interval | 14.6 ms |
| Frames over 33.34 ms | 0 |

These are requestAnimationFrame cadence measurements, not GPU timestamps. The slowest one-second bucket is not a statistical 1% low. Geometry and texture counts stayed constant, which is useful but does not establish long-term memory stability. Three-second per-mode measurements were only spot checks.

Later, native Windows screen capture confirmed the app in a normal Chrome window and a real mouse click changed Open sea to Storm. The visible HUD showed about 60 FPS in the opening screenshot and 53 FPS in the storm screenshot. Those brief readings used different conditions and are not a sustained benchmark. No claim of 116 FPS in a normal visible browser is made.

## Reproduce useful checks

After `npm ci`, run `npm run build`, then `npm run preview -- --port 4174`. Open the preview in a browser with WebGL 2. Confirm a rendered ocean, use the Storm and Below controls, move in Fly, pause and resume, and inspect browser console/network errors. Test the actual public URL too; local success does not establish repository-subpath asset loading.

The public smoke-test script `scripts/browser-smoke.js` is a Playwright CLI `run-code` function. It accepts the page's current URL, checks real controls and the journey, and returns structured results. Run it with an installed Playwright CLI after opening the deployed app:

```powershell
playwright-cli -s=ocean-review open https://az9713.github.io/gpt-6-astra-3D-ocean/ --browser chrome
playwright-cli -s=ocean-review run-code (Get-Content scripts/browser-smoke.js -Raw)
```

For a fixed scene from browser developer tools:

```js
oceanQA.setScene({preset:'storm', view:'sail', paused:true, simulationTime:12});
oceanQA.setView('underwater');
oceanQA.step(0.1); // bounded even if a larger value is requested
oceanQA.diagnostics();
```

The local interaction summary and sanitized sustained sample are in `docs/local-evidence.json`. They contain selected structured measurements rather than raw tool output. Actual published-page screenshots are in `docs/screenshots/`.

## Publication evidence and exact revisions

[`deployment-verification.json`](deployment-verification.json) preserves both saved browser results, including their original timestamps, individual checks, asset URLs, and actual tested revisions.

| Saved browser run | UTC timestamp | Tested revision | Result |
| --- | --- | --- | --- |
| Initial public deployment | 2026-09-30T15:53:39.21Z | `000eb0004d9a6e821a53d5e721d2ce23ecd1ee9c` | 16 passed, 0 failed |
| Final publication browser run | 2026-09-30T16:55:09.555Z | `cdc79f8790e54bdc525202c7a5cf0b9ec3e3da4b` | 17 passed, 0 failed |

The final run adds the corrected article screenshot-link check. It used the deployed Vite 7.3.5 build and recorded the `index-ByEaCVBL.js` and `three-C0Kx9dIa.js` assets. Both runs reported no browser errors or failed requests.

Commit `775fbd48136b00893a8ea4f92dea3eeaf430b66f` subsequently preserved the original `README.txt` line endings. Its diff from the final tested revision changes only that prompt file. Its Pages workflow succeeded, and later HTTP checks confirmed the game and journey returned 200, but the 17-check browser suite was **not rerun against that exact commit**. Likewise, a later evidence-only commit does not become the tested revision merely because it stores these results. Workflow success, HTTP checks, and browser interaction checks are separate evidence.

## Known gaps

No sustained visible-browser benchmark, broad GPU/browser matrix, physical mobile thermal test, hours-long soak, keyboard-equivalent touch flight, full main-scene reduced-motion mode, or user study of photographic realism has been completed. The analytic wave field is not CFD. There is no proven visual superiority over another model's scene. Hosting availability and account permissions can change independently of the code.
