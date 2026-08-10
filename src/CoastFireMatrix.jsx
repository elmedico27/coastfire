import React, { useState, useMemo } from 'react';

const PLANNING_AGE = 90; // assumed age portfolio must last to
const ANCHOR_HORIZON = 30; // the horizon your SWR input is anchored to

// Approximate shape of how "safe" withdrawal rate shifts with horizon length.
// Not a precise formula — a reasonable approximation of published research shapes (Kitces/ERN).
const HORIZON_POINTS = [
  { horizon: 25, mult: 1.10 },
  { horizon: 30, mult: 1.00 },
  { horizon: 35, mult: 0.92 },
  { horizon: 40, mult: 0.87 },
  { horizon: 45, mult: 0.82 },
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
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}K`;
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
  clearedBg: '#96B37A',   // olive green
  clearedText: '#243019',
  notClearedBg: '#E0AC74',// warm clay
  notClearedText: '#4A2A12',
  blankCell: '#FFFBF2',
  headerBg: '#FFFBF2',
  currentRowBg: '#E8D8A9',
};

export default function CoastFireMatrix() {
  const [spending, setSpending] = useState(135000);
  const [spendingDraft, setSpendingDraft] = useState('135,000');

  const [swr, setSwr] = useState(4); // anchor SWR, %

  const [rate, setRate] = useState(7); // real return, %

  const [balance, setBalance] = useState(1250000);
  const [balanceDraft, setBalanceDraft] = useState('1,250,000');

  const [currentAge, setCurrentAge] = useState(40);

  const [annualContribution, setAnnualContribution] = useState(30000);
  const [contributionDraft, setContributionDraft] = useState('30,000');

  const targetAges = useMemo(() => Array.from({ length: 18 }, (_, i) => 45 + i), []); // 45..62
  const coastAges = useMemo(() => {
    const start = Math.min(40, currentAge);
    const len = 62 - start + 1;
    return Array.from({ length: Math.max(len, 1) }, (_, i) => start + i);
  }, [currentAge]);

  // Effective FI number per target age, horizon-adjusted off the SWR anchor
  const fiByTarget = useMemo(() => {
    const map = {};
    targetAges.forEach((targetAge) => {
      const horizon = PLANNING_AGE - targetAge;
      const mult = horizonMultiplier(horizon);
      const effSwr = (swr / 100) * mult;
      map[targetAge] = { horizon, effSwr, fi: spending / effSwr };
    });
    return map;
  }, [targetAges, spending, swr]);

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

  const handleSpendingBlur = () => {
    const parsed = parseFloat(spendingDraft.replace(/[^0-9.]/g, ''));
    const clean = isNaN(parsed) ? spending : parsed;
    setSpending(clean);
    setSpendingDraft(fmtInput(clean));
  };

  const handleBalanceBlur = () => {
    const parsed = parseFloat(balanceDraft.replace(/[^0-9.]/g, ''));
    const clean = isNaN(parsed) ? balance : parsed;
    setBalance(clean);
    setBalanceDraft(fmtInput(clean));
  };

  const handleContributionBlur = () => {
    const parsed = parseFloat(contributionDraft.replace(/[^0-9.]/g, ''));
    const clean = isNaN(parsed) ? annualContribution : parsed;
    setAnnualContribution(clean);
    setContributionDraft(fmtInput(clean));
  };

  const inputStyle = {
    background: COLOR.inputBg,
    border: `1px solid ${COLOR.inputBorder}`,
    borderRadius: 4,
    color: COLOR.inputText,
    fontFamily: 'inherit',
    fontSize: 14,
    padding: '8px 10px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
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

  const anchorFi = spending / (swr / 100);

  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      background: COLOR.page,
      minHeight: '100vh',
      color: COLOR.body,
      padding: '32px 20px',
    }}>
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 13, letterSpacing: '0.02em', color: COLOR.label, marginBottom: 8, fontWeight: 600 }}>
            Coast FIRE Planner
          </div>
          <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 500, fontSize: 34, margin: '0 0 8px', color: COLOR.heading }}>
            CoastFIRE Matrix
          </h1>
          <div style={{ fontSize: 13.5, color: COLOR.body, lineHeight: 1.5, maxWidth: 640 }}>
            Find the balance you need, at each age you might stop contributing, to coast — untouched — to full financial independence by any retirement age.
          </div>
        </div>

        {/* Your numbers */}
        <div style={{
          background: COLOR.panel,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 8,
          padding: 18,
          marginBottom: 14,
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
              <label style={labelStyle}>Current age</label>
              <input
                style={inputStyle}
                type="number" min="18" max="62"
                value={currentAge}
                onChange={(e) => setCurrentAge(parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <div>
              <label style={labelStyle}>Current investment balance</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: 9, color: COLOR.label }}>$</span>
                <input
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
              <label style={labelStyle}>Annual contributions until coast</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: 9, color: COLOR.label }}>$</span>
                <input
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
              <label style={labelStyle}>Annual retirement spend</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: 9, color: COLOR.label }}>$</span>
                <input
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
        </div>

        {/* Model dials */}
        <div style={{
          background: COLOR.panel,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 8,
          padding: 18,
          marginBottom: 16,
        }}>
          <div style={groupHeaderStyle}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR.label, display: 'inline-block' }} />
            Model dials
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 14,
            alignItems: 'end',
          }}>
            <div>
              <label style={labelStyle}>SWR anchor (30-yr horizon)</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 24 }}
                  type="number" step="0.1" min="1" max="10"
                  value={swr}
                  onChange={(e) => setSwr(parseFloat(e.target.value) || 0)}
                />
                <span style={{ position: 'absolute', right: 10, top: 9, color: COLOR.label }}>%</span>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Real rate of return</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 24 }}
                  type="number" step="0.1" min="0" max="12"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                />
                <span style={{ position: 'absolute', right: 10, top: 9, color: COLOR.label }}>%</span>
              </div>
            </div>

            <div style={{
              gridColumn: 'span 1',
              background: COLOR.page,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 6,
              padding: '10px 14px',
            }}>
              <label style={{ ...labelStyle, marginBottom: 4 }}>Anchor FI number (age 60)</label>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.heading, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(anchorFi)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: COLOR.body, marginBottom: 16, lineHeight: 1.5 }}>
          FI number varies by target age: effective SWR = anchor SWR × horizon multiplier, where horizon = {PLANNING_AGE} − target age.
          Shorter horizons (later target ages) get a higher effective SWR and lower FI number; longer horizons (earlier target ages) get a lower effective SWR and higher FI number.
          This multiplier curve is an approximation, not a precise formula.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 12, color: COLOR.body }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, background: COLOR.clearedBg, display: 'inline-block', borderRadius: 2 }} />
            projected balance clears this target
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, background: COLOR.notClearedBg, display: 'inline-block', borderRadius: 2 }} />
            projected balance falls short
          </span>
        </div>

        <div style={{ overflowX: 'auto', border: `1px solid ${COLOR.border}`, borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{
                  position: 'sticky', left: 0, background: COLOR.headerBg, padding: '10px 12px',
                  textAlign: 'left', color: COLOR.heading, borderBottom: `1px solid ${COLOR.border}`, borderRight: `1px solid ${COLOR.border}`,
                  fontWeight: 700, fontSize: 12
                }}>
                  Coast ↓ / Target →
                </th>
                {targetAges.map((a) => (
                  <th key={a} style={{
                    padding: '8px 8px', textAlign: 'center', color: COLOR.heading, background: COLOR.headerBg,
                    borderBottom: `1px solid ${COLOR.border}`, fontWeight: 700, minWidth: 70
                  }}>
                    <div>{a}</div>
                    <div style={{ fontSize: 9.5, color: COLOR.body, fontWeight: 400 }}>
                      {(fiByTarget[a].effSwr * 100).toFixed(2)}%
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coastAges.map((coastAge, ri) => (
                <tr key={coastAge}>
                  <td style={{
                    position: 'sticky', left: 0, background: coastAge === currentAge ? COLOR.currentRowBg : COLOR.panel, padding: '8px 12px',
                    color: COLOR.heading, fontWeight: 700, borderRight: `1px solid ${COLOR.border}`, borderBottom: '1px solid #D6C193'
                  }}>
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
                    return (
                      <td
                        key={targetAge}
                        title={`Coast at ${coastAge}, fully retire at ${targetAge}`}
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          borderBottom: '1px solid #D6C193',
                          background: cleared ? COLOR.clearedBg : COLOR.notClearedBg,
                          color: cleared ? COLOR.clearedText : COLOR.notClearedText,
                          fontWeight: isDiagonal ? 700 : 400,
                          fontVariantNumeric: 'tabular-nums',
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
          Each row's "proj." figure is your current balance plus annual contributions, both compounded from now until that coast age — this is what's compared against the required balance in each cell.
          Row marked • is your current age; its projected balance equals your current balance since there's no runway to grow before coasting today.
          Small % under each target age column is the horizon-adjusted effective SWR used for that column. Blank cells mean target precedes coast (not possible).
          Mortgage payoff (~2049) sits outside this grid for most current-age/target combinations — revisit if your target age pushes past 63.
        </div>
      </div>
    </div>
  );
}
