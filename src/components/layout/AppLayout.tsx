// src/components/layout/AppLayout.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useSidebar,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FlaskConical,
  LayoutDashboard,
  CodeXml,
  FolderPlus,
  GitPullRequestDraft,
  ScanLine,
  FolderSearch,
  Sparkles,
  GitCompareArrows,
  MessageCircle,
  Users2,
  Workflow,
  Settings as SettingsIcon, 
  ChevronsLeft,
  ChevronsRight,
  Menu as MenuIcon,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import React, { useEffect, useMemo } from 'react'; 
import { useDebug, type DebugLogEntry } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast'; 
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';


/**
 * @fileOverview Main application layout component.
 * Includes the collapsible sidebar, header, and debug panel.
 * Also sets up global client-side error listeners.
 */

/**
 * Data for navigation items in the sidebar.
 * Each item has a path, a translation key for its label, and an icon.
 */
const navItemsData = [
  { href: '/', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { href: '/generar-codigo', labelKey: 'sidebar.generateCode', icon: CodeXml },
  { href: '/generar-proyecto', labelKey: 'sidebar.generateProject', icon: FolderPlus },
  { href: '/refactorizar-proyecto', labelKey: 'sidebar.refactorProject', icon: GitPullRequestDraft },
  { href: '/analizar-codigo', labelKey: 'sidebar.analyzeCode', icon: ScanLine },
  { href: '/analizar-proyecto', labelKey: 'sidebar.analyzeProject', icon: FolderSearch },
  { href: '/autoupdate', labelKey: 'sidebar.autoupdate', icon: Sparkles },
  { href: '/versiones-guardadas', labelKey: 'sidebar.snapshots', icon: GitCompareArrows },
  { href: '/chat-ia', labelKey: 'sidebar.chat', icon: MessageCircle },
  { href: '/agentes-ia', labelKey: 'sidebar.agents', icon: Users2 },
  { href: '/grupos-trabajo-ia', labelKey: 'sidebar.groups', icon: Workflow },
  { href: '/configuracion', labelKey: 'sidebar.settings', icon: SettingsIcon },
];


/**
 * Button to toggle the sidebar collapse state on desktop.
 * @returns {JSX.Element | null} The button or null if on mobile.
 */
function CollapsibleSidebarButton() {
  const { open, toggleSidebar, isMobile } = useSidebar();

  if (isMobile) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label={open ? 'Ocultar barra lateral' : 'Mostrar barra lateral'} // TODO: i18n
    >
      {open ? <ChevronsLeft /> : <ChevronsRight />}
    </Button>
  );
}


