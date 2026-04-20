import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type Account, type SubAdminPortal, type AdministrationPlus, type BankingNotification, logAudit, trackLogin } from "@/lib/supabase";
import { formatCurrency, getInitials, formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { Plus, LogOut, Users, Building2, ChevronRight, Eye, EyeOff, X, CheckCircle, Upload, RefreshCw, Bell, ArrowLeft, Reply, Send, Paperclip } from "lucide-react";
import bankLogo from "@/assets/bankunited-logo.jpg";
import { toast } from "sonner";
import { generateAccountNumber } from "@/lib/utils";

const TIER_CONFIG: Record<number, { maxAdmins: number; maxIndividual: number; label: string }> = {
  1: { maxAdmins: 3, maxIndividual: 2, label: "Tier 1" },
  2: { maxAdmins: 3, maxIndividual: 3, label: "Tier 2" },
  3: { maxAdmins: 4, maxIndividual: 4, label: "Tier 3" },
  4: { maxAdmins: 6, maxIndividual: 4, label: "Tier 4" },
};

export default function APDashboard() {
  const navigate = useNavigate();
  const [apSession, setApSession] = useState<AdministrationPlus | null>(null);
  const [subAdmins, setSubAdmins] = useState<SubAdminPortal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notifications, setNotifications] = useState<BankingNotification[]>([]);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "notifications">("home");
  const [selectedNotif, setSelectedNotif] = useState<BankingNotification | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("ghob_ap_session");
    if (!raw) { navigate("/ap/login"); return; }
    setApSession(JSON.parse(raw));
    fetchAll();
  }, [navigate]);

  const fetchAll = async () => {
    const raw = localStorage.getItem("ghob_ap_session");
    if (!raw) return;
    const session = JSON.parse(raw) as AdministrationPlus;
    const { data: admins } = await supabase.from("sub_admin_portals").select("*").eq("created_by_ap", session.id);
    if (admins) setSubAdmins(admins);
    const adminIds = admins?.map(a => a.id) || [];
    if (adminIds.length > 0) {
      const { data: accs } = await supabase.from("banking_accounts").select("*").in("created_by_sub_admin", adminIds);
      if (accs) {
        setAccounts(accs);
        // Fetch notifications from IDA accounts only
        const accIds = accs.map(a => a.id);
        if (accIds.length > 0) {
          const { data: notifs } = await supabase.from("banking_notifications")
            .select("*")
            .in("account_id", accIds)
            .order("created_at", { ascending: false });
          if (notifs) setNotifications(notifs);
        }
      }
    }
  };

  usePolling(fetchAll, 6000, !selectedNotif);

  const tier = apSession?.tier || 1;
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG[1];
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  const handleLogout = () => { localStorage.removeItem("ghob_ap_session"); navigate("/ap/login"); };

  const markNotifRead = async (id: string) => {
    await supabase.from("banking_notifications").update({ is_read: true }).eq("id", id);
    fetchAll();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedNotif) return;
    setSending(true);
    await supabase.from("banking_messages").insert({
      account_id: selectedNotif.account_id,
      sender: "admin",
      message: replyText.trim(),
      message_type: "chat",
      is_read: true,
      is_seen: false,
    });
    await supabase.from("banking_notifications").insert({
      account_id: selectedNotif.account_id,
      target: selectedNotif.account_id,
      title: "Response from Administration",
      body: replyText.trim().slice(0, 150),
      is_read: false,
    });
    setSending(false);
    setReplyText("");
    setSelectedNotif(null);
    toast.success("Reply sent to account.");
    fetchAll();
  };

  if (!apSession) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  // NOTIFICATION DETAIL
  if (selectedNotif) {
    const linkedAccount = accounts.find(a => a.id === selectedNotif.account_id);
    return (
      <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setSelectedNotif(null); setReplyText(""); }} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <Bell size={17} style={{ color: "hsl(43,85%,60%)" }} />
          <div className="text-white font-bold flex-1 truncate">Notification</div>
          {!selectedNotif.is_read && (
            <button onClick={() => { markNotifRead(selectedNotif.id); setSelectedNotif({ ...selectedNotif, is_read: true }); }}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
              Mark Read
            </button>
          )}
        </div>
        <div className="px-4 pt-5 space-y-4 pb-8">
          {linkedAccount && (
            <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "rgba(200,155,50,0.07)", border: "1px solid rgba(200,155,50,0.18)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                {getInitials(linkedAccount.account_name)}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{linkedAccount.account_name}</div>
                <div className="text-white/40 text-xs">{linkedAccount.account_number}</div>
              </div>
            </div>
          )}
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white font-bold">{selectedNotif.title}</div>
            <div className="text-white/30 text-xs">{formatDateTime(selectedNotif.created_at)}</div>
            <div className="h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="text-white/75 text-sm leading-relaxed">{selectedNotif.body}</div>
          </div>
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/50 text-sm font-semibold flex items-center gap-2"><Reply size={14} /> Reply to Account</div>
            <textarea className="dark-input resize-none w-full text-sm" rows={4} placeholder="Type your reply..." value={replyText} onChange={e => setReplyText(e.target.value)} />
            <button onClick={handleReply} disabled={sending || !replyText.trim()} className="gold-btn w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
              {sending ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Send size={13} /> Send Reply</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // NOTIFICATIONS TAB
  if (activeTab === "notifications") {
    return (
      <div className="min-h-screen pb-20" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setActiveTab("home")} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <Bell size={18} style={{ color: "hsl(43,85%,60%)" }} />
          <div className="text-white font-bold flex-1">Notifications from Accounts</div>
          {unreadNotifs > 0 && <span className="bg-yellow-500 text-gray-900 text-xs rounded-full px-2 py-0.5 font-bold">{unreadNotifs}</span>}
        </div>
        <div className="p-4 space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell size={40} className="mx-auto mb-3 text-white/10" />
              <div className="text-white/25 text-sm">No notifications from your accounts yet</div>
            </div>
          ) : (
            notifications.map(n => {
              const linkedAccount = accounts.find(a => a.id === n.account_id);
              return (
                <button key={n.id} onClick={() => { setSelectedNotif(n); if (!n.is_read) markNotifRead(n.id); }}
                  className="w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-colors"
                  style={{ background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(200,155,50,0.05)", border: `1px solid ${n.is_read ? "rgba(255,255,255,0.06)" : "rgba(200,155,50,0.2)"}` }}>
                  <div className="flex items-start gap-3">
                    <Bell size={15} style={{ color: n.is_read ? "rgba(255,255,255,0.35)" : "hsl(43,85%,60%)" }} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-white text-sm font-semibold truncate">{n.title}</span>
                        {!n.is_read && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: "hsl(43,85%,60%)" }} />}
                      </div>
                      <div className="text-white/50 text-xs leading-relaxed line-clamp-2 mt-0.5">{n.body}</div>
                      {linkedAccount && <div className="text-white/30 text-xs mt-1">{linkedAccount.account_name} · {formatDateTime(n.created_at)}</div>}
                    </div>
                    <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // HOME TAB
  return (
    <div className="min-h-screen pb-20" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <img src={bankLogo} alt="BankUnited" className="w-9 h-9 rounded-xl bg-white p-0.5" />
          <div>
            <div className="text-white/50 text-xs">Administration Plus · {cfg.label}</div>
            <div className="text-white font-bold text-sm">{apSession.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab("notifications")} className="relative">
            <Bell size={20} style={{ color: unreadNotifs > 0 ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.4)" }} />
            {unreadNotifs > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold" style={{ fontSize: 9 }}>{unreadNotifs}</span>}
          </button>
          <button onClick={() => navigate("/cas/login")} className="text-white/20 text-xs hover:text-white/40 transition-colors" style={{ fontSize: "10px" }}>CAS</button>
          <button onClick={handleLogout} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs"><LogOut size={14} /></button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        <div className="navy-card p-5">
          <div className="text-white/40 text-xs mb-1">Total Balance Across All Accounts</div>
          <div className="text-white font-bold text-2xl mb-3">{formatCurrency(totalBalance, "USD")}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-yellow-400 font-bold text-lg">{subAdmins.length}/{cfg.maxAdmins}</div>
              <div className="text-white/40 text-xs">Admin Portals</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-green-400 font-bold text-lg">{accounts.length}</div>
              <div className="text-white/40 text-xs">Individual Accounts</div>
            </div>
          </div>
        </div>

        {subAdmins.length < cfg.maxAdmins && (
          <button onClick={() => setShowCreateAdmin(true)} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
            <Plus size={18} /> Create Admin Portal Account
          </button>
        )}

        <div>
          <h3 className="text-white font-bold mb-3">Admin Portals ({subAdmins.length}/{cfg.maxAdmins})</h3>
          {subAdmins.length === 0 ? (
            <div className="text-center py-8 rounded-3xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Building2 size={28} className="mx-auto mb-2 text-white/20" />
              <div className="text-white/30 text-sm">No admin portals created yet</div>
            </div>
          ) : (
            <div className="space-y-3">
              {subAdmins.map((admin) => {
                const adminAccs = accounts.filter(a => a.created_by_sub_admin === admin.id);
                const adminBalance = adminAccs.reduce((s, a) => s + Number(a.balance), 0);
                const isExpanded = expandedAdmin === admin.id;
                return (
                  <div key={admin.id} className="rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <button onClick={() => setExpandedAdmin(isExpanded ? null : admin.id)} className="w-full p-4 flex items-center gap-3 text-left">
                      {admin.profile_picture ? (
                        <img src={admin.profile_picture} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid hsl(43,85%,55%)" }} />
                      ) : (
                        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                          {getInitials(admin.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-sm">{admin.name}</div>
                        <div className="text-white/40 text-xs">{adminAccs.length}/{admin.max_individual} accounts · {formatCurrency(adminBalance, "USD")}</div>
                      </div>
                      <ChevronRight size={16} className="text-white/30" style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "0.2s" }} />
                    </button>
                    {isExpanded && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {adminAccs.length === 0 ? (
                          <div className="p-4 text-center text-white/30 text-xs">No individual accounts created</div>
                        ) : (
                          adminAccs.map(acc => (
                            <div key={acc.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              {acc.profile_picture ? (
                                <img src={acc.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                                  {getInitials(acc.account_name)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-medium">{acc.account_name}</div>
                                <div className="text-white/40 text-xs font-mono">{acc.account_number}</div>
                              </div>
                              <div className="text-green-400 text-xs font-bold">{formatCurrency(acc.balance, acc.currency)}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateAdmin && (
        <CreateSubAdminModal
          apId={apSession.id}
          apName={apSession.name}
          tier={tier}
          maxIndividual={cfg.maxIndividual}
          onClose={() => setShowCreateAdmin(false)}
          onSuccess={fetchAll}
        />
      )}
    </div>
  );
}

function CreateSubAdminModal({ apId, apName, tier, maxIndividual, onClose, onSuccess }: {
  apId: string; apName: string; tier: number; maxIndividual: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [profilePic, setProfilePic] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `ap-admin-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      setProfilePic(url.publicUrl);
    }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !password.trim()) { toast.error("Name and password are required."); return; }
    setLoading(true);
    const { error } = await supabase.from("sub_admin_portals").insert({
      name: name.trim(),
      password: password.trim(),
      profile_picture: profilePic || null,
      created_by_ap: apId,
      max_individual: maxIndividual,
    });
    if (error) { toast.error("Failed to create admin portal."); setLoading(false); return; }
    await logAudit("create_sub_admin", undefined, name.trim(), { tier }, apName, `ap_tier${tier}`);
    setLoading(false);
    setSuccess(true);
    setTimeout(() => { onSuccess(); onClose(); }, 2000);
  };

  if (success) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
          <CheckCircle size={32} color="#22c55e" />
        </div>
        <h3 className="text-white font-bold text-lg">Admin Portal Created!</h3>
        <p className="text-white/60 text-sm mt-2">{name} is ready to use.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-bold">Create Admin Portal</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Portal Name *</label>
            <input className="dark-input" placeholder="Admin portal name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Login Password *</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} className="dark-input pr-10" placeholder="Set login password" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Profile Picture (Optional)</label>
            <label className="flex items-center gap-2 p-3 rounded-2xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Upload size={16} style={{ color: "hsl(43,85%,60%)" }} />
              <span className="text-white/60 text-xs">{uploading ? "Uploading..." : profilePic ? "Picture uploaded ✓" : "Upload picture"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          <div className="text-white/40 text-xs">Max individual accounts: <span className="text-yellow-400 font-semibold">{maxIndividual}</span></div>
          <button onClick={handleCreate} disabled={loading} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Create Admin Portal"}
          </button>
        </div>
      </div>
    </div>
  );
}
