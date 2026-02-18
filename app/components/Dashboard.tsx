'use client';

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, ComposedChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Treemap } from 'recharts';
import { Building2, TrendingUp, DollarSign, Percent, AlertTriangle, XCircle, ChevronRight, ChevronDown, ChevronUp, Target, Shield, Wallet, Calculator, MapPin, Eye, Layers, Lock, Receipt, Landmark, RefreshCw } from 'lucide-react';

interface Asset {
  id: number;
  name: string;
  zone: string;
  sqm: number;
  purchasePrice: number;
  txCosts: number;
  capex: number;
  totalBasis: number;
  currentValue: number;
  monthlyGross: number;
  marketRent: number;
  occupancy: number;
  ibi: number;
  community: number;
  insurance: number;
  loanBalance: number;
  rate: number;
  monthlyDS: number;
  tenantType: string;
}

interface PipelineDeal {
  id: string;
  name: string;
  price: number;
  estBasis: number;
  arras: number;
  paid: boolean;
  deadline: string | null;
  estYield: number;
  prob: number;
}

interface Config {
  name: string;
  reportDate: string;
  targetYield: number;
  targetCoC: number;
  targetDSCR: number;
  depreciationRate: number;
  constructionRatio: number;
  marginalTaxRate: number;
  rentalReduction: number;
}

interface DashboardProps {
  initialAssets: Asset[];
  initialPipeline: PipelineDeal[];
  initialConfig: Config;
}

const C = {
  gross: (a: Asset, config: Config) => a.monthlyGross * 12,
  opex: (a: Asset) => a.ibi + a.community + a.insurance,
  noi: (a: Asset, config: Config) => C.gross(a, config) - C.opex(a),
  ds: (a: Asset) => a.monthlyDS * 12,
  interest: (a: Asset) => a.loanBalance * (a.rate / 100),
  principal: (a: Asset) => C.ds(a) - C.interest(a),
  cfPre: (a: Asset, config: Config) => C.noi(a, config) - C.ds(a),
  depreciation: (a: Asset, config: Config) => a.purchasePrice * config.constructionRatio * config.depreciationRate,
  taxableBase: (a: Asset, config: Config) => a.monthlyGross === 0 ? 0 : Math.max(0, C.gross(a, config) - C.opex(a) - C.interest(a) - C.depreciation(a, config)),
  taxableIncome: (a: Asset, config: Config) => C.taxableBase(a, config) * (1 - config.rentalReduction),
  tax: (a: Asset, config: Config) => C.taxableIncome(a, config) * config.marginalTaxRate,
  cfPost: (a: Asset, config: Config) => C.cfPre(a, config) - C.tax(a, config),
  gY: (a: Asset, config: Config) => a.totalBasis > 0 ? C.gross(a, config) / a.totalBasis : 0,
  nY: (a: Asset, config: Config) => a.totalBasis > 0 ? C.noi(a, config) / a.totalBasis : 0,
  cocPre: (a: Asset, config: Config) => { const e = a.totalBasis - a.loanBalance; return e > 0 ? C.cfPre(a, config) / e : 0; },
  cocPost: (a: Asset, config: Config) => { const e = a.totalBasis - a.loanBalance; return e > 0 ? C.cfPost(a, config) / e : 0; },
  dscr: (a: Asset, config: Config) => a.monthlyDS > 0 ? C.noi(a, config) / C.ds(a) : null,
  ltv: (a: Asset) => a.currentValue > 0 ? a.loanBalance / a.currentValue : 0,
  ext: (a: Asset) => Math.max(0, (a.currentValue * 0.70) - a.loanBalance),
  eq: (a: Asset) => a.totalBasis - a.loanBalance,
  unr: (a: Asset) => a.currentValue - a.totalBasis
};

const computePortfolio = (assets: Asset[], config: Config) => {
  const op = assets.filter(a => a.occupancy > 0);
  const lev = assets.filter(a => a.loanBalance > 0);
  const tB = assets.reduce((s, a) => s + a.totalBasis, 0);
  const tV = assets.reduce((s, a) => s + a.currentValue, 0);
  const tD = assets.reduce((s, a) => s + a.loanBalance, 0);
  const aG = op.reduce((s, a) => s + C.gross(a, config), 0);
  const aO = op.reduce((s, a) => s + C.opex(a), 0);
  const aN = op.reduce((s, a) => s + C.noi(a, config), 0);
  const aDS = lev.reduce((s, a) => s + C.ds(a), 0);
  const aInt = lev.reduce((s, a) => s + C.interest(a), 0);
  const aPr = lev.reduce((s, a) => s + C.principal(a), 0);
  const aDep = op.reduce((s, a) => s + C.depreciation(a, config), 0);
  const aTax = op.reduce((s, a) => s + C.tax(a, config), 0);
  const aCFPre = op.reduce((s, a) => s + C.cfPre(a, config), 0);
  const aCFPost = op.reduce((s, a) => s + C.cfPost(a, config), 0);
  const opB = op.reduce((s, a) => s + a.totalBasis, 0);
  const opE = op.reduce((s, a) => s + C.eq(a), 0);
  return {
    count: assets.length,
    operating: op.length,
    vacant: assets.filter(a => a.occupancy === 0).length,
    tB, tV, tD,
    nav: tV - tD,
    tE: tB - tD,
    unr: tV - tB,
    aG, aO, aN, aDS, aInt, aPr, aDep, aTax, aCFPre, aCFPost,
    mCFPre: aCFPre / 12,
    mCFPost: aCFPost / 12,
    gY: opB > 0 ? aG / opB : 0,
    nY: opB > 0 ? aN / opB : 0,
    cocPre: opE > 0 ? aCFPre / opE : 0,
    cocPost: opE > 0 ? aCFPost / opE : 0,
    dscr: aDS > 0 ? aN / aDS : null,
    wLTV: tV > 0 ? tD / tV : 0,
    ext: assets.reduce((s, a) => s + C.ext(a), 0)
  };
};

