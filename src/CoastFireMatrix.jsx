import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';

const ANCHOR_HORIZON = 30; // the horizon your SWR input is anchored to

// Approximate shape of how "safe" withdrawal rate shifts with horizon length.
// Not a precise formula — a reasonable approximation of published research shapes (Kitces/ERN).
const HORIZON_POINTS = [
  { horizon: 25, mult: 1.10 },
  { horizon: 30, mult: 1.00 },
  { horizon: 35, mult: 0.92 },
  { horizon: 40, mult: 0.87 },
  { horizon: 45, mult: 0.82 },
  { horizon: 50, mult: 0.79 },
  { horizon: 55, mult: 0.77 },
  { horizon: 60, mult: 0.75 },
  { horizon: 65, mult: 0.74 },
  { horizon: 70, mult: 0.73 },
  { horizon: 80, mult: 0.715 },
  { horizon: 90, mult: 0.705 },
];

function horizonMultiplier(horizon) {
  const pts = HORIZON_POINTS;
  if (horizon <= pts[0].horizon) return pts[0].mult;
  if (horizon >= pts[pts.length - 1].horizon) return pts[pts.length - 1].mult;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (horizon >= a.horizon && horizon <= b.horizon) {
      const t = (horizon - a.horizon) / (b.horizon - a.horizon);
      return a.mult + t * (b.mult - a.mult);
    }
  }
  return 1;
}

function fmt(n) {
  const kRounded = Math.round(n / 1000);
  if (Math.abs(kRounded) >= 1000) return `$${(n / 1000000).toFixed(2)}M`;
  return `$${kRounded}K`;
}

function fmtInput(n) {
  return n.toLocaleString('en-US');
}

// Future value of a flat annual contribution, ordinary annuity (end-of-year), over `years`.
function fvContributions(annual, years, r) {
  if (years <= 0) return 0;
  if (r === 0) return annual * years;
  return annual * ((Math.pow(1 + r, years) - 1) / r);
}

// Present value (at the start of `years`) of a flat annual amount needed only for `years`,
// ordinary annuity. Used for the mortgage payment: it's not a perpetual SWR draw, just a
// finite bridge from a given target age until the mortgage is paid off.
function pvAnnuity(annual, years, r) {
  if (years <= 0) return 0;
  if (r === 0) return annual * years;
  return annual * ((1 - Math.pow(1 + r, -years)) / r);
}

// ---- Fonts: mono for anything numeric/tabular, sans for prose/UI chrome ----
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";
const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// ---- Palette (warm / earthy, cream-leaning) ----
const COLOR = {
  page: '#F7F0DE',        // cream page background
  panel: '#FFFBF2',       // near-white warm parchment — used for both input groups and table header/coast column
  border: '#DDCA9E',      // soft tan border
  heading: '#3B2F1F',     // deep umber, headings
  label: '#4A6741',       // earthy green, labels / eyebrow text
  body: '#7A6C50',        // soft brown, body/caption text
  inputBg: '#FFFFFF',
  inputBorder: '#DDCA9E',
  inputText: '#3B2F1F',
  blankCell: '#FFFBF2',
  headerBg: '#FFFBF2',
  currentRowBg: '#E8D8A9',
};

// ---- Stat card accent (this is where the "pop" lives) ----
// Hero card (the one place the page "pops"). Moss green deep enough that all text on it is >= 4.5:1.
const CARD = {
  bg: '#4A6741',
  text: '#F7F0DE',  // 5.6:1
  sub: '#E6EDD3',   // 5.3:1
  rule: 'rgba(247,240,222,0.28)',
};

const shadowSm = '0 1px 3px rgba(59,47,31,0.08), 0 1px 2px rgba(59,47,31,0.06)';

// ---- Coverage heatmap ----
// coverage = projected balance at the coast age / balance required there.
// Two hues so the 100% line stays unmistakable: green at or above it, orange below.
// Within each hue, a deeper tint means further from 100%. The two bands that meet at 100% also differ
// in lightness (not just hue), and shortfall cells get dashed borders, so the line survives without color.
// Every text/background pair is >= 4.5:1 contrast, including under the hover tint.
// `range` doubles as the legend label for now (plain-English names are parked for later).
const COVERAGE_BANDS = [
  { id: 'c150', min: 1.5,  range: '150% or more', bg: '#BFD6A5', border: '#4D7338', text: '#213B16', short: false },
  { id: 'c125', min: 1.25, range: '125–150%',     bg: '#DAE8CA', border: '#5E8546', text: '#2F4D21', short: false },
  { id: 'c100', min: 1.0,  range: '100–125%',     bg: '#F0F5E8', border: '#6B8F52', text: '#3D5C2C', short: false },
  { id: 'c90',  min: 0.9,  range: '90–100%',      bg: '#F7DDBE', border: '#C97B3D', text: '#7F4219', short: true },
  { id: 'c0',   min: 0,    range: 'under 90%',    bg: '#EDBB87', border: '#B35F1B', text: '#5E2B0A', short: true },
];

// Compares projected >= required * min (no division), so "100%+" is exactly the old projected >= required test.
function coverageBand(projected, required) {
  for (const b of COVERAGE_BANDS) if (projected >= required * b.min) return b;
  return COVERAGE_BANDS[COVERAGE_BANDS.length - 1];
}

// Rounded down, so a cell never reads "100%" while it is still short.
function coveragePct(projected, required) {
  return required > 0 ? Math.floor((projected / required) * 100) : null;
}

