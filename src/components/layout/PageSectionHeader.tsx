
"use client";

import React from 'react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * @fileOverview A reusable component for page and section headers.
 * Displays an optional icon, title, description, and an actions slot.
 */

/**
 * Props for the PageSectionHeader component.
 */
interface PageSectionHeaderProps {
  /** 
   * Optional icon component to display alongside the title.
   * Typically an icon from a library like `lucide-react`.
   * @example <Users2 />
   */
  icon?: React.ElementType;
  /** 
   * The main title for the section. This prop is required.
   * @example "Gestión de Usuarios"
   */
  title: string;
  /** 
   * Optional description text that appears below the title.
   * @example "Crea, edita y gestiona los usuarios de la aplicación."
   */
  description?: string;
  /** 
   * Optional React node to render action buttons or other controls,
   * typically aligned to the right of the header.
   * @example <Button>Nuevo Usuario</Button>
   */
  actions?: React.ReactNode;
  /** 
   * Optional additional CSS class names to apply to the root CardHeader element.
   */
  className?: string;
  /** 
   * Optional additional CSS class names to apply to the icon element.
   */
  iconClassName?: string;
}

/**
 * PageSectionHeader component.
 * Provides a standardized header structure for main sections of pages within CodeAlchemist.
 * It includes an optional icon, a mandatory title, an optional description, and an optional
 * slot for action buttons or other interactive elements.
 *
 * @param {PageSectionHeaderProps} props - The props for the component.
 * @returns {JSX.Element} The rendered page section header.
 *
 * @example
 * <PageSectionHeader
 *   icon={Users2}
 *   title="Gestión de Agentes IA"
 *   description="Crea, configura, prueba y gestiona agentes IA individuales."
 *   actions={<Button>Crear Agente</Button>}
 * />
 */
export default function PageSectionHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
  iconClassName,
}: PageSectionHeaderProps): JSX.Element {
  return (
    <CardHeader className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {Icon && <Icon className={cn("h-7 w-7 text-primary mt-1 sm:mt-0 flex-shrink-0", iconClassName)} data-testid="page-section-header-icon" />}
        <div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">{actions}</div>}
    </CardHeader>
  );
}
