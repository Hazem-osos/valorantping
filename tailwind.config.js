/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080A',
          900: '#0C0E12',
          800: '#12151C',
          700: '#1A1F29',
          600: '#242B38',
          500: '#334056'
        },
        sand: {
          300: '#E8D5A3',
          400: '#D4B36A',
          500: '#C9A227',
          600: '#A68520'
        },
        pulse: {
          good: '#3DDC97',
          warn: '#F5C542',
          bad: '#FF5C7A',
          info: '#6CB6FF'
        }
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.04), 0 18px 50px rgba(0,0,0,0.35)'
      },
      fontFamily: {
        sans: ['Segoe UI Variable', 'Segoe UI', 'SF Pro Display', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Mono', 'SF Mono', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
}