// Inline styles for the range sliders (thumb + track), scoped by class name.
const SLIDER_CSS = `
.cfm-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: ${COLOR.border};
  outline: none;
  margin: 10px 0 8px;
}
.cfm-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${COLOR.heading};
  border: 3px solid ${COLOR.panel};
  box-shadow: 0 1px 3px rgba(59,47,31,0.45);
  cursor: pointer;
  margin-top: -8px;
}
.cfm-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${COLOR.heading};
  border: 3px solid ${COLOR.panel};
  box-shadow: 0 1px 3px rgba(59,47,31,0.45);
  cursor: pointer;
}
.cfm-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: ${COLOR.border};
}
.cfm-slider::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: ${COLOR.border};
}
.cfm-toggle {
  position: relative;
  -webkit-appearance: none;
  appearance: none;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: ${COLOR.border};
  outline: none;
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
}
.cfm-toggle:checked {
  background: ${COLOR.label};
}
.cfm-toggle::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${COLOR.panel};
  box-shadow: 0 1px 2px rgba(59,47,31,0.35);
  transition: transform 0.15s ease;
}
.cfm-toggle:checked::before {
  transform: translateX(18px);
}
.cfm-info {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  margin: -5px 0;
  border-radius: 50%;
  cursor: pointer;
}
.cfm-info:focus-visible {
  outline: 2px solid ${COLOR.heading};
  outline-offset: -2px;
}
/* Page layout. Phones: one column in DOM order (title, hero, inputs, matrix column, notes).
   From 960px: title / hero / inputs / notes stack on the left, and the matrix column spans all of those
   rows and is pinned from the very top, so the page never has a "scroll, stick, release" phase. */
.cfm-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.cfm-layout > * {
  min-width: 0;
}
.cfm-scroller {
  max-height: 70vh;
}
@media (min-width: 960px) {
  .cfm-layout {
    grid-template-columns: 340px minmax(0, 1fr);
    column-gap: 24px;
    align-items: start;
  }
  .cfm-head   { grid-column: 1; grid-row: 1; }
  .cfm-hero   { grid-column: 1; grid-row: 2; }
  .cfm-inputs { grid-column: 1; grid-row: 3; }
  .cfm-notes  { grid-column: 1; grid-row: 4; }
  .cfm-main {
    grid-column: 2;
    grid-row: 1 / span 4;
    position: sticky;
    top: 32px; /* equals the page's top padding, so it is already pinned at scroll position 0 */
  }
  /* inspector + legend + matrix fit inside one screen */
  .cfm-scroller {
    max-height: calc(100vh - 250px);
    min-height: 260px;
  }
}
.cfm-cell:focus {
  outline: none;
}
.cfm-cell:focus-visible {
  outline: 3px solid ${COLOR.heading} !important;
  outline-offset: -3px;
}
`;

// "?" button + popover. Opens on click / tap / Enter / Space (so touch and keyboard work),
// and also on mouse hover. Esc or a click elsewhere closes it.
function InfoTip({ id, label, children }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [shift, setShift] = useState(0);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const visible = pinned || hovered;

  const close = () => { setPinned(false); setHovered(false); };

  // The label can sit near the right edge on narrow screens: nudge the panel back inside the viewport.
  useLayoutEffect(() => {
    if (!visible || !panelRef.current) return;
    const panel = panelRef.current;
    const anchor = panel.offsetParent;
    if (!anchor) return;
    const anchorLeft = anchor.getBoundingClientRect().left;
    const vw = document.documentElement.clientWidth;
    const desired = Math.min(Math.max(anchorLeft, 12), Math.max(vw - panel.offsetWidth - 12, 12));
    setShift(desired - anchorLeft);
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onPointerDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [visible]);

  return (
    <span
      ref={rootRef}
      style={{ display: 'inline-flex' }}
      // Hover is mouse-only: touch fires hover events on tap, which would fight with the click toggle.
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false); }}
    >
      <button
        type="button"
        className="cfm-info"
        aria-label={`About ${label.toLowerCase()}`}
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        onClick={() => { if (pinned) close(); else setPinned(true); }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 15, height: 15, borderRadius: '50%', boxSizing: 'border-box',
            border: `1.5px solid ${COLOR.label}`,
            background: visible ? COLOR.label : 'transparent',
            color: visible ? COLOR.panel : COLOR.label,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, lineHeight: 1, fontFamily: FONT_SANS,
          }}
        >?</span>
      </button>
      {visible && (
        <span
          id={id}
          ref={panelRef}
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 10,
            transform: `translateX(${shift}px)`,
            width: 'min(300px, calc(100vw - 24px))',
            paddingTop: 6, // part of the panel, so the pointer can travel from the "?" onto it
          }}
        >
          <span style={{
            display: 'block', background: COLOR.panel, border: `1px solid ${COLOR.border}`, borderRadius: 6,
            padding: '10px 12px', boxShadow: shadowSm,
            fontSize: 12.5, fontWeight: 400, lineHeight: 1.5, color: COLOR.heading, fontFamily: FONT_SANS,
          }}>
            {children}
          </span>
        </span>
      )}
    </span>
  );
}

function Slider({ id, label, info, value, onChange, min, max, step, suffix, decimals = 1 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <label htmlFor={id} style={{ fontSize: 12, letterSpacing: '0.01em', color: COLOR.label, fontWeight: 600, fontFamily: FONT_SANS }}>
            {label}
          </label>
          {info && <InfoTip id={`${id}-info`} label={label}>{info}</InfoTip>}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: COLOR.heading, fontVariantNumeric: 'tabular-nums', fontFamily: FONT_MONO }}>
          {value.toFixed(decimals)}{suffix}
        </span>
      </div>
      <input
        id={id}
        className="cfm-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: COLOR.body }}>
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
}

