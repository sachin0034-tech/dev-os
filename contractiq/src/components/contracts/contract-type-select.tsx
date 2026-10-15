'use client';

import { ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { fieldClasses } from '@/components/ui/input';
import { CONTRACT_TYPE_LABELS } from '@/lib/constants/standard-terms';
import { cn } from '@/lib/utils/cn';
import type { ContractType } from '@/types/api';

export function ContractTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: ContractType | null;
  onChange: (value: ContractType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="contract-type">Contract type</Label>
      <div className="relative">
        <select
          id="contract-type"
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as ContractType)}
          className={cn(fieldClasses, 'h-10 appearance-none pr-10')}
        >
          <option value="" disabled>
            Choose NDA or MSA
          </option>
          {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((t) => (
            <option key={t} value={t}>
              {t} — {CONTRACT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-secondary"
          aria-hidden
        />
      </div>
    </div>
  );
}
