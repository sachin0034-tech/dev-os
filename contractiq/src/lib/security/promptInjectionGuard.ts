import { AppError } from '@/lib/api/errors';
import { logger } from '@/lib/utils/logger';

// Prompt-injection protection — docs/security/security-plan.md §4.
// User-typed text (chat messages, custom term names) is checked and blocked BEFORE it
// reaches the LLM. Contract text is never blocked (users upload third-party documents);
// instead it is fenced with neutralizeContractText() and the system prompts tell the
// model to treat it as data.

interface InjectionRule {
  id: string;
  pattern: RegExp;
}

// Patterns are deliberately specific so ordinary contract questions pass, e.g.
// "Does the vendor act as a data processor?" or "Can they reveal confidential information?".
const RULES: InjectionRule[] = [
  {
    id: 'ignore_instructions',
    pattern:
      /\b(ignore|disregard|forget|override|bypass|skip)\b[^.?!]{0,40}\b(previous|prior|above|earlier|all|any|your|the|system|these|those)\b[^.?!]{0,20}\b(instructions?|rules?|prompts?|guidelines|directions|constraints)\b/i,
  },
  { id: 'override_rules', pattern: /\b(override|change|replace|rewrite)\s+(your|the)\s+(rules|instructions|system prompt|guidelines)\b/i },
  {
    id: 'reveal_prompt',
    pattern:
      /\b(reveal|show|print|display|repeat|output|leak|dump|tell me|give me|what (is|are|were))\b[^.?!]{0,30}\b(system prompt|(your|the) (system |initial |original |hidden )?(instructions|prompt|rules|guidelines)|hidden (prompt|instructions)|initial prompt)\b/i,
  },
  {
    id: 'secrets',
    pattern:
      /\b(expose|show|print|reveal|list|give me|dump|leak|output|tell me)\b[^.?!]{0,30}\b(env(ironment)? ?(variables?|vars?)|process\.env|\.env|api[\s_-]?keys?|secret[\s_-]?keys?|service[\s_-]?role|access tokens?|credentials|connection strings?)\b/i,
  },
  {
    id: 'data_exfiltration',
    pattern:
      /\b(dump|list|show|print|export|select \*)\b[^.?!]{0,30}\b(the database|database (tables|contents)|all (users|contracts|accounts)|other users'? (contracts|data))\b/i,
  },
  { id: 'role_you_are_now', pattern: /\byou are now (a|an|in|my|the|no longer)\b/i },
  {
    id: 'role_act_as',
    pattern:
      /\bact as (if you (are|were)|though you|my\b|an? (unrestricted|unfiltered|uncensored|different|new|evil|rogue|jailbroken|developer|system)\b|(the )?(system|developer|admin(istrator)?)\b|dan\b|chatgpt\b)/i,
  },
  { id: 'role_pretend', pattern: /\b(pretend|imagine)\s+(that\s+)?(you('re| are)|to be)\b/i },
  { id: 'jailbreak', pattern: /\b(jailbreak|jail-break|dan mode|do anything now|developer mode|god mode|sudo mode)\b/i },
  { id: 'fake_system_turn', pattern: /(^|\n)\s*(system|assistant)\s*:|<\/?(system|instructions?|contract)>|\[\/?(inst|system)\]/i },
];

const ZERO_WIDTH = /[​-‍⁠﻿]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Canonical form used both for detection and for the text sent to the model. */
export const normalizeUserText = (text: string): string =>
  text.normalize('NFKC').replace(ZERO_WIDTH, '').replace(CONTROL, '').trim();

export function detectPromptInjection(text: string): { detected: boolean; rule?: string } {
  const normalized = normalizeUserText(text).replace(/\s+/g, ' ');
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) return { detected: true, rule: rule.id };
  }
  return { detected: false };
}

/**
 * Returns the normalized text that may be sent to the LLM, or throws
 * AppError('PROMPT_INJECTION') (HTTP 400) without calling the model.
 */
export function sanitizeForLLM(text: string, ctx: { userId?: string; field?: string } = {}): string {
  const { detected, rule } = detectPromptInjection(text);
  if (detected) {
    logger.warn('security.prompt_injection_blocked', { userId: ctx.userId, field: ctx.field, rule });
    throw new AppError('PROMPT_INJECTION');
  }
  return normalizeUserText(text);
}

/**
 * Contract text is untrusted data placed inside <contract>…</contract>. Neutralise any
 * delimiter-like tags in it so a document cannot close the fence and smuggle instructions.
 */
export const neutralizeContractText = (text: string): string =>
  text.replace(/<\s*\/?\s*(contract|system|instructions?)\b[^>]*>/gi, (m) => m.replace(/</g, '‹').replace(/>/g, '›'));