// Persistent scenario inspector. Shows the cell being previewed (mouse hover or keyboard focus),
// else the pinned cell, else the "coast now" scenario. Not a live region: the pinned cell is announced
// separately, and focused cells already speak via their own labels.
const srOnly = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

function Inspector({ cell, source }) {
  if (!cell) return null;
  const heading = source === 'selected' ? 'Selected scenario' : source === 'preview' ? 'Previewing' : 'Your coast-now scenario';
  const diff = cell.projected - cell.val;
  const ahead = diff >= 0;
  const stat = (field, label, value, sub, swatchBand) => (
    <div>
      <div style={{ fontSize: 11, color: COLOR.body, fontFamily: FONT_SANS, marginBottom: 2 }}>{label}</div>
      <div data-field={field} style={{ fontSize: 20, fontWeight: 700, color: COLOR.heading, fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: COLOR.body, fontFamily: FONT_SANS, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
          {swatchBand && (
            <span aria-hidden="true" style={{
              width: 11, height: 11, boxSizing: 'border-box', borderRadius: 2, display: 'inline-block',
              background: swatchBand.bg, border: `1.5px ${swatchBand.short ? 'dashed' : 'solid'} ${swatchBand.border}`,
            }} />
          )}
          {sub}
        </div>
      )}
    </div>
  );
  return (
    <section
      aria-label="Scenario details"
      data-source={source}
      style={{
        background: COLOR.panel, border: `1px solid ${COLOR.border}`, borderRadius: 8,
        padding: '12px 16px', marginBottom: 10, boxShadow: shadowSm,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLOR.label, fontFamily: FONT_SANS }}>{heading}</span>
        <span data-field="scenario" style={{ fontSize: 13, fontWeight: 700, color: COLOR.heading, fontFamily: FONT_MONO }}>
          Coast at {cell.coastAge}, retire at {cell.targetAge}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
        {stat('required', 'Required balance', fmt(cell.val), `at age ${cell.coastAge}`)}
        {stat('projected', 'Projected balance', fmt(cell.projected), `at age ${cell.coastAge}`)}
        {stat('diff', ahead ? 'Surplus' : 'Shortfall', `${ahead ? '+' : '−'}${fmt(Math.abs(diff))}`)}
        {stat('coverage', 'Coverage', cell.pct !== null ? `${cell.pct}%` : '—', cell.pct !== null ? cell.band.range : 'nothing required', cell.band)}
      </div>
    </section>
  );
}

