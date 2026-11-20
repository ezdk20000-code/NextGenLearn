/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0B0F17',
        s1: '#111827',
        s2: '#1E293B',
        s3: '#334155',
        line: '#1E293B',
        ink: '#F8FAFC',
        mute: '#94A3B8',
        dim: '#64748B',
        violet: { DEFAULT: '#6366F1', soft: '#C0C1FF', deep: '#4F46E5' },
        teal: { DEFAULT: '#14B8A6', soft: '#4FDBC8' },
        amber: { DEFAULT: '#F59E0B', soft: '#FFB95F' },
        rose: { DEFAULT: '#F43F5E', soft: '#FDA4AF' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { lg: '1rem', xl: '1.5rem' },
      boxShadow: {
        glow: '0 0 20px rgba(99,102,241,0.35)',
        'glow-teal': '0 8px 32px -4px rgba(20,184,166,0.2)',
        'glow-amber': '0 8px 32px -4px rgba(245,158,11,0.15)',
        'glow-violet': '0 8px 32px -4px rgba(99,102,241,0.2)',
      },
    },
  },
  plugins: [],
}
