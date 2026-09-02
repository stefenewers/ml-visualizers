# ML Internals

**Five machine-learning algorithms, implemented from scratch in TypeScript and drawn on
canvas, so each one can be stepped through a single operation at a time.**

Live → **[ml-visualizers.vercel.app](https://ml-visualizers.vercel.app)**
· Case study → [stefenewers.com/projects/ml-visualizers](https://www.stefenewers.com/projects/ml-visualizers)

Most explanations of an algorithm show two things: the formula, and the result. What sits
between them is the part that is actually hard. How does one iteration change the state?
What does raising the learning rate do to the path, rather than to the equation? This
makes that middle inspectable.

---

## The five

| Algorithm | Category | What one step shows |
| --- | --- | --- |
| **K-Means** | Unsupervised | Points reassign to the nearest centroid, then each centroid moves to the mean of what it caught. Convergence is the moment nothing reassigns. |
| **Linear Regression** | Supervised | The fitted line moves as parameters update and loss falls. Gradient descent becomes a line sliding toward the data. |
| **Decision Tree** | Supervised | Candidate splits are scored by Gini impurity before and after, and the winning split carves the space into regions. |
| **Neural Network** | Deep learning | A 3→4→2 network shows per-neuron activations on the forward pass, then error flowing backward through the weights. |
| **Gradient Descent** | Optimization | Plain descent and momentum descend the same non-convex surface side by side, with the learning rate exposed. One stalls; the other carries velocity through. |

## Why the algorithms are implemented directly

Every algorithm is written in TypeScript rather than wrapped around a library, because
the product needs the intermediate state. A library exposes `fit()` and `predict()` and
treats everything between them as a private detail. That detail is the entire subject
here: which activations fired, which split won, where the descent stalled and at what
coordinate.

## Interaction model

One grammar across all five: **play**, **step**, **reset**, and **speed**. Only the
parameter changes, `k` for clustering, learning rate for descent. Learning the controls
once is the point.

`step` is a first-class control rather than a debug affordance. Autoplay shows the shape
of a process; stepping is what connects one operation to one visible change and one line
in the log. It is disabled while playing rather than fighting it.

Explanation is layered. A short insight panel sits beside the canvas describing the state
on screen right now; a longer explainer waits below the fold. Someone watching centroids
move should not have to scroll past theory to keep watching.

## Architecture

```
app/
  layout.tsx, page.tsx        # shell, theme, sidebar routing
components/
  Controls.tsx                # play / step / reset / speed, shared by all five
  TerminalLog.tsx             # the text narration of each operation
  InsightBox.tsx              # state-specific explanation beside the canvas
  ExplainerPanel.tsx          # long-form explainer below the fold
  Sidebar.tsx, Header.tsx     # navigation, theme toggle
  algorithms/
    KMeansViz.tsx             # per-algorithm state machine + canvas drawing
    LinearRegressionViz.tsx
    DecisionTreeViz.tsx
    NeuralNetworkViz.tsx
    GradientDescentViz.tsx
lib/
  algorithms/
    kmeans.ts                 # pure algorithm core, no React, no canvas
    gradient-descent.ts       # loss surface, analytic gradient, optimiser steps
    *.test.ts                 # tests against those cores
  types.ts, explainers.ts
```

**Per-algorithm state, shared shell.** Each visualization owns its own state machine and
its own `stepAlgorithm(prev) → next` transition. Nothing is shared between them except
the controls, the log and the panels, because the interaction grammar is the only thing
they genuinely have in common.

**Canvas rather than a chart library.** These are per-frame states, not plotted series.
Drawing directly keeps the animation loop and the algorithm state in step, and avoids
fighting a charting abstraction that assumes a dataset rather than a process.

**Dynamic imports.** All five visualizations are dynamically imported and client-only, so
opening the app does not pay the cost of four experiences nobody has asked for yet.

**Extracted cores.** The K-Means and gradient-descent algorithms live in `lib/algorithms/`
as pure functions with no React and no canvas imports. They were inside the components,
which meant the only way to check that momentum actually carries through a stalled point
was to watch it. Now there are tests.

## Local setup

```bash
npm install
npm run dev        # http://localhost:3000
```

## Verification

```bash
npm run lint       # ESLint, Next config
npm run typecheck  # tsc --noEmit
npm test           # Vitest, 31 tests over the algorithm cores
npm run build      # production build
```

The tests cover the parts where being wrong is silent:

- **K-Means** — nearest-centroid assignment, centroid means, the empty-cluster case that
  would otherwise divide by zero, convergence when nothing reassigns, iteration counting,
  and that `stepAlgorithm` never mutates the state it was handed (the visualization keeps
  the previous state to animate from).
- **Gradient descent** — the analytic gradient checked against a numerical derivative of
  the loss surface, so editing the surface without updating the gradient fails the build;
  position clamping; trail bounds; the stuck detector; and that momentum keeps moving
  where plain descent stalls, which is the comparison the whole view exists to make.

## Known limitations

- **Canvas is weak ground for accessibility.** The drawn state is unavailable to a screen
  reader. The text logs carry some of it, but this needs real work rather than a note.
- **The datasets are small by design.** Forty points, a four-neuron hidden layer, a 2D
  surface. Real data would be more honest and would show nothing legible at this size.
- **Simplified cases hide edge cases.** Well-separated clusters converge cleanly.
  Overlapping ones, poor initialisation, and the failures that make these algorithms
  interesting are mostly out of frame.
- **Three of the five cores are still inside their components.** Linear regression,
  decision tree and neural network have not been extracted, so they are not under test.
  That is the next piece of work here.
- **It does not measure understanding.** Whether anyone comes away understanding these
  mechanics is unmeasured, and would need actual study rather than assertion.

## Deployment

Deployed on Vercel from `main`. Any Next.js host works; there is no server state, no
database and no API keys.

## License

MIT. See [LICENSE](LICENSE).

---

Built by [Stefen Ewers](https://www.stefenewers.com), a software engineer working across
TypeScript and Python.
