
// src/app/versiones-guardadas/page.tsx
"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { CodeSnapshot, AppSourceFile, AppSettings, Agent, AIAgentGroup } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { getApplicationSourceBundle } from '@/app/autoupdate/actions';
import JSZip from 'jszip';
import SnapshotsHeader from '@/components/features/versiones-guardadas/SnapshotsHeader';
import SnapshotsActionsBar from '@/components/features/versiones-guardadas/SnapshotsActionsBar';
import SnapshotsTable from '@/components/features/versiones-guardadas/SnapshotsTable';

/**
 * @fileOverview Page component for managing saved code snapshots ("Versiones Guardadas").
 * Allows users to view, download, compare, and delete snapshots of code or application state.
 * Includes functionality to save the current application state or the entire project source code.
 * @module VersionesGuardadasPage
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

  const [isSavingProjectSource, setIsSavingProjectSource] = useState(false);

  const handleSaveSnapshotOfCurrentState = useCallback(async (type: 'config' | 'projectSource') => {
    let newSnapshotData: Omit<CodeSnapshot, 'id' | 'createdAt'>;
    let toastTitleKey: TranslationKey = 'versions.toast.snapshotSaved.title';
    let toastDescriptionKey: TranslationKey = 'versions.toast.snapshotSaved.description';
    let snapshotBaseName = "";

    if (type === 'config') {
      setIsSavingProjectSource(false);
      const currentAppState: Partial<Omit<AppSettings, 'language'>> & { agents: Agent[], groups: AIAgentGroup[], appName: string, timestamp: string, language: string } = {
        appName: t('layout.app.title' as TranslationKey),
        timestamp: new Date().toISOString(),
        settings: { 
            llmConfig: settings.llmConfig,
            gitConfig: settings.gitConfig,
            debugMode: settings.debugMode,
        },
        language: settings.language,
        agents,
        groups,
      };
      snapshotBaseName = t('versions.toast.appStateSaved.name', { time: new Date().toLocaleString() });
      const jsonDataString = JSON.stringify(currentAppState, null, 2);
      newSnapshotData = {
        name: snapshotBaseName,
        code: jsonDataString,
        source: 'codealchemist-app-state',
        size: jsonDataString.length,
      };
      toastTitleKey = 'versions.toast.appStateSaved.title';
      toastDescriptionKey = 'versions.toast.appStateSaved.description';
    } else if (type === 'projectSource') {
      setIsSavingProjectSource(true);
      toast({ title: t('versions.toast.savingProjectSource.title'), description: t('versions.toast.savingProjectSource.description') });
      addLog({ source: 'VersionesGuardadasPage', type: 'INFO', message: 'Iniciando guardado de snapshot del código fuente del proyecto.' });
      try {
        const bundleResult = await getApplicationSourceBundle();
        if (!bundleResult.success || !bundleResult.files) {
          toast({ variant: 'destructive', title: t('versions.toast.getSourceError.title'), description: bundleResult.error || t('versions.toast.getSourceError.description') });
          addLog({ source: 'VersionesGuardadasPage', type: 'ERROR', message: `Error al obtener código fuente del servidor: ${bundleResult.error}` });
          setIsSavingProjectSource(false);
          return;
        }
        const projectSourceData = { sourceFiles: bundleResult.files };
        const jsonDataString = JSON.stringify(projectSourceData, null, 2);
        snapshotBaseName = t('versions.toast.projectSourceSaved.name', { time: new Date().toLocaleString() });
        newSnapshotData = {
          name: snapshotBaseName,
          code: jsonDataString,
          source: 'codealchemist-project-source',
          size: jsonDataString.length,
          fileCount: bundleResult.files.length,
        };
        toastTitleKey = 'versions.toast.projectSourceSaved.title';
        toastDescriptionKey = 'versions.toast.projectSourceSaved.description';
        addLog({ source: 'VersionesGuardadasPage', type: 'SUCCESS', message: `Código fuente del proyecto obtenido y listo para snapshot. Archivos: ${bundleResult.files.length}` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: t('versions.toast.getSourceError.title'), description: error.message || t('versions.toast.getSourceError.unknown') });
        addLog({ source: 'VersionesGuardadasPage', type: 'ERROR', message: `Excepción al obtener código fuente del servidor: ${error.message}`, errorDetails: error });
        setIsSavingProjectSource(false);
        return;
      } finally {
        setIsSavingProjectSource(false);
      }
    } else {
      addLog({ source: 'VersionesGuardadasPage', type: 'ERROR', message: `Tipo de snapshot desconocido: ${type}` });
      return;
    }

    const newSnapshot = addSnapshot(newSnapshotData);
    toast({ title: t(toastTitleKey), description: t(toastDescriptionKey, { name: newSnapshot.name }) });
    addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Snapshot guardado: ${newSnapshot.name}. Tipo: ${type}.`});
  }, [settings, agents, groups, addSnapshot, toast, t, addLog]);

  const handleDownloadSnapshot = useCallback(async (snapshot: CodeSnapshot, format: 'original' | 'zip' | 'project_zip') => {
    addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Iniciando descarga para snapshot: ${snapshot.name}, Formato: ${format}`});
    const element = document.createElement("a");
    let fileContent: string | Blob = snapshot.code;
    let fileName = `${snapshot.name.replace(/[^a-z0-9\s-]/gi, '_').replace(/\s+/g, '_').toLowerCase()}`;
    let mimeType = 'text/plain;charset=utf-8';

    try {
      if (format === 'project_zip' && snapshot.source === 'codealchemist-project-source') {
        addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Procesando 'project_zip' para: ${snapshot.name}. Contenido del snapshot (primeros 200 chars): ${snapshot.code.substring(0,200)}`});
        let projectData: { sourceFiles: AppSourceFile[] };
        try {
          projectData = JSON.parse(snapshot.code);
        } catch (parseErr: any) {
          addLog({source: 'VersionesGuardadasPage', type: 'ERROR', message: `Snapshot '${snapshot.name}' (project_zip): Contenido JSON inválido. Error: ${parseErr.message}`, data: snapshot.code.substring(0,500) + "..."});
          toast({ variant: "destructive", title: t('versions.toast.zipError.title'), description: t('versions.toast.zipError.invalidJsonContent') });
          return;
        }

        if (!projectData || !projectData.sourceFiles || !Array.isArray(projectData.sourceFiles)) {
          addLog({source: 'VersionesGuardadasPage', type: 'ERROR', message: `Snapshot '${snapshot.name}' (project_zip): 'sourceFiles' es inválido o no es un array. Datos recibidos:`, data: projectData});
          toast({ variant: "destructive", title: t('versions.toast.zipError.title'), description: t('versions.toast.zipError.invalidData')});
          return;
        }
        
        addLog({source: 'VersionesGuardadasPage', type: 'DEBUG', message: `Snapshot '${snapshot.name}' (project_zip): ${projectData.sourceFiles.length} archivos fuente encontrados para zipear.`});
        if (projectData.sourceFiles.length === 0) {
          addLog({source: 'VersionesGuardadasPage', type: 'WARN', message: `Snapshot '${snapshot.name}' (project_zip): No hay archivos fuente para zipear.`});
          toast({ variant: "destructive", title: t('versions.toast.zipError.title'), description: t('versions.toast.zipError.noFiles') });
          return;
        }

        const zip = new JSZip();
        let filesAddedToZip = 0;
        projectData.sourceFiles.forEach((file: AppSourceFile) => {
          const cleanFileName = file.fileName && typeof file.fileName === 'string' ? 
                                (file.fileName.startsWith('./') ? file.fileName.substring(2) : file.fileName.startsWith('/') ? file.fileName.substring(1) : file.fileName) 
                                : '';
          
          if (!cleanFileName || cleanFileName.trim() === "") {
            addLog({source: 'VersionesGuardadasPage', type: 'WARN', message: `Omitiendo archivo en project_zip (nombre de archivo inválido o ausente): ${JSON.stringify(file)}`});
            return; 
          }
          const contentString = typeof file.content === 'string' ? file.content : '';
          
          addLog({source: 'VersionesGuardadasPage', type: 'DEBUG', message: `Añadiendo a project_zip: '${cleanFileName}', longitud contenido: ${contentString.length}, contenido (inicio): '${contentString.substring(0,50)}...'`});
          try {
            zip.file(cleanFileName, contentString);
            filesAddedToZip++;
          } catch (zipFileError: any) {
            addLog({source: 'VersionesGuardadasPage', type: 'ERROR', message: `Error al añadir archivo '${cleanFileName}' al ZIP: ${zipFileError.message}`, errorDetails: zipFileError});
            toast({ variant: "destructive", title: t('versions.toast.zipError.title'), description: t('versions.toast.zipError.fileAddError', { fileName: cleanFileName, error: zipFileError.message }) });
          }
        });

        if (filesAddedToZip === 0 && projectData.sourceFiles.length > 0) {
             addLog({source: 'VersionesGuardadasPage', type: 'ERROR', message: `Snapshot '${snapshot.name}' (project_zip): Ningún archivo pudo ser añadido al ZIP aunque existían sourceFiles.`});
             toast({ variant: "destructive", title: t('versions.toast.zipError.title'), description: t('versions.toast.zipError.noFilesAdded') });
             return;
        }
        
        fileContent = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        fileName += '_project_source.zip';
        mimeType = 'application/zip';
        addLog({source: 'VersionesGuardadasPage', type: 'SUCCESS', message: `Blob ZIP para '${snapshot.name}' (project_zip) generado. Tamaño: ${fileContent.size} bytes. Archivos añadidos: ${filesAddedToZip}`});

      } else if (format === 'zip') {
        fileName += '.zip';
        mimeType = 'application/zip';
        addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Preparando descarga ZIP simple para: ${snapshot.name}`});
      } else {
        const isJsonSource = snapshot.source === 'codealchemist-app-state' || 
                             snapshot.source === 'generated-project' ||
                             snapshot.source === 'codealchemist-project-source' ||
                             snapshot.source === 'project-analysis' ||
                             snapshot.source === 'refactored-project' ||
                             snapshot.source === 'autoupdate-snapshot';
        if (isJsonSource) {
          fileName += '.json';
          mimeType = 'application/json;charset=utf-8';
        } else {
          fileName += '.txt';
        }
        addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Preparando descarga original (${fileName}) para: ${snapshot.name}`});
      }
      
      const fileToDownload = (fileContent instanceof Blob) ? fileContent : new Blob([fileContent as string], {type: mimeType});
      element.href = URL.createObjectURL(fileToDownload);
      element.download = fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
      toast({ title: t('versions.toast.snapshotDownloaded.title'), description: t('versions.toast.snapshotDownloaded.description', {name: snapshot.name, filename: fileName})});
      addLog({source: 'VersionesGuardadasPage', type: 'SUCCESS', message: `Snapshot "${snapshot.name}" descargado como ${fileName}. Formato solicitado: ${format}`});
    } catch (e: any) {
      const errorMsg = e.message || t('versions.toast.downloadError.unknown');
      toast({ variant: "destructive", title: t('versions.toast.downloadError.title'), description: errorMsg });
      addLog({source: 'VersionesGuardadasPage', type: 'ERROR', message: `Error al descargar snapshot '${snapshot.name}': ${errorMsg}`, errorDetails: e});
    }
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
      addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: `Snapshot eliminado: ${name}`});
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
    addLog({source: 'VersionesGuardadasPage', type: 'INFO', message: 'Todos los snapshots eliminados.'});
  };

  return (
    <Card className="max-w-5xl mx-auto">
      <SnapshotsHeader t={t} />
      <CardContent>
        <SnapshotsActionsBar
            t={t}
            onSaveSnapshotOfCurrentState={handleSaveSnapshotOfCurrentState}
            onCompareVersions={handleCompareVersions}
            onDeleteAllSnapshots={() => setShowDeleteAllConfirm(true)}
            isCompareDisabled={!selectedForCompareA || !selectedForCompareB}
            isDeleteAllDisabled={snapshots.length === 0}
            isSavingProjectSource={isSavingProjectSource}
        />
        <ScrollArea className="h-[calc(100vh-26rem)] md:h-[calc(100vh-24rem)]">
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
        onClose={() => { setShowViewModal(false); setSnapshotToView(null); }}
        onConfirm={() => { setShowViewModal(false); setSnapshotToView(null); }}
        title={t('versions.viewModal.title', { name: snapshotToView?.name || '' })}
        confirmText={t('common.close')}
        cancelText=""
      >
        <ScrollArea className="h-96 border rounded-md">
          <CodeBlock 
            code={snapshotToView?.code || t('versions.viewModal.noCode')} 
            language={
              snapshotToView?.source === 'codealchemist-app-state' || 
              snapshotToView?.source === 'generated-project' ||
              snapshotToView?.source === 'codealchemist-project-source' ||
              snapshotToView?.source === 'project-analysis' ||
              snapshotToView?.source === 'refactored-project' ||
              snapshotToView?.source === 'autoupdate-snapshot'
              ? 'json' 
              : 'plaintext'
            }
            maxHeight="100%" 
          />
        </ScrollArea>
      </ConfirmDialog>

       <ConfirmDialog
        isOpen={showCompareModal}
        onClose={() => { setShowCompareModal(false); setSnapshotA(null); setSnapshotB(null);}}
        onConfirm={() => { setShowCompareModal(false); setSnapshotA(null); setSnapshotB(null);}}
        title={t('versions.compareModal.title')}
        confirmText={t('common.close')}
        cancelText=""
      >
        {snapshotA && snapshotB && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh]">
            <div>
              <h4 className="font-semibold mb-1">{t('versions.compareModal.versionA', {name: snapshotA.name})}</h4>
              <ScrollArea className="h-80 border rounded-md">
                 <CodeBlock 
                    code={snapshotA.code} 
                    language={snapshotA.source === 'codealchemist-app-state' ? 'json' : 'plaintext'} 
                    maxHeight="100%"
                />
              </ScrollArea>
            </div>
            <div>
              <h4 className="font-semibold mb-1">{t('versions.compareModal.versionB', {name: snapshotB.name})}</h4>
              <ScrollArea className="h-80 border rounded-md">
                <CodeBlock 
                    code={snapshotB.code} 
                    language={snapshotB.source === 'codealchemist-app-state' ? 'json' : 'plaintext'} 
                    maxHeight="100%"
                />
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
        cancelText={t('common.cancel')}
      />
      
      <ConfirmDialog
        isOpen={!!snapshotToDelete}
        onClose={() => setSnapshotToDelete(null)}
        onConfirm={confirmDeleteSnapshot}
        title={t('versions.deleteSingleModal.title', { name: snapshotToDelete?.name || '' })}
        description={t('versions.deleteSingleModal.description')}
        confirmText={t('versions.deleteSingleModal.confirm')}
        cancelText={t('common.cancel')}
      />
    </Card>
  );
}

  