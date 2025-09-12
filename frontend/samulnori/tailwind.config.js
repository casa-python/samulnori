/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'pretendard': ['Pretendard', 'sans-serif'],
        'flegrei': ['flegrei', 'sans-serif'],
      },
      colors: {
        // SAMULNORI 브랜드 컬러
        'samulnori': {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // 파동 배경용 컬러
        'wave': {
          red: '#E53E3E',
          blue: '#3182CE',
          yellow: '#D69E2E',
          purple: '#9F7AEA',
          green: '#38A169',
          orange: '#ED8936',
          teal: '#4FD1C7',
        }
      },
      animation: {
        'wave-float': 'wave-float 10s ease-in-out infinite',
        'wave-rotate': 'wave-rotate 15s linear infinite',
        'wave-scale': 'wave-scale 8s ease-in-out infinite',
      },
      keyframes: {
        'wave-float': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-20px) translateX(10px)' },
        },
        'wave-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'wave-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
} 