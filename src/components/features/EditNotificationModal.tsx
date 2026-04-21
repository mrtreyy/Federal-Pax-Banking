import { useState } from "react";
import { X, Save, Bell } from "lucide-react";
import { supabase, type BankingNotification, logAudit } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  notification: BankingNotification;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditNotificationModal({ notification, onClose, onSuccess }: Props) {
  const existing = new Date(notification.created_at);
  const padded = (n: number) => String(n).padStart(2, "0");
  const defaultDT = `${existing.getFullYear()}-${padded(existing.getMonth() + 1)}-${padded(existing.getDate())}T${padded(existing.getHours())}:${padded(existing.getMinutes())}`;

  const [customDate, setCustomDate] = useState(defaultDT);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const newTimestamp = new Date(customDate).toISOString();

    const { error } = await supabase
      .from("banking_notifications")
      .update({ created_at: newTimestamp })
      .eq("id", notification.id);

    if (error) {
      toast.error("Failed to update notification timestamp.");
      setLoading(false);
      return;
    }

    await logAudit(
      "edit_notification_timestamp",
      notification.account_id,
      undefined,
      {
        notification_id: notification.id,
        old_date: notification.created_at,
        new_date: newTimestamp,
      },
      "CEO",
      "cas"
    );

    toast.success("Notification timestamp updated.");
    onSuccess();
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "hsl(220,50%,12%)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="p-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h3 className="text-white font-bold text-lg">Edit Notification</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <Bell size={16} className="text-yellow-400/60" />
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{notification.title}</div>
              <div className="text-white/40 text-xs truncate">{notification.body.slice(0, 50)}...</div>
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Date & Time</label>
            <input
              type="datetime-local"
              className="dark-input"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          </div>

          <div
            className="p-3 rounded-2xl text-xs"
            style={{
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.15)",
            }}
          >
            <div className="text-blue-400/80 font-semibold mb-0.5">Manual Override</div>
            <div className="text-white/40">
              This will change the timestamp displayed to the user for this notification.
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
            ) : (
              <>
                <Save size={16} /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}