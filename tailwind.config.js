/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Category colors from CONCEPT.md
        'mind-work': '#3B82F6',      // Blue
        'mind-personal': '#8B5CF6',  // Purple
        'mind-technical': '#10B981', // Green
        'mind-creative': '#F59E0B',  // Orange
        'mind-other': '#6B7280',     // Gray
        // Dark void theme
        'void': '#0a0a0f',
        'void-light': '#12121a',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.6' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
