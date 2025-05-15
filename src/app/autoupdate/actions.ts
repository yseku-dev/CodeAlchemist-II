
'use server';

/**
 * @fileOverview Server Actions for the AutoUpdate feature.
 * This module contains functions that run on the server-side to access
 * the application's source code, and to interact with Git.
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import type { AppSourceFile } from '@/types';
import simpleGit, { type SimpleGitOptions, type SimpleGit } from 'simple-git';
import os from 'os';

/**
 * Patterns for files and directories to ignore when bundling the application source.
 * This helps in excluding unnecessary files like `node_modules`, build artifacts, etc.
 */
const ignorePatterns = [
  'node_modules/**',
  '.next/**',
  '*.zip',
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
  // Binary/image files to exclude from text-based processing
  '*.mp4', '*.mov', '*.webm', '*.webp', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico',
  '*.pdf', '*.doc', '*.docx', '*.xls', '*.xlsx', '*.ppt', '*.pptx',
  '*.woff', '*.woff2', '*.ttf', '*.otf', '*.eot',
  '*.svg', // SVGs can be tricky, sometimes they are code-like, sometimes pure images.
];

/**
 * Retrieves the application's source code files from the server's file system.
 * This Server Action reads files based on glob patterns and ignore lists.
 * @param {boolean} [concatenate=false] - If true, concatenates all file contents into a single string (currently not used by primary client).
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
  concatenate: boolean = false, // Concatenate not primarily used for ZIP, but kept for potential other uses
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
      nodir: true,
      dot: true,
      ignore: ignorePatterns,
      follow: false,
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
      log("No se pudieron recopilar datos de archivos fuente después del procesamiento detallado.", 'WARN');
      return { success: false, error: "No se pudieron recopilar datos de archivos fuente válidos.", logsBuilt: internalLogs };
    }

    log(`Procesamiento del paquete de código fuente finalizado. Total de archivos: ${filesData.length}.`, 'INFO');
    return {
      success: true,
      files: filesData,
      concatenatedSource: concatenate ? concatenatedOutput : undefined,
      logsBuilt: internalLogs
    };
  } catch (error: any) {
    let errorMessage = "Error desconocido durante la obtención del paquete de código fuente.";
    if (error instanceof Error) errorMessage = error.message;
    else if (typeof error === 'string') errorMessage = error;
    log(`Error crítico empaquetando el código fuente: ${errorMessage}`, 'ERROR');
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

/**
 * Configuration for Git upload operations.
 */
interface GitUploadConfig {
    repoUrl: string;
    username: string;
    email: string;
    pat: string;
}

/**
 * Result of a Git upload operation.
 */
interface GitUploadResult {
    success: boolean;
    message: string;
    logs?: string[];
}

/**
 * Handles uploading the current application source bundle to a Git repository.
 * This Server Action clones the repository, copies the current source files,
 * commits, and pushes the changes.
 * @param {GitUploadConfig} gitConfig - Configuration for the Git repository and authentication.
 * @param {string} commitMessage - The message for the Git commit.
 * @param {string[]} [parentExecutionLogs] - Optional array to append logs to.
 * @returns {Promise<GitUploadResult>} The result of the Git upload operation.
 */
