# conductor-test-app

A tiny, dependency-free static site explaining the **Conductor** platform's
change pipeline.

## Contents

- `index.html` — the page, with a section for each pipeline stage.
- `styles.css` — styling, no framework.
- `pipeline.js` — an ES module modelling the pipeline stages and their gate
  rules. Imported by both the page and the tests.
- `test/pipeline.test.js` — unit tests.

## The pipeline

Spec Gate → Build → Advisory Review → Execution Gate → Merge Gate → Promote

Every stage is a blocking **gate** except **Advisory Review**, which only
surfaces non-blocking guidance.

## Develop

No build step and no dependencies.

- View the site: open `index.html` in a browser (or serve the folder, e.g.
  `python3 -m http.server`).
- Run the tests: `node --test`
