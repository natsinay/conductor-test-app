# conductor-test-app

A tiny, dependency-free static site explaining the **Conductor** platform's
change pipeline.

## Contents

- `index.html` — the page, with a section for each pipeline stage.
- `styles.css` — styling, no framework.
- `pipeline.js` — an ES module modelling the pipeline stages and their gate
  rules. Imported by the tests.
- `test/pipeline.test.js` — unit tests.

## The pipeline

Spec Gate → Build → Advisory Review → Execution Gate → Merge Gate → Promote

Every stage is a blocking **gate** except **Advisory Review**, which only
surfaces non-blocking guidance.

## Develop

No build step and no dependencies.

### View the site

You can open `index.html` directly in your browser — it works with the
`file://` protocol. The JavaScript is embedded inline to avoid CORS issues
with local files.

Alternatively, serve the folder with any static server, e.g.:

```
python3 -m http.server
npx serve .
```

### Run the tests

```
node --test
```

The tests import `pipeline.js` directly and verify the pipeline logic.
