import { useState, useEffect } from "react";
import { ArrowLeft, Target, Plus, Calendar, TrendingUp, X, ChevronRight } from "lucide-react";
import { supabase, type Account, type SavingsGoal, trackFeatureUse, logAudit } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  account: Account;
  onBack: () => void;
}

const CATEGORIES = ["Emergency", "Vacation", "Home", "Car", "Education", "Wedding", "Custom"];

export default function SavingsGoalsPage({ account, onBack }: Props) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [addFundsGoal, setAddFundsGoal] = useState<SavingsGoal | null>(null);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [addingFunds, setAddingFunds] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("Emergency");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "savings_goals");
    fetchGoals();
  }, [account.id]);

  const fetchGoals = async () => {
    const { data } = await supabase.from("savings_goals").select("*").eq("account_id", account.id).order("created_at", { ascending: false });
    if (data) setGoals(data as SavingsGoal[]);
    setLoading(false);
  };

  usePolling(fetchGoals, 8000, !showCreate && !selectedGoal && !addFundsGoal);

  const handleCreate = async () => {
    if (!name.trim() || !targetAmount) { toast.error("Please provide a goal name and target amount."); return; }
    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) { toast.error("Enter a valid target amount."); return; }
    const initial = parseFloat(initialDeposit) || 0;
    if (initial > 0 && initial > account.balance) { toast.error("Initial deposit exceeds your available balance."); return; }
    setSubmitting(true);

    const { data, error } = await supabase.from("savings_goals").insert({
      account_id: account.id,
      name: `${category} — ${name.trim()}`,
      target_amount: target,
      current_amount: initial,
      deadline: deadline || null,
      is_paused: false,
    }).select().single();

    if (error) { toast.error("Could not create savings goal. Please try again."); setSubmitting(false); return; }

    // Deduct initial deposit from balance
    if (initial > 0) {
      await supabase.from("banking_accounts").update({ balance: account.balance - initial, updated_at: new Date().toISOString() }).eq("id", account.id);
      await supabase.from("banking_transactions").insert({
        account_id: account.id,
        type: "debit",
        amount: initial,
        description: `Savings Goal deposit — ${category}: ${name.trim()}`,
        admin_override: false,
        custom_timestamp: new Date().toISOString(),
      });
    }

    await logAudit("savings_goal_created", account.id, account.account_name, { goal_name: name, target, initial }, account.account_name, "individual");
    toast.success("Savings goal created successfully.");
    setShowCreate(false);
    setName(""); setTargetAmount(""); setDeadline(""); setInitialDeposit(""); setCategory("Emergency");
    setSubmitting(false);
    fetchGoals();
  };

  const handleAddFunds = async () => {
    if (!addFundsGoal) return;
    const amt = parseFloat(addFundsAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (amt > account.balance) { toast.error("Insufficient balance."); return; }
    setAddingFunds(true);

    await supabase.from("savings_goals").update({ current_amount: Number(addFundsGoal.current_amount) + amt, updated_at: new Date().toISOString() }).eq("id", addFundsGoal.id);
    await supabase.from("banking_accounts").update({ balance: account.balance - amt, updated_at: new Date().toISOString() }).eq("id", account.id);
    await supabase.from("banking_transactions").insert({
      account_id: account.id,
      type: "debit",
      amount: amt,
      description: `Savings Goal — ${addFundsGoal.name}`,
      admin_override: false,
      custom_timestamp: new Date().toISOString(),
    });

    toast.success(`${formatCurrency(amt, account.currency)} added to goal.`);
    setAddFundsGoal(null);
    setAddFundsAmount("");
    setAddingFunds(false);
    fetchGoals();
  };

  const getDaysRemaining = (deadline?: string) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  const totalSaved = goals.filter(g => !g.is_paused).reduce((s, g) => s + Number(g.current_amount), 0);

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onBack} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <Target size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">Savings Goals</div>
          <div className="text-white/40 text-xs">{goals.length} goal{goals.length !== 1 ? "s" : ""} · {formatCurrency(totalSaved, account.currency)} saved</div>
        </div>
        <button onClick={() => setShowCreate(true)} className="gold-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
          <Plus size={13} /> New Goal
        </button>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3">
        {/* Summary */}
        <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,hsl(220,60%,18%),hsl(220,70%,12%))", border: "1px solid rgba(200,155,50,0.2)" }}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{ background: "hsl(43,85%,60%)", transform: "translate(30%,-30%)" }} />
          <div className="text-white/40 text-xs mb-1">Total Saved Across All Goals</div>
          <div className="text-white font-bold text-3xl">{formatCurrency(totalSaved, account.currency)}</div>
          <div className="text-white/30 text-xs mt-1">{goals.filter(g => !g.is_paused).length} active goals</div>
        </div>

        {goals.length === 0 ? (
          <div className="text-center py-16 rounded-3xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Target size={40} className="mx-auto mb-3 text-white/10" />
            <div className="text-white/30 text-sm">No savings goals yet</div>
            <div className="text-white/20 text-xs mt-1">Create your first goal to start saving</div>
            <button onClick={() => setShowCreate(true)} className="gold-btn px-5 py-2.5 text-sm font-semibold mt-4 flex items-center gap-2 mx-auto">
              <Plus size={14} /> Create First Goal
            </button>
          </div>
        ) : (
          goals.map(goal => {
            const pct = Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100);
            const days = getDaysRemaining(goal.deadline);
            return (
              <button key={goal.id} onClick={() => setSelectedGoal(goal)}
                className="w-full text-left rounded-3xl p-4 space-y-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm">{goal.name}</div>
                    <div className="text-white/40 text-xs mt-0.5">
                      {goal.deadline ? `Target: ${new Date(goal.deadline).toLocaleDateString()}` : "No deadline set"}
                      {days !== null && <span className="ml-2 text-yellow-400/70">{days}d remaining</span>}
                    </div>
                  </div>
                  {goal.is_paused && <span className="text-xs px-2 py-0.5 rounded-full ml-2" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>Paused</span>}
                  <ChevronRight size={14} className="text-white/25 flex-shrink-0 mt-0.5" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/50">{formatCurrency(goal.current_amount, account.currency)}</span>
                    <span style={{ color: "hsl(43,85%,60%)" }}>{pct.toFixed(0)}% of {formatCurrency(goal.target_amount, account.currency)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "linear-gradient(90deg,hsl(43,85%,55%),hsl(38,80%,42%))" }} />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Create Goal Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-sm rounded-t-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-white font-bold">Create Savings Goal</div>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Category</label>
                <select className="dark-input text-sm" value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Goal Name *</label>
                <input className="dark-input" placeholder="e.g. Family Vacation" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Target Amount ({account.currency}) *</label>
                <input type="number" className="dark-input" placeholder="0.00" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Target Date (optional)</label>
                <input type="date" className="dark-input" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Initial Deposit (optional)</label>
                <input type="number" className="dark-input" placeholder="0.00" value={initialDeposit} onChange={e => setInitialDeposit(e.target.value)} />
                <div className="text-white/25 text-xs mt-1">Available: {formatCurrency(account.balance, account.currency)}</div>
              </div>
              <button onClick={handleCreate} disabled={submitting} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
                {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Target size={14} /> Create Goal</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Detail */}
      {selectedGoal && (() => {
        const pct = Math.min(100, (Number(selectedGoal.current_amount) / Number(selectedGoal.target_amount)) * 100);
        const days = getDaysRemaining(selectedGoal.deadline);
        return (
          <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
            <div className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={() => setSelectedGoal(null)} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
              <div className="text-white font-bold flex-1">{selectedGoal.name}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Progress ring */}
              <div className="rounded-3xl p-6 text-center" style={{ background: "linear-gradient(135deg,hsl(220,60%,18%),hsl(220,70%,12%))", border: "1px solid rgba(200,155,50,0.2)" }}>
                <div className="text-5xl font-black mb-1" style={{ color: pct >= 100 ? "#22c55e" : "hsl(43,85%,60%)" }}>{pct.toFixed(0)}%</div>
                <div className="text-white/50 text-sm">Complete</div>
                <div className="w-full h-3 rounded-full my-4 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "linear-gradient(90deg,hsl(43,85%,55%),hsl(38,80%,42%))" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="text-white/40 text-xs">Saved</div>
                    <div className="text-green-400 font-bold">{formatCurrency(selectedGoal.current_amount, account.currency)}</div>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="text-white/40 text-xs">Target</div>
                    <div className="text-white font-bold">{formatCurrency(selectedGoal.target_amount, account.currency)}</div>
                  </div>
                </div>
                {days !== null && (
                  <div className="mt-3 text-white/40 text-xs flex items-center justify-center gap-1">
                    <Calendar size={12} /> {days} days remaining · {selectedGoal.deadline}
                  </div>
                )}
              </div>
              <button onClick={() => { setAddFundsGoal(selectedGoal); setSelectedGoal(null); }} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
                <TrendingUp size={14} /> Add Funds to this Goal
              </button>
              <div className="text-white/30 text-xs text-center">Created {formatDateTime(selectedGoal.created_at)}</div>
            </div>
          </div>
        );
      })()}

      {/* Add Funds Modal */}
      {addFundsGoal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setAddFundsGoal(null); setAddFundsAmount(""); }} />
          <div className="relative w-full max-w-sm rounded-t-3xl p-5 space-y-4" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Add Funds</div>
              <button onClick={() => { setAddFundsGoal(null); setAddFundsAmount(""); }} className="text-white/40"><X size={18} /></button>
            </div>
            <div className="text-white/50 text-sm">{addFundsGoal.name}</div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Amount ({account.currency})</label>
              <input type="number" className="dark-input text-lg font-bold" placeholder="0.00" value={addFundsAmount} onChange={e => setAddFundsAmount(e.target.value)} />
              <div className="text-white/25 text-xs mt-1">Available: {formatCurrency(account.balance, account.currency)}</div>
            </div>
            <button onClick={handleAddFunds} disabled={addingFunds} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
              {addingFunds ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Add Funds"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
