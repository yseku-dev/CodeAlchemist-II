
import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		// Definiciones de Color
  		colors: {
  			background: ({ opacityValue }) => `hsl(var(--background) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  			foreground: ({ opacityValue }) => `hsl(var(--foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  			card: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--card) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--card-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			popover: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--popover) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--popover-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			primary: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--primary) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--primary-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			secondary: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--secondary) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--secondary-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			muted: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--muted) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--muted-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			accent: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--accent) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--accent-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			destructive: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--destructive) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--destructive-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			border: ({ opacityValue }) => `hsl(var(--border) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  			input: ({ opacityValue }) => `hsl(var(--input) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  			ring: ({ opacityValue }) => `hsl(var(--ring) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  			chart: {
  				'1': ({ opacityValue }) => `hsl(var(--chart-1) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				'2': ({ opacityValue }) => `hsl(var(--chart-2) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				'3': ({ opacityValue }) => `hsl(var(--chart-3) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				'4': ({ opacityValue }) => `hsl(var(--chart-4) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				'5': ({ opacityValue }) => `hsl(var(--chart-5) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			},
  			sidebar: {
  				DEFAULT: ({ opacityValue }) => `hsl(var(--sidebar-background) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				foreground: ({ opacityValue }) => `hsl(var(--sidebar-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				primary: ({ opacityValue }) => `hsl(var(--sidebar-primary) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				'primary-foreground': ({ opacityValue }) => `hsl(var(--sidebar-primary-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				accent: ({ opacityValue }) => `hsl(var(--sidebar-accent) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				'accent-foreground': ({ opacityValue }) => `hsl(var(--sidebar-accent-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				border: ({ opacityValue }) => `hsl(var(--sidebar-border) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  				ring: ({ opacityValue }) => `hsl(var(--sidebar-ring) ${opacityValue ? `/ ${opacityValue}` : ''})`
  			}
  		},
  		// Definiciones de Radio de Borde
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		// Definiciones de Keyframes para Animaciones
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		// Definiciones de Animación
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
