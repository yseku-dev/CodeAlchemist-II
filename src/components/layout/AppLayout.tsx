
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useSidebar,
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
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Menu as MenuIcon,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import React, { useEffect } from 'react';
import { useDebug } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';

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
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

function CollapsibleSidebarButton() {
  const { open, toggleSidebar, isMobile, state } = useSidebar();

  if (isMobile) {
    return null; 
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label={open ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
      className="group-data-[collapsible=icon]:hidden data-[state=collapsed]:group-data-[collapsible=icon]:flex data-[state=expanded]:flex"
    >
      {open ? <ChevronsLeft /> : <ChevronsRight />}
    </Button>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { initializeDefaultData } = useAppState();

  useEffect(() => {
    initializeDefaultData();
  }, [initializeDefaultData]);

  const currentNavItem = navItems.find(item => item.href === pathname);
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
             {/* Icon-only logo when collapsed */}
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
          {/* Footer can be used for other items if needed, or removed if empty */}
          {/* <SidebarFooter className="p-2">
             <CollapsibleSidebarButton /> // Moved to header
          </SidebarFooter> */}
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6">
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
             <div className="w-10 md:w-0"></div> 
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

function DebugPanel() {
  const { debugMode, logs, clearLogs } = useDebug(); // Removed copyLogs as it's handled locally
  const [isExpanded, setIsExpanded] = React.useState(true);

  if (!debugMode) return null;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.map(log => typeof log === 'object' ? JSON.stringify(log) : log).join('\n'));
    // Consider adding a toast notification here if desired
    console.log("Logs copied to clipboard.");
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

