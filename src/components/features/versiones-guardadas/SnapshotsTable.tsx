// src/components/features/versiones-guardadas/SnapshotsTable.tsx
"use client";

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, Download, Trash2, MoreHorizontal, CheckSquare, Square } from 'lucide-react';
import type { CodeSnapshot } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface SnapshotsTableProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  snapshots: CodeSnapshot[];
  selectedForCompareA: string | null;
  selectedForCompareB: string | null;
  onToggleCompareSelection: (id: string, type: 'A' | 'B') => void;
  onViewSnapshot: (snapshot: CodeSnapshot) => void;
  onDownloadSnapshot: (snapshot: CodeSnapshot, format: 'original' | 'zip') => void;
  onDeleteSnapshot: (snapshot: CodeSnapshot) => void;
}

const SnapshotsTable: React.FC<SnapshotsTableProps> = ({
  t,
  snapshots,
  selectedForCompareA,
  selectedForCompareB,
  onToggleCompareSelection,
  onViewSnapshot,
  onDownloadSnapshot,
  onDeleteSnapshot,
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">{t('versions.table.colA')}</TableHead>
          <TableHead className="w-10">{t('versions.table.colB')}</TableHead>
          <TableHead>{t('versions.table.colName')}</TableHead>
          <TableHead>{t('versions.table.colCreatedAt')}</TableHead>
          <TableHead>{t('versions.table.colSource')}</TableHead>
          <TableHead className="text-right w-[120px]">{t('versions.table.colActions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {snapshots.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              {t('versions.table.noVersions')}
            </TableCell>
          </TableRow>
        )}
        {snapshots.map((snapshot) => (
          <TableRow key={snapshot.id}>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleCompareSelection(snapshot.id, 'A')}
                className={selectedForCompareA === snapshot.id ? 'bg-primary/20' : ''}
                aria-label={t('versions.action.selectA')}
              >
                {selectedForCompareA === snapshot.id ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleCompareSelection(snapshot.id, 'B')}
                className={selectedForCompareB === snapshot.id ? 'bg-primary/20' : ''}
                aria-label={t('versions.action.selectB')}
              >
                {selectedForCompareB === snapshot.id ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            </TableCell>
            <TableCell className="font-medium">{snapshot.name}</TableCell>
            <TableCell>{new Date(snapshot.createdAt).toLocaleString()}</TableCell>
            <TableCell className="capitalize">
              {t(`versions.source.${snapshot.source || 'unknown'}` as TranslationKey, {
                defaultValue: snapshot.source || t('versions.source.unknown'),
              })}
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">{t('versions.table.colActions')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewSnapshot(snapshot)}>
                    <Eye className="mr-2 h-4 w-4" /> {t('versions.action.view')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownloadSnapshot(snapshot, 'original')}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('versions.action.downloadOriginal', { format: snapshot.source === 'codealchemist-app-state' ? 'JSON' : 'TXT' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownloadSnapshot(snapshot, 'zip')}>
                    <Download className="mr-2 h-4 w-4" /> {t('versions.action.downloadZip')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDeleteSnapshot(snapshot)} className="text-destructive focus:text-destructive-foreground">
                    <Trash2 className="mr-2 h-4 w-4" /> {t('versions.action.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default SnapshotsTable;
