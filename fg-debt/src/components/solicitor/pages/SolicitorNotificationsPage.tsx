import { useNavigate } from "@tanstack/react-router";
import { Bell, Flame, ShieldAlert, Sparkles, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  notificationsMutationErrorMessage,
  useMarkAllSolicitorNotificationsRead,
  useMarkSolicitorNotificationRead,
  useSolicitorNotifications,
  type SolicitorNotification,
} from "@/lib/notifications-api";

export function SolicitorNotificationsPage() {
  const { notifications, isLoading, isError } = useSolicitorNotifications();
  const markRead = useMarkSolicitorNotificationRead();
  const markAllRead = useMarkAllSolicitorNotificationsRead();
  const navigate = useNavigate();

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success("All notifications marked as read."),
      onError: (error) => toast.error(notificationsMutationErrorMessage(error, "Could not mark notifications as read.")),
    });
  };

  const openNotification = (notification: SolicitorNotification) => {
    if (notification.unread) {
      markRead.mutate(notification.id, {
        onError: (error) =>
          toast.error(notificationsMutationErrorMessage(error, "Could not mark notification as read.")),
      });
    }
    navigate({ to: `/solicitor/matters/${notification.matterId}` as any });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Could not load notifications.</p>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            Solicitor Notification Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alerts for statutory demands, risk escalations, AI completions, and client replies.
          </p>
        </div>

        <Button
          onClick={handleMarkAllRead}
          variant="outline"
          size="sm"
          className="text-xs"
          disabled={markAllRead.isPending || notifications.every((notification) => !notification.unread)}
        >
          {markAllRead.isPending ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5 mr-1" />
          )}
          Mark All as Read
        </Button>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="surface-card p-6 text-sm text-muted-foreground">No notifications right now.</Card>
        ) : (
          notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onOpen={() => openNotification(notification)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationCard({
  notification: n,
  onOpen,
}: {
  notification: SolicitorNotification;
  onOpen: () => void;
}) {
  return (
    <Card
      onClick={onOpen}
      className={`surface-card hover-lift cursor-pointer transition-colors p-4 ${
        n.unread ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {n.type === "urgent_risk" && <Flame className="size-5 text-rose-500 animate-pulse" />}
            {n.type === "high_vulnerability" && <ShieldAlert className="size-5 text-amber-500" />}
            {n.type === "ai_completed" && <Sparkles className="size-5 text-emerald-500" />}
            {n.type === "new_matter" && <Bell className="size-5 text-blue-500" />}
            {n.type === "doc_uploaded" && <FileText className="size-5 text-purple-500" />}
            {n.type === "client_submitted" && <Bell className="size-5 text-indigo-500" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">{n.title}</h3>
              {n.unread && <Badge variant="default" className="text-[0.6rem] bg-rose-600">NEW</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
          </div>
        </div>

        <div className="text-right shrink-0 text-xs text-muted-foreground">
          <span className="font-mono text-primary font-semibold block">{n.matterId}</span>
          <span>{n.timestamp}</span>
        </div>
      </div>
    </Card>
  );
}
