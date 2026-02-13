"use client";
import { useState, useEffect, useRef } from "react";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "KRW", symbol: "₩", name: "Korean Won" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
];

const DEF_CATS = [
  { name: "Food", emoji: "🍔", color: "#f5af19" },
  { name: "Transport", emoji: "🚗", color: "#4facfe" },
  { name: "Housing", emoji: "🏠", color: "#fa709a" },
  { name: "Entertainment", emoji: "🎬", color: "#f093fb" },
  { name: "Shopping", emoji: "🛒", color: "#6C63FF" },
  { name: "Health", emoji: "💊", color: "#43e97b" },
  { name: "Utilities", emoji: "📱", color: "#667eea" },
  { name: "Education", emoji: "🎓", color: "#f78ca0" },
  { name: "Travel", emoji: "✈️", color: "#0fd850" },
  { name: "Other", emoji: "💰", color: "#a18cd1" },
];

const RATES = { USD: 1, EUR: 0.92, GBP: 0.79, AED: 3.67, JPY: 149.5, CAD: 1.36, AUD: 1.53, INR: 83.1, NGN: 1550, GHS: 14.5, ZAR: 18.5, BRL: 4.97, CNY: 7.24, KRW: 1330, SGD: 1.34, CHF: 0.88 };

const MO_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function cnv(a, f, to) { return f === to ? a : (a / RATES[f]) * RATES[to]; }

function fmtM(amount, code) {
  const c = CURRENCIES.find(x => x.code === code) || CURRENCIES[0];
  const abs = Math.abs(amount);
  let f = abs >= 1e6 ? (abs/1e6).toFixed(1)+"M" : abs >= 1000 ? abs.toLocaleString("en",{maximumFractionDigits:0}) : abs.toFixed(abs%1===0?0:2);
  return (amount < 0 ? "-" : "") + c.symbol + f;
}

function barColor(p) {
  if (p < 50) return "#4ecdc4";
  if (p < 65) return "#43e97b";
  if (p < 75) return "#f5af19";
  if (p < 85) return "#FF8C00";
  return "#ff6b6b";
}

// Auto-detect currency from typed input like "$25", "€50", "£30"
const SYMBOL_MAP = {"$":"USD","€":"EUR","£":"GBP","¥":"JPY","₹":"INR","₦":"NGN","₵":"GHS","₩":"KRW","Fr":"CHF","R$":"BRL","C$":"CAD","A$":"AUD","S$":"SGD","د.إ":"AED"};
function detectCurrency(input) {
  const s = input.trim();
  // Check multi-char symbols first (R$, C$, A$, S$, د.إ)
  for (const [sym, code] of Object.entries(SYMBOL_MAP)) {
    if (sym.length > 1 && (s.startsWith(sym) || s.endsWith(sym))) {
      const num = parseFloat(s.replace(sym, "").replace(/,/g, "").trim());
      if (!isNaN(num) && num > 0) return { amount: num, currency: code };
    }
  }
  // Check single-char symbols
  for (const [sym, code] of Object.entries(SYMBOL_MAP)) {
    if (sym.length === 1 && (s.startsWith(sym) || s.endsWith(sym))) {
      const num = parseFloat(s.replace(sym, "").replace(/,/g, "").trim());
      if (!isNaN(num) && num > 0) return { amount: num, currency: code };
    }
  }
  // Check currency codes like "25 EUR", "EUR 25", "50 GBP"
  const codeMatch = s.match(/^([A-Z]{3})\s*([\d,.]+)$|^([\d,.]+)\s*([A-Z]{3})$/);
  if (codeMatch) {
    const code = codeMatch[1] || codeMatch[4];
    const num = parseFloat((codeMatch[2] || codeMatch[3]).replace(/,/g, ""));
    if (CURRENCIES.find(c => c.code === code) && !isNaN(num) && num > 0) return { amount: num, currency: code };
  }
  // Plain number
  const num = parseFloat(s.replace(/,/g, ""));
  if (!isNaN(num) && num > 0) return { amount: num, currency: null };
  return { amount: 0, currency: null };
}

