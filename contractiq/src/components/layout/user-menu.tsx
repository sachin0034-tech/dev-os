'use client';

import { CircleUserRound, LogOut } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu({ email }: { email: string }) {
  const [pending, setPending] = useState(false);

  // Sign-out runs server-side (POST /api/auth/logout) so auth cookies are cleared by the server.
  const signOut = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) throw new Error('logout failed');
      window.location.assign('/');
    } catch {
      setPending(false);
      toast.error("Couldn't sign out. Try again.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-md text-secondary hover:bg-subtle"
      >
        <CircleUserRound className="h-5 w-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="max-w-[240px] truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={() => void signOut()}>
          <LogOut className="h-4 w-4" aria-hidden />
          {pending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
