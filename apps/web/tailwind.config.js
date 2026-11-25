/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f1ff', 100: '#e9e5ff', 200: '#d4cbff', 300: '#b6a5ff', 400: '#9677ff',
          500: '#7c4dff', 600: '#6a35f0', 700: '#5a28d1', 800: '#4a22a8', 900: '#3b1d82',
        },
        income: '#059669',
        expense: '#e11d48',
        ink: { DEFAULT: '#0f172a', soft: '#475569' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.06)',
        pop: '0 12px 40px -8px rgb(15 23 42 / 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        rise: { from: { transform: 'translateY(6px)' }, to: { transform: 'none' } },
        'toast-in': { from: { opacity: 0, transform: 'translateX(16px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        'slide-up': 'slide-up .3s ease-out both',
        rise: 'rise .25s ease-out',
        'toast-in': 'toast-in .25s ease-out',
      },
    },
  },
  plugins: [],
};
