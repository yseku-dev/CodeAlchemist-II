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
  Settings as SettingsIcon, // Renamed to avoid conflict with global Settings
  ChevronsLeft,
  ChevronsRight,
  Menu as MenuIcon,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import React, { useEffect, useMemo } from 'react'; // Added useMemo
import { useDebug } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast'; // Import useToast

const navItems = [
  { href: '/', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/generar-codigo', label: 'Generar Código', icon: CodeXml },
  { href: '/generar-proyecto', label: 'Generar Proyecto', icon: FolderPlus },
  { href: '/refactorizar-proyecto', label: 'Refactorizar Proyecto', icon: GitPullRequestDraft },
  { href: '/analizar-codigo', label: 'Analizar Código', icon: ScanLine },
  { href: '/analizar-proyecto', label: 'Analizar Proyecto', icon: FolderSearch },
  { href: '/autoupdate', label: 'AutoUpdate', icon: Sparkles },
  { href: '/versiones-guardadas', label: 'Versiones Guardadas', icon: GitCompareArrows },
  { href: '/chat-ia', label: 'Chat con IA', icon: MessageCircle },
  { href: '/agentes-ia', label: 'Agentes IA', icon: Users2 },
  { href: '/grupos-trabajo-ia', label: 'Grupos de Trabajo IA', icon: Workflow },
  { href: '/configuracion', label: 'Configuración', icon: SettingsIcon },
];

/**
 * @fileOverview Main application layout component.
 * Includes the collapsible sidebar, header, and debug panel.
 * Also sets up global client-side error listeners.
 */


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
      aria-label={open ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
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
  const { toast } = useToast(); // Get toast function

  useEffect(() => {
    initializeDefaultData();
  }, [initializeDefaultData]);

  // Global client-side error handling
  useEffect(() => {
    const handleError = (event: ErrorEvent | PromiseRejectionEvent) => {
      let error: any;
      let message: string;
      let source: string | undefined;
      let lineno: number | undefined;
      let colno: number | undefined;

      if (event instanceof ErrorEvent) {
        error = event.error;
        message = event.message;
        source = event.filename;
        lineno = event.lineno;
        colno = event.colno;
      } else { // PromiseRejectionEvent
        error = event.reason;
        message = event.reason instanceof Error ? event.reason.message : String(event.reason);
        // Source, lineno, colno are not directly available on PromiseRejectionEvent
      }

      console.error("Unhandled Client-Side Error:", {
        message,
        source,
        lineno,
        colno,
        errorObject: error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // In a production app, send this to a logging service.
      // Example: Sentry.captureException(error);

      // Show a generic toast to the user
      toast({
        variant: "destructive",
        title: "Error Inesperado",
        description: "Ocurrió un error inesperado. Ya estamos trabajando en ello.",
        duration: 5000,
      });

      // For 'error' events, prevent default browser error handling if you've handled it sufficiently
      // if (event instanceof ErrorEvent) {
      //   event.preventDefault();
      // }
    };

    const errorHandler = (event: ErrorEvent) => handleError(event);
    const rejectionHandler = (event: PromiseRejectionEvent) => handleError(event);

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, [toast]); // Add toast to dependency array

  const currentNavItem = useMemo(() => navItems.find(item => item.href === pathname), [pathname]);
  const pageTitle = currentNavItem?.label || 'Panel de Control';
  const PageIcon = currentNavItem?.icon;
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <FlaskConical className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-semibold">
                CodeAlchemist
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
  const { toast: showToast } = useToast(); // Renamed to avoid conflict

  if (!debugMode) return null;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.map(log => typeof log === 'object' ? JSON.stringify(log) : log).join('\\n'));
    showToast({ title: "Logs Copiados", description: "Logs de depuración copiados al portapapeles."});
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-muted/80 backdrop-blur-sm shadow-lg">
      <div className="flex justify-between items-center p-2 border-b">
        <h3 className="font-semibold text-sm">Panel de Depuración</h3>
        <div>
          <Button variant="ghost" size="icon" onClick={handleCopyLogs} title="Copiar Logs">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={clearLogs} title="Borrar Logs">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Contraer" : "Expandir"}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {isExpanded && (
        <ScrollArea className="h-48 p-2 text-xs">
          {logs.length === 0 ? <p>No hay logs.</p> : logs.map((log, index) => (
            <div key={index} className="font-mono whitespace-pre-wrap border-b border-dashed py-1">
              {typeof log === 'object' ? JSON.stringify(log, null, 2) : log}
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
}