/**
 * AppLayout component - The main layout structure for the application.
 * @param {object} props - The component's props.
 * @param {React.ReactNode} props.children - The page content to be rendered within the layout.
 * @returns {JSX.Element} The rendered application layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const pathname = usePathname();
  const { initializeDefaultData } = useAppState();
  const { toast } = useToast(); 
  const { t, language } = useI18n();

  useEffect(() => {
    initializeDefaultData();
  }, [initializeDefaultData]);

  // Effect to set the HTML lang attribute when the active language changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  // Global client-side error handling
  useEffect(() => {
    const handleError = (event: ErrorEvent | PromiseRejectionEvent) => {
      let error: any;
      let message: string;
      let source: string | undefined;
      let lineno: number | undefined;
      let colno: number | undefined;
      let stack: string | undefined;

      if (event instanceof ErrorEvent) {
        error = event.error;
        message = event.message;
        source = event.filename;
        lineno = event.lineno;
        colno = event.colno;
        stack = error instanceof Error ? error.stack : undefined;
      } else { // PromiseRejectionEvent
        error = event.reason;
        message = event.reason instanceof Error ? event.reason.message : String(event.reason);
        stack = event.reason instanceof Error ? event.reason.stack : undefined;
      }

      console.error("Unhandled Client-Side Error:", {
        message,
        source,
        lineno,
        colno,
        pathname, // Current route path
        errorObject: error,
        stack,
      });
      
      // En producción, enviar este 'error' a Sentry:
      // import * as Sentry from "@sentry/nextjs";
      // Sentry.captureException(error, { 
      //   extra: { 
      //     message, source, lineno, colno, pathname,
      //     originalEvent: event instanceof ErrorEvent ? "ErrorEvent" : "PromiseRejectionEvent"
      //   } 
      // });

      toast({
        variant: "destructive",
        title: t('appLayout.toast.unexpectedError.title' as TranslationKey),
        description: t('appLayout.toast.unexpectedError.description' as TranslationKey),
        duration: 7000,
      });
    };

    const errorHandler = (event: ErrorEvent) => handleError(event);
    const rejectionHandler = (event: PromiseRejectionEvent) => handleError(event);

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, [toast, pathname, t]); 

  const navItems = useMemo(() => {
    return navItemsData.map(item => ({
      ...item,
      label: t(item.labelKey as TranslationKey), // Use t() here
      icon: item.icon,
      href: item.href,
    }));
  }, [t, language]); // Depends on t and language

  const currentNavItemData = useMemo(() => navItemsData.find(item => item.href === pathname), [pathname]);
  const pageTitle = useMemo(() => {
    return currentNavItemData ? t(currentNavItemData.labelKey as TranslationKey) : t('sidebar.dashboard' as TranslationKey); // Default to Dashboard if not found
  }, [currentNavItemData, t, language]); // Depends on t and language
  
  const PageIcon = currentNavItemData?.icon;
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <FlaskConical className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-semibold">
                {t('app.title' as TranslationKey)}
              </h1>
            </Link>
             <Link href="/" className="items-center justify-center data-[state=expanded]:group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:flex hidden">
                <FlaskConical className="h-8 w-8 text-primary" />
            </Link>
            <CollapsibleSidebarButton />
          </SidebarHeader>
          <SidebarContent asChild>
            <ScrollArea className="flex-1">
              <SidebarMenu className="p-2">
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href} legacyBehavior passHref>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href}
                        tooltip={{ children: item.label, className: "group-data-[collapsible=icon]:block hidden" }}
                      >
                        <a>
                          <item.icon />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </ScrollArea>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6">
            <div className="md:hidden">
               <SidebarTrigger>
                <MenuIcon />
              </SidebarTrigger>
            </div>
            <div className="flex-1 flex justify-center items-center gap-3 relative">
              {PageIcon && <PageIcon className="h-6 w-6 text-primary" />}
              <h1 className="text-2xl font-semibold">
                {pageTitle}
              </h1>
            </div>
             <div className="w-10 md:w-0"></div> {/* Spacer to help center title if trigger is present */}
          </header>
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
          <DebugPanel />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

/**
 * DebugPanel component for displaying logs if debug mode is active.
 * @returns {JSX.Element | null} The debug panel or null.
 */
function DebugPanel() {
  const { debugMode, logs, clearLogs } = useDebug();
  const [isExpanded, setIsExpanded] = React.useState(true);
  const { toast: showToast } = useToast(); 
  const { t } = useI18n();

  if (!debugMode) return null;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.map(log => typeof log === 'object' ? JSON.stringify(log) : String(log)).join('\\n'));
    showToast({ title: t('appLayout.debugPanel.copyButton' as TranslationKey), description: "Logs de depuración copiados al portapapeles."}); // TODO: i18n description
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-muted/80 backdrop-blur-sm shadow-lg">
      <div className="flex justify-between items-center p-2 border-b">
        <h3 className="font-semibold text-sm">{t('appLayout.debugPanel.title' as TranslationKey)}</h3>
        <div>
          <Button variant="ghost" size="icon" onClick={handleCopyLogs} title={t('appLayout.debugPanel.copyButton' as TranslationKey)}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={clearLogs} title={t('appLayout.debugPanel.clearButton' as TranslationKey)}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? t('appLayout.debugPanel.collapseButton' as TranslationKey) : t('appLayout.debugPanel.expandButton' as TranslationKey)}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {isExpanded && (
        <ScrollArea className="h-48 p-2 text-xs">
          {logs.length === 0 ? <p>{t('appLayout.debugPanel.noLogs' as TranslationKey)}</p> : logs.map((log, index) => (
            <div key={index} className="font-mono whitespace-pre-wrap border-b border-dashed py-1">
              {typeof log === 'object' ? JSON.stringify(log, null, 2) : String(log)}
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
}


    