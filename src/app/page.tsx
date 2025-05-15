
// src/app/page.tsx
"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'; // Removed CardFooter
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
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

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
  /** The translation key for the feature's title. */
  titleKey: TranslationKey;
  /** The translation key for the feature's description. */
  descriptionKey: TranslationKey;
  /** The URL path to navigate to the feature's page. */
  href: string;
  /** The Lucide icon component representing the feature. */
  icon: React.ElementType;
}

/**
 * Array of feature objects used to populate the "Características Principales" section.
 * Each object defines a key feature of CodeAlchemist.
 */
const featuresData: FeatureInfo[] = [
  { titleKey: 'dashboard.features.generateCode.title', descriptionKey: 'dashboard.features.generateCode.description', href: '/generar-codigo', icon: CodeXml },
  { titleKey: 'dashboard.features.generateProject.title', descriptionKey: 'dashboard.features.generateProject.description', href: '/generar-proyecto', icon: FolderPlus },
  { titleKey: 'dashboard.features.refactorProject.title', descriptionKey: 'dashboard.features.refactorProject.description', href: '/refactorizar-proyecto', icon: GitPullRequestDraft },
  { titleKey: 'dashboard.features.analyzeCode.title', descriptionKey: 'dashboard.features.analyzeCode.description', href: '/analizar-codigo', icon: ScanLine },
  { titleKey: 'dashboard.features.analyzeProject.title', descriptionKey: 'dashboard.features.analyzeProject.description', href: '/analizar-proyecto', icon: FolderSearch },
  { titleKey: 'dashboard.features.autoupdate.title', descriptionKey: 'dashboard.features.autoupdate.description', href: '/autoupdate', icon: Sparkles },
  { titleKey: 'dashboard.features.snapshots.title', descriptionKey: 'dashboard.features.snapshots.description', href: '/versiones-guardadas', icon: GitCompareArrows },
  { titleKey: 'dashboard.features.chat.title', descriptionKey: 'dashboard.features.chat.description', href: '/chat-ia', icon: MessageCircle },
  { titleKey: 'dashboard.features.agents.title', descriptionKey: 'dashboard.features.agents.description', href: '/agentes-ia', icon: Users2 },
  { titleKey: 'dashboard.features.groups.title', descriptionKey: 'dashboard.features.groups.description', href: '/grupos-trabajo-ia', icon: Workflow },
  { titleKey: 'dashboard.features.settings.title', descriptionKey: 'dashboard.features.settings.description', href: '/configuracion', icon: SettingsIcon },
];

/**
 * Represents a step in the "Guía Rápida de Inicio".
 * Used to guide new users through initial setup and feature exploration.
 */
interface QuickStartStep {
  /** The URL path for the link within the step. */
  href: string;
  /** The translation key for the hyperlink text. */
  linkTextKey: TranslationKey;
  /** The translation key for the main text of the step. */
  textKey: TranslationKey;
}

/**
 * Array of quick start steps for new users.
 */
const quickStartStepsData: QuickStartStep[] = [
  { linkTextKey: "dashboard.quickstart.step1.link", textKey: "dashboard.quickstart.step1.text", href: "/configuracion"},
  { linkTextKey: "dashboard.quickstart.step2.link", textKey: "dashboard.quickstart.step2.text", href: "/generar-codigo"},
  { linkTextKey: "dashboard.quickstart.step3.link", textKey: "dashboard.quickstart.step3.text", href: "/analizar-codigo"},
  { linkTextKey: "dashboard.quickstart.step4.link", textKey: "dashboard.quickstart.step4.text", href: "/chat-ia"},
  { linkTextKey: "dashboard.quickstart.step5.link", textKey: "dashboard.quickstart.step5.text", href: "/autoupdate"}
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
 * All user-visible text is internationalized using the `useI18n` hook.
 * 
 * @returns {JSX.Element} The rendered dashboard page.
 */
export default function DashboardPage(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <header className="text-center mb-12">
        {/* Application Logo and Main Title */}
        <FlaskConical data-ai-hint="alchemy magic" className="h-24 w-24 mx-auto text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-3">{t('dashboard.welcome')}</h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          {t('dashboard.description')}
        </p>
      </header>

      {/* Section for Main Features */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-8 text-center">{t('dashboard.features.title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {featuresData.map((feature) => (
            <Link href={feature.href} key={feature.titleKey} passHref legacyBehavior>
              <Card 
                as="a" // Render Card as an anchor tag for semantic linking
                className="hover:shadow-lg transition-shadow duration-300 cursor-pointer h-full flex flex-col transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label={t(feature.titleKey as TranslationKey)} // Use translated title for aria-label
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <feature.icon className="h-10 w-10 text-accent flex-shrink-0" aria-hidden="true" />
                  <CardTitle className="text-xl md:text-2xl">{t(feature.titleKey as TranslationKey)}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">{t(feature.descriptionKey as TranslationKey)}</p>
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
            <CardTitle className="text-2xl md:text-3xl">{t('dashboard.quickstart.title')}</CardTitle>
            <CardDescription>{t('dashboard.quickstart.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3 text-md md:text-lg">
              {quickStartStepsData.map((step, index) => (
                <li key={index} className="text-muted-foreground">
                  <Link href={step.href} className="text-primary hover:underline font-medium">
                    {t(step.linkTextKey as TranslationKey)}
                  </Link>
                  {t(step.textKey as TranslationKey)}
                </li>
              ))}
            </ol>
            <div className="mt-8 text-center">
              {/* Call to Action Button */}
              <Link href="/configuracion" passHref legacyBehavior>
                <Button as="a" size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <SettingsIcon className="mr-2 h-5 w-5" aria-hidden="true" /> {t('dashboard.quickstart.ctaButton')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

