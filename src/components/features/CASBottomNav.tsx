import { Home, Users, MessageSquare, Bell } from "lucide-react";

type CASTab = "home" | "accounts" | "chats" | "notifications";

interface Props {
  active: CASTab;
  onHome: () => void;
  onAccounts: () => void;
  onChats: () => void;
  onNotifications: () => void;
  notifCount?: number;
  chatCount?: number;
}

export default function CASBottomNav({ active, onHome, onAccounts, onChats, onNotifications, notifCount = 0, chatCount = 0 }: Props) {
  const items = [
    { key: "home" as CASTab, label: "Home", icon: Home, onClick: onHome, badge: 0 },
    { key: "accounts" as CASTab, label: "Accounts", icon: Users, onClick: onAccounts, badge: 0 },
    { key: "chats" as CASTab, label: "Chats", icon: MessageSquare, onClick: onChats, badge: chatCount },
    { key: "notifications" as CASTab, label: "Notifications", icon: Bell, onClick: onNotifications, badge: notifCount },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center"
      style={{
        background: "hsl(220,55%,12%)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {items.map(({ key, label, icon: Icon, onClick, badge }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={onClick}
            className="flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors relative"
          >
            <div className="relative">
              <Icon
                size={22}
                style={{ color: isActive ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.35)", transition: "color 0.2s" }}
              />
              {badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full flex items-center justify-center font-bold"
                  style={{ fontSize: 8, minWidth: 14, height: 14, padding: "0 3px" }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: isActive ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.3)", transition: "color 0.2s", fontSize: 10 }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
