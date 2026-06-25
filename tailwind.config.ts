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
          50: '#faf8f7',
          100: '#f5f2f0',
          200: '#ede7e2',
          300: '#d4c4ba',
          400: '#b39f92',
          500: '#6f4e37',
          600: '#655a52',
          700: '#4a3728',
          800: '#3e2723',
          900: '#2c1810',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
