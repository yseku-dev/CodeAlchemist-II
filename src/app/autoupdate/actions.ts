
'use server';

/**
 * @fileOverview Server Actions for the AutoUpdate feature.
 * This module contains functions that run on the server-side to access
 * the application's source code.
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob'; // Ensure glob is imported
import type { AppSourceFile } from '@/types'; // Import the AppSourceFile type

/**
 * Patterns for files and directories to ignore when bundling the application source.
 * This helps in excluding unnecessary files like `node_modules`, build artifacts, etc.
 */
const ignorePatterns = [
  'node_modules/**',
  '.next/**',
  '*.zip',
  // Consider keeping specific JSONs like package.json, tsconfig.json
  // but exclude others if they are large and not part of "source code"
  // For example, if you had large data JSONs in /public: 'public/**/*.json',
  '.DS_Store',
  '*.log',
  'build/**',
  'dist/**',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.git/**',
  'public/generated/**', // Example: if you generate assets into public
  // '*.lock', // Keep lock files like package-lock.json for reproducibility
  '*.mp4',
  '*.mov',
  '*.webm',
  '*.webp',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  // '*.svg', // SVGs can be code (JSX components) or images. Be selective.
];

/**
 * Retrieves the application's source code files from the server's file system.
 * This Server Action reads files based on glob patterns and ignore lists.
 * JSDoc documentation for parameters and return type.
 * @param {boolean} [concatenate=false] - If true, concatenates all file contents into a single string. (Currently not used by the primary client calling this for ZIP functionality).
 * @param {string[]} [parentExecutionLogs] - Optional array to push detailed logs into for parent tracking.
 * @returns {Promise<{
 *   success: boolean;
 *   files?: AppSourceFile[];
 *   concatenatedSource?: string;
 *   error?: string;
 *   logsBuilt?: string[];
 * }>} An object indicating success, an array of files with their names and content,
 *      or an error message if the operation failed. Includes built logs.
 */
export async function getApplicationSourceBundle(
  concatenate: boolean = false,
  parentExecutionLogs?: string[]
): Promise<{
  success: boolean;
  files?: AppSourceFile[];
  concatenatedSource?: string;
  error?: string;
  logsBuilt?: string[];
}> {
  const internalLogs: string[] = [];
  const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO') => {
    const timestampedMessage = `[SourceBundle ${level} ${new Date().toISOString()}] ${message}`;
    if (level === 'ERROR' || level === 'WARN') {
      console.error(timestampedMessage);
    } else {
      console.log(timestampedMessage);
    }
    internalLogs.push(timestampedMessage);
    if (parentExecutionLogs) parentExecutionLogs.push(timestampedMessage);
  };

  log("Iniciando obtención del paquete de código fuente de la aplicación (Server Action).", 'INFO');
  try {
    const projectRoot = process.cwd();
    log(`Directorio raíz del proyecto: ${projectRoot}. Aplicando patrones de ignorados.`, 'DETAIL');

    const allFiles = await glob('**/*', {
      cwd: projectRoot,
      nodir: true, // Exclude directories from the glob results themselves
      dot: true,   // Include dotfiles
      ignore: ignorePatterns,
      follow: false, // Don't follow symlinks
    });
    log(`Glob encontró ${allFiles.length} rutas de archivo después del filtrado inicial.`, 'INFO');

    if (allFiles.length === 0) {
      log("No se encontraron archivos después de aplicar patrones de ignorados. Verifica los patrones o el contenido del proyecto.", 'WARN');
      return { success: false, error: "No se encontraron archivos para empaquetar.", logsBuilt: internalLogs };
    }

    const filesData: AppSourceFile[] = [];
    let concatenatedOutput = ""; 

    for (const relativeFilePath of allFiles) {
      const fullPath = path.join(projectRoot, relativeFilePath);
      try {
        log(`Procesando archivo para empaquetar: ${relativeFilePath}`, 'DETAIL');
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
            log(`Omitiendo directorio (verificado por stat): ${relativeFilePath}`, 'DETAIL');
            continue;
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        filesData.push({ fileName: relativeFilePath, content });

        if (concatenate) {
          concatenatedOutput += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
        }
      } catch (fileError: any) {
        log(`No se pudo leer el archivo ${relativeFilePath} (podría ser binario, o error de permisos): ${fileError.message}. Omitiendo.`, 'WARN');
      }
    }

    if (filesData.length === 0) {
      log("No se pudieron recopilar datos de archivos fuente después del procesamiento detallado. Esto podría indicar problemas de permisos o una configuración de ignorados demasiado agresiva.", 'WARN');
      return { success: false, error: "No se pudieron recopilar datos de archivos fuente válidos.", logsBuilt: internalLogs };
    }

    log(`Procesamiento del paquete de código fuente finalizado. Total de archivos procesados y válidos: ${filesData.length}.`, 'INFO');
    return {
      success: true,
      files: filesData,
      concatenatedSource: concatenate ? concatenatedOutput : undefined,
      logsBuilt: internalLogs
    };
  } catch (error: any) {
    let errorMessage = "Error desconocido durante la obtención del paquete de código fuente.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    log(`Error crítico empaquetando el código fuente de la aplicación: ${errorMessage}`, 'ERROR');
    if (error instanceof Error && error.stack) {
      log(`Stack del error crítico: ${error.stack.substring(0,500)}...`, 'ERROR');
    }
    return {
      success: false,
      error: `Falló la obtención del paquete de código fuente: ${errorMessage}`,
      logsBuilt: internalLogs
    };
  }
}