const F = {
  eur: (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n),
  eurK: (n: number) => n >= 1e6 ? `€${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `€${(n/1e3).toFixed(0)}k` : F.eur(n),
  pct: (n: number, d = 1) => `${(n * 100).toFixed(d)}%`,
  x: (n: number | null) => n !== null ? `${n.toFixed(2)}x` : '—',
  date: (d: string) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
};

const TH = {
  yield: (v: number) => v >= 0.12 ? 'green' : v >= 0.10 ? 'amber' : 'red',
  coc: (v: number) => v >= 0.12 ? 'green' : v >= 0.08 ? 'amber' : 'red',
  dscr: (v: number | null) => v === null ? 'muted' : v >= 1.25 ? 'green' : v >= 1.0 ? 'amber' : 'red',
  ltv: (v: number) => v === 0 ? 'muted' : v <= 0.60 ? 'green' : v <= 0.75 ? 'amber' : 'red'
};

const COL: Record<string, any> = {
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', fill: '#10b981' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', fill: '#f59e0b' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', fill: '#ef4444' },
  muted: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', fill: '#94a3b8' },
  primary: '#0f172a', accent: '#3b82f6', income: '#10b981', expense: '#f59e0b', interest: '#ef4444', depreciation: '#8b5cf6', tax: '#ec4899'
};

const daysTo = (d: string | null, reportDate: string) => d ? Math.ceil((new Date(d).getTime() - new Date(reportDate).getTime()) / 864e5) : null;

const Dot = ({ status }: { status: string }) => <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COL[status]?.fill || COL.muted.fill }} />;

const Card = ({ label, value, sub, status, icon: Icon, compact }: any) => {
  const c = COL[status] || COL.muted;
  return (
    <div className={`bg-white rounded-xl border ${c.border} ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={compact ? 12 : 14} className="text-slate-400" />}
      </div>
      <span className={`${compact ? 'text-lg' : 'text-2xl'} font-bold ${c.text}`}>{value}</span>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
};

const Alert = ({ type, title, msg }: any) => {
  const c = type === 'critical' ? COL.red : COL.amber;
  const Icon = type === 'critical' ? XCircle : AlertTriangle;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl ${c.bg} border ${c.border}`}>
      <Icon size={18} className={c.text} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${c.text}`}>{title}</p>
        <p className="text-xs text-slate-600">{msg}</p>
      </div>
    </div>
  );
};

