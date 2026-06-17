/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f0fc',
          100: '#e6dff8',
          200: '#d1c3f2',
          300: '#b49ae9',
          400: '#966dde',
          500: '#7b4fd4',
          600: '#5631A5',
          700: '#4a2a8e',
          800: '#3d2374',
          900: '#311d5c',
          950: '#1e1038',
        },
        lavender: {
          50: '#f9f8fd',
          100: '#f0edf9',
          200: '#E8E5F4',
          300: '#DEDBEE',
          400: '#c8c0e4',
          500: '#b0a3d6',
          600: '#9582c4',
          700: '#7c68b0',
          800: '#66539a',
          900: '#52447d',
        },
        surface: {
          50: '#FEFCF9',
          100: '#FDF8F0',
          200: '#FAF5ED',
          300: '#F5EFE5',
        },
        neutral: {
          800: '#1F2937',
          700: '#374151',
          600: '#4B5563',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6',
          50: '#F9FAFB',
        },
      },
      fontFamily: {
        iransans: ['IRANSans', 'Tahoma', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      maxWidth: {
        '8xl': '90rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
};
