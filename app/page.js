"use client";

import { useState, useEffect } from "react";
import {
  ACCOUNTS, CARTONS_PER_PALLET,
  subscribeToConfig, updateConfig,
  subscribeToSales, addSale, editSale, requestDeleteSale, approveDeleteSale, denyDeleteSale,
  subscribeToActiveLogs, addActiveLog, completeActiveLog, editActiveLog, requestDeleteActiveLog, approveDeleteActiveLog, denyDeleteActiveLog,
  subscribeToDebts, addDebt, settleDebt as settleDebtFn,
  subscribeToStockHistory, addStockHistory, deleteStockHistory, editStockHistory,
  adminDeleteSale, adminDeleteActiveLog, adminDeleteDebt,
  getCurrentPallet, fmt,
} from "@/lib/store";

function Modal({ onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: "var(--overlay)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="slide-up w-full max-w-[440px] rounded-t-3xl px-6 pt-7 pb-9" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--text-faint)" }} />
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", mono = false }) {
  return (
    <div className="mb-3.5">
      <div className="text-[11px] uppercase tracking-[1.5px] mb-2" style={{ color: "var(--text-sub)" }}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3.5 rounded-xl outline-none"
        style={{ border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text)", fontSize: mono ? 16 : 14, fontFamily: mono ? "'Space Mono', monospace" : "'DM Sans', sans-serif" }} />
    </div>
  );
}