export default function BudgetTrackerV2() {
  const [dk, setDk] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [bCurr, setBCurr] = useState("USD");
  const [cats, setCats] = useState(DEF_CATS);
  const [budget, setBudget] = useState(5000);
  const [uName, setUName] = useState("");
  const [exps, setExps] = useState([]);
  const [pg, setPg] = useState("home");
  const [warnAt, setWarnAt] = useState(70);
  const [alertAt, setAlertAt] = useState(85);
  const [notifOn, setNotifOn] = useState(false);
  const [dailyRem, setDailyRem] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showIns, setShowIns] = useState(false);
  const [showRep, setShowRep] = useState(false);
  const [showTxn, setShowTxn] = useState(false);
  const [showCht, setShowCht] = useState(false);
  const [obStep, setObStep] = useState(0);
  const [obName, setObName] = useState("");
  const [obCurr, setObCurr] = useState("USD");
  const [obCats, setObCats] = useState([]);
  const [obBdgt, setObBdgt] = useState("5000");
  const [eAmt, setEAmt] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eCat, setECat] = useState("");
  const [eCurr, setECurr] = useState("USD");
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const [rcImg, setRcImg] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [cTab, setCTab] = useState("category");
  const [confirmAction, setConfirmAction] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("btv2");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.onboarded) setOnboarded(true);
        if (s.bCurr) { setBCurr(s.bCurr); setECurr(s.bCurr); }
        if (s.cats) setCats(s.cats);
        if (s.budget) setBudget(s.budget);
        if (s.uName) setUName(s.uName);
        if (s.exps) setExps(s.exps);
        if (s.dk !== undefined) setDk(s.dk);
        if (s.warnAt) setWarnAt(s.warnAt);
        if (s.alertAt) setAlertAt(s.alertAt);
        if (s.notifOn) setNotifOn(s.notifOn);
        if (s.dailyRem) setDailyRem(s.dailyRem);
        if (s.alerts) setAlerts(s.alerts);
      }
    } catch (e) { console.log("Load error", e); }
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    if (!onboarded) return;
    try {
      localStorage.setItem("btv2", JSON.stringify({
        onboarded, bCurr, cats, budget, uName, exps, dk, warnAt, alertAt, notifOn, dailyRem, alerts
      }));
    } catch (e) { console.log("Save error", e); }
  }, [onboarded, bCurr, cats, budget, uName, exps, dk, warnAt, alertAt, notifOn, dailyRem, alerts]);

  // Theme
  const t = dk
    ? { bg:"#0a0a0f",cd:"#13131a",al:"#1a1a24",bd:"#252530",tx:"#f0f0f5",sc:"#8888a0",ac:"#6C63FF",gl:"rgba(108,99,255,0.15)",rd:"#ff6b6b",gn:"#4ecdc4",wn:"#f5af19",ip:"#1a1a24" }
    : { bg:"#f5f5f8",cd:"#ffffff",al:"#f0f0f5",bd:"#e0e0e8",tx:"#1a1a2e",sc:"#666680",ac:"#6C63FF",gl:"rgba(108,99,255,0.1)",rd:"#ff6b6b",gn:"#4ecdc4",wn:"#f5af19",ip:"#f0f0f5" };

  // Computed
  const nw = new Date();
  const cMo = nw.getMonth(), cYr = nw.getFullYear(), cDay = nw.getDate();
  const moExps = exps.filter(e => { const d = new Date(e.date); return d.getMonth() === cMo && d.getFullYear() === cYr; });
  const totSpent = moExps.reduce((s, e) => s + e.convAmt, 0);
  const remain = budget - totSpent;
  const pct = budget > 0 ? Math.min((totSpent / budget) * 100, 100) : 0;
  const dInMo = new Date(cYr, cMo + 1, 0).getDate();
  const dBudget = remain > 0 ? remain / (dInMo - cDay + 1) : 0;
  const todayExps = moExps.filter(e => new Date(e.date).getDate() === cDay);
  const todaySpent = todayExps.reduce((s, e) => s + e.convAmt, 0);
  const bCol = barColor(pct);
  const catTotals = moExps.reduce((a, e) => { a[e.category] = (a[e.category] || 0) + e.convAmt; return a; }, {});

  // Voice
  const startListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported. Try Chrome on Android, or Safari 14.1+ on iPhone!"); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";
    r.onstart = () => setListening(true);
    r.onresult = ev => {
      const transcript = ev.results[0][0].transcript.toLowerCase();
      setListening(false);
      // Parse the voice input
      const amtMatch = transcript.match(/(\d+\.?\d*)/);
      const amt = amtMatch ? parseFloat(amtMatch[1]) : 0;
      let foundCat = "";
      const currentCats = cats;
      for (const c of currentCats) { if (transcript.includes(c.name.toLowerCase())) { foundCat = c.name; break; } }
      if (!foundCat) {
        const kw = { Food:["food","lunch","dinner","breakfast","coffee","groceries","eat","snack","meal","restaurant"],Transport:["uber","taxi","bus","gas","fuel","ride","train"],Housing:["rent","mortgage"],Entertainment:["movie","netflix","game","concert"],Shopping:["shop","buy","bought","amazon","clothes"],Health:["doctor","medicine","gym","pharmacy"],Utilities:["bill","internet","phone","electric","water"],Education:["book","course","school","tuition"],Travel:["flight","hotel","trip","travel","vacation"] };
        for (const [k, ws] of Object.entries(kw)) if (ws.some(w => transcript.includes(w)) && currentCats.find(c => c.name === k)) { foundCat = k; break; }
      }
      if (!foundCat) foundCat = "Other";
      let desc = transcript.replace(/\d+\.?\d*/, "").replace(foundCat.toLowerCase(), "").trim();
      if (!desc) desc = transcript;
      if (amt > 0) {
        const newExp = { id: Date.now(), amt, cur: bCurr, convAmt: amt, desc: desc.charAt(0).toUpperCase()+desc.slice(1), category: foundCat, date: new Date().toISOString() };
        setExps(p => [newExp, ...p]);
        setShowAdd(false);
      } else {
        setEDesc(desc);
        if (foundCat) setECat(foundCat);
      }
    };
    r.onerror = (e) => { console.log("Speech error:", e.error); setListening(false); };
    r.onend = () => setListening(false);
    recRef.current = r;
    r.start();
  };

  // Receipt photo (reference only)
  const onReceipt = ev => {
    const f = ev.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = e => { setRcImg(e.target.result); };
    r.readAsDataURL(f);
  };

  const clrReceipt = () => { setRcImg(null); if (fileRef.current) fileRef.current.value=""; if (camRef.current) camRef.current.value=""; };

  const addExpense = () => {
    const d = detectCurrency(eAmt);
    const a = d.amount || parseFloat(eAmt);
    if (!a || !eCat) return;
    const cur = d.currency || eCurr;
    setExps(p => [{ id: Date.now(), amt: a, cur, convAmt: cnv(a, cur, bCurr), desc: eDesc || eCat, category: eCat, date: new Date().toISOString() }, ...p]);
    setEAmt(""); setEDesc(""); setECat(""); clrReceipt(); setShowAdd(false);
  };

  const delExp = id => setExps(p => p.filter(e => e.id !== id));

  const finishOb = () => {
    const sel = DEF_CATS.filter(c => obCats.includes(c.name));
    setUName(obName); setBCurr(obCurr); setECurr(obCurr);
    setCats(sel.length > 0 ? sel : DEF_CATS);
    setBudget(parseFloat(obBdgt) || 5000); setOnboarded(true);
  };

  // Alerts check
  useEffect(() => {
    if (!onboarded || moExps.length === 0) return;
    if (pct >= alertAt) {
      const m = "Alert: " + pct.toFixed(0) + "% budget used!";
      if (!alerts.find(a => a.m === m && new Date(a.d).getDate() === cDay)) {
        setAlerts(p => [{ m, d: new Date().toISOString(), type: "alert" }, ...p].slice(0, 20));
        if (notifOn && "Notification" in window && Notification.permission === "granted") new Notification("Budget Alert!", { body: m });
      }
    } else if (pct >= warnAt) {
      const m = "Warning: " + pct.toFixed(0) + "% budget used.";
      if (!alerts.find(a => a.m === m && new Date(a.d).getDate() === cDay)) {
        setAlerts(p => [{ m, d: new Date().toISOString(), type: "warning" }, ...p].slice(0, 20));
        if (notifOn && "Notification" in window && Notification.permission === "granted") new Notification("Budget Warning", { body: m });
      }
    }
  }, [totSpent]);

  const reqNotif = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    if (p === "granted") { setNotifOn(true); new Notification("Notifications on!", { body: "You'll get budget alerts." }); }
  };

  // Charts
  const catChartData = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const weekChartData = (() => {
    const w = {};
    moExps.forEach(e => { const d = new Date(e.date).getDate(); const k = d<=7?"Wk 1":d<=14?"Wk 2":d<=21?"Wk 3":"Wk 4"; w[k] = (w[k]||0) + e.convAmt; });
    return Object.entries(w);
  })();
  const moChartData = (() => {
    const m = {};
    exps.filter(e => new Date(e.date).getFullYear() === cYr).forEach(e => { const k = MO_NAMES[new Date(e.date).getMonth()]; m[k] = (m[k]||0) + e.convAmt; });
    return Object.entries(m).sort((a, b) => MO_NAMES.indexOf(a[0]) - MO_NAMES.indexOf(b[0]));
  })();

  // Insights
  const insights = (() => {
    if (moExps.length === 0) return ["📊 Add expenses to get insights!"];
    const r = [], mp = (cDay / dInMo) * 100;
    r.push(pct > mp + 10 ? ("⚠️ Overspending: "+pct.toFixed(0)+"% used, "+mp.toFixed(0)+"% of month gone.") : ("✅ On Track: "+pct.toFixed(0)+"% used, "+mp.toFixed(0)+"% of month gone."));
    const so = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
    if (so.length > 0) r.push("🔥 Top: "+(cats.find(c=>c.name===so[0][0])?.emoji||"")+" "+so[0][0]+" at "+fmtM(so[0][1],bCurr));
    const av = totSpent / cDay, pr = av * dInMo;
    r.push(pr > budget ? ("💸 Forecast: "+fmtM(pr,bCurr)+" — "+fmtM(pr-budget,bCurr)+" over.") : ("💰 Save "+fmtM(budget-pr,bCurr)+" this month!"));
    r.push("📈 Daily: "+fmtM(av,bCurr)+"/day vs "+fmtM(budget/dInMo,bCurr)+"/day target.");
    const lf = dInMo - cDay;
    if (lf > 0 && remain > 0) r.push("🗓️ "+fmtM(remain,bCurr)+" left for "+lf+" days.");
    return r;
  })();

  // Report
  const report = (() => {
    const r = [];
    r.push("📅 " + FULL_MO[cMo] + " " + cYr + " Report");
    r.push("💰 Overview\nTotal: "+fmtM(totSpent,bCurr)+"\nBudget: "+fmtM(budget,bCurr)+"\nRemaining: "+fmtM(remain,bCurr)+"\nUsed: "+pct.toFixed(0)+"%");
    r.push("📊 "+moExps.length+" transactions · "+fmtM(totSpent/Math.max(cDay,1),bCurr)+"/day avg");
    if (Object.keys(catTotals).length > 0) {
      r.push("📋 Categories\n" + Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([c,a])=>(cats.find(x=>x.name===c)?.emoji||"")+" "+c+": "+fmtM(a,bCurr)+" ("+((a/totSpent)*100).toFixed(0)+"%)").join("\n"));
    }
    const g = pct<50?"A+ 🌟":pct<60?"A 🌟":pct<70?"B+ 👍":pct<80?"B 👍":pct<90?"C 😬":"D 😱";
    r.push("🏆 Grade: " + g);
    return r;
  })();

  // Styles
  const inp = { width:"100%", padding:"14px 16px", borderRadius:12, border:"1px solid "+t.bd, background:t.ip, color:t.tx, fontSize:16, outline:"none", boxSizing:"border-box" };
  const btn = (bg) => ({ width:"100%", padding:"16px", borderRadius:14, background:bg||t.ac, color:"#fff", border:"none", fontSize:16, fontWeight:600, cursor:"pointer" });
  const crd = { background:t.cd, border:"1px solid "+t.bd, borderRadius:16, padding:16 };
  const mic = (on) => ({ width:52, height:52, borderRadius:"50%", background:on?t.rd:t.al, border:"2px solid "+(on?t.rd:t.bd), color:on?"#fff":t.tx, fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", animation:on?"pulse 1.5s infinite":"none" });
  const modBg = { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" };
  const sheet = { width:"100%", maxWidth:480, maxHeight:"90vh", overflow:"auto", background:t.cd, borderRadius:"24px 24px 0 0", padding:20, animation:"slideUp 0.3s ease" };
  const pill = (on) => ({ padding:"8px 16px", borderRadius:20, background:on?t.ac:t.al, color:on?"#fff":t.sc, border:"1px solid "+(on?t.ac:t.bd), cursor:"pointer", fontSize:13, fontWeight:500 });
  const tog = (on) => ({ width:48, height:26, borderRadius:13, background:on?t.ac:t.bd, position:"relative", cursor:"pointer", transition:"all 0.3s", flexShrink:0 });
  const togD = (on) => ({ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:on?25:3, transition:"all 0.3s" });
  const handle = { width:40, height:4, borderRadius:2, background:t.bd, margin:"0 auto 16px" };

  // Chart component
  const Chart = ({ data, colorFn }) => {
    if (!data || data.length === 0) return <div style={{ textAlign:"center", padding:40, color:t.sc }}>No data yet</div>;
    const mx = Math.max(...data.map(d => d[1]));
    return (
      <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:200, padding:"10px 0" }}>
        {data.map(([label, val], i) => {
          const h = mx > 0 ? (val / mx) * 150 : 0;
          const cl = colorFn(label, i);
          const catObj = cats.find(c => c.name === label);
          return (
            <div key={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:9, color:t.sc, fontWeight:600 }}>{fmtM(val, bCurr)}</span>
              <div style={{ width:"100%", maxWidth:34, height:h, borderRadius:"6px 6px 0 0", background:"linear-gradient(180deg,"+cl+","+cl+"88)", transition:"height 0.5s" }} />
              <span style={{ fontSize:14 }}>{catObj?.emoji || ""}</span>
              <span style={{ fontSize:8, color:t.sc, textAlign:"center" }}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Transaction row
  const TxRow = ({ e, canDel }) => {
    const c = cats.find(x => x.name === e.category);
    return (
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:t.al, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{c?.emoji || "💰"}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.desc}</div>
          <div style={{ fontSize:12, color:t.sc }}>{c?.name} · {new Date(e.date).toLocaleDateString("en",{month:"short",day:"numeric"})}{e.cur !== bCurr ? (" · "+(CURRENCIES.find(x=>x.code===e.cur)?.symbol||"")+e.amt) : ""}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontWeight:700, color:t.rd, fontSize:15, whiteSpace:"nowrap" }}>-{fmtM(e.convAmt, bCurr)}</span>
          {canDel && <span style={{ cursor:"pointer", color:t.sc, padding:4, fontSize:14 }} onClick={() => delExp(e.id)}>✕</span>}
        </div>
      </div>
    );
  };

  const css = "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes spin{to{transform:rotate(360deg)}}input:focus,select:focus{border-color:#6C63FF!important;outline:none}::-webkit-scrollbar{width:0}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}input[type=number]{-moz-appearance:textfield}input[type=range]{-webkit-appearance:auto;appearance:auto;background:transparent;border:none;padding:0}";

  // ===================== ONBOARDING =====================
  if (!onboarded) {
    const wrap = { minHeight:"100vh", background:t.bg, color:t.tx, fontFamily:"'DM Sans',sans-serif", maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column", justifyContent:"center", padding:24 };
    return (
      <div style={wrap}>
        <style>{css}</style>
        {obStep === 0 && (
          <div style={{ textAlign:"center", animation:"fadeIn 0.5s" }}>
            <div style={{ fontSize:64, marginBottom:16 }}>💰</div>
            <h1 style={{ fontSize:28, fontWeight:700, marginBottom:8 }}>Your Budget Tracker</h1>
            <p style={{ color:t.sc, marginBottom:32 }}>Smart. Simple. Secure.</p>
            <input style={inp} placeholder="What's your name?" value={obName} onChange={e => setObName(e.target.value)} />
            <button style={{ ...btn(), marginTop:20, opacity:obName?1:0.5 }} onClick={() => obName && setObStep(1)}>Get Started →</button>
          </div>
        )}
        {obStep === 1 && (
          <div style={{ animation:"fadeIn 0.5s" }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Hey {obName}! 👋</h2>
            <p style={{ color:t.sc, marginBottom:20 }}>Pick your base currency</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, maxHeight:360, overflow:"auto" }}>
              {CURRENCIES.map(c => (
                <div key={c.code} onClick={() => setObCurr(c.code)} style={{ padding:14, borderRadius:14, background:obCurr===c.code?t.ac:t.cd, border:"1px solid "+(obCurr===c.code?t.ac:t.bd), color:obCurr===c.code?"#fff":t.tx, cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:600 }}>{c.symbol}</div>
                  <div style={{ fontSize:12, opacity:0.8 }}>{c.code} · {c.name}</div>
                </div>
              ))}
            </div>
            <button style={{ ...btn(), marginTop:20 }} onClick={() => setObStep(2)}>Next →</button>
          </div>
        )}
        {obStep === 2 && (
          <div style={{ animation:"fadeIn 0.5s" }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Choose categories</h2>
            <p style={{ color:t.sc, marginBottom:20 }}>Tap to toggle</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
              {DEF_CATS.map(cat => {
                const on = obCats.includes(cat.name);
                return (
                  <div key={cat.name} onClick={() => on ? setObCats(p=>p.filter(c=>c!==cat.name)) : setObCats(p=>[...p,cat.name])} style={{ padding:14, borderRadius:14, background:on?t.ac:t.cd, border:"1px solid "+(on?t.ac:t.bd), color:on?"#fff":t.tx, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>{cat.emoji}</span>
                    <span style={{ fontWeight:500 }}>{cat.name}</span>
                  </div>
                );
              })}
            </div>
            <button style={{ ...btn(), marginTop:20, opacity:obCats.length>0?1:0.5 }} onClick={() => obCats.length>0 && setObStep(3)}>Next →</button>
          </div>
        )}
        {obStep === 3 && (
          <div style={{ textAlign:"center", animation:"fadeIn 0.5s" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎯</div>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Monthly budget</h2>
            <p style={{ color:t.sc, marginBottom:24 }}>In {(CURRENCIES.find(c=>c.code===obCurr)||{}).symbol}{obCurr}</p>
            <input style={{ ...inp, fontSize:32, textAlign:"center", fontWeight:700 }} type="number" value={obBdgt} onChange={e => setObBdgt(e.target.value)} />
            <button style={{ ...btn(), marginTop:24 }} onClick={finishOb}>Let's Go! 🚀</button>
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:24 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width:i===obStep?24:8, height:8, borderRadius:4, background:i===obStep?t.ac:t.bd, transition:"all 0.3s" }} />)}
        </div>
      </div>
    );
  }

  // ===================== MAIN APP =====================
  return (
    <div style={{ minHeight:"100vh", background:t.bg, color:t.tx, fontFamily:"'DM Sans',sans-serif", maxWidth:480, margin:"0 auto", position:"relative" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px 8px" }}>
        <div>
          <div style={{ fontSize:13, color:t.sc }}>Welcome back</div>
          <div style={{ fontSize:20, fontWeight:700 }}>{uName} 👋</div>
        </div>
        <button onClick={() => setDk(!dk)} style={{ background:t.al, border:"1px solid "+t.bd, borderRadius:12, padding:"8px 12px", color:t.tx, cursor:"pointer", fontSize:16 }}>{dk ? "☀️" : "🌙"}</button>
      </div>

      {/* ========== HOME ========== */}
      {pg === "home" && (
        <div style={{ animation:"fadeIn 0.3s", paddingBottom:90 }}>
          {/* Hero Card */}
          <div style={{ margin:"8px 20px 16px", padding:24, borderRadius:20, background:"linear-gradient(135deg,"+t.ac+",#8b7aff)", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:-40, right:-40, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.1)" }} />
            <div style={{ position:"relative", zIndex:1 }}>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)", marginBottom:4 }}>Spent This Month</div>
              <div style={{ fontSize:36, fontWeight:700, color:"#fff" }}>{fmtM(totSpent, bCurr)}</div>
              <div style={{ fontSize:14, color:"rgba(255,255,255,0.8)", marginTop:4 }}>Remaining: {fmtM(remain, bCurr)}</div>
              <div style={{ width:"100%", height:10, borderRadius:5, background:"rgba(255,255,255,0.2)", overflow:"hidden", marginTop:12 }}>
                <div style={{ height:"100%", borderRadius:5, width:pct+"%", background:bCol, transition:"width 0.6s, background 0.6s", boxShadow:pct>80?("0 0 8px "+t.rd):"none" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>0%</span>
                <span style={{ fontSize:13, fontWeight:700, color:bCol }}>{pct.toFixed(0)}%</span>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>100%</span>
              </div>
            </div>
          </div>

          {/* Alert Banners */}
          {pct >= alertAt && (
            <div style={{ margin:"0 20px 12px", padding:"12px 16px", borderRadius:12, background:t.rd+"15", border:"1px solid "+t.rd+"40", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>🚨</span>
              <span style={{ fontSize:13, color:t.rd, fontWeight:500 }}>Budget alert! {pct.toFixed(0)}% used.</span>
            </div>
          )}
          {pct >= warnAt && pct < alertAt && (
            <div style={{ margin:"0 20px 12px", padding:"12px 16px", borderRadius:12, background:t.wn+"15", border:"1px solid "+t.wn+"40", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>⚠️</span>
              <span style={{ fontSize:13, color:t.wn, fontWeight:500 }}>Warning: {pct.toFixed(0)}% budget used.</span>
            </div>
          )}

          {/* Daily Stats */}
          <div style={{ display:"flex", gap:12, padding:"0 20px", marginBottom:16 }}>
            <div style={{ ...crd, flex:1, textAlign:"center" }}>
              <div style={{ fontSize:11, color:t.sc, marginBottom:4 }}>Daily Budget</div>
              <div style={{ fontSize:20, fontWeight:700, color:t.gn }}>{fmtM(dBudget, bCurr)}</div>
            </div>
            <div style={{ ...crd, flex:1, textAlign:"center" }}>
              <div style={{ fontSize:11, color:t.sc, marginBottom:4 }}>Today</div>
              <div style={{ fontSize:20, fontWeight:700, color:todaySpent>dBudget?t.rd:t.gn }}>{fmtM(todaySpent, bCurr)}</div>
            </div>
          </div>

          {/* Categories */}
          <div style={{ padding:"0 20px", marginBottom:16 }}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:10 }}>Categories</div>
            {[cats.slice(0,5), cats.slice(5)].filter(r => r.length > 0).map((row, ri) => (
              <div key={ri} style={{ display:"grid", gridTemplateColumns:"repeat("+Math.min(row.length,5)+",1fr)", gap:8, marginBottom:ri===0?8:0 }}>
                {row.map(cat => (
                  <div key={cat.name} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"10px 4px", borderRadius:12, background:t.cd, border:"1px solid "+t.bd }}>
                    <span style={{ fontSize:22 }}>{cat.emoji}</span>
                    <span style={{ fontSize:9, color:t.sc }}>{cat.name}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:(catTotals[cat.name]||0)>0?t.rd:t.gn }}>{fmtM(catTotals[cat.name]||0, bCurr)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Recent 4 Transactions */}
          <div style={{ padding:"0 20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:16, fontWeight:600 }}>Recent Transactions</span>
              {moExps.length > 4 && <span style={{ fontSize:13, color:t.ac, cursor:"pointer" }} onClick={() => setPg("stats")}>See All →</span>}
            </div>
            {moExps.length === 0
              ? <div style={{ textAlign:"center", padding:32, color:t.sc }}><div style={{ fontSize:40, marginBottom:8 }}>📝</div>No expenses yet. Tap + to add!</div>
              : moExps.slice(0, 4).map(e => <TxRow key={e.id} e={e} canDel={false} />)
            }
          </div>
        </div>
      )}

      {/* ========== STATS ========== */}
      {pg === "stats" && (
        <div style={{ animation:"fadeIn 0.3s", paddingBottom:90 }}>
          <div style={{ padding:"8px 20px 0" }}><h2 style={{ fontSize:22, fontWeight:700, marginBottom:16 }}>Stats</h2></div>
          <div style={{ display:"flex", gap:12, padding:"0 20px", marginBottom:16 }}>
            <div style={{ ...crd, flex:1, textAlign:"center" }}><div style={{ fontSize:11, color:t.sc }}>TOTAL SPENT</div><div style={{ fontSize:22, fontWeight:700, color:t.rd, marginTop:4 }}>{fmtM(totSpent,bCurr)}</div></div>
            <div style={{ ...crd, flex:1, textAlign:"center" }}><div style={{ fontSize:11, color:t.sc }}>REMAINING</div><div style={{ fontSize:22, fontWeight:700, color:remain>=0?t.gn:t.rd, marginTop:4 }}>{fmtM(remain,bCurr)}</div></div>
          </div>

          {/* Category bars */}
          <div style={{ padding:"0 20px", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:16, fontWeight:600 }}>Spending by Category</span>
              <span style={{ fontSize:13, color:t.ac, cursor:"pointer" }} onClick={() => setShowCht(true)}>Charts →</span>
            </div>
            {Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,5).map(([ct, am]) => {
              const co = cats.find(c => c.name === ct);
              const p = totSpent > 0 ? (am/totSpent)*100 : 0;
              return (
                <div key={ct} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13 }}>{co?.emoji} {ct}</span>
                    <span style={{ fontSize:13, fontWeight:600 }}>{fmtM(am,bCurr)}</span>
                  </div>
                  <div style={{ width:"100%", height:8, borderRadius:4, background:t.al }}>
                    <div style={{ height:"100%", borderRadius:4, background:co?.color||t.ac, width:p+"%", transition:"width 0.5s" }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(catTotals).length === 0 && <div style={{ textAlign:"center", padding:24, color:t.sc }}>No data yet</div>}
          </div>

          {/* Explore */}
          <div style={{ padding:"0 20px" }}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:10 }}>Explore</div>
            {[
              { l:"All Transactions", d:"Complete history", e:"📋", a:() => setShowTxn(true) },
              { l:"Charts & Graphs", d:"Visual breakdown", e:"📊", a:() => setShowCht(true) },
              { l:"AI Insights", d:"Smart predictions", e:"🤖", a:() => setShowIns(true) },
              { l:"Monthly Report", d:"Grade & breakdown", e:"📑", a:() => setShowRep(true) },
            ].map(x => (
              <div key={x.l} onClick={x.a} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                <div style={{ width:42, height:42, borderRadius:12, background:t.ac+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{x.e}</div>
                <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>{x.l}</div><div style={{ fontSize:12, color:t.sc }}>{x.d}</div></div>
                <span style={{ color:t.sc, fontSize:18 }}>›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== SETTINGS ========== */}
      {pg === "settings" && (
        <div style={{ animation:"fadeIn 0.3s", paddingBottom:90 }}>
          <div style={{ padding:"8px 20px" }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>Settings</h2>
            <div style={{ fontSize:14, fontWeight:600, color:t.sc, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Profile</div>
            <div style={{ marginBottom:14 }}><label style={{ fontSize:13, color:t.sc, marginBottom:6, display:"block" }}>Name</label><input style={inp} value={uName} onChange={e => setUName(e.target.value)} /></div>

            <div style={{ fontSize:14, fontWeight:600, color:t.sc, marginBottom:10, marginTop:20, textTransform:"uppercase", letterSpacing:1 }}>Budget</div>
            <div style={{ marginBottom:14 }}><label style={{ fontSize:13, color:t.sc, marginBottom:6, display:"block" }}>Monthly Budget</label><input style={inp} type="number" value={budget} onChange={e => setBudget(parseFloat(e.target.value)||0)} /></div>
            <div style={{ marginBottom:14 }}><label style={{ fontSize:13, color:t.sc, marginBottom:6, display:"block" }}>Base Currency</label><select style={{ ...inp, appearance:"auto" }} value={bCurr} onChange={e => setBCurr(e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}</select></div>

            <div style={{ fontSize:14, fontWeight:600, color:t.sc, marginBottom:10, marginTop:20, textTransform:"uppercase", letterSpacing:1 }}>Alerts & Notifications</div>
            <div style={{ ...crd, marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div><div style={{ fontWeight:600, fontSize:14 }}>Push Notifications</div><div style={{ fontSize:12, color:t.sc }}>Get alerts on your phone</div></div>
                <div style={tog(notifOn)} onClick={() => notifOn ? setNotifOn(false) : reqNotif()}><div style={togD(notifOn)} /></div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><div style={{ fontWeight:600, fontSize:14 }}>Daily Reminder</div><div style={{ fontSize:12, color:t.sc }}>Remind to log expenses</div></div>
                <div style={tog(dailyRem)} onClick={() => setDailyRem(!dailyRem)}><div style={togD(dailyRem)} /></div>
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, color:t.sc, marginBottom:6, display:"block" }}>⚠️ Warning at (%)</label>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}><input style={{ ...inp, flex:1 }} type="range" min="30" max="95" value={warnAt} onChange={e => setWarnAt(parseInt(e.target.value))} /><span style={{ fontWeight:700, fontSize:16, color:t.wn, minWidth:40 }}>{warnAt}%</span></div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, color:t.sc, marginBottom:6, display:"block" }}>🚨 Alert at (%)</label>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}><input style={{ ...inp, flex:1 }} type="range" min="50" max="100" value={alertAt} onChange={e => setAlertAt(parseInt(e.target.value))} /><span style={{ fontWeight:700, fontSize:16, color:t.rd, minWidth:40 }}>{alertAt}%</span></div>
            </div>

            {alerts.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, color:t.sc, marginBottom:8 }}>Recent Alerts</div>
                {alerts.slice(0,5).map((a,i) => (
                  <div key={i} style={{ padding:"10px 12px", borderRadius:10, background:a.type==="alert"?(t.rd+"10"):(t.wn+"10"), border:"1px solid "+(a.type==="alert"?(t.rd+"30"):(t.wn+"30")), marginBottom:6, fontSize:13 }}>
                    {a.m}
                    <div style={{ fontSize:11, color:t.sc, marginTop:4 }}>{new Date(a.d).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize:14, fontWeight:600, color:t.sc, marginBottom:10, marginTop:20, textTransform:"uppercase", letterSpacing:1 }}>Appearance</div>
            <div style={{ display:"flex", gap:10, marginBottom:20 }}>
              <button onClick={() => setDk(true)} style={{ ...btn(dk?t.ac:t.al), flex:1, color:dk?"#fff":t.tx, border:"1px solid "+(dk?t.ac:t.bd) }}>🌙 Dark</button>
              <button onClick={() => setDk(false)} style={{ ...btn(!dk?t.ac:t.al), flex:1, color:!dk?"#fff":t.tx, border:"1px solid "+(!dk?t.ac:t.bd) }}>☀️ Light</button>
            </div>

            <div style={{ padding:"14px 16px", borderRadius:14, background:t.ac+"12", border:"1px solid "+t.ac+"30", marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:t.ac, marginBottom:4 }}>📱 Data stored on this device</div>
              <div style={{ fontSize:12, color:t.sc, lineHeight:1.5 }}>Your data is saved locally on this device. Clearing browser data will erase it. Cloud sync coming soon!</div>
            </div>

            <div style={{ fontSize:14, fontWeight:600, color:t.rd, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Danger Zone</div>
            <button style={{ ...btn(t.rd), marginBottom:10 }} onClick={() => setConfirmAction("reset")}>🗑️ Reset All Data</button>
            <button style={{ ...btn(t.al), color:t.tx, border:"1px solid "+t.bd }} onClick={() => setConfirmAction("fresh")}>🔄 Start Fresh</button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setECurr(bCurr); setShowAdd(true); }} style={{ position:"fixed", bottom:80, right:"calc(50% - 208px)", width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,"+t.ac+",#8b7aff)", color:"#fff", border:"none", fontSize:28, cursor:"pointer", boxShadow:"0 4px 20px "+t.gl, display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>+</button>

      {/* NAV */}
      <div style={{ display:"flex", justifyContent:"space-around", padding:"12px 20px", borderTop:"1px solid "+t.bd, background:t.cd, position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, zIndex:40 }}>
        {[{id:"home",l:"Home",i:"🏠"},{id:"stats",l:"Stats",i:"📊"},{id:"settings",l:"Settings",i:"⚙️"}].map(n => (
          <div key={n.id} onClick={() => setPg(n.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:"pointer", color:pg===n.id?t.ac:t.sc, fontSize:11, fontWeight:pg===n.id?600:400 }}>
            <span style={{ fontSize:22 }}>{n.i}</span><span>{n.l}</span>
          </div>
        ))}
      </div>

      {/* ADD EXPENSE MODAL */}
      {showAdd && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>Add Expense</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowAdd(false)}>✕</span>
            </div>
            <div style={{ display:"flex", justifyContent:"center", gap:16, marginBottom:10 }}>
              {[
                { i:"🎤", l:"Voice", a:() => listening ? recRef.current?.stop() : startListen(), on:listening },
                { i:"📷", l:"Camera", a:() => camRef.current?.click() },
                { i:"🖼️", l:"Gallery", a:() => fileRef.current?.click() },
              ].map(b => (
                <div key={b.l} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                  <button onClick={b.a} style={mic(b.on)}>{b.i}</button>
                  <span style={{ fontSize:11, color:t.sc }}>{b.l}</span>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" capture="environment" ref={camRef} style={{ display:"none" }} onChange={onReceipt} />
            <input type="file" accept="image/*" ref={fileRef} style={{ display:"none" }} onChange={onReceipt} />
            <div style={{ textAlign:"center", fontSize:12, color:t.sc, marginBottom:14 }}>{listening ? "🔴 Listening..." : "Tap voice, or snap a receipt for reference"}</div>

            {rcImg && (
              <div style={{ marginBottom:14, position:"relative" }}>
                <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid "+t.bd }}>
                  <img src={rcImg} alt="Receipt" style={{ width:"100%", maxHeight:180, objectFit:"cover", display:"block" }} />
                </div>
                <div style={{ textAlign:"center", fontSize:11, color:t.sc, marginTop:6 }}>📎 Receipt attached — enter details below</div>
                <div style={{ textAlign:"center", fontSize:11, color:t.ac, marginTop:4, cursor:"pointer" }}>💎 Upgrade to Pro for auto receipt scanning</div>
                <button onClick={clrReceipt} style={{ position:"absolute", top:8, right:8, width:26, height:26, borderRadius:"50%", background:"rgba(0,0,0,0.7)", color:"#fff", border:"none", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
            )}

            <div style={{ display:"flex", gap:10, marginBottom:12 }}>
              <input style={{ ...inp, flex:1 }} type="text" inputMode="decimal" placeholder="Amount (e.g. €50, £30, $25)" value={eAmt} onChange={e => {
                const v = e.target.value;
                setEAmt(v);
                const d = detectCurrency(v);
                if (d.currency && d.currency !== eCurr) setECurr(d.currency);
              }} />
              <select style={{ ...inp, width:88, appearance:"auto" }} value={eCurr} onChange={e => setECurr(e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
            </div>
            {eCurr !== bCurr && eAmt && <div style={{ fontSize:12, color:t.sc, marginBottom:8, textAlign:"right" }}>{"≈ "+fmtM(cnv(detectCurrency(eAmt).amount || parseFloat(eAmt) || 0, eCurr, bCurr), bCurr)}</div>}
            <input style={{ ...inp, marginBottom:12 }} placeholder="Description (optional)" value={eDesc} onChange={e => setEDesc(e.target.value)} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:16 }}>
              {cats.map(cat => (
                <div key={cat.name} onClick={() => setECat(cat.name)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 4px", borderRadius:12, background:eCat===cat.name?t.ac:t.al, border:"1px solid "+(eCat===cat.name?t.ac:t.bd), cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>{cat.emoji}</span>
                  <span style={{ fontSize:8, color:eCat===cat.name?"#fff":t.sc }}>{cat.name}</span>
                </div>
              ))}
            </div>
            <button style={{ ...btn(), opacity:eAmt&&eCat?1:0.4 }} onClick={addExpense}>Add Expense</button>
          </div>
        </div>
      )}

      {/* ALL TRANSACTIONS */}
      {showTxn && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowTxn(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>All Transactions</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowTxn(false)}>✕</span>
            </div>
            {exps.length === 0 ? <div style={{ textAlign:"center", padding:40, color:t.sc }}>No transactions</div> : exps.map(e => <TxRow key={e.id} e={e} canDel={true} />)}
          </div>
        </div>
      )}

      {/* CHARTS */}
      {showCht && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowCht(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>Charts</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowCht(false)}>✕</span>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[["category","Category"],["week","Week"],["month","Month"]].map(([id,lb]) => (
                <div key={id} onClick={() => setCTab(id)} style={pill(cTab===id)}>{lb}</div>
              ))}
            </div>
            <div style={{ ...crd, padding:"12px 8px" }}>
              {cTab === "category" && <Chart data={catChartData} colorFn={(l) => cats.find(c=>c.name===l)?.color || t.ac} />}
              {cTab === "week" && <Chart data={weekChartData} colorFn={(_,i) => ["#6C63FF","#4facfe","#43e97b","#f5af19"][i%4]} />}
              {cTab === "month" && <Chart data={moChartData} colorFn={(_,i) => ["#f093fb","#6C63FF","#4facfe","#43e97b","#f5af19","#fa709a"][i%6]} />}
            </div>
          </div>
        </div>
      )}

      {/* AI INSIGHTS */}
      {showIns && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowIns(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>🤖 AI Insights</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowIns(false)}>✕</span>
            </div>
            {insights.map((x,i) => <div key={i} style={{ padding:16, borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:10, fontSize:14, lineHeight:1.6 }}>{x}</div>)}
          </div>
        </div>
      )}

      {/* MONTHLY REPORT */}
      {showRep && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowRep(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>📑 Monthly Report</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowRep(false)}>✕</span>
            </div>
            {report.map((x,i) => <div key={i} style={{ padding:16, borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:10, fontSize:14, lineHeight:1.7, whiteSpace:"pre-line" }}>{x}</div>)}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmAction && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setConfirmAction(null)}>
          <div style={{ width:"100%", maxWidth:380, background:t.cd, borderRadius:24, padding:28, margin:"auto", animation:"fadeIn 0.2s", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>{confirmAction === "reset" ? "🗑️" : "🔄"}</div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>
              {confirmAction === "reset" ? "Reset All Data?" : "Start Fresh?"}
            </h3>
            <p style={{ fontSize:14, color:t.sc, lineHeight:1.5, marginBottom:24 }}>
              {confirmAction === "reset"
                ? "This will delete all your expenses and alert history. This cannot be undone."
                : "This will erase everything and take you back to the beginning. All data will be lost."
              }
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...btn(t.al), flex:1, color:t.tx, border:"1px solid "+t.bd }} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button style={{ ...btn(t.rd), flex:1 }} onClick={() => {
                if (confirmAction === "reset") {
                  setExps([]); setAlerts([]);
                } else {
                  setOnboarded(false); setObStep(0); setExps([]); setAlerts([]);
                  localStorage.removeItem("btv2");
                }
                setConfirmAction(null);
              }}>
                {confirmAction === "reset" ? "Delete All" : "Start Over"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
