# CoastFIRE Matrix

An interactive calculator that reframes CoastFIRE as a **spectrum of balance targets** rather than a single age or number.

Most CoastFIRE calculators answer one question: "Have I hit my coast number yet?" This tool instead shows a full matrix: for every age you might stop contributing (**coast age**) and every age you might fully retire (**retirement age**), what balance you'd need at the coast age to grow, untouched and with no further contributions, into a horizon-adjusted FI number by the retirement age. Each cell is shaded by how much of that requirement your projected balance covers, so you can see where your plan is ahead, close, or short.

The underlying idea: CoastFIRE isn't really about hitting one age. It's about hitting one *balance*, at whatever age you get there, so that from that point on you no longer need to contribute. You could stop entirely, or take a lower-paying, lower-stress job that only covers your annual spend, and still retire on schedule.

**Live app:** [coastfirematrix.pages.dev](https://coastfirematrix.pages.dev/)

---

## What you see

- **Headline.** "Coast now, retire by" and an age: the earliest retirement age your current balance would cover if you stopped contributing today. It shows "—" when no age through 62 clears. Beneath it, a **Full FIRE target** gives a flat reference figure (see [Methodology](#methodology)).
- **Your numbers.** All the inputs, in one panel.
- **Inspector, legend, and matrix.** Point at any cell to see the scenario behind it; the legend explains the shading.

On a wide screen the inputs scroll on the left while the inspector, legend, and matrix stay in view on the right. On a phone everything stacks in one column: headline, inputs, inspector, legend, matrix, notes.

---

## How to read the matrix

- **Rows** are coast ages: the age you might stop contributing.
- **Columns** are retirement ages: the age you want to be fully financially independent.
- Both axes run from your current age through 62.
- Each **cell** shows the balance you'd need to be holding at that coast age to grow, untouched, into that column's FI number by that retirement age.
- Blank cells mean the retirement age comes before the coast age, which isn't possible.
- Each row also shows a small **"proj."** figure: your current balance plus your annual contributions, both compounded forward to that coast age. This is what gets compared against the required balance in every cell of that row.
- The small percentage under each retirement-age header is that column's effective safe withdrawal rate, shown when horizon adjustment is on (see [Methodology](#methodology)).

### The heatmap

Each cell is shaded by its **coverage**: your projected balance at that coast age divided by the balance the cell requires.

| Coverage | Shading |
|---|---|
| 150% or more | deepest green |
| 125–150% | mid green |
| 100–125% | light green |
| 90–100% | light orange, dashed border |
| under 90% | deeper orange, dashed border |

At or above 100% your projected balance covers the requirement; below it, it falls short. Shortfall cells have dashed borders, so the 100% line doesn't depend on color alone. Coverage is rounded down, so a cell never reads 100% while it is still short.

### Markers

- The **"you"** pill and green bar mark your current-age row.
- The **dot** marks the cell that the headline age lands on: your row, at the "coast now" retirement age. It disappears when nothing clears.

---

## Inspecting a scenario

The **inspector** above the matrix shows the required balance, projected balance, surplus or shortfall, and coverage for one scenario at a time. It follows this order:

1. the cell under your mouse ("Previewing"),
2. the cell you've navigated to with the keyboard ("Previewing"),
3. the cell you've pinned ("Selected scenario"),
4. otherwise your coast-now scenario (or, if nothing clears, the latest retirement age shown).

**Click, tap, or press Enter/Space** on a cell to pin it. Unpin by clicking it again, pressing **Esc** while the matrix has focus, or pinning a different cell. When your mouse leaves the matrix, the inspector returns to the pinned cell, so you can move over and select its text.

**Keyboard:** Tab enters the matrix once; arrow keys move between cells (skipping blank ones); Home and End jump to the start and end of a row; Enter or Space pins; Esc unpins.

---

## Inputs

All inputs live in the **Your numbers** panel. Numeric fields accept free typing and clamp to their range when you leave the field or press Enter. A **?** button beside the two sliders explains them; open it by hover, click, tap, or Enter, and close it with Esc or by clicking elsewhere.

| Input | What it means | Default | Range |
|---|---|---|---|
| **Current age** | Your age today. The matrix starts here, and this row is marked "you". | 40 | 18–62 |
| **Current investment balance** | Your liquid investment balance today: retirement and brokerage accounts. Deliberately excludes home equity (see [Methodology](#methodology)). | $1,000,000 | $0 and up |
| **Annual contributions until coast** | How much you invest per year until you coast. Held flat and added at year end. Makes the matrix contribution-aware rather than a static snapshot. | $24,500 | $0 and up |
| **Annual retirement spend** | Your expected yearly spending in retirement, in today's dollars. Relabeled "(excl. mortgage)" when the mortgage option is on. | $60,000 | $0 and up |
| **Safe withdrawal rate** | The baseline rate, anchored to a 30-year retirement. | 4% | 1–10% |
| **Real rate of return** | Annual investment growth after inflation, so every figure is in today's dollars. | 7% | 0–12% |
| **Adjust safe withdrawal rate for retirement length?** | Scales the withdrawal rate to how long each retirement needs to last. | On | |
| **Life expectancy** (shown when adjusting) | Sets how long each retirement age needs to last. | 90 | 70–105 |
| **Account for mortgage payoff?** | Adds a temporary mortgage bridge to the FI numbers. | Off | |
| **Monthly mortgage payment** (shown when on) | The only monthly input; everything else is annual. | $2,000 | $0 and up |
| **Age at payoff** (shown when on) | The age your mortgage is paid off. | 55 | 18–100 |

---

## Methodology

**Balance target, not age target.** The matrix exists because CoastFIRE is fundamentally about reaching a balance, not a birthday. The same logic that tells you when you can stop contributing also tells you when a lower-stress, lower-paying job that just covers your spend becomes viable.

**Required balance.** For each retirement age the tool computes an FI number. The balance required at a coast age is that FI number discounted back to the coast age at your real rate of return: `FI number ÷ (1 + r)^(retirement age − coast age)`.

**Horizon-adjusted safe withdrawal rate.** A flat safe withdrawal rate anchored to a 30-year horizon overstates what early retirement can sustain (it needs a lower rate to survive a longer horizon) and understates what later retirement can tolerate (a higher rate over a shorter horizon). With adjustment on, each retirement age's horizon is `life expectancy − retirement age`, and its effective rate is your rate times a multiplier from a curve that equals 1.00 at 30 years. The curve approximates published research on how safe withdrawal rates shift with horizon length (in the spirit of Kitces/ERN-style analysis). It's an approximation, not a precise formula; each column shows its own effective rate so you can see exactly what's applied. With adjustment off, your rate is applied flat to every age.

<details>
<summary>The multiplier curve</summary>

Values between points are interpolated linearly; horizons beyond the ends use the end values.

| Horizon (years) | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Multiplier | 1.10 | 1.00 | 0.92 | 0.87 | 0.82 | 0.79 | 0.77 | 0.75 | 0.74 | 0.73 | 0.715 | 0.705 |

</details>

**Mortgage payoff.** With the option on, retirement spend splits into a permanent floor (your spend excluding the mortgage, which drives the withdrawal-rate math) and a temporary bridge: your annualized mortgage payment, funded only from the retirement age until the payoff age. The bridge isn't drawn at the safe withdrawal rate. It's a fixed-length obligation, valued as the present value of those payments at your real rate of return. Retirement ages at or past the payoff age carry no bridge.

**Contribution-aware projections.** Rather than comparing your balance today against every cell, each row projects what your balance would be at that coast age: current balance plus contributions, both compounded forward at your real rate of return. At your current age, the projection is simply your current balance.

**The headline.** Reading across your current-age row from the left, the headline is the first retirement age whose requirement your current balance already covers. That is the "coast now" answer.

**Full FIRE target.** Annual spend divided by your safe withdrawal rate (plus 12 months of mortgage payment if that option is on, treated as a permanent expense). It uses no horizon adjustment and no mortgage bridge, so it is a flat reference point, not a number from the matrix. With horizon adjustment on and the mortgage option off, it equals the matrix's FI number only for the retirement age whose horizon is 30 years; earlier ages require more than this figure, and later ones slightly less.

**What's excluded from the numbers:**
- **Education costs** are excluded from annual retirement spend.
- **Home equity** is excluded from investment balance. It's illiquid, and including it without netting out the ongoing housing obligation it corresponds to would overstate readiness.

**Not modeled:** taxes; Social Security, pensions, or other income; growth in your contributions over time; market volatility and sequence-of-returns risk beyond what the withdrawal-rate adjustment approximates (returns are a single fixed real rate).

> This is an educational planning tool, not financial advice. Its results depend on the assumptions you enter and on a simplified model.

---

## Accessibility

Accessibility is a feature, not an afterthought:

- Fully operable by keyboard, with a visible focus ring.
- The matrix uses ARIA grid semantics and a single tab stop with arrow-key movement.
- Every cell's accessible label includes its required balance, projected balance, and coverage.
- Pinning or unpinning a scenario is announced to screen readers. Hover and arrow-key movement are not, since a focused cell already reads its own label.
- Shortfall is conveyed by dashed borders and the coverage figure, not by color alone. Text on every shading band meets a contrast ratio of at least 4.5:1.
- Hover and touch show the same information: nothing depends on hovering.

---

## Running locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Output goes to `dist/`, ready for static hosting. `npm run preview` serves the built output locally.

## Project structure

- `src/CoastFireMatrix.jsx` is the whole app: the component, the math, and the styles.
- `src/main.jsx` mounts it.

## Tech stack

- React 19
- Vite 8
- No backend. Everything computes client-side from the inputs above; the app makes no network requests and stores nothing.

## License

GPL-3.0. See [LICENSE](./LICENSE).