export async function handleUploadToGit(
    gitConfig: GitUploadConfig,
    commitMessage: string,
    parentExecutionLogs?: string[]
): Promise<GitUploadResult> {
    const internalLogs: string[] = [];
    const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO') => {
        const timestampedMessage = `[GitUpload ${level} ${new Date().toISOString()}] ${message}`;
        // Log all levels to console for server-side debugging
        if (level === 'ERROR') console.error(timestampedMessage);
        else if (level === 'WARN') console.warn(timestampedMessage);
        else console.log(timestampedMessage);

        internalLogs.push(timestampedMessage);
        if (parentExecutionLogs) parentExecutionLogs.push(timestampedMessage);
    };

    const redactedRepoUrl = gitConfig.repoUrl.replace(/^(https?:\/\/)([^@:]+:[^@]+@)?(.*)$/, '$1$3'); // Basic redaction
    log(`Iniciando subida a Git para el repositorio: ${redactedRepoUrl}. Commit: "${commitMessage}"`, 'INFO');

    if (!gitConfig.repoUrl || !gitConfig.username || !gitConfig.email || !gitConfig.pat) {
        const errMsg = "Configuración de Git incompleta. Se requieren URL, nombre de usuario, email y PAT.";
        log(errMsg, 'ERROR');
        return { success: false, message: errMsg, logs: internalLogs };
    }

    let tempRepoPath: string | undefined;
    const defaultBranch = 'main'; // Or detect default branch dynamically if needed

    try {
        log("Paso 1: Obteniendo el paquete de código fuente más reciente...", 'INFO');
        const sourceBundle = await getApplicationSourceBundle(false, internalLogs); // Get individual files
        if (!sourceBundle.success || !sourceBundle.files || sourceBundle.files.length === 0) {
            const errorMsg = sourceBundle.error || "No se pudo obtener el código fuente para subir a Git.";
            log(errorMsg, 'ERROR');
            return { success: false, message: errorMsg, logs: internalLogs };
        }
        log(`Paquete de código fuente obtenido con ${sourceBundle.files.length} archivos.`, 'INFO');

        log("Paso 2: Creando un directorio temporal para el repositorio...", 'DETAIL');
        tempRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codealchemist-gitsync-'));
        log(`Directorio temporal creado: ${tempRepoPath}`, 'INFO');

        const gitOptions: Partial<SimpleGitOptions> = {
            baseDir: tempRepoPath,
            binary: 'git',
            maxConcurrentProcesses: 1,
        };
        const git: SimpleGit = simpleGit(gitOptions);

        log("Paso 3: Inicializando repositorio Git...", 'INFO');
        await git.init();
        log("Repositorio Git inicializado.", 'INFO');

        log(`Paso 3.1: Asegurando que la rama local sea '${defaultBranch}'...`, 'INFO');
        // Attempt to switch to the branch; if it doesn't exist, it will be created on first commit to it.
        // If the repo is new, `checkoutLocalBranch` might fail.
        try {
            await git.checkoutLocalBranch(defaultBranch);
            log(`Rama local '${defaultBranch}' creada o ya existente y activada.`, 'INFO');
        } catch (branchError: any) {
             if (branchError.message && (branchError.message.includes('already exists') || branchError.message.includes('is not a commit'))) {
                log(`La rama '${defaultBranch}' ya existe o el repo está vacío. Intentando checkout simple.`, 'DETAIL');
                try {
                    await git.checkout(defaultBranch);
                    log(`Cambiado a rama existente '${defaultBranch}'.`, 'INFO');
                } catch (checkoutError: any) {
                    log(`Error al hacer checkout a la rama '${defaultBranch}', se creará en el primer commit si no existe: ${checkoutError.message}`, 'WARN');
                }
            } else {
                log(`Error inesperado al gestionar la rama '${defaultBranch}': ${branchError.message}`, 'ERROR');
                throw branchError;
            }
        }


        log("Paso 4: Configurando usuario y email de Git...", 'INFO');
        await git.addConfig('user.name', gitConfig.username, undefined, 'local');
        await git.addConfig('user.email', gitConfig.email, undefined, 'local');
        log(`Usuario Git configurado como "${gitConfig.username}" <${gitConfig.email}>`, 'INFO');

        log(`Paso 5: Limpiando directorio de trabajo (excepto .git) y copiando ${sourceBundle.files.length} archivos...`, 'DETAIL');
        const itemsInRepo = await fs.readdir(tempRepoPath);
        for (const item of itemsInRepo) {
            if (item !== '.git') {
                await fs.rm(path.join(tempRepoPath, item), { recursive: true, force: true });
            }
        }
        log("Directorio de trabajo limpio.", 'DETAIL');

        for (const file of sourceBundle.files) {
           const filePath = path.join(tempRepoPath, file.fileName);
           const dirForFile = path.dirname(filePath);
           try {
               await fs.mkdir(dirForFile, { recursive: true });
               await fs.writeFile(filePath, file.content, 'utf-8');
           } catch(writeError: any) {
               log(`Error al escribir el archivo ${file.fileName} en el repositorio temporal: ${writeError.message}`, 'WARN');
           }
        }
        log("Archivos nuevos/actualizados copiados al repositorio temporal.", 'INFO');

        log("Paso 6: Añadiendo todos los archivos al staging de Git...", 'INFO');
        await git.add('./*');
        log("Archivos añadidos al staging.", 'INFO');

        log(`Paso 7: Realizando commit con mensaje: "${commitMessage}"`, 'INFO');
        const commitResult = await git.commit(commitMessage);

        if (!commitResult.commit && commitResult.summary.changes === 0) {
             log("No hay cambios para hacer commit. La subida a Git se considera exitosa sin push.", 'WARN');
             return { success: true, message: "No se detectaron cambios en el código fuente para subir a Git.", logs: internalLogs };
        }
        log(`Commit realizado. SHA: ${commitResult.commit || 'N/A'}. Resumen: ${commitResult.summary.changes} cambios.`, 'INFO');

        log("Paso 8: Configurando repositorio remoto 'origin'...", 'INFO');
        const authenticatedRepoUrl = gitConfig.repoUrl.replace("https://", `https://${encodeURIComponent(gitConfig.username)}:${encodeURIComponent(gitConfig.pat)}@`);

        const remotes = await git.getRemotes(true);
        if (remotes.find(r => r.name === 'origin')) {
            await git.remote(['set-url', 'origin', authenticatedRepoUrl]);
            log(`URL del remoto 'origin' actualizada.`, 'INFO');
        } else {
            await git.addRemote('origin', authenticatedRepoUrl);
            log(`Remoto 'origin' añadido.`, 'INFO');
        }
        log(`Repositorio remoto 'origin' configurado para ${redactedRepoUrl}`, 'INFO');

        log(`Paso 9: Realizando push a la rama remota '${defaultBranch}'...`, 'INFO');
        await git.push(['-u', 'origin', defaultBranch, '--force']); // Use --force cautiously
        log(`Push a la rama '${defaultBranch}' completado.`, 'INFO');

        const successMsg = `Subida a Git completada exitosamente al repositorio ${redactedRepoUrl}.`;
        log(successMsg, 'INFO');
        return { success: true, message: successMsg, logs: internalLogs };

    } catch (error: any) {
        let errorMsg = "Error desconocido durante la subida a Git.";
        let errorDetails = error instanceof Error ? error.stack || "" : '';

        if (error.message) {
             errorMsg = error.message;
             if (error.message.includes("Authentication failed")) {
                 errorMsg = "Falló la autenticación Git. Verifica tu nombre de usuario y PAT.";
             } else if (error.message.includes("repository not found")) {
                 errorMsg = "Repositorio Git no encontrado. Verifica la URL.";
             } else if (error.message.includes("src refspec") && error.message.includes("does not match any")) {
                 errorMsg = `La rama local '${defaultBranch}' no existe o no coincide con ninguna rama remota. Asegúrate de que la rama '${defaultBranch}' exista en el remoto o que el primer push pueda crearla.`;
             } else if (error.message.includes("could not read Username")) {
                  errorMsg = "Falló la autenticación Git (no se pudo leer el nombre de usuario). Verifica tu PAT y permisos.";
             }
        }
        log(`Error crítico durante la subida a Git: ${errorMsg}`, 'ERROR');
        if (errorDetails) log(`Stack/Detalles del error de Git: ${errorDetails}`, 'ERROR');

        return { success: false, message: `Falló la subida a Git: ${errorMsg}`, logs: internalLogs };
    } finally {
        if (tempRepoPath) {
            log(`Paso 10: Limpiando directorio temporal ${tempRepoPath}...`, 'INFO');
            try {
                await fs.rm(tempRepoPath, { recursive: true, force: true });
                log("Directorio temporal eliminado.", 'INFO');
            } catch (cleanupError: any) {
                log(`Error al limpiar el directorio temporal ${tempRepoPath}: ${cleanupError.message}`, 'ERROR');
            }
        }
    }
}
