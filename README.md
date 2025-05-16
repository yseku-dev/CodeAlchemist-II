
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA.

**Idioma del Proyecto:** Todo el proyecto, incluyendo la interfaz de usuario, los mensajes, los comentarios en el código (donde aplique semánticamente) y la documentación (como este README), está desarrollado y presentado en **castellano**. La aplicación soporta internacionalización (i18n) con inglés como segundo idioma.

**Operatividad:** Todas las funcionalidades descritas en este documento son completamente operativas. **Ninguna función o funcionalidad debe ser experimental o simulada donde se indique que es una capacidad real del sistema.** Las acciones que implican modificación de código (sugeridas por la IA y aplicadas por el usuario) o interacción con sistemas externos (como APIs de LLMs o Git) se ejecutan de forma real según la configuración y permisos otorgados por el usuario. Las limitaciones inherentes a un entorno de navegador (como la modificación directa de archivos del sistema no iniciada por el usuario o la ejecución de código de servidor sin una Server Action explícita) se indican cuando son relevantes.

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
*   **Componente Principal:** `src/app/generar-codigo/page.tsx`.
*   **Elementos de UI:**
    *   **`PageSectionHeader`**:
        *   Icono: `CodeXml`.
        *   Título: `t('generateCode.title')`.
        *   Descripción: `t('generateCode.description')`.
    *   **`CardContent`** (`space-y-6`):
        *   **`LLMConfigSelector`**: Componente para seleccionar la fuente de configuración LLM.
            *   Prop `value`: Estado `llmConfigSource`.
            *   Prop `onChange`: Función `setLlmConfigSource`.
            *   Prop `label`: `t('common.llmSourceLabel')`.
        *   **`Label`** para `description`: `t('generateCode.describeNeedLabel')`.
        *   **`Textarea`** (id `description`):
            *   Prop `value`: Estado `description`.
            *   Prop `onChange`: Función para actualizar `description`.
            *   Prop `placeholder`: `t('generateCode.describeNeedPlaceholder')`.
            *   Prop `rows`: 5.
        *   **`Button`** (principal, `w-full`):
            *   Icono: `Loader2` (si `isLoading` es true, con `animate-spin`).
            *   Texto: `t('generateCode.generateButton')`.
            *   Acción: `handleGenerateClick`.
        *   **`ErrorDisplay`**: Se muestra si el estado `error` existe.
        *   **Resultados (si `result` existe):**
            *   Título: `t('generateCode.results.explanationLabel')` (h3 `font-semibold text-lg`). Párrafo con `result.explanation`.
            *   Título: `t('generateCode.results.codeSnippetLabel')` (h3 `font-semibold text-lg`).
            *   `CodeBlock`: Muestra `result.code`.
            *   `LogsDisplay`: Si `result.groupLog` existe, título `t('generateCode.results.groupLogTitle')`.
*   **Interacciones y Lógica:**
    *   **`handleGenerateClick`**:
        *   Valida que `description` no esté vacío. Si lo está, muestra un `toast` de error (`t('generateCode.toast.descriptionEmpty')`).
        *   Si es válido, establece `showConfirmDialog` a `true`.
    *   **`ConfirmDialog`**:
        *   Título: `t('generateCode.confirmDialog.title')`.
        *   Contenido: Muestra la fuente LLM seleccionada (`llmConfigSource`) y el `description` (prompt) dentro de un `ScrollArea`. Usa `t('generateCode.confirmDialog.llmSourceLabel')` y `t('generateCode.confirmDialog.promptLabel')`.
        *   Acción `onConfirm`: Llama a `handleSubmit`.
    *   **`handleSubmit`**:
        *   Establece `isLoading=true`, `error=null`, `result=null`.
        *   Prepara `agentSystemPrompt` si se seleccionó un Agente (`getAgentById`) o Grupo (`getGroupById` para obtener el orquestador o la tarea principal).
        *   Llama a `callGenerateCodeFromDescription` (de `apiClient.ts`) con `description` y `agentSystemPrompt`.
        *   Si la llamada es exitosa, actualiza `result` y muestra un `toast` (`t('generateCode.toast.codeGenerated')`).
        *   Si falla, actualiza `error` con `e.friendlyMessage` (si es `AppError`) y muestra un `toast` de error (`t('generateCode.toast.generationError')`). Si `e.redirectTo` existe, navega a esa ruta.
        *   Establece `isLoading=false` en el `finally`.
    *   **`handleAutoFixError`**: Llama a `callAutoFixErrorWithGroup` para obtener sugerencias de corrección para el error actual.
*   **Dependencias:** `Card`, `Label`, `Textarea`, `Button`, `Loader2`, `CodeXml`, `LLMConfigSelector`, `CodeBlock`, `ConfirmDialog`, `ErrorDisplay`, `LogsDisplay`, `ScrollArea`, `useI18n`, `useAppState`, `useToast`, `useDebug`, `useRouter`, `apiClient.ts`.

### 2.3. Generación de Proyectos (`/generar-proyecto`)
*   **Propósito:** Crear una estructura base para nuevos proyectos.
*   **Componente Principal:** `src/app/generar-proyecto/page.tsx`.
*   **Elementos de UI:**
    *   **`PageSectionHeader`**:
        *   Icono: `FolderPlus`.
        *   Título: `t('generateProject.title')`.
        *   Descripción: `t('generateProject.description')`.
    *   **`CardContent`** (`space-y-6`):
        *   **`LLMConfigSelector`**: Similar a "Generar Código".
        *   **`Label`** para `description`: `t('generateProject.describeProjectLabel')`.
        *   **`Textarea`** (id `description`):
            *   Prop `value`: Estado `description`.
            *   Prop `onChange`: Función para actualizar `description`.
            *   Prop `placeholder`: `t('generateProject.describeProjectPlaceholder')`.
            *   Prop `rows`: 8.
        *   **`Button`** (principal, `w-full`):
            *   Icono: `Loader2` (si `isLoading`).
            *   Texto: `t('generateProject.generateButton')`.
            *   Acción: `handleGenerateClick`.
        *   **`ErrorDisplay`**: Si `error` existe.
        *   **Resultados (si `result` existe):**
            *   Título: `t('generateProject.results.suggestedNameLabel')` (h3 `font-semibold text-xl`). Párrafo con `result.projectName`.
            *   Título: `t('generateProject.results.aiNotesLabel')` (h3 `font-semibold text-lg`). Párrafo con `result.aiNotes`.
            *   Título: `t('generateProject.results.generatedFilesLabel')` (h3 `font-semibold text-lg`).
            *   `FileTreeDisplay`: Muestra `result.files`.
            *   **`Button`** (variante `outline`):
                *   Icono: `Download`.
                *   Texto: `t('generateProject.results.downloadButton')`.
                *   Acción: `handleDownloadProject`.
            *   Párrafo debajo del botón de descarga: `t('generateProject.results.downloadNote')`.
            *   `LogsDisplay`: Si `result.groupLog` existe, título `t('generateProject.results.groupLogTitle')`.
