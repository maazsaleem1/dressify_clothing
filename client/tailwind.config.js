/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        ink: {
          DEFAULT: '#0a0a0a',
          soft: '#171717',
          muted: '#525252',
          faint: '#a3a3a3',
        },
        surface: {
          DEFAULT: '#ffffff',
          soft: '#fafafa',
          muted: '#f5f5f5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card': '0 4px 24px -4px rgb(0 0 0 / 0.08)',
        'elevated': '0 12px 40px -12px rgb(0 0 0 / 0.15)',
      },
    },
  },
  plugins: [],
}
