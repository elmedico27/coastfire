import React, { useState, useMemo } from 'react';

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
  // Cleared / not-cleared: soft tint + border + text, not solid fill —
  // keeps the signal readable without color as the only cue, and stays calm at 18x18 scale.
  clearedBg: '#EAF1E1',
  clearedBorder: '#6B8F52',
  clearedText: '#3D5C2C',
  notClearedBg: '#FBEBD9',
  notClearedBorder: '#C97B3D',
  notClearedText: '#8A4A1E',
  blankCell: '#FFFBF2',
  headerBg: '#FFFBF2',
  currentRowBg: '#E8D8A9',
};

// ---- Stat card accent (this is where the "pop" lives) ----
const CARD = {
  bg: '#BD6A3E',   // terracotta
  text: '#FBF3E7',
  label: '#EAD2BC',
};

const shadowSm = '0 1px 3px rgba(59,47,31,0.08), 0 1px 2px rgba(59,47,31,0.06)';

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
`;

function Slider({ id, label, value, onChange, min, max, step, suffix, decimals = 1 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label htmlFor={id} style={{ fontSize: 12, letterSpacing: '0.01em', color: COLOR.label, fontWeight: 600, fontFamily: FONT_SANS }}>
          {label}
        </label>
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

  // Row/column hover highlight + tap-to-reveal cell detail (works for mouse hover and touch tap alike)
  const [hoverCoast, setHoverCoast] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [activeCell, setActiveCell] = useState(null); // { coastAge, targetAge, val }

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
      map[targetAge] = { horizon, effSwr, fi: spending / effSwr };
    });
    return map;
  }, [targetAges, spending, swr, horizonAdjust, lifeExpectancy]);

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

  // ---- Summary stat cards ----
  const anchorFi = spending / (swr / 100);

  // 1. Earliest target age, coasting from right now, that's already cleared.
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

  // 3. Coast number anchored to a fixed, commonly-assumed retirement age (62), regardless of current age.
  const typicalTargetAge = 62;
  const typicalCoastNumber = useMemo(() => {
    const years = Math.max(typicalTargetAge - currentAge, 0);
    const fi = fiByTarget[typicalTargetAge]?.fi;
    if (fi === undefined) return null;
    const r = rate / 100;
    return fi / Math.pow(1 + r, years);
  }, [currentAge, fiByTarget, rate]);

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

  const statCardStyle = (bg) => ({
    background: bg,
    borderRadius: 10,
    padding: '16px 18px',
    boxShadow: shadowSm,
  });

  return (
    <div style={{
      fontFamily: FONT_SANS,
      background: COLOR.page,
      minHeight: '100vh',
      color: COLOR.body,
      padding: '32px 20px',
    }}>
      <style>{SLIDER_CSS}</style>
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 13, letterSpacing: '0.02em', color: COLOR.label, marginBottom: 8, fontWeight: 600 }}>
            Coast FIRE Planner
          </div>
          <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 500, fontSize: 34, margin: '0 0 8px', color: COLOR.heading }}>
            CoastFIRE Matrix
          </h1>
          <div style={{ fontSize: 13.5, color: COLOR.body, lineHeight: 1.5 }}>
            Find the balance you need, at each age you might stop contributing, to coast — untouched — to full financial independence by any retirement age.
          </div>
        </div>

        {/* Summary stat cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 300px))',
          gap: 14,
          marginBottom: 16,
        }}>
          <div style={statCardStyle(CARD.bg)}>
            <div style={{ fontSize: 11, letterSpacing: '0.05em', color: CARD.label, marginBottom: 6, textTransform: 'lowercase' }}>
              coast now to retire by...
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: CARD.text, fontVariantNumeric: 'tabular-nums', fontFamily: FONT_MONO }}>
              {coastNowAge !== null ? coastNowAge : 'not yet'}
            </div>
            <div style={{ fontSize: 10.5, color: CARD.label, marginTop: 4 }}>
              stop contributing at {currentAge}, coast from there
            </div>
          </div>

          <div style={statCardStyle(CARD.bg)}>
            <div style={{ fontSize: 11, letterSpacing: '0.05em', color: CARD.label, marginBottom: 6, textTransform: 'lowercase' }}>
              full FIRE target
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: CARD.text, fontVariantNumeric: 'tabular-nums', fontFamily: FONT_MONO }}>
              {fmt(anchorFi)}
            </div>
            <div style={{ fontSize: 10.5, color: CARD.label, marginTop: 4 }}>
              retire at any age with this amount
            </div>
          </div>

          <div style={statCardStyle(CARD.bg)}>
            <div style={{ fontSize: 11, letterSpacing: '0.05em', color: CARD.label, marginBottom: 6, textTransform: 'lowercase' }}>
              typical retirement coast number
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: CARD.text, fontVariantNumeric: 'tabular-nums', fontFamily: FONT_MONO }}>
              {typicalCoastNumber !== null ? fmt(typicalCoastNumber) : '—'}
            </div>
            <div style={{ fontSize: 10.5, color: CARD.label, marginTop: 4 }}>
              to retire at {typicalTargetAge}
            </div>
          </div>
        </div>

        {/* Your numbers */}
        <div style={{
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
              <label htmlFor="input-spending" style={labelStyle}>Annual retirement spend</label>
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
              label="Safe withdrawal rate*"
              value={swr}
              onChange={setSwr}
              min={1} max={10} step={0.1}
              suffix="%"
            />
            <Slider
              id="slider-rate"
              label="Real rate of return"
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
                Adjust SWR for retirement horizon?
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 12, color: COLOR.body }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, background: COLOR.clearedBg, border: `1.5px solid ${COLOR.clearedBorder}`, display: 'inline-block', borderRadius: 2 }} />
            projected balance clears this target
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, background: COLOR.notClearedBg, border: `1.5px solid ${COLOR.notClearedBorder}`, display: 'inline-block', borderRadius: 2 }} />
            projected balance falls short
          </span>
        </div>

        {/* Tap-to-reveal detail strip — doubles as the mobile-friendly replacement for hover tooltips */}
        <div style={{
          fontSize: 12, color: COLOR.heading, marginBottom: 10, padding: '8px 12px',
          background: COLOR.panel, border: `1px solid ${COLOR.border}`, borderRadius: 6,
          fontFamily: FONT_MONO, minHeight: 16,
        }}>
          {activeCell ? (
            <>
              Coast at <b>{activeCell.coastAge}</b>, retire at <b>{activeCell.targetAge}</b>: needs <b>{fmt(activeCell.val)}</b> at coast age
              {' — '}projected <b>{fmt(projectedByCoastAge[activeCell.coastAge])}</b>
              {projectedByCoastAge[activeCell.coastAge] >= activeCell.val
                ? <span style={{ color: COLOR.clearedBorder }}> (clears by {fmt(projectedByCoastAge[activeCell.coastAge] - activeCell.val)})</span>
                : <span style={{ color: COLOR.notClearedBorder }}> (short by {fmt(activeCell.val - projectedByCoastAge[activeCell.coastAge])})</span>}
            </>
          ) : (
            <span style={{ color: COLOR.body, fontFamily: FONT_SANS }}>Tap or click any cell for the coast/retire detail behind it.</span>
          )}
        </div>

        <div
          style={{ overflowX: 'auto', border: `1px solid ${COLOR.border}`, borderRadius: 8, maxHeight: '70vh', overflowY: 'auto' }}
          onMouseLeave={() => { setHoverCoast(null); setHoverTarget(null); }}
        >
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, fontFamily: FONT_MONO }}>
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
                  const colHighlighted = hoverTarget === a;
                  return (
                    <th
                      key={a}
                      onMouseEnter={() => setHoverTarget(a)}
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
                    onMouseEnter={() => setHoverCoast(coastAge)}
                    style={{
                      position: 'sticky', left: 0, zIndex: 1,
                      background: hoverCoast === coastAge
                        ? COLOR.currentRowBg
                        : (coastAge === currentAge ? COLOR.currentRowBg : COLOR.panel),
                      padding: '8px 12px',
                      color: COLOR.heading, fontWeight: 700, borderRight: `1px solid ${COLOR.border}`, borderBottom: '1px solid #D6C193',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <div>{coastAge}{coastAge === currentAge ? ' •' : ''}</div>
                    <div style={{ fontSize: 9.5, color: COLOR.body, fontWeight: 400 }}>
                      proj. {fmt(projectedByCoastAge[coastAge])}
                    </div>
                  </td>
                  {targetAges.map((targetAge, ci) => {
                    const val = grid[ri][ci];
                    if (val === null) {
                      return <td key={targetAge} style={{ padding: '8px', borderBottom: '1px solid #D6C193', background: COLOR.blankCell }} />;
                    }
                    const cleared = projectedByCoastAge[coastAge] >= val;
                    const isDiagonal = coastAge === targetAge;
                    const highlighted = hoverCoast === coastAge || hoverTarget === targetAge;
                    return (
                      <td
                        key={targetAge}
                        title={`Coast at ${coastAge}, fully retire at ${targetAge}`}
                        onMouseEnter={() => { setHoverCoast(coastAge); setHoverTarget(targetAge); }}
                        onClick={() => setActiveCell({ coastAge, targetAge, val })}
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          border: `1px solid ${cleared ? COLOR.clearedBorder : COLOR.notClearedBorder}`,
                          background: cleared ? COLOR.clearedBg : COLOR.notClearedBg,
                          color: cleared ? COLOR.clearedText : COLOR.notClearedText,
                          fontWeight: isDiagonal ? 700 : 400,
                          fontVariantNumeric: 'tabular-nums',
                          cursor: 'pointer',
                          boxShadow: highlighted ? 'inset 0 0 0 1000px rgba(59,47,31,0.07)' : 'none',
                          outline: activeCell && activeCell.coastAge === coastAge && activeCell.targetAge === targetAge
                            ? `2px solid ${COLOR.heading}` : 'none',
                          outlineOffset: -2,
                        }}
                      >
                        {fmt(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: COLOR.body, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: COLOR.heading, marginBottom: 8 }}>
            Other notes &amp; explanations
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={{ marginBottom: 6 }}>
              {horizonAdjust ? (
                <>*Safe withdrawal rate — the slider sets your baseline rate for a 30-year retirement, but a rate that's safe over 30 years isn't automatically safe over a longer stretch, or overly conservative over a shorter one. With adjustment on, the model corrects for this against your life expectancy ({lifeExpectancy}): retiring earlier means your money needs to stretch further, which lowers the effective rate (and raises the balance you need); retiring later shortens that stretch and raises the effective rate. The small % under each retirement-age column header is the adjusted rate actually used for that age.</>
              ) : (
                <>*Safe withdrawal rate — horizon adjustment is off, so your safe withdrawal rate is applied flat across every retirement age, with no correction for how long that specific retirement needs the money to last.</>
              )}
            </li>
            <li style={{ marginBottom: 6 }}>
              The stat cards above are quick reference points — the matrix below is the full picture across every coast age / retire age combination.
            </li>
            <li style={{ marginBottom: 6 }}>
              Each row's "proj." figure is your current balance plus annual contributions, both compounded at your real rate of return from now until that coast age — this is what's compared against the required balance in each cell.
            </li>
            <li style={{ marginBottom: 6 }}>
              Row marked • is your current age; its proj. figure equals your current balance since there's no runway to grow before coasting today.
            </li>
            <li style={{ marginBottom: 6 }}>
              Blank cells mean the retirement age precedes the coast age (not possible).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
