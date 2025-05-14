
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FlaskConical, 
  CodeXml, 
  FolderPlus, 
  GitPullRequestDraft, 
  Sparkles, 
  Settings as SettingsIcon, 
  ScanLine,
  FolderSearch,
  GitCompareArrows,
  MessageCircle,
  Users2,
  Workflow,
  LayoutDashboard // Assuming LayoutDashboard is for "Panel de Control"
} from 'lucide-react';

/**
 * @fileOverview DashboardPage component.
 * This is the main landing page (Panel de Control) for the CodeAlchemist application.
 * It provides an overview of the platform's capabilities and quick access to its features.
 */

/**
 * Represents a feature available in CodeAlchemist.
 * Used to generate interactive cards on the dashboard.
 */
interface FeatureInfo {
  /** The title of the feature. */
  title: string;
  /** A brief description of what the feature does. */
  description: string;
  /** The URL path to navigate to the feature's page. */
  href: string;
  /** The Lucide icon component representing the feature. */
  icon: React.ElementType;
}

/**
 * Array of feature objects used to populate the "Características Principales" section.
 * Each object defines a key feature of CodeAlchemist.
 */
const features: FeatureInfo[] = [
  { title: 'Generar Código', description: 'Crea fragmentos de código desde descripciones en lenguaje natural.', href: '/generar-codigo', icon: CodeXml },
  { title: 'Generar Proyecto', description: 'Inicia estructuras de proyecto completas a partir de especificaciones.', href: '/generar-proyecto', icon: FolderPlus },
  { title: 'Refactorizar Proyecto', description: 'Analiza y refactoriza proyectos existentes con sugerencias de IA.', href: '/refactorizar-proyecto', icon: GitPullRequestDraft },
  { title: 'Analizar Código', description: 'Obtén análisis detallados y sugerencias para fragmentos o archivos.', href: '/analizar-codigo', icon: ScanLine },
  { title: 'Analizar Proyecto', description: 'Realiza un análisis completo de un proyecto desde un archivo o Git.', href: '/analizar-proyecto', icon: FolderSearch },
  { title: 'AutoUpdate', description: 'Permite que CodeAlchemist analice y mejore su propio código fuente.', href: '/autoupdate', icon: Sparkles },
  { title: 'Versiones Guardadas', description: 'Gestiona instantáneas de código generadas o del estado de la aplicación.', href: '/versiones-guardadas', icon: GitCompareArrows },
  { title: 'Chat con IA', description: 'Interactúa con un asistente IA para consultas, ideas y más.', href: '/chat-ia', icon: MessageCircle },
  { title: 'Agentes IA', description: 'Crea, configura y gestiona agentes IA individuales.', href: '/agentes-ia', icon: Users2 },
  { title: 'Grupos de Trabajo IA', description: 'Define y ejecuta equipos de agentes IA colaborativos.', href: '/grupos-trabajo-ia', icon: Workflow },
  { title: 'Configuración', description: 'Ajusta proveedores LLM, Git y otras opciones de la aplicación.', href: '/configuracion', icon: SettingsIcon },
];

/**
 * Represents a step in the "Guía Rápida de Inicio".
 * Used to guide new users through initial setup and feature exploration.
 */
interface QuickStartStep {
  /** The main text for the step. */
  text: string;
  /** The URL path for the link within the step. */
  href: string;
  /** The text for the hyperlink. */
  linkText: string;
}

/**
 * Array of quick start steps for new users.
 */
const quickStartSteps: QuickStartStep[] = [
  { text: " en la sección 'Configuración'.", href: "/configuracion", linkText: "Configura tus ajustes del proveedor LLM"},
  { text: " con un prompt sencillo en 'Generar Código'.", href: "/generar-codigo", linkText: "Explora la generación de código"},
  { text: " en 'Analizar Código'.", href: "/analizar-codigo", linkText: "Prueba el análisis de un fragmento de código"},
  { text: " para consultas rápidas.", href: "/chat-ia", linkText: "Interactúa con el Chat con IA"},
  { text: " para ver cómo CodeAlchemist se analiza a sí mismo.", href: "/autoupdate", linkText: "Experimenta con AutoUpdate"}
];

/**
 * DashboardPage - The main landing page (Panel de Control) of CodeAlchemist.
 * 
 * This component serves as the central hub, providing:
 * - A welcoming message and a brief description of the application.
 * - A grid of interactive cards linking to the main features ("Características Principales").
 * - A "Guía Rápida de Inicio" to help new users get started.
 * 
 * It uses `Link` components for navigation and `Card` components for structuring content.
 * Icons are from `lucide-react` to visually represent features.
 * 
 * @returns {JSX.Element} The rendered dashboard page.
 */
export default function DashboardPage(): JSX.Element {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <header className="text-center mb-12">
        {/* Application Logo and Main Title */}
        <FlaskConical data-ai-hint="alchemy magic" className="h-24 w-24 mx-auto text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-3">Bienvenido a CodeAlchemist</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Tu plataforma de desarrollo asistido por IA, diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software mediante la generación, análisis, refactorización y gestión de versiones de código.
        </p>
      </header>

      {/* Section for Main Features */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-8 text-center">Características Principales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Link href={feature.href} key={feature.title} passHref legacyBehavior>
              <Card 
                as="a" // Render Card as an anchor tag for semantic linking
                className="hover:shadow-lg transition-shadow duration-300 cursor-pointer h-full flex flex-col transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label={`Ir a ${feature.title}`}
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <feature.icon className="h-10 w-10 text-accent flex-shrink-0" aria-hidden="true" />
                  <CardTitle className="text-xl md:text-2xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Section for Quick Start Guide */}
      <section>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">Guía Rápida de Inicio</CardTitle>
            <CardDescription>Sigue estos pasos para comenzar a utilizar CodeAlchemist de manera efectiva:</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3 text-md md:text-lg">
              {quickStartSteps.map((step, index) => (
                <li key={index} className="text-muted-foreground">
                  <Link href={step.href} className="text-primary hover:underline font-medium">
                    {step.linkText}
                  </Link>
                  {step.text}
                </li>
              ))}
            </ol>
            <div className="mt-8 text-center">
              {/* Call to Action Button */}
              <Link href="/configuracion" passHref legacyBehavior>
                <Button as="a" size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <SettingsIcon className="mr-2 h-5 w-5" aria-hidden="true" /> Ir a Configuración
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
