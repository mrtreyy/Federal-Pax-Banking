import { Home, Bell, MessageCircle } from "lucide-react";

interface Props {
  active: "home" | "notifications" | "chat";
  onHome: () => void;
  onNotifications: () => void;
  onChat: () => void;
  notifCount: number;
  chatCount: number;
}

export default function UserBottomNav({ active, onHome, onNotifications, onChat, notifCount, chatCount }: Props) {
  const items = [
    { key: "home", icon: Home, label: "Home", action: onHome, count: 0 },
    { key: "notifications", icon: Bell, label: "Notifications", action: onNotifications, count: notifCount },
    { key: "chat", icon: MessageCircle, label: "Support", action: onChat, count: chatCount },
  ];

  return (
    <div className="bottom-nav fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-3 safe-area-pb">
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={item.action}
            className="flex flex-col items-center gap-1 relative spring-tap flex-1 py-1"
          >
            {item.count > 0 && (
              <span
                className="absolute -top-1 left-1/2 -translate-x-1/2 translate-x-3 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                style={{ width: 18, height: 18, minWidth: 18, fontSize: 10 }}
              >
                {item.count > 9 ? "9+" : item.count}
              </span>
            )}
            <item.icon
              size={22}
              style={{ color: isActive ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.4)" }}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span
              className="text-xs font-medium"
              style={{ color: isActive ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.35)" }}
            >
              {item.label}
            </span>
            {isActive && (
              <div className="absolute -bottom-3 w-1 h-1 rounded-full" style={{ background: "hsl(43,85%,60%)" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
