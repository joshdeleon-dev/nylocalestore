/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          50:  '#F6F0E8',
          100: '#EDE4D4',
          200: '#DDD0B8',
          300: '#C4A87C',
          400: '#A88454',
          500: '#7E5F38',
          600: '#5E4428',
          700: '#422D18',
          800: '#2C1D0D',
          900: '#170D05',
        },
      },
      fontFamily: {
        sans:  ['var(--font-dm-sans)',   'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)',  'Georgia',   'serif'],
      },
      letterSpacing: {
        widest2: '0.14em',
      },
    },
  },
  plugins: [],
};
