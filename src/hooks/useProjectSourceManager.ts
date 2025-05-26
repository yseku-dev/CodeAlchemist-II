
// src/hooks/useProjectSourceManager.ts
"use client";

import { useState, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useToast } from './use-toast';
import { useI18n } from '@/context/I18nContext';
import { useDebug } from '@/context/DebugContext';
import type { AppSourceFile } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import JSZip from 'jszip';
import { fetchRemoteGitRepository, getApplicationSourceBundle } from '@/app/autoupdate/actions';

export type ProjectSourceType = "upload" | "git" | "local";

const textFileExtensions: string[] = [
  '.mq5', '.mqh', '.mq4', '.ex5', '.ex4', '.js', '.jsx', '.ts', '.tsx', '.py',
  '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.php', '.rb', '.rs',
  '.swift', '.kt', '.kts', '.lua', '.pl', '.dart', '.ex', '.exs', '.scala',
  '.clj', '.groovy', '.hs', '.erl', '.vb', '.xaml', '.r', '.html', '.htm',
  '.css', '.scss', '.less', '.vue', '.svelte', '.json', '.xml', '.yaml',
  '.yml', '.ini', '.cfg', '.toml', '.env', '.properties', '.conf', '.config',
  '.sh', '.bash', '.bat', '.ps1', '.sql', '.ddl', '.dml', '.graphql', '.md',
  '.txt', '.text', '.rtf', '.log', '.tex', '.rst', '.asciidoc', 'makefile',
  'dockerfile', '.dockerignore', 'gemfile', 'procfile', '.npmrc', '.editorconfig',
  '.csproj', '.sln', '.vbproj', '.vcproj', '.gradle', '.sbt', '.mod', '.tf',
  '.hcl', '.gitignore', '.gitattributes', '.gitmodules', '.glsl', '.hlsl',
  '.metal', '.wgsl', '.csv', '.tsv', '.ics', '.vcf',
];
const ignorePatternsSimple: string[] = [
  'node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/',
  '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local',
  '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/',
  'venv/', '.venv/', 'target/', // Added target for Java/Maven/Rust
  '*.class', '*.jar', '*.war', '*.ear', // Java compiled
  '*.o', '*.a', '*.so', '*.dll', '*.exe', // C/C++ compiled
  '*.pyc', '*.egg-info/', // Python compiled/metadata
];
const binaryExtensions: string[] = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls',
  '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar',
  '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img',
  '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm',
];

interface UseProjectSourceManagerReturn {
  projectSourceType: ProjectSourceType;
  setProjectSourceType: (value: ProjectSourceType) => void;
  uploadedFile: File | null;
  uploadedFileName: string | null;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>,
                     onProcessingDone: (files: AppSourceFile[] | null, error?: string) => void
                    ) => Promise<void>;
  gitUrl: string;
  setGitUrl: (value: string) => void;
  originalProjectFiles: AppSourceFile[] | null;
  setOriginalProjectFiles: (files: AppSourceFile[] | null) => void;
  isLoadingSource: boolean;
  prepareProjectSourceForAnalysis: () => Promise<{
    projectContentStringForAI: string | undefined;
    sourceCodeLocation: "UploadedString" | "Git" | "Local";
    sourceName: string;
    error?: string;
  }>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

/**
 * Custom hook to manage the state and logic for selecting and processing project sources
 * (upload, Git, local) for analysis or refactoring.
 * @param localStoragePrefix - A prefix for localStorage keys to ensure uniqueness per page/feature.
 * @param initialSourceType - The initial source type to default to.
 * @returns {UseProjectSourceManagerReturn} An object containing states and handlers.
 */
