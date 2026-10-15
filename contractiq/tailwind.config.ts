import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Design tokens: docs/design.md → docs/specs/design-tokens.md.
// Components must use these semantic names only — never raw hex or primitive steps.
const v = (name: string) => `var(--${name})`;

const config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter-display)', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: v('text-primary'),
        secondary: v('text-secondary'),
        disabled: v('text-disabled'),
        'on-brand': v('text-on-brand'),
        brand: { DEFAULT: v('brand'), hover: v('brand-hover'), tint: v('brand-tint') },
        success: { DEFAULT: v('success'), tint: v('success-tint'), border: v('success-border'), text: v('success-text') },
        danger: { DEFAULT: v('danger'), tint: v('danger-tint'), border: v('danger-border'), text: v('danger-text') },
        warning: { DEFAULT: v('warning'), tint: v('warning-tint'), border: v('warning-border'), text: v('warning-text') },
        info: { DEFAULT: v('info'), tint: v('info-tint'), border: v('info-border'), text: v('info-text') },
        accent: { DEFAULT: v('accent'), tint: v('accent-tint'), border: v('accent-border'), text: v('accent-text') },
        highlight: v('highlight'),
      },
      backgroundColor: {
        primary: v('bg-primary'),
        surface: v('bg-surface'),
        subtle: v('bg-subtle'),
        pressed: v('bg-pressed'),
      },
      textColor: {
        primary: v('text-primary'),
        secondary: v('text-secondary'),
      },
      borderColor: {
        DEFAULT: v('border-default'),
        default: v('border-default'),
        strong: v('border-strong'),
      },
      borderRadius: { sm: '4px', md: '6px', lg: '8px', xl: '12px' },
      spacing: { 18: '72px', 24: '96px', 28: '112px' },
      fontSize: {
        h1: ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h2: ['36px', { lineHeight: '44px', fontWeight: '700' }],
        h3: ['30px', { lineHeight: '38px', fontWeight: '600' }],
        h4: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h5: ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
      },
      letterSpacing: { normal: '0' },
      transitionDuration: {
        micro: '100ms',
        tooltip: '150ms',
        enter: '200ms',
        exit: '150ms',
        page: '250ms',
        fade: '300ms',
      },
      boxShadow: { none: 'none' },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
