
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA.

**Idioma del Proyecto:** Todo el proyecto, incluyendo la interfaz de usuario, los mensajes, los comentarios en el código (donde aplique semánticamente) y la documentación (como este README), está desarrollado y presentado en **castellano**. La aplicación soporta internacionalización (i18n) con inglés como segundo idioma.

**Operatividad:** Todas las funcionalidades descritas en este documento son completamente operativas y no incluyen procedimientos simulados o experimentales donde se indique que la funcionalidad es real. Las acciones que implican modificación de código (sugeridas por la IA y aplicadas por el usuario) o interacción con sistemas externos (como APIs de LLMs o Git) se ejecutan de forma real según la configuración y permisos otorgados. Las limitaciones inherentes a un entorno de navegador (como la modificación directa de archivos del sistema) se indican cuando son relevantes.

## 1. Información General del Proyecto

*   **Nombre del Proyecto:** CodeAlchemist
*   **Propósito:** Optimizar y agilizar el ciclo de vida del desarrollo de software mediante asistencia de IA.
*   **Tecnologías Utilizadas:**
    *   **Framework Frontend:** Next.js (con App Router)
    *   **Biblioteca UI:** React
    *   **Lenguaje:** TypeScript
    *   **Componentes UI:** ShadCN UI (sobre Radix UI y Tailwind CSS)
    *   **CSS:** Tailwind CSS
    *   **IA/LLM Framework:** Genkit (de Google)
    *   **Iconos:** Lucide Icons (`lucide-react`)
    *   **Gestión de Estado (Cliente):** React Context (`AppStateContext`, `DebugContext`, `I18nContext`) con `useLocalStorage` para persistencia.
    *   **Formateo y Linting:** ESLint y Prettier
    *   **Empaquetado (Cliente-Side ZIP):** JSZip
    *   **Interacción Git (Servidor):** `simple-git` (usado en Server Actions)
    *   **Acceso a Archivos (Servidor):** Módulos `fs`, `path`, `glob` de Node.js (usado en Server Actions)
*   **Arquitectura del Proyecto:**
    *   **Frontend:** Aplicación Next.js que se ejecuta en el navegador del cliente. Gestiona toda la interfaz de usuario y la lógica de presentación. Los componentes residen en `src/components/` y las páginas en `src/app/`.
    *   **Backend (Lógica de IA y Acciones del Servidor):**
        *   **Flujos Genkit:** Definidos en `src/ai/flows/`, se ejecutan en el entorno del servidor de Next.js (o en un entorno Node.js separado si se despliega así Genkit). Manejan todas las interacciones con los modelos de lenguaje grandes (LLMs) para generación de código, análisis, etc. Se utiliza el objeto global `ai` de Genkit (definido en `src/ai/genkit.ts`) para registrar prompts y flujos.
        *   **Server Actions de Next.js:** Funciones definidas en archivos como `src/app/autoupdate/actions.ts` (con la directiva `"use server";`) que se ejecutan en el servidor. Se utilizan para operaciones que requieren acceso al sistema de archivos del servidor (ej. `getApplicationSourceBundle`) o para interactuar con herramientas del lado del servidor como `simple-git` o el SDK de `groq-sdk`.
    *   **APIs Externas:** Principalmente las APIs de los proveedores de LLM (Groq, Google AI Studio/Vertex AI, OpenAI, Anthropic, etc.) configuradas por el usuario en la sección "Configuración".
    *   **Servicios Externos:** Potencialmente repositorios Git (GitHub, GitLab, etc.) para clonar o subir código a través de las Server Actions.
    *   **Bases de Datos:** No utiliza una base de datos backend tradicional para su lógica principal. El estado de la aplicación (configuraciones, agentes, grupos, snapshots) se persiste en el `localStorage` del navegador del usuario.
*   **Requisitos Previos:**
    *   Node.js (versión recomendada: 18.x o superior)
    *   npm (o yarn)
    *   Git (para clonar el proyecto y para la funcionalidad de "Subir a Git")
    *   Un navegador web moderno (Chrome, Firefox, Edge, Safari).
    *   Claves API para los proveedores de LLM que se deseen utilizar (ej. `GOOGLE_API_KEY` para Genkit con Google AI en el archivo `.env.local`, o claves para Groq, OpenAI, etc., que se configuran en la UI).

## 2. Funcionalidades y Características

CodeAlchemist ofrece un conjunto robusto de características diseñadas para asistir en diversas etapas del desarrollo de software:

