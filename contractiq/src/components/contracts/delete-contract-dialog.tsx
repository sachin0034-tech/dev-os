'use client';

import { buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteContract } from '@/hooks/use-delete-contract';
import { Loader2 } from 'lucide-react';

export function DeleteContractDialog({
  contractId,
  fileName,
  open,
  onOpenChange,
  onDeleted,
}: {
  contractId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const del = useDeleteContract();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !del.isPending && onOpenChange(o)}>
      <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <AlertDialogTitle>Delete this contract?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently deletes <span className="text-primary">{fileName}</span>, its key terms and chat
          history. This can&apos;t be undone.
        </AlertDialogDescription>
        <div className="flex justify-end gap-2">
          <AlertDialogCancel autoFocus disabled={del.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            disabled={del.isPending}
            onClick={(e) => {
              e.preventDefault();
              del.mutate(contractId, {
                onSuccess: () => {
                  onOpenChange(false);
                  onDeleted?.();
                },
              });
            }}
          >
            {del.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Delete permanently
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
