# CoastFIRE Matrix

An interactive calculator that reframes CoastFIRE as a **spectrum of balance targets** rather than a single age or number.

Most CoastFIRE calculators answer one question: "Have I hit my coast number yet?" This tool instead shows a full matrix — for every age you might stop contributing (**coast age**) and every age you might fully retire (**target age**), what investment balance you'd need at the coast age to grow — untouched, with no further contributions — into a horizon-adjusted FI number by the target age.

The underlying idea: CoastFIRE isn't really about hitting one age. It's about hitting one *balance*, at whatever age you get there, so that from that point on you no longer need to contribute — you could stop entirely, or take a lower-paying, lower-stress job that only covers your annual spend, and still retire on schedule.

**Live app:** [coastfirematrix.pages.dev/](https://coastfirematrix.pages.dev/)

---

## How to read the matrix

- **Rows** are coast ages — the age you might stop contributing.
- **Columns** are target ages — the age you want to be fully financially independent.
- Each **cell** is the balance you'd need to be holding at that coast age for it to grow, untouched, into that column's FI number by that target age.
- Each row also shows a small **"proj."** figure — your current balance plus your annual contributions, both compounded forward to that coast age. This is what actually gets compared against the required balance in every cell in that row.
- **Green cells** mean your projected balance at that coast age clears the requirement for that target age. **Orange/clay cells** mean it falls short.
- The row marked **•** is your current age.
- Blank cells mean the target age comes before the coast age, which isn't possible.
- The small percentage under each target-age column header is that column's horizon-adjusted effective safe withdrawal rate (see Methodology below).

---

## Inputs

### Your numbers
These are your personal facts — plug in your real situation.

| Input | What it means |
|---|---|
| **Current age** | Your age today. Sets the top-left starting point of the matrix and which row is marked as current. |
| **Current investment balance** | Your liquid investment balance today — retirement and brokerage accounts. Deliberately excludes home equity (see Methodology). |
| **Annual contributions until coast** | How much you're currently investing per year. Used to project your balance forward at each possible coast age — this is what makes the matrix contribution-aware rather than a static snapshot. |
| **Annual retirement spend** | Your expected annual spending in retirement, in today's dollars. Drives the FI number at every target age. |

### Model dials
These are tunable assumptions, not personal facts — adjust them to stress-test the plan.

| Input | What it means |
|---|---|
| **SWR anchor (30-yr horizon)** | Your safe withdrawal rate assumption, anchored to a standard 30-year retirement horizon (e.g., 4%). This is the baseline the horizon adjustment scales up or down from. |
| **Real rate of return** | Your assumed real (inflation-adjusted) annual investment growth rate, used to compound balances forward. |

The **anchor FI number** shown next to these dials is your spend divided by the SWR anchor, unadjusted — a quick reference point, not the number used for every column (those are horizon-adjusted individually).

---

## Methodology

**Balance target, not age target.** The matrix exists because CoastFIRE is fundamentally about reaching a balance, not a birthday. The same logic that tells you when you can stop contributing also tells you when a lower-stress, lower-paying job that just covers your spend becomes viable.

**Horizon-adjusted SWR.** A flat safe withdrawal rate anchored to a 30-year horizon overstates the FI number for early retirement (which needs a lower SWR to survive a longer horizon) and understates it for later retirement (which can tolerate a higher SWR over a shorter horizon). This tool applies a multiplier curve — anchored to your SWR input at the 30-year mark — that approximates published research on how safe withdrawal rates shift with horizon length (in the spirit of Kitces/ERN-style analysis). It's an approximation, not a precise formula; each column shows its own effective adjusted rate so you can see exactly what's being applied.

**Contribution-aware projections.** Rather than comparing your balance today against every cell, each row projects what your balance would actually be at that coast age — current balance plus contributions, both compounded forward — and compares that against the requirement.

**What's excluded from the numbers:**
- **Education costs** are excluded from annual retirement spend.
- **Home equity** is excluded from investment balance — it's illiquid, and including it without netting out the ongoing housing obligation it corresponds to would overstate readiness.

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

Output goes to `dist/`, ready for static hosting.

## Tech stack

- React 19
- Vite 8
- No backend — everything computes client-side from the inputs above

## License

GPL-3.0 — see [LICENSE](./LICENSE).