const PLRow = ({ label, value, color, indent, bold, border }: any) => (
  <div className={`flex justify-between py-1.5 ${border ? 'border-t border-slate-200 pt-2 mt-1' : ''} ${indent ? 'pl-4' : ''}`}>
    <span className={`text-sm ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</span>
    <span className={`text-sm font-medium ${bold ? 'font-bold' : ''}`} style={{ color: color || (value >= 0 ? COL.green.fill : COL.red.fill) }}>
      {value >= 0 ? '+' : ''}{F.eur(value)}
    </span>
  </div>
);

export default function Dashboard({ initialAssets, initialPipeline, initialConfig }: DashboardProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [pipeline, setPipeline] = useState(initialPipeline);
  const [config, setConfig] = useState(initialConfig);
  const [level, setLevel] = useState(1);
  const [sel, setSel] = useState<any>(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [drill, setDrill] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      setAssets(data.assets);
      setPipeline(data.pipeline);
      setConfig(data.config);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
    setIsRefreshing(false);
  };

  const P = useMemo(() => computePortfolio(assets, config), [assets, config]);

  const data = useMemo(() => assets.map(a => ({
    ...a,
    gY: C.gY(a, config),
    nY: C.nY(a, config),
    noi: C.noi(a, config),
    aInt: C.interest(a),
    aPr: C.principal(a),
    aDep: C.depreciation(a, config),
    aTax: C.tax(a, config),
    cfPre: C.cfPre(a, config),
    cfPost: C.cfPost(a, config),
    mCFPre: C.cfPre(a, config) / 12,
    mCFPost: C.cfPost(a, config) / 12,
    cocPre: C.cocPre(a, config),
    cocPost: C.cocPost(a, config),
    dscr: C.dscr(a, config),
    ltv: C.ltv(a),
    eq: C.eq(a),
    unr: C.unr(a),
    ext: C.ext(a)
  })), [assets, config]);

  const alerts = useMemo(() => {
    const arr: any[] = [];
    data.filter(a => a.occupancy === 0).forEach(a => arr.push({ type: 'critical', title: `${a.name} — ${a.tenantType}`, msg: `Potential: ${F.eur(a.marketRent)}/mo` }));
    data.filter(a => a.dscr !== null && a.dscr < 1.25).forEach(a => arr.push({ type: (a.dscr as number) < 1 ? 'critical' : 'warning', title: `${a.name} — DSCR ${F.x(a.dscr)}`, msg: 'Below target' }));
    pipeline.forEach(p => { const d = daysTo(p.deadline, config.reportDate); if (d !== null && d < 45) arr.push({ type: d < 30 ? 'critical' : 'warning', title: `${p.name} — ${d}d`, msg: F.eur(p.price) }); });
    return arr.sort((x, y) => (x.type === 'critical' ? 0 : 1) - (y.type === 'critical' ? 0 : 1));
  }, [data, pipeline, config.reportDate]);

  const yieldChart = useMemo(() => data.filter(a => a.gY > 0).map(a => ({ name: a.name.slice(0, 10), gross: a.gY * 100, net: a.nY * 100, cocPre: a.cocPre * 100, cocPost: a.cocPost * 100 })).sort((a, b) => b.gross - a.gross), [data]);
  const breakdown = useMemo(() => data.filter(a => a.monthlyGross > 0).map(a => ({ name: a.name.slice(0, 12), gross: C.gross(a, config), noi: a.noi, cfPre: a.cfPre, cfPost: a.cfPost })).sort((a, b) => b.cfPost - a.cfPost), [data, config]);
  const treemap = useMemo(() => data.filter(a => a.cfPost > 0).map(a => ({ name: a.name, size: a.cfPost, cfPost: a.cfPost })), [data]);
  const stress = useMemo(() => [
    { scenario: 'Base Case', dscr: P.dscr, cf: P.aCFPost },
    { scenario: '+100bps', dscr: P.aDS > 0 ? P.aN / (P.aDS * 1.12) : null, cf: P.aCFPost - (P.aInt * 0.12) },
    { scenario: '10% Vacancy', dscr: P.aDS > 0 ? (P.aN * 0.9) / P.aDS : null, cf: P.aCFPost * 0.85 },
    { scenario: 'Combined', dscr: P.aDS > 0 ? (P.aN * 0.9) / (P.aDS * 1.12) : null, cf: P.aCFPost * 0.75 }
  ], [P]);

  const mGross = P.aG / 12;
  const mOpex = P.aO / 12;
  const mInt = P.aInt / 12;
  const mPrinc = P.aPr / 12;
  const mTax = P.aTax / 12;
  const mNet = P.mCFPost;

  const Tree = ({ x, y, width, height, name, cfPost }: any) => {
    if (width < 50 || height < 30) return null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={COL.green.fill} fillOpacity={0.8} stroke="#fff" strokeWidth={2} rx={4} />
        <text x={x + width/2} y={y + height/2 - 6} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="600">{name}</text>
        <text x={x + width/2} y={y + height/2 + 8} textAnchor="middle" fill="#fff" fontSize={9}>{F.eur(cfPost)}/yr</text>
      </g>
    );
  };

  const getAssetCapitalPie = (a: any) => {
    if (!a) return [];
    return [
      { name: 'Equity', value: a.eq, fill: COL.green.fill },
      { name: 'Debt', value: a.loanBalance, fill: COL.red.fill }
    ].filter(d => d.value > 0);
  };

  const getAssetValuePie = (a: any) => {
    if (!a) return [];
    const gain = a.currentValue - a.totalBasis;
    return [
      { name: 'Cost Basis', value: a.totalBasis, fill: COL.accent },
      { name: gain >= 0 ? 'Unrealized Gain' : 'Unrealized Loss', value: Math.abs(gain), fill: gain >= 0 ? COL.green.fill : COL.red.fill }
    ];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg">
                <Building2 size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{config.name}</h1>
                <p className="text-sm text-slate-500">Dashboard GPT v2.2 • Live Data</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all text-sm font-medium"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <div className="flex gap-3 text-xs font-medium">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{P.operating} Operating</span>
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700">{P.vacant} Vacant</span>
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{pipeline.length} Pipeline</span>
              </div>
              <div className="text-right border-l border-slate-200 pl-6">
                <p className="text-xs text-slate-400">IRPF {F.pct(config.marginalTaxRate,0)} | Red. {F.pct(config.rentalReduction,0)}</p>
                <p className="text-sm font-bold text-slate-800">{F.date(config.reportDate)}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1 mt-4 bg-slate-100 p-1 rounded-xl w-fit">
            {[{ l: 1, label: 'Executive Overview', icon: Eye }, { l: 2, label: 'Asset Deep Dive', icon: Layers }, { l: 3, label: 'Strategic', icon: Target }].map(({ l, label, icon: Icon }) => (
              <button key={l} onClick={() => setLevel(l)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${level === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
                <Icon size={16} /><span>L{l}: {label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {level === 1 && (
          <>
            {alerts.length > 0 && (
              <section className={`rounded-2xl border p-4 ${alerts.some(a => a.type === 'critical') ? 'bg-red-50/50 border-red-200' : 'bg-amber-50/50 border-amber-200'}`}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAlerts(!showAlerts)}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={20} className={alerts.some(a => a.type === 'critical') ? 'text-red-600' : 'text-amber-600'} />
                    <h2 className={`text-base font-bold ${alerts.some(a => a.type === 'critical') ? 'text-red-800' : 'text-amber-800'}`}>Action Items ({alerts.length})</h2>
                  </div>
                  {showAlerts ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
                {showAlerts && <div className="grid grid-cols-3 gap-3 mt-4">{alerts.slice(0, 6).map((a, i) => <Alert key={i} {...a} />)}</div>}
              </section>
            )}

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Portfolio Valuation</h2>
              <div className="grid grid-cols-6 gap-4">
                <Card label="NAV" value={F.eurK(P.nav)} sub={`Value ${F.eurK(P.tV)} − Debt ${F.eurK(P.tD)}`} icon={Building2} />
                <Card label="Equity" value={F.eurK(P.tE)} sub={`${P.count} assets`} icon={Wallet} />
                <Card label="Unrealized" value={F.eurK(P.unr)} status={P.unr >= 0 ? 'green' : 'red'} icon={TrendingUp} />
                <Card label="Gross Yield" value={F.pct(P.gY)} sub={`Target: ${F.pct(config.targetYield)}`} status={TH.yield(P.gY)} icon={Percent} />
                <Card label="Net Yield" value={F.pct(P.nY)} sub={`NOI: ${F.eurK(P.aN)}/yr`} status={TH.yield(P.nY)} icon={Percent} />
                <Card label="DSCR" value={F.x(P.dscr)} sub={`Min: ${F.x(config.targetDSCR)}`} status={TH.dscr(P.dscr)} icon={Shield} />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Returns & Cash Flow</h2>
              <div className="grid grid-cols-6 gap-4">
                <Card label="CF Pre-Tax" value={F.eurK(P.aCFPre)} sub={`${F.eur(P.mCFPre)}/mo`} status={P.aCFPre >= 0 ? 'green' : 'red'} icon={DollarSign} />
                <Card label="CF Post-Tax" value={F.eurK(P.aCFPost)} sub={`${F.eur(P.mCFPost)}/mo`} status={P.aCFPost >= 0 ? 'green' : 'red'} icon={Receipt} />
                <Card label="CoC Pre-Tax" value={F.pct(P.cocPre)} status={TH.coc(P.cocPre)} icon={TrendingUp} />
                <Card label="CoC Post-Tax" value={F.pct(P.cocPost)} status={TH.coc(P.cocPost)} icon={TrendingUp} />
                <Card label="IRPF Tax" value={F.eurK(P.aTax)} sub={`Eff: ${F.pct(P.aG > 0 ? P.aTax / P.aG : 0)}`} icon={Landmark} />
                <Card label="Depreciation" value={F.eurK(P.aDep)} sub="Tax shield" icon={Calculator} />
              </div>
            </section>

            {/* Waterfall Chart */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Aggregate Portfolio Performance (Monthly)</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-3">Cash Flow Waterfall — from Gross Rent to Net CF</p>
                  <div className="h-72">
                    <svg viewBox="0 0 600 280" className="w-full h-full">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                        <line key={i} x1="70" y1={30 + i * 30} x2="580" y2={30 + i * 30} stroke="#e2e8f0" strokeWidth="1" />
                      ))}
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                        <text key={i} x="65" y={245 - i * 30} textAnchor="end" fontSize="10" fill="#64748b">
                          €{Math.round((mGross / 7) * i / 100) * 100}
                        </text>
                      ))}
                      {(() => {
                        const maxVal = mGross;
                        const barWidth = 60;
                        const chartHeight = 210;
                        const startY = 240;
                        const scale = chartHeight / maxVal;
                        const afterOpex = mGross - mOpex;
                        const afterInt = afterOpex - mInt;
                        const afterPrinc = afterInt - mPrinc;
                        const bars = [
                          { x: 90, height: mGross * scale, y: startY - mGross * scale, fill: COL.income, label: 'Gross Rent', value: mGross },
                          { x: 170, height: mOpex * scale, y: startY - mGross * scale, fill: COL.expense, label: '− OpEx', value: mOpex },
                          { x: 250, height: mInt * scale, y: startY - afterOpex * scale - mInt * scale, fill: COL.interest, label: '− Interest', value: mInt },
                          { x: 330, height: mPrinc * scale, y: startY - afterInt * scale - mPrinc * scale, fill: '#f97316', label: '− Principal', value: mPrinc },
                          { x: 410, height: mTax * scale, y: startY - afterPrinc * scale - mTax * scale, fill: COL.tax, label: '− Tax', value: mTax },
                          { x: 490, height: mNet * scale, y: startY - mNet * scale, fill: mNet >= 0 ? COL.green.fill : COL.red.fill, label: 'Net CF', value: mNet },
                        ];
                        return bars.map((bar, i) => (
                          <g key={i}>
                            <rect x={bar.x} y={bar.y} width={barWidth} height={Math.max(bar.height, 1)} fill={bar.fill} rx="4" />
                            <text x={bar.x + barWidth/2} y={260} textAnchor="middle" fontSize="10" fill="#475569">{bar.label}</text>
                            <text x={bar.x + barWidth/2} y={bar.y + bar.height/2 + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="600">
                              {F.eur(bar.value)}
                            </text>
                          </g>
                        ));
                      })()}
                    </svg>
                  </div>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Monthly Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Gross Rent</span>
                      <span className="text-sm font-bold text-emerald-600">{F.eur(mGross)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">− OpEx</span>
                      <span className="text-sm font-medium text-amber-600">−{F.eur(mOpex)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">− Interest</span>
                      <span className="text-sm font-medium text-red-600">−{F.eur(mInt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">− Principal</span>
                      <span className="text-sm font-medium text-orange-600">−{F.eur(mPrinc)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">− Tax (IRPF)</span>
                      <span className="text-sm font-medium text-pink-600">−{F.eur(mTax)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-800">Net CF Post-Tax</span>
                        <span className="text-xl font-bold" style={{ color: mNet >= 0 ? COL.green.fill : COL.red.fill }}>{F.eur(mNet)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Annual: {F.eur(P.aCFPost)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Cash Flow Section */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Portfolio Cash Flow</h2>
                  <p className="text-sm text-slate-500">{drill ? 'By Asset' : 'Aggregate'}</p>
                </div>
                <button onClick={() => setDrill(!drill)} className={`px-4 py-2 rounded-lg text-sm font-medium ${drill ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {drill ? '← Aggregate' : 'Drill Down →'}
                </button>
              </div>
              {!drill ? (
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 mb-2">Post-Tax CF by Asset (click for details)</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <Treemap data={treemap} dataKey="size" stroke="#fff" content={<Tree />} onClick={(d: any) => { if (d?.name) { const a = data.find(x => x.name === d.name); if (a) { setSel(a); setLevel(2); } } }} />
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Annual P&L Summary</h3>
                    <PLRow label="Gross Rental Income" value={P.aG} color={COL.income} />
                    <PLRow label="Operating Expenses" value={-P.aO} color={COL.expense} indent />
                    <PLRow label="NOI" value={P.aN} color={COL.accent} bold border />
                    <PLRow label="Interest Expense" value={-P.aInt} color={COL.interest} indent />
                    <PLRow label="Principal Repayment" value={-P.aPr} color="#f97316" indent />
                    <PLRow label="CF Pre-Tax" value={P.aCFPre} color={COL.accent} bold border />
                    <PLRow label="Depreciation" value={-P.aDep} color={COL.depreciation} indent />
                    <PLRow label="Tax (IRPF)" value={-P.aTax} color={COL.tax} indent />
                    <PLRow label="CF Post-Tax" value={P.aCFPost} color={COL.primary} bold border />
                    <div className="mt-4 p-3 bg-emerald-50 rounded-lg flex justify-between">
                      <span className="text-sm text-emerald-700">Monthly Post-Tax</span>
                      <span className="text-lg font-bold text-emerald-700">{F.eur(P.mCFPost)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={breakdown} margin={{ bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={60} />
                      <YAxis tickFormatter={v => F.eurK(v)} />
                      <Tooltip formatter={(v: any) => [F.eur(v)]} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="gross" name="Gross" fill={COL.income} radius={[4,4,0,0]} barSize={12} />
                      <Bar dataKey="noi" name="NOI" fill={COL.accent} radius={[4,4,0,0]} barSize={12} />
                      <Bar dataKey="cfPre" name="Pre-Tax" fill="#6366f1" radius={[4,4,0,0]} barSize={12} />
                      <Bar dataKey="cfPost" name="Post-Tax" fill={COL.primary} radius={[4,4,0,0]} barSize={12} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Yield Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Yield & Return by Asset</h3>
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1"><div className="w-3 h-2 rounded" style={{ background: COL.primary }} />Gross</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-2 rounded" style={{ background: COL.accent }} />Net</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-2 rounded" style={{ background: '#6366f1' }} />CoC Pre</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-2 rounded" style={{ background: COL.green.fill }} />CoC Post</span>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={yieldChart} margin={{ bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={45} />
                    <YAxis tickFormatter={v => v + '%'} domain={[0, 'auto']} />
                    <Tooltip formatter={(v: any) => [v.toFixed(1) + '%']} />
                    <ReferenceLine y={12} stroke="#6366f1" strokeDasharray="6 4" strokeWidth={2} />
                    <Bar dataKey="gross" fill={COL.primary} radius={[4,4,0,0]} barSize={8} />
                    <Bar dataKey="net" fill={COL.accent} radius={[4,4,0,0]} barSize={8} />
                    <Bar dataKey="cocPre" fill="#6366f1" radius={[4,4,0,0]} barSize={8} />
                    <Bar dataKey="cocPost" fill={COL.green.fill} radius={[4,4,0,0]} barSize={8} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Asset Table */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Asset Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Asset</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-right">Gross</th>
                      <th className="px-3 py-3 text-right">Net</th>
                      <th className="px-3 py-3 text-right">CF Post</th>
                      <th className="px-3 py-3 text-right">CoC Post</th>
                      <th className="px-3 py-3 text-center">DSCR</th>
                      <th className="px-3 py-3 text-center">LTV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSel(a); setLevel(2); }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ChevronRight size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-800">{a.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.occupancy > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{a.tenantType}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">{a.gY > 0 && <Dot status={TH.yield(a.gY)} />}{a.gY > 0 ? F.pct(a.gY) : '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">{a.nY > 0 && <Dot status={TH.yield(a.nY)} />}{a.nY > 0 ? F.pct(a.nY) : '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium" style={{ color: a.cfPost > 0 ? COL.green.fill : COL.red.fill }}>{a.monthlyGross > 0 ? F.eur(a.cfPost) : '—'}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">{a.cocPost !== 0 && <Dot status={TH.coc(a.cocPost)} />}{a.cocPost !== 0 ? F.pct(a.cocPost) : '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">{a.dscr !== null && <Dot status={TH.dscr(a.dscr)} />}{F.x(a.dscr)}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">{a.ltv > 0 && <Dot status={TH.ltv(a.ltv)} />}{F.pct(a.ltv)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-semibold">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>PORTFOLIO</td>
                      <td className="px-3 py-3 text-right">{F.pct(P.gY)}</td>
                      <td className="px-3 py-3 text-right">{F.pct(P.nY)}</td>
                      <td className="px-3 py-3 text-right">{F.eur(P.aCFPost)}</td>
                      <td className="px-3 py-3 text-right">{F.pct(P.cocPost)}</td>
                      <td className="px-3 py-3 text-center">{F.x(P.dscr)}</td>
                      <td className="px-3 py-3 text-center">{F.pct(P.wLTV)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Level 2: Asset Deep Dive */}
        {level === 2 && (
          <div className="grid grid-cols-4 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Select Asset</h3>
              {data.map(a => (
                <div key={a.id} onClick={() => setSel(a)} className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${sel?.id === a.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 text-sm">{a.name}</span>
                    <Dot status={a.occupancy > 0 ? TH.coc(a.cocPost) : 'red'} />
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{a.zone}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-500">CoC Post</span><p className="font-medium">{a.cocPost !== 0 ? F.pct(a.cocPost) : '—'}</p></div>
                    <div><span className="text-slate-500">CF/mo</span><p className="font-medium" style={{ color: a.mCFPost > 0 ? COL.green.fill : COL.red.fill }}>{a.monthlyGross > 0 ? F.eur(a.mCFPost) : '—'}</p></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="col-span-3 space-y-6">
              {sel ? (
                <>
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">{sel.name}</h2>
                        <p className="text-slate-500 flex items-center gap-2 mt-1"><MapPin size={14} />{sel.zone}</p>
                        <p className="text-sm text-slate-400 mt-1">{sel.sqm}m²</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${sel.occupancy > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{sel.tenantType}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    <Card label="Gross Yield" value={F.pct(sel.gY)} status={TH.yield(sel.gY)} compact />
                    <Card label="Net Yield" value={F.pct(sel.nY)} status={TH.yield(sel.nY)} compact />
                    <Card label="CoC Pre" value={F.pct(sel.cocPre)} status={TH.coc(sel.cocPre)} compact />
                    <Card label="CoC Post" value={F.pct(sel.cocPost)} status={TH.coc(sel.cocPost)} compact />
                    <Card label="DSCR" value={F.x(sel.dscr)} status={TH.dscr(sel.dscr)} compact />
                  </div>

                  {sel.monthlyGross > 0 && (
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Monthly Cash Flow</h3>
                        <div className="h-48">
                          {(() => {
                            const gross = C.gross(sel, config) / 12;
                            const opex = C.opex(sel) / 12;
                            const int = C.interest(sel) / 12;
                            const princ = C.principal(sel) / 12;
                            const tax = C.tax(sel, config) / 12;
                            const net = C.cfPost(sel, config) / 12;
                            const afterOpex = gross - opex;
                            const afterInt = afterOpex - int;
                            const afterPrinc = afterInt - princ;
                            const maxVal = gross;
                            const barWidth = 35;
                            const chartHeight = 130;
                            const startY = 150;
                            const scale = chartHeight / maxVal;
                            const bars = [
                              { x: 25, height: gross * scale, y: startY - gross * scale, fill: COL.income, label: 'Gross' },
                              { x: 70, height: opex * scale, y: startY - gross * scale, fill: COL.expense, label: '−OpEx' },
                              { x: 115, height: int * scale, y: startY - afterOpex * scale - int * scale, fill: COL.interest, label: '−Int' },
                              { x: 160, height: princ * scale, y: startY - afterInt * scale - princ * scale, fill: '#f97316', label: '−Princ' },
                              { x: 205, height: tax * scale, y: startY - afterPrinc * scale - tax * scale, fill: COL.tax, label: '−Tax' },
                              { x: 250, height: Math.abs(net) * scale, y: startY - Math.abs(net) * scale, fill: net >= 0 ? COL.green.fill : COL.red.fill, label: 'Net' },
                            ];
                            return (
                              <svg viewBox="0 0 300 180" className="w-full h-full">
                                {[0,1,2,3,4,5].map(i => (
                                  <line key={i} x1="20" y1={20 + i*26} x2="290" y2={20 + i*26} stroke="#e2e8f0" strokeWidth="0.5" />
                                ))}
                                {bars.map((bar, i) => (
                                  <g key={i}>
                                    <rect x={bar.x} y={bar.y} width={barWidth} height={Math.max(bar.height, 2)} fill={bar.fill} rx="3" />
                                    <text x={bar.x + barWidth/2} y={168} textAnchor="middle" fontSize="8" fill="#475569">{bar.label}</text>
                                  </g>
                                ))}
                              </svg>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Capital Structure</h3>
                        <div className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={getAssetCapitalPie(sel)} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
                                {getAssetCapitalPie(sel).map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => F.eur(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-4 text-xs">
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ background: COL.green.fill }} />Equity {F.pct(sel.eq / sel.totalBasis)}</span>
                          {sel.loanBalance > 0 && <span className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ background: COL.red.fill }} />Debt {F.pct(sel.loanBalance / sel.totalBasis)}</span>}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Value vs Cost</h3>
                        <div className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={getAssetValuePie(sel)} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
                                {getAssetValuePie(sel).map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => F.eur(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-center text-xs">
                          <span className={sel.unr >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {sel.unr >= 0 ? '+' : ''}{F.eur(sel.unr)} ({F.pct(sel.unr / sel.totalBasis)})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Receipt size={16} />Annual P&L</h3>
                      <PLRow label="Gross Rental Income" value={C.gross(sel, config)} color={COL.income} />
                      <PLRow label="IBI" value={-sel.ibi} color={COL.expense} indent />
                      <PLRow label="Community" value={-sel.community} color={COL.expense} indent />
                      <PLRow label="Insurance" value={-sel.insurance} color={COL.expense} indent />
                      <PLRow label="NOI" value={sel.noi} color={COL.accent} bold border />
                      <PLRow label="Interest" value={-sel.aInt} color={COL.interest} indent />
                      <PLRow label="Principal" value={-sel.aPr} color="#f97316" indent />
                      <PLRow label="CF Pre-Tax" value={sel.cfPre} color={COL.accent} bold border />
                      <PLRow label="Depreciation" value={-sel.aDep} color={COL.depreciation} indent />
                      <PLRow label="Tax (IRPF)" value={-sel.aTax} color={COL.tax} indent />
                      <PLRow label="CF Post-Tax" value={sel.cfPost} color={COL.primary} bold border />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                          <p className="text-xs text-slate-500">Monthly Pre</p>
                          <p className="text-lg font-bold" style={{ color: sel.mCFPre >= 0 ? COL.green.fill : COL.red.fill }}>{F.eur(sel.mCFPre)}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg text-center">
                          <p className="text-xs text-emerald-600">Monthly Post</p>
                          <p className="text-lg font-bold text-emerald-700">{F.eur(sel.mCFPost)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Wallet size={16} />Investment</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><p className="text-slate-500">Purchase</p><p className="font-semibold">{F.eur(sel.purchasePrice)}</p></div>
                          <div><p className="text-slate-500">Total Basis</p><p className="font-semibold text-blue-600">{F.eur(sel.totalBasis)}</p></div>
                          <div><p className="text-slate-500">Value</p><p className="font-semibold" style={{ color: sel.unr >= 0 ? COL.green.fill : COL.red.fill }}>{F.eur(sel.currentValue)}</p></div>
                          <div><p className="text-slate-500">Unrealized</p><p className="font-semibold" style={{ color: sel.unr >= 0 ? COL.green.fill : COL.red.fill }}>{F.eur(sel.unr)}</p></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Lock size={16} />Capital</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><p className="text-slate-500">Equity</p><p className="font-semibold text-emerald-600">{F.eur(sel.eq)}</p></div>
                          <div><p className="text-slate-500">Debt</p><p className="font-semibold text-red-600">{F.eur(sel.loanBalance)}</p></div>
                          <div><p className="text-slate-500">LTV</p><p className="font-semibold">{F.pct(sel.ltv)}</p></div>
                          <div><p className="text-slate-500">Extractable</p><p className="font-semibold text-blue-600">{F.eur(sel.ext)}</p></div>
                        </div>
                        {sel.loanBalance > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-slate-500">Rate</span><p className="font-medium">{sel.rate}%</p></div>
                            <div><span className="text-slate-500">DS/mo</span><p className="font-medium text-red-600">{F.eur(sel.monthlyDS)}</p></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Landmark size={16} />Tax (IRPF Spain)</h3>
                    <div className="grid grid-cols-6 gap-4 text-sm">
                      <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">Gross</p><p className="font-semibold">{F.eur(C.gross(sel, config))}</p></div>
                      <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">- OpEx</p><p className="font-semibold text-amber-600">-{F.eur(C.opex(sel))}</p></div>
                      <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">- Interest</p><p className="font-semibold text-red-600">-{F.eur(sel.aInt)}</p></div>
                      <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">- Deprec.</p><p className="font-semibold text-violet-600">-{F.eur(sel.aDep)}</p></div>
                      <div className="p-3 bg-blue-50 rounded-lg"><p className="text-xs text-blue-600">Taxable (×40%)</p><p className="font-semibold text-blue-700">{F.eur(C.taxableIncome(sel, config))}</p></div>
                      <div className="p-3 bg-pink-50 rounded-lg"><p className="text-xs text-pink-600">Tax @45%</p><p className="font-semibold text-pink-700">-{F.eur(sel.aTax)}</p></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500">Select an asset</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Level 3: Strategic */}
        {level === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900">Strategic & Scenarios</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Stress Test (Post-Tax)</h3>
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr><th className="text-left py-2">Scenario</th><th className="text-center py-2">DSCR</th><th className="text-right py-2">CF Post</th><th className="text-center py-2">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stress.map((r, i) => (
                      <tr key={i} className={i === 0 ? 'font-medium' : ''}>
                        <td className="py-2">{r.scenario}</td>
                        <td className="py-2 text-center">{F.x(r.dscr)}</td>
                        <td className="py-2 text-right" style={{ color: r.cf >= 0 ? COL.green.fill : COL.red.fill }}>{F.eur(r.cf)}</td>
                        <td className="py-2 text-center"><Dot status={TH.dscr(r.dscr)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Pipeline ({pipeline.length})</h3>
                <div className="space-y-3">
                  {pipeline.map(p => {
                    const d = daysTo(p.deadline, config.reportDate);
                    return (
                      <div key={p.id} className="p-3 border border-slate-200 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-800">{p.name}</span>
                          <div className="flex items-center gap-2">
                            {d !== null && <span className={`text-xs font-medium ${d < 30 ? 'text-red-600' : d < 60 ? 'text-amber-600' : 'text-emerald-600'}`}>{d}d</span>}
                            <span className={`text-xs px-2 py-0.5 rounded ${p.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.paid ? 'Paid' : 'Pending'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-slate-500">Price</span><p className="font-medium">{F.eurK(p.price)}</p></div>
                          <div><span className="text-slate-500">Yield</span><p className={`font-medium ${p.estYield >= 12 ? 'text-emerald-600' : 'text-amber-600'}`}>{p.estYield}%</p></div>
                          <div><span className="text-slate-500">Prob.</span><p className="font-medium">{p.prob}%</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Capital Planning</h3>
              <div className="grid grid-cols-5 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl text-center"><p className="text-2xl font-bold text-blue-700">{F.eurK(P.ext)}</p><p className="text-xs text-blue-600 mt-1">Extractable @70%</p></div>
                <div className="p-4 bg-emerald-50 rounded-xl text-center"><p className="text-2xl font-bold text-emerald-700">{F.eurK(P.aCFPost)}</p><p className="text-xs text-emerald-600 mt-1">Annual CF Post</p></div>
                <div className="p-4 bg-violet-50 rounded-xl text-center"><p className="text-2xl font-bold text-violet-700">{F.eurK(P.aDep)}</p><p className="text-xs text-violet-600 mt-1">Tax Shield</p></div>
                <div className="p-4 bg-amber-50 rounded-xl text-center"><p className="text-2xl font-bold text-amber-700">{F.eurK(pipeline.reduce((s, p) => s + p.arras, 0))}</p><p className="text-xs text-amber-600 mt-1">Arras at Risk</p></div>
                <div className="p-4 bg-red-50 rounded-xl text-center"><p className="text-2xl font-bold text-red-700">{F.eurK(pipeline.reduce((s, p) => s + p.estBasis, 0))}</p><p className="text-xs text-red-600 mt-1">Pipeline Capital</p></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Refi Candidates (&gt;€10k)</h3>
              <div className="grid grid-cols-3 gap-4">
                {data.filter(a => a.ext >= 10000).sort((a, b) => b.ext - a.ext).map(a => (
                  <div key={a.id} className="p-4 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300" onClick={() => { setSel(a); setLevel(2); }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-800">{a.name}</span>
                      <span className="text-sm font-bold text-blue-600">{F.eurK(a.ext)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-slate-500">Value</span><p className="font-medium">{F.eurK(a.currentValue)}</p></div>
                      <div><span className="text-slate-500">Debt</span><p className="font-medium">{F.eurK(a.loanBalance)}</p></div>
                      <div><span className="text-slate-500">LTV</span><p className="font-medium">{F.pct(a.ltv)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-400">
          <span>Dashboard GPT v2.2 • Live Data from Google Sheets</span>
          <span>IRPF {F.pct(config.marginalTaxRate,0)} | Red. {F.pct(config.rentalReduction,0)} | Amort. {F.pct(config.depreciationRate*config.constructionRatio,1)} | {F.date(config.reportDate)}</span>
        </div>
      </footer>
    </div>
  );
}