*   **Interacciones y Lógica:**
    *   **`handleGenerateClick`**:
        *   Valida `description`. Si vacío, muestra `toast` (`t('generateProject.toast.descriptionEmpty')`).
        *   Establece `currentPromptForDialog` al valor de `description`.
        *   Establece `showConfirmDialog` a `true`.
    *   **`ConfirmDialog`**:
        *   Título: `t('generateProject.confirmDialog.title')`.
        *   Contenido: Muestra el `description` actual (prompt). `Label` `t('generateProject.confirmDialog.redefinePromptLabel')` con un `Textarea` para `currentPromptForDialog`. Información sobre la configuración LLM (`t('generateProject.confirmDialog.llmConfigInfo')`).
        *   Botón Confirmar Texto: `t('generateProject.confirmDialog.confirmButton')`.
        *   Acción `onConfirm`: Llama a `handleProjectGeneration(currentPromptForDialog)`.
    *   **`handleProjectGeneration(finalPrompt: string)`**:
        *   Establece `isLoading=true`, `error=null`, `result=null`.
        *   Prepara `agentSystemPrompt` (contexto de Agente/Grupo).
        *   Llama a `callGenerateProjectStructure` con `description: finalPrompt` y `agentSystemPrompt`.
        *   Si tiene éxito, actualiza `result` y muestra `toast` (`t('generateProject.toast.projectGenerated', { projectName: aiResult.projectName })`). Construye `groupLogForDisplay` si aplica.
        *   Si falla, maneja `AppError` como en "Generar Código", mostrando `toast` (`t('generateProject.toast.generationError')`).
        *   Establece `isLoading=false` en `finally`.
    *   **`handleDownloadProject`**:
        *   Verifica si `result` y `result.files` existen.
        *   Crea una instancia de `JSZip`.
        *   Itera sobre `result.files`:
            *   Si `file.isFolder` o `file.path.endsWith('/')`, usa `zip.folder(file.path)`.
            *   Si no, usa `zip.file(file.path, file.content)`.
        *   Genera el `zipBlob` usando `zip.generateAsync({ type: "blob" })`.
        *   Crea un enlace de descarga y lo dispara. El nombre del archivo es `<projectName>.zip`.
        *   Muestra un `toast` (`t('generateProject.toast.zipDownloadSuccess', { filename, projectName })`).
    *   **`handleAutoFixError`**: Similar a "Generar Código".
*   **Dependencias:** `Card`, `Label`, `Textarea`, `Button`, `Loader2`, `Download`, `FolderPlus`, `LLMConfigSelector`, `ConfirmDialog`, `ErrorDisplay`, `FileTreeDisplay`, `LogsDisplay`, `ScrollArea`, `JSZip`, `useI18n`, `useAppState`, `useToast`, `useDebug`, `useRouter`, `apiClient.ts`.

### 2.4. Refactorizar Proyecto (`/refactorizar-proyecto`)
*   **Propósito:** Analizar un proyecto existente para obtener sugerencias de refactorización.
*   **Componente Principal:** `src/app/refactorizar-proyecto/page.tsx`. Layout de dos columnas en `lg`.
    *   **Columna 1 (Configuración):** `Card` con `PageSectionHeader`.
        *   Icono: `GitPullRequestDraft`.
        *   Título: `t('refactorProject.title')`.
        *   Descripción: `t('refactorProject.description')`.
        *   **`CardContent`** (`space-y-6`):
            *   **`LLMConfigSelector`**: Etiqueta `t('refactorProject.llmSourceLabel')`.
            *   **`Label`**: `t('refactorProject.projectSourceLabel')`.
            *   **`Select`** para `projectSourceType` (estado "upload" o "git"):
                *   Opciones: `t('refactorProject.sourceUpload')`, `t('refactorProject.sourceGit')`.
            *   **Si "upload"**: `Label` `t('refactorProject.uploadLabel')`, `Input` (type `file`, id `file-upload`, `ref={fileInputRef}`).
            *   **Si "git"**: `Label` `t('refactorProject.gitUrlLabel')`, `Input` (id `git-url`, `placeholder={t('refactorProject.gitUrlPlaceholder')}`).
            *   **`Separator`**.
            *   **`Label`**: `t('refactorProject.paramsLabel')`.
            *   **`Label`** para `refactor-goals`: `t('refactorProject.goalsLabel')`. `Textarea` (id `refactor-goals`, `placeholder={t('refactorProject.goalsPlaceholder')}`).
            *   **`Label`** para `general-priority`: `t('refactorProject.priorityLabel')`. `Select` (id `general-priority`, `placeholder={t('refactorProject.priorityPlaceholder')}`). Opciones: `t('refactorProject.priorityNone')` y las de `GENERAL_PRIORITIES` (traducidas).
            *   **`Label`** para `search-depth`: `t('refactorProject.depthLabel')`. `Input` (id `search-depth`, type `number`, `placeholder={t('refactorProject.depthPlaceholder')}`).
            *   **`Label`** para `focus-area`: `t('refactorProject.focusLabel')`. `Input` (id `focus-area`, `placeholder={t('refactorProject.focusPlaceholder')}`).
            *   **`Button`** (principal, `w-full`): Icono `Loader2` (si `isLoading`). Texto `t('refactorProject.analyzeButton')`. Acción: `handleAnalyze`.
    *   **Columna 2 (Resultados):** `Card` con `PageSectionHeader`.
        *   Icono: `ListChecks`.
        *   Título: `t('refactorProject.results.title')`.
        *   `actions`: `Button` `t('refactorProject.results.applyAllButton')` (variante `outline`, size `sm`, visible si hay sugerencias pendientes).
        *   **`CardContent`**:
            *   `ErrorDisplay` si `error`.
            *   Mensaje de carga (`t('common.processing')`) o `t('refactorProject.results.noSuggestions')`.
            *   Si `analysisResult`:
                *   `Card` anidada (`bg-muted/30`) para `analysisResult.projectOverview`. Título `t('refactorProject.results.projectSummaryCard.title')`. Icono `Info`.
                *   `Separator`.
                *   Título `t('refactorProject.results.suggestionsTitle')`.
                *   `ScrollArea` (`h-[calc(100vh-12rem)]`) con lista de `Card` por sugerencia (`suggestions`). Cada `Card`:
                    *   `CardHeader`: `CardTitle` (`s.area`), `CardDescription` (`t('refactorProject.suggestion.priorityLabel')` y `s.priority` con color condicional). Icono de estado (`BadgeHelp`, `BadgeCheck`, `BadgeX`).
                    *   `CardContent`: `s.description`. Si `s.snippetSuggested`, muestra info del snippet (original y modificado).
                    *   `CardFooter`: Botones "Ver Diff" (`t('refactorProject.suggestion.viewDiffButton')`), "Descartar" (`t('refactorProject.suggestion.discardButton')`), "Marcar como Aplicada" (`t('refactorProject.suggestion.applyButton')`) / "Revertir Estado" (`t('refactorProject.suggestion.revertStateButton')`).
                *   `LogsDisplay` si `analysisResult.groupLog`, título `t('refactorProject.logs.groupLogTitle')`.
*   **Interacciones y Lógica:**
    *   **`handleFileChange`**: Valida archivo, actualiza `uploadedFile`.
    *   **`handleAnalyze`**:
        *   Construye `projectSourceValue` (referencia a archivo o URL Git). Valida fuente.
        *   Prepara `agentSystemPrompt` (contexto de Agente/Grupo).
        *   Crea `RefactorProjectWithAIInput`.
        *   Llama a `callRefactorProjectWithAI`.
        *   Si éxito, actualiza `analysisResult` y `suggestions` (mapeando y añadiendo `id`, `status`). Muestra `toast`. Construye `groupLogForDisplay`.
        *   Si error, maneja `AppError`. Muestra `toast`.
    *   **`handleApplySuggestion`**: Cambia `status` de sugerencia a 'applied'. Muestra `toast`.
    *   **`handleViewDiff`**: Establece `currentDiff` y `showDiffModal`.
    *   **`handleDiscardSuggestion`**: Cambia `status` a 'discarded'. Muestra `toast`.
    *   **`handleApplyAll`**: Cambia `status` de todas las pendientes a 'applied'. Muestra `toast`.
    *   **`ConfirmDialog`** (para "Ver Diff"): Título `t('refactorProject.diffModal.title')`. Muestra dos `CodeBlock` para `currentDiff.original` y `currentDiff.modified`. Texto de botones `t('common.close')`.
*   **Dependencias:** Similar a "Generar Código", más `GitPullRequestDraft`, `ListChecks`, `Info`, `BadgeHelp`, `BadgeCheck`, `BadgeX`, `Separator`, `apiClient.ts`.

