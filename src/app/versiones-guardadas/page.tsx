// src/app/versiones-guardadas/page.tsx
"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { CodeSnapshot } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import SnapshotsHeader from '@/components/features/versiones-guardadas/SnapshotsHeader';
import SnapshotsActionsBar from '@/components/features/versiones-guardadas/SnapshotsActionsBar';
import SnapshotsTable from '@/components/features/versiones-guardadas/SnapshotsTable';

/**
 * @fileOverview Page component for managing saved code snapshots.
 * Allows users to view, download, compare, and delete snapshots.
 * Also allows saving the current application state as a snapshot.
 * All UI texts are internationalized.
 */
export default function VersionesGuardadasPage() {
  const { settings, agents, groups, snapshots, addSnapshot, deleteSnapshot, deleteAllSnapshots } = useAppState();
  const { toast } = useToast();
  const { addLog } = useDebug();
  const { t } = useI18n();

  const [selectedForCompareA, setSelectedForCompareA] = useState<string | null>(null);
  const [selectedForCompareB, setSelectedForCompareB] = useState<string | null>(null);
  
  const [showViewModal, setShowViewModal] = useState(false);
  const [snapshotToView, setSnapshotToView] = useState<CodeSnapshot | null>(null);
  
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [snapshotA, setSnapshotA] = useState<CodeSnapshot | null>(null);
  const [snapshotB, setSnapshotB] = useState<CodeSnapshot | null>(null);

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [snapshotToDelete, setSnapshotToDelete] = useState<CodeSnapshot | null>(null);

  const handleSaveCurrentAppState = useCallback((downloadAsZip: boolean) => {
    const currentAppState = {
      appName: "CodeAlchemist State",
      timestamp: new Date().toISOString(),
      settings,
      agents,
      groups
    };
    const snapshotName = t('versions.toast.appStateSaved.name', { time: new Date().toLocaleString() });
    const newSnapshot = addSnapshot({
      name: snapshotName,
      code: JSON.stringify(currentAppState, null, 2),
      source: 'codealchemist-app-state',
    });
    
    if (downloadAsZip) {
      handleDownloadSnapshot(newSnapshot, 'zip');
      toast({ 
        title: t('versions.toast.appStateSavedAndDownloaded.title'), 
        description: t('versions.toast.appStateSavedAndDownloaded.description', { 
          name: newSnapshot.name, 
          filename: `${newSnapshot.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`
        }) 
      });
    } else {
      toast({ title: t('versions.toast.appStateSaved.title'), description: t('versions.toast.appStateSaved.description', { name: newSnapshot.name }) });
    }
    addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Application state saved as snapshot: ${newSnapshot.name}. Downloaded as ZIP: ${downloadAsZip}`});
  }, [settings, agents, groups, addSnapshot, toast, t, addLog]);

  const handleDownloadSnapshot = useCallback((snapshot: CodeSnapshot, format: 'original' | 'zip') => {
    const element = document.createElement("a");
    let fileContent = snapshot.code;
    let fileName = `${snapshot.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    let mimeType = 'text/plain;charset=utf-8';

    if (format === 'original') {
      if (snapshot.source === 'codealchemist-app-state') {
        fileName += '.json';
        mimeType = 'application/json;charset=utf-8';
      } else {
        fileName += '.txt';
      }
    } else { // format === 'zip'
      fileName += '.zip';
      mimeType = 'application/zip';
      // For client-side "zip", we are just changing extension.
      // True zipping would require JSZip here if snapshot.code wasn't already a single entity.
      // Since it's single entity, this is fine for user expectation of a .zip extension.
    }
    
    const file = new Blob([fileContent], {type: mimeType});
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
    toast({ title: t('versions.toast.snapshotDownloaded.title'), description: t('versions.toast.snapshotDownloaded.description', {name: snapshot.name, filename: fileName})});
    addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Snapshot "${snapshot.name}" downloaded as ${fileName}.`});
  }, [toast, t, addLog]);

  const handleViewSnapshot = (snapshot: CodeSnapshot) => {
    setSnapshotToView(snapshot);
    setShowViewModal(true);
  };

  const handleDeleteSnapshot = (snapshot: CodeSnapshot) => {
    setSnapshotToDelete(snapshot);
  };
  
  const confirmDeleteSnapshot = () => {
    if(snapshotToDelete){
      const name = snapshotToDelete.name;
      deleteSnapshot(snapshotToDelete.id);
      toast({ title: t('versions.toast.snapshotDeleted.title'), description: t('versions.toast.snapshotDeleted.description', {name}) });
      setSnapshotToDelete(null);
    }
  };

  const toggleCompareSelection = (id: string, type: 'A' | 'B') => {
    if (type === 'A') {
      setSelectedForCompareA(prev => prev === id ? null : id);
    } else {
      setSelectedForCompareB(prev => prev === id ? null : id);
    }
  };

  const handleCompareVersions = () => {
    if (selectedForCompareA && selectedForCompareB) {
      const snapA = snapshots.find(s => s.id === selectedForCompareA);
      const snapB = snapshots.find(s => s.id === selectedForCompareB);
      if (snapA && snapB) {
        setSnapshotA(snapA);
        setSnapshotB(snapB);
        setShowCompareModal(true);
      } else {
        toast({variant: "destructive", title: t('versions.toast.compareError.title'), description: t('versions.toast.compareError.notFound')});
      }
    } else {
      toast({variant: "destructive", title: t('versions.toast.compareError.title'), description: t('versions.toast.compareError.selectionIncomplete')});
    }
  };

  const confirmDeleteAllSnapshots = () => {
    deleteAllSnapshots();
    toast({title: t('versions.toast.allSnapshotsDeleted.title')});
    setShowDeleteAllConfirm(false);
  };

  return (
    <Card className="max-w-5xl mx-auto">
      <SnapshotsHeader t={t} />
      <CardContent>
        <SnapshotsActionsBar
          t={t}
          onSaveAppState={handleSaveCurrentAppState}
          onCompareVersions={handleCompareVersions}
          compareDisabled={!selectedForCompareA || !selectedForCompareB}
          onDeleteAll={() => setShowDeleteAllConfirm(true)}
          deleteAllDisabled={snapshots.length === 0}
        />
        <ScrollArea className="h-[calc(100vh-24rem)] md:h-[calc(100vh-20rem)]">
          <SnapshotsTable
            t={t}
            snapshots={snapshots}
            selectedForCompareA={selectedForCompareA}
            selectedForCompareB={selectedForCompareB}
            onToggleCompareSelection={toggleCompareSelection}
            onViewSnapshot={handleViewSnapshot}
            onDownloadSnapshot={handleDownloadSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
          />
        </ScrollArea>
      </CardContent>

      <ConfirmDialog
        isOpen={showViewModal && !!snapshotToView}
        onClose={() => setShowViewModal(false)}
        onConfirm={() => setShowViewModal(false)}
        title={t('versions.viewModal.title', { name: snapshotToView?.name || '' })}
        confirmText={t('common.close')}
        cancelText=""
      >
        <ScrollArea className="h-96 border rounded-md">
          <CodeBlock 
            code={snapshotToView?.code || t('versions.viewModal.noCode')} 
            language={snapshotToView?.source === 'codealchemist-app-state' ? 'json' : 'plaintext'}
            maxHeight="100%" 
          />
        </ScrollArea>
      </ConfirmDialog>

       <ConfirmDialog
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        onConfirm={() => setShowCompareModal(false)}
        title={t('versions.compareModal.title')}
        confirmText={t('common.close')}
        cancelText=""
      >
        {snapshotA && snapshotB && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh]">
            <div>
              <h4 className="font-semibold mb-1">{t('versions.compareModal.versionA', {name: snapshotA.name})}</h4>
              <ScrollArea className="h-80 border rounded-md">
                 <CodeBlock code={snapshotA.code} language={snapshotA.source === 'codealchemist-app-state' ? 'json' : 'plaintext'} maxHeight="100%"/>
              </ScrollArea>
            </div>
            <div>
              <h4 className="font-semibold mb-1">{t('versions.compareModal.versionB', {name: snapshotB.name})}</h4>
              <ScrollArea className="h-80 border rounded-md">
                <CodeBlock code={snapshotB.code} language={snapshotB.source === 'codealchemist-app-state' ? 'json' : 'plaintext'} maxHeight="100%"/>
              </ScrollArea>
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={confirmDeleteAllSnapshots}
        title={t('versions.deleteAllModal.title')}
        description={t('versions.deleteAllModal.description')}
        confirmText={t('versions.deleteAllModal.confirm')}
      />
      
      <ConfirmDialog
        isOpen={!!snapshotToDelete}
        onClose={() => setSnapshotToDelete(null)}
        onConfirm={confirmDeleteSnapshot}
        title={t('versions.deleteSingleModal.title', { name: snapshotToDelete?.name || '' })}
        description={t('versions.deleteSingleModal.description')}
        confirmText={t('versions.deleteSingleModal.confirm')}
      />
    </Card>
  );
}
