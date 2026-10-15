import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/validation/auth';
import { cn } from '@/lib/utils/cn';

export function PasswordRules({ password, id }: { password: string; id?: string }) {
  return (
    <ul id={id} className="flex flex-col gap-1" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.id}
            className={cn('flex items-center gap-2 text-body-sm', met ? 'text-success-text' : 'text-secondary')}
          >
            {met ? <Check className="h-3 w-3" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' — met' : ' — not met'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
