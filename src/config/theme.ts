// src/config/theme.ts

/**
 * @fileOverview Centralized theme constants for Tailwind CSS configuration.
 * This includes color definitions (referencing CSS variables from globals.css)
 * and border radius definitions.
 */

export const tailwindColors = {
  // Base Colors from globals.css
  background: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--background) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  card: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--card) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--card-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
  popover: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--popover) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--popover-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
  primary: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--primary) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--primary-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
  secondary: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--secondary) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--secondary-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
  muted: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--muted) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--muted-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
  accent: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--accent) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--accent-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
  destructive: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--destructive) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--destructive-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
  border: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--border) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  input: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--input) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  ring: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--ring) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  
  // Chart Colors from globals.css (mapping to semantic names)
  chart: {
    primary: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--chart-1) ${opacityValue ? `/ ${opacityValue}` : ''})`, // Was '1'
    secondary: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--chart-2) ${opacityValue ? `/ ${opacityValue}` : ''})`, // Was '2'
    tertiary: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--chart-3) ${opacityValue ? `/ ${opacityValue}` : ''})`,  // Was '3'
    accentA: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--chart-4) ${opacityValue ? `/ ${opacityValue}` : ''})`,   // Was '4'
    accentB: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--chart-5) ${opacityValue ? `/ ${opacityValue}` : ''})`,   // Was '5'
  },

  // Sidebar Specific Colors from globals.css
  sidebar: {
    DEFAULT: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-background) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    foreground: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    primary: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-primary) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    'primary-foreground': ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-primary-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    accent: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-accent) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    'accent-foreground': ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-accent-foreground) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    border: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-border) ${opacityValue ? `/ ${opacityValue}` : ''})`,
    ring: ({ opacityValue }: { opacityValue?: string }) => `hsl(var(--sidebar-ring) ${opacityValue ? `/ ${opacityValue}` : ''})`,
  },
};

export const tailwindRadii = {
  lg: 'var(--radius)', // Para contenedores y elementos grandes
  md: 'calc(var(--radius) - 2px)', // Para elementos medianos como botones o inputs
  sm: 'calc(var(--radius) - 4px)', // Para elementos pequeños o internos
};