### 2.5. Análisis de Código Inteligente (`/analizar-codigo`)
*   **Propósito:** Análisis detallado para fragmentos o archivos.
*   **Componente Principal:** `src/app/analizar-codigo/page.tsx`.
*   **Elementos de UI:**
    *   **`PageSectionHeader`**:
        *   Icono: `ScanLine`.
        *   Título: `t('analyzeCode.title')`.
        *   Descripción: `t('analyzeCode.description')`.
    *   **`CardContent`** (`space-y-6`):
        *   **`LLMConfigSelector`**: Etiqueta `t('common.llmSourceLabel')`.
        *   Div con borde (`border rounded-md p-4`):
            *   `Label` (semibold): `t('analyzeCode.codeSourceLabel')`.
            *   `Label` para `file-upload-code`: `t('analyzeCode.uploadFileLabel')`. `Input` (type `file`, id `file-upload-code`, `ref={fileInputRef}`).
            *   `Label` para `git-file-url`: `t('analyzeCode.gitFileUrlLabel')`. `Input` (id `git-file-url`, `placeholder={t('analyzeCode.gitFileUrlPlaceholder')}`). Botón `t('analyzeCode.fetchUrlButton')`.
            *   Div separador con texto: `t('analyzeCode.pasteCodeInstruction')`.
            *   **`CodeEditor`** (componente personalizado):
                *   Prop `id`: "analizar-codigo-main".
                *   Prop `value`: Estado `codeToAnalyze`.
                *   Prop `onChange`: `setCodeToAnalyze`.
                *   Prop `placeholder`: `t('analyzeCode.pasteCodePlaceholder')`.
                *   Prop `rows`: 10.
            *   `Label` para `user-analysis-prompt`: `t('analyzeCode.additionalInstructionsLabel')`. `Textarea` (id `user-analysis-prompt`, `placeholder={t('analyzeCode.additionalInstructionsPlaceholder')}`, `rows={2}`).
        *   **`Button`** (principal, `w-full`): Icono `Loader2` (si `isLoading`). Texto `t('analyzeCode.analyzeButton')`. Acción: `handleAnalyze`.
        *   **`ErrorDisplay`**: Si `error` existe.
        *   **Resultados (si `result` existe):**
            *   Título: `t('analyzeCode.results.explanationLabel')` (h3). Párrafo con `result.explanation`.
            *   Título: `t('analyzeCode.results.originalCodeLabel')` (h3). Botón `t('analyzeCode.results.saveOriginalButton')` (outline, size sm, icono `Save`). `CodeBlock` con `result.originalCode`.
            *   Título: `t('analyzeCode.results.suggestedCodeLabel')` (h3). Botón `t('analyzeCode.results.saveSuggestedButton')` (outline, size sm, icono `Save`). `CodeBlock` con `result.suggestedCode`.
*   **Interacciones y Lógica:**
    *   **`handleFileChange`**: Lee archivo de texto, actualiza `codeToAnalyze`. Valida tipo y tamaño.
    *   **`handleFetchFromUrl`**: Obtiene contenido de `fileUrl` (usando `fetch`). Actualiza `codeToAnalyze`. Muestra `toast`.
    *   **`handleAnalyze`**:
        *   Valida `codeToAnalyze`.
        *   Prepara `AnalyzeCodeSnippetInput` (incluye `codeToAnalyze`, `userAnalysisPrompt`, `agentSystemPrompt`).
        *   Llama a `callAnalyzeCodeSnippet`.
        *   Si éxito, actualiza `result`. Muestra `toast`.
        *   Si error, maneja `AppError`. Muestra `toast`.
    *   **`handleSaveSnapshot(type: 'original' | 'suggested')`**:
        *   Crea un nombre para el snapshot (ej. `t('analyzeCode.results.snapshotName', { type, time })`).
        *   Llama a `addSnapshot` de `AppStateContext`.
    *   **`handleAutoFixError`**: Similar a otras páginas.
*   **Dependencias:** `Save`, `ScanLine`, `CodeEditor`, y otras comunes.

### 2.6. Análisis de Proyecto Completo (`/analizar-proyecto`)
*   **Propósito:** Análisis holístico de proyectos.
*   **Componente Principal:** `src/app/analizar-proyecto/page.tsx`.
*   **Elementos de UI:**
    *   **`PageSectionHeader`**:
        *   Icono: `FolderSearch`.
        *   Título: `t('analyzeProject.title')`.
        *   Descripción: `t('analyzeProject.description')`.
    *   **`CardContent`** (`space-y-6`):
        *   **`LLMConfigSelector`**: Etiqueta `t('analyzeProject.llmSourceLabel')`.
        *   **`Label`**: `t('analyzeProject.projectSourceLabel')`.
        *   **`Select`** para `projectSourceType` (estado "upload" o "git"). Opciones `t('analyzeProject.sourceUpload')`, `t('analyzeProject.sourceGit')`.
        *   Si "upload": `Label` `t('analyzeProject.uploadLabel')`, `Input` (type `file`, id `project-file-upload`, `ref={fileInputRef}`, `accept=".zip,.json"`).
        *   Si "git": `Label` `t('analyzeProject.gitUrlLabel')`, `Input` (id `project-git-url`, `placeholder={t('analyzeProject.gitUrlPlaceholder')}`).
        *   **`Separator`**.
        *   **`Label`**: `t('analyzeProject.paramsLabel')`.
        *   `Label` para `search-depth-project`: `t('analyzeProject.depthLabel')`. `Input` (type `number`, `placeholder={t('analyzeProject.depthPlaceholder')}`).
        *   `Label` para `focus-area-project`: `t('analyzeProject.focusLabel')`. `Input` (`placeholder={t('analyzeProject.focusPlaceholder')}`).
        *   **`Button`** (principal, `w-full`): Icono `Loader2` (si `isLoading`). Texto `t('analyzeProject.analyzeButton')`. Acción: `handleAnalyze`.
        *   **`ErrorDisplay`**: Si `error` existe.
        *   Mensaje de carga: (`t('analyzeProject.results.analyzing')`).
        *   **Resultados (si `result` existe):** `Card` anidada (`bg-background`).
            *   `PageSectionHeader` interno: Icono `ListChecks`, Título `result.analysisTitle`.
            *   `CardContent`:
                *   `t('analyzeProject.results.overallAssessmentLabel')`: `result.generalAssessment`.
                *   `t('analyzeProject.results.improvementIdeasLabel')`: Lista de `result.overallImprovementIdeas`.
                *   `t('analyzeProject.results.identifiedAreasLabel')`: Lista de `result.identifiedAreas`.
                *   `t('analyzeProject.results.specificSuggestionsLabel')`: `ScrollArea` (`h-60`) con lista de sugerencias (área, sugerencia, prioridad, prompt sugerido). Usa `t('analyzeProject.results.suggestionPriorityLabel')` y `t('analyzeProject.results.suggestedPromptLabel')`.
                *   `LogsDisplay` si `result.groupLog`, título `t('analyzeProject.results.groupLogTitle')`.
*   **Interacciones y Lógica:**
    *   **`handleFileChange`**: Valida archivo ZIP/JSON. Actualiza `uploadedFile`.
    *   **`handleAnalyze`**:
        *   Prepara `AnalyzeCodeInput`:
            *   `sourceCodeLocation`: 'UploadedString' o 'Git'.
            *   `projectContent`: Contenido del archivo JSON si se subió JSON, o una referencia al ZIP.
            *   `gitRepoUrl`: Si es Git.
            *   `analysisPreferences`/`focusArea`, `searchDepth`, `agentSystemPrompt`.
        *   Llama a `analyzeProjectFlow` (alias de `callAnalyzeSelfCode`).
        *   Si éxito, actualiza `result`. Muestra `toast`. Construye `groupLogForDisplay`.
        *   Si error, maneja `AppError`. Muestra `toast`.
*   **Dependencias:** `FolderSearch`, `ListChecks`, `Info`, y otras comunes.