export default function CoastFireMatrix() {
  const [spending, setSpending] = useState(60000);
  const [spendingDraft, setSpendingDraft] = useState('60,000');

  const [swr, setSwr] = useState(4); // anchor SWR, %

  const [horizonAdjust, setHorizonAdjust] = useState(true);
  const [lifeExpectancy, setLifeExpectancy] = useState(90);
  const [lifeExpectancyDraft, setLifeExpectancyDraft] = useState('90');

  const [rate, setRate] = useState(7); // real return, %

  const [balance, setBalance] = useState(1000000);
  const [balanceDraft, setBalanceDraft] = useState('1,000,000');

  const [currentAge, setCurrentAge] = useState(40);
  const [currentAgeDraft, setCurrentAgeDraft] = useState('40');

  const [annualContribution, setAnnualContribution] = useState(24500);
  const [contributionDraft, setContributionDraft] = useState('24,500');

  const [mortgagePayoff, setMortgagePayoff] = useState(false);
  const [monthlyMortgage, setMonthlyMortgage] = useState(2000);
  const [monthlyMortgageDraft, setMonthlyMortgageDraft] = useState('2,000');
  const [payoffAge, setPayoffAge] = useState(55);
  const [payoffAgeDraft, setPayoffAgeDraft] = useState('55');

  // One inspected scenario drives the inspector panel and the row/column highlight:
  //   mouse hover  >  keyboard focus  >  pinned (click / Enter)  >  the "coast now" scenario.
  // Pinned and hovered cells are stored by age (not value) so the inspector never shows stale numbers
  // after an input changes.
  const [hovered, setHovered] = useState(null);       // { coastAge, targetAge } — mouse over a cell
  const [pinned, setPinned] = useState(null);         // { coastAge, targetAge } — click / Enter / Space
  const [headerHover, setHeaderHover] = useState(null); // { coastAge } or { targetAge } — mouse over a header
  const [announcement, setAnnouncement] = useState(''); // screen-reader message, only on pin / unpin
  // Keyboard navigation: one tab stop into the matrix (roving tabindex), arrow keys move within it.
  const [focusCell, setFocusCell] = useState(null);   // { r, c } indexes into grid
  const [focusInGrid, setFocusInGrid] = useState(false);
  // Focus stays on a cell after a mouse click; only treat focus as "inspect this" for keyboard users.
  const [kbNav, setKbNav] = useState(false);
  const gridRef = useRef(null);

  // Both coast ages (rows) and retirement/target ages (columns) run from currentAge
  // through a hard stop at 62 — no earlier floor, no later ceiling.
  const ages = useMemo(() => {
    const start = Math.min(currentAge, 62);
    const len = Math.max(62 - start + 1, 1);
    return Array.from({ length: len }, (_, i) => start + i);
  }, [currentAge]);
  const targetAges = ages;
  const coastAges = ages;

  // Effective FI number per target age. When horizon-adjustment is on, adjusted off
  // the SWR anchor using life expectancy; when off, the SWR anchor is applied flat.
  const fiByTarget = useMemo(() => {
    const map = {};
    const r = rate / 100;
    targetAges.forEach((targetAge) => {
      let effSwr;
      let horizon = null;
      if (horizonAdjust) {
        horizon = lifeExpectancy - targetAge;
        const mult = horizonMultiplier(horizon);
        effSwr = (swr / 100) * mult;
      } else {
        effSwr = swr / 100;
      }
      const floorFi = spending / effSwr;
      const bridgeYears = mortgagePayoff ? Math.max(payoffAge - targetAge, 0) : 0;
      const bridgeFi = bridgeYears > 0 ? pvAnnuity(monthlyMortgage * 12, bridgeYears, r) : 0;
      map[targetAge] = { horizon, effSwr, fi: floorFi + bridgeFi };
    });
    return map;
  }, [targetAges, spending, swr, horizonAdjust, lifeExpectancy, mortgagePayoff, monthlyMortgage, payoffAge, rate]);

  const grid = useMemo(() => {
    const r = rate / 100;
    return coastAges.map((coastAge) =>
      targetAges.map((targetAge) => {
        if (targetAge < coastAge) return null;
        const years = targetAge - coastAge;
        const fi = fiByTarget[targetAge].fi;
        return fi / Math.pow(1 + r, years);
      })
    );
  }, [coastAges, targetAges, fiByTarget, rate]);

  // Balance projected forward to each coast age: growth on current balance
  // plus growth on flat annual contributions, both accruing from now until that coast age.
  const projectedByCoastAge = useMemo(() => {
    const r = rate / 100;
    const map = {};
    coastAges.forEach((coastAge) => {
      const years = coastAge - currentAge;
      if (years <= 0) {
        map[coastAge] = balance;
      } else {
        const grownBalance = balance * Math.pow(1 + r, years);
        const grownContrib = fvContributions(annualContribution, years, r);
        map[coastAge] = grownBalance + grownContrib;
      }
    });
    return map;
  }, [coastAges, currentAge, rate, balance, annualContribution]);

  // ---- Headline numbers ----
  const anchorFi = (spending + (mortgagePayoff ? monthlyMortgage * 12 : 0)) / (swr / 100);

  // Earliest retirement age that's already covered if you stopped contributing today.
  const coastNowAge = useMemo(() => {
    const row = coastAges.indexOf(currentAge);
    if (row === -1) return null;
    for (let ci = 0; ci < targetAges.length; ci++) {
      const val = grid[row][ci];
      if (val === null) continue;
      if (projectedByCoastAge[currentAge] >= val) return targetAges[ci];
    }
    return null; // not cleared for any modeled target age yet
  }, [coastAges, currentAge, targetAges, grid, projectedByCoastAge]);

  const handleSpendingBlur = () => {
    const parsed = parseFloat(spendingDraft.replace(/[^0-9.]/g, ''));
    const clean = isNaN(parsed) ? spending : Math.max(0, parsed);
    setSpending(clean);
    setSpendingDraft(fmtInput(clean));
  };

  const handleBalanceBlur = () => {
    const parsed = parseFloat(balanceDraft.replace(/[^0-9.]/g, ''));
    const clean = isNaN(parsed) ? balance : Math.max(0, parsed);
    setBalance(clean);
    setBalanceDraft(fmtInput(clean));
  };

  const handleContributionBlur = () => {
    const parsed = parseFloat(contributionDraft.replace(/[^0-9.]/g, ''));
    const clean = isNaN(parsed) ? annualContribution : Math.max(0, parsed);
    setAnnualContribution(clean);
    setContributionDraft(fmtInput(clean));
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const handleAgeBlur = () => {
    const parsed = parseInt(currentAgeDraft, 10);
    const clean = isNaN(parsed) ? currentAge : clamp(parsed, 18, 62);
    setCurrentAge(clean);
    setCurrentAgeDraft(String(clean));
  };

  const handleLifeExpectancyBlur = () => {
    const parsed = parseInt(lifeExpectancyDraft, 10);
    const clean = isNaN(parsed) ? lifeExpectancy : clamp(parsed, 70, 105);
    setLifeExpectancy(clean);
    setLifeExpectancyDraft(String(clean));
  };

  const handleMonthlyMortgageBlur = () => {
    const parsed = parseFloat(monthlyMortgageDraft.replace(/[^0-9.]/g, ''));
    const clean = isNaN(parsed) ? monthlyMortgage : Math.max(0, parsed);
    setMonthlyMortgage(clean);
    setMonthlyMortgageDraft(fmtInput(clean));
  };

  const handlePayoffAgeBlur = () => {
    const parsed = parseInt(payoffAgeDraft, 10);
    const clean = isNaN(parsed) ? payoffAge : clamp(parsed, 18, 100);
    setPayoffAge(clean);
    setPayoffAgeDraft(String(clean));
  };

  // Everything the inspector shows about a cell, recomputed from current inputs. Null for blank / off-grid cells.
  const cellInfo = (coastAge, targetAge) => {
    const r = coastAges.indexOf(coastAge);
    const c = targetAges.indexOf(targetAge);
    if (r === -1 || c === -1) return null;
    const val = grid[r][c];
    if (val === null) return null;
    const projected = projectedByCoastAge[coastAge];
    return { coastAge, targetAge, r, c, val, projected, band: coverageBand(projected, val), pct: coveragePct(projected, val) };
  };

  const describeCell = (cell) => {
    const diff = cell.projected - cell.val;
    return `Coast at ${cell.coastAge}, retire at ${cell.targetAge}: needs ${fmt(cell.val)} at coast age; projected balance ${fmt(cell.projected)}, `
      + `${diff >= 0 ? `a surplus of ${fmt(diff)}` : `a shortfall of ${fmt(-diff)}`}`
      + `${cell.pct !== null ? `, covering ${cell.pct}%` : ''}.`;
  };

  const unpin = () => {
    if (!pinned) return;
    setPinned(null);
    setAnnouncement('Selection cleared.');
  };

  // Click / Enter on the pinned cell unpins it; on any other cell it pins that one instead.
  const togglePin = (coastAge, targetAge) => {
    if (pinned && pinned.coastAge === coastAge && pinned.targetAge === targetAge) {
      unpin();
      return;
    }
    setPinned({ coastAge, targetAge });
    const cell = cellInfo(coastAge, targetAge);
    setAnnouncement(cell ? `Selected. ${describeCell(cell)}` : '');
  };

  // The one cell that sits in the tab order: last-focused cell, else the first cell of the current-age row.
  const entryCell = (focusCell && grid[focusCell.r] && grid[focusCell.r][focusCell.c] != null)
    ? focusCell
    : { r: 0, c: 0 };

  const handleCellKeyDown = (e, ri, ci, coastAge, targetAge, val) => {
    setKbNav(true);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePin(coastAge, targetAge);
      return;
    }
    if (e.key === 'Escape') {
      if (pinned) { e.preventDefault(); unpin(); }
      return;
    }
    const lastR = coastAges.length - 1;
    const lastC = targetAges.length - 1;
    // Next filled cell in a direction; blank cells (coast age after retire age) are skipped.
    const step = (dr, dc) => {
      let r = ri + dr, c = ci + dc;
      while (r >= 0 && r <= lastR && c >= 0 && c <= lastC) {
        if (grid[r][c] !== null) return { r, c };
        r += dr; c += dc;
      }
      return null;
    };
    let next = null;
    if (e.key === 'ArrowRight') next = step(0, 1);
    else if (e.key === 'ArrowLeft') next = step(0, -1);
    else if (e.key === 'ArrowDown') next = step(1, 0);
    else if (e.key === 'ArrowUp') next = step(-1, 0);
    else if (e.key === 'Home') next = { r: ri, c: grid[ri].findIndex((v) => v !== null) };
    else if (e.key === 'End') next = { r: ri, c: lastC };
    else return;
    e.preventDefault();
    if (!next) return;
    setFocusCell(next);
    const el = gridRef.current && gridRef.current.querySelector(`[data-r="${next.r}"][data-c="${next.c}"]`);
    if (el) el.focus();
  };

  const hoveredCell = hovered ? cellInfo(hovered.coastAge, hovered.targetAge) : null;
  const focusedCell = (kbNav && focusInGrid && focusCell) ? cellInfo(coastAges[focusCell.r], targetAges[focusCell.c]) : null;
  const pinnedCell = pinned ? cellInfo(pinned.coastAge, pinned.targetAge) : null;
  // Nothing hovered / focused / pinned: show how close "coast now" gets (or the latest age if it doesn't clear yet).
  const defaultCell = cellInfo(coastAges[0], coastNowAge !== null ? coastNowAge : targetAges[targetAges.length - 1]);
  const inspected = hoveredCell || focusedCell || pinnedCell || defaultCell;
  const inspectedSource = !inspected ? 'none'
    : (pinnedCell && inspected.coastAge === pinnedCell.coastAge && inspected.targetAge === pinnedCell.targetAge) ? 'selected'
    : inspected === defaultCell ? 'default'
    : 'preview';
  // Row/column highlight follows the inspected cell (not the resting "coast now" default), or a hovered header.
  const showCross = inspected && inspectedSource !== 'default';
  const crossCoast = headerHover ? (headerHover.coastAge ?? null) : (showCross ? inspected.coastAge : null);
  const crossTarget = headerHover ? (headerHover.targetAge ?? null) : (showCross ? inspected.targetAge : null);

  const inputStyle = {
    background: COLOR.inputBg,
    border: `1px solid ${COLOR.inputBorder}`,
    borderRadius: 4,
    color: COLOR.inputText,
    fontFamily: FONT_MONO,
    fontSize: 14,
    padding: '8px 10px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const dollarPrefixStyle = {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    color: COLOR.label,
    fontFamily: FONT_MONO,
    fontSize: 14,
    lineHeight: 1,
    pointerEvents: 'none',
  };

  const labelStyle = {
    fontSize: 12,
    letterSpacing: '0.01em',
    color: COLOR.label,
    display: 'block',
    marginBottom: 6,
    fontWeight: 600,
  };

  const groupHeaderStyle = {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 20,
    letterSpacing: '0.01em',
    color: COLOR.heading,
    fontWeight: 500,
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <div style={{
      fontFamily: FONT_SANS,
      background: COLOR.page,
      minHeight: '100vh',
      color: COLOR.body,
      padding: '32px 20px',
    }}>
      <style>{SLIDER_CSS}</style>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div className="cfm-layout">
        <div className="cfm-head" style={{ marginBottom: 26 }}>
          <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 500, fontSize: 34, margin: '0 0 8px', color: COLOR.heading }}>
            CoastFIRE Matrix
          </h1>
          <div style={{ fontSize: 13.5, color: COLOR.body, lineHeight: 1.5 }}>
            Find the balance you need, at each age you might stop contributing, to coast — untouched — to full financial independence by any retirement age.
          </div>
        </div>

        {/* Hero: the opening statement. The big number is hidden from screen readers; the sentence carries it. */}
        <section
          aria-label="Coast now answer"
          className="cfm-hero"
          data-hero
          style={{
            background: CARD.bg, color: CARD.text, borderRadius: 12,
            padding: '22px 22px 18px', marginBottom: 14, boxShadow: shadowSm,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: CARD.text, fontFamily: FONT_SANS }}>
            Coast now, retire by
          </div>
          <div
            aria-hidden="true"
            data-field="hero-age"
            style={{
              fontFamily: FONT_MONO, fontSize: 88, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums', color: CARD.text, margin: '8px 0 12px',
            }}
          >
            {coastNowAge !== null ? coastNowAge : '—'}
          </div>
          <p data-field="hero-sentence" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: CARD.sub }}>
            {coastNowAge !== null ? (
              <>If you stopped contributing today, your current balance alone would grow to cover retirement at age <strong>{coastNowAge}</strong> or later.</>
            ) : (
              <>If you stopped contributing today, your balance wouldn't cover retirement at any age through <strong>{targetAges[targetAges.length - 1]}</strong>. The matrix shows what you'd need at each coast age.</>
            )}
          </p>
          <div style={{
            marginTop: 16, paddingTop: 12, borderTop: `1px solid ${CARD.rule}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 12, rowGap: 2, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: CARD.text }}>Full FIRE target</div>
              <div style={{ fontSize: 11.5, color: CARD.sub, marginTop: 2 }}>retire at any age with this amount</div>
            </div>
            <div data-field="fire-target" style={{ fontSize: 22, fontWeight: 700, color: CARD.text, fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(anchorFi)}
            </div>
          </div>
        </section>

        {/* Your numbers */}
        <div className="cfm-inputs" style={{
          background: COLOR.panel,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 8,
          padding: 18,
          marginBottom: 14,
          boxShadow: shadowSm,
        }}>
          <div style={groupHeaderStyle}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR.label, display: 'inline-block' }} />
            Your numbers
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 14,
          }}>
            <div>
              <label htmlFor="input-age" style={labelStyle}>Current age</label>
              <input
                id="input-age"
                style={inputStyle}
                type="number" min="18" max="62"
                value={currentAgeDraft}
                onChange={(e) => setCurrentAgeDraft(e.target.value)}
                onBlur={handleAgeBlur}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </div>

            <div>
              <label htmlFor="input-balance" style={labelStyle}>Current investment balance</label>
              <div style={{ position: 'relative' }}>
                <span style={dollarPrefixStyle}>$</span>
                <input
                  id="input-balance"
                  style={{ ...inputStyle, paddingLeft: 22 }}
                  value={balanceDraft}
                  onChange={(e) => setBalanceDraft(e.target.value)}
                  onBlur={handleBalanceBlur}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input-contribution" style={labelStyle}>Annual contributions until coast</label>
              <div style={{ position: 'relative' }}>
                <span style={dollarPrefixStyle}>$</span>
                <input
                  id="input-contribution"
                  style={{ ...inputStyle, paddingLeft: 22 }}
                  value={contributionDraft}
                  onChange={(e) => setContributionDraft(e.target.value)}
                  onBlur={handleContributionBlur}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input-spending" style={labelStyle}>
                {mortgagePayoff ? 'Annual retirement spend (excl. mortgage)' : 'Annual retirement spend'}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={dollarPrefixStyle}>$</span>
                <input
                  id="input-spending"
                  style={{ ...inputStyle, paddingLeft: 22 }}
                  value={spendingDraft}
                  onChange={(e) => setSpendingDraft(e.target.value)}
                  onBlur={handleSpendingBlur}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 14,
            marginTop: 14,
          }}>
            <Slider
              id="slider-swr"
              label="Safe withdrawal rate"
              info={horizonAdjust
                ? `Your baseline rate for a ${ANCHOR_HORIZON}-year retirement. Longer retirements use a lower rate and shorter ones a higher rate; the % under each retirement-age column is the rate actually used.`
                : 'Applied as-is to every retirement age, however long retirement lasts.'}
              value={swr}
              onChange={setSwr}
              min={1} max={10} step={0.1}
              suffix="%"
            />
            <Slider
              id="slider-rate"
              label="Real rate of return"
              info="Annual investment return after inflation, so every figure here is in today's dollars. U.S. stocks have historically returned roughly 6–7% a year after inflation; future returns may differ."
              value={rate}
              onChange={setRate}
              min={0} max={12} step={0.1}
              suffix="%"
            />
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 24,
            marginTop: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                className="cfm-toggle"
                id="horizon-toggle"
                checked={horizonAdjust}
                onChange={(e) => setHorizonAdjust(e.target.checked)}
              />
              <label htmlFor="horizon-toggle" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
                Adjust safe withdrawal rate for retirement length?
              </label>
            </div>

            {horizonAdjust && (
              <div style={{ minWidth: 150 }}>
                <label htmlFor="input-life-expectancy" style={labelStyle}>Life expectancy</label>
                <input
                  id="input-life-expectancy"
                  style={inputStyle}
                  type="number" min="70" max="105"
                  value={lifeExpectancyDraft}
                  onChange={(e) => setLifeExpectancyDraft(e.target.value)}
                  onBlur={handleLifeExpectancyBlur}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 24,
            marginTop: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                className="cfm-toggle"
                id="mortgage-toggle"
                checked={mortgagePayoff}
                onChange={(e) => setMortgagePayoff(e.target.checked)}
              />
              <label htmlFor="mortgage-toggle" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
                Account for mortgage payoff?
              </label>
            </div>

            {mortgagePayoff && (
              <>
                <div style={{ minWidth: 150 }}>
                  <label htmlFor="input-monthly-mortgage" style={labelStyle}>Monthly mortgage payment</label>
                  <div style={{ position: 'relative' }}>
                    <span style={dollarPrefixStyle}>$</span>
                    <input
                      id="input-monthly-mortgage"
                      style={{ ...inputStyle, paddingLeft: 22 }}
                      value={monthlyMortgageDraft}
                      onChange={(e) => setMonthlyMortgageDraft(e.target.value)}
                      onBlur={handleMonthlyMortgageBlur}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div style={{ minWidth: 150 }}>
                  <label htmlFor="input-payoff-age" style={labelStyle}>Age at payoff</label>
                  <input
                    id="input-payoff-age"
                    style={inputStyle}
                    type="number" min="18" max="100"
                    value={payoffAgeDraft}
                    onChange={(e) => setPayoffAgeDraft(e.target.value)}
                    onBlur={handlePayoffAgeBlur}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="cfm-main">
        <Inspector cell={inspected} source={inspectedSource} />
        {/* Announces only when a cell is pinned / unpinned; hover and arrow-key moves are not announced
            (a focused cell already reads its own label). */}
        <div role="status" aria-live="polite" style={srOnly}>{announcement}</div>

        <div style={{ display: 'flex', alignItems: 'center', columnGap: 14, rowGap: 6, marginBottom: 12, fontSize: 12, color: COLOR.body, flexWrap: 'wrap' }}>
          <span>Your projected balance covers</span>
          {COVERAGE_BANDS.map((b) => (
            <span key={b.id} data-legend={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span aria-hidden="true" style={{
                width: 12, height: 12, background: b.bg, borderRadius: 2, boxSizing: 'border-box',
                border: `1.5px ${b.short ? 'dashed' : 'solid'} ${b.border}`, display: 'inline-block',
              }} />
              {b.range}
            </span>
          ))}
          <span>of the required balance</span>
          {coastNowAge !== null && (
            <span data-legend-now style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span aria-hidden="true" style={{
                width: 8, height: 8, borderRadius: '50%', background: COLOR.heading, display: 'inline-block',
                boxShadow: `0 0 0 1.5px ${COLOR.panel}, 0 0 0 2.5px ${COLOR.border}`,
              }} />
              your coast-now scenario
            </span>
          )}
        </div>

        <div
          className="cfm-scroller"
          style={{
            overflowX: 'auto', border: `1px solid ${COLOR.border}`, borderRadius: 8, overflowY: 'auto',
            // keep keyboard-focused cells from scrolling underneath the sticky header row / coast-age column
            scrollPaddingTop: 56, scrollPaddingLeft: 100,
          }}
          onPointerDown={() => setKbNav(false)}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setHovered(null); setHeaderHover(null); } }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocusInGrid(false);
          }}
        >
          <table
            ref={gridRef}
            role="grid"
            aria-label="Balance needed at each coast age, by retirement age"
            style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, fontFamily: FONT_MONO }}
          >
            <thead>
              <tr>
                <th style={{
                  position: 'sticky', top: 0, left: 0, zIndex: 3, background: COLOR.headerBg, padding: '10px 12px',
                  textAlign: 'left', color: COLOR.heading, borderBottom: `1px solid ${COLOR.border}`, borderRight: `1px solid ${COLOR.border}`,
                  fontWeight: 700, fontSize: 12, fontFamily: FONT_SANS
                }}>
                  Coast ↓ / Retire →
                </th>
                {targetAges.map((a) => {
                  const colHighlighted = crossTarget === a;
                  return (
                    <th
                      key={a}
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setHovered(null); setHeaderHover({ targetAge: a }); } }}
                      style={{
                        position: 'sticky', top: 0, zIndex: 2,
                        padding: '8px 8px', textAlign: 'center', color: COLOR.heading,
                        background: colHighlighted ? COLOR.currentRowBg : COLOR.headerBg,
                        borderBottom: `1px solid ${COLOR.border}`, fontWeight: 700, minWidth: 70,
                        transition: 'background 0.1s ease',
                      }}
                    >
                      <div>{a}</div>
                      {horizonAdjust && (
                        <div style={{ fontSize: 9.5, color: COLOR.body, fontWeight: 400 }}>
                          {(fiByTarget[a].effSwr * 100).toFixed(2)}%
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {coastAges.map((coastAge, ri) => (
                <tr key={coastAge}>
                  <td
                    role="rowheader"
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setHovered(null); setHeaderHover({ coastAge }); } }}
                    style={{
                      position: 'sticky', left: 0, zIndex: 1,
                      // tinted only while this row is being previewed (hover / keyboard focus); "you" is marked by the pill + bar
                      background: crossCoast === coastAge ? COLOR.currentRowBg : COLOR.panel,
                      padding: '8px 12px',
                      color: COLOR.heading, fontWeight: 700, borderRight: `1px solid ${COLOR.border}`, borderBottom: '1px solid #D6C193',
                      transition: 'background 0.1s ease',
                      // your row: a green bar on the label's left edge (plus the "you" pill)
                      boxShadow: coastAge === currentAge ? `inset 4px 0 0 ${COLOR.label}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{coastAge}</span>
                      {coastAge === currentAge && (
                        <>
                          <span aria-hidden="true" data-you style={{
                            padding: '1px 6px', borderRadius: 999, background: COLOR.heading, color: COLOR.panel,
                            fontSize: 10, fontWeight: 600, fontFamily: FONT_SANS, lineHeight: 1.4,
                          }}>you</span>
                          <span style={srOnly}> (your current age)</span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 9.5, color: COLOR.body, fontWeight: 400 }}>
                      proj. {fmt(projectedByCoastAge[coastAge])}
                    </div>
                  </td>
                  {targetAges.map((targetAge, ci) => {
                    const val = grid[ri][ci];
                    if (val === null) {
                      return (
                        <td
                          key={targetAge}
                          onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setHovered(null); setHeaderHover(null); } }}
                          style={{ padding: '8px', borderBottom: '1px solid #D6C193', background: COLOR.blankCell }}
                        />
                      );
                    }
                    const projected = projectedByCoastAge[coastAge];
                    const band = coverageBand(projected, val);
                    const pct = coveragePct(projected, val);
                    const cleared = !band.short;
                    const isDiagonal = coastAge === targetAge;
                    const isHeadline = coastNowAge !== null && coastAge === currentAge && targetAge === coastNowAge;
                    const highlighted = crossCoast === coastAge || crossTarget === targetAge;
                    const isPinned = !!(pinned && pinned.coastAge === coastAge && pinned.targetAge === targetAge);
                    return (
                      <td
                        key={targetAge}
                        className="cfm-cell"
                        role="gridcell"
                        data-r={ri}
                        data-c={ci}
                        data-band={band.id}
                        tabIndex={entryCell.r === ri && entryCell.c === ci ? 0 : -1}
                        aria-selected={isPinned}
                        aria-label={`Coast at ${coastAge}, retire at ${targetAge}: needs ${fmt(val)} at coast age; your projected balance ${cleared ? 'clears it' : 'falls short'}${pct !== null ? `, covering ${pct}% of the requirement` : ''}.${isHeadline ? ' This is your coast-now scenario.' : ''}`}
                        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setHeaderHover(null); setHovered({ coastAge, targetAge }); } }}
                        onFocus={(e) => {
                          setFocusCell({ r: ri, c: ci });
                          setFocusInGrid(true);
                          // Tabbing in counts as keyboard use; a mouse click does not (pointerdown already cleared kbNav).
                          let keyboardFocus = false;
                          try { keyboardFocus = e.currentTarget.matches(':focus-visible'); } catch (err) { keyboardFocus = false; }
                          if (keyboardFocus) setKbNav(true);
                        }}
                        onKeyDown={(e) => handleCellKeyDown(e, ri, ci, coastAge, targetAge, val)}
                        onClick={() => togglePin(coastAge, targetAge)}
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          border: `1px ${band.short ? 'dashed' : 'solid'} ${band.border}`,
                          background: band.bg,
                          color: band.text,
                          fontWeight: isDiagonal ? 700 : 400,
                          fontVariantNumeric: 'tabular-nums',
                          cursor: 'pointer',
                          position: 'relative',
                          boxShadow: highlighted ? 'inset 0 0 0 1000px rgba(59,47,31,0.07)' : 'none',
                          outline: isPinned ? `2px solid ${COLOR.heading}` : 'none',
                          outlineOffset: -2,
                        }}
                      >
                        {fmt(val)}
                        {isHeadline && (
                          <span aria-hidden="true" data-headline style={{
                            position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%',
                            background: COLOR.heading, boxShadow: `0 0 0 1.5px ${COLOR.panel}`,
                          }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>

        <div className="cfm-notes">
        <div style={{ marginTop: 4, fontSize: 12, color: COLOR.body, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: COLOR.heading, marginBottom: 8 }}>
            Other notes &amp; explanations
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={{ marginBottom: 6 }}>
              {horizonAdjust ? (
                <>Safe withdrawal rate — the slider sets your baseline rate for a 30-year retirement, but a rate that's safe over 30 years isn't automatically safe over a longer stretch, or overly conservative over a shorter one. With adjustment on, the model corrects for this against your life expectancy ({lifeExpectancy}): retiring earlier means your money needs to stretch further, which lowers the effective rate (and raises the balance you need); retiring later shortens that stretch and raises the effective rate. The small % under each retirement-age column header is the adjusted rate actually used for that age.</>
              ) : (
                <>Safe withdrawal rate — horizon adjustment is off, so your safe withdrawal rate is applied flat across every retirement age, with no correction for how long that specific retirement needs the money to last.</>
              )}
            </li>
            {mortgagePayoff && (
              <li style={{ marginBottom: 6 }}>
                Mortgage payoff — the FI number for each retirement age adds a temporary bridge on top of your (excl. mortgage) spend: your monthly payment, annualized, funded only from that retirement age until age {payoffAge}. This isn't drawn at your safe withdrawal rate — it's a fixed-length obligation, discounted at your real rate of return, so it needs less than the sustainability math would ask a perpetual draw to hold. Retirement ages at or past {payoffAge} carry no bridge at all, since the mortgage is already gone.
              </li>
            )}
            <li style={{ marginBottom: 6 }}>
              The headline number is the earliest retirement age your current balance alone would cover if you stopped contributing today. The matrix is the full picture across every coast age / retire age combination.
            </li>
            <li style={{ marginBottom: 6 }}>
              Each row's "proj." figure is your current balance plus annual contributions, both compounded at your real rate of return from now until that coast age — this is what's compared against the required balance in each cell. Row marked • is your current age; its proj. figure equals your current balance since there's no runway to grow before coasting today.
            </li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a
            href="https://github.com/elmedico27/coastfire"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: COLOR.label, textDecoration: 'underline' }}
          >
            View Source on GitHub
          </a>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
