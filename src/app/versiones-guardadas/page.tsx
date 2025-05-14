
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Download, Trash2, GitCompareArrows, CheckSquare, Square } from 'lucide-react';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { CodeSnapshot } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
// For diffing, a library like 'diff' or 'diff2html' would be used.
// For simplicity, we'll show side-by-side.
// import { DiffChars } from 'diff'; // Example, actual diff library needed

export default function VersionesGuardadasPage() {
  const { snapshots, addSnapshot, deleteSnapshot, deleteAllSnapshots } = useAppState();
  const { toast } = useToast();
  const { addLog } = useDebug();

  const [selectedForCompareA, setSelectedForCompareA] = useState<string | null>(null);
  const [selectedForCompareB, setSelectedForCompareB] = useState<string | null>(null);
  
  const [showViewModal, setShowViewModal] = useState(false);
  const [snapshotToView, setSnapshotToView] = useState<CodeSnapshot | null>(null);
  
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [snapshotA, setSnapshotA] = useState<CodeSnapshot | null>(null);
  const [snapshotB, setSnapshotB] = useState<CodeSnapshot | null>(null);

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [snapshotToDelete, setSnapshotToDelete] = useState<CodeSnapshot | null>(null);


  const handleViewSnapshot = (snapshot: CodeSnapshot) => {
    setSnapshotToView(snapshot);
    setShowViewModal(true);
  };

  const handleDownloadSnapshot = (snapshot: CodeSnapshot) => {
    const element = document.createElement("a");
    const file = new Blob([snapshot.code], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${snapshot.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({ title: "Snapshot Descargado", description: `Snapshot "${snapshot.name}" descargado.`});
  };

  const handleDeleteSnapshot = (snapshot: CodeSnapshot) => {
    setSnapshotToDelete(snapshot);
  };
  
  const confirmDeleteSnapshot = () => {
    if(snapshotToDelete){
      deleteSnapshot(snapshotToDelete.id);
      setSnapshotToDelete(null);
    }
  }

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
        toast({variant: "destructive", title: "Error", description: "No se encontraron los snapshots seleccionados."});
      }
    } else {
      toast({variant: "destructive", title: "Selección Incompleta", description: "Selecciona dos versiones (A y B) para comparar."});
    }
  };

  const handleSaveCurrentCodeAlchemist = () => {
    // This is a placeholder. In a real scenario, you'd need a way to get the current app's source.
    const mockAppCode = `// Código actual de CodeAlchemist (Simulado) - ${new Date().toISOString()}\nfunction mainApp() { console.log("CodeAlchemist está funcionando!"); }`;
    addSnapshot({
      name: `CodeAlchemist Actual - ${new Date().toLocaleDateString()}`,
      code: mockAppCode,
      source: 'codealchemist-current',
    });
    addLog("Snapshot of current CodeAlchemist code saved (Simulated).");
  };

  const confirmDeleteAllSnapshots = () => {
    deleteAllSnapshots();
    setShowDeleteAllConfirm(false);
  };

  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle>Versiones Guardadas (Snapshots)</CardTitle>
        <CardDescription>Gestiona instantáneas de código generadas o del estado de la aplicación.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Button onClick={handleSaveCurrentCodeAlchemist}>Guardar Código Actual de CodeAlchemist</Button>
          <div>
            <Button onClick={handleCompareVersions} disabled={!selectedForCompareA || !selectedForCompareB} variant="outline" className="mr-2">
              <GitCompareArrows className="mr-2 h-4 w-4"/> Comparar A y B
            </Button>
            <Button onClick={() => setShowDeleteAllConfirm(true)} variant="destructive" disabled={snapshots.length === 0}>
              <Trash2 className="mr-2 h-4 w-4"/> Eliminar Todas
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-20rem)]"> {/* Adjust height as needed */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">A</TableHead>
                <TableHead className="w-10">B</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Fecha de Creación</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right w-[200px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay versiones guardadas.</TableCell></TableRow>
              )}
              {snapshots.map((snapshot) => (
                <TableRow key={snapshot.id}>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => toggleCompareSelection(snapshot.id, 'A')} className={selectedForCompareA === snapshot.id ? 'bg-primary/20' : ''}>
                      {selectedForCompareA === snapshot.id ? <CheckSquare className="h-4 w-4 text-primary"/> : <Square className="h-4 w-4"/>}
                    </Button>
                  </TableCell>
                  <TableCell>
                     <Button variant="ghost" size="icon" onClick={() => toggleCompareSelection(snapshot.id, 'B')} className={selectedForCompareB === snapshot.id ? 'bg-primary/20' : ''}>
                      {selectedForCompareB === snapshot.id ? <CheckSquare className="h-4 w-4 text-primary"/> : <Square className="h-4 w-4"/>}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{snapshot.name}</TableCell>
                  <TableCell>{new Date(snapshot.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="capitalize">{snapshot.source || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleViewSnapshot(snapshot)} title="Ver">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDownloadSnapshot(snapshot)} title="Descargar">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSnapshot(snapshot)} title="Eliminar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      {/* View Snapshot Modal */}
      <ConfirmDialog
        isOpen={showViewModal && !!snapshotToView}
        onClose={() => setShowViewModal(false)}
        onConfirm={() => setShowViewModal(false)}
        title={`Viendo Snapshot: ${snapshotToView?.name}`}
        confirmText="Cerrar"
        cancelText=""
      >
        <ScrollArea className="h-96 border rounded-md">
          <CodeBlock code={snapshotToView?.code || "Error: Sin código para mostrar."} maxHeight="100%" />
        </ScrollArea>
      </ConfirmDialog>

      {/* Compare Snapshots Modal */}
       <ConfirmDialog
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        onConfirm={() => setShowCompareModal(false)}
        title="Comparar Versiones (A vs B)"
        confirmText="Cerrar"
        cancelText=""
      >
        {snapshotA && snapshotB && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh]">
            <div>
              <h4 className="font-semibold mb-1">Versión A: {snapshotA.name}</h4>
              <ScrollArea className="h-80 border rounded-md">
                 <CodeBlock code={snapshotA.code} language="plaintext" maxHeight="100%"/>
              </ScrollArea>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Versión B: {snapshotB.name}</h4>
              <ScrollArea className="h-80 border rounded-md">
                <CodeBlock code={snapshotB.code} language="plaintext" maxHeight="100%"/>
              </ScrollArea>
            </div>
            {/* Basic diff rendering example - replace with actual diff library if needed */}
            {/* <div className="md:col-span-2 mt-2">
              <h4 className="font-semibold mb-1">Diferencias (caracteres):</h4>
              <ScrollArea className="h-40 border rounded-md p-2 text-xs bg-muted">
                {
                  DiffChars(snapshotA.code, snapshotB.code).map((part, index) => (
                    <span key={index} className={part.added ? 'bg-green-200 text-green-800' : part.removed ? 'bg-red-200 text-red-800 line-through' : ''}>
                      {part.value}
                    </span>
                  ))
                }
              </ScrollArea>
            </div> */}
          </div>
        )}
      </ConfirmDialog>

      {/* Delete All Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={confirmDeleteAllSnapshots}
        title="Confirmar Eliminación Total"
        description="¿Estás seguro de que quieres eliminar TODOS los snapshots guardados? Esta acción no se puede deshacer."
        confirmText="Sí, Eliminar Todos"
      />
      
      {/* Delete Single Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!snapshotToDelete}
        onClose={() => setSnapshotToDelete(null)}
        onConfirm={confirmDeleteSnapshot}
        title={`Confirmar Eliminación: ${snapshotToDelete?.name}`}
        description="¿Estás seguro de que quieres eliminar este snapshot? Esta acción no se puede deshacer."
        confirmText="Sí, Eliminar"
      />
    </Card>
  );
}