### 2.7. AutoUpdate (Análisis del Propio Código) (`/autoupdate`)
*   **Propósito:** CodeAlchemist analiza su propio código.
*   **Componente Principal:** `src/app/autoupdate/page.tsx`. Utiliza componentes `AutoUpdateConfigForm` y `AutoUpdateResultsDisplay`.
*   **`AutoUpdateConfigForm`** (`src/components/features/autoupdate/AutoUpdateConfigForm.tsx`):
    *   **`PageSectionHeader`**: Icono `Sparkles`, título `t('autoupdate.config.title')`, descripción `t('autoupdate.config.description')`.
    *   **`CardContent`**:
        *   `LLMConfigSelector`: Etiqueta `t('autoupdate.config.llmSourceLabel')`.
        *   `Label`: `t('autoupdate.config.codeSourceLabel')`. `Select` para `sourceType` ("Local", "Git"). Opciones `t('autoupdate.config.sourceLocal')`, `t('autoupdate.config.sourceGit')`.
        *   Si "Git": `Label` `t('autoupdate.config.gitUrlLabel')`, `Input` `t('autoupdate.config.gitUrlPlaceholder')`.
        *   `Label`: `t('autoupdate.config.analysisParamsLabel')`.
        *   `Label`: `t('autoupdate.config.analysisPrefsLabel')`. `Textarea` `t('autoupdate.config.analysisPrefsPlaceholder')`.
        *   `Button` (principal): Icono `Sparkles` o `Loader2`. Texto `t('autoupdate.config.startButton')` o `t('autoupdate.config.startButtonLoading')`.
        *   `Progress` bar (visible si `isAnalysisInProgress`).
*   **`AutoUpdateResultsDisplay`** (`src/components/features/autoupdate/AutoUpdateResultsDisplay.tsx`):
    *   **`PageSectionHeader`**: Icono `ClipboardList`, título `t('autoupdate.results.title')`.
        *   `actions`: Botones `t('autoupdate.results.downloadSuggestionsJson')` (icono `Download`), `t('autoupdate.results.downloadProjectZip')` (icono `FileArchive`), `t('autoupdate.results.uploadToGit')` (icono `GitCommit`).
    *   **`CardContent`**:
        *   `ErrorDisplay` si `analysisError`. Mensaje de carga o `t('autoupdate.results.noResults')`.
        *   Si `analysisResult`: Muestra `analysisResult.analysisTitle`, `analysisResult.generalAssessment`, `analysisResult.overallImprovementIdeas` (con `t('autoupdate.results.overallImprovementIdeasLabel')`).
        *   `ScrollArea` para lista de `AutoUpdateSuggestionCard`. Título `t('autoupdate.results.detailedSuggestionsLabel')`.
        *   Si `unifiedPrompt`, se muestra con `CodeBlock` y `Label` `t('autoupdate.results.unifiedPromptLabel')`.
*   **`AutoUpdateSuggestionCard`** (`src/components/features/autoupdate/autoupdate-suggestion-card.tsx`):
    *   `CardHeader`: `area`, `priority` (con `t('autoupdate.suggestionCard.priorityLabel')`). Icono de estado.
    *   `CardContent`: `suggestion`. Si `suggestedPromptForImplementation`, se muestra con `Label` `t('autoupdate.suggestionCard.promptLabel')` y botón `Copy`.
    *   Si `isEditing`: `Textarea` para `userEditedContent` con `Label` `t('autoupdate.suggestionCard.editContentLabel')`.
    *   `CardFooter`: Botones "Editar" (`t('common.edit')`), "Guardar Edición" (`t('autoupdate.suggestionCard.saveEditButton')`), "Cancelar" (`t('common.cancel')`), "Testear" (`t('common.test')`), "Testear en Ent. Virtual" (`t('autoupdate.suggestionCard.testInVenvButton')`), "Aplicar" (`t('common.apply')`).
*   **Diálogos en `autoupdate/page.tsx`**:
    *   `ConfirmDialog` para aplicar sugerencia: Título `t('autoupdate.dialogs.applySuggestion.title')`, descripción `t('autoupdate.dialogs.applySuggestion.description.p1')` y `p2`.
    *   `Dialog` para testear: Título `t('autoupdate.dialogs.testSuggestion.title')`.
    *   `Dialog` para testear en VENV: Título `t('autoupdate.dialogs.testInVenv.title')`. Botón `t('autoupdate.dialogs.testInVenv.simulateButton')`.
    *   `ConfirmDialog` para commit Git: Título `t('autoupdate.dialogs.commitToGit.title')`.
    *   `LogsDisplay` para `detailedLogs`: Título `t('autoupdate.logs.detailedExecutionLogsTitle')`.
*   **Interacciones y Lógica (`autoupdate/page.tsx`):**
    *   **`handleStartAnalysis`**:
        *   Si `sourceType` es "Local", llama a Server Action `getApplicationSourceBundle`.
        *   Prepara `AnalyzeCodeInput`. Llama a `callAnalyzeSelfCode`.
        *   Procesa resultados en `_executeAnalysisAndProcessResults` (mapea sugerencias, genera `unifiedPrompt`, construye `groupLog`).
    *   **Manejo de Sugerencias**: `handleApplySuggestionClick`, `confirmApplySuggestion`, `handleToggleEdit`, `handleSuggestionContentChange`, `handleSaveEdit`, `handleCancelEdit`, `handleTestSuggestionClick`, `handleTestInVenvClick`.
    *   **`handleDownload`**:
        *   Si `JSON_SUGGESTIONS`: Crea JSON con `area` y contenido de sugerencias. Descarga como `t('autoupdate.downloads.suggestionsJsonFilename')`.
        *   Si `ZIP_PROJECT`: Llama a `getApplicationSourceBundle`. Aplica sugerencias marcadas en memoria. Usa `JSZip` para crear y descargar `t('autoupdate.downloads.projectZipFilename')` (antes era `currentCodeZipFilename`). El toast aclara que es ZIP con JSON de cambios.
    *   **`performGitUpload`**: Llama a Server Action `handleUploadToGit`.
    *   **`handleAutoFixError`**: Llama a `callAutoFixErrorWithGroup`.
*   **Server Actions (`src/app/autoupdate/actions.ts`):**
    *   **`getApplicationSourceBundle`**: Lee archivos del proyecto en servidor usando `fs`, `glob`, `path`. Ignora patrones. Devuelve `AppSourceFile[]`.
    *   **`handleUploadToGit`**: Usa `simple-git`. Clona, copia archivos (obtenidos con `getApplicationSourceBundle`), configura, `add`, `commit`, `addRemote`/`set-url`, `push --force`. Devuelve `GitUploadResult`.
*   **Dependencias:** Componentes `AutoUpdate*`, `Sparkles`, `ClipboardList`, `Download`, `GitCommit`, `FileArchive`, `Progress`, `JSZip`, `apiClient.ts`, Server Actions.

### 2.8. Versiones Guardadas (Snapshots) (`/versiones-guardadas`)
*   **Propósito:** Gestiona instantáneas de código o estado.
*   **Componente Principal:** `src/app/versiones-guardadas/page.tsx`.
*   **Elementos de UI:**
    *   **`PageSectionHeader`**: Icono `GitCompareArrows`. Título `t('versions.title')`. Descripción `t('versions.description')`.
        *   `actions`: Botones `t('versions.compareButton')`, `t('versions.deleteAllButton')`.
    *   **`CardContent`**:
        *   Botón `t('versions.saveAppStateButton')` con texto descriptivo `t('versions.saveAppStateDescription')`.
        *   Botón `t('versions.saveAndDownloadStateButton')` con texto descriptivo `t('versions.saveAndDownloadStateDescription')`.
        *   `ScrollArea` con `Table`:
            *   `TableHeader`: Columnas `t('versions.table.colA')`, `t('versions.table.colB')`, `t('versions.table.colName')`, `t('versions.table.colCreatedAt')`, `t('versions.table.colSource')`, `t('versions.table.colActions')`.
            *   `TableBody`: Filas por snapshot. `Checkbox` (iconos `CheckSquare`/`Square`) para selección A/B. Info del snapshot. Botones de acción en `DropdownMenu`:
                *   `t('versions.action.view')` (icono `Eye`).
                *   `t('versions.action.downloadOriginal', { format: 'JSON' })` o `TXT` (icono `Download`).
                *   `t('versions.action.downloadZip')` (icono `Download`).
                *   `t('versions.action.delete')` (icono `Trash2`).
