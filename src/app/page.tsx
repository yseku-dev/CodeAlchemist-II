
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
  LayoutDashboard
} from 'lucide-react';

const features = [
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

const quickStartSteps = [
  { text: "Configura tus ajustes de proveedor LLM en la sección 'Configuración'.", href: "/configuracion", linkText: "Configura tus ajustes del proveedor LLM"},
  { text: "Explora la generación de código con un prompt sencillo en 'Generar Código'.", href: "/generar-codigo", linkText: "Explora la generación de código"},
  { text: "Prueba el análisis de un fragmento de código en 'Analizar Código'.", href: "/analizar-codigo", linkText: "Prueba el análisis de un fragmento de código"},
  { text: "Interactúa con el 'Chat con IA' para consultas rápidas.", href: "/chat-ia", linkText: "Interactúa con el Chat con IA"},
  { text: "Experimenta con 'AutoUpdate' para ver cómo CodeAlchemist se analiza a sí mismo.", href: "/autoupdate", linkText: "Experimenta con AutoUpdate"}
];

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <header className="text-center mb-12">
        <FlaskConical data-ai-hint="alchemy magic" className="h-24 w-24 mx-auto text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-3">Bienvenido a CodeAlchemist</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Tu plataforma de desarrollo asistido por IA, diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software mediante la generación, análisis, refactorización y gestión de versiones de código.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-8 text-center">Características Principales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Link href={feature.href} key={feature.title} passHref>
              <Card className="hover:shadow-lg transition-shadow duration-300 cursor-pointer h-full flex flex-col transform hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <feature.icon className="h-10 w-10 text-accent flex-shrink-0" />
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
                  {step.text.substring(step.linkText.length)}
                </li>
              ))}
            </ol>
            <div className="mt-8 text-center">
              <Link href="/configuracion" passHref>
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <SettingsIcon className="mr-2 h-5 w-5" /> Ir a Configuración
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