function PayToggle({ value, onChange }) {
  return (
    <div className="mb-6">
      <div className="text-[11px] uppercase tracking-[1.5px] mb-2.5" style={{ color: "var(--text-sub)" }}>Payment Type</div>
      <div className="flex gap-2.5">
        {[{ key: "paid", label: "Paid", sub: "Cash collected", col: "#4ECDC4" }, { key: "consignment", label: "Consignment", sub: "Goes to debt list", col: "#FF9F43" }].map((o) => (
          <button key={o.key} onClick={() => onChange(o.key)} className="flex-1 py-4 px-3 rounded-[14px] flex flex-col items-center gap-1.5"
            style={{ border: value === o.key ? `2px solid ${o.col}` : "1px solid var(--input-border)", background: value === o.key ? `${o.col}15` : "transparent" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `2px solid ${value === o.key ? o.col : "var(--text-faint)"}` }}>
              {value === o.key && <div className="w-3 h-3 rounded-full" style={{ background: o.col }} />}
            </div>
            <div className="text-sm font-semibold" style={{ color: value === o.key ? o.col : "var(--text-muted)" }}>{o.label}</div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{o.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className="flex-1 rounded-2xl p-4 relative overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-60" style={{ background: accent }} />
      <div className="text-[10px] uppercase tracking-[1.5px] mb-1.5" style={{ color: "var(--text-sub)" }}>{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const h = (e) => setTheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", h); return () => mq.removeEventListener("change", h);
  }, []);

  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expanded, setExpanded] = useState(null);
  const toggle = (id) => setExpanded(expanded === id ? null : id);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { if (typeof window !== "undefined") { const s = localStorage.getItem("stocksync_user"); if (s && ACCOUNTS[s]) setCurrentUser(s); } }, []);
  const handleLogin = () => { const uid = loginInput.trim().toLowerCase(); if (ACCOUNTS[uid]) { setCurrentUser(uid); localStorage.setItem("stocksync_user", uid); setActiveTab(ACCOUNTS[uid].role === "pro" ? "dashboard" : "deliver"); setLoginError(""); setLoginInput(""); } else setLoginError("Invalid username"); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem("stocksync_user"); };

  const [config, setConfig] = useState({ totalStock: 0, stockDate: "", cartonsPerPallet: 84 });
  const [sales, setSales] = useState([]);
  const [activeLogs, setActiveLogs] = useState([]);
  const [debts, setDebts] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = [subscribeToConfig(setConfig), subscribeToSales(setSales), subscribeToActiveLogs(setActiveLogs), subscribeToStockHistory(setStockHistory), subscribeToDebts((d) => { setDebts(d); setLoading(false); })];
    return () => u.forEach((fn) => fn());
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(null);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showEditLog, setShowEditLog] = useState(null);
  const [showEditHistory, setShowEditHistory] = useState(null);
  const [formCustomer, setFormCustomer] = useState(""); const [formCartons, setFormCartons] = useState(""); const [formPrice, setFormPrice] = useState(""); const [formPayType, setFormPayType] = useState("paid");
  const [completeCustomer, setCompleteCustomer] = useState(""); const [completePrice, setCompletePrice] = useState(""); const [completePayType, setCompletePayType] = useState("paid");
  const [debtName, setDebtName] = useState(""); const [debtAmount, setDebtAmount] = useState(""); const [debtNote, setDebtNote] = useState("");
  const [deliveryQty, setDeliveryQty] = useState("");
  const [editStock, setEditStock] = useState(""); const [editDate, setEditDate] = useState(""); const [editCPN, setEditCPN] = useState(""); const [settingsSaved, setSettingsSaved] = useState(false);
  const [editLogCartons, setEditLogCartons] = useState(""); const [editLogCustomer, setEditLogCustomer] = useState(""); const [editLogPrice, setEditLogPrice] = useState("");
  const [editHistoryStock, setEditHistoryStock] = useState(""); const [editHistoryDate, setEditHistoryDate] = useState(""); const [editHistoryCPN, setEditHistoryCPN] = useState("");

  useEffect(() => { setEditStock(String(config.totalStock || "")); setEditDate(config.stockDate || ""); setEditCPN(String(config.cartonsPerPallet || "")); }, [config]);

  const TS = config.totalStock || 0, SD = config.stockDate || "Not set", CPN = config.cartonsPerPallet || 84;
  const TP = TS > 0 ? Math.ceil(TS / CPN) : 0;
  const liveSales = sales.filter((s) => !s.deleteRequested);
  const totalSold = liveSales.reduce((s, l) => s + (l.cartons || 0), 0);
  const stockLeft = TS - totalSold;
  const paidRevenue = liveSales.filter((l) => l.payType === "paid").reduce((s, l) => s + (l.price || 0), 0);
  const totalDebtOwed = debts.filter((d) => !d.settled).reduce((s, d) => s + (d.amount || 0), 0);
  const totalDebtSettled = debts.filter((d) => d.settled).reduce((s, d) => s + (d.amount || 0), 0);
  const unsettledDebts = debts.filter((d) => !d.settled);
  const settledDebtsArr = debts.filter((d) => d.settled);
  const pendingActive = activeLogs.filter((l) => l.status === "pending" && !l.deleteRequested);
  const deleteRequests = [...activeLogs.filter((l) => l.deleteRequested), ...sales.filter((s) => s.deleteRequested)];
  const fpSold = Math.floor(totalSold / CPN), cIC = totalSold % CPN, cPN = fpSold + 1, cPL = CPN - cIC, cPP = ((cIC / CPN) * 100).toFixed(0), pLeft = TP - fpSold;
  const pallets = []; for (let i = 1; i <= TP; i++) { pallets.push({ num: i, status: i < cPN ? "sold" : i === cPN ? "active" : "pending" }); }
  const palletHasDebt = (n) => unsettledDebts.some((d) => d.pallet === n);
  const isPro = currentUser && ACCOUNTS[currentUser]?.role === "pro";
  const isAdmin = currentUser === "pro123";
  const nowStr = () => { const n = new Date(); return { date: n.toISOString().split("T")[0], time: n.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }; };
  const canEdit = (u) => isAdmin || u === currentUser;
  const askDelete = (label, action) => setConfirmDelete({ label, action });
  const doDelete = async () => { if (confirmDelete?.action) await confirmDelete.action(); setConfirmDelete(null); setExpanded(null); };

  const handleAddSale = async () => {
    if (!formCustomer || !formCartons || !formPrice) return;
    const { date, time } = nowStr(); const pallet = getCurrentPallet(totalSold);
    await addSale({ customer: formCustomer, cartons: parseInt(formCartons), price: parseFloat(formPrice), payType: formPayType, user: currentUser, date, time, pallet });
    if (formPayType === "consignment") await addDebt({ customer: formCustomer, cartons: parseInt(formCartons), amount: parseFloat(formPrice), pallet, loggedBy: ACCOUNTS[currentUser].name, date, time, settled: false, settledDate: null });
    setFormCustomer(""); setFormCartons(""); setFormPrice(""); setFormPayType("paid"); setShowForm(false);
  };
  const handleCompleteLog = async () => {
    if (!completePrice || !completeCustomer) return;
    const log = activeLogs.find((l) => l.id === showCompleteForm); if (!log) return;
    const { date, time } = nowStr(); const pallet = getCurrentPallet(totalSold);
    await addSale({ customer: completeCustomer, cartons: log.cartons, price: parseFloat(completePrice), payType: completePayType, user: currentUser, activeUser: log.user, date, time, pallet });
    await completeActiveLog(log.id);
    if (completePayType === "consignment") await addDebt({ customer: completeCustomer, cartons: log.cartons, amount: parseFloat(completePrice), pallet, loggedBy: ACCOUNTS[currentUser].name, date, time, settled: false, settledDate: null });
    setCompleteCustomer(""); setCompletePrice(""); setCompletePayType("paid"); setShowCompleteForm(null);
  };
  const handleAddManualDebt = async () => { if (!debtName || !debtAmount) return; const { date, time } = nowStr(); await addDebt({ customer: debtName, cartons: null, amount: parseFloat(debtAmount), pallet: getCurrentPallet(totalSold), loggedBy: ACCOUNTS[currentUser].name, date, time, note: debtNote, settled: false, settledDate: null }); setDebtName(""); setDebtAmount(""); setDebtNote(""); setShowDebtForm(false); };
  const handleAddDelivery = async () => { if (!deliveryQty) return; const { date, time } = nowStr(); await addActiveLog({ cartons: parseInt(deliveryQty), user: currentUser, date, time, status: "pending" }); setDeliveryQty(""); };
  const handleSaveSettings = async () => { const s = parseInt(editStock), d = editDate, c = parseInt(editCPN); if (!s || !d || !c) return; await updateConfig({ totalStock: s, stockDate: d, cartonsPerPallet: c }); const { date, time } = nowStr(); await addStockHistory({ totalStock: s, stockDate: d, cartonsPerPallet: c, updatedBy: ACCOUNTS[currentUser].name, date, time }); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); };
  const handleEditLog = async () => { if (!showEditLog) return; if (showEditLog.type === "active") await editActiveLog(showEditLog.id, { cartons: parseInt(editLogCartons) }); else { const u = {}; if (editLogCartons) u.cartons = parseInt(editLogCartons); if (editLogCustomer) u.customer = editLogCustomer; if (editLogPrice) u.price = parseFloat(editLogPrice); await editSale(showEditLog.id, u); } setShowEditLog(null); setExpanded(null); };
  const handleEditHistoryEntry = async () => { if (!showEditHistory) return; const isCurrent = showEditHistory.totalStock === config.totalStock && showEditHistory.stockDate === config.stockDate; await editStockHistory(showEditHistory.id, { totalStock: parseInt(editHistoryStock), stockDate: editHistoryDate, cartonsPerPallet: parseInt(editHistoryCPN) }, isCurrent); setShowEditHistory(null); setExpanded(null); };

  const tc = theme === "light" ? "light" : "";

  if (!currentUser) return (
    <div className={`${tc} min-h-screen flex flex-col items-center justify-center px-5`} style={{ background: "var(--bg)" }}>
      <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-5" style={{ background: "linear-gradient(135deg, #4ECDC4, #44B8B0)" }}><span className="text-[28px] font-bold text-black">S</span></div>
      <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>StockSync</h1>
      <p className="text-[13px] mb-9" style={{ color: "var(--text-muted)" }}>Sign in to continue</p>
      <div className="w-full max-w-[320px]">
        <div className="text-[11px] uppercase tracking-[1.5px] mb-2" style={{ color: "var(--text-sub)" }}>Username</div>
        <input type="text" value={loginInput} onChange={(e) => { setLoginInput(e.target.value); setLoginError(""); }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Enter your username"
          className="w-full px-4 py-4 rounded-[14px] text-base outline-none mb-1" style={{ border: `1px solid ${loginError ? "#FF6B6B" : "var(--input-border)"}`, background: "var(--input-bg)", color: "var(--text)" }} />
        {loginError && <p className="text-xs mt-1 mb-2" style={{ color: "#FF6B6B" }}>{loginError}</p>}
        <button onClick={handleLogin} className="w-full py-4 rounded-[14px] text-[15px] font-bold mt-3 active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #4ECDC4, #44B8B0)", color: "#0A0A0B" }}>Sign In →</button>
      </div>
      <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="mt-8 text-xs flex items-center gap-1.5 bg-transparent border-none cursor-pointer" style={{ color: "var(--text-muted)" }}>{theme === "dark" ? "☀️ Light" : "🌙 Dark"}</button>
    </div>
  );

  const user = ACCOUNTS[currentUser];
  if (loading) return <div className={`${tc} min-h-screen flex items-center justify-center`} style={{ background: "var(--bg)" }}><p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p></div>;

  // ACTIVE USER VIEW
  if (!isPro) {
    const myLogs = activeLogs.filter((l) => l.user === currentUser);
    const myTotal = myLogs.filter((l) => !l.deleteRequested).reduce((s, l) => s + (l.cartons || 0), 0);
    return (
      <div className={`${tc} min-h-screen max-w-[440px] mx-auto pb-10`} style={{ background: "var(--bg)", color: "var(--text)" }}>
        <div className="flex justify-between items-center px-5 pt-6 pb-4">
          <div><h1 className="text-[22px] font-bold tracking-tight">StockSync</h1><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Welcome back</p></div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-lg p-1 bg-transparent border-none cursor-pointer">{theme === "dark" ? "☀️" : "🌙"}</button>
            <button onClick={handleLogout} className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-bold border-none cursor-pointer" style={{ background: `${user.color}20`, color: user.color }}>{user.initial}</button>
          </div>
        </div>
        <div className="px-5">
          <div className="flex gap-2.5 mb-5">
            <Stat label="My Logs" value={myTotal} sub="cartons total" accent={user.color} />
            <Stat label="Pending" value={myLogs.filter((l) => l.status === "pending" && !l.deleteRequested).length} sub="awaiting review" accent="#FF9F43" />
          </div>
          <div className="rounded-[20px] p-5 mb-6" style={{ background: `${user.color}0C`, border: `1px solid ${user.color}20` }}>
            <h2 className="text-base font-bold mb-4">Log Cartons</h2>
            <div className="text-[11px] uppercase tracking-[1.5px] mb-2" style={{ color: "var(--text-sub)" }}>Number of Cartons</div>
            <div className="flex gap-2.5">
              <input type="number" value={deliveryQty} onChange={(e) => setDeliveryQty(e.target.value)} placeholder="e.g. 25" className="flex-1 px-4 py-3.5 rounded-xl font-mono text-lg outline-none" style={{ border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text)" }} />
              <button onClick={handleAddDelivery} className="px-6 py-3.5 rounded-xl text-sm font-bold border-none cursor-pointer active:scale-95" style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}CC)`, color: "#0A0A0B" }}>Log ✓</button>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-[1.5px] mb-3" style={{ color: "var(--text-sub)" }}>My Log History</div>
          {myLogs.length === 0 && <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>No logs yet.</div>}
          {myLogs.map((l) => (
            <div key={l.id} className="rounded-[14px] mb-2 overflow-hidden" style={{ background: l.deleteRequested ? "rgba(255,107,107,0.04)" : "var(--card)", border: `1px solid ${l.deleteRequested ? "rgba(255,107,107,0.15)" : expanded === l.id ? `${user.color}40` : "var(--card-border)"}` }}>
              <div className="px-4 py-3.5 flex justify-between items-center cursor-pointer" onClick={() => toggle(l.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base" style={{ background: `${user.color}15` }}>📦</div>
                  <div><div className="text-[15px] font-bold font-mono">{l.cartons} cartons</div><div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{l.date} · {l.time}</div></div>
                </div>
                <div className="text-[10px] px-2.5 py-1 rounded-md uppercase font-semibold" style={{ color: l.deleteRequested ? "#FF6B6B" : l.status === "pending" ? "#FF9F43" : "#4ECDC4", background: l.deleteRequested ? "rgba(255,107,107,0.1)" : l.status === "pending" ? "rgba(255,159,67,0.1)" : "rgba(78,205,196,0.1)" }}>{l.deleteRequested ? "🗑 Pending" : l.status === "pending" ? "⏳ Pending" : "✓ Done"}</div>
              </div>
              {expanded === l.id && !l.deleteRequested && (
                <div className="px-4 pb-3.5 flex gap-2">
                  <button onClick={() => { setShowEditLog({ type: "active", id: l.id, cartons: l.cartons }); setEditLogCartons(String(l.cartons)); }} className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer" style={{ background: "var(--input-bg)", color: "var(--text-sub)" }}>✏️ Edit</button>
                  <button onClick={() => askDelete(`${l.cartons} cartons — ${l.date}`, () => requestDeleteActiveLog(l.id, ACCOUNTS[currentUser].name))} className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>🗑 Delete</button>
                </div>
              )}
              {l.deleteRequested && expanded === l.id && <div className="px-4 pb-3 text-[11px] text-center py-2 rounded-lg mx-4 mb-3" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>Waiting for admin approval</div>}
            </div>
          ))}
          <button onClick={handleLogout} className="w-full mt-6 py-3.5 rounded-xl text-[13px] cursor-pointer" style={{ border: "1px solid var(--input-border)", background: "transparent", color: "var(--text-muted)" }}>Sign Out</button>
        </div>
        {showEditLog && <Modal onClose={() => setShowEditLog(null)}><h2 className="text-lg font-bold mb-5" style={{ color: "var(--text)" }}>Edit Log</h2><Input label="Cartons" value={editLogCartons} onChange={setEditLogCartons} placeholder="e.g. 25" type="number" mono /><button onClick={handleEditLog} className="w-full py-4 rounded-[14px] text-[15px] font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #4ECDC4, #44B8B0)", color: "#0A0A0B" }}>Save →</button></Modal>}
        {confirmDelete && <Modal onClose={() => setConfirmDelete(null)}><div className="text-center mb-5"><div className="text-3xl mb-3">🗑</div><h2 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>Confirm Delete</h2><p className="text-sm" style={{ color: "var(--text-muted)" }}>This cannot be undone.</p><p className="text-sm font-semibold mt-2" style={{ color: "#FF6B6B" }}>{confirmDelete.label}</p></div><div className="flex gap-3"><button onClick={() => setConfirmDelete(null)} className="flex-1 py-3.5 rounded-[14px] text-sm font-bold border-none cursor-pointer" style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--text-sub)" }}>Cancel</button><button onClick={doDelete} className="flex-1 py-3.5 rounded-[14px] text-sm font-bold border-none cursor-pointer" style={{ background: "linear-gradient(135deg, #FF6B6B, #FF4757)", color: "#fff" }}>Delete</button></div></Modal>}
      </div>
    );
  }

  // PRO VIEW
  return (
    <div className={`${tc} min-h-screen max-w-[440px] mx-auto relative pb-[90px]`} style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="flex justify-between items-center px-5 pt-6 pb-4">
        <div><h1 className="text-[22px] font-bold tracking-tight">StockSync</h1><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{activeTab === "dashboard" ? "Dashboard" : activeTab === "debts" ? "Debts" : activeTab === "insights" ? "Insights" : activeTab === "history" ? "History" : activeTab === "approvals" ? "Approvals" : "Settings"}</p></div>
        <div className="flex items-center gap-2.5">
          {isAdmin && deleteRequests.length > 0 && <button onClick={() => setActiveTab("approvals")} className="px-2.5 py-1 rounded-lg text-[10px] font-bold border-none cursor-pointer" style={{ background: "rgba(255,107,107,0.15)", color: "#FF6B6B" }}>🗑 {deleteRequests.length}</button>}
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-lg p-1 bg-transparent border-none cursor-pointer">{theme === "dark" ? "☀️" : "🌙"}</button>
          <button onClick={handleLogout} className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-bold border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}CC)`, color: "#0A0A0B" }}>{user.initial}</button>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div className="px-5">
          {TS === 0 ? (
            <div className="rounded-[20px] p-5 mb-4 text-center" style={{ background: "linear-gradient(145deg, rgba(78,205,196,0.08), rgba(78,205,196,0.02))", border: "1px solid rgba(78,205,196,0.12)" }}>
              <div className="text-2xl mb-2">📦</div><div className="text-base font-bold mb-1">No Stock Set Up Yet</div>
              <div className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>{isAdmin ? "Go to Settings to add stock." : "Waiting for admin."}</div>
              {isAdmin && <button onClick={() => setActiveTab("settings")} className="px-5 py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer" style={{ background: "linear-gradient(135deg, #4ECDC4, #44B8B0)", color: "#0A0A0B" }}>Settings →</button>}
            </div>
          ) : (<>
            <div className="rounded-[14px] px-4 py-3.5 mb-3.5 flex justify-between items-center" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <div><div className="text-[10px] uppercase tracking-[1.5px]" style={{ color: "var(--text-muted)" }}>Stock Received</div><div className="text-[13px] mt-0.5" style={{ color: "var(--text-sub)" }}>{SD} · <span className="font-mono font-bold" style={{ color: "var(--text)" }}>{TS.toLocaleString()}</span> cartons</div></div>
              <div className="text-right"><div className="text-[10px] uppercase tracking-[1.5px]" style={{ color: "var(--text-muted)" }}>{TP} Pallets</div><div className="text-[11px] mt-0.5" style={{ color: "var(--text-sub)" }}>{CPN}/pallet</div></div>
            </div>
            <div className="rounded-[20px] px-5 pt-5 pb-4 mb-3.5" style={{ background: "linear-gradient(145deg, rgba(78,205,196,0.08), rgba(78,205,196,0.02))", border: "1px solid rgba(78,205,196,0.12)" }}>
              <div className="flex justify-between items-start">
                <div><div className="text-[11px] uppercase tracking-[1.5px] mb-1" style={{ color: "#4ECDC4" }}>Current Pallet</div><div className="text-[42px] font-bold font-mono leading-none">#{cPN}</div><div className="text-[13px] mt-1.5" style={{ color: "var(--text-muted)" }}><span className="font-mono font-semibold" style={{ color: "var(--text)" }}>{cPL}</span> of {CPN} left</div></div>
                <div className="text-right"><div className="rounded-[10px] px-3 py-1.5 text-[13px] font-semibold font-mono" style={{ background: "rgba(78,205,196,0.1)", color: "#4ECDC4" }}>{cPP}%</div><div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>{pLeft} left</div></div>
              </div>
              <div className="mt-4 mb-1.5 rounded-[20px] h-2.5 overflow-hidden" style={{ background: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)" }}>
                <div className="h-full rounded-[20px] transition-all duration-700" style={{ width: `${cPP}%`, background: parseInt(cPP) > 80 ? "linear-gradient(90deg, #FF6B6B, #FF4757)" : "linear-gradient(90deg, #4ECDC4, #44B8B0)" }} />
              </div>
            </div>
            <div className="mb-3.5">
              <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: "var(--text-muted)" }}>All Pallets</div>
              <div className="flex flex-wrap gap-1.5">
                {pallets.map((p) => (
                  <div key={p.num} className="relative">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold font-mono" style={{ background: p.status === "sold" ? "rgba(255,107,107,0.15)" : p.status === "active" ? "rgba(78,205,196,0.15)" : "var(--card)", border: `1px solid ${p.status === "sold" ? "rgba(255,107,107,0.2)" : p.status === "active" ? "rgba(78,205,196,0.3)" : "var(--card-border)"}`, color: p.status === "sold" ? "#FF6B6B" : p.status === "active" ? "#4ECDC4" : "var(--text-faint)" }}>{p.num}</div>
                    {palletHasDebt(p.num) && <button onClick={() => setActiveTab("debts")} className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold cursor-pointer p-0" style={{ background: "#FF9F43", border: "2px solid var(--bg)", color: "#0A0A0B" }}>₦</button>}
                    {p.status === "active" && !palletHasDebt(p.num) && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full pulse-dot" style={{ background: "#4ECDC4" }} />}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2.5 mb-3.5">
              <Stat label="Paid Revenue" value={fmt(paidRevenue)} sub={`${liveSales.filter((l) => l.payType === "paid").length} sales`} accent="#4ECDC4" />
              <Stat label="Debts Owed" value={fmt(totalDebtOwed)} sub={`${unsettledDebts.length} pending`} accent="#FF9F43" />
            </div>
            <div className="rounded-[14px] px-4 py-3.5 mb-5 flex justify-between items-center" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <div><div className="text-[10px] uppercase tracking-[1.5px]" style={{ color: "var(--text-muted)" }}>Stock Left</div><div className="text-[13px] mt-0.5"><span className="font-mono font-bold text-lg">{stockLeft}</span> / {TS}</div></div>
              <div className="font-mono text-[13px]" style={{ color: "var(--text-sub)" }}>{totalSold} sold</div>
            </div>
          </>)}
          {pendingActive.length > 0 && (<>
            <div className="text-[11px] uppercase tracking-[1.5px] mb-2.5" style={{ color: "#FF9F43" }}>Pending ({pendingActive.length})</div>
            {pendingActive.map((l) => { const au = ACCOUNTS[l.user] || { name: "?", color: "#888", initial: "?" }; return (
              <div key={l.id} className="rounded-[14px] mb-2 overflow-hidden" style={{ background: "rgba(255,159,67,0.04)", border: `1px solid ${expanded === `p-${l.id}` ? "rgba(255,159,67,0.3)" : "rgba(255,159,67,0.12)"}` }}>
                <div className="px-3.5 py-3 flex justify-between items-center cursor-pointer" onClick={() => toggle(`p-${l.id}`)}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${au.color}18`, color: au.color }}>{au.initial}</div>
                    <div><div className="text-[13px] font-semibold">{au.name} — {l.cartons} ctns</div><div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{l.date} · {l.time}</div></div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setShowCompleteForm(l.id); setCompleteCustomer(""); setCompletePrice(""); setCompletePayType("paid"); }} className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer active:scale-95" style={{ background: "linear-gradient(135deg, #FF9F43, #FF8C1A)", color: "#0A0A0B" }}>Complete</button>
                </div>
                {expanded === `p-${l.id}` && isAdmin && <div className="px-3.5 pb-3"><button onClick={() => askDelete(`${au.name} — ${l.cartons} cartons`, () => adminDeleteActiveLog(l.id))} className="w-full py-2 rounded-lg text-[10px] font-semibold border-none cursor-pointer" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>🗑 Delete Log</button></div>}
              </div>
            ); })}
          </>)}
          <div className="text-[11px] uppercase tracking-[1.5px] mb-2.5 mt-5" style={{ color: "var(--text-sub)" }}>Recent Sales</div>
          {liveSales.length === 0 && <div className="text-center py-6 text-sm" style={{ color: "var(--text-muted)" }}>No sales yet.</div>}
          {liveSales.slice(0, 8).map((log) => { const lu = ACCOUNTS[log.user] || { name: "?", color: "#888", initial: "?" }; const ok = canEdit(log.user); return (
            <div key={log.id} className="rounded-[14px] mb-2 overflow-hidden" style={{ background: log.deleteRequested ? "rgba(255,107,107,0.04)" : "var(--card)", border: `1px solid ${log.deleteRequested ? "rgba(255,107,107,0.15)" : expanded === `s-${log.id}` ? `${user.color}30` : "var(--card-border)"}` }}>
              <div className="px-3.5 py-3 flex justify-between items-center cursor-pointer" onClick={() => ok && toggle(`s-${log.id}`)}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${lu.color}18`, color: lu.color }}>{lu.initial}</div>
                  <div><div className="text-[13px] font-semibold">{log.customer} — {log.cartons} ctns</div><div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{lu.name} · P{log.pallet} · {log.date}</div></div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono" style={{ color: log.payType === "paid" ? "#4ECDC4" : "#FF9F43" }}>{fmt(log.price)}</div>
                  <div className="text-[9px] uppercase font-semibold mt-0.5 inline-block px-1.5 py-0.5 rounded" style={{ color: log.payType === "paid" ? "#4ECDC4" : "#FF9F43", background: log.payType === "paid" ? "rgba(78,205,196,0.1)" : "rgba(255,159,67,0.1)" }}>{log.payType === "paid" ? "✓ PAID" : "⏳ CONSIGN"}</div>
                </div>
              </div>
              {expanded === `s-${log.id}` && !log.deleteRequested && ok && (
                <div className="px-3.5 pb-3 flex gap-2">
                  <button onClick={() => { setShowEditLog({ type: "sale", id: log.id }); setEditLogCartons(String(log.cartons)); setEditLogCustomer(log.customer); setEditLogPrice(String(log.price)); }} className="flex-1 py-2 rounded-lg text-[10px] font-semibold border-none cursor-pointer" style={{ background: "var(--input-bg)", color: "var(--text-sub)" }}>✏️ Edit</button>
                  <button onClick={() => askDelete(`${log.customer} — ${fmt(log.price)}`, isAdmin ? () => adminDeleteSale(log.id) : () => requestDeleteSale(log.id, ACCOUNTS[currentUser].name))} className="flex-1 py-2 rounded-lg text-[10px] font-semibold border-none cursor-pointer" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>🗑 Delete</button>
                </div>
              )}
              {log.deleteRequested && <div className="px-3.5 pb-3 text-[10px] text-center py-1.5 rounded-lg mx-3 mb-2" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>🗑 Pending admin approval</div>}
            </div>
          ); })}
        </div>
      )}

      {activeTab === "debts" && (
        <div className="px-5">
          <div className="rounded-[20px] px-5 py-6 mb-4" style={{ background: "linear-gradient(145deg, rgba(255,159,67,0.08), rgba(255,159,67,0.02))", border: "1px solid rgba(255,159,67,0.12)" }}>
            <div className="text-[11px] uppercase tracking-[1.5px] mb-1.5" style={{ color: "#FF9F43" }}>Total Outstanding</div>
            <div className="text-[40px] font-bold font-mono">{fmt(totalDebtOwed)}</div>
            <div className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{unsettledDebts.length} unpaid · {settledDebtsArr.length} settled</div>
          </div>
          <button onClick={() => setShowDebtForm(true)} className="w-full py-3.5 rounded-[14px] text-sm font-semibold cursor-pointer mb-5" style={{ border: "1px dashed rgba(255,159,67,0.3)", background: "rgba(255,159,67,0.04)", color: "#FF9F43" }}>+ Add Manual Debt</button>
          {unsettledDebts.map((d) => (
            <div key={d.id} className="rounded-2xl mb-2.5 overflow-hidden" style={{ background: "rgba(255,159,67,0.03)", border: `1px solid ${expanded === `d-${d.id}` ? "rgba(255,159,67,0.25)" : "rgba(255,159,67,0.1)"}` }}>
              <div className="p-4 cursor-pointer" onClick={() => toggle(`d-${d.id}`)}>
                <div className="flex justify-between items-start mb-3">
                  <div><div className="text-base font-bold">{d.customer}</div><div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{d.cartons ? `${d.cartons} ctns` : ""}{d.note ? ` · ${d.note}` : ""} · by {d.loggedBy}</div><div className="flex gap-2 mt-1.5"><span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ color: "#A78BFA", background: "rgba(167,139,250,0.1)" }}>P#{d.pallet}</span><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{d.date}</span></div></div>
                  <div className="text-[22px] font-bold font-mono" style={{ color: "#FF9F43" }}>{fmt(d.amount)}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); settleDebtFn(d.id, d.settled); }} className="w-full py-3 rounded-[10px] text-[13px] font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #4ECDC4, #44B8B0)", color: "#0A0A0B" }}>✓ Mark as Paid</button>
              </div>
              {expanded === `d-${d.id}` && isAdmin && <div className="px-4 pb-3"><button onClick={() => askDelete(`${d.customer} — ${fmt(d.amount)}`, () => adminDeleteDebt(d.id))} className="w-full py-2.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>🗑 Delete Debt</button></div>}
            </div>
          ))}
          {settledDebtsArr.length > 0 && (<>
            <div className="text-[11px] uppercase tracking-[1.5px] mb-2.5 mt-6" style={{ color: "#4ECDC4" }}>Settled ({settledDebtsArr.length})</div>
            {settledDebtsArr.map((d) => (
              <div key={d.id} className="rounded-2xl mb-2 overflow-hidden opacity-60" style={{ background: "rgba(78,205,196,0.03)", border: `1px solid ${expanded === `sd-${d.id}` ? "rgba(78,205,196,0.2)" : "rgba(78,205,196,0.08)"}` }}>
                <div className="px-4 py-3.5 flex justify-between items-center cursor-pointer" onClick={() => isAdmin && toggle(`sd-${d.id}`)}>
                  <div><div className="text-sm font-semibold line-through" style={{ color: "var(--text-sub)" }}>{d.customer}</div><div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>P#{d.pallet} · Paid {d.settledDate}</div></div>
                  <div className="flex items-center gap-2"><span className="font-mono font-bold line-through" style={{ color: "#4ECDC4" }}>{fmt(d.amount)}</span><button onClick={(e) => { e.stopPropagation(); settleDebtFn(d.id, d.settled); }} className="px-2 py-1 rounded text-[10px] cursor-pointer border-none" style={{ background: "var(--card)", color: "var(--text-sub)" }}>Undo</button></div>
                </div>
                {expanded === `sd-${d.id}` && isAdmin && <div className="px-4 pb-3"><button onClick={() => askDelete(`${d.customer} — ${fmt(d.amount)}`, () => adminDeleteDebt(d.id))} className="w-full py-2 rounded-lg text-[10px] font-semibold border-none cursor-pointer" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>🗑 Delete</button></div>}
              </div>
            ))}
          </>)}
        </div>
      )}

      {activeTab === "approvals" && isAdmin && (
        <div className="px-5">
          <div className="rounded-[20px] px-5 py-6 mb-4" style={{ background: "linear-gradient(145deg, rgba(255,107,107,0.08), rgba(255,107,107,0.02))", border: "1px solid rgba(255,107,107,0.12)" }}>
            <div className="text-[11px] uppercase tracking-[1.5px] mb-1.5" style={{ color: "#FF6B6B" }}>Delete Requests</div>
            <div className="text-[36px] font-bold font-mono">{deleteRequests.length}</div>
          </div>
          {deleteRequests.length === 0 && <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>No pending requests.</div>}
          {deleteRequests.map((r) => { const isAL = !r.customer; return (
            <div key={r.id} className="rounded-[16px] p-4 mb-3" style={{ background: "rgba(255,107,107,0.03)", border: "1px solid rgba(255,107,107,0.12)" }}>
              <div className="text-[13px] font-semibold mb-1">{r.deleteRequestedBy} wants to delete</div>
              <div className="text-sm font-mono font-bold">{r.cartons} cartons {r.customer && `· ${r.customer} · ${fmt(r.price)}`}</div>
              <div className="text-[10px] mt-1 mb-3" style={{ color: "var(--text-muted)" }}>{r.date} · {r.time}</div>
              <div className="flex gap-2">
                <button onClick={() => askDelete(`${r.cartons} cartons${r.customer ? ` — ${r.customer}` : ""}`, isAL ? () => approveDeleteActiveLog(r.id) : () => approveDeleteSale(r.id))} className="flex-1 py-3 rounded-xl text-[13px] font-bold border-none cursor-pointer" style={{ background: "linear-gradient(135deg, #FF6B6B, #FF4757)", color: "#fff" }}>Approve</button>
                <button onClick={() => isAL ? denyDeleteActiveLog(r.id) : denyDeleteSale(r.id)} className="flex-1 py-3 rounded-xl text-[13px] font-bold border-none cursor-pointer" style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--text-sub)" }}>Deny</button>
              </div>
            </div>
          ); })}
          <button onClick={() => setActiveTab("dashboard")} className="w-full mt-4 py-3 rounded-xl text-[13px] cursor-pointer" style={{ border: "1px solid var(--input-border)", background: "transparent", color: "var(--text-muted)" }}>← Back</button>
        </div>
      )}

      {activeTab === "insights" && (() => {
        const now = new Date(), today = now.toISOString().split("T")[0], weekAgo = new Date(now - 7 * 86400000).toISOString().split("T")[0], monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0], yearStart = `${now.getFullYear()}-01-01`;
        const c = (a) => ({ cartons: a.reduce((s, l) => s + (l.cartons||0), 0), revenue: a.filter(l => l.payType==="paid").reduce((s,l) => s+(l.price||0),0), consignment: a.filter(l => l.payType==="consignment").reduce((s,l) => s+(l.price||0),0), sales: a.length, paid: a.filter(l => l.payType==="paid").length, con: a.filter(l => l.payType==="consignment").length });
        const t=c(liveSales.filter(s=>s.date===today)), w=c(liveSales.filter(s=>s.date>=weekAgo)), m=c(liveSales.filter(s=>s.date>=monthStart)), y=c(liveSales.filter(s=>s.date>=yearStart)), all=c(liveSales);
        const days=[...new Set(liveSales.map(s=>s.date))].length||1, avgC=Math.round(all.cartons/days), avgR=Math.round(all.revenue/days), cRate=all.sales>0?Math.round((all.con/all.sales)*100):0, proj=avgC>0?Math.round(stockLeft/avgC):0;
        const ins=[];
        if(w.cartons>avgC*7*1.2)ins.push({e:"🔥",t:`This week: ${w.cartons} cartons — 20%+ above average!`}); else if(w.cartons<avgC*7*0.7&&w.cartons>0)ins.push({e:"📉",t:`Slow week: ${w.cartons} cartons vs ~${avgC*7} avg.`}); else if(w.cartons>0)ins.push({e:"📊",t:`Steady week — ${w.cartons} cartons.`});
        if(w.revenue>avgR*7*1.2)ins.push({e:"💰",t:`Strong cash: ${fmt(w.revenue)} this week vs ${fmt(avgR*7)} avg.`}); else if(w.revenue>0)ins.push({e:"💵",t:`${fmt(w.revenue)} cash this week. Avg: ${fmt(avgR*7)}/wk.`});
        if(m.revenue>0)ins.push({e:"📅",t:`This month: ${fmt(m.revenue)} cash + ${fmt(m.consignment)} consignment from ${m.sales} sales.`});
        if(cRate>40)ins.push({e:"⚠️",t:`${cRate}% consignment. Push for cash sales.`}); else if(cRate<15&&all.sales>3)ins.push({e:"✅",t:`Only ${cRate}% consignment. Great!`});
        if(totalDebtOwed>paidRevenue*0.3&&totalDebtOwed>0)ins.push({e:"🔔",t:`Debts (${fmt(totalDebtOwed)}) = ${Math.round((totalDebtOwed/(paidRevenue||1))*100)}% of revenue.`});
        if(totalDebtSettled>0)ins.push({e:"🎉",t:`${fmt(totalDebtSettled)} debts settled!`});
        if(proj>0&&proj<14)ins.push({e:"📦",t:`Stock runs out in ~${proj} days. Reorder!`}); else if(proj>=14)ins.push({e:"📦",t:`~${proj} days of stock left.`});
        if(t.cartons===0&&now.getHours()>12)ins.push({e:"⏰",t:"No sales today yet!"}); else if(t.cartons>avgC*1.5)ins.push({e:"🎯",t:`${t.cartons} cartons today + ${fmt(t.revenue)} cash!`});
        if(!ins.length)ins.push({e:"👋",t:"Log sales to get insights."});
        return (
          <div className="px-5">
            <div className="rounded-[20px] p-5 mb-4" style={{ background: "linear-gradient(145deg, rgba(167,139,250,0.08), rgba(167,139,250,0.02))", border: "1px solid rgba(167,139,250,0.12)" }}>
              <div className="flex items-center gap-2 mb-3"><span className="text-lg">🧠</span><div className="text-[11px] uppercase tracking-[1.5px] font-semibold" style={{ color: "#A78BFA" }}>AI Insights</div></div>
              {ins.map((i,x)=>(<div key={x} className="flex gap-3 mb-3 last:mb-0"><span className="text-base mt-0.5">{i.e}</span><p className="text-[13px] leading-relaxed">{i.t}</p></div>))}
            </div>
            {[{l:"Today",d:t,a:"#4ECDC4"},{l:"This Week",d:w,a:"#A78BFA"},{l:"This Month",d:m,a:"#FF9F43"},{l:"This Year",d:y,a:"#FF6B6B"}].map(p=>(
              <div key={p.l} className="rounded-[16px] p-4 mb-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                <div className="text-[11px] uppercase tracking-[1.5px] mb-3 font-semibold" style={{ color: p.a }}>{p.l}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Cartons</div><div className="text-lg font-bold font-mono mt-0.5">{p.d.cartons}</div></div>
                  <div><div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Cash In</div><div className="text-lg font-bold font-mono mt-0.5" style={{ color: "#4ECDC4" }}>{fmt(p.d.revenue)}</div></div>
                  <div><div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Consignment</div><div className="text-lg font-bold font-mono mt-0.5" style={{ color: "#FF9F43" }}>{fmt(p.d.consignment)}</div></div>
                  <div><div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Sales</div><div className="text-lg font-bold font-mono mt-0.5">{p.d.paid}p · {p.d.con}c</div></div>
                </div>
              </div>
            ))}
            <div className="rounded-[16px] p-4 mb-3" style={{ background: "linear-gradient(145deg, rgba(78,205,196,0.06), rgba(78,205,196,0.02))", border: "1px solid rgba(78,205,196,0.1)" }}>
              <div className="text-[11px] uppercase tracking-[1.5px] mb-3 font-semibold" style={{ color: "#4ECDC4" }}>Daily Averages</div>
              <div className="grid grid-cols-3 gap-3">
                <div><div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Cartons</div><div className="text-xl font-bold font-mono mt-0.5">{avgC}</div></div>
                <div><div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Revenue</div><div className="text-xl font-bold font-mono mt-0.5" style={{ color: "#4ECDC4" }}>{fmt(avgR)}</div></div>
                <div><div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Cash %</div><div className="text-xl font-bold font-mono mt-0.5">{100-cRate}%</div></div>
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === "history" && (
        <div className="px-5">
          <div className="rounded-[20px] px-5 py-6 mb-4" style={{ background: "linear-gradient(145deg, rgba(78,205,196,0.08), rgba(78,205,196,0.02))", border: "1px solid rgba(78,205,196,0.12)" }}>
            <div className="text-[11px] uppercase tracking-[1.5px] mb-1.5" style={{ color: "#4ECDC4" }}>Current Stock</div>
            <div className="text-[36px] font-bold font-mono">{TS > 0 ? TS.toLocaleString() : "—"}</div>
            <div className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{TS > 0 ? `${SD} · ${CPN}/pallet · ${TP} pallets` : "Not configured yet"}</div>
          </div>
          <div className="text-[11px] uppercase tracking-[1.5px] mb-3" style={{ color: "var(--text-sub)" }}>Receive History</div>
          {stockHistory.length === 0 && <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>No history yet.</div>}
          {stockHistory.map((h, i) => {
            const isCurrent = h.totalStock === config.totalStock && h.stockDate === config.stockDate && config.totalStock > 0;
            return (
            <div key={h.id} className="rounded-[14px] mb-2 overflow-hidden" style={{ background: isCurrent ? "rgba(78,205,196,0.04)" : "var(--card)", border: `1px solid ${isCurrent ? "rgba(78,205,196,0.2)" : expanded === `h-${h.id}` ? "rgba(78,205,196,0.3)" : "var(--card-border)"}` }}>
              <div className="px-4 py-4 cursor-pointer" onClick={() => isAdmin && toggle(`h-${h.id}`)}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono" style={{ background: "rgba(78,205,196,0.1)", color: "#4ECDC4" }}>#{i + 1}</div>
                    <div><div className="text-[15px] font-bold"><span className="font-mono">{h.totalStock?.toLocaleString()}</span> cartons</div><div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{h.stockDate}</div><div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{h.cartonsPerPallet}/pallet · by {h.updatedBy}</div></div>
                  </div>
                  <div className="text-right">
                    {isCurrent && <div className="text-[9px] uppercase font-bold px-2 py-0.5 rounded mb-1 inline-block" style={{ background: "rgba(78,205,196,0.15)", color: "#4ECDC4" }}>CURRENT</div>}
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{h.date}<br/>{h.time}</div>
                  </div>
                </div>
              </div>
              {expanded === `h-${h.id}` && isAdmin && (
                <div className="px-4 pb-3 flex gap-2">
                  <button onClick={() => { setShowEditHistory(h); setEditHistoryStock(String(h.totalStock)); setEditHistoryDate(h.stockDate); setEditHistoryCPN(String(h.cartonsPerPallet)); }} className="flex-1 py-2.5 rounded-lg text-[10px] font-semibold border-none cursor-pointer" style={{ background: "var(--input-bg)", color: "var(--text-sub)" }}>✏️ Edit</button>
                  <button onClick={() => { const isCurrent = h.totalStock === config.totalStock && h.stockDate === config.stockDate; askDelete(`${h.totalStock?.toLocaleString()} cartons — ${h.stockDate}${isCurrent ? " (CURRENT — homepage will reset)" : ""}`, () => deleteStockHistory(h.id, isCurrent)); }} className="flex-1 py-2.5 rounded-lg text-[10px] font-semibold border-none cursor-pointer" style={{ background: "rgba(255,107,107,0.06)", color: "#FF6B6B" }}>🗑 Delete</button>
                </div>
              )}
            </div>
          ); })}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="px-5">
          {isAdmin ? (
            <div className="rounded-[20px] p-5 mb-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <div className="text-base font-bold mb-4">Stock Configuration</div>
              <Input label="Total Stock Received" value={editStock} onChange={setEditStock} placeholder="e.g. 1500" type="number" mono />
              <Input label="Date Received" value={editDate} onChange={setEditDate} placeholder="e.g. 23 Jan 2026" />
              <Input label="Cartons Per Pallet" value={editCPN} onChange={setEditCPN} placeholder="e.g. 84" type="number" mono />
              <button onClick={handleSaveSettings} className="w-full py-3.5 rounded-[14px] text-sm font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: settingsSaved ? "linear-gradient(135deg, #44B8B0, #3AA89F)" : "linear-gradient(135deg, #4ECDC4, #44B8B0)", color: "#0A0A0B" }}>{settingsSaved ? "✓ Saved!" : "Save Changes"}</button>
            </div>
          ) : (
            <div className="rounded-[20px] p-6 mb-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><div className="text-2xl mb-3">🔒</div><div className="text-base font-bold mb-2">Admin Only</div><div className="text-sm" style={{ color: "var(--text-muted)" }}>Only admin can edit stock settings.</div></div>
          )}
          <div className="rounded-[14px] px-4 py-4 mb-4 flex justify-between items-center" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="text-sm font-semibold">Dark Mode</div>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="w-12 h-7 rounded-full relative cursor-pointer border-none" style={{ background: theme === "dark" ? "#4ECDC4" : "var(--input-border)" }}><div className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: theme === "dark" ? 22 : 2 }} /></button>
          </div>
          <button onClick={handleLogout} className="w-full py-3.5 rounded-xl text-[13px] cursor-pointer" style={{ border: "1px solid var(--input-border)", background: "transparent", color: "var(--text-muted)" }}>Sign Out</button>
        </div>
      )}

      {showForm && <Modal onClose={() => setShowForm(false)}><h2 className="text-lg font-bold mb-5" style={{ color: "var(--text)" }}>Log a Sale</h2><Input label="Customer Name" value={formCustomer} onChange={setFormCustomer} placeholder="e.g. Amy" /><Input label="Cartons" value={formCartons} onChange={setFormCartons} placeholder="e.g. 25" type="number" mono /><Input label="Price (₦)" value={formPrice} onChange={setFormPrice} placeholder="e.g. 50000" type="number" mono /><PayToggle value={formPayType} onChange={setFormPayType} />{formPayType === "consignment" && <div className="rounded-[10px] px-3.5 py-2.5 text-xs mb-3.5 -mt-2" style={{ background: "rgba(255,159,67,0.06)", border: "1px solid rgba(255,159,67,0.15)", color: "#FF9F43" }}>⚠️ <strong>{formCustomer || "Customer"}</strong> → debt list</div>}<button onClick={handleAddSale} className="w-full py-4 rounded-[14px] text-[15px] font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: formPayType === "paid" ? "linear-gradient(135deg, #4ECDC4, #44B8B0)" : "linear-gradient(135deg, #FF9F43, #FF8C1A)", color: "#0A0A0B" }}>{formPayType === "paid" ? "Log Paid Sale →" : "Log Consignment →"}</button></Modal>}

      {showCompleteForm !== null && (() => { const log = activeLogs.find((l) => l.id === showCompleteForm); if (!log) return null; const au = ACCOUNTS[log.user] || { name: "?", color: "#888" }; return (<Modal onClose={() => setShowCompleteForm(null)}><h2 className="text-lg font-bold mb-1.5" style={{ color: "var(--text)" }}>Complete Sale</h2><p className="text-[13px] mb-5" style={{ color: "var(--text-muted)" }}><span style={{ color: au.color, fontWeight: 600 }}>{au.name}</span> logged <span className="font-mono font-bold" style={{ color: "var(--text)" }}>{log.cartons} cartons</span></p><Input label="Customer" value={completeCustomer} onChange={setCompleteCustomer} placeholder="e.g. Amy" /><Input label="Price (₦)" value={completePrice} onChange={setCompletePrice} placeholder="e.g. 50000" type="number" mono /><PayToggle value={completePayType} onChange={setCompletePayType} /><button onClick={handleCompleteLog} className="w-full py-4 rounded-[14px] text-[15px] font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: completePayType === "paid" ? "linear-gradient(135deg, #4ECDC4, #44B8B0)" : "linear-gradient(135deg, #FF9F43, #FF8C1A)", color: "#0A0A0B" }}>Complete Sale →</button></Modal>); })()}

      {showDebtForm && <Modal onClose={() => setShowDebtForm(false)}><h2 className="text-lg font-bold mb-5" style={{ color: "var(--text)" }}>Add Manual Debt</h2><Input label="Who Owes" value={debtName} onChange={setDebtName} placeholder="Customer name" /><Input label="Amount (₦)" value={debtAmount} onChange={setDebtAmount} placeholder="e.g. 50000" type="number" mono /><Input label="Note" value={debtNote} onChange={setDebtNote} placeholder="e.g. 25 cartons - partial" /><button onClick={handleAddManualDebt} className="w-full py-4 rounded-[14px] text-[15px] font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #FF9F43, #FF8C1A)", color: "#0A0A0B" }}>Add Debt →</button></Modal>}

      {showEditLog && <Modal onClose={() => setShowEditLog(null)}><h2 className="text-lg font-bold mb-5" style={{ color: "var(--text)" }}>Edit {showEditLog.type === "active" ? "Log" : "Sale"}</h2><Input label="Cartons" value={editLogCartons} onChange={setEditLogCartons} placeholder="e.g. 25" type="number" mono />{showEditLog.type === "sale" && (<><Input label="Customer" value={editLogCustomer} onChange={setEditLogCustomer} placeholder="e.g. Amy" /><Input label="Price (₦)" value={editLogPrice} onChange={setEditLogPrice} placeholder="e.g. 50000" type="number" mono /></>)}<button onClick={handleEditLog} className="w-full py-4 rounded-[14px] text-[15px] font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #4ECDC4, #44B8B0)", color: "#0A0A0B" }}>Save →</button></Modal>}

      {showEditHistory && <Modal onClose={() => setShowEditHistory(null)}><h2 className="text-lg font-bold mb-5" style={{ color: "var(--text)" }}>Edit History</h2><Input label="Total Stock" value={editHistoryStock} onChange={setEditHistoryStock} placeholder="e.g. 1500" type="number" mono /><Input label="Date Received" value={editHistoryDate} onChange={setEditHistoryDate} placeholder="e.g. 23 Jan 2026" /><Input label="Cartons Per Pallet" value={editHistoryCPN} onChange={setEditHistoryCPN} placeholder="e.g. 84" type="number" mono /><button onClick={handleEditHistoryEntry} className="w-full py-4 rounded-[14px] text-[15px] font-bold border-none cursor-pointer active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #4ECDC4, #44B8B0)", color: "#0A0A0B" }}>Save →</button></Modal>}

      {confirmDelete && <Modal onClose={() => setConfirmDelete(null)}><div className="text-center mb-5"><div className="text-3xl mb-3">🗑</div><h2 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>Confirm Delete</h2><p className="text-sm" style={{ color: "var(--text-muted)" }}>This cannot be undone.</p><p className="text-sm font-semibold mt-2" style={{ color: "#FF6B6B" }}>{confirmDelete.label}</p></div><div className="flex gap-3"><button onClick={() => setConfirmDelete(null)} className="flex-1 py-3.5 rounded-[14px] text-sm font-bold border-none cursor-pointer" style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--text-sub)" }}>Cancel</button><button onClick={doDelete} className="flex-1 py-3.5 rounded-[14px] text-sm font-bold border-none cursor-pointer" style={{ background: "linear-gradient(135deg, #FF6B6B, #FF4757)", color: "#fff" }}>Delete</button></div></Modal>}

      {activeTab === "dashboard" && <button onClick={() => setShowForm(true)} className="fixed bottom-[100px] right-[calc(50%-200px)] w-14 h-14 rounded-2xl border-none text-[28px] font-light flex items-center justify-center z-50 cursor-pointer active:scale-90" style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}CC)`, color: "#0A0A0B", boxShadow: `0 8px 32px ${user.color}40` }}>+</button>}

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] flex pt-3 pb-5 z-40" style={{ background: "var(--nav-bg)", borderTop: "1px solid var(--nav-border)" }}>
        {[{ id: "dashboard", label: "Home", icon: "◉" },{ id: "debts", label: "Debts", icon: "◎", badge: unsettledDebts.length },{ id: "insights", label: "Insights", icon: "✦" },{ id: "history", label: "History", icon: "↻" },{ id: "settings", label: "Settings", icon: "⚙" }].map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setExpanded(null); }} className="flex-1 flex flex-col items-center gap-1 text-[10px] border-none cursor-pointer bg-transparent relative" style={{ color: activeTab === tab.id ? user.color : "var(--text-faint)" }}>
            <span className="text-[17px] relative">{tab.icon}{tab.badge > 0 && <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: "#FF9F43", color: "#0A0A0B" }}>{tab.badge}</span>}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