*   **Interacciones y Lógica:**
    *   **`handleSaveCurrentAppState(downloadAsZip: boolean)`**: Guarda el estado de la aplicación (`settings`, `agents`, `groups`) como JSON en un snapshot. Si `downloadAsZip` es `true`, también lo descarga como ZIP.
    *   **`handleDownloadSnapshot(snapshot: CodeSnapshot, format: 'original' | 'zip')`**: Descarga el snapshot. Si `format` es 'zip', usa extensión `.zip`.
    *   **`handleViewSnapshot`**: Muestra `ConfirmDialog` con `CodeBlock` del snapshot. Título `t('versions.viewModal.title')`.
    *   **`handleDeleteSnapshot`**: Abre `ConfirmDialog`. Título `t('versions.deleteSingleModal.title')`.
    *   **`confirmDeleteSnapshot`, `confirmDeleteAllSnapshots`**.
    *   **`toggleCompareSelection`, `handleCompareVersions`**: Muestra `ConfirmDialog` con dos `CodeBlock` para comparación. Título `t('versions.compareModal.title')`.
*   **Dependencias:** `GitCompareArrows`, `CheckSquare`, `Square`, `Eye`, `Download`, `Trash2`, `DropdownMenu`, `Checkbox`, `Table`, `CodeBlock`, `ConfirmDialog`, `ScrollArea`.

### 2.9. Chat con IA (`/chat-ia`)
*   **Propósito:** Interactúa con un asistente IA.
*   **Componente Principal:** `src/app/chat-ia/page.tsx`.
*   **Elementos de UI:** `Card` (`h-full flex flex-col`).
    *   **`PageSectionHeader`**: Icono `MessageCircle`. Título `t('chat.title')`. Descripción `t('chat.description')`.
    *   **`CardContent`** (`flex-1 overflow-hidden p-0 flex flex-col`):
        *   Div (`p-4 border-b`): `LLMConfigSelector`.
        *   `ScrollArea` (`flex-1 p-4`): Muestra `messages`. Cada mensaje con icono (`User`, `Bot`, `AlertTriangleIcon`), rol (ej. `t('chat.agent.user')`), contenido y timestamp.
    *   **`CardFooter`** (`p-4 border-t`):
        *   `ErrorDisplay` si `error`.
        *   `Textarea` para `currentMessage` (placeholder `t('chat.inputPlaceholder')`).
        *   `Button` (Enviar, icono `Send`, texto `t('chat.sendButton')`).
        *   `Button` (Borrar Chat, icono `Trash2`, texto `t('chat.clearButton')`).
*   **Interacciones y Lógica:**
    *   **`handleSendMessage`**:
        *   Añade mensaje de usuario a `messages`.
        *   Llama a `callChatWithAgentOrGlobal` o `callChatWithAIGroup` (de `apiClient.ts`) según `llmConfigSource`.
        *   Añade respuesta de IA o mensaje de error del sistema a `messages`. Muestra `toast`.
    *   **`handleClearChat`**: Limpia `messages`. Muestra `toast`.
    *   **`handleAutoFixError`**: Llama a `callAutoFixErrorWithGroup`.
*   **Dependencias:** `MessageCircle`, `Send`, `Bot`, `User`, `AlertTriangleIcon`, `Textarea`, `ScrollArea`.

### 2.10. Gestión de Agentes IA (`/agentes-ia`)
*   **Propósito:** Crea, configura, prueba y gestiona agentes.
*   **Componente Principal:** `src/app/agentes-ia/page.tsx`.
*   **Elementos de UI:**
    *   **`PageSectionHeader`**: Icono `Users2`. Título `t('agents.title')`. Descripción `t('agents.description')`.
        *   `actions`: Botones `t('agents.createWithAIButton')` (icono `SparklesIcon`), `t('agents.importButton')` (icono `Upload`), `t('agents.exportAllButton')` (icono `Download`), `t('agents.createAgentButton')` (icono `PlusCircle`).
    *   **`CardContent`**:
        *   Mensaje `t('agents.noAgentsMessage')` si lista vacía.
        *   Grid de `Card` por agente. Cada `Card`:
            *   `CardHeader`: `CardTitle` (`agent.name` y badge `t('agents.defaultAgentBadge')`), `CardDescription` (`agent.description`).
            *   `CardContent`: Info LLM (`t('agents.llmLabel')`, formato `t('agents.llmGlobalFormat')` o `t('agents.llmCustomFormat')`). Capacidades (`t('agents.capabilitiesLabel')`, `t('agents.form.capability.[key]')` o `t('agents.noCapabilities')`).
            *   `CardFooter`: Botones (icono) `t('agents.action.test')` (`PlayCircle`), `t('agents.action.export')` (`Download`), `t('agents.action.edit')` (`Edit3`), `t('agents.action.delete')` (`Trash2`).
    *   **`AgentForm`** (`src/components/features/agentes-ia/agent-form.tsx`): Componente en diálogo.
        *   `DialogTitle`: `t('agents.form.title.edit')` o `create` o `reviewSuggestion`.
        *   `DialogDescription`: `t('agents.form.descriptionModal.edit')` o `create`.
        *   `ScrollArea` con campos: `Label` y `Input` para nombre (`t('agents.form.label.name')`). `Textarea` para descripción (`t('agents.form.label.description')`) y prompt (`t('agents.form.label.systemPrompt')`, `placeholder={t('agents.form.placeholder.systemPrompt')}`).
        *   `Label` `t('agents.form.label.capabilities')`. Switches para capacidades (ej. `t('agents.form.capability.accessOwnCode')`). Tooltip `t('agents.form.capability.dangerousTooltip')`.
        *   `Label` `t('agents.form.label.llmConfig')`. Switch `t('agents.form.llm.useGlobal')`. Campos para config personalizada (`t('agents.form.llm.custom.providerLabel')`, etc.).
        *   Botones: `t('common.cancel')`, `t('agents.form.button.saveChanges')` o `createAgent` o `createAgentWithSuggestion`.
    *   **`ConfirmDialog`** para eliminar: Título `t('agents.deleteSingleModal.title')`, descripción `t('agents.deleteSingleModal.description')`.
    *   **`AgentTestChat`** (`src/components/features/agentes-ia/agent-test-chat.tsx`): Componente en diálogo.
        *   Título `t('agents.testChatDialog.title')`. Descripción `t('agents.testChatDialog.description')`. Mensaje de sistema `t('agents.testChatDialog.systemMessage')`. Placeholder `t('agents.testChatDialog.inputPlaceholder')`. Botón `t('agents.testChatDialog.sendButton')`. Texto "pensando" `t('agents.testChatDialog.thinking')`.
    *   **`AISuggestionDialog`** (`src/components/features/common/AISuggestionDialog.tsx`):
        *   Título `t('agents.suggestionDialog.title')`. Descripción `t('agents.suggestionDialog.description')`. Label `t('agents.suggestionDialog.textareaLabel')`. Placeholder `t('agents.suggestionDialog.textareaPlaceholder')`. Botón `t('agents.suggestionDialog.submitButton')`.
*   **Interacciones y Lógica:**
    *   **`handleOpenForm`**: Abre `AgentForm` (para crear/editar/revisar). Helper `_prepareEditingAgentStateFromSuggestion` para sugerencias.
    *   **`handleSubmitAgentForm`**: Llama a `addAgent` o `updateAgent`. Muestra `toast`.
    *   **`handleDeleteAgent`**: Abre `ConfirmDialog`.
    *   **`confirmDeleteAgent`**: Llama a `deleteAgent`. Muestra `toast`.
    *   **`handleImportAgents`**, **`handleExportAgents`**, **`handleExportSingleAgent`**.
    *   **`handleTestAgent`**: Abre `AgentTestChat`.
    *   **`handleSuggestAgent`**: Abre `AISuggestionDialog`, llama a `callSuggestAgentDefinition`. Muestra `toast`. Si error, maneja `AppError`.
