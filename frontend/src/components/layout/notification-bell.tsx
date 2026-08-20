'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { settingsApi } from '@/lib/api/settings.api';
import { formatRelative } from '@/lib/format';

/**
 * The notification inbox.
 *
 * Shared between the studio topbar and the client portal header rather than
 * duplicated: the two shells look different, but "what happened while I was
 * away" is the same feature, and a client who reports a bug needs to see it
 * acknowledged just as much as the studio needs to see the report.
 */
export function NotificationBell({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: settingsApi.notifications,
    enabled,
    // Polled rather than pushed — a websocket is overkill here, and a minute
    // of latency on a status update is imperceptible.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const unread = notifications.filter((item) => !item.isRead);

  const markRead = useMutation({
    mutationFn: (id: string) => settingsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => settingsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-danger text-[9px] font-bold text-danger-foreground">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread.length > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              onClick={(event) => {
                // Keep the menu open so the list can be seen updating.
                event.preventDefault();
                markAllRead.mutate();
              }}
            >
              <CheckCheck className="size-3" />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            You&apos;re all caught up
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto scrollbar-slim">
            {notifications.slice(0, 15).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex-col items-start gap-0.5 py-2"
                onSelect={() => {
                  if (!item.isRead) markRead.mutate(item.id);
                  if (item.link) router.push(item.link);
                }}
              >
                <div className="flex w-full items-center gap-2">
                  {!item.isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className="flex-1 truncate text-xs font-medium">{item.title}</span>
                </div>
                {item.body && (
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">{item.body}</span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {formatRelative(item.createdAt)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
