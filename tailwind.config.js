/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        void: '#050810',
        base: '#0A0E1A',
        surface: '#111827',
        elevated: '#1E293B',
        glass: 'rgba(17, 24, 39, 0.7)',

        accent: {
          DEFAULT: '#3B82F6',
          glow: 'rgba(59, 130, 246, 0.15)',
        },

        productive: {
          DEFAULT: '#10B981',
          glow: 'rgba(16, 185, 129, 0.15)',
        },

        wasted: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.15)',
        },

        neutral: {
          DEFAULT: '#6B7280',
        },

        txt: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          muted: '#475569',
        },

        border: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          active: 'rgba(59, 130, 246, 0.3)',
        },
      },

      fontFamily: {
        sans: ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      boxShadow: {
        glow: '0 0 30px var(--accent-glow)',
        'glow-productive': '0 0 30px var(--productive-glow)',
        'glow-wasted': '0 0 30px var(--wasted-glow)',
      },

      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
