
import type { Config } from "tailwindcss";
import { tailwindColors, tailwindRadii } from "./src/config/theme"; // Importar desde el nuevo archivo

// Constantes para nombres de animaciones
const EXPAND_ACCORDION = 'expandAccordion';
const COLLAPSE_ACCORDION = 'collapseAccordion';

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		// Definiciones de Color importadas de src/config/theme.ts
  		colors: tailwindColors,
  		
      // Definiciones de Radio de Borde importadas de src/config/theme.ts
  		borderRadius: tailwindRadii,
  		
      // Definiciones de Keyframes para Animaciones
  		keyframes: {
  			[EXPAND_ACCORDION]: { // Usar constante y nuevo nombre
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			[COLLAPSE_ACCORDION]: { // Usar constante y nuevo nombre
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
        // Usar constantes y la variable CSS --animation-duration
  			[EXPAND_ACCORDION]: `${EXPAND_ACCORDION} var(--animation-duration) ease-out`,
  			[COLLAPSE_ACCORDION]: `${COLLAPSE_ACCORDION} var(--animation-duration) ease-out`,
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
