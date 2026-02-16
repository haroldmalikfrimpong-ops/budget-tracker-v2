"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, GoogleAuthProvider, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDJES8JzYNOe9MNoZY6t-5aKGp5lAawjRo",
  authDomain: "yourbudgettracker-82d91.firebaseapp.com",
  projectId: "yourbudgettracker-82d91",
  storageBucket: "yourbudgettracker-82d91.firebasestorage.app",
  messagingSenderId: "389883134721",
  appId: "1:389883134721:web:c2f97ff4271974dfcad100"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const gProv = new GoogleAuthProvider();

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

const DEF_BIZ_CATS = [
  { name: "Office Supplies", emoji: "🖨️", color: "#667eea" },
  { name: "Marketing", emoji: "📣", color: "#f093fb" },
  { name: "Software", emoji: "💻", color: "#6C63FF" },
  { name: "Travel & Ent.", emoji: "✈️", color: "#0fd850" },
  { name: "Professional", emoji: "⚖️", color: "#f78ca0" },
  { name: "Payroll", emoji: "👥", color: "#4facfe" },
  { name: "Insurance", emoji: "🛡️", color: "#f5af19" },
  { name: "Taxes", emoji: "📋", color: "#fa709a" },
  { name: "Equipment", emoji: "🔧", color: "#43e97b" },
  { name: "Other Biz", emoji: "💼", color: "#a18cd1" },
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
  // Auth
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authPg, setAuthPg] = useState("login"); // login | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const saveTimer = useRef(null);

  const [dk, setDk] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [bCurr, setBCurr] = useState("USD");
  const [cats, setCats] = useState(DEF_CATS);
  const [budget, setBudget] = useState(5000);
  const [uName, setUName] = useState("");
  const [exps, setExps] = useState([]);
  const [bizExps, setBizExps] = useState([]);
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
  const [eIsTax, setEIsTax] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const [rcImg, setRcImg] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [cTab, setCTab] = useState("category");
  const [confirmAction, setConfirmAction] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [proCode, setProCode] = useState("");
  const [recurring, setRecurring] = useState([]);
  const [catBudgets, setCatBudgets] = useState({});
  const [showRecurring, setShowRecurring] = useState(false);
  const [showCatBdgt, setShowCatBdgt] = useState(false);
  const [rName, setRName] = useState("");
  const [rAmt, setRAmt] = useState("");
  const [rCat, setRCat] = useState("Housing");
  const PRO_CODE = "MALIK2026";
  const BIZ_CODE = "MALIKBIZ26";
  // Business
  const [isBiz, setIsBiz] = useState(false);
  const [bizMode, setBizMode] = useState(false);
  const [showBizUpgrade, setShowBizUpgrade] = useState(false);
  const [bizCode, setBizCode] = useState("");
  const [activeMode, setActiveMode] = useState("personal"); // personal | pro | business
  const [invoices, setInvoices] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);
  const [showPL, setShowPL] = useState(false);
  const [iName, setIName] = useState("");
  const [iAmt, setIAmt] = useState("");
  const [iClient, setIClient] = useState("");
  const [rvAmt, setRvAmt] = useState("");
  const [rvDesc, setRvDesc] = useState("");
  const [rvSrc, setRvSrc] = useState("");
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📁");
  const [switchTo, setSwitchTo] = useState(null);
  const [archive, setArchive] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ===== FIREBASE AUTH + DATA =====
  const loadData = (s) => {
    if (s.onboarded) setOnboarded(true);
    if (s.bCurr) { setBCurr(s.bCurr); setECurr(s.bCurr); }
    if (s.cats) setCats(s.cats);
    if (s.budget) setBudget(s.budget);
    if (s.uName) setUName(s.uName);
    if (s.exps) setExps(s.exps);
    if (s.bizExps) setBizExps(s.bizExps);
    if (s.dk !== undefined) setDk(s.dk);
    if (s.warnAt) setWarnAt(s.warnAt);
    if (s.alertAt) setAlertAt(s.alertAt);
    if (s.notifOn) setNotifOn(s.notifOn);
    if (s.dailyRem) setDailyRem(s.dailyRem);
    if (s.alerts) setAlerts(s.alerts);
    if (s.isPro) setIsPro(true);
    if (s.recurring) setRecurring(s.recurring);
    if (s.catBudgets) setCatBudgets(s.catBudgets);
    if (s.bizMode) setBizMode(s.bizMode);
    if (s.isBiz) setIsBiz(true);
    if (s.activeMode) setActiveMode(s.activeMode);
    if (s.invoices) setInvoices(s.invoices);
    if (s.revenue) setRevenue(s.revenue);
    if (s.archive) setArchive(s.archive);
  };

  const getDataObj = useCallback(() => ({
    onboarded, bCurr, cats, budget, uName, exps, bizExps, dk, warnAt, alertAt,
    notifOn, dailyRem, alerts, isPro, recurring, catBudgets, bizMode, isBiz,
    activeMode, invoices, revenue, archive, lastSaved: new Date().toISOString()
  }), [onboarded, bCurr, cats, budget, uName, exps, bizExps, dk, warnAt, alertAt,
    notifOn, dailyRem, alerts, isPro, recurring, catBudgets, bizMode, isBiz,
    activeMode, invoices, revenue, archive]);

  // Step 1: ALWAYS load localStorage first
  useEffect(() => {
    try {
      const raw = localStorage.getItem("btv2");
      if (raw) loadData(JSON.parse(raw));
    } catch (e) { console.log("Local load error", e); }
  }, []);

  // Step 2: Auth listener — sync with cloud when signed in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsGuest(false);
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const cloud = snap.data();
            // If user had local data (guest usage), merge it — local wins for first sign-in
            const raw = localStorage.getItem("btv2");
            if (raw) {
              const localData = JSON.parse(raw);
              if (localData.onboarded && (!cloud.lastSaved || localData.exps?.length > 0)) {
                // User has local data — push it to cloud to preserve it
                await setDoc(doc(db, "users", u.uid), { ...localData, lastSaved: new Date().toISOString() });
              } else if (cloud.onboarded) {
                // Cloud has data, local doesn't — load cloud
                loadData(cloud);
              }
            } else if (cloud.onboarded) {
              // No local data, load cloud
              loadData(cloud);
            }
          } else {
            // Brand new cloud user — upload whatever local data exists
            const raw = localStorage.getItem("btv2");
            if (raw) {
              const localData = JSON.parse(raw);
              if (localData.onboarded) {
                await setDoc(doc(db, "users", u.uid), { ...localData, lastSaved: new Date().toISOString() });
              }
            }
          }
        } catch (e) { console.log("Cloud sync error", e); }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Save: localStorage always + Firestore if signed in
  useEffect(() => {
    if (!onboarded) return;
    const data = getDataObj();
    try { localStorage.setItem("btv2", JSON.stringify(data)); } catch (e) {}
    if (user) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          setSaving(true);
          await setDoc(doc(db, "users", user.uid), data);
          setSaving(false);
        } catch (e) { console.log("Cloud save error", e); setSaving(false); }
      }, 1500);
    }
  }, [onboarded, bCurr, cats, budget, uName, exps, bizExps, dk, warnAt, alertAt,
    notifOn, dailyRem, alerts, isPro, recurring, catBudgets, bizMode, isBiz,
    activeMode, invoices, revenue, archive, user, getDataObj]);

  // Monthly archive check
  useEffect(() => {
    if (!onboarded || exps.length === 0) return;
    const now = new Date();
    const lastExp = exps.length > 0 ? new Date(exps[0].date) : null;
    if (lastExp && (lastExp.getMonth() !== now.getMonth() || lastExp.getFullYear() !== now.getFullYear())) {
      const prevMonth = lastExp.getMonth();
      const prevYear = lastExp.getFullYear();
      const oldExps = exps.filter(e => { const d = new Date(e.date); return d.getMonth() === prevMonth && d.getFullYear() === prevYear; });
      const curExps = exps.filter(e => { const d = new Date(e.date); return !(d.getMonth() === prevMonth && d.getFullYear() === prevYear); });
      if (oldExps.length > 0) {
        const key = MO_NAMES[prevMonth] + " " + prevYear;
        setArchive(p => [...p.filter(a => a.key !== key), { key, month: prevMonth, year: prevYear, exps: oldExps, total: oldExps.reduce((s,e) => s + e.convAmt, 0) }]);
        setExps(curExps);
      }
    }
  }, [onboarded, exps]);

  // Auth functions
  const doLogin = async () => {
    setAuthErr("");
    try { await signInWithEmailAndPassword(auth, authEmail, authPass); }
    catch (e) { setAuthErr(e.code === "auth/invalid-credential" ? "Wrong email or password" : e.code === "auth/user-not-found" ? "No account found" : "Login failed. Check your details."); }
  };
  const doSignup = async () => {
    setAuthErr("");
    if (authPass.length < 6) { setAuthErr("Password must be at least 6 characters"); return; }
    try { await createUserWithEmailAndPassword(auth, authEmail, authPass); }
    catch (e) { setAuthErr(e.code === "auth/email-already-in-use" ? "Email already in use" : "Signup failed. Try again."); }
  };
  const doGoogle = async () => {
    setAuthErr("");
    try { await signInWithRedirect(auth, gProv); }
    catch (e) { setAuthErr("Google sign-in failed. Try email instead."); }
  };
  const doLogout = async () => { await signOut(auth); setIsGuest(false); };

  // Theme
  const t = dk
    ? { bg:"#0a0a0f",cd:"#13131a",al:"#1a1a24",bd:"#252530",tx:"#f0f0f5",sc:"#8888a0",ac:"#6C63FF",gl:"rgba(108,99,255,0.15)",rd:"#ff6b6b",gn:"#4ecdc4",wn:"#f5af19",ip:"#1a1a24" }
    : { bg:"#f5f5f8",cd:"#ffffff",al:"#f0f0f5",bd:"#e0e0e8",tx:"#1a1a2e",sc:"#666680",ac:"#6C63FF",gl:"rgba(108,99,255,0.1)",rd:"#ff6b6b",gn:"#4ecdc4",wn:"#f5af19",ip:"#f0f0f5" };

  // Active data based on mode
  const activeExps = bizMode ? bizExps : exps;
  const setActiveExps = bizMode ? setBizExps : setExps;

  // Computed
  const nw = new Date();
  const cMo = nw.getMonth(), cYr = nw.getFullYear(), cDay = nw.getDate();
  const moExps = activeExps.filter(e => { const d = new Date(e.date); return d.getMonth() === cMo && d.getFullYear() === cYr; });
  const totSpent = moExps.reduce((s, e) => s + e.convAmt, 0);
  const remain = budget - totSpent;
  const pct = budget > 0 ? Math.min((totSpent / budget) * 100, 100) : 0;
  const dInMo = new Date(cYr, cMo + 1, 0).getDate();
  const dBudget = remain > 0 ? remain / (dInMo - cDay + 1) : 0;
  const todayExps = moExps.filter(e => new Date(e.date).getDate() === cDay);
  const todaySpent = todayExps.reduce((s, e) => s + e.convAmt, 0);
  const bCol = barColor(pct);
  const catTotals = moExps.reduce((a, e) => { a[e.category] = (a[e.category] || 0) + e.convAmt; return a; }, {});

  // Premium: Recurring & Pre-allocation
  const recurTotal = recurring.reduce((s, r) => s + r.amt, 0);
  const spendable = budget - recurTotal;
  const adjRemain = isPro ? spendable - totSpent : remain;

  // Business computed
  const moRevenue = revenue.filter(r => { const d = new Date(r.date); return d.getMonth() === cMo && d.getFullYear() === cYr; });
  const totalRev = moRevenue.reduce((s, r) => s + r.amt, 0);
  const profit = totalRev - totSpent;
  const unpaidInv = invoices.filter(i => !i.paid);
  const paidInv = invoices.filter(i => i.paid);
  const taxExps = moExps.filter(e => e.taxDeduct);

  // Voice
  const startListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported. Try Chrome on Android, or Safari 14.1+ on iPhone!"); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 3;
    let finalTranscript = "";
    let hasResult = false;
    let stopTimer = null;

    r.onstart = () => {
      setListening(true);
      // Auto-stop after 8 seconds if no final result
      stopTimer = setTimeout(() => {
        r.stop();
      }, 8000);
    };

    r.onresult = ev => {
      hasResult = true;
      finalTranscript = "";
      let interimTranscript = "";
      for (let i = 0; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          finalTranscript += ev.results[i][0].transcript;
        } else {
          interimTranscript += ev.results[i][0].transcript;
        }
      }
      // Use final if available, otherwise use interim
      const transcript = (finalTranscript || interimTranscript).toLowerCase().trim();
      if (!transcript) return;

      // If we have a final result, process it
      if (finalTranscript) {
        if (stopTimer) clearTimeout(stopTimer);
        r.stop();
        processVoice(transcript);
      }
    };

    r.onerror = (e) => {
      console.log("Speech error:", e.error);
      if (stopTimer) clearTimeout(stopTimer);
      setListening(false);
      if (e.error === "not-allowed") alert("Mic access denied. Go to Settings → Safari → Microphone → Allow");
      else if (e.error === "no-speech") alert("No speech detected. Speak louder or closer to mic.");
    };

    r.onend = () => {
      if (stopTimer) clearTimeout(stopTimer);
      setListening(false);
      // If we only got interim results (iPhone issue), process them
      if (!hasResult) return;
      if (!finalTranscript) {
        // Fallback: grab whatever we last heard
        const last = finalTranscript || "";
        if (last) processVoice(last.toLowerCase().trim());
      }
    };

    recRef.current = r;
    r.start();
  };

  const processVoice = (transcript) => {
    console.log("Voice heard:", transcript);

    const amtMatch = transcript.match(/(\d+[\.,]?\d*)/);
    const wordNums = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, fifteen:15, twenty:20, "twenty five":25, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90, hundred:100 };
    let amt = amtMatch ? parseFloat(amtMatch[1].replace(",", ".")) : 0;
    if (amt === 0) {
      for (const [w, n] of Object.entries(wordNums)) {
        if (transcript.includes(w)) { amt = n; break; }
      }
    }

    let foundCat = "";
    const currentCats = cats;
    for (const c of currentCats) { if (transcript.includes(c.name.toLowerCase())) { foundCat = c.name; break; } }
    if (!foundCat) {
      const kw = { Food:["food","lunch","dinner","breakfast","coffee","groceries","eat","snack","meal","restaurant","pizza","burger","chicken","rice"],Transport:["uber","taxi","bus","gas","fuel","ride","train","metro","lyft","bolt","careem"],Housing:["rent","mortgage"],Entertainment:["movie","netflix","game","concert","spotify","youtube"],Shopping:["shop","buy","bought","amazon","clothes","shoes","zara","nike"],Health:["doctor","medicine","gym","pharmacy","hospital"],Utilities:["bill","internet","phone","electric","water","wifi"],Education:["book","course","school","tuition"],Travel:["flight","hotel","trip","travel","vacation","airbnb"] };
      for (const [k, ws] of Object.entries(kw)) if (ws.some(w => transcript.includes(w)) && currentCats.find(c => c.name === k)) { foundCat = k; break; }
    }
    if (!foundCat) foundCat = "Other";

    let desc = transcript.replace(/[\d,\.]+/, "").replace(foundCat.toLowerCase(), "").replace(/\b(dollar|dollars|pound|pounds|euro|euros|dirham|dirhams|spent|spend|paid|pay|for|on|at)\b/gi, "").trim();
    if (!desc || desc.length < 2) desc = transcript;

    if (amt > 0) {
      const newExp = { id: Date.now(), amt, cur: bCurr, convAmt: amt, desc: desc.charAt(0).toUpperCase()+desc.slice(1), category: foundCat, date: new Date().toISOString(), taxDeduct: false };
      if (bizMode) setBizExps(p => [newExp, ...p]); else setExps(p => [newExp, ...p]);
      setShowAdd(false);
    } else {
      setEDesc(desc.charAt(0).toUpperCase()+desc.slice(1));
      if (foundCat) setECat(foundCat);
      setEAmt("");
    }
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
    const newExp = { id: Date.now(), amt: a, cur, convAmt: cnv(a, cur, bCurr), desc: eDesc || eCat, category: eCat, date: new Date().toISOString(), taxDeduct: bizMode && eIsTax };
    setActiveExps(p => [newExp, ...p]);
    setEAmt(""); setEDesc(""); setECat(""); setEIsTax(false); clrReceipt(); setShowAdd(false);
  };

  const delExp = id => setActiveExps(p => p.filter(e => e.id !== id));

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
    activeExps.filter(e => new Date(e.date).getFullYear() === cYr).forEach(e => { const k = MO_NAMES[new Date(e.date).getMonth()]; m[k] = (m[k]||0) + e.convAmt; });
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
          <div style={{ fontSize:12, color:t.sc }}>{c?.name} · {new Date(e.date).toLocaleDateString("en",{month:"short",day:"numeric"})}{e.cur !== bCurr ? (" · "+(CURRENCIES.find(x=>x.code===e.cur)?.symbol||"")+e.amt) : ""}{e.taxDeduct ? " · 📋 Tax" : ""}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontWeight:700, color:t.rd, fontSize:15, whiteSpace:"nowrap" }}>-{fmtM(e.convAmt, bCurr)}</span>
          {canDel && <span style={{ cursor:"pointer", color:t.sc, padding:4, fontSize:14 }} onClick={() => delExp(e.id)}>✕</span>}
        </div>
      </div>
    );
  };

  const css = "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes spin{to{transform:rotate(360deg)}}input:focus,select:focus{border-color:#6C63FF!important;outline:none}::-webkit-scrollbar{width:0}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}input[type=number]{-moz-appearance:textfield}input[type=range]{-webkit-appearance:auto;appearance:auto;background:transparent;border:none;padding:0}";

  // ===================== LOADING =====================
  if (authLoading) {
    return (
      <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
        <style>{css}</style>
        <div style={{ fontSize:64, marginBottom:16, animation:"pulse 1.5s infinite" }}>💰</div>
        <div style={{ color:"#f0f0f5", fontSize:18, fontWeight:600 }}>Loading...</div>
      </div>
    );
  }

  // ===================== LOGIN SCREEN =====================
  if (!user && !isGuest) {
    const lbg = { minHeight:"100vh", background:"#0a0a0f", color:"#f0f0f5", fontFamily:"'DM Sans',sans-serif", maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column", justifyContent:"center", padding:24 };
    return (
      <div style={lbg}>
        <style>{css}</style>
        <div style={{ textAlign:"center", marginBottom:32, animation:"fadeIn 0.5s" }}>
          <div style={{ fontSize:64, marginBottom:16 }}>💰</div>
          <h1 style={{ fontSize:28, fontWeight:700, marginBottom:4 }}>Your Budget Tracker</h1>
          <p style={{ color:"#8888a0" }}>Smart. Simple. Secure.</p>
        </div>

        <div style={{ animation:"fadeIn 0.5s" }}>
          {authErr && (
            <div style={{ padding:"12px 16px", borderRadius:12, background:"#ff6b6b15", border:"1px solid #ff6b6b40", marginBottom:16, fontSize:13, color:"#ff6b6b", textAlign:"center" }}>{authErr}</div>
          )}

          <input style={inp} placeholder="Email" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
          <div style={{ height:10 }} />
          <input style={inp} placeholder="Password" type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} onKeyDown={e => e.key === "Enter" && (authPg === "login" ? doLogin() : doSignup())} />

          <button style={{ ...btn(), marginTop:16 }} onClick={authPg === "login" ? doLogin : doSignup}>
            {authPg === "login" ? "Sign In" : "Create Account"}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
            <div style={{ flex:1, height:1, background:"#252530" }} />
            <span style={{ fontSize:12, color:"#8888a0" }}>or</span>
            <div style={{ flex:1, height:1, background:"#252530" }} />
          </div>

          <button onClick={doGoogle} style={{ width:"100%", padding:"14px 20px", borderRadius:14, background:"#13131a", border:"1px solid #252530", color:"#f0f0f5", fontSize:15, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <div style={{ textAlign:"center", marginTop:20 }}>
            <span style={{ fontSize:13, color:"#8888a0" }}>
              {authPg === "login" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <span style={{ fontSize:13, color:"#6C63FF", cursor:"pointer", fontWeight:600 }} onClick={() => { setAuthPg(authPg === "login" ? "signup" : "login"); setAuthErr(""); }}>
              {authPg === "login" ? "Sign Up" : "Sign In"}
            </span>
          </div>

          <div style={{ textAlign:"center", marginTop:24, paddingTop:20, borderTop:"1px solid #252530" }}>
            <button onClick={() => setIsGuest(true)} style={{ background:"none", border:"none", color:"#8888a0", fontSize:14, cursor:"pointer", padding:10 }}>
              Continue as Guest →
            </button>
            <div style={{ fontSize:11, color:"#555", marginTop:6 }}>⚠️ Guest data is stored on this device only and may be lost</div>
          </div>
        </div>
      </div>
    );
  }

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
            <button style={{ ...btn(), marginTop:24 }} onClick={() => setObStep(4)}>Let's Go! 🚀</button>
          </div>
        )}
        {obStep === 4 && (
          <div style={{ textAlign:"center", animation:"fadeIn 0.5s" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>💎</div>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Go Pro?</h2>
            <p style={{ color:t.sc, marginBottom:20 }}>Unlock powerful features</p>
            <div style={{ textAlign:"left", marginBottom:20 }}>
              {["🧾 Auto receipt scanning","🔁 Recurring expenses (rent, bills)","🏠 Budget pre-allocation","🎯 Category spending limits","📤 Export CSV & PDF"].map(f => (
                <div key={f} style={{ padding:"10px 14px", borderRadius:10, background:t.cd, border:"1px solid "+t.bd, marginBottom:6, fontSize:13, display:"flex", alignItems:"center", gap:10 }}>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <button style={{ ...btn(), marginBottom:10, background:"linear-gradient(135deg,#6C63FF,#8b7aff)" }} onClick={() => setShowUpgrade(true)}>Upgrade to Pro 💎</button>
            <button style={{ background:"none", border:"none", color:t.sc, fontSize:14, cursor:"pointer", padding:10 }} onClick={finishOb}>Skip for now →</button>
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:24 }}>
          {[0,1,2,3,4].map(i => <div key={i} style={{ width:i===obStep?24:8, height:8, borderRadius:4, background:i===obStep?t.ac:t.bd, transition:"all 0.3s" }} />)}
        </div>
      </div>
    );
  }

  // ===================== MAIN APP =====================
  return (
    <div style={{ minHeight:"100vh", background:t.bg, color:t.tx, fontFamily:"'DM Sans',sans-serif", maxWidth:480, margin:"0 auto", position:"relative" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ padding:"16px 20px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:13, color:t.sc }}>Welcome back</div>
            <div style={{ fontSize:20, fontWeight:700 }}>{uName} 👋</div>
          </div>
          <button onClick={() => setDk(!dk)} style={{ background:t.al, border:"1px solid "+t.bd, borderRadius:12, padding:"8px 12px", color:t.tx, cursor:"pointer", fontSize:16 }}>{dk ? "☀️" : "🌙"}</button>
          {user && saving && <div style={{ fontSize:10, color:t.ac, position:"absolute", right:20, top:44 }}>☁️ Syncing...</div>}
          {user && !saving && <div style={{ fontSize:10, color:t.gn, position:"absolute", right:20, top:44 }}>☁️</div>}
        </div>
        {/* Mode Switcher */}
        <div style={{ display:"flex", gap:6, padding:4, borderRadius:14, background:t.al, border:"1px solid "+t.bd }}>
          {[
            { id:"personal", label:"Personal", icon:"👤", unlocked:true },
            { id:"pro", label:"Pro", icon:"💎", unlocked:isPro },
            { id:"business", label:"Business", icon:"💼", unlocked:isBiz },
          ].map(m => (
            <div key={m.id} onClick={() => {
              if (m.id === activeMode) return;
              if (m.id === "pro" && !isPro) { setShowUpgrade(true); return; }
              if (m.id === "business" && !isBiz) { setShowBizUpgrade(true); return; }
              setSwitchTo(m.id);
            }} style={{
              flex:1, padding:"8px 4px", borderRadius:10, textAlign:"center", cursor:"pointer",
              background: activeMode===m.id ? (m.id==="business"?"linear-gradient(135deg,#f5af19,#f093fb)":m.id==="pro"?"linear-gradient(135deg,#6C63FF,#8b7aff)":t.cd) : "transparent",
              color: activeMode===m.id ? "#fff" : t.sc,
              transition:"all 0.2s"
            }}>
              <div style={{ fontSize:14 }}>{m.icon}{!m.unlocked && m.id!=="personal" ? "🔒" : ""}</div>
              <div style={{ fontSize:10, fontWeight:600, marginTop:2 }}>{m.label}</div>
            </div>
          ))}
        </div>
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

          {/* Pre-allocation card (Pro/Biz users) */}
          {(isPro || isBiz) && recurring.length > 0 && (
            <div style={{ margin:"0 20px 12px", padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>💎 Fixed Costs Pre-Allocated</div>
                <span style={{ fontSize:12, color:t.sc }}>{fmtM(recurTotal, bCurr)}/mo</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:t.sc }}>
                <span>Budget: {fmtM(budget, bCurr)}</span>
                <span>Spendable: <span style={{ color:t.gn, fontWeight:600 }}>{fmtM(spendable, bCurr)}</span></span>
              </div>
            </div>
          )}

          {/* Category budget alerts (Pro) */}
          {(isPro || isBiz) && Object.entries(catBudgets).filter(([cat, lim]) => lim > 0 && (catTotals[cat] || 0) >= lim * 0.85).length > 0 && (
            <div style={{ padding:"0 20px", marginBottom:12 }}>
              {Object.entries(catBudgets).filter(([cat, lim]) => lim > 0 && (catTotals[cat] || 0) >= lim * 0.85).map(([cat, lim]) => {
                const spent = catTotals[cat] || 0;
                const over = spent >= lim;
                return (
                  <div key={cat} style={{ padding:"10px 14px", borderRadius:10, background:(over?t.rd:t.wn)+"12", border:"1px solid "+(over?t.rd:t.wn)+"30", marginBottom:6, fontSize:12, display:"flex", alignItems:"center", gap:8 }}>
                    <span>{cats.find(c=>c.name===cat)?.emoji}</span>
                    <span style={{ color:over?t.rd:t.wn }}>{over?"🚨":"⚠️"} {cat}: {fmtM(spent,bCurr)} / {fmtM(lim,bCurr)}</span>
                  </div>
                );
              })}
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
          <div style={{ padding:"8px 20px 0", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h2 style={{ fontSize:22, fontWeight:700 }}>Stats</h2>
            {archive.length > 0 && <span style={{ fontSize:13, color:t.ac, cursor:"pointer" }} onClick={() => setShowHistory(true)}>📅 History</span>}
          </div>
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

            <div style={{ fontSize:14, fontWeight:600, color:t.sc, marginBottom:10, marginTop:20, textTransform:"uppercase", letterSpacing:1 }}>Mode Features</div>
            {activeMode === "personal" && (
              <div style={{ padding:"16px", borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:20, textAlign:"center" }}>
                <div style={{ fontSize:13, color:t.sc }}>Switch to Pro or Business mode using the toggle at the top of the screen to access premium features.</div>
              </div>
            )}
            {activeMode === "pro" && isPro && (
              <div style={{ marginBottom:20 }}>
                <div style={{ padding:"12px 16px", borderRadius:14, background:"linear-gradient(135deg,#6C63FF10,#8b7aff10)", border:"1px solid #6C63FF30", marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>💎</span>
                  <span style={{ fontSize:14, fontWeight:600, color:t.ac }}>Pro Active</span>
                </div>
                <div onClick={() => setShowRecurring(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>🔁</span>
                  <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>Recurring Expenses</div><div style={{ fontSize:12, color:t.sc }}>{recurring.length} items · {fmtM(recurTotal, bCurr)}/mo</div></div>
                  <span style={{ color:t.sc }}>›</span>
                </div>
                <div onClick={() => setShowCatBdgt(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>🎯</span>
                  <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>Category Budgets</div><div style={{ fontSize:12, color:t.sc }}>Set spending limits per category</div></div>
                  <span style={{ color:t.sc }}>›</span>
                </div>
              </div>
            )}
            {activeMode === "business" && isBiz && (
              <div style={{ marginBottom:20 }}>
                <div style={{ padding:"12px 16px", borderRadius:14, background:"linear-gradient(135deg,#f5af1910,#f093fb10)", border:"1px solid #f5af1930", marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>💼</span>
                  <span style={{ fontSize:14, fontWeight:600, color:"#f5af19" }}>Business Active</span>
                </div>
                <div onClick={() => setShowInvoice(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>🧾</span>
                  <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>Invoices</div><div style={{ fontSize:12, color:t.sc }}>{unpaidInv.length} unpaid · {paidInv.length} paid</div></div>
                  <span style={{ color:t.sc }}>›</span>
                </div>
                <div onClick={() => setShowRevenue(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>💵</span>
                  <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>Revenue</div><div style={{ fontSize:12, color:t.sc }}>{fmtM(totalRev, bCurr)} this month</div></div>
                  <span style={{ color:t.sc }}>›</span>
                </div>
                <div onClick={() => setShowPL(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>📈</span>
                  <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>P&L Dashboard</div><div style={{ fontSize:12, color:profit>=0?t.gn:t.rd }}>{profit>=0?"Profit":"Loss"}: {fmtM(Math.abs(profit), bCurr)}</div></div>
                  <span style={{ color:t.sc }}>›</span>
                </div>
                <div onClick={() => setShowRecurring(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>🔁</span>
                  <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>Recurring Expenses</div><div style={{ fontSize:12, color:t.sc }}>{recurring.length} items</div></div>
                  <span style={{ color:t.sc }}>›</span>
                </div>
                <div onClick={() => setShowCatBdgt(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>🎯</span>
                  <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>Category Budgets</div><div style={{ fontSize:12, color:t.sc }}>Set spending limits</div></div>
                  <span style={{ color:t.sc }}>›</span>
                </div>
              </div>
            )}

            <div style={{ fontSize:14, fontWeight:600, color:t.sc, marginBottom:10, marginTop:20, textTransform:"uppercase", letterSpacing:1 }}>Appearance</div>
            <div style={{ display:"flex", gap:10, marginBottom:20 }}>
              <button onClick={() => setDk(true)} style={{ ...btn(dk?t.ac:t.al), flex:1, color:dk?"#fff":t.tx, border:"1px solid "+(dk?t.ac:t.bd) }}>🌙 Dark</button>
              <button onClick={() => setDk(false)} style={{ ...btn(!dk?t.ac:t.al), flex:1, color:!dk?"#fff":t.tx, border:"1px solid "+(!dk?t.ac:t.bd) }}>☀️ Light</button>
            </div>

            <div style={{ padding:"14px 16px", borderRadius:14, background:user?t.ac+"12":"#f5af1912", border:"1px solid "+(user?t.ac:"#f5af19")+"30", marginBottom:20 }}>
              {user ? (
                <>
                  <div style={{ fontSize:13, fontWeight:600, color:t.ac, marginBottom:4 }}>☁️ Cloud Sync Active</div>
                  <div style={{ fontSize:12, color:t.sc, lineHeight:1.5 }}>Signed in as {user.email}. Data syncs across all your devices automatically.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f5af19", marginBottom:4 }}>⚠️ Guest Mode — Data at risk</div>
                  <div style={{ fontSize:12, color:t.sc, lineHeight:1.5, marginBottom:10 }}>Your data is only saved on this device. Clearing browser data or switching devices will erase it.</div>
                  <button style={{ ...btn(), fontSize:13, padding:"10px 16px" }} onClick={() => setShowLogin(true)}>☁️ Sign In to Save Your Data</button>
                </>
              )}
            </div>

            <div style={{ fontSize:14, fontWeight:600, color:t.rd, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Danger Zone</div>
            <button style={{ ...btn(t.rd), marginBottom:10 }} onClick={() => setConfirmAction("reset")}>🗑️ Reset All Data</button>
            <button style={{ ...btn(t.al), color:t.tx, border:"1px solid "+t.bd, marginBottom:10 }} onClick={() => setConfirmAction("fresh")}>🔄 Start Fresh</button>
            {user && <button style={{ ...btn(t.al), color:t.sc, border:"1px solid "+t.bd }} onClick={doLogout}>🚪 Sign Out</button>}
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:bizMode?8:16 }}>
              {cats.map(cat => (
                <div key={cat.name} onClick={() => setECat(cat.name)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 4px", borderRadius:12, background:eCat===cat.name?t.ac:t.al, border:"1px solid "+(eCat===cat.name?t.ac:t.bd), cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>{cat.emoji}</span>
                  <span style={{ fontSize:8, color:eCat===cat.name?"#fff":t.sc }}>{cat.name}</span>
                </div>
              ))}
              {(bizMode || (isPro && activeMode === "pro")) && (
                <div onClick={() => setShowAddCat(true)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 4px", borderRadius:12, background:t.al, border:"1px dashed "+t.ac, cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>➕</span>
                  <span style={{ fontSize:8, color:t.ac }}>Custom</span>
                </div>
              )}
            </div>
            {bizMode && (
              <div onClick={() => setEIsTax(!eIsTax)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:12, background:eIsTax?t.gn+"15":t.al, border:"1px solid "+(eIsTax?t.gn+"40":t.bd), marginBottom:12, cursor:"pointer" }}>
                <span style={{ fontSize:18 }}>{eIsTax ? "✅" : "⬜"}</span>
                <span style={{ fontSize:13, color:eIsTax?t.gn:t.sc }}>Tax Deductible</span>
              </div>
            )}
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
        <div style={{...modBg, alignItems:"center"}} onClick={e => e.target === e.currentTarget && setConfirmAction(null)}>
          <div style={{ width:"100%", maxWidth:380, background:t.cd, borderRadius:24, padding:28, margin:"auto", animation:"fadeIn 0.2s", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>{confirmAction === "reset" ? "🗑️" : "🔄"}</div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>
              {confirmAction === "reset" ? "Reset All Data?" : "Start Fresh?"}
            </h3>
            <p style={{ fontSize:14, color:t.sc, lineHeight:1.5, marginBottom:24 }}>
              {confirmAction === "reset"
                ? ("This will delete all your " + (bizMode ? "business" : "personal") + " expenses" + (bizMode ? ", invoices, and revenue" : "") + ". Your " + (bizMode ? "personal" : "business") + " data will not be affected.")
                : "This will erase EVERYTHING (personal + business) and take you back to the beginning."
              }
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...btn(t.al), flex:1, color:t.tx, border:"1px solid "+t.bd }} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button style={{ ...btn(t.rd), flex:1 }} onClick={async () => {
                if (confirmAction === "reset") {
                  if (bizMode) { setBizExps([]); setInvoices([]); setRevenue([]); }
                  else { setExps([]); }
                  setAlerts([]);
                } else {
                  setOnboarded(false); setObStep(0); setExps([]); setBizExps([]); setAlerts([]); setInvoices([]); setRevenue([]); setRecurring([]); setCatBudgets({}); setIsPro(false); setIsBiz(false); setActiveMode("personal"); setBizMode(false); setArchive([]);
                  localStorage.removeItem("btv2");
                  if (user) try { await setDoc(doc(db, "users", user.uid), { cleared: true }); } catch(e) {}
                }
                setConfirmAction(null);
              }}>
                {confirmAction === "reset" ? "Delete All" : "Start Over"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MONTH HISTORY */}
      {showHistory && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowHistory(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>📅 Past Months</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowHistory(false)}>✕</span>
            </div>
            {archive.length === 0 ? (
              <div style={{ textAlign:"center", padding:32, color:t.sc }}>No archived months yet. Past months appear here automatically.</div>
            ) : archive.sort((a,b) => (b.year*12+b.month) - (a.year*12+a.month)).map(a => (
              <div key={a.key} style={{ padding:16, borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:16, fontWeight:700 }}>{a.key}</span>
                  <span style={{ fontSize:16, fontWeight:700, color:t.rd }}>{fmtM(a.total, bCurr)}</span>
                </div>
                <div style={{ fontSize:12, color:t.sc, marginBottom:8 }}>{a.exps.length} transactions</div>
                {a.exps.slice(0, 5).map(e => {
                  const c = cats.find(x => x.name === e.category) || DEF_CATS.find(x => x.name === e.category);
                  return (
                    <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop:"1px solid "+t.bd, fontSize:13 }}>
                      <span>{c?.emoji || "💰"}</span>
                      <span style={{ flex:1 }}>{e.desc}</span>
                      <span style={{ color:t.rd, fontWeight:600 }}>{fmtM(e.convAmt, bCurr)}</span>
                    </div>
                  );
                })}
                {a.exps.length > 5 && <div style={{ fontSize:12, color:t.sc, textAlign:"center", padding:"8px 0" }}>+{a.exps.length - 5} more</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIGN IN MODAL */}
      {showLogin && (
        <div style={{...modBg, alignItems:"center"}} onClick={e => e.target === e.currentTarget && setShowLogin(false)}>
          <div style={{ width:"100%", maxWidth:400, background:t.cd, borderRadius:24, padding:28, margin:"auto", animation:"fadeIn 0.2s" }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>☁️</div>
              <h3 style={{ fontSize:20, fontWeight:700 }}>{authPg === "login" ? "Sign In" : "Create Account"}</h3>
              <p style={{ fontSize:12, color:t.sc }}>Sync your data across all devices</p>
            </div>
            {authErr && <div style={{ padding:"10px 14px", borderRadius:10, background:t.rd+"15", border:"1px solid "+t.rd+"30", marginBottom:12, fontSize:12, color:t.rd, textAlign:"center" }}>{authErr}</div>}
            <input style={{ ...inp, marginBottom:10 }} placeholder="Email" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
            <input style={{ ...inp, marginBottom:14 }} placeholder="Password" type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { authPg === "login" ? doLogin() : doSignup(); }}} />
            <button style={{ ...btn(), marginBottom:10 }} onClick={async () => {
              if (authPg === "login") await doLogin(); else await doSignup();
              if (auth.currentUser) { setShowLogin(false); setAuthEmail(""); setAuthPass(""); }
            }}>{authPg === "login" ? "Sign In" : "Create Account"}</button>
            <div style={{ display:"flex", alignItems:"center", gap:12, margin:"6px 0 14px" }}>
              <div style={{ flex:1, height:1, background:t.bd }} /><span style={{ fontSize:11, color:t.sc }}>or</span><div style={{ flex:1, height:1, background:t.bd }} />
            </div>
            <button onClick={() => doGoogle()} style={{ width:"100%", padding:"12px 16px", borderRadius:14, background:t.al, border:"1px solid "+t.bd, color:t.tx, fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span style={{ fontSize:16 }}>G</span> Continue with Google
            </button>
            <div style={{ textAlign:"center", marginTop:14 }}>
              <span style={{ fontSize:12, color:t.sc }}>{authPg === "login" ? "No account? " : "Have an account? "}</span>
              <span style={{ fontSize:12, color:t.ac, cursor:"pointer", fontWeight:600 }} onClick={() => { setAuthPg(authPg === "login" ? "signup" : "login"); setAuthErr(""); }}>{authPg === "login" ? "Sign Up" : "Sign In"}</span>
            </div>
            <button style={{ background:"none", border:"none", color:t.sc, fontSize:12, cursor:"pointer", padding:10, width:"100%", marginTop:4 }} onClick={() => { setShowLogin(false); setAuthErr(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* MODE SWITCH CONFIRMATION */}
      {switchTo && (
        <div style={{...modBg, alignItems:"center"}} onClick={e => e.target === e.currentTarget && setSwitchTo(null)}>
          <div style={{ width:"100%", maxWidth:380, background:t.cd, borderRadius:24, padding:28, margin:"auto", animation:"fadeIn 0.2s", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>{switchTo==="personal"?"👤":switchTo==="pro"?"💎":"💼"}</div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>
              Switch to {switchTo==="personal"?"Personal":switchTo==="pro"?"Pro":"Business"} Mode?
            </h3>
            <p style={{ fontSize:13, color:t.sc, lineHeight:1.5, marginBottom:24 }}>
              {switchTo==="personal" ? "You'll see your personal expenses and categories." :
               switchTo==="pro" ? "You'll see your personal expenses with Pro features like recurring bills and category limits." :
               "You'll switch to business categories, invoices, revenue tracking, and P&L dashboard."}
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...btn(t.al), flex:1, color:t.tx, border:"1px solid "+t.bd }} onClick={() => setSwitchTo(null)}>Cancel</button>
              <button style={{ ...btn(switchTo==="business"?"#f5af19":t.ac), flex:1, background:switchTo==="business"?"linear-gradient(135deg,#f5af19,#f093fb)":switchTo==="pro"?"linear-gradient(135deg,#6C63FF,#8b7aff)":t.ac }} onClick={() => {
                setActiveMode(switchTo);
                if (switchTo === "business") { setBizMode(true); setCats(DEF_BIZ_CATS); }
                else { setBizMode(false); setCats(DEF_CATS); }
                setPg("home");
                setSwitchTo(null);
              }}>Switch {switchTo==="personal"?"👤":switchTo==="pro"?"💎":"💼"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOM CATEGORY (Business) */}
      {showAddCat && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowAddCat(false)}>
          <div style={{ width:"100%", maxWidth:380, background:t.cd, borderRadius:24, padding:28, margin:"auto", animation:"fadeIn 0.2s" }}>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:48, marginBottom:8 }}>{newCatEmoji}</div>
              <h3 style={{ fontSize:20, fontWeight:700 }}>New Category</h3>
            </div>
            <input style={{ ...inp, marginBottom:12 }} placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
            <div style={{ fontSize:13, color:t.sc, marginBottom:8 }}>Pick an emoji</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:6, marginBottom:16 }}>
              {["📁","🏗️","🎨","📞","🚚","🍽️","🛠️","💡","📊","🏪","🎯","🔬","📦","🏥","🎪","⚡","🔌","💳","🏦","📱","🖥️","🎓","🛒","✂️"].map(em => (
                <div key={em} onClick={() => setNewCatEmoji(em)} style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, cursor:"pointer", background:newCatEmoji===em?t.ac:t.al, border:"1px solid "+(newCatEmoji===em?t.ac:t.bd) }}>{em}</div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...btn(t.al), flex:1, color:t.tx, border:"1px solid "+t.bd }} onClick={() => setShowAddCat(false)}>Cancel</button>
              <button style={{ ...btn(), flex:1, opacity:newCatName?1:0.4 }} onClick={() => {
                if (!newCatName) return;
                const colors = ["#667eea","#f093fb","#6C63FF","#0fd850","#f78ca0","#4facfe","#f5af19","#fa709a","#43e97b","#a18cd1"];
                const col = colors[cats.length % colors.length];
                setCats(p => [...p, { name: newCatName, emoji: newCatEmoji, color: col }]);
                setECat(newCatName);
                setNewCatName(""); setNewCatEmoji("📁"); setShowAddCat(false);
              }}>Add Category</button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {showInvoice && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowInvoice(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>🧾 Invoices</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowInvoice(false)}>✕</span>
            </div>
            <div style={{ padding:16, borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:16 }}>
              <input style={{ ...inp, marginBottom:8 }} placeholder="Invoice description" value={iName} onChange={e => setIName(e.target.value)} />
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <input style={{ ...inp, flex:1 }} type="number" placeholder="Amount" value={iAmt} onChange={e => setIAmt(e.target.value)} />
                <input style={{ ...inp, flex:1 }} placeholder="Client name" value={iClient} onChange={e => setIClient(e.target.value)} />
              </div>
              <button style={{ ...btn(), opacity:iName&&iAmt?1:0.4 }} onClick={() => {
                if (!iName || !iAmt) return;
                setInvoices(p => [{ id: Date.now(), name: iName, amt: parseFloat(iAmt), client: iClient, paid: false, date: new Date().toISOString() }, ...p]);
                setIName(""); setIAmt(""); setIClient("");
              }}>Create Invoice</button>
            </div>
            {invoices.length === 0 ? (
              <div style={{ textAlign:"center", padding:24, color:t.sc }}>No invoices yet</div>
            ) : (
              <>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <div style={{ flex:1, padding:10, borderRadius:10, background:t.wn+"12", textAlign:"center" }}><div style={{ fontSize:11, color:t.sc }}>Unpaid</div><div style={{ fontSize:16, fontWeight:700, color:t.wn }}>{fmtM(unpaidInv.reduce((s,i)=>s+i.amt,0), bCurr)}</div></div>
                  <div style={{ flex:1, padding:10, borderRadius:10, background:t.gn+"12", textAlign:"center" }}><div style={{ fontSize:11, color:t.sc }}>Paid</div><div style={{ fontSize:16, fontWeight:700, color:t.gn }}>{fmtM(paidInv.reduce((s,i)=>s+i.amt,0), bCurr)}</div></div>
                </div>
                {invoices.map(inv => (
                  <div key={inv.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8 }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:inv.paid?t.gn+"20":t.wn+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{inv.paid?"✅":"📄"}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{inv.name}</div>
                      <div style={{ fontSize:12, color:t.sc }}>{inv.client || "No client"} · {new Date(inv.date).toLocaleDateString("en",{month:"short",day:"numeric"})}</div>
                    </div>
                    <span style={{ fontWeight:700, fontSize:14, color:inv.paid?t.gn:t.tx }}>{fmtM(inv.amt, bCurr)}</span>
                    <span style={{ cursor:"pointer", padding:6, fontSize:12, color:t.ac }} onClick={() => setInvoices(p => p.map(i => i.id === inv.id ? {...i, paid:!i.paid} : i))}>{inv.paid?"Undo":"Pay"}</span>
                    <span style={{ cursor:"pointer", color:t.sc, padding:4 }} onClick={() => setInvoices(p => p.filter(i => i.id !== inv.id))}>✕</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* REVENUE MODAL */}
      {showRevenue && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowRevenue(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>💵 Revenue</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowRevenue(false)}>✕</span>
            </div>
            <div style={{ padding:16, borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:16 }}>
              <input style={{ ...inp, marginBottom:8 }} type="number" placeholder="Amount" value={rvAmt} onChange={e => setRvAmt(e.target.value)} />
              <input style={{ ...inp, marginBottom:8 }} placeholder="Description (e.g. Client payment)" value={rvDesc} onChange={e => setRvDesc(e.target.value)} />
              <input style={{ ...inp, marginBottom:8 }} placeholder="Source (e.g. Freelance, Sales)" value={rvSrc} onChange={e => setRvSrc(e.target.value)} />
              <button style={{ ...btn(), background:"linear-gradient(135deg,"+t.gn+",#43e97b)", opacity:rvAmt?1:0.4 }} onClick={() => {
                if (!rvAmt) return;
                setRevenue(p => [{ id: Date.now(), amt: parseFloat(rvAmt), desc: rvDesc || "Revenue", source: rvSrc, date: new Date().toISOString() }, ...p]);
                setRvAmt(""); setRvDesc(""); setRvSrc("");
              }}>Add Revenue</button>
            </div>
            <div style={{ padding:"10px 14px", borderRadius:10, background:t.gn+"12", marginBottom:12, textAlign:"center" }}>
              <div style={{ fontSize:11, color:t.sc }}>This Month</div>
              <div style={{ fontSize:20, fontWeight:700, color:t.gn }}>{fmtM(totalRev, bCurr)}</div>
            </div>
            {revenue.length === 0 ? (
              <div style={{ textAlign:"center", padding:24, color:t.sc }}>No revenue logged yet</div>
            ) : revenue.map(r => (
              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:t.gn+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>💵</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{r.desc}</div>
                  <div style={{ fontSize:12, color:t.sc }}>{r.source || "Revenue"} · {new Date(r.date).toLocaleDateString("en",{month:"short",day:"numeric"})}</div>
                </div>
                <span style={{ fontWeight:700, fontSize:14, color:t.gn }}>+{fmtM(r.amt, bCurr)}</span>
                <span style={{ cursor:"pointer", color:t.sc, padding:4 }} onClick={() => setRevenue(p => p.filter(x => x.id !== r.id))}>✕</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P&L DASHBOARD MODAL */}
      {showPL && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowPL(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>📈 Profit & Loss</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowPL(false)}>✕</span>
            </div>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:13, color:t.sc }}>{FULL_MO[cMo]} {cYr}</div>
            </div>
            {/* Summary cards */}
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <div style={{ flex:1, padding:16, borderRadius:14, background:t.gn+"12", textAlign:"center" }}>
                <div style={{ fontSize:11, color:t.sc }}>Revenue</div>
                <div style={{ fontSize:22, fontWeight:700, color:t.gn, marginTop:4 }}>{fmtM(totalRev, bCurr)}</div>
              </div>
              <div style={{ flex:1, padding:16, borderRadius:14, background:t.rd+"12", textAlign:"center" }}>
                <div style={{ fontSize:11, color:t.sc }}>Expenses</div>
                <div style={{ fontSize:22, fontWeight:700, color:t.rd, marginTop:4 }}>{fmtM(totSpent, bCurr)}</div>
              </div>
            </div>
            <div style={{ padding:20, borderRadius:14, background:profit>=0?"#4ecdc412":"#ff6b6b12", border:"1px solid "+(profit>=0?t.gn:t.rd)+"30", textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:13, color:t.sc }}>Net {profit>=0?"Profit":"Loss"}</div>
              <div style={{ fontSize:32, fontWeight:700, color:profit>=0?t.gn:t.rd, marginTop:4 }}>{profit>=0?"+":""}{fmtM(profit, bCurr)}</div>
              <div style={{ fontSize:12, color:t.sc, marginTop:4 }}>Margin: {totalRev>0?((profit/totalRev)*100).toFixed(1):0}%</div>
            </div>
            {/* Tax deductible summary */}
            {taxExps.length > 0 && (
              <div style={{ padding:14, borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>📋 Tax Deductible Expenses</div>
                <div style={{ fontSize:20, fontWeight:700, color:t.ac }}>{fmtM(taxExps.reduce((s,e)=>s+e.convAmt,0), bCurr)}</div>
                <div style={{ fontSize:12, color:t.sc, marginTop:4 }}>{taxExps.length} tax-deductible transactions</div>
              </div>
            )}
            {/* Top expense categories */}
            <div style={{ padding:14, borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Top Expense Categories</div>
              {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat, amt]) => {
                const cp = totSpent > 0 ? (amt/totSpent)*100 : 0;
                return (
                  <div key={cat} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:16 }}>{cats.find(c=>c.name===cat)?.emoji||"💰"}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span>{cat}</span><span style={{ color:t.sc }}>{fmtM(amt,bCurr)} ({cp.toFixed(0)}%)</span></div>
                      <div style={{ width:"100%", height:4, borderRadius:2, background:t.bd }}><div style={{ height:"100%", borderRadius:2, width:cp+"%", background:cats.find(c=>c.name===cat)?.color||t.ac }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Revenue sources */}
            {moRevenue.length > 0 && (
              <div style={{ padding:14, borderRadius:14, background:t.al, border:"1px solid "+t.bd }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Revenue Sources</div>
                {moRevenue.map(r => (
                  <div key={r.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", fontSize:13 }}>
                    <span>{r.desc}</span><span style={{ color:t.gn, fontWeight:600 }}>+{fmtM(r.amt, bCurr)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPGRADE MODAL */}
      {showUpgrade && (
        <div style={{...modBg, alignItems:"center"}} onClick={e => e.target === e.currentTarget && setShowUpgrade(false)}>
          <div style={{ width:"100%", maxWidth:400, background:t.cd, borderRadius:24, padding:28, margin:"auto", animation:"fadeIn 0.2s" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:8 }}>💎</div>
              <h3 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Upgrade to Pro</h3>
              <p style={{ fontSize:13, color:t.sc, marginBottom:20 }}>Unlock the full power of Your Budget Tracker</p>
            </div>
            {["🧾 Auto receipt scanning (AI-powered)","🔁 Recurring expenses (rent, bills, subscriptions)","🏠 Budget pre-allocation (see true spendable amount)","🎯 Category spending limits with alerts","📤 Export data as CSV or PDF","🗣️ Voice currency detection (coming soon)","☁️ Cloud sync across devices (coming soon)"].map(f => (
              <div key={f} style={{ padding:"10px 14px", borderRadius:10, background:t.al, marginBottom:6, fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:t.gn }}>✓</span><span>{f}</span>
              </div>
            ))}
            <div style={{ marginTop:20, padding:"14px 16px", borderRadius:14, background:t.al, border:"1px solid "+t.bd }}>
              <div style={{ fontSize:12, color:t.sc, marginBottom:8 }}>Have a Pro code?</div>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...inp, flex:1, fontSize:14 }} placeholder="Enter code" value={proCode} onChange={e => setProCode(e.target.value.toUpperCase())} />
                <button style={{ ...btn(), padding:"12px 20px", fontSize:14 }} onClick={() => {
                  if (proCode === PRO_CODE) { setIsPro(true); setShowUpgrade(false); setProCode(""); }
                  else { alert("Invalid code"); }
                }}>Activate</button>
              </div>
            </div>
            <button style={{ background:"none", border:"none", color:t.sc, fontSize:13, cursor:"pointer", padding:12, width:"100%", marginTop:8 }} onClick={() => setShowUpgrade(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {/* BUSINESS UPGRADE MODAL */}
      {showBizUpgrade && (
        <div style={{...modBg, alignItems:"center"}} onClick={e => e.target === e.currentTarget && setShowBizUpgrade(false)}>
          <div style={{ width:"100%", maxWidth:400, background:t.cd, borderRadius:24, padding:28, margin:"auto", animation:"fadeIn 0.2s" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:8 }}>💼</div>
              <h3 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Upgrade to Business</h3>
              <p style={{ fontSize:13, color:t.sc, marginBottom:20 }}>Full business expense management</p>
            </div>
            {["💼 Business expense categories","📋 Tax-deductible expense tagging","🧾 Invoice tracking (create, send, track)","💵 Revenue & income logging","📈 P&L Dashboard (profit/loss, margins)","🔁 Recurring expenses & pre-allocation","🎯 Category spending limits","📤 Export reports (coming soon)"].map(f => (
              <div key={f} style={{ padding:"10px 14px", borderRadius:10, background:t.al, marginBottom:6, fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:t.gn }}>✓</span><span>{f}</span>
              </div>
            ))}
            <div style={{ marginTop:20, padding:"14px 16px", borderRadius:14, background:t.al, border:"1px solid "+t.bd }}>
              <div style={{ fontSize:12, color:t.sc, marginBottom:8 }}>Have a Business code?</div>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...inp, flex:1, fontSize:14 }} placeholder="Enter code" value={bizCode} onChange={e => setBizCode(e.target.value.toUpperCase())} />
                <button style={{ ...btn(), padding:"12px 20px", fontSize:14, background:"linear-gradient(135deg,#f5af19,#f093fb)" }} onClick={() => {
                  if (bizCode === BIZ_CODE) { setIsBiz(true); setIsPro(true); setActiveMode("business"); setBizMode(true); setCats(DEF_BIZ_CATS); setShowBizUpgrade(false); setBizCode(""); }
                  else { alert("Invalid code"); }
                }}>Activate</button>
              </div>
            </div>
            <button style={{ background:"none", border:"none", color:t.sc, fontSize:13, cursor:"pointer", padding:12, width:"100%", marginTop:8 }} onClick={() => setShowBizUpgrade(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {/* RECURRING EXPENSES MODAL (Pro) */}
      {showRecurring && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowRecurring(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>🔁 Recurring Expenses</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowRecurring(false)}>✕</span>
            </div>
            <p style={{ fontSize:12, color:t.sc, marginBottom:16 }}>Fixed monthly costs deducted from your budget upfront.</p>

            {/* Add new recurring */}
            <div style={{ padding:16, borderRadius:14, background:t.al, border:"1px solid "+t.bd, marginBottom:16 }}>
              <input style={{ ...inp, marginBottom:8 }} placeholder="Name (e.g. Rent, Netflix)" value={rName} onChange={e => setRName(e.target.value)} />
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <input style={{ ...inp, flex:1 }} type="number" placeholder="Amount" value={rAmt} onChange={e => setRAmt(e.target.value)} />
                <select style={{ ...inp, width:100, appearance:"auto" }} value={rCat} onChange={e => setRCat(e.target.value)}>
                  {cats.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
                </select>
              </div>
              <button style={{ ...btn(), opacity:rName&&rAmt?1:0.4 }} onClick={() => {
                if (!rName || !rAmt) return;
                setRecurring(p => [...p, { id: Date.now(), name: rName, amt: parseFloat(rAmt), cat: rCat }]);
                setRName(""); setRAmt("");
              }}>Add Recurring Expense</button>
            </div>

            {/* List */}
            {recurring.length === 0 ? (
              <div style={{ textAlign:"center", padding:24, color:t.sc }}>No recurring expenses yet</div>
            ) : (
              <>
                <div style={{ padding:"10px 14px", borderRadius:10, background:t.ac+"12", marginBottom:12, fontSize:13, color:t.ac, fontWeight:600, textAlign:"center" }}>
                  Total: {fmtM(recurTotal, bCurr)}/month · Spendable: {fmtM(spendable, bCurr)}
                </div>
                {recurring.map(r => (
                  <div key={r.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:8 }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:t.al, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                      {cats.find(c => c.name === r.cat)?.emoji || "💰"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{r.name}</div>
                      <div style={{ fontSize:12, color:t.sc }}>{r.cat} · Monthly</div>
                    </div>
                    <span style={{ fontWeight:700, fontSize:14 }}>{fmtM(r.amt, bCurr)}</span>
                    <span style={{ cursor:"pointer", color:t.sc, padding:4 }} onClick={() => setRecurring(p => p.filter(x => x.id !== r.id))}>✕</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* CATEGORY BUDGETS MODAL (Pro) */}
      {showCatBdgt && (
        <div style={modBg} onClick={e => e.target === e.currentTarget && setShowCatBdgt(false)}>
          <div style={sheet}>
            <div style={handle} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:20, fontWeight:700 }}>🎯 Category Budgets</h3>
              <span style={{ cursor:"pointer", fontSize:20, color:t.sc }} onClick={() => setShowCatBdgt(false)}>✕</span>
            </div>
            <p style={{ fontSize:12, color:t.sc, marginBottom:16 }}>Set spending limits per category. Get alerted when you're close.</p>
            {cats.map(cat => {
              const spent = catTotals[cat.name] || 0;
              const limit = catBudgets[cat.name] || 0;
              const catPct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
              return (
                <div key={cat.name} style={{ padding:14, borderRadius:14, background:t.cd, border:"1px solid "+t.bd, marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:22 }}>{cat.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{cat.name}</div>
                      <div style={{ fontSize:12, color:t.sc }}>Spent: {fmtM(spent, bCurr)}{limit > 0 ? (" / "+fmtM(limit, bCurr)) : ""}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <input style={{ ...inp, flex:1, padding:"10px 12px", fontSize:14 }} type="number" placeholder="Set limit" value={catBudgets[cat.name] || ""} onChange={e => setCatBudgets(p => ({ ...p, [cat.name]: parseFloat(e.target.value) || 0 }))} />
                    <span style={{ fontSize:12, color:t.sc, minWidth:40 }}>{bCurr}</span>
                  </div>
                  {limit > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ width:"100%", height:6, borderRadius:3, background:t.al, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:3, width:catPct+"%", background:catPct>85?t.rd:catPct>65?t.wn:t.gn, transition:"width 0.3s" }} />
                      </div>
                      <div style={{ fontSize:11, color:catPct>85?t.rd:t.sc, marginTop:4, textAlign:"right" }}>{catPct.toFixed(0)}% used</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
