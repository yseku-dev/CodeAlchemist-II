
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
  /** Optional icon component (e.g., from Lucide). */
  icon?: React.ElementType;
  /** The main title for the section. */
  title: string;
  /** Optional description for the section. */
  description?: string;
  /** Optional React node for action buttons or other controls on the right. */
  actions?: React.ReactNode;
  /** Optional additional class names for the CardHeader root. */
  className?: string;
  /** Optional additional class names for the icon. */
  iconClassName?: string;
}

/**
 * PageSectionHeader component.
 * Provides a standardized header structure for main sections of pages.
 *
 * @param {PageSectionHeaderProps} props - The props for the component.
 * @returns {JSX.Element} The rendered page section header.
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
        {Icon && <Icon className={cn("h-7 w-7 text-primary mt-1 sm:mt-0 flex-shrink-0", iconClassName)} />}
        <div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">{actions}</div>}
    </CardHeader>
  );
}
