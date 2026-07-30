"use client";

import React, { useEffect, useState } from 'react';
import { useProduction } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Clock, UserCheck, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

import { triggerNativeDeviceNotification, requestNotificationPermission } from '@/lib/notifications';

interface ClusteredNotification {
  id: string;
  ids: string[];
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: string;
  count: number;
  staffName?: string;
}

function getStaffNameFromNotif(n: { title: string; body: string }): string {
  if (n.body && n.body.includes(':')) {
    const candidate = n.body.split(':')[0].trim();
    if (candidate && candidate.length < 30) return candidate;
  }
  if (n.title.includes('-')) {
    const parts = n.title.split('-');
    return parts[parts.length - 1].trim();
  }
  const match = n.body.match(/^([A-Za-z0-9\s]+?)\s+(updated|submitted|has|added|adjusted)/i);
  if (match) return match[1].trim();
  return '';
}

function clusterNotifications(notifications: ReturnType<typeof useProduction>['userNotifications']): ClusteredNotification[] {
  const result: ClusteredNotification[] = [];

  notifications.forEach((n) => {
    const typeLower = (n.type || '').toLowerCase();
    const titleLower = (n.title || '').toLowerCase();
    const isAvailability = typeLower.includes('availability') || titleLower.includes('availability') || titleLower.includes('hours');
    const staffName = isAvailability ? getStaffNameFromNotif(n) : '';

    // Search for existing cluster for this staff member
    const existingCluster = (isAvailability && staffName)
      ? result.find((c) => (c.type.includes('availability') || c.title.toLowerCase().includes('availability')) && c.staffName && c.staffName.toLowerCase() === staffName.toLowerCase())
      : null;

    if (existingCluster) {
      existingCluster.ids.push(n.id);
      existingCluster.count += 1;
      existingCluster.title = `Availability Updates - ${staffName} (${existingCluster.count} updates)`;
      existingCluster.body = `Latest update: ${n.body}`;
      if (!n.read) {
        existingCluster.read = false;
      }
    } else {
      result.push({
        id: n.id,
        ids: [n.id],
        title: isAvailability && staffName ? `Availability Update - ${staffName}` : n.title,
        body: n.body,
        timestamp: n.timestamp,
        read: n.read,
        type: n.type || 'notification',
        count: 1,
        staffName: staffName || undefined,
      });
    }
  });

  return result;
}

export function NotificationBell() {
  const { userId, userNotifications, markNotificationRead } = useProduction();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const myNotifications = userNotifications
    .filter((n) => !userId || n.targetUserId === userId || n.targetUserId === 'admin')
    .sort((a, b) => b.timestamp - a.timestamp);

  const clusteredList = React.useMemo(() => clusterNotifications(myNotifications), [myNotifications]);

  const unreadCount = myNotifications.filter((n) => !n.read).length;

  // Request browser & device notification permission + register Service Worker
  useEffect(() => {
    requestNotificationPermission().catch(console.error);
  }, []);

  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const initialMountTime = React.useRef(Date.now());

  useEffect(() => {
    const newUnreadNotifications = myNotifications.filter(n => {
      return !n.read &&
        n.timestamp > initialMountTime.current - 10000 && // Within last 10 seconds of mount or newer
        !notifiedIds.has(n.id);
    });

    if (newUnreadNotifications.length > 0) {
      const updatedNotifiedIds = new Set(notifiedIds);
      newUnreadNotifications.forEach(n => {
        updatedNotifiedIds.add(n.id);

        // Trigger In-app Toast Notification
        toast({
          title: n.title,
          description: n.body,
        });
      });
      setNotifiedIds(updatedNotifiedIds);
    }
  }, [myNotifications, notifiedIds, toast]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-muted" title="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-background animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0 shadow-xl border-border" align="start">
        <div className="p-3 border-b flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
              onClick={() => {
                myNotifications.forEach((n) => {
                  if (!n.read) markNotificationRead(n.id);
                });
              }}
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y">
          {clusteredList.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No notifications at this time.
            </div>
          ) : (
            clusteredList.map((cluster) => (
              <div
                key={cluster.id}
                onClick={() => {
                  if (!cluster.read) {
                    cluster.ids.forEach(id => markNotificationRead(id));
                  }
                }}
                className={cn(
                  "p-3 text-xs space-y-1 transition-colors cursor-pointer flex gap-3 items-start",
                  !cluster.read ? "bg-amber-50/60 dark:bg-amber-950/20" : "hover:bg-muted/50"
                )}
              >
                <div className="mt-0.5 p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
                  {cluster.type === 'hours_confirmed' ? (
                    <UserCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <Calendar className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between font-semibold text-foreground text-xs gap-1">
                    <span className="truncate">{cluster.title}</span>
                    <span className="text-[10px] font-normal text-muted-foreground shrink-0">
                      {format(new Date(cluster.timestamp), 'h:mm a')}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-snug">{cluster.body}</p>
                  {cluster.count > 1 && (
                    <div className="pt-1">
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        {cluster.count} notifications clustered
                      </Badge>
                    </div>
                  )}
                </div>
                {!cluster.read && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
