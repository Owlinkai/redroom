import { trpc } from "@/lib/trpc";
import { X, Bell, AlertTriangle, Info, Zap, TrendingUp, Shield } from "lucide-react";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  severity: string | null;
  region: string | null;
  isRead: boolean | null;
  createdAt: Date;
}

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode; border: string }> = {
  critical: { color: 'text-danger', icon: <AlertTriangle size={12} />, border: 'border-danger/30' },
  warning: { color: 'text-warning', icon: <Zap size={12} />, border: 'border-warning/30' },
  info: { color: 'text-info', icon: <Info size={12} />, border: 'border-info/30' },
};

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  breaking: { icon: <AlertTriangle size={10} />, label: 'BREAKING' },
  facility_attack: { icon: <Shield size={10} />, label: 'FACILITY ALERT' },
  critical_event: { icon: <Zap size={10} />, label: 'CRITICAL EVENT' },
  trending: { icon: <TrendingUp size={10} />, label: 'TRENDING' },
  system: { icon: <Bell size={10} />, label: 'SYSTEM' },
};

export default function NotificationPanel({ notifications, onClose }: NotificationPanelProps) {
  const markRead = trpc.notifications.markRead.useMutation();
  const utils = trpc.useUtils();

  const handleMarkRead = async (id: number) => {
    await markRead.mutateAsync({ id });
    utils.notifications.list.invalidate();
  };

  const unread = notifications.filter(n => !n.isRead);
  const read = notifications.filter(n => n.isRead);

  return (
    <div className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] z-50 flex flex-col border-l border-border bg-card/98 backdrop-blur-sm shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell size={12} className="text-primary" />
          <span className="text-orbitron text-[10px] font-bold text-primary">ALERTS</span>
          {unread.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 bg-destructive text-white rounded-full font-bold">
              {unread.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-primary transition-all">
          <X size={14} />
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-mono text-[10px] text-muted-foreground">
            <Bell size={24} className="mb-2 opacity-30" />
            NO ACTIVE ALERTS
          </div>
        ) : (
          <div>
            {/* Unread */}
            {unread.length > 0 && (
              <div>
                <div className="px-4 py-2 text-mono text-[8px] text-muted-foreground tracking-widest border-b border-border bg-background/30">
                  UNREAD ({unread.length})
                </div>
                {unread.map(notif => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            )}

            {/* Read */}
            {read.length > 0 && (
              <div>
                <div className="px-4 py-2 text-mono text-[8px] text-muted-foreground tracking-widest border-b border-border bg-background/30">
                  READ ({read.length})
                </div>
                {read.map(notif => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-mono text-[9px] text-muted-foreground">
        REAL-TIME INTELLIGENCE ALERTS
      </div>
    </div>
  );
}

function NotificationItem({ notification, onMarkRead }: { notification: Notification; onMarkRead: (id: number) => void }) {
  const severity = notification.severity ?? 'info';
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  const typeConfig = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.system;

  return (
    <div
      className={`px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-primary/5 transition-all ${!notification.isRead ? 'bg-primary/3' : 'opacity-60'}`}
      onClick={() => !notification.isRead && onMarkRead(notification.id)}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 flex-shrink-0 ${config.color}`}>{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-mono text-[8px] ${config.color}`}>{typeConfig.label}</span>
            {notification.region && (
              <span className="text-mono text-[8px] text-muted-foreground">{notification.region}</span>
            )}
            {!notification.isRead && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto flex-shrink-0" />
            )}
          </div>
          <div className="text-xs text-foreground font-medium leading-tight">{notification.title}</div>
          {notification.message && (
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{notification.message}</div>
          )}
          <div className="text-mono text-[8px] text-muted-foreground mt-1">
            {new Date(notification.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
