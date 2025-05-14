
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical, CodeXml, FolderPlus, GitPullRequestDraft, Sparkles, Settings as SettingsIcon, ScanLine } from 'lucide-react';

const features = [
  { title: 'Generar Código', description: 'Crea fragmentos de código desde descripciones.', href: '/generar-codigo', icon: CodeXml },
  { title: 'Generar Proyecto', description: 'Inicia estructuras de proyecto completas.', href: '/generar-proyecto', icon: FolderPlus },
  { title: 'Refactorizar Proyecto', description: 'Analiza y refactoriza proyectos existentes.', href: '/refactorizar-proyecto', icon: GitPullRequestDraft },
  { title: 'Analizar Código', description: 'Análisis detallado de fragmentos o archivos.', href: '/analizar-codigo', icon: ScanLine },
  { title: 'AutoUpdate', description: 'Analiza y mejora el propio CodeAlchemist.', href: '/autoupdate', icon: Sparkles },
  { title: 'Configuración', description: 'Ajusta proveedores LLM, Git y más.', href: '/configuracion', icon: SettingsIcon },
];

const quickStartSteps = [
  "Configura tus ajustes de proveedor LLM en la sección 'Configuración'.",
  "Explora la generación de código con un prompt sencillo en 'Generar Código'.",
  "Prueba el análisis de un fragmento de código en 'Analizar Código'.",
  "Interactúa con el 'Chat con IA' para consultas rápidas.",
  "Experimenta con 'AutoUpdate' para ver cómo CodeAlchemist se analiza a sí mismo."
];

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <header className="text-center mb-12">
        <FlaskConical className="h-24 w-24 mx-auto text-primary mb-4" />
        <h1 className="text-5xl font-bold mb-2">Bienvenido a CodeAlchemist</h1>
        <p className="text-xl text-muted-foreground">
          Tu asistente de IA para optimizar y agilizar el desarrollo de software.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 text-center">Características Principales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Link href={feature.href} key={feature.title} passHref>
              <Card className="hover:shadow-lg transition-shadow duration-300 cursor-pointer h-full flex flex-col">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <feature.icon className="h-10 w-10 text-accent" />
                  <CardTitle className="text-2xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Guía Rápida de Inicio</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3 text-lg">
              {quickStartSteps.map((step, index) => (
                <li key={index} className="text-muted-foreground">
                  {step.startsWith("Configura") && <Link href="/configuracion" className="text-primary hover:underline">Configura tus ajustes de proveedor LLM</Link>}
                  {step.startsWith("Explora") && <Link href="/generar-codigo" className="text-primary hover:underline">Explora la generación de código</Link>}
                  {step.startsWith("Prueba el análisis") && <Link href="/analizar-codigo" className="text-primary hover:underline">Prueba el análisis de un fragmento de código</Link>}
                  {step.startsWith("Interactúa") && <Link href="/chat-ia" className="text-primary hover:underline">Interactúa con el Chat con IA</Link>}
                  {step.startsWith("Experimenta") && <Link href="/autoupdate" className="text-primary hover:underline">Experimenta con AutoUpdate</Link>}
                  {!step.match(/^(Configura|Explora|Prueba el análisis|Interactúa|Experimenta)/) && step}
                </li>
              ))}
            </ol>
            <div className="mt-6 text-center">
              <Link href="/configuracion" passHref>
                <Button size="lg">Ir a Configuración</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
