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

The local interaction summary and sanitized sustained sample are in `docs/local-evidence.json`. They contain selected structured measurements rather than raw tool output. Deployment verification will be recorded in `docs/deployment-verification.json` after the first live check, with the tested build SHA. Later documentation-only commits may have a different SHA.

## Known gaps

No sustained visible-browser benchmark, broad GPU/browser matrix, physical mobile thermal test, hours-long soak, keyboard-equivalent touch flight, full main-scene reduced-motion mode, or user study of photographic realism has been completed. The analytic wave field is not CFD. There is no proven visual superiority over another model's scene. Hosting availability and account permissions can change independently of the code.
