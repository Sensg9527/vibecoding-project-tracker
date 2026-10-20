/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // M3 design tokens — DESIGN.md §2.
        'brand-primary': '#2563EB',
        'brand-accent': '#0D9488',
        'surface-page': '#F8FAFC',
        'surface-card': '#FFFFFF',
        'text-primary': '#0F172A',
        'text-muted': '#64748B',
        // Task type (M6 tag-style)
        'type-feature': '#16A34A',
        'type-bug': '#DC2626',
        // Due-date states (M8 due-tint)
        'due-safe': '#DBEAFE',
        'due-warning': '#FEF3C7',
        'due-overdue': '#FEE2E2',
        'due-neutral': '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