*   **Dependencias:** `SparklesIcon`, `PlusCircle`, `Edit3`, `PlayCircle`, `Upload`, `Download`, `AgentForm`, `AgentTestChat`, `AISuggestionDialog`, `ConfirmDialog`.

### 2.11. Gestión de Grupos de Trabajo IA (`/grupos-trabajo-ia`)
*   **Propósito:** Define equipos de agentes.
*   **Componente Principal:** `src/app/grupos-trabajo-ia/page.tsx`.
*   **Elementos de UI:**
    *   **`PageSectionHeader`**: Icono `Workflow`. Título `t('groups.title')`. Descripción `t('groups.description')`.
        *   `actions`: Botones `t('groups.createWithAIButton')` (icono `SparklesIcon`), `t('groups.createGroupButton')` (icono `PlusCircle`).
    *   **`CardContent`**: Mensaje `t('groups.noGroupsMessage')` si lista vacía. Grid de `Card` por grupo. Cada `Card`:
        *   `CardHeader`: `CardTitle` (`group.name`, badge `t('groups.defaultGroupBadge')`), `CardDescription`.
        *   `CardContent`: `t('groups.agentsLabel')` (formato `t('groups.agentsCountFormat')`), `t('groups.taskLabel')` (`group.mainTask`).
        *   `CardFooter`: Botones (icono) `t('groups.action.execute')` (`Play`), `t('groups.action.edit')` (`Edit3`), `t('groups.action.delete')` (`Trash2`).
    *   **Formulario de Grupo (en `Dialog`)**:
        *   `DialogHeader`: `DialogTitle` (ej. `t('groups.form.title.edit')`), `DialogDescriptionComponent` (ej. `t('groups.form.descriptionModal.create')`).
        *   `ScrollArea` con campos: `Label` y `Input` para nombre (`t('groups.form.label.name')`). `Textarea` para descripción (`t('groups.form.label.description')`) y tarea principal (`t('groups.form.label.mainTask')`, `placeholder={t('groups.form.placeholder.mainTask')}`).
        *   `Label` `t('groups.form.label.selectAgents')`. Nota `t('groups.form.orchestratorImplicitNote')`. Lista de `Checkbox` para agentes. Error `t('groups.form.noAgentsToSelectError')` si no hay agentes.
        *   `DialogFooter`: Botones `t('common.cancel')`, `t('groups.form.button.saveChanges')` o similar.
    *   **`ConfirmDialog`** para eliminar: Título `t('groups.deleteSingleModal.title')`, descripción `t('groups.deleteSingleModal.description')`.
    *   **`Dialog` para ejecución de grupo**: Título `t('groups.executionModal.title')`. Muestra `LogsDisplay` (título `t('groups.executionModal.logTitle')`). Botón `t('groups.executionModal.stopButton')`.
    *   **`AISuggestionDialog`**: Título `t('groups.suggestionDialog.title')`. Footer `t('groups.suggestionDialog.noAgentsWarning')`. Botón `t('groups.suggestionDialog.submitButton')` o `t('groups.suggestionDialog.submitButtonDisabled')`.
*   **Interacciones y Lógica:**
    *   **`handleOpenForm`**, **`handleSubmitForm`**, **`handleDeleteGroup`**, **`confirmDeleteGroup`**.
    *   **`handleExecuteGroup`**: Inicia bucle (`MAX_EXECUTION_TURNS`). Llama a `callChatWithAIGroup` (para el orquestador) y `callChatWithAgentOrGlobal` (para agentes). Actualiza `executionLog` con mensajes traducidos (ej. `t('groups.execution.log.turnPrefix')`).
    *   **`handleSuggestGroup`**: Llama a `callSuggestGroupDefinition`.
*   **Dependencias:** `Workflow`, `SparklesIcon`, `Play`, y otras comunes.

### 2.12. Configuración (`/configuracion`)
*   **Propósito:** Ajustar parámetros globales.
*   **Componente Principal:** `src/app/configuracion/page.tsx`.
*   **Elementos de UI:** `Card` principal con `PageSectionHeader`.
    *   Icono: `SettingsIcon`. Título: `t('settings.title')`. Descripción: `t('settings.description')`.
    *   `actions`: Botones `t('settings.importButton')` (`Upload`), `t('settings.exportButton')` (`Download`), `t('settings.saveButton')` (`Save`).
    *   **`CardContent`** (`space-y-8`): Múltiples `Card` anidadas:
        *   **LLM**: `CardHeader` (`t('settings.llm.title')`, `t('settings.llm.description')`). `CardContent` con:
            *   `Label` `t('settings.llm.providerLabel')`. `Select` con `LLM_PROVIDERS`. Placeholder `t('settings.llm.providerPlaceholder')`.
            *   `Label` `t('settings.llm.apiUrlLabel')`. `Input` placeholder `t('settings.llm.apiUrlPlaceholder')`. Descripción `t('settings.llm.apiUrlDescription')`.
            *   `Label` `t('settings.llm.apiKeyLabel')`. `Input` (type `password`) placeholder `t('settings.llm.apiKeyPlaceholder')`.
            *   `Label` `t('settings.llm.modelNameLabel')`. `Select` placeholder (varía según proveedor, ej. `t('settings.llm.modelNamePlaceholderLocal')`). Descripción `t('settings.llm.modelNameDescriptionLocal')`.
            *   `CardFooter`: `Button` `t('settings.llm.testConnectionButton')` o `t('settings.llm.testingConnectionButton')`. Icono `Loader2`.
        *   **Git**: `CardHeader` (`t('settings.git.title')`, `t('settings.git.description')`). `CardContent` con `Label` `t('settings.git.repoUrlLabel')`, etc. `CardFooter` con `Button` `t('settings.git.testConnectionButton')`.
        *   **Idioma**: `CardHeader` (`t('settings.language.title')`, `t('settings.language.description')`). `CardContent` con `Label` `t('settings.language.selectLabel')`, `Select` con `SUPPORTED_LANGUAGES`. Placeholder `t('settings.language.selectPlaceholder')`.
        *   **Debug**: `CardHeader` (`t('settings.debug.title')`, `t('settings.debug.description')`). `CardContent` con `Switch` y `Label` `t('settings.debug.switchLabel')`.
*   **Interacciones y Lógica:**
    *   Cambios en campos actualizan estado local. `handleSaveSettings` actualiza `AppStateContext` y muestra `toast` (`t('settings.toast.saved')`).
    *   `handleTestLLM`, `handleTestGit` (simulados, muestran toasts).
    *   `handleExportConfig`, `handleImportConfig` (manejan JSON de `AppSettings`). Muestran toasts.
    *   `fetchAndSetGroqModels`: Llama a Server Action `getGroqModels`. Muestra toasts (`t('settings.toast.groqModelsLoadSuccess')`, etc.).
*   **Dependencias:** `SettingsIcon`, `Loader2`, `Upload`, `Download`, `Save`, `Input`, `Select`, `Switch`, `Separator`.

### 2.13. Funcionalidad Multiidioma
*   **Mecanismo:** Se utiliza un `I18nContext` (`src/context/I18nContext.tsx`) que provee una función `t(key: TranslationKey, params?: Record<string, string | number>)` y el idioma actual (`language`). El idioma se persiste en `localStorage` a través de `AppStateContext` (`settings.language`).
*   **Idiomas Soportados:** Español (`es`, por defecto) e Inglés (`en`). Definidos en `src/lib/i18n/constants.ts` (`SUPPORTED_LANGUAGES`).
*   **Archivos de Traducción:** `src/lib/i18n/translations.ts` contiene un objeto `translationsData` con las cadenas para cada idioma.
    *   **Estructura:** Anidada para reflejar las claves (ej. `es: { sidebar: { dashboard: "Panel de Control" } }`).
