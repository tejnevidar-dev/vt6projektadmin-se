import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/notifications-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const [list, count] = await Promise.all([listNotifications(), countUnreadNotifications()]);
    setItems(list);
    setUnread(count);
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh().catch((err) => console.error("Failed to load notifications:", err));

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          refresh().catch((err) => console.error("Failed to refresh notifications:", err));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const handleOpenItem = async (item: AppNotification) => {
    if (!item.read_at) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
      markNotificationRead(item.id).catch((err) => console.error("Failed to mark notification read:", err));
    }
    if (item.link) navigate({ to: item.link });
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    markAllNotificationsRead().catch((err) => console.error("Failed to mark all notifications read:", err));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-lg border border-border bg-card/80 p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          title="Notiser"
        >
          <Bell className="h-3.5 w-3.5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notiser</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] font-normal text-muted-foreground hover:text-foreground"
            >
              Markera alla lästa
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-4 text-center text-[12.5px] text-muted-foreground">Inga notiser ännu.</div>
        ) : (
          <div className="max-h-96 overflow-auto">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => handleOpenItem(item)}
                className="flex flex-col items-start gap-0.5 whitespace-normal py-2"
              >
                <div className="flex w-full items-center gap-2">
                  {!item.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className={item.read_at ? "font-normal" : "font-semibold"}>{item.title}</span>
                </div>
                {item.body && <span className="text-[12px] text-muted-foreground">{item.body}</span>}
                <span className="text-[11px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: sv })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