export function useProjectSourceManager(
  localStoragePrefix: string,
  initialSourceType: ProjectSourceType = "upload"
): UseProjectSourceManagerReturn {
  const { t } = useI18n();
  const { toast } = useToast();
  const { addLog: addDebugLog } = useDebug();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projectSourceType, setProjectSourceTypeState] = useLocalStorage<ProjectSourceType>(`${localStoragePrefix}-projectSourceType`, initialSourceType);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useLocalStorage<string | null>(`${localStoragePrefix}-uploadedFileName`, null);
  const [gitUrl, setGitUrl] = useLocalStorage<string>(`${localStoragePrefix}-gitUrl`, '');
  const [originalProjectFiles, setOriginalProjectFiles] = useLocalStorage<AppSourceFile[] | null>(`${localStoragePrefix}-originalProjectFiles`, null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);

  const _processUploadedZipForAnalysis = useCallback(async (file: File): Promise<{ files?: AppSourceFile[]; error?: string }> => {
    addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}`, type: 'INFO', message: `Procesando ZIP subido: ${file.name}` });
    setIsLoadingSource(true);
    try {
      const jszip = new JSZip();
      const zip = await jszip.loadAsync(file);
      const extractedFiles: AppSourceFile[] = [];
      const fileProcessingPromises: Promise<void>[] = [];

      zip.forEach((relativePath, fileEntry) => {
        const entryNameLower = fileEntry.name.toLowerCase();
        const isIgnoredByPattern = ignorePatternsSimple.some(pattern => entryNameLower.includes(pattern.replace('**', '')));
        const extension = (entryNameLower.includes('.') ? '.' + entryNameLower.split('.').pop() : '');
        const isBinaryByExtension = binaryExtensions.some(ext => entryNameLower.endsWith(ext));
        const isAllowedTextByExtension = textFileExtensions.includes(extension) || (!entryNameLower.includes('.') && !isBinaryByExtension && !entryNameLower.endsWith('/'));
        
        addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}:ZIP_Detail`, type: 'DEBUG', message: `ZIP Entry: ${relativePath}, IsDir: ${fileEntry.dir}, IgnoredByPattern: ${isIgnoredByPattern}, IsBinary: ${isBinaryByExtension}, IsAllowedText: ${isAllowedTextByExtension}` });

        if (!fileEntry.dir && !isIgnoredByPattern && isAllowedTextByExtension && !isBinaryByExtension) {
          fileProcessingPromises.push(
            fileEntry.async("string").then(content => {
              extractedFiles.push({ fileName: relativePath, content });
            }).catch(err => {
              addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}:ZIP_Detail`, type: 'WARN', message: `No se pudo leer ${relativePath} como texto: ${(err as Error).message}`});
            })
          );
        } else {
            addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}:ZIP_Detail`, type: 'DEBUG', message: `Omitido del ZIP (directorio, ignorado, binario, o no permitido texto): ${relativePath}`});
        }
      });
      await Promise.all(fileProcessingPromises);
      if (extractedFiles.length === 0) {
        const errorMsg = t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, { fileName: file.name });
        addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}`, type: 'ERROR', message: errorMsg });
        return { error: errorMsg };
      }
      addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}`, type: 'INFO', message: `${extractedFiles.length} archivos extraídos del ZIP.` });
      return { files: extractedFiles };
    } catch (zipError: any) {
      const errorMsg = t('analyzeProject.toast.zipReadError.description' as TranslationKey, { error: zipError.message });
      addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}`, type: 'ERROR', message: `Error procesando ZIP: ${zipError.message}`, errorDetails: zipError });
      return { error: errorMsg };
    } finally {
      setIsLoadingSource(false);
    }
  }, [t, addDebugLog, localStoragePrefix]);

  const handleFileChange = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    onProcessingDone: (files: AppSourceFile[] | null, error?: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileNameLower = file.name.toLowerCase();
      const isZip = fileNameLower.endsWith('.zip');
      const isJson = fileNameLower.endsWith('.json');
      const isValidSize = file.size <= 25 * 1024 * 1024; // 25MB

      setUploadedFile(file);
      setUploadedFileName(file.name);
      setOriginalProjectFiles(null);

      if (!isValidSize) {
        const errorMsg = t('analyzeProject.toast.invalidFile.description' as TranslationKey); // Assuming this key covers size too
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: errorMsg });
        onProcessingDone(null, errorMsg);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setUploadedFile(null); 
        setUploadedFileName(null);
        return;
      }

      if (isZip) {
        toast({ title: t('analyzeProject.toast.zipUpload.processing' as TranslationKey) });
        const zipResult = await _processUploadedZipForAnalysis(file);
        setOriginalProjectFiles(zipResult.files || null);
        onProcessingDone(zipResult.files || null, zipResult.error);
        if (zipResult.error) {
          toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: zipResult.error });
        } else if (zipResult.files) {
          toast({ title: t('analyzeProject.toast.zipProcessed.title' as TranslationKey), description: t('analyzeProject.toast.zipProcessed.description' as TranslationKey, { count: zipResult.files.length })});
        }
      } else if (isJson) {
        try {
          const jsonContent = await file.text();
          const pseudoFile: AppSourceFile = { fileName: file.name, content: jsonContent };
          setOriginalProjectFiles([pseudoFile]);
          onProcessingDone([pseudoFile]);
          toast({ title: t('analyzeProject.toast.jsonProcessed.title' as TranslationKey), description: t('analyzeProject.toast.jsonProcessed.description' as TranslationKey, { name: file.name}) });
        } catch (readError: any) {
            const errorMsg = t('analyzeProject.toast.readError.description' as TranslationKey, { error: readError.message });
            toast({ variant: "destructive", title: t('analyzeProject.toast.readError.title' as TranslationKey), description: errorMsg });
            onProcessingDone(null, errorMsg);
        }
      } else {
        const errorMsg = t('analyzeProject.toast.invalidFile.description' as TranslationKey);
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: errorMsg });
        onProcessingDone(null, errorMsg);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [setUploadedFile, setUploadedFileName, setOriginalProjectFiles, toast, t, _processUploadedZipForAnalysis]);

  const setProjectSourceType = useCallback((value: ProjectSourceType) => {
    setProjectSourceTypeState(value);
    if (value !== 'upload') {
      setUploadedFile(null);
    }
    // No limpiar originalProjectFiles aquí para permitir cambiar entre Git/Local y mantener los archivos cargados
  }, [setProjectSourceTypeState, setUploadedFile]);

  const prepareProjectSourceForAnalysis = useCallback(async (): Promise<{
    projectContentStringForAI: string | undefined;
    sourceCodeLocation: "UploadedString" | "Git" | "Local";
    sourceName: string;
    error?: string;
  }> => {
    setIsLoadingSource(true);
    let projectContentStringForAI: string | undefined;
    let sourceName = '';
    let filesForAnalysis: AppSourceFile[] | null = null;
    let errorMsg: string | undefined;
    let serverLogs: string[] = [];

    if (projectSourceType === "upload") {
      if (originalProjectFiles) {
        filesForAnalysis = originalProjectFiles;
        sourceName = uploadedFileName || "archivo_subido_procesado";
      } else if (uploadedFile) { // Si hay un archivo subido pero no se procesó aún
        const processResult = await _processUploadedZipForAnalysis(uploadedFile);
        if (processResult.files) {
          filesForAnalysis = processResult.files;
          setOriginalProjectFiles(filesForAnalysis); // Guardar los procesados
        } else {
          errorMsg = processResult.error || t('analyzeProject.toast.fileReadError.title' as TranslationKey);
        }
        sourceName = uploadedFile.name;
      } else {
        errorMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
      }
    } else if (projectSourceType === "git" && gitUrl) {
      sourceName = gitUrl;
      addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}`, type: 'INFO', message: `Obteniendo de Git: ${gitUrl}` });
      const gitResult = await fetchRemoteGitRepository(gitUrl);
      serverLogs = gitResult.logsBuilt || [];
      if (gitResult.success && gitResult.files) {
        filesForAnalysis = gitResult.files;
        setOriginalProjectFiles(filesForAnalysis);
      } else {
        errorMsg = gitResult.error || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey);
      }
    } else if (projectSourceType === "local") {
      sourceName = t('analyzeProject.sourceLocal' as TranslationKey);
      addDebugLog({ source: `useProjectSourceManager:${localStoragePrefix}`, type: 'INFO', message: `Obteniendo código local...` });
      const bundleResult = await getApplicationSourceBundle(false);
      serverLogs = bundleResult.logsBuilt || [];
      if (bundleResult.success && bundleResult.files) {
        filesForAnalysis = bundleResult.files;
        setOriginalProjectFiles(filesForAnalysis);
      } else {
        errorMsg = bundleResult.error || t('analyzeProject.toast.localSourceError.description' as TranslationKey, {error: 'Error desconocido'});
      }
    } else {
      errorMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
    }

    if (filesForAnalysis && filesForAnalysis.length > 0) {
      projectContentStringForAI = filesForAnalysis
        .map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`)
        .join('\n\n');
    } else if (!errorMsg) {
        errorMsg = t('analyzeProject.toast.noContentToAnalyze.description' as TranslationKey);
    }
    
    serverLogs.forEach(log => addDebugLog({source: 'SERVER_ACTION_LOG', type: 'INFO', message: log}));

    setIsLoadingSource(false);
    return {
      projectContentStringForAI,
      sourceCodeLocation: projectSourceType === 'git' ? "Git" : projectSourceType === 'local' ? "Local" : "UploadedString",
      sourceName,
      error: errorMsg,
    };
  }, [
    projectSourceType, gitUrl, uploadedFile, originalProjectFiles, uploadedFileName,
    t, addDebugLog, _processUploadedZipForAnalysis, setOriginalProjectFiles, localStoragePrefix
  ]);

  return {
    projectSourceType,
    setProjectSourceType,
    uploadedFile,
    uploadedFileName,
    handleFileChange,
    gitUrl,
    setGitUrl,
    originalProjectFiles,
    setOriginalProjectFiles,
    isLoadingSource,
    prepareProjectSourceForAnalysis,
    fileInputRef,
  };
}
