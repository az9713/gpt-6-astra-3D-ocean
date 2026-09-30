# Ocean 3D field guide

Read [How code becomes ocean](https://az9713.github.io/gpt-6-astra-3D-ocean/learn/) for the actual stack, wave geometry, normals, reflection, foam, weather, underwater effects, and limitations. The page introduces terms before using them and keeps extra math in expandable sections.

`learn/template.html` is the authored page. `learn/style.css` supplies its responsive layout; `learn/lab.js` runs two small teaching experiments without loading Three.js or the ocean renderer. Both lessons start still. The wave experiment can animate only after a deliberate click; reduced-motion preference disables continuous animation while retaining manual stepping. The text, source excerpts, links and static diagram remain available without JavaScript.

Run `npm run build` to generate and validate the guide, then bundle all three pages. `scripts/build-guide.mjs` extracts seven excerpts from the actual source, records their line ranges in `learn/snippets.json`, and populates the first three wave definitions in the simplified diagram. Edit the template rather than the generated `learn/index.html`. During GitHub Actions builds, excerpt links use the exact `GITHUB_SHA`; local builds use `main`.

`scripts/check-guide.mjs` checks the extracted code, package versions, geometry and effect counts, lesson wave parameters, and teaching-example labels. All 18 source checks run as part of every build. `scripts/guide-smoke.js` is a Playwright CLI `run-code` function:

```powershell
playwright-cli -s=guide-review open https://az9713.github.io/gpt-6-astra-3D-ocean/learn/ --browser chrome
playwright-cli -s=guide-review run-code (Get-Content scripts/guide-smoke.js -Raw)
```

The saved [local verification](guide-verification.json) identifies the pre-commit working tree by source blob identifiers and keeps actual run timestamps. The production preview passed 44 guide checks and the existing 17-check game/journey suite. The unchanged controls also passed their 73-check suite on the development server. An earlier game-suite attempt on that development server passed 16 checks and failed the production `/assets/` expectation; its correct production-preview rerun passed all 17. This was a test-environment mismatch, not an application fix.

The guide suite covers desktop, 390 x 844 and 320 x 568 portrait, 844 x 390 landscape, keyboard input, manual and continuous animation, reset, reflection-angle changes, reduced motion, collapsed mobile navigation, links, images, source excerpts and the no-JavaScript reading fallback. Actual screenshots: [desktop](screenshots/guide-desktop.png), [mobile lesson](screenshots/guide-mobile-lesson.png).

These are desktop-browser viewport and preference emulations. Physical mobile devices, Safari and assistive-technology user testing are not claimed. This guide adds no runtime dependency and changes no game rendering or control source. The original prompt and legal notices are preserved.
