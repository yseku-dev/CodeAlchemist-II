
"use client";

import React, { useState } from 'react';
import type { NoteType } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';

interface NoteProps {
  note: NoteType;
  onDelete: (id: string) => void;
}

export default function Note({ note, onDelete }: NoteProps) {
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete(note.id);
    setIsConfirmDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className="mb-4 shadow-md">
        <CardContent className="p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
          {note.createdAt && (
            <p className="text-xs text-gray-400 mt-2">
              Creada: {new Date(note.createdAt).toLocaleString()}
            </p>
          )}
        </CardContent>
        <CardFooter className="p-2 flex justify-end">
          <Button variant="ghost" size="icon" onClick={handleDeleteClick} title="Eliminar Nota">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres borrar esta nota? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Confirmar Borrado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