*   **Resolución de Claves:** La función `t()` usa una helper `getNestedTranslation` que resuelve claves anidadas (ej. "sidebar.dashboard"). Si no se encuentra una traducción para el idioma activo, intenta con el idioma por defecto. Si sigue sin encontrarse, devuelve la clave literal y registra un error en consola.
*   **Ejemplos:**
    *   Barra Lateral: `t('sidebar.dashboard')` muestra "Panel de Control" o "Dashboard".
    *   Página de Configuración: `t('settings.llm.title')` muestra "Configuración del Proveedor LLM" o "LLM Provider Settings".

## 3. Interfaz de Usuario (UI) - Más Detalles

### 3.1. Estructura de la Aplicación
*   **Layout Principal:** `src/app/layout.tsx` define `<html>` y `<body>`. Incluye los proveedores de contexto (`AppStateProvider`, `DebugProvider`, `I18nProvider`).
*   **Layout de Aplicación:** `src/components/layout/AppLayout.tsx` implementa la barra lateral y cabecera superior.
    *   Utiliza `Sidebar` de `@/components/ui/sidebar`. La barra lateral es colapsable en escritorio (botón `CollapsibleSidebarButton` en `SidebarHeader` con `ChevronsLeft`/`ChevronsRight`). Se convierte en `Sheet` en móviles (disparador `SidebarTrigger` con `MenuIcon` en la cabecera principal).
    *   La cabecera principal muestra el icono y título de la sección actual (traducidos).