### 2.1. Panel de Control (`/`)
*   **Propósito:** Página de bienvenida, accesos directos a funcionalidades.
*   **Estructura:** Componente `src/app/page.tsx`.
    *   Utiliza `PageSectionHeader` (sin icono) para el título principal y descripción.
    *   **Cabecera Principal:**
        *   Icono `FlaskConical` (`h-24 w-24 mx-auto text-primary mb-4`).
        *   Título: `t('dashboard.welcome')` (h1, `text-4xl md:text-5xl font-bold mb-3`). Ejemplo: "Bienvenido a CodeAlchemist".
        *   Descripción: `t('dashboard.description')` (p, `text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto`). Ejemplo: "Tu plataforma de desarrollo asistido por IA...".
    *   **Sección "Características Principales":**
        *   Título: `t('dashboard.features.title')` (h2, `text-3xl font-semibold mb-8 text-center`).
        *   Grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`).
        *   Cada característica es un `Link` que envuelve un `Card` (con `as="a"`). Las tarjetas tienen efecto `hover:shadow-lg transform hover:-translate-y-1`.
        *   Estructura de cada `Card` de característica:
            *   `CardHeader`: Icono de la característica (`h-10 w-10 text-accent`), `CardTitle` (`text-xl md:text-2xl`, ej. `t('dashboard.features.generateCode.title')`).
            *   `CardContent`: Descripción de la característica (`text-sm text-muted-foreground`, ej. `t('dashboard.features.generateCode.description')`).
    *   **Sección "Guía Rápida de Inicio":**
        *   `Card` con `CardHeader` (`CardTitle`: `t('dashboard.quickstart.title')`, `CardDescription`: `t('dashboard.quickstart.description')`).
        *   `CardContent`: Lista ordenada (`ol list-decimal list-inside`) de pasos. Cada paso es un `li` con un `Link` (texto `t('dashboard.quickstart.stepX.link')`) y texto adicional (`t('dashboard.quickstart.stepX.text')`).
        *   Botón: `Link` a `/configuracion` con un `Button` (size `lg`, `bg-primary hover:bg-primary/90 text-primary-foreground`). Icono `SettingsIcon`, texto `t('dashboard.quickstart.ctaButton')`.
*   **Dependencias:** `Link`, `Card`, `Button`, `FlaskConical`, iconos de Lucide, `useI18n`.

### 2.2. Generación de Código (`/generar-codigo`)
*   **Propósito:** Crear fragmentos de código desde descripciones en lenguaje natural.
*   **Estructura:** Componente `src/app/generar-codigo/page.tsx`.
    *   `PageSectionHeader`: Icono `CodeXml`, título `t('generateCode.title')`, descripción `t('generateCode.description')`.
    *   `CardContent` (`space-y-6`):
        *   `LLMConfigSelector`: Prop `value={llmConfigSource}`, `onChange={setLlmConfigSource}`, `label={t('common.llmSourceLabel')}`.
        *   `Label` para `description`: `t('generateCode.describeNeedLabel')`.
        *   `Textarea` (id `description`): `value={description}`, `onChange`, `placeholder={t('generateCode.describeNeedPlaceholder')}`, `rows={5}`.
        *   `Button` (principal, `w-full`): Icono `Loader2` (si `isLoading`), texto `t('generateCode.generateButton')`. Acción: `handleGenerateClick`.
        *   `ErrorDisplay`: Si `error` existe.
        *   **Resultados (si `result` existe):**
            *   Título: `t('generateCode.results.explanationLabel')` (h3 `font-semibold text-lg`). Párrafo con `result.explanation`.
            *   Título: `t('generateCode.results.codeSnippetLabel')` (h3 `font-semibold text-lg`).
            *   `CodeBlock`: Muestra `result.code`.
            *   `LogsDisplay`: Si `result.groupLog` existe, título `t('generateCode.results.groupLogTitle')`.
*   **Interacciones:**
    *   `handleGenerateClick`: Valida `description`. Si es válido, abre `ConfirmDialog`.
    *   `ConfirmDialog`:
        *   Título: `t('generateCode.confirmDialog.title')`.
        *   Contenido: Muestra la fuente LLM (`llmConfigSource`) y el `description` (prompt) en un `ScrollArea`.
        *   Acción `onConfirm`: Llama a `handleSubmit`.
    *   `handleSubmit`:
        *   Establece `isLoading=true`.
        *   Prepara `agentSystemPrompt` si se seleccionó Agente/Grupo.
        *   Llama a `callGenerateCodeFromDescription` (de `apiClient.ts`) con `description` y `agentSystemPrompt`.
        *   Muestra resultados o errores (con `toast`).
*   **Dependencias:** `Card`, `Label`, `Textarea`, `Button`, `Loader2`, `CodeXml`, `LLMConfigSelector`, `CodeBlock`, `ConfirmDialog`, `ErrorDisplay`, `LogsDisplay`, `ScrollArea`, `useI18n`, `apiClient.ts`.

### 2.3. Generación de Proyectos (`/generar-proyecto`)
*   **Propósito:** Crear una estructura base para nuevos proyectos.
*   **Estructura:** Componente `src/app/generar-proyecto/page.tsx`.
    *   `PageSectionHeader`: Icono `FolderPlus`, título `t('generateProject.title')`, descripción `t('generateProject.description')`.
    *   `CardContent` (`space-y-6`):
        *   `LLMConfigSelector`: Similar a Generar Código.
        *   `Label` para `description`: `t('generateProject.describeProjectLabel')`.
        *   `Textarea` (id `description`): `value={description}`, `onChange`, `placeholder={t('generateProject.describeProjectPlaceholder')}`, `rows={8}`.
        *   `Button` (principal, `w-full`): Icono `Loader2` (si `isLoading`), texto `t('generateProject.generateButton')`. Acción: `handleGenerateClick`.
        *   `ErrorDisplay`: Si `error` existe.
        *   **Resultados (si `result` existe):**
            *   Título: `t('generateProject.results.suggestedNameLabel')` (h3 `font-semibold text-xl`). Párrafo con `result.projectName`.
            *   Título: `t('generateProject.results.aiNotesLabel')` (h3 `font-semibold text-lg`). Párrafo con `result.aiNotes`.
            *   Título: `t('generateProject.results.generatedFilesLabel')` (h3 `font-semibold text-lg`).
            *   `FileTreeDisplay`: Muestra `result.files`.
            *   `Button` (outline): Icono `Download`, texto `t('generateProject.results.downloadButton')`. Acción: `handleDownloadProject`. Nota debajo: `t('generateProject.results.downloadNote')` (aclarando que es JSON).
            *   `LogsDisplay`: Si `result.groupLog` existe, título `t('generateProject.results.groupLogTitle')`.
*   **Interacciones:**
    *   `handleGenerateClick`: Valida `description`. Abre `ConfirmDialog`.
    *   `ConfirmDialog`:
        *   Título: `t('generateProject.confirmDialog.title')`.
        *   Contenido: Muestra `description` actual. `Label` `t('generateProject.confirmDialog.redefinePromptLabel')` con `Textarea` para `currentPromptForDialog`. Info de LLM config.
        *   Acción `onConfirm`: Llama a `handleProjectGeneration(currentPromptForDialog)`.
    *   `handleProjectGeneration`:
        *   Establece `isLoading=true`.
        *   Prepara `agentSystemPrompt`.
        *   Llama a `callGenerateProjectStructure` (de `apiClient.ts`) con `finalPrompt` y `agentSystemPrompt`.
        *   Muestra resultados o errores.
    *   `handleDownloadProject`:
        *   Crea un `JSZip` instance.
        *   Añade archivos y carpetas de `result.files` al ZIP.
        *   Genera el `zipBlob` y lo descarga como `<projectName>.zip`.
*   **Dependencias:** `Card`, `Label`, `Textarea`, `Button`, `Loader2`, `Download`, `FolderPlus`, `LLMConfigSelector`, `ConfirmDialog`, `ErrorDisplay`, `FileTreeDisplay`, `LogsDisplay`, `ScrollArea`, `JSZip`, `useI18n`, `apiClient.ts`.

### 2.4. Refactorizar Proyecto (`/refactorizar-proyecto`)
*   **Propósito:** Analizar un proyecto existente para obtener sugerencias de refactorización.
*   **Estructura:** Componente `src/app/refactorizar-proyecto/page.tsx`. Layout de dos columnas en `lg`.
    *   **Columna 1 (Configuración):** `Card` con `PageSectionHeader` (Icono `GitPullRequestDraft`, título `t('refactorProject.title')`, descripción `t('refactorProject.description')`).
        *   `CardContent` (`space-y-6`):
            *   `LLMConfigSelector`.
            *   `Label`: `t('refactorProject.projectSourceLabel')`. `Select` para `projectSourceType` ("upload", "git") con opciones `t('refactorProject.sourceUpload')` y `t('refactorProject.sourceGit')`.
            *   Si "upload": `Label` `t('refactorProject.uploadLabel')`, `Input` (type `file`, id `file-upload`).
            *   Si "git": `Label` `t('refactorProject.gitUrlLabel')`, `Input` (id `git-url`, placeholder `t('refactorProject.gitUrlPlaceholder')`).
            *   `Separator`.
            *   `Label`: `t('refactorProject.paramsLabel')`.
            *   `Label` `t('refactorProject.goalsLabel')`, `Textarea` (id `refactor-goals`, placeholder `t('refactorProject.goalsPlaceholder')`).
            *   `Label` `t('refactorProject.priorityLabel')`, `Select` (id `general-priority`, placeholder `t('refactorProject.priorityPlaceholder')`). Opciones: `t('refactorProject.priorityNone')` y `GENERAL_PRIORITIES`.
            *   `Label` `t('refactorProject.depthLabel')`, `Input` (id `search-depth`, type `number`, placeholder `t('refactorProject.depthPlaceholder')`).
            *   `Label` `t('refactorProject.focusLabel')`, `Input` (id `focus-area`, placeholder `t('refactorProject.focusPlaceholder')`).
            *   `Button` (principal, `w-full`): Icono `Loader2` (si `isLoading`), texto `t('refactorProject.analyzeButton')`. Acción: `handleAnalyze`.
    *   **Columna 2 (Resultados):** `Card` con `PageSectionHeader` (Icono `ListChecks`, título `t('refactorProject.results.title')`, `actions`: `Button` "Marcar Todas como Aplicadas").
        *   `CardContent`:
            *   `ErrorDisplay` si `error`.
            *   Mensaje de carga o "Aún no hay sugerencias".
            *   Si `analysisResult`:
                *   `Card` para `analysisResult.projectOverview`.
                *   `Separator`.
                *   Título `t('refactorProject.results.suggestionsTitle')`.
                *   `ScrollArea` con lista de `Card` por sugerencia. Cada `Card` de sugerencia:
                    *   `CardHeader`: `CardTitle` (`s.area`), `CardDescription` (`t('refactorProject.suggestion.priorityLabel')` y `s.priority` con color condicional), Icono de estado (`BadgeHelp`, `BadgeCheck`, `BadgeX`).
                    *   `CardContent`: `s.description`. Si `s.snippetSuggested`, muestra info del snippet.
                    *   `CardFooter`: Botones "Ver Diff", "Descartar", "Marcar como Aplicada" / "Revertir Estado".
                *   `LogsDisplay` si `analysisResult.groupLog`.
*   **Interacciones:**
    *   `handleAnalyze`: Prepara `RefactorProjectWithAIInput`, llama a `callRefactorProjectWithAI`.
    *   `handleApplySuggestion`, `handleViewDiff`, `handleDiscardSuggestion`, `handleApplyAll`: Modifican estado `suggestions`.
    *   `ConfirmDialog` (para "Ver Diff"): Título `t('refactorProject.diffModal.title')`. Muestra `CodeBlock` para original y sugerido.
*   **Dependencias:** `Card`, `Label`, `Input`, `Textarea`, `Button`, `Select`, `Loader2`, `GitPullRequestDraft`, `ListChecks`, etc., `LLMConfigSelector`, `ErrorDisplay`, `ScrollArea`, `CodeBlock`, `ConfirmDialog`, `LogsDisplay`, `Separator`, `useI18n`, `apiClient.ts`.

### 2.5. Análisis de Código Inteligente (`/analizar-codigo`)
*   **Propósito:** Análisis detallado para fragmentos o archivos.
*   **Estructura:** Componente `src/app/analizar-codigo/page.tsx`.
    *   `PageSectionHeader`: Icono `ScanLine`, título `t('analyzeCode.title')`, descripción `t('analyzeCode.description')`.
    *   `CardContent` (`space-y-6`):
        *   `LLMConfigSelector`.
        *   Div (`border rounded-md`):
            *   `Label`: `t('analyzeCode.codeSourceLabel')`.
            *   `Label` `t('analyzeCode.uploadFileLabel')`, `Input` (type `file`, id `file-upload-code`).
            *   `Label` `t('analyzeCode.gitFileUrlLabel')`, `Input` (id `git-file-url`, placeholder `t('analyzeCode.gitFileUrlPlaceholder')`). `Button` `t('analyzeCode.fetchUrlButton')`.
            *   Instrucción `t('analyzeCode.pasteCodeInstruction')`.
            *   `CodeEditor` (id `analizar-codigo-main`, placeholder `t('analyzeCode.pasteCodePlaceholder')`).
            *   `Label` `t('analyzeCode.additionalInstructionsLabel')`, `Textarea` (id `user-analysis-prompt`, placeholder `t('analyzeCode.additionalInstructionsPlaceholder')`).
        *   `Button` (principal, `w-full`): Icono `Loader2` (si `isLoading`), texto `t('analyzeCode.analyzeButton')`. Acción: `handleAnalyze`.
        *   `ErrorDisplay` si `error`.
        *   **Resultados (si `result` existe):**
            *   Título: `t('analyzeCode.results.explanationLabel')`. Párrafo con `result.explanation`.
            *   Título: `t('analyzeCode.results.originalCodeLabel')`. `Button` (outline, size sm) `t('analyzeCode.results.saveOriginalButton')`. `CodeBlock` con `result.originalCode`.
            *   Título: `t('analyzeCode.results.suggestedCodeLabel')`. `Button` (outline, size sm) `t('analyzeCode.results.saveSuggestedButton')`. `CodeBlock` con `result.suggestedCode`.
*   **Interacciones:**
    *   `handleFileChange`, `handleFetchFromUrl`: Cargan código en `codeToAnalyze`.
    *   `handleAnalyze`: Prepara `AnalyzeCodeSnippetInput`, llama a `callAnalyzeCodeSnippet`.
    *   `handleSaveSnapshot`: Añade snapshot al `AppStateContext`.
*   **Dependencias:** `Card`, `Label`, `Input`, `Textarea`, `Button`, `Loader2`, `Save`, `ScanLine`, `LLMConfigSelector`, `CodeBlock`, `ErrorDisplay`, `CodeEditor`, `useI18n`, `apiClient.ts`.

### 2.6. Análisis de Proyecto Completo (`/analizar-proyecto`)
*   **Propósito:** Análisis holístico de proyectos.
*   **Estructura:** Componente `src/app/analizar-proyecto/page.tsx`.
    *   `PageSectionHeader`: Icono `FolderSearch`, título `t('analyzeProject.title')`, descripción `t('analyzeProject.description')`.
    *   `CardContent` (`space-y-6`):
        *   `LLMConfigSelector`.
        *   `Label`: `t('analyzeProject.projectSourceLabel')`. `Select` para `projectSourceType` ("upload", "git").
        *   Si "upload": `Label` `t('analyzeProject.uploadLabel')`, `Input` (type `file`, id `project-file-upload`).
        *   Si "git": `Label` `t('analyzeProject.gitUrlLabel')`, `Input` (id `project-git-url`, placeholder `t('analyzeProject.gitUrlPlaceholder')`).
        *   `Separator`.
        *   `Label`: `t('analyzeProject.paramsLabel')`.
        *   `Label` `t('analyzeProject.depthLabel')`, `Input` (type `number`, placeholder `t('analyzeProject.depthPlaceholder')`).
        *   `Label` `t('analyzeProject.focusLabel')`, `Input` (placeholder `t('analyzeProject.focusPlaceholder')`).
        *   `Button` (principal, `w-full`): Icono `Loader2` (si `isLoading`), texto `t('analyzeProject.analyzeButton')`. Acción: `handleAnalyze`.
        *   `ErrorDisplay` si `error`.
        *   **Resultados (si `result` existe):**
            *   `Card` con `PageSectionHeader` (Icono `ListChecks`, título `result.analysisTitle`).
            *   `CardContent`:
                *   `t('analyzeProject.results.overallAssessmentLabel')`: `result.generalAssessment`.
                *   `t('analyzeProject.results.improvementIdeasLabel')`: Lista de `result.overallImprovementIdeas`.
                *   `t('analyzeProject.results.identifiedAreasLabel')`: Lista de `result.identifiedAreas`.
                *   `t('analyzeProject.results.specificSuggestionsLabel')`: `ScrollArea` con lista de sugerencias (área, sugerencia, prioridad, prompt sugerido).
                *   `LogsDisplay` si `result.groupLog`, título `t('analyzeProject.results.groupLogTitle')`.
*   **Interacciones:**
    *   `handleFileChange`: Actualiza `uploadedFile`.
    *   `handleAnalyze`: Prepara `AnalyzeCodeInput` (usando `sourceCodeLocation`, `projectContent` o `gitRepoUrl`), llama a `analyzeProjectFlow` (alias de `callAnalyzeSelfCode`).
*   **Dependencias:** `Card`, `Label`, `Input`, `Button`, `Select`, `Loader2`, `FolderSearch`, `ListChecks`, `Info`, `LLMConfigSelector`, `ErrorDisplay`, `LogsDisplay`, `ScrollArea`, `Separator`, `useI18n`, `apiClient.ts`.

### 2.7. AutoUpdate (Análisis del Propio Código) (`/autoupdate`)
*   **Propósito:** CodeAlchemist analiza su propio código.
*   **Estructura:** Componente `src/app/autoupdate/page.tsx`.
    *   Usa `AutoUpdateConfigForm` y `AutoUpdateResultsDisplay`.
    *   **`AutoUpdateConfigForm`:**
        *   `PageSectionHeader`: Icono `Sparkles`, título `t('autoupdate.config.title')`, descripción `t('autoupdate.config.description')`.
        *   Contenido: `LLMConfigSelector`, Selector de `sourceType` ("Local", "Git"), `Input` para `gitRepoUrl`, `Textarea` para `analysisPreferences`. `Button` `t('autoupdate.config.startButton')`. `Progress` bar.
    *   **`AutoUpdateResultsDisplay`:**
        *   `PageSectionHeader`: Icono `ClipboardList`, título `t('autoupdate.results.title')`. `actions`: Botones `t('autoupdate.results.downloadSuggestionsJson')`, `t('autoupdate.results.downloadCurrentCodeZip')`, `t('autoupdate.results.uploadToGit')`.
        *   Contenido: Si `analysisResult`: `analysisResult.analysisTitle`, `analysisResult.generalAssessment`, `analysisResult.overallImprovementIdeas`. Lista de `AutoUpdateSuggestionCard`. Si `unifiedPrompt`, se muestra con `CodeBlock`.
        *   `ErrorDisplay` si `analysisError`.
    *   **`AutoUpdateSuggestionCard`:**
        *   `CardHeader`: `area`, `priority`.
        *   `CardContent`: `suggestion`, `suggestedPromptForImplementation` (con botón `Copy`), `Textarea` para edición.
        *   `CardFooter`: Botones "Editar", "Guardar Edición", "Cancelar", "Testear", "Testear en Ent. Virtual", "Aplicar".
    *   Múltiples `Dialog` y `ConfirmDialog` para aplicar, testear, commit Git.
    *   `LogsDisplay` para `detailedLogs`.
*   **Interacciones:**
    *   `handleStartAnalysis`: Llama a Server Action `getApplicationSourceBundle` (si `sourceType` es "Local"), luego llama a `callAnalyzeSelfCode`.
    *   Manejo de sugerencias: `handleApplySuggestionClick`, `confirmApplySuggestion`, `handleToggleEdit`, `handleSuggestionContentChange`, `handleSaveEdit`, `handleCancelEdit`, `handleTestSuggestionClick`, `handleTestInVenvClick`.
    *   `handleDownload`: Para JSON de sugerencias o ZIP del código actual (llamando a `getApplicationSourceBundle` y usando `JSZip`).
    *   `performGitUpload`: Llama a Server Action `handleUploadToGit`.
    *   `handleAutoFixError`: Llama a `callAutoFixErrorWithGroup`.
*   **Server Actions (`src/app/autoupdate/actions.ts`):**
    *   `getApplicationSourceBundle`: Lee archivos del proyecto del servidor usando `fs`, `glob`.
    *   `handleUploadToGit`: Usa `simple-git` para clonar, copiar archivos, commitear y pushear.
*   **Dependencias:** Componentes `AutoUpdate*`, `LLMConfigSelector`, `Card`, `Button`, `Input`, `Textarea`, `Select`, `Progress`, `Loader2`, `Sparkles`, `ClipboardList`, `Download`, `GitCommit`, `FileArchive`, etc., `Dialog`, `ConfirmDialog`, `CodeBlock`, `ErrorDisplay`, `LogsDisplay`, `JSZip`, `useI18n`, `apiClient.ts`, Server Actions.

### 2.8. Versiones Guardadas (Snapshots) (`/versiones-guardadas`)
*   **Propósito:** Gestiona instantáneas de código o estado.
*   **Estructura:** Componente `src/app/versiones-guardadas/page.tsx`.
    *   `PageSectionHeader`: Icono `GitCompareArrows`, título `t('versions.title')`, descripción `t('versions.description')`. `actions`: Botones `t('versions.compareButton')`, `t('versions.deleteAllButton')`.
    *   `CardContent`:
        *   Botón `t('versions.saveAppStateButton')` con texto descriptivo.
        *   Botón `t('versions.saveAndDownloadStateButton')` con texto descriptivo.
        *   `ScrollArea` con `Table`:
            *   `TableHeader`: Columnas para "A", "B", `t('versions.table.colName')`, `t('versions.table.colCreatedAt')`, `t('versions.table.colSource')`, `t('versions.table.colActions')`.
            *   `TableBody`: Filas por cada snapshot. Checkboxes para selección A/B. Info del snapshot. Botones de acción (`DropdownMenu` con "Ver", "Descargar como [JSON/TXT]", "Descargar como ZIP", "Eliminar").
*   **Interacciones:**
    *   `handleSaveCurrentAppState`: Guarda el estado de la aplicación como snapshot.
    *   `handleDownloadSnapshot`: Descarga snapshot en formato original o ZIP.
    *   `handleViewSnapshot`, `handleDeleteSnapshot`, `confirmDeleteSnapshot`, `confirmDeleteAllSnapshots`.
    *   `toggleCompareSelection`, `handleCompareVersions`: Muestran `ConfirmDialog` con dos `CodeBlock` para comparación.
*   **Dependencias:** `Card`, `Button`, `Table`, `DropdownMenu`, `Checkbox`, `Eye`, `Download`, `Trash2`, `GitCompareArrows`, `ConfirmDialog`, `CodeBlock`, `ScrollArea`, `useI18n`.

### 2.9. Chat con IA (`/chat-ia`)
*   **Propósito:** Interactúa con un asistente IA.
*   **Estructura:** Componente `src/app/chat-ia/page.tsx`.
    *   `Card` (clase `h-full flex flex-col`).
    *   `PageSectionHeader`: Icono `MessageCircle`, título `t('chat.title')`, descripción `t('chat.description')`.
    *   `CardContent` (`flex-1 overflow-hidden p-0 flex flex-col`):
        *   Div (`p-4 border-b`): `LLMConfigSelector`.
        *   `ScrollArea` (`flex-1 p-4`): Muestra `messages` (de usuario, asistente, sistema). Cada mensaje con icono (`User`, `Bot`, `AlertTriangleIcon`), rol (`t('chat.agent.user')`, etc.), contenido y timestamp.
    *   `CardFooter` (`p-4 border-t`):
        *   `ErrorDisplay` si `error`.
        *   `Textarea` para `currentMessage` (placeholder `t('chat.inputPlaceholder')`).
        *   `Button` (Enviar, con icono `Send`).
        *   `Button` (Borrar Chat, con icono `Trash2`).
*   **Interacciones:**
    *   `handleSendMessage`: Añade mensaje de usuario. Llama a `callChatWithAgentOrGlobal` o `callChatWithAIGroup`. Añade respuesta de IA o error.
    *   `handleClearChat`: Limpia `messages`.
    *   `handleAutoFixError`: Llama a `callAutoFixErrorWithGroup`.
*   **Dependencias:** `Card`, `Textarea`, `Button`, `ScrollArea`, `Send`, `Trash2`, `Bot`, `User`, `Loader2`, `MessageCircle`, `AlertTriangleIcon`, `LLMConfigSelector`, `ErrorDisplay`, `useI18n`, `apiClient.ts`.

### 2.10. Gestión de Agentes IA (`/agentes-ia`)
*   **Propósito:** Crea, configura, prueba y gestiona agentes.
*   **Estructura:** Componente `src/app/agentes-ia/page.tsx`.
    *   `PageSectionHeader`: Icono `Users2`, título `t('agents.title')`, descripción `t('agents.description')`. `actions`: Botones `t('agents.createWithAIButton')` (icono `SparklesIcon`), `t('agents.importButton')` (icono `Upload`), `t('agents.exportAllButton')` (icono `Download`), `t('agents.createAgentButton')` (icono `PlusCircle`).
    *   `CardContent`:
        *   Mensaje `t('agents.noAgentsMessage')` si lista vacía.
        *   Grid de `Card` por agente. Cada `Card`:
            *   `CardHeader`: `CardTitle` (`agent.name` y badge `t('agents.defaultAgentBadge')`), `CardDescription` (`agent.description`).
            *   `CardContent`: Info de LLM (`t('agents.llmLabel')`), Capacidades (`t('agents.capabilitiesLabel')`).
            *   `CardFooter`: Botones (icono) "Probar", "Exportar", "Editar", "Eliminar".
    *   `AgentForm` (componente en diálogo).
    *   `ConfirmDialog` para eliminar.
    *   `AgentTestChat` (componente en diálogo).
    *   `AISuggestionDialog` para creación con IA.
*   **Interacciones:**
    *   `handleOpenForm`: Abre `AgentForm` (para crear/editar/revisar sugerencia).
    *   `handleSubmitAgentForm`: Llama a `addAgent` o `updateAgent`.
    *   `handleDeleteAgent`, `confirmDeleteAgent`.
    *   `handleImportAgents`, `handleExportAgents`, `handleExportSingleAgent`.
    *   `handleTestAgent`: Abre `AgentTestChat`.
    *   `handleSuggestAgent`: Abre `AISuggestionDialog`, llama a `callSuggestAgentDefinition`.
*   **Dependencias:** `Card`, `Button`, `Input`, `PlusCircle`, `Edit3`, `Trash2`, `Upload`, `Download`, `PlayCircle`, `Users2`, `SparklesIcon`, `AgentForm`, `AgentTestChat`, `ConfirmDialog`, `AISuggestionDialog`, `useI18n`, `apiClient.ts`.

### 2.11. Gestión de Grupos de Trabajo IA (`/grupos-trabajo-ia`)
*   **Propósito:** Define equipos de agentes.
*   **Estructura:** Componente `src/app/grupos-trabajo-ia/page.tsx`.
    *   `PageSectionHeader`: Icono `Workflow`, título `t('groups.title')`, descripción `t('groups.description')`. `actions`: Botones `t('groups.createWithAIButton')`, `t('groups.createGroupButton')`.
    *   `CardContent`: Mensaje `t('groups.noGroupsMessage')` si lista vacía. Grid de `Card` por grupo. Cada `Card`:
        *   `CardHeader`: `CardTitle` (`group.name`, badge `t('groups.defaultGroupBadge')`), `CardDescription`.
        *   `CardContent`: `t('groups.agentsLabel')` (conteo), `t('groups.taskLabel')` (`group.mainTask`).
        *   `CardFooter`: Botones (icono) "Ejecutar", "Editar", "Eliminar".
    *   Formulario de Grupo (en `Dialog`):
        *   `DialogHeader`: `DialogTitle`, `DialogDescriptionComponent`.
        *   `ScrollArea` con campos: `Label` y `Input` para nombre, `Textarea` para descripción y tarea principal. `Label` y `Checkbox` para seleccionar agentes. Nota sobre orquestador implícito.
        *   `DialogFooter`: Botones "Cancelar", "Guardar/Crear".
    *   `ConfirmDialog` para eliminar.
    *   `Dialog` para ejecución de grupo (muestra `LogsDisplay`).
    *   `AISuggestionDialog` para creación con IA.
*   **Interacciones:**
    *   `handleOpenForm`, `handleSubmitForm`, `handleDeleteGroup`, `confirmDeleteGroup`.
    *   `handleExecuteGroup`: Inicia bucle de ejecución, llama a `callChatWithAIGroup` y `callChatWithAgentOrGlobal`, actualiza `executionLog`.
    *   `handleSuggestGroup`: Llama a `callSuggestGroupDefinition`.
*   **Dependencias:** `Card`, `Button`, `Dialog`, `Input`, `Textarea`, `Label`, `Checkbox`, `PlusCircle`, `Edit3`, `Trash2`, `Play`, `Workflow`, `SparklesIcon`, `Loader2`, `ScrollArea`, `ConfirmDialog`, `LogsDisplay`, `AISuggestionDialog`, `useI18n`, `apiClient.ts`.

### 2.12. Configuración (`/configuracion`)
*   **Propósito:** Ajustar parámetros globales.
*   **Estructura:** Componente `src/app/configuracion/page.tsx`.
    *   `Card` principal con `PageSectionHeader` (Icono `SettingsIcon`, título `t('settings.title')`, descripción `t('settings.description')`, `actions`: botones `t('settings.importButton')`, `t('settings.exportButton')`, `t('settings.saveButton')`).
    *   `CardContent` (`space-y-8`): Múltiples `Card` anidadas para secciones:
        *   **LLM:** `CardHeader`, `CardContent` con `Label`, `Select` (proveedor), `Input` (URL API, placeholder `t('settings.llm.apiUrlPlaceholder')`, tipo `password` para API Key, placeholder `t('settings.llm.apiKeyPlaceholder')`), `Select` (modelo, placeholder `t('settings.llm.modelNamePlaceholder')`). `CardFooter` con `Button` `t('settings.llm.testConnectionButton')`.
        *   **Git:** `CardHeader`, `CardContent` con `Label`, `Input` (URL repo, usuario, email, PAT tipo `password`). `CardFooter` con `Button` `t('settings.git.testConnectionButton')`.
        *   **Idioma:** `CardHeader`, `CardContent` con `Label` `t('settings.language.selectLabel')`, `Select` para idioma.
        *   **Debug:** `CardHeader`, `CardContent` con `Switch` y `Label` `t('settings.debug.switchLabel')`.
*   **Interacciones:**
    *   Cambios en campos actualizan estado local. `handleSaveSettings` actualiza `AppStateContext`.
    *   `handleTestLLM`, `handleTestGit` (simulados).
    *   `handleExportConfig`, `handleImportConfig` (manejan JSON de `AppSettings`).
    *   `fetchAndSetGroqModels`: Llama a Server Action `getGroqModels` (de `configuracion/actions.ts`).
*   **Dependencias:** `Card`, `Label`, `Input`, `Button`, `Select`, `Switch`, `Separator`, `SettingsIcon`, `Loader2`, `Upload`, `Download`, `Save`, `useI18n`.

### 2.13. Funcionalidad Multiidioma
*   **Mecanismo:** Se utiliza un `I18nContext` (`src/context/I18nContext.tsx`) que provee una función `t(key: TranslationKey, params?: Record<string, string | number>)` y el idioma actual (`language`). El idioma se persiste en `localStorage` a través de `AppStateContext` (`settings.language`).
*   **Idiomas Soportados:** Español (`es`, por defecto) e Inglés (`en`). Definidos en `src/lib/i18n/constants.ts` (`SUPPORTED_LANGUAGES`).
*   **Archivos de Traducción:** `src/lib/i18n/translations.ts` contiene un objeto `translationsData` con las cadenas para cada idioma.
    *   **Estructura:**
        ```javascript
        export const translationsData = {
          es: {
            app: { title: "CodeAlchemist" }, // Clave plana
            sidebar: { dashboard: "Panel de Control", ... }, // Clave anidada
            // ... otras secciones ...
          },
          en: { /* traducciones en inglés */ }
        };
        ```
*   **Resolución de Claves:** La función `t()` usa una helper `getNestedTranslation` que primero busca la clave completa (ej. "app.title") y, si no la encuentra, intenta resolverla como una ruta anidada (ej. "sidebar.dashboard" se busca como `translations[lang].sidebar.dashboard`).
*   **Ejemplos:**
    *   Barra Lateral: `t('sidebar.dashboard')` muestra "Panel de Control" o "Dashboard".
    *   Página de Configuración: `t('settings.llm.title')` muestra "Configuración del Proveedor LLM" o "LLM Provider Settings".

## 3. Interfaz de Usuario (UI)

### 3.1. Estructura de la Aplicación
La aplicación sigue la estructura del App Router de Next.js.
*   **Layout Principal:** `src/app/layout.tsx` define el `<html>` y `<body>`. Incluye los proveedores de contexto globales (`AppStateProvider`, `DebugProvider`, `I18nProvider`).
*   **Layout de Aplicación:** `src/components/layout/AppLayout.tsx` implementa la barra lateral persistente y la cabecera superior, renderizando el contenido de la página actual (`children`).
    *   Utiliza el componente `Sidebar` de `@/components/ui/sidebar` (personalización de ShadCN). La barra lateral es colapsable en escritorio (botón en `SidebarHeader` con `ChevronsLeft`/`ChevronsRight`) y se convierte en `Sheet` en móviles (disparador `SidebarTrigger` con `MenuIcon` en la cabecera principal de la página).
    *   La cabecera principal de la página muestra el icono y título de la sección actual.

### 3.2. Estilos Visuales
Definidos principalmente en `src/app/globals.css` usando variables CSS HSL y clases de Tailwind CSS. El tema se basa en el estilo "default" de ShadCN.

*   **Paleta de Colores Principal (Modo Claro por defecto):**
    *   `--background`: `210 17% 94%` (#ECEFF1) - Fondo principal.
    *   `--foreground`: `233 30% 15%` (#20263B) - Texto principal.
    *   `--card`: `0 0% 100%` (#FFFFFF) - Fondo de tarjetas.
    *   `--card-foreground`: `233 30% 15%` (#20263B) - Texto en tarjetas.
    *   `--popover`: `0 0% 100%` (#FFFFFF) - Fondo de popovers.
    *   `--popover-foreground`: `233 30% 15%` (#20263B) - Texto en popovers.
    *   `--primary`: `233 63% 30%` (#1A237E) - Color primario (azul oscuro).
    *   `--primary-foreground`: `210 17% 85%` (#D0D6DB) - Texto sobre primario.
    *   `--secondary`: `210 17% 88%` (#DBE0E4) - Color secundario (gris claro).
    *   `--secondary-foreground`: `233 30% 20%` (#2A3347) - Texto sobre secundario.
    *   `--muted`: `210 17% 90%` (#E1E5E8) - Fondos o elementos atenuados.
    *   `--muted-foreground`: `233 20% 40%` (#525B75) - Texto atenuado.
    *   `--accent`: `174 60% 40%` (#26A69A) - Color de acento (teal).
    *   `--accent-foreground`: `210 17% 15%` (#20262B) - Texto sobre acento.
    *   `--destructive`: `0 84.2% 60.2%` (#F44336) - Color para acciones destructivas (rojo).
    *   `--destructive-foreground`: `0 0% 10%` (#1A1A1A) - Texto sobre destructivo.
    *   `--border`: `210 17% 85%` (#D0D6DB) - Bordes.
    *   `--input`: `210 17% 85%` (#D0D6DB) - Fondo de inputs (puede ser `transparent` si se usan bordes).
    *   `--ring`: `174 60% 40%` (#26A69A) - Anillo de enfoque (teal).
    *   **Sidebar (Modo Claro):**
        *   `--sidebar-background`: `220 13% 95%` (#F0F2F5) - Fondo del sidebar.
        *   `--sidebar-foreground`: `233 30% 25%` (#343E54) - Texto en sidebar.
        *   Otras variables de sidebar (primary, accent, etc.) usan los mismos valores que el tema principal o adaptaciones sutiles.
*   **Paleta de Colores (Modo Oscuro):** Definida en `globals.css` bajo el selector `.dark { ... }`.
    *   `--background`: `233 30% 12%` (#171C26).
    *   `--foreground`: `210 17% 85%` (#D0D6DB).
    *   ... y equivalentes oscuros para las demás variables, buscando buen contraste.
*   **Tipografía:**
    *   **Fuente Principal (Sans-serif):** Geist Sans (de `geist/font/sans`). Aplicada al `body`.
    *   **Fuente Monoespaciada:** Geist Mono (de `geist/font/mono`). Usada para bloques de código (`CodeBlock`, `CodeEditor`), logs.
*   **Iconografía:**
    *   **Biblioteca Principal:** Lucide Icons (`lucide-react`).
    *   **Logo de la Aplicación:** `FlaskConical`. Color: `text-primary`.
*   **Layout General:**
    *   Diseño responsivo usando clases de Tailwind CSS (ej. `grid-cols-1 sm:grid-cols-2`, `md:flex`).
    *   Esquinas redondeadas: Variables `--radius` (0.5rem), `rounded-lg`, `rounded-md`, `rounded-sm` de ShadCN/Tailwind.
    *   Sombras sutiles: `shadow-sm`, `shadow-md`, `shadow-lg`.
*   **Animaciones y Transiciones:**
    *   Transiciones de color/fondo en hover para botones y elementos interactivos (definidas por Tailwind/ShadCN).
    *   Animaciones de acordeón (`accordion-down`, `accordion-up` definidas en `tailwind.config.ts`).
    *   Animaciones de entrada/salida para diálogos y popovers (definidas por Radix UI/ShadCN).

## 4. Lógica y Backend

### 4.1. Servicios y Endpoints (Flujos Genkit)
La lógica de IA se maneja mediante flujos Genkit definidos en `src/ai/flows/`. Estos se ejecutan en el servidor. Son llamados desde el frontend mediante funciones wrapper en `src/utils/apiClient.ts`.

*   **`generateCodeFromDescriptionFlow` (`src/ai/flows/generate-code-from-description.ts`):**
    *   Input: `GenerateCodeFromDescriptionInput { description: string, agentSystemPrompt?: string }`
    *   Output: `GenerateCodeFromDescriptionOutput { explanation: string, code: string, groupLog?: string }`
    *   Lógica: Pasa la descripción (y contexto opcional del agente/grupo) al LLM para generar código y una explicación.
*   **`generateProjectStructureFlow` (`src/ai/flows/generate-project-structure-flow.ts`):**
    *   Input: `GenerateProjectInput { description: string, agentSystemPrompt?: string }`
    *   Output: `ProjectGenerationResult { projectName: string, aiNotes: string, files: GeneratedFile[], groupLog?: string }`
    *   Lógica: Pasa descripción al LLM para generar estructura de proyecto, nombres de archivo, contenido y notas.
*   **`refactorProjectWithAIFlow` (`src/ai/flows/refactor-project-with-ai.ts`):**
    *   Input: `RefactorProjectWithAIInput` (incluye `projectSource`, `goals`, `priority`, `searchDepth`, `focusArea`, `agentSystemPrompt`)
    *   Output: `RefactorProjectWithAIOutput` (incluye `projectOverview`, `suggestions`, `groupLog`)
    *   Lógica: Analiza código (referencia) y parámetros para sugerir refactorizaciones.
*   **`analyzeCodeSnippetFlow` (`src/ai/flows/analyze-code-snippet.ts`):**
    *   Input: `AnalyzeCodeSnippetInput` (incluye `code`, `userPrompt`, `language`, `agentSystemPrompt`)
    *   Output: `AnalyzeCodeSnippetOutput` (incluye `explanation`, `originalCode`, `suggestedCode`)
*   **`analyzeSelfCodeFlow` (`src/ai/flows/analyze-self-code.ts`, usado para "Analizar Proyecto" y "AutoUpdate"):**
    *   Input: `AnalyzeCodeInput` (incluye `sourceCodeLocation`, `projectContent`, `gitRepoUrl`, `focusArea`, `searchDepth`, `agentSystemPrompt`)
    *   Output: `AnalyzeCodeOutput` (incluye `analysisTitle`, `generalAssessment`, `identifiedAreas`, `detailedSuggestions` con `suggestedPromptForImplementation`, `overallImprovementIdeas`, `groupLog`)
*   **`chatWithAgentOrGlobalFlow` (`src/ai/flows/chat-with-agent-or-global-flow.ts`):**
    *   Input: `ChatWithAgentOrGlobalInput { userMessage: string, agentSystemPrompt?: string }`
    *   Output: `ChatWithAgentOrGlobalOutput { aiResponse: string }`
*   **`chatWithAIGroupFlow` (`src/ai/flows/chat-with-ai-group-flow.ts`):**
    *   Input: `ChatWithAIGroupInput` (incluye `userMessage`, `groupMainTask`, `participatingAgents`, `orchestratorAgentSystemPrompt`)
    *   Output: `ChatWithAIGroupOutput { orchestratorResponse: string }` (JSON con decisión del orquestador)
*   **`suggestAgentDefinitionFlow` (`src/ai/flows/suggest-agent-definition-flow.ts`):**
    *   Input: `SuggestAgentDefinitionInput { roleDescription: string }`
    *   Output: `SuggestAgentDefinitionOutput` (nombre, descripción, prompt, capacidades)
*   **`suggestGroupDefinitionFlow` (`src/ai/flows/suggest-group-definition-flow.ts`):**
    *   Input: `SuggestGroupDefinitionInput { groupTaskDescription: string, availableAgents: AgentInfoForGroupSuggestion[] }`
    *   Output: `SuggestGroupDefinitionOutput` (nombre, descripción, tarea principal, agentIds)
*   **`autoFixErrorWithGroupFlow` (`src/ai/flows/auto-fix-error-with-group-flow.ts`):**
    *   Input: `AutoFixErrorWithGroupInput` (incluye `errorMessage`, `codeContext`, `userInstructions`)
    *   Output: `AutoFixErrorWithGroupOutput` (incluye `suggestedSolution`, `diagnosticNotes`, `initialGroupLog`)
*   **Manejo de Errores en Flujos:** Los flujos Genkit pueden lanzar errores si el LLM falla. `apiClient.ts` los captura, los parsea a `AppError` y los relanza para que la UI los maneje. Implementa reintentos para errores transitorios.

### 4.2. Server Actions (`src/app/autoupdate/actions.ts`)
*   **`getApplicationSourceBundle`**:
    *   Parámetros: `concatenate: boolean` (opcional), `parentExecutionLogs?: string[]`.
    *   Lógica: Usa `glob` para encontrar archivos en `process.cwd()` (raíz del proyecto servidor), ignorando patrones en `ignorePatterns`. Lee el contenido de cada archivo (UTF-8).
    *   Retorno: `Promise<{ success: boolean; files?: AppSourceFile[]; concatenatedSource?: string; error?: string; logsBuilt?: string[]; }>`
*   **`handleUploadToGit`**:
    *   Parámetros: `gitConfig: GitUploadConfig`, `commitMessage: string`, `parentExecutionLogs?: string[]`.
    *   Lógica: Llama a `getApplicationSourceBundle`. Crea un directorio temporal. Usa `simple-git` para `init`, `addConfig`, `add`, `commit`, `addRemote` (o `set-url`), y `push -u origin <defaultBranch> --force`.
    *   Retorno: `Promise<GitUploadResult { success: boolean; message: string; logs?: string[]; }>`
*   **`getGroqModels` (en `src/app/configuracion/actions.ts`):**
    *   Parámetro: `apiKey: string`.
    *   Lógica: Usa `groq-sdk` (`new Groq({ apiKey })`) para llamar a `groq.models.list()`. Extrae los IDs de los modelos.
    *   Retorno: `Promise<{ success: boolean; models?: string[]; error?: string; debug?: any; }>`

### 4.3. Bases de Datos
No hay una base de datos backend tradicional. El estado persistente de la aplicación (configuraciones, agentes, grupos, snapshots, idioma) se guarda en el `localStorage` del navegador del usuario, gestionado por el hook `useLocalStorage` y el `AppStateContext`.

### 4.4. Agentes y Grupos
*   **Roles de Usuario:** No hay un sistema formal de roles de usuario con diferentes permisos a nivel de aplicación. Todas las funcionalidades están disponibles para cualquier usuario.
*   **Autenticación/Autorización:** No implementadas. La aplicación es de uso local en el navegador y no requiere login. Las claves API se guardan localmente en `localStorage`.
*   **Agentes por Defecto (definidos en `src/lib/constants.ts`, `DEFAULT_AGENTS`):**
    *   **`OrquestadorFlujoAgentes`**:
        *   ID: `orquestador-flujo-agentes`
        *   Descripción: Gestiona el flujo de trabajo y la comunicación entre agentes en un grupo de trabajo. Decide qué agente actúa a continuación.
        *   Prompt de Sistema: Instruye para analizar tarea, decidir siguiente agente, formular instrucción y devolver decisión en JSON: `{"next_agent_id": "id_del_agente_o_COMPLETADO", "instruction_for_next_agent": "tu_instruccion_o_resumen_final", "reasoning": "breve_explicacion_de_tu_eleccion"}`. Si la tarea está completa, `next_agent_id` es "COMPLETADO". Su respuesta DEBE ser únicamente el objeto JSON.
        *   Capacidades: Todas en `false`.
        *   No editable, no eliminable.
    *   **`RefactorizadorCodigoExperto`**:
        *   ID: `refactorizador-codigo-experto`
        *   Descripción: Especializado en análisis y refactorización de código. Propone mejoras basadas en Clean Code y SOLID, devolviendo sugerencias en JSON.
        *   Prompt de Sistema: Instruye para analizar código y sugerir mejoras (Clean Code, SOLID). Devolver en JSON con `area`, `description`, `priority`, `snippetSuggested` (opcional), `fullFileContentSuggested` (opcional). Todas las salidas en castellano.
        *   Capacidades: `accessOwnCode: true`, el resto en `false`.
    *   **`JefeDeProducto`**: Define requisitos, historias de usuario. Prompt: "Define requisitos claros, historias de usuario detalladas y prioridades...".
    *   **`ArquitectoSoftware`**: Diseña arquitectura, selecciona tecnologías. Prompt: "Diseña la arquitectura general, selecciona tecnologías, define patrones...".
    *   **`DesarrolladorSoftware`**: Escribe código. Prompt: "Escribe código limpio, eficiente y documentado...". Capacidades: `accessOwnCode: true`, `execution: true`, `readWrite: true`.
    *   **`IngenieroPruebas`**: Escribe y ejecuta pruebas. Prompt: "Asegura la calidad mediante planes y casos de prueba...". Capacidades: `accessOwnCode: true`, `execution: true`.
    *   **`IngenieroDevOps`**: Gestiona infraestructura, CI/CD. Prompt: "Encárgate de IaC, CI/CD, monitoreo...". Capacidades: `execution: true`, `virtualEnv: true`, `readWrite: true`.
    *   **`RepresentanteUsuario`**: Proporciona feedback de usuario. Prompt: "Proporciona feedback sobre usabilidad, funcionalidad y experiencia...".
    *   **`ValidadorCodigo`**: Analiza resultados de refactorización. Prompt: "Analiza código después de refactorizaciones para detectar errores...". Capacidades: `accessOwnCode: true`, `execution: true`.
*   **Grupo de Trabajo por Defecto (definido en `src/lib/constants.ts`, `DEFAULT_GROUPS`):**
    *   **`EquipoDesarrolloSoftware`**:
        *   ID: `equipo-desarrollo-software`
        *   Descripción: Simula un equipo de producción de software completo y versátil, capaz de abordar diversas tareas de desarrollo y mejorar el sistema Auto-Fix.
        *   Tarea Principal: Ser un equipo versátil para desarrollo y mejorar el sistema "Auto-Fix" de CodeAlchemist (priorización dinámica de errores, aprendizaje predictivo de errores, validación robusta de correcciones, sincronización con el Orquestador).
        *   Agentes Participantes: `JefeDeProducto`, `ArquitectoSoftware`, `DesarrolladorSoftware`, `RefactorizadorCodigoExperto`, `ValidadorCodigo`, `IngenieroPruebas`, `IngenieroDevOps`, `RepresentanteUsuario`. (`OrquestadorFlujoAgentes` es implícito).

## 5. Configuración Técnica

### 5.1. Dependencias
Ver el archivo `package.json` para la lista completa de dependencias y devDependencies. Algunas clave son:
*   `next`, `react`, `react-dom`
*   `@genkit-ai/googleai`, `genkit` (y `genkit-cli` en dev)
*   `lucide-react` (iconos)
*   `tailwindcss`, `tailwind-merge`, `tailwindcss-animate`
*   ShadCN UI (Radix UI) componentes: `@radix-ui/react-dialog`, `@radix-ui/react-select`, etc.
*   `zod` (validación de esquemas para Genkit)
*   `jszip` (creación de ZIPs en cliente)
*   `simple-git` (operaciones Git en Server Actions)
*   `glob` (búsqueda de archivos en Server Actions)
*   `groq-sdk` (para la API de modelos de Groq en Server Actions)
*   ESLint, Prettier y plugins asociados.

### 5.2. Variables de Entorno (`.env.local`)
*   `GOOGLE_API_KEY`: Requerida si se usa el plugin `googleAI` de Genkit con modelos de Google (ej. `gemini-2.0-flash`).
*   Otras claves API (ej. `GROQ_API_KEY`, `OPENAI_API_KEY`) no se gestionan típicamente como variables de entorno para esta aplicación, sino que se ingresan en la UI (sección Configuración) y se guardan en `localStorage`. La `GROQ_API_KEY` se usa en una Server Action si se pasa desde el cliente.

### 5.3. Pruebas
*   **Linting y Formateo:** ESLint y Prettier están configurados.
    *   `npm run lint`: Verifica el código.
    *   `npm run lint:fix`: Intenta corregir errores de linting.
    *   `npm run format`: Formatea el código con Prettier.
    *   `npm run format:check`: Verifica el formato del código.
*   **Pruebas Unitarias/Integración:** No hay un framework de pruebas (Jest, RTL) configurado actualmente. Se recomienda implementarlo.
*   **Pruebas E2E:** No configuradas. Se recomienda Playwright o Cypress.

### 5.4. Despliegue
*   **Plataforma Recomendada:** Vercel (por los creadores de Next.js), ya que ofrece una integración óptima.
*   **Otros:** Cualquier plataforma que soporte Node.js (Netlify, AWS Amplify, DigitalOcean App Platform, Heroku, VPS con PM2 o Docker).
*   **Build:** `npm run build` crea una versión optimizada para producción.
*   **Variables de Entorno en Producción:** Se deben configurar las mismas variables de entorno que en desarrollo (ej. `GOOGLE_API_KEY`) en la plataforma de despliegue.
*   **Flujos Genkit:** Si los flujos Genkit se despliegan como parte de la app Next.js (comportamiento por defecto con `@genkit-ai/next`), se escalarán con la aplicación. Si se despliegan como un servicio separado (ej. Cloud Functions, Cloud Run), la app Next.js necesitaría la URL de ese endpoint.
*   **Caching:** Next.js maneja caching de datos y renderizado. Se pueden configurar cabeceras HTTP para caching de assets estáticos en el servidor de despliegue.

## 6. Documentación Adicional

### 6.1. Errores Comunes y Soluciones
*   **"Module not found" (ej. `jszip`, `glob`, `simple-git`, `groq-sdk`):** Asegúrate de haber ejecutado `npm install` o `yarn install` después de clonar el repositorio o después de que se añadan nuevas dependencias al `package.json`.
*   **Errores de API LLM (401, 403, 429):**
    *   **401/403 (No autorizado/Prohibido):** Verifica que la Clave API ingresada en Configuración sea correcta y tenga los permisos necesarios para el modelo seleccionado.
    *   **429 (Demasiadas Solicitudes):** Has alcanzado el límite de tasa de la API. Espera un momento e inténtalo de nuevo. Considera modelos menos demandados o planes de API superiores si ocurre frecuentemente.
*   **Errores de API LLM (500, 503):** Indican un problema en el servidor del proveedor LLM. Inténtalo más tarde. La app tiene reintentos automáticos para esto.
*   **Errores de CORS (si se usan endpoints de API personalizados para modelos locales):** Asegúrate de que el servidor LLM (especialmente para LM Studio u Ollama) esté configurado para permitir solicitudes desde el origen donde se ejecuta CodeAlchemist.
*   **Problemas de Traducción (claves mostradas en lugar de texto):**
    1.  Reinicia el servidor de desarrollo.
    2.  Verifica que la clave exista exactamente (sensible a mayúsculas/minúsculas y anidación) en `src/lib/i18n/translations.ts` para el idioma activo y el de por defecto.
    3.  Asegúrate de que el componente que usa `t()` sea un Client Component (`"use client";`).
*   **"Hydration failed" (Errores de Hidratación de React):** Generalmente indican una diferencia entre el HTML renderizado en servidor y el primer renderizado en cliente. A menudo relacionado con el uso de APIs de navegador (como `localStorage` o `window`) directamente en la lógica de renderizado inicial. Asegúrate de que dichos accesos estén dentro de `useEffect` o se manejen de forma que el primer renderizado sea consistente. El hook `useLocalStorage` está diseñado para manejar esto.

### 6.2. Contribución
*   **Flujo de Trabajo Git:** Se recomienda seguir un flujo como GitFlow (ramas `feature`, `develop`, `main`).
*   **Estilo de Código:** Ejecuta `npm run lint:fix` y `npm run format` antes de hacer commit.
*   **Mensajes de Commit:** Sigue un estándar (ej. Conventional Commits).
*   **Comentarios:** Documenta el código nuevo o modificado con JSDoc.

### 6.3. Licencia y Créditos
*   **Licencia:** (Asumir MIT si no hay archivo LICENSE.md. El desarrollador debe añadirlo).
*   **Iconos:** Lucide Icons (Licencia ISC).
*   **Componentes UI:** ShadCN UI (Licencia MIT).
*   **Fuentes:** Geist Sans, Geist Mono (Licencia OFL).

## 7. Detalles Olvidados

### 7.1. Aspectos Técnicos Adicionales
*   **Server Actions:** Se utilizan para operaciones del lado del servidor que necesitan acceso al sistema de archivos (ej. `getApplicationSourceBundle` en `autoupdate/actions.ts`) o para interactuar con librerías Node.js (ej. `simple-git` en `autoupdate/actions.ts` para la subida a Git, o `groq-sdk` en `configuracion/actions.ts`). Esto mantiene la lógica sensible fuera del cliente.
*   **Seguridad:**
    *   Las claves API ingresadas en la UI se guardan en `localStorage`. Esto es conveniente pero tiene implicaciones si el navegador del usuario está comprometido.
    *   La funcionalidad de "Subir a Git" en AutoUpdate requiere un PAT que, si es comprometido, podría dar acceso al repositorio.
    *   Las capacidades "peligrosas" de los agentes (ejecución, lectura/escritura) deben usarse con extrema precaución.
*   **Actualización de Traducciones:** Actualmente, las traducciones están en `src/lib/i18n/translations.ts`. Para añadir/modificar, se edita este archivo directamente. No hay un CMS de traducciones integrado.
*   **Persistencia del Estado:** El estado principal de la aplicación (configuración, agentes, grupos, snapshots, idioma) se persiste en `localStorage` usando el hook `useLocalStorage`.

### 7.2. Ejemplos de Uso / Pruebas Críticas
*   **Probar Configuración LLM:** Ve a "Configuración", selecciona un proveedor (ej. Groq), ingresa tu clave API y modelo, y pulsa "Probar Conexión". Para Groq, la lista de modelos debería cargarse dinámicamente.
*   **Probar Internacionalización:** Ve a "Configuración", cambia el idioma a "English". Navega por la aplicación; la mayoría de los textos de la UI deberían cambiar. Cambia de nuevo a "Español".
*   **Probar Creación de Agente con IA:** Ve a "Agentes IA", pulsa "Crear con IA", describe un rol (ej. "un agente que escribe código Python para web scraping"), y observa cómo se pre-rellena el formulario.
*   **Probar Ejecución de Grupo:** Ve a "Grupos de Trabajo IA", selecciona "EquipoDesarrolloSoftware", pulsa "Ejecutar". En el modal, introduce una tarea simple como "Resume los objetivos principales de este grupo de trabajo" y observa el log de ejecución multi-turno.
*   **Probar AutoUpdate (Análisis Local):** Ve a "AutoUpdate", selecciona "Local" y un agente (ej. `RefactorizadorCodigoExperto`), y pulsa "Iniciar Auto-Análisis". Observa las sugerencias. Intenta descargar el "Código Actual (ZIP)" (recordando que usa la Server Action para obtener los archivos del servidor y JSZip en cliente).
*   **Probar Subida a Git (AutoUpdate):** Configura Git en "Configuración". En "AutoUpdate", después de un análisis, pulsa "Subir a Git" e introduce un mensaje de commit. Verifica tu repositorio remoto.

Este README exhaustivo debería servir como una guía completa para entender, ejecutar, y contribuir al proyecto CodeAlchemist.