### 3.2. Estilos Visuales
Definidos en `src/app/globals.css` y `tailwind.config.ts`.
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
    *   `--input`: `210 17% 85%` (#D0D6DB) - Fondo de inputs.
    *   `--ring`: `174 60% 40%` (#26A69A) - Anillo de enfoque (teal).
    *   **Sidebar (Modo Claro):**
        *   `--sidebar-background`: `220 13% 95%` (#F0F2F5).
        *   `--sidebar-foreground`: `233 30% 25%` (#343E54).
*   **Paleta de Colores (Modo Oscuro):** Definida en `globals.css` bajo `.dark { ... }`.
    *   `--background`: `233 30% 12%` (#171C26).
    *   `--foreground`: `210 17% 85%` (#D0D6DB).
    *   (Se listan los equivalentes oscuros para las demás variables).
*   **Tipografía:**
    *   Fuente Principal (Sans-serif): Geist Sans (de `geist/font/sans`). Aplicada al `body`.
    *   Fuente Monoespaciada: Geist Mono (de `geist/font/mono`). Usada para bloques de código, logs.
*   **Iconografía:**
    *   Biblioteca Principal: Lucide Icons (`lucide-react`).
    *   Logo de la Aplicación: `FlaskConical`. Color: `text-primary`.
*   **Layout General:**
    *   Diseño responsivo (clases Tailwind CSS).
    *   Esquinas redondeadas: `--radius` (0.5rem), `rounded-lg`, `rounded-md`, `rounded-sm`.
    *   Sombras: `shadow-sm`, `shadow-md`, `shadow-lg`.
*   **Animaciones y Transiciones:**
    *   Definidas por Tailwind/ShadCN para hover, focus. Animaciones de acordeón (`accordion-down`, `accordion-up`) en `tailwind.config.ts`. Animaciones de entrada/salida para diálogos/popovers (Radix UI/ShadCN).

## 4. Lógica y Backend

### 4.1. Servicios y Endpoints (Flujos Genkit)
La lógica de IA se maneja mediante flujos Genkit en `src/ai/flows/`. Llamados desde el frontend vía `apiClient.ts`.
*   **`generateCodeFromDescriptionFlow`**: Input `GenerateCodeFromDescriptionInput`, Output `GenerateCodeFromDescriptionOutput`.
*   **`generateProjectStructureFlow`**: Input `GenerateProjectInput`, Output `ProjectGenerationResult`.
*   **`refactorProjectWithAIFlow`**: Input `RefactorProjectWithAIInput`, Output `RefactorProjectWithAIOutput`.
*   **`analyzeCodeSnippetFlow`**: Input `AnalyzeCodeSnippetInput`, Output `AnalyzeCodeSnippetOutput`.
*   **`analyzeSelfCodeFlow`**: Input `AnalyzeCodeInput`, Output `AnalyzeCodeOutput`.
*   **`chatWithAgentOrGlobalFlow`**: Input `ChatWithAgentOrGlobalInput`, Output `ChatWithAgentOrGlobalOutput`.
*   **`chatWithAIGroupFlow`**: Input `ChatWithAIGroupInput`, Output `ChatWithAIGroupOutput`.
*   **`suggestAgentDefinitionFlow`**: Input `SuggestAgentDefinitionInput`, Output `SuggestAgentDefinitionOutput`.
*   **`suggestGroupDefinitionFlow`**: Input `SuggestGroupDefinitionInput`, Output `SuggestGroupDefinitionOutput`.
*   **`autoFixErrorWithGroupFlow`**: Input `AutoFixErrorWithGroupInput`, Output `AutoFixErrorWithGroupOutput`.
*   **Manejo de Errores en Flujos:** `apiClient.ts` captura errores de flujos, los parsea a `AppError` y los relanza para la UI. Implementa reintentos.

### 4.2. Server Actions
*   **`src/app/autoupdate/actions.ts`**:
    *   **`getApplicationSourceBundle`**: Lee archivos del proyecto del servidor (raíz de Next.js) usando `fs`, `glob`. Ignora patrones en `ignorePatterns`. Devuelve `Promise<{ success: boolean; files?: AppSourceFile[]; error?: string; logsBuilt?: string[]; }>`.
    *   **`handleUploadToGit`**: Usa `simple-git`. Llama a `getApplicationSourceBundle`. Crea dir temporal. Realiza `init`, `addConfig`, `add`, `commit`, `addRemote`/`set-url`, y `push -u origin <defaultBranch> --force`. Devuelve `Promise<GitUploadResult>`.
*   **`src/app/configuracion/actions.ts`**:
    *   **`getGroqModels`**: Usa `groq-sdk` (`new Groq({ apiKey })`) para llamar a `groq.models.list()`. Extrae los IDs de los modelos. Devuelve `Promise<{ success: boolean; models?: string[]; error?: string; debug?: any; }>`.

### 4.3. Bases de Datos
No hay base de datos backend tradicional. El estado (configuraciones, agentes, grupos, snapshots, idioma) se persiste en `localStorage` del navegador vía `useLocalStorage` y `AppStateContext`.

### 4.4. Agentes y Grupos (Por Defecto)
Definidos en `src/lib/constants.ts` (`DEFAULT_AGENTS`, `DEFAULT_GROUPS`).
*   **Agentes por Defecto:**
    *   **`OrquestadorFlujoAgentes`**: ID `orquestador-flujo-agentes`. Prompt: "...Devolver tu decisión en formato JSON estricto: `{\"next_agent_id\": \"id_del_agente_o_COMPLETADO\", \"instruction_for_next_agent\": \"tu_instruccion_o_resumen_final\", \"reasoning\": \"breve_explicacion_de_tu_eleccion\"}`...". No editable, no eliminable.
    *   **`RefactorizadorCodigoExperto`**: ID `refactorizador-codigo-experto`. Prompt: "...Devolver en JSON con `area`, `description`, `priority`, `snippetSuggested`, `fullFileContentSuggested`...".
    *   **`JefeDeProducto`**, **`ArquitectoSoftware`**, **`DesarrolladorSoftware`** (caps: `accessOwnCode`, `execution`, `readWrite`), **`IngenieroPruebas`** (caps: `accessOwnCode`, `execution`), **`IngenieroDevOps`** (caps: `execution`, `virtualEnv`, `readWrite`), **`RepresentanteUsuario`**, **`ValidadorCodigo`** (caps: `accessOwnCode`, `execution`).
*   **Grupo de Trabajo por Defecto:**
    *   **`EquipoDesarrolloSoftware`**: ID `equipo-desarrollo-software`. Tarea Principal: "...mejorar el sistema "Auto-Fix" de CodeAlchemist (priorización dinámica, aprendizaje predictivo, validación robusta, sincronización con Orquestador)...". Agentes: Todos los anteriores (excepto Orquestador, que es implícito).

## 5. Configuración Técnica

### 5.1. Dependencias
Ver `package.json`. Clave: `next`, `react`, `genkit`, `lucide-react`, `tailwindcss`, ShadCN UI (Radix), `zod`, `jszip`, `simple-git`, `glob`, `groq-sdk`.

### 5.2. Variables de Entorno (`.env.local`)
*   `GOOGLE_API_KEY`: Requerida para Genkit con Google AI.
*   Otras claves API (Groq, OpenAI) se ingresan en la UI.

### 5.3. Pruebas
*   **Linting y Formateo:** ESLint y Prettier configurados (`npm run lint`, `npm run format`).
*   **Pruebas Unitarias/Integración:** No configuradas. Se recomienda Jest/RTL.
*   **Pruebas E2E:** No configuradas. Se recomienda Playwright/Cypress.

### 5.4. Despliegue
*   **Plataforma Recomendada:** Vercel.
*   **Otros:** Cualquier plataforma Node.js (Netlify, AWS, etc.).
*   **Build:** `npm run build`.
*   Variables de entorno en producción deben configurarse.

## 6. Guía de Inicio Detallada (Instalación y Primer Uso)

### 6.1. Requisitos Previos
*   Node.js (v18.x o superior).
*   npm (v8+) o yarn.
*   Git.
*   Un navegador web moderno.
*   (Opcional) Claves API para los proveedores LLM que desees usar (ej. Groq, Google AI Studio, OpenAI).
*   (Opcional) Si usas modelos LLM locales (LM Studio, Ollama), tenerlos instalados y en ejecución.

### 6.2. Instalación
1.  **Clonar el Repositorio:**
    ```bash
    git clone https://github.com/yseku-dev/studio.git CodeAlchemist
    cd CodeAlchemist
    ```
2.  **Instalar Dependencias:**
    ```bash
    npm install
    # o si usas yarn:
    # yarn install
    ```
3.  **Configurar Variables de Entorno:**
    *   Crea un archivo `.env.local` en la raíz del proyecto (copiando `.env.example` si existe, o creándolo desde cero).
    *   Añade las claves API necesarias. Como mínimo, si planeas usar modelos de Google a través de Genkit:
        ```env
        GOOGLE_API_KEY=TU_CLAVE_API_DE_GOOGLE_AI_STUDIO_O_VERTEX
        ```
        Otras claves (Groq, OpenAI) se pueden introducir directamente en la UI de Configuración de CodeAlchemist.
4.  **Ejecutar el Servidor de Desarrollo:**
    ```bash
    npm run dev
    # o si usas yarn:
    # yarn dev
    ```
    La aplicación debería estar disponible en `http://localhost:3000` (o el puerto que hayas configurado, por defecto 9002 según el package.json).

### 6.3. Primer Uso y Configuración Inicial
1.  **Acceder a la Aplicación**: Abre `http://localhost:3000` (o 9002) en tu navegador.
2.  **Configuración Inicial (Muy Recomendado)**:
    *   Navega a la sección **"Configuración"** (icono de engranaje `SettingsIcon` en la barra lateral).
    *   **Configura tu Proveedor LLM Global**:
        *   **Proveedor LLM**: Selecciona el servicio de IA que usarás por defecto (Groq, Google Gemini, OpenAI, etc.).
        *   **Clave API**: Introduce tu clave API si el proveedor la requiere.
        *   **Nombre del Modelo**: Elige un modelo de la lista (se actualiza según el proveedor; para Groq, se intenta obtener dinámicamente si hay clave API).
        *   **URL del Endpoint de API**: Se auto-rellena, ajústala si es necesario (ej. para LM Studio: `http://localhost:1234/v1`, Ollama: `http://localhost:11434/v1`).
        *   Haz clic en **`t('settings.llm.testConnectionButton')`** para verificar.
    *   **(Opcional) Configura Git**: Si usarás "Subir a Git" en "AutoUpdate", completa los detalles y prueba la conexión.
    *   **(Opcional) Activa el Modo Depuración**: Para ver logs detallados.
    *   Haz clic en **`t('settings.saveButton')`**.
3.  **Explorar Funcionalidades**:
    *   Revisa el "Panel de Control" para accesos directos.
    *   Prueba "Generar Código" con un prompt simple.
    *   Explora "Agentes IA" y "Grupos de Trabajo IA" para ver los elementos creados por defecto.

## 7. Documentación Adicional

### 7.1. Errores Comunes y Soluciones
*   **"Module not found" (ej. `jszip`, `glob`, `simple-git`, `groq-sdk`):** Ejecuta `npm install` o `yarn install`.
*   **Errores de API LLM (401, 403, 429, 500, 503):** Verifica claves API, límites de tasa, o estado del proveedor. `apiClient.ts` intenta reintentos para 429/503.
*   **Errores de CORS (con modelos locales):** Asegúrate que el servidor LLM local permita solicitudes desde el origen de CodeAlchemist.
*   **Problemas de Traducción (claves en lugar de texto):** Verifica que la clave exista en `translations.ts` y que el componente sea Cliente (`"use client";`).
*   **"Hydration failed":** Diferencias server/client. Asegura que accesos a APIs de navegador (`localStorage`, `window`) estén en `useEffect` o `useLocalStorage`.

### 7.2. Contribución
*   **Flujo Git:** GitFlow (ramas `feature`, `develop`, `main`).
*   **Estilo:** `npm run lint:fix` y `npm run format` antes de commit.
*   **Mensajes Commit:** Conventional Commits.
*   **Comentarios:** JSDoc para código nuevo/modificado.

### 7.3. Licencia y Créditos
*   **Licencia:** (Asumir MIT si no hay archivo LICENSE.md).
*   **Iconos:** Lucide Icons (Licencia ISC).
*   **Componentes UI:** ShadCN UI (Licencia MIT).
*   **Fuentes:** Geist Sans, Geist Mono (Licencia OFL).

## 8. Detalles Olvidados

### 8.1. Aspectos Técnicos Adicionales
*   **Server Actions:** Usadas para operaciones de servidor (acceso a `fs`, `simple-git`, `groq-sdk`).
*   **Seguridad:** Claves API en `localStorage` (conveniencia vs. riesgo). PAT de Git. Capacidades de agente peligrosas.
*   **Actualización de Traducciones:** Manualmente en `src/lib/i18n/translations.ts`.
*   **Persistencia del Estado:** `AppStateContext` con `useLocalStorage`.

### 8.2. Ejemplos de Uso / Pruebas Críticas
*   **Probar Configuración LLM:** En "Configuración", selecciona Groq, introduce clave, prueba. Modelos deberían cargar.
*   **Probar Internacionalización:** En "Configuración", cambia idioma. Textos UI deberían cambiar.
*   **Probar Creación de Agente con IA:** En "Agentes IA", "Crear con IA", describe rol, observa pre-relleno.
*   **Probar Ejecución de Grupo:** En "Grupos de Trabajo IA", ejecuta "EquipoDesarrolloSoftware" con tarea simple, observa log multi-turno.
*   **Probar AutoUpdate (Local):** En "AutoUpdate", selecciona "Local", un agente, "Iniciar Auto-Análisis". Prueba "Descargar Código Actual (ZIP)" (Server Action para obtener archivos, JSZip en cliente).
*   **Probar Subida a Git (AutoUpdate):** Configura Git. En "AutoUpdate", tras análisis, "Subir a Git". Verifica repo.

Este README exhaustivo debería servir como una guía completa para entender, ejecutar, y contribuir al proyecto CodeAlchemist.
