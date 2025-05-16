
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA.

**Idioma del Proyecto:** Todo el proyecto, incluyendo la interfaz de usuario, los mensajes, los comentarios en el código (donde aplique semánticamente) y la documentación (como este README), está desarrollado y presentado en **castellano**. La aplicación soporta internacionalización (i18n) con inglés como segundo idioma, seleccionable en la sección de Configuración.

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
    *   **SDK para Groq:** `groq-sdk` (usado en Server Actions para listar modelos)
*   **Arquitectura del Proyecto:**
    *   **Frontend:** Aplicación Next.js que se ejecuta en el navegador del cliente. Gestiona toda la interfaz de usuario y la lógica de presentación. Los componentes residen en `src/components/` y las páginas en `src/app/`.
    *   **Backend (Lógica de IA y Acciones del Servidor):**
        *   **Flujos Genkit:** Definidos en `src/ai/flows/`, se ejecutan en el entorno del servidor de Next.js (o en un entorno Node.js separado si se despliega así Genkit). Manejan todas las interacciones con los modelos de lenguaje grandes (LLMs) para generación de código, análisis, etc. Se utiliza el objeto global `ai` de Genkit (definido en `src/ai/genkit.ts`) para registrar prompts y flujos.
        *   **Server Actions de Next.js:** Funciones definidas en archivos como `src/app/autoupdate/actions.ts` o `src/app/configuracion/actions.ts` (con la directiva `"use server";`) que se ejecutan en el servidor. Se utilizan para operaciones que requieren acceso al sistema de archivos del servidor (ej. `getApplicationSourceBundle`) o para interactuar con herramientas del lado del servidor como `simple-git` o el SDK de `groq-sdk`.
    *   **APIs Externas:** Principalmente las APIs de los proveedores de LLM (Groq, Google AI Studio/Vertex AI, OpenAI, Anthropic, etc.) configuradas por el usuario en la sección "Configuración".
    *   **Servicios Externos:** Potencialmente repositorios Git (GitHub, GitLab, etc.) para clonar o subir código a través de las Server Actions.
    *   **Bases de Datos:** No utiliza una base de datos backend tradicional para su lógica principal. El estado de la aplicación (configuraciones, agentes, grupos, snapshots) se persiste en el `localStorage` del navegador del usuario.
*   **Requisitos Previos:**
    *   Node.js (versión recomendada: 18.x o superior)
    *   npm (v8+ o yarn v1.22+)
    *   Git (para clonar el proyecto y para la funcionalidad de "Subir a Git")
    *   Un navegador web moderno (Chrome, Firefox, Edge, Safari).
    *   Claves API para los proveedores de LLM que se deseen utilizar (ej. `GOOGLE_API_KEY` para Genkit con Google AI en el archivo `.env.local`, o claves para Groq, OpenAI, etc., que se configuran en la UI).

## 2. Funcionalidades y Características

CodeAlchemist ofrece un conjunto robusto de características diseñadas para asistir en diversas etapas del desarrollo de software:

### 2.1. Panel de Control (`/`)
*   **Propósito:** Página de bienvenida, accesos directos a funcionalidades. Sirve como punto de partida central.
*   **Estructura:** Componente `src/app/page.tsx`.
    *   **Cabecera Principal (`header` tag, clase `text-center mb-12`):**
        *   Icono de la aplicación: `FlaskConical` (de `lucide-react`). Estilos: `h-24 w-24 mx-auto text-primary mb-4`. Atributo `data-ai-hint="alchemy magic"`.
        *   Título principal (`h1`): Texto `t('dashboard.welcome')` (ej. "Bienvenido a CodeAlchemist"). Estilos: `text-4xl md:text-5xl font-bold mb-3`.
        *   Descripción de la aplicación (`p`): Texto `t('dashboard.description')` (ej. "Tu plataforma de desarrollo asistido por IA..."). Estilos: `text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto`.
    *   **Sección "Características Principales" (`section` tag, clase `mb-12`):**
        *   Título de sección (`h2`): Texto `t('dashboard.features.title')` (ej. "Características Principales"). Estilos: `text-3xl font-semibold mb-8 text-center`.
        *   Grid de tarjetas (`div`): Clases `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`.
        *   Cada característica es un componente `Link` de Next.js que envuelve un `Card` de ShadCN UI. El `Card` tiene la prop `as="a"` para renderizarse como un ancla semántica. Estilos de hover: `hover:shadow-lg transition-shadow duration-300 cursor-pointer transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`. Atributo `aria-label` con el título traducido de la característica.
        *   Estructura de cada `Card` de característica:
            *   `CardHeader`: Clases `flex flex-row items-center gap-4 pb-3`. Contiene:
                *   Icono de la característica (ej. `CodeXml` para "Generar Código"). Estilos: `h-10 w-10 text-accent flex-shrink-0`. Atributo `aria-hidden="true"`.
                *   `CardTitle`: Texto `t('dashboard.features.[featureName].title')`. Estilos: `text-xl md:text-2xl`.
            *   `CardContent`: Clases `flex-grow`. Contiene:
                *   Párrafo (`p`): Texto `t('dashboard.features.[featureName].description')`. Estilos: `text-sm text-muted-foreground`.
    *   **Sección "Guía Rápida de Inicio" (`section` tag):**
        *   `Card`: Clases `shadow-md`.
        *   `CardHeader`:
            *   `CardTitle`: Texto `t('dashboard.quickstart.title')` (ej. "Guía Rápida de Inicio"). Estilos: `text-2xl md:text-3xl`.
            *   `CardDescription`: Texto `t('dashboard.quickstart.description')`.
        *   `CardContent`:
            *   Lista ordenada (`ol`): Clases `list-decimal list-inside space-y-3 text-md md:text-lg`.
            *   Cada ítem de lista (`li`): Clases `text-muted-foreground`. Contiene un `Link` de Next.js (texto `t('dashboard.quickstart.stepX.link')`, clases `text-primary hover:underline font-medium`) seguido de texto adicional `t('dashboard.quickstart.stepX.text')`.
            *   Div para el botón CTA (`div`, clase `mt-8 text-center`):
                *   `Link` a `/configuracion` que envuelve un `Button` de ShadCN UI.
                *   `Button` con prop `as="a"`, `size="lg"`. Clases: `bg-primary hover:bg-primary/90 text-primary-foreground`. Contiene un icono `SettingsIcon` (clases `mr-2 h-5 w-5`, `aria-hidden="true"`) y el texto `t('dashboard.quickstart.ctaButton')`.
*   **Dependencias Clave del Componente:** `Link` (Next.js), `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Button` (ShadCN UI), iconos de `lucide-react`, hook `useI18n`.

### 2.2. Generación de Código (`/generar-codigo`)
*   **Propósito:** Crear fragmentos de código desde descripciones en lenguaje natural.
*   **Componente Principal:** `src/app/generar-codigo/page.tsx`. Es un Client Component (`"use client";`).
*   **Estructura:** Un `Card` principal.
    *   **Cabecera (`PageSectionHeader`):**
        *   Icono: `CodeXml` (de `lucide-react`).
        *   Título: `t('generateCode.title')` (ej. "Generar Código").
        *   Descripción: `t('generateCode.description')` (ej. "Crea fragmentos de código a partir de descripciones...").
    *   **Contenido del Card (`CardContent`, clase `space-y-6`):**
        *   **Selector de Configuración LLM:** Componente `LLMConfigSelector`.
            *   Prop `value`: Estado local `llmConfigSource`.
            *   Prop `onChange`: Función `setLlmConfigSource`.
            *   Prop `label`: Texto `t('common.llmSourceLabel')` (ej. "Usar Configuración LLM De").
        *   **Campo de Descripción (`div`, clase `space-y-2`):**
            *   `Label` (para `description`): Texto `t('generateCode.describeNeedLabel')` (ej. "Describe tu necesidad").
            *   `Textarea` (id `description`):
                *   Prop `value`: Estado local `description`.
                *   Prop `onChange`: Actualiza el estado `description`.
                *   Prop `placeholder`: Texto `t('generateCode.describeNeedPlaceholder')` (ej. "Una función en Python que sume dos números...").
                *   Prop `rows`: 5.
                *   Prop `disabled`: `isLoading`.
        *   **Botón de Generación (`Button`):** Clases `w-full`.
            *   Icono: `Loader2` (si `isLoading` es `true`, con clase `animate-spin`).
            *   Texto: `t('generateCode.generateButton')` (ej. "Generar Código").
            *   Prop `disabled`: `isLoading`.
            *   Acción (`onClick`): `handleGenerateClick`.
        *   **Visualización de Errores:** Componente `ErrorDisplay` si el estado `error` tiene valor.
        *   **Resultados (si el estado `result` tiene valor):**
            *   `div` con clases `space-y-4 mt-6 p-4 border rounded-md bg-background`.
            *   **Explicación (`div`):**
                *   `h3` (clases `font-semibold text-lg mb-2`): Texto `t('generateCode.results.explanationLabel')` (ej. "Explicación:").
                *   `p` (clases `text-sm text-muted-foreground whitespace-pre-wrap`): Muestra `result.explanation`.
            *   **Fragmento de Código (`div`):**
                *   `h3` (clases `font-semibold text-lg mb-2`): Texto `t('generateCode.results.codeSnippetLabel')` (ej. "Fragmento de Código:").
                *   Componente `CodeBlock`: Muestra `result.code`.
            *   **Log del Grupo (si `result.groupLog` existe):**
                *   Componente `LogsDisplay`:
                    *   Prop `title`: `t('generateCode.results.groupLogTitle')` (ej. "Log Detallado del Grupo").
                    *   Prop `logs`: `result.groupLog`.
*   **Diálogo de Confirmación (`ConfirmDialog`):**
    *   Se muestra cuando `showConfirmDialog` es `true`.
    *   Prop `title`: `t('generateCode.confirmDialog.title')` (ej. "Confirmar Generación de Código").
    *   Contenido:
        *   `p` (clase `text-sm text-muted-foreground mb-2`): Texto `t('common.llmSourceLabel')`.
        *   `ul` (clases `text-sm list-disc list-inside mb-2`): Muestra la fuente LLM seleccionada (ej. `t('generateCode.confirmDialog.llmSourceLabel')`: Ajustes Globales / Agente: NombreAgente / Grupo: NombreGrupo).
        *   `p` (clases `text-sm text-muted-foreground mb-1`): Texto `t('generateCode.confirmDialog.promptLabel')` (ej. "Prompt:").
        *   `ScrollArea` (clases `h-32 border rounded-md p-2 text-sm bg-muted`): Muestra el contenido del `description` (prompt del usuario).
    *   Acción `onConfirm`: Llama a `handleSubmit`.
*   **Lógica e Interacciones:**
    *   `handleGenerateClick`: Valida que `description` no esté vacío (muestra toast si lo está: `t('generateCode.toast.descriptionEmpty.title')`, `t('generateCode.toast.descriptionEmpty.description')`). Si es válido, `setShowConfirmDialog(true)`.
    *   `handleSubmit`:
        *   Establece `isLoading=true`, `error=null`, `result=null`.
        *   Prepara `agentSystemPrompt` (si se seleccionó Agente/Grupo) y `groupLogForDisplay`.
        *   Llama a `callGenerateCodeFromDescription` (de `apiClient.ts`) con `description` y `agentSystemPrompt`.
        *   Si tiene éxito, actualiza `result` (con `groupLogForDisplay` si aplica) y muestra toast (`t('generateCode.toast.codeGenerated.title')`, `t('generateCode.toast.codeGenerated.description')`).
        *   Si falla, actualiza `error` y muestra toast de error (`t('generateCode.toast.generationError.title')`, `t('generateCode.toast.generationError.description')`). Si el error tiene `redirectTo`, navega.
        *   Establece `isLoading=false` en el `finally`.
    *   `handleAutoFixError`: Usa el componente `ErrorDisplay` para la lógica de auto-fix.
*   **Dependencias Clave:** `Card`, `Label`, `Textarea`, `Button`, `Loader2`, `CodeXml`, `LLMConfigSelector`, `CodeBlock`, `ConfirmDialog`, `ErrorDisplay`, `LogsDisplay`, `ScrollArea`, `useI18n`, `useAppState`, `useToast`, `useDebug`, `useRouter`, `apiClient.ts`.

### 2.3. Generación de Proyectos (`/generar-proyecto`)
*   **Propósito:** Crear una estructura base para nuevos proyectos.
*   **Componente Principal:** `src/app/generar-proyecto/page.tsx`. Es un Client Component (`"use client";`).
*   **Estructura:** Un `Card` principal.
    *   **Cabecera (`PageSectionHeader`):**
        *   Icono: `FolderPlus`.
        *   Título: `t('generateProject.title')`.
        *   Descripción: `t('generateProject.description')`.
    *   **Contenido del Card (`CardContent`, clase `space-y-6`):**
        *   **Selector de Configuración LLM (`LLMConfigSelector`):** Label `t('common.llmSourceLabel')`.
        *   **Campo de Descripción del Proyecto (`div`, clase `space-y-2`):**
            *   `Label` (para `description`): Texto `t('generateProject.describeProjectLabel')`.
            *   `Textarea` (id `description`):
                *   Prop `value`: Estado local `description`.
                *   Prop `placeholder`: `t('generateProject.describeProjectPlaceholder')`.
                *   Prop `rows`: 8.
        *   **Botón de Generación (`Button`):** Clase `w-full`.
            *   Icono: `Loader2` (si `isLoading`, con `animate-spin`).
            *   Texto: `t('generateProject.generateButton')`.
            *   Acción (`onClick`): `handleGenerateClick`.
        *   **Visualización de Errores (`ErrorDisplay`):** Si `error` existe.
        *   **Resultados (si `result` existe):** `div` con clases `space-y-6 mt-6 p-4 border rounded-md bg-background`.
            *   **Nombre Sugerido (`div`):**
                *   `h3` (clases `font-semibold text-xl mb-1`): Texto `t('generateProject.results.suggestedNameLabel')`.
                *   `p` (clases `text-lg text-primary`): Muestra `result.projectName`.
            *   **Notas de la IA (`div`, si `result.aiNotes` existe):**
                *   `h3` (clases `font-semibold text-lg mb-1`): Texto `t('generateProject.results.aiNotesLabel')`.
                *   `p` (clases `text-sm text-muted-foreground whitespace-pre-wrap`): Muestra `result.aiNotes`.
            *   **Archivos Generados (`div`):**
                *   `h3` (clases `font-semibold text-lg mb-2`): Texto `t('generateProject.results.generatedFilesLabel')`.
                *   Componente `FileTreeDisplay`: Prop `files` es `result.files`.
            *   **Botón de Descarga (`Button`):** Variante `outline`.
                *   Icono: `Download`.
                *   Texto: `t('generateProject.results.downloadButton')` (ej. "Descargar Proyecto (ZIP)").
                *   Acción (`onClick`): `handleDownloadProject`.
            *   **Nota de Descarga (`p`):** Clase `text-xs text-muted-foreground mt-1`. Texto `t('generateProject.toast.zipDownloadSuccess.description')` adaptado.
            *   **Log del Grupo (si `result.groupLog` existe):**
                *   Componente `LogsDisplay`: Prop `title` es `t('generateProject.results.groupLogTitle')`.
*   **Diálogo de Confirmación (`ConfirmDialog`):**
    *   Se muestra cuando `showConfirmDialog` es `true`.
    *   Prop `title`: `t('generateProject.confirmDialog.title')`.
    *   Contenido (`div` clase `space-y-4`):
        *   `Label` (clase `font-semibold`): Texto `t('generateProject.confirmDialog.currentPromptLabel')`.
        *   `ScrollArea` (clase `h-24 border rounded-md p-2 text-sm bg-muted mt-1`): Muestra el `description` original.
        *   `Label` (para `redefine-prompt`): Texto `t('generateProject.confirmDialog.redefinePromptLabel')`.
        *   `Textarea` (id `redefine-prompt`, prop `value` es `currentPromptForDialog`, `rows={4}`, clase `mt-1`): Para que el usuario modifique el prompt.
        *   `p` (clase `text-xs text-muted-foreground`): Texto `t('generateProject.confirmDialog.llmConfigInfo')` seguido de la fuente LLM seleccionada.
    *   Prop `confirmText`: `t('generateProject.confirmDialog.confirmButton')`.
    *   Acción `onConfirm`: Llama a `handleProjectGeneration(currentPromptForDialog)`.
*   **Lógica e Interacciones:**
    *   `handleGenerateClick`: Valida `description`. Si vacío, muestra toast (`t('generateProject.toast.descriptionEmpty.title')`). Establece `currentPromptForDialog = description` y `showConfirmDialog = true`.
    *   `handleProjectGeneration(finalPrompt: string)`:
        *   Establece `isLoading=true`, `error=null`, `result=null`.
        *   Prepara `agentSystemPrompt` (si se seleccionó Agente/Grupo) y `groupLogForDisplay`.
        *   Llama a `callGenerateProjectStructure` con `description: finalPrompt` y `agentSystemPrompt`.
        *   Si tiene éxito, actualiza `result` (con `groupLogForDisplay`) y muestra toast (`t('generateProject.toast.projectGenerated.title')`, `t('generateProject.toast.projectGenerated.description', { projectName: aiResult.projectName })`).
        *   Si falla, maneja `AppError`, muestra toast (`t('generateProject.toast.generationError.title')`, `t('generateProject.toast.generationError.description')`).
    *   `handleDownloadProject`: Crea instancia de `JSZip`. Itera sobre `result.files`, añadiendo carpetas (`zip.folder`) y archivos (`zip.file`). Genera `zipBlob`. Crea enlace de descarga con nombre `<projectName>.zip`. Muestra toast (`t('generateProject.toast.zipDownloadSuccess.title')`, `t('generateProject.toast.zipDownloadSuccess.description', { filename, projectName })`).
*   **Dependencias Clave:** `FolderPlus`, `FileTreeDisplay`, `JSZip`, y otras comunes a "Generar Código".

### 2.4. Refactorizar Proyecto (`/refactorizar-proyecto`)
*   **Propósito:** Analizar un proyecto existente para obtener sugerencias de refactorización.
*   **Componente Principal:** `src/app/refactorizar-proyecto/page.tsx`. Es un Client Component (`"use client";`). Layout de dos columnas en pantallas `lg` (`grid grid-cols-1 lg:grid-cols-3 gap-6`).
    *   **Columna 1 (Configuración, `lg:col-span-1`):**
        *   `Card`: Contiene `PageSectionHeader`.
            *   Icono: `GitPullRequestDraft`.
            *   Título: `t('refactorProject.title')`.
            *   Descripción: `t('refactorProject.description')`.
        *   `CardContent` (clase `space-y-6`):
            *   **Selector LLM (`LLMConfigSelector`):** Label `t('refactorProject.llmSourceLabel')`.
            *   **Fuente del Proyecto (`div` clase `space-y-2`):**
                *   `Label`: `t('refactorProject.projectSourceLabel')`.
                *   `Select` (para estado `projectSourceType`): Valor `projectSourceType`, `onValueChange` actualiza estado.
                    *   `SelectTrigger` con `SelectValue`.
                    *   `SelectContent`: `SelectItem` con valor "upload" (texto `t('refactorProject.sourceUpload')`) y "git" (texto `t('refactorProject.sourceGit')`).
            *   **Si `projectSourceType` es "upload":**
                *   `Label` (para `file-upload`): `t('refactorProject.uploadLabel')`.
                *   `Input` (id `file-upload`, type `file`, `ref={fileInputRef}`, `onChange={handleFileChange}`, `disabled={isLoading}`). Atributo `accept` para tipos de archivo relevantes (ej. ".zip,.json,.js,.ts,.py,.java,.html,.css,.txt,.md").
                *   Párrafo (`p` clase `text-xs text-muted-foreground`): Muestra nombre del archivo seleccionado (`uploadedFile?.name`).
            *   **Si `projectSourceType` es "git":**
                *   `Label` (para `git-url`): `t('refactorProject.gitUrlLabel')`.
                *   `Input` (id `git-url`, prop `value` es estado `gitUrl`, `placeholder={t('refactorProject.gitUrlPlaceholder')}`, `disabled={isLoading}`).
            *   **`Separator`**.
            *   `Label`: `t('refactorProject.paramsLabel')`.
            *   **Metas (`div` clase `space-y-2`):**
                *   `Label` (para `refactor-goals`, clase `text-sm font-normal`): `t('refactorProject.goalsLabel')`.
                *   `Textarea` (id `refactor-goals`, prop `value` es estado `refactorGoals`, `placeholder={t('refactorProject.goalsPlaceholder')}`, `rows={3}`, `disabled={isLoading}`).
            *   **Prioridad General (`div` clase `space-y-2`):**
                *   `Label` (para `general-priority`, clase `text-sm font-normal`): `t('refactorProject.priorityLabel')`.
                *   `Select` (id `general-priority`, prop `value` es estado `generalPriority` o `NINGUNA_PRIORITY_VALUE`, `disabled={isLoading}`):
                    *   `SelectTrigger` con `SelectValue` (placeholder `t('refactorProject.priorityPlaceholder')`).
                    *   `SelectContent`: `SelectItem` con valor `NINGUNA_PRIORITY_VALUE` (texto `t('refactorProject.priorityNone')`). Items para cada prioridad en `GENERAL_PRIORITIES` (texto `t(\`refactorProject.priorities.${p.replace(/\\s+/g, '')}\`)` para cada `p`).
            *   **Profundidad de Búsqueda (`div` clase `space-y-2`):**
                *   `Label` (para `search-depth`, clase `text-sm font-normal`): `t('refactorProject.depthLabel')`.
                *   `Input` (id `search-depth`, type `number`, prop `value` es estado `searchDepth`, `placeholder={t('refactorProject.depthPlaceholder')}`, `disabled={isLoading}`, `min="1"`).
            *   **Campo de Enfoque (`div` clase `space-y-2`):**
                *   `Label` (para `focus-area`, clase `text-sm font-normal`): `t('refactorProject.focusLabel')`.
                *   `Input` (id `focus-area`, prop `value` es estado `focusArea`, `placeholder={t('refactorProject.focusPlaceholder')}`, `disabled={isLoading}`).
            *   **Botón de Análisis (`Button`):** Clase `w-full`.
                *   Icono: `Loader2` (si `isLoading`, con `animate-spin`).
                *   Texto: `t('refactorProject.analyzeButton')`.
                *   Prop `disabled`: `isLoading` o validación de fuente.
                *   Acción (`onClick`): `handleAnalyze`.
    *   **Columna 2 (Resultados, `lg:col-span-2`):**
        *   `Card`: Contiene `PageSectionHeader`.
            *   Icono: `ListChecks`.
            *   Título: `t('refactorProject.results.title')`.
            *   Prop `actions`: Botón `t('refactorProject.results.applyAllButton')` (variante `outline`, size `sm`, `onClick={handleApplyAll}`, visible si `suggestions.some(s => s.status === 'pending')`).
        *   `CardContent`:
            *   `ErrorDisplay` si `error`.
            *   Mensaje si `isLoading`: `div` con `Loader2` y texto `t('common.processing')`.
            *   Mensaje si `!isLoading && !analysisResult && !error`: Párrafo `t('refactorProject.results.noSuggestions')`.
            *   Si `analysisResult`:
                *   `div` (clase `space-y-4 pr-4` dentro de un `ScrollArea` con clase `h-[calc(100vh-12rem)]`):
                    *   `Card` anidada (clase `mb-4 bg-muted/30`) para `analysisResult.projectOverview`.
                        *   `CardHeader` (clase `pb-2`): `CardTitle` (clase `text-lg flex items-center gap-2`, icono `Info` clase `text-blue-600`, texto `t('refactorProject.results.projectSummaryCard.title')`).
                        *   `CardContent` (clase `text-sm`): Párrafo con `analysisResult.projectOverview` o `t('refactorProject.results.projectSummaryCard.noSummary')`.
                    *   `Separator` (clase `my-4`).
                    *   `h3` (clase `text-lg font-semibold mb-2`): Texto `t('refactorProject.results.suggestionsTitle')`.
                    *   Mensaje si `suggestions.length === 0`: Párrafo `t('refactorProject.results.noSpecificSuggestions')`.
                    *   Lista de `Card` por sugerencia (`s` en `suggestions`):
                        *   Clase `transition-opacity ${s.status === 'discarded' ? 'opacity-50' : ''}`.
                        *   `CardHeader` (clase `pb-2`): `div` (clase `flex justify-between items-start`).
                            *   `div`: `CardTitle` (clase `text-md font-semibold`, texto `s.area`), `CardDescription` (texto `t('refactorProject.suggestion.priorityLabel')` y `s.priority` con color condicional).
                            *   Icono de estado: `BadgeHelp` (pending), `BadgeCheck` (applied), `BadgeX` (discarded).
                        *   `CardContent` (clase `text-sm`):
                            *   Párrafo (`p` clase `mb-2`): `s.description`.
                            *   Si `s.snippetSuggested`: `div` (clase `my-2 p-2 bg-secondary/50 rounded-md`). `p` (clase `text-xs font-semibold mb-1`, texto `t('refactorProject.suggestion.snippetLabel')`). Dos párrafos (`p` clase `text-xs text-muted-foreground break-all`) para original y modificado.
                        *   `CardFooter` (clase `flex justify-end gap-2 py-2`):
                            *   Si `s.status === 'pending'`: Botones "Ver Diff" (`t('refactorProject.suggestion.viewDiffButton')`), "Descartar" (`t('refactorProject.suggestion.discardButton')`), "Marcar como Aplicada" (`t('refactorProject.suggestion.applyButton')`).
                            *   Si `s.status !== 'pending'`: Botón "Revertir Estado" (`t('refactorProject.suggestion.revertStateButton')`).
            *   `LogsDisplay` si `analysisResult.groupLog`, título `t('refactorProject.logs.groupLogTitle')`.
*   **Diálogo de Diff (`ConfirmDialog`):**
    *   Se muestra cuando `showDiffModal` es `true`.
    *   Prop `title`: `t('refactorProject.diffModal.title')`.
    *   Contenido: `div` (clase `grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto`). Dos `div` para "Original" y "Sugerido", cada uno con `h4` (texto `t('refactorProject.diffModal.originalLabel')` / `t('refactorProject.diffModal.suggestedLabel')`) y `CodeBlock` (con `currentDiff.original` o `currentDiff.modified`).
    *   Prop `confirmText`: `t('common.close')`. `cancelText` vacío.
*   **Lógica e Interacciones:**
    *   `handleFileChange`: Valida archivo, actualiza estado `uploadedFile`.
    *   `handleAnalyze`: Construye `projectSourceValue`. Prepara `agentSystemPrompt`. Crea `RefactorProjectWithAIInput`. Llama a `callRefactorProjectWithAI`. Si éxito, actualiza `analysisResult` y `suggestions` (añadiendo `id`, `status`), muestra toast (`t('refactorProject.toast.analysisComplete.title')`). Construye `groupLogForDisplay`. Si error, maneja `AppError`, muestra toast.
    *   `handleApplySuggestion(id)`: Cambia `status` a 'applied'. Muestra toast (`t('refactorProject.toast.suggestionApplied.title')`, `t('refactorProject.toast.suggestionApplied.description', { area })`).
    *   `handleViewDiff(suggestion)`: Establece `currentDiff` y `showDiffModal`.
    *   `handleDiscardSuggestion(id)`: Cambia `status` a 'discarded'. Muestra toast (`t('refactorProject.toast.suggestionDiscarded.title')`).
    *   `handleApplyAll`: Cambia `status` de todas las pendientes a 'applied'. Muestra toast (`t('refactorProject.toast.allApplied.title')`).
*   **Dependencias Clave:** `GitMerge` (icono, aunque no se usa explícitamente en el `PageSectionHeader`), `BadgeHelp`, `BadgeCheck`, `BadgeX`, `Info`, y otras comunes.

### 2.5. Análisis de Código Inteligente (`/analizar-codigo`)
*   **Propósito:** Análisis detallado para fragmentos o archivos.
*   **Componente Principal:** `src/app/analizar-codigo/page.tsx`. Es un Client Component.
*   **Estructura:** Un `Card` principal (clase `max-w-4xl mx-auto`).
    *   **Cabecera (`PageSectionHeader`):**
        *   Icono: `ScanLine`.
        *   Título: `t('analyzeCode.title')`.
        *   Descripción: `t('analyzeCode.description')`.
    *   **Contenido del Card (`CardContent`, clase `space-y-6`):**
        *   **Selector LLM (`LLMConfigSelector`):** Label `t('common.llmSourceLabel')`.
        *   **Fuente del Código (`div`, clases `space-y-4 p-4 border rounded-md`):**
            *   `Label` (clase `font-semibold`): Texto `t('analyzeCode.codeSourceLabel')`.
            *   **Subir Archivo (`div`, clase `space-y-2`):**
                *   `Label` (para `file-upload-code`, clase `text-sm`): `t('analyzeCode.uploadFileLabel')`.
                *   `Input` (id `file-upload-code`, type `file`, `ref={fileInputRef}`, `onChange={handleFileChange}`, `disabled={isLoading}`).
            *   **URL Git (`div`, clases `flex items-end gap-2`):**
                *   `div` (clase `flex-grow space-y-2`): `Label` (para `git-file-url`, clase `text-sm`, texto `t('analyzeCode.gitFileUrlLabel')`), `Input` (id `git-file-url`, `value={fileUrl}`, `placeholder={t('analyzeCode.gitFileUrlPlaceholder')}`, `disabled={isLoading}`).
                *   `Button` (variante `outline`, `onClick={handleFetchFromUrl}`, `disabled={isLoading || !fileUrl.trim()}`): Texto `t('analyzeCode.fetchUrlButton')`.
            *   **Separador con Texto (`div`, clase `relative`):** Línea y texto `t('analyzeCode.pasteCodeInstruction')`.
            *   **Editor de Código (`CodeEditor`):**
                *   Props: `id="analizar-codigo-main"`, `value={codeToAnalyze}`, `onChange={setCodeToAnalyze}`, `placeholder={t('analyzeCode.pasteCodePlaceholder')}`, `rows={10}`, `className="font-mono text-sm"`, `disabled={isLoading}`.
            *   **Instrucciones Adicionales (`div`, clase `space-y-2`):**
                *   `Label` (para `user-analysis-prompt`, clase `text-sm`): `t('analyzeCode.additionalInstructionsLabel')`.
                *   `Textarea` (id `user-analysis-prompt`, `value={userAnalysisPrompt}`, `placeholder={t('analyzeCode.additionalInstructionsPlaceholder')}`, `rows={2}`, `disabled={isLoading}`).
        *   **Botón de Análisis (`Button`):** Clase `w-full`.
            *   Icono: `Loader2` (si `isLoading`, con `animate-spin`).
            *   Texto: `t('analyzeCode.analyzeButton')`.
            *   Prop `disabled`: `isLoading || !codeToAnalyze.trim()`.
            *   Acción (`onClick`): `handleAnalyze`.
        *   **Visualización de Errores (`ErrorDisplay`):** Si `error` existe.
        *   **Resultados (si `result` existe):** `div` (clases `space-y-6 mt-6 p-4 border rounded-md bg-background`).
            *   **Explicación (`div`):**
                *   `h3` (clases `font-semibold text-lg mb-2`): Texto `t('analyzeCode.results.explanationLabel')`.
                *   `p` (clases `text-sm text-muted-foreground whitespace-pre-wrap`): Muestra `result.explanation`.
            *   **Código Original (`div`):**
                *   `div` (clases `flex justify-between items-center mb-2`): `h3` (texto `t('analyzeCode.results.originalCodeLabel')`), `Button` (variante `outline`, size `sm`, `onClick={() => handleSaveSnapshot('original')}`, icono `Save`, texto `t('analyzeCode.results.saveOriginalButton')`).
                *   `CodeBlock`: Muestra `result.originalCode`, `maxHeight="300px"`.
            *   **Código Sugerido (`div`):**
                *   `div` (clases `flex justify-between items-center mb-2`): `h3` (texto `t('analyzeCode.results.suggestedCodeLabel')`), `Button` (variante `outline`, size `sm`, `onClick={() => handleSaveSnapshot('suggested')}`, icono `Save`, texto `t('analyzeCode.results.saveSuggestedButton')`).
                *   `CodeBlock`: Muestra `result.suggestedCode`, `maxHeight="300px"`.
*   **Lógica e Interacciones:**
    *   `handleFileChange`: Lee archivo, actualiza `codeToAnalyze`. Valida tipo/tamaño. Muestra toast (`t('analyzeCode.toast.invalidFile.title')`).
    *   `handleFetchFromUrl`: Obtiene contenido de `fileUrl` (usando `fetch`). Actualiza `codeToAnalyze`. Muestra toast (`t('analyzeCode.toast.codeFetched.title')`). Maneja errores.
    *   `handleAnalyze`: Valida `codeToAnalyze` (toast `t('analyzeCode.toast.emptyCode.title')`). Prepara `AnalyzeCodeSnippetInput` (incluye `codeToAnalyze`, `userAnalysisPrompt`, `agentSystemPrompt`). Llama a `callAnalyzeCodeSnippet`. Si éxito, actualiza `result`, muestra toast (`t('analyzeCode.toast.analysisComplete.title')`). Si error, maneja `AppError`.
    *   `handleSaveSnapshot(type: 'original' | 'suggested')`: Crea nombre para snapshot (`t('analyzeCode.results.snapshotName', { type, time })`). Llama a `addSnapshot` de `AppStateContext`.
*   **Dependencias Clave:** `Save`, `CodeEditor`, y otras comunes.

### 2.6. Análisis de Proyecto Completo (`/analizar-proyecto`)
*   **Propósito:** Análisis holístico de proyectos.
*   **Componente Principal:** `src/app/analizar-proyecto/page.tsx`. Es un Client Component.
*   **Estructura:** Un `Card` principal (clase `max-w-4xl mx-auto`).
    *   **Cabecera (`PageSectionHeader`):**
        *   Icono: `FolderSearch`.
        *   Título: `t('analyzeProject.title')`.
        *   Descripción: `t('analyzeProject.description')`.
    *   **Contenido del Card (`CardContent`, clase `space-y-6`):**
        *   **Selector LLM (`LLMConfigSelector`):** Label `t('analyzeProject.llmSourceLabel')`.
        *   **Fuente del Proyecto (`div` clase `space-y-2`):**
            *   `Label`: `t('analyzeProject.projectSourceLabel')`.
            *   `Select` (para estado `projectSourceType`): Opciones "upload" (`t('analyzeProject.sourceUpload')`) y "git" (`t('analyzeProject.sourceGit')`).
        *   **Si "upload":**
            *   `Label` (para `project-file-upload`): `t('analyzeProject.uploadLabel')`.
            *   `Input` (id `project-file-upload`, type `file`, `ref={fileInputRef}`, `onChange={handleFileChange}`, `accept=".zip,application/zip,.json,application/json"`, `disabled={isLoading}`).
            *   Párrafo con nombre de archivo seleccionado.
        *   **Si "git":**
            *   `Label` (para `project-git-url`): `t('analyzeProject.gitUrlLabel')`.
            *   `Input` (id `project-git-url`, `value={gitUrl}`, `placeholder={t('analyzeProject.gitUrlPlaceholder')}`, `disabled={isLoading}`).
        *   **`Separator`**.
        *   `Label`: `t('analyzeProject.paramsLabel')`.
        *   **Profundidad de Búsqueda (`div` clase `space-y-2`):**
            *   `Label` (para `search-depth-project`, clase `text-sm font-normal`): `t('analyzeProject.depthLabel')`.
            *   `Input` (id `search-depth-project`, type `number`, `value={searchDepth}`, `placeholder={t('analyzeProject.depthPlaceholder')}`, `disabled={isLoading}`, `min="1"`).
        *   **Campo de Enfoque (`div` clase `space-y-2`):**
            *   `Label` (para `focus-area-project`, clase `text-sm font-normal`): `t('analyzeProject.focusLabel')`.
            *   `Input` (id `focus-area-project`, `value={focusArea}`, `placeholder={t('analyzeProject.focusPlaceholder')}`, `disabled={isLoading}`).
        *   **Botón de Análisis (`Button`):** Clase `w-full`.
            *   Icono: `Loader2` (si `isLoading`, con `animate-spin`).
            *   Texto: `t('analyzeProject.analyzeButton')`.
            *   Acción (`onClick`): `handleAnalyze`.
        *   **Visualización de Errores (`ErrorDisplay`):** Si `error` existe.
        *   Mensaje de Carga (si `isLoading && !result`): `div` con `Loader2` y texto `t('analyzeProject.results.analyzing')`.
        *   **Resultados (si `result` existe):** `Card` anidada (clase `mt-6 bg-background`).
            *   `PageSectionHeader` interno: Icono `ListChecks`, Título `result.analysisTitle`.
            *   `CardContent` (clase `space-y-4`):
                *   `div`: `h3` (texto `t('analyzeProject.results.overallAssessmentLabel')`), `p` (muestra `result.generalAssessment`).
                *   `div` (si `result.overallImprovementIdeas`): `h3` (texto `t('analyzeProject.results.improvementIdeasLabel')`), `ul` (lista de ideas).
                *   `div`: `h3` (texto `t('analyzeProject.results.identifiedAreasLabel')`), `ul` (lista de áreas).
                *   `div` (si `result.detailedSuggestions`): `h3` (texto `t('analyzeProject.results.specificSuggestionsLabel')`), `ScrollArea` (clase `h-60 border rounded-md p-2`) con lista `ul` de sugerencias (área, sugerencia, prioridad, prompt sugerido). Usa `t('analyzeProject.results.suggestionPriorityLabel')` y `t('analyzeProject.results.suggestedPromptLabel')`.
                *   `LogsDisplay` si `result.groupLog`, título `t('analyzeProject.results.groupLogTitle')`.
*   **Lógica e Interacciones:**
    *   `handleFileChange`: Valida archivo ZIP/JSON (toast `t('analyzeProject.toast.invalidFile.title')`). Actualiza `uploadedFile`.
    *   `handleAnalyze`: Prepara `AnalyzeCodeInput`. Llama a `analyzeProjectFlow` (alias de `callAnalyzeSelfCode`). Si éxito, actualiza `result`, muestra toast (`t('analyzeProject.toast.analysisComplete.title')`). Construye `groupLogForDisplay`. Si error, maneja `AppError`.
*   **Dependencias Clave:** `FolderSearch`, `ListChecks`, `Info`, y otras comunes.

### 2.7. AutoUpdate (Análisis del Propio Código) (`/autoupdate`)
*   **Propósito:** CodeAlchemist analiza su propio código.
*   **Componente Principal:** `src/app/autoupdate/page.tsx`. Es un Client Component. Utiliza componentes `AutoUpdateConfigForm` y `AutoUpdateResultsDisplay`.
*   **`AutoUpdateConfigForm` (`src/components/features/autoupdate/AutoUpdateConfigForm.tsx`):**
    *   **Cabecera (`PageSectionHeader`):** Icono `Sparkles`, título `t('autoupdate.config.title')`, descripción `t('autoupdate.config.description')`.
    *   **Contenido del Card (`CardContent`, clase `space-y-6`):**
        *   **Selector LLM (`LLMConfigSelector`):** Label `t('autoupdate.config.llmSourceLabel')`.
        *   **Fuente del Código (`div` clase `space-y-2`):**
            *   `Label`: `t('autoupdate.config.codeSourceLabel')`.
            *   `Select` (para estado `sourceType`): Opciones "Local" (`t('autoupdate.config.sourceLocal')`) y "Git" (`t('autoupdate.config.sourceGit')`).
        *   **Si `sourceType` es "Git":**
            *   `Label` (para `autoupdate-git-url`): `t('autoupdate.config.gitUrlLabel')`.
            *   `Input` (id `autoupdate-git-url`, `value={gitRepoUrl}`, `placeholder={t('autoupdate.config.gitUrlPlaceholder')}`).
        *   **`Separator`**.
        *   `Label`: `t('autoupdate.config.analysisParamsLabel')`.
        *   **Preferencias de Análisis (`div` clase `space-y-2`):**
            *   `Label` (para `analysis-prefs`, clase `text-sm font-normal`): `t('autoupdate.config.analysisPrefsLabel')`.
            *   `Textarea` (id `analysis-prefs`, `value={analysisPreferences}`, `placeholder={t('autoupdate.config.analysisPrefsPlaceholder')}`, `rows={3}`).
        *   **Botón de Inicio (`Button`):** Clase `w-full`.
            *   Icono: `Sparkles` o `Loader2` (si `isLoading`, con `animate-spin`).
            *   Texto: `isLoading ? t('autoupdate.config.startButtonLoading') : t('autoupdate.config.startButton')`.
            *   Acción (`onClick`): `onStartAnalysis` (prop).
        *   `Progress` bar: Visible si `isAnalysisInProgress` es `true` y `progress < 100`. Prop `value` es `progress`.
*   **`AutoUpdateResultsDisplay` (`src/components/features/autoupdate/AutoUpdateResultsDisplay.tsx`):**
    *   **Cabecera (`PageSectionHeader`):** Icono `ClipboardList`, título `t('autoupdate.results.title')`.
        *   Prop `actions`: `div` (clase `flex flex-wrap gap-2 ...`). Botones:
            *   "Descargar Sugerencias (JSON)" (`t('autoupdate.results.downloadSuggestionsJson')`), icono `Download`, `onClick={() => onDownloadSuggestions('JSON_SUGGESTIONS')}`.
            *   "Descargar Código Actual (ZIP)" (`t('autoupdate.results.downloadCurrentCodeZip')`), icono `FileArchive`, `onClick={() => onDownloadSuggestions('ZIP_PROJECT')}`.
            *   "Subir a Git" (`t('autoupdate.results.uploadToGit')`), icono `GitCommit`, `onClick={onOpenCommitDialog}`.
    *   **Contenido del Card (`CardContent`):**
        *   `ErrorDisplay` si `error`.
        *   Mensaje si `isLoading && !analysisResult`: `Loader2` y texto `t('common.processing')`.
        *   Mensaje si `!isLoading && !analysisResult && !error`: Párrafo `t('autoupdate.results.noResults')`.
        *   Si `analysisResult`: `div` (clase `space-y-4`).
            *   `h3` (clase `text-xl font-semibold`): `analysisResult.analysisTitle`.
            *   `p` (clase `text-sm text-muted-foreground whitespace-pre-wrap`): `analysisResult.generalAssessment`.
            *   **Ideas Generales (`div`, si `analysisResult.overallImprovementIdeas`):**
                *   `h4` (clase `font-semibold text-lg mb-2`): `t('autoupdate.results.overallImprovementIdeasLabel')`.
                *   `ul` (clases `list-disc list-inside ...`): Lista de ideas.
            *   **Sugerencias Detalladas (`div`):**
                *   `h4` (clase `font-semibold text-lg`): `t('autoupdate.results.detailedSuggestionsLabel')`.
                *   Mensaje si `suggestions.length === 0`: Párrafo `t('autoupdate.results.noDetailedSuggestions')`.
                *   `ScrollArea` (clase `max-h-[calc(100vh-22rem)] ...`): `div` (clase `space-y-3`) con lista de `AutoUpdateSuggestionCard`.
            *   **Prompt Unificado (`div`, si `unifiedPrompt`):**
                *   `Label` (para `unified-prompt-display`, clase `text-lg font-semibold ...`): `t('autoupdate.results.unifiedPromptLabel')`.
                *   `CodeBlock`: Muestra `unifiedPrompt`.
*   **`AutoUpdateSuggestionCard` (`src/components/features/autoupdate/autoupdate-suggestion-card.tsx`):**
    *   `Card`: Clases condicionales para estado `applied`/`discarded`.
    *   `CardHeader`: `CardTitle` (`area`), `CardDescription` (`t('autoupdate.suggestionCard.priorityLabel')`, `priority`). Icono de estado (`Check`, `X`).
    *   `CardContent`: `p` (descripción). Si `suggestedPromptForImplementation`: `Label` (`t('autoupdate.suggestionCard.promptLabel')`), `ScrollArea` con `pre` (prompt), botón `Copy`.
    *   Si `isEditing`: `Label` (`t('autoupdate.suggestionCard.editContentLabel')`), `Textarea` (para `userEditedContent`).
    *   `CardFooter`: Botones:
        *   Si `status === 'pending'` y `isEditing`: "Cancelar" (`t('common.cancel')`), "Guardar Edición" (`t('autoupdate.suggestionCard.saveEditButton')`).
        *   Si `status === 'pending'` y `!isEditing`: "Editar Contenido" (`t('common.edit')`), "Testear" (`t('common.test')`), "Testear en Ent. Virtual" (`t('autoupdate.suggestionCard.testInVenvButton')`), "Aplicar" (`t('common.apply')`).
        *   Si `status !== 'pending'`: Texto de estado (`t('autoupdate.suggestionCard.statusApplied')` o `t('autoupdate.suggestionCard.statusDiscarded')`).
*   **Diálogos en `autoupdate/page.tsx`**:
    *   `ConfirmDialog` para aplicar sugerencia: Título `t('autoupdate.dialogs.applySuggestion.title', { area })`, descripción (`t('autoupdate.dialogs.applySuggestion.description.p1')`, `t('autoupdate.dialogs.applySuggestion.description.p2')`). Contenido: `ScrollArea` con `CodeBlock`. Confirmar texto `t('autoupdate.dialogs.applySuggestion.confirmText')`.
    *   `Dialog` para testear: Título `t('autoupdate.dialogs.testSuggestion.title', { area })`. `ScrollArea` con `CodeBlock`. Botón `t('common.close')`.
    *   `Dialog` para testear en VENV: Título `t('autoupdate.dialogs.testInVenv.title', { area })`. `ScrollArea` con `CodeBlock`. Botón `t('autoupdate.dialogs.testInVenv.simulateButton')`.
    *   `ConfirmDialog` para commit Git: Título `t('autoupdate.dialogs.commitToGit.title')`. `Input` (placeholder `t('autoupdate.dialogs.commitToGit.placeholder')`). Confirmar texto `isUploadingGit ? t('common.uploading') : t('autoupdate.dialogs.commitToGit.confirmText')`.
    *   `LogsDisplay` para `detailedLogs`: Título `t('autoupdate.logs.detailedExecutionLogsTitle')`.
*   **Lógica e Interacciones (`autoupdate/page.tsx`):**
    *   **`handleStartAnalysis`**: Si `sourceType` es "Local", llama a Server Action `getApplicationSourceBundle`. Prepara `AnalyzeCodeInput`. Llama a `callAnalyzeSelfCode`. Procesa resultados en `_executeAnalysisAndProcessResults`.
    *   **Manejo de Sugerencias**: `handleApplySuggestionClick`, `confirmApplySuggestion`, `handleToggleEdit`, `handleSuggestionContentChange`, `handleSaveEdit`, `handleCancelEdit`, `handleTestSuggestionClick`, `handleTestInVenvClick`.
    *   **`handleDownload`**:
        *   Si `JSON_SUGGESTIONS`: Crea JSON con `area` y contenido de sugerencias. Descarga como `t('autoupdate.downloads.suggestionsJsonFilename')`. Toast (`t('autoupdate.toast.downloadComplete.suggestionsJsonDescription')`).
        *   Si `ZIP_PROJECT`: Llama a `getApplicationSourceBundle`. Aplica sugerencias marcadas. Usa `JSZip` para crear y descargar (`t('autoupdate.downloads.currentCodeZipFilename')`). Toast (`t('autoupdate.toast.downloadCurrentCodeZipToast')`).
    *   **`performGitUpload`**: Llama a Server Action `handleUploadToGit`.
    *   **`handleAutoFixError`**: Usa el `ErrorDisplay` y su lógica interna (que llama a `callAutoFixErrorWithGroup`).
*   **Server Actions (`src/app/autoupdate/actions.ts`):**
    *   **`getApplicationSourceBundle`**: Lee archivos del proyecto en servidor usando `fs`, `glob`, `path`. Ignora patrones. Devuelve `Promise<{ success: boolean; files?: AppSourceFile[]; error?: string; logsBuilt?: string[]; }>`.
    *   **`handleUploadToGit`**: Usa `simple-git`. Llama a `getApplicationSourceBundle`. Crea dir temporal. Realiza `init`, `addConfig`, `add`, `commit`, `addRemote`/`set-url`, y `push -u origin <defaultBranch> --force`. Devuelve `Promise<GitUploadResult>`.
*   **Dependencias Clave:** Componentes `AutoUpdate*`, `Sparkles`, `ClipboardList`, `Download`, `GitCommit`, `FileArchive`, `Progress`, `JSZip`, `apiClient.ts`, Server Actions.

### 2.8. Versiones Guardadas (Snapshots) (`/versiones-guardadas`)
*   **Propósito:** Gestiona instantáneas de código o estado.
*   **Componente Principal:** `src/app/versiones-guardadas/page.tsx`. Es un Client Component.
*   **Estructura:** `Card` principal (clase `max-w-5xl mx-auto`).
    *   **Cabecera (`PageSectionHeader`):** Icono `GitCompareArrows`. Título `t('versions.title')`. Descripción `t('versions.description')`.
        *   Prop `actions`: `div` (clase `flex flex-wrap gap-2 ...`). Botones:
            *   "Comparar A y B" (`t('versions.compareButton')`), `onClick={handleCompareVersions}`, `disabled={!selectedForCompareA || !selectedForCompareB}`, variante `outline`.
            *   "Eliminar Todas" (`t('versions.deleteAllButton')`), `onClick={() => setShowDeleteAllConfirm(true)}`, variante `destructive`, `disabled={snapshots.length === 0}`.
    *   **Contenido del Card (`CardContent`):**
        *   `div` (clase `mb-6 space-y-3`):
            *   `div`: Botón "Guardar Estado Actual de la Aplicación (JSON)" (`t('versions.saveAppStateButton')`), `onClick={() => handleSaveCurrentAppState(false)}`. Debajo, `p` (clase `text-xs text-muted-foreground`) con `t('versions.saveAppStateDescription')`.
            *   `div`: Botón "Guardar Estado y Descargar como ZIP" (`t('versions.saveAndDownloadStateButton')`), `onClick={() => handleSaveCurrentAppState(true)}`. Debajo, `p` (clase `text-xs text-muted-foreground`) con `t('versions.saveAndDownloadStateDescription')`.
        *   `ScrollArea` (clase `h-[calc(100vh-20rem)]`): Contiene `Table`.
            *   `TableHeader`: `TableRow` con `TableHead` para "A" (`t('versions.table.colA')`), "B" (`t('versions.table.colB')`), "Nombre" (`t('versions.table.colName')`), "Fecha de Creación" (`t('versions.table.colCreatedAt')`), "Origen" (`t('versions.table.colSource')`), "Acciones" (`t('versions.table.colActions')`).
            *   `TableBody`:
                *   Si `snapshots.length === 0`: `TableRow` con `TableCell` (colspan 6, texto `t('versions.table.noVersions')`).
                *   Para cada `snapshot`: `TableRow`.
                    *   `TableCell` (para A): `Button` (variante `ghost`, size `icon`, `onClick={() => toggleCompareSelection(snapshot.id, 'A')}`). Icono `CheckSquare` (si seleccionado) o `Square`.
                    *   `TableCell` (para B): Similar para selección B.
                    *   `TableCell` (Nombre): `snapshot.name`.
                    *   `TableCell` (Fecha): `new Date(snapshot.createdAt).toLocaleString()`.
                    *   `TableCell` (Origen): `t(\`versions.source.${snapshot.source || 'unknown'}\`)`.
                    *   `TableCell` (Acciones, clase `text-right`): `DropdownMenu` con `DropdownMenuTrigger` (botón `MoreHorizontal`).
                        *   `DropdownMenuContent`: `DropdownMenuItem` para "Ver" (`t('versions.action.view')`, icono `Eye`), "Descargar como JSON/TXT" (`t('versions.action.downloadOriginal', { format: ... })`, icono `Download`), "Descargar como ZIP" (`t('versions.action.downloadZip')`, icono `Download`), "Eliminar" (`t('versions.action.delete')`, icono `Trash2`).
*   **Diálogos (`ConfirmDialog`):**
    *   Para Ver Snapshot: Título `t('versions.viewModal.title', { name })`. Contenido `ScrollArea` con `CodeBlock`.
    *   Para Comparar: Título `t('versions.compareModal.title')`. Contenido dos `CodeBlock` para A y B.
    *   Para Eliminar Todas: Título `t('versions.deleteAllModal.title')`, descripción `t('versions.deleteAllModal.description')`.
    *   Para Eliminar Single: Título `t('versions.deleteSingleModal.title', { name })`, descripción `t('versions.deleteSingleModal.description')`.
*   **Lógica e Interacciones:**
    *   `handleSaveCurrentAppState(downloadAsZip: boolean)`: Guarda estado de la aplicación (settings, agents, groups) como JSON en un snapshot. Si `downloadAsZip`, llama a `handleDownloadSnapshot` para el snapshot recién creado con formato 'zip'. Muestra toast.
    *   `handleDownloadSnapshot(snapshot: CodeSnapshot, format: 'original' | 'zip')`: Descarga el snapshot. Si `format` es 'zip', usa extensión `.zip`.
    *   `handleViewSnapshot`, `handleDeleteSnapshot`, `confirmDeleteSnapshot`, `confirmDeleteAllSnapshots`, `toggleCompareSelection`, `handleCompareVersions`.
*   **Dependencias Clave:** `GitCompareArrows`, `CheckSquare`, `Square`, `Eye`, `Download`, `Trash2`, `DropdownMenu`, `Table`, y otras comunes.

### 2.9. Chat con IA (`/chat-ia`)
*   **Propósito:** Interactúa con un asistente IA.
*   **Componente Principal:** `src/app/chat-ia/page.tsx`. Es un Client Component.
*   **Estructura:** `Card` (clases `w-full h-full flex flex-col`).
    *   **Cabecera (`PageSectionHeader`):** Icono `MessageCircle`. Título `t('chat.title')`. Descripción `t('chat.description')`.
    *   **Contenido del Card (`CardContent`, clases `flex-1 overflow-hidden p-0 flex flex-col`):**
        *   `div` (clases `p-4 border-b`): Componente `LLMConfigSelector` (label `t('common.llmSourceLabel')`).
        *   `ScrollArea` (clases `flex-1 p-4`, `ref={scrollAreaRef}`): `div` (clase `space-y-4`) con lista de mensajes.
            *   Cada mensaje (`div` clase `flex`): `div` (clase `max-w-[85%] p-3 rounded-lg shadow-sm ...`).
                *   `div` (clase `flex items-center gap-2 mb-1`): Icono (`User`, `Bot`, `AlertTriangleIcon`), `span` (rol: `t('chat.agent.user')`, `t('chat.agent.assistant')`, `t('chat.agent.system')`).
                *   `p` (clase `text-sm whitespace-pre-wrap`, contenido del mensaje).
                *   `p` (clase `text-xs opacity-60 mt-1 text-right`, timestamp).
            *   Mensaje de carga (si `isLoading`): `div` con `Loader2` y texto `t('chat.thinking')`.
    *   **Pie del Card (`CardFooter`, clases `p-4 border-t`):**
        *   `ErrorDisplay` (si `error` y `!isLoading`).
        *   `div` (clase `flex w-full items-center gap-2`):
            *   `Textarea` (prop `value` es `currentMessage`, `placeholder={t('chat.inputPlaceholder')}`, `rows={1}`, clase `min-h-[40px] max-h-[120px] flex-1 resize-none`, `disabled={isLoading}`).
            *   `Button` (Enviar): Icono `Send`. `disabled={isLoading || !currentMessage.trim()}`. `onClick={handleSendMessage}`.
            *   `Button` (Borrar Chat): Icono `Trash2`. `disabled={isLoading || messages.length === 0}`. `onClick={handleClearChat}`.
*   **Lógica e Interacciones:**
    *   `handleSendMessage`: Añade mensaje de usuario. Llama a `callChatWithAgentOrGlobal` o `callChatWithAIGroup` (de `apiClient.ts`). Añade respuesta de IA o mensaje de error. Muestra toasts.
    *   `handleClearChat`: Limpia `messages`. Muestra toast (`t('chat.toast.chatCleared.title')`).
    *   `handleAutoFixError`: Usa `ErrorDisplay`.
*   **Dependencias Clave:** `MessageCircle`, `Send`, `Bot`, `User`, `AlertTriangleIcon`, `Textarea`, `ScrollArea`, y otras comunes.

### 2.10. Gestión de Agentes IA (`/agentes-ia`)
*   **Propósito:** Crea, configura, prueba y gestiona agentes.
*   **Componente Principal:** `src/app/agentes-ia/page.tsx`. Es un Client Component.
*   **Estructura:** `div` (clase `space-y-6`).
    *   `Card`: Contiene `PageSectionHeader`.
        *   Icono: `Users2`. Título: `t('agents.title')`. Descripción: `t('agents.description')`.
        *   Prop `actions` (`div` clase `flex flex-wrap gap-2`):
            *   Botón "Crear con IA" (`t('agents.createWithAIButton')`), icono `SparklesIcon`, `onClick={() => setIsSuggestAgentDialogOpen(true)}`.
            *   `Input` (type `file`, id `import-agents-input`, oculto). Botón "Importar" (`t('agents.importButton')`), icono `Upload`, `onClick` para disparar input.
            *   Botón "Exportar Todos" (`t('agents.exportAllButton')`), icono `Download`, `onClick={handleExportAgents}`.
            *   Botón "Crear Agente" (`t('agents.createAgentButton')`), icono `PlusCircle`, `onClick={() => handleOpenForm()}`.
    *   `CardContent`:
        *   Mensaje si `agents.length === 0`: Párrafo `t('agents.noAgentsMessage')`.
        *   Grid (`div` clases `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`):
            *   Cada agente es un `Card` (clase `flex flex-col`).
                *   `CardHeader` (clase `pb-2`): `CardTitle` (`agent.name`, badge `t('agents.defaultAgentBadge')` si `agent.isDefault`), `CardDescription` (`agent.description`).
                *   `CardContent` (clase `text-xs space-y-1 flex-grow`):
                    *   Texto "LLM:" (`t('agents.llmLabel')`): `agent.llmConfig.useGlobal ? t('agents.llmGlobalFormat', { provider }) : t('agents.llmCustomFormat', { provider })`.
                    *   Texto "Capacidades:" (`t('agents.capabilitiesLabel')`): Lista de capacidades (`t(\`agents.form.capability.${key}\`)`) o `t('agents.noCapabilities')`.
                *   `CardFooter` (clase `flex justify-end gap-1 p-2`): Botones (variante `ghost`, size `icon`): "Probar" (`t('agents.action.test')`, icono `PlayCircle`), "Exportar" (`t('agents.action.export')`, icono `Download`), "Editar" (`t('agents.action.edit')`, icono `Edit3`), "Eliminar" (`t('agents.action.delete')`, icono `Trash2`).
*   **`AgentForm` (`src/components/features/agentes-ia/agent-form.tsx`):** Componente en diálogo.
    *   `DialogTitle`: `t(dialogTitleKey)` (ej. `t('agents.form.title.edit')`).
    *   `DialogDescription`: `t(dialogDescriptionKey, { name })`.
    *   `ScrollArea` (clase `h-full ...`): `div` (clase `space-y-4 py-4`).
        *   Campos: `Label` y `Input` para nombre (`t('agents.form.label.name')`). `Textarea` para descripción (`t('agents.form.label.description')`) y prompt (`t('agents.form.label.systemPrompt')`, placeholder `t('agents.form.placeholder.systemPrompt')`).
        *   `Label` `t('agents.form.label.capabilities')`. Grid de `Switch` para capacidades (ej. `t('agents.form.capability.accessOwnCode')`). Tooltip `t('agents.form.capability.dangerousTooltip')`.
        *   `Label` `t('agents.form.label.llmConfig')`. `Switch` `t('agents.form.llm.useGlobal')`. Campos para config personalizada (`t('agents.form.llm.custom.providerLabel')`, etc.).
    *   `DialogFooter`: Botones `t('common.cancel')`, y texto dinámico para guardar/crear (ej. `t('agents.form.button.saveChanges')`).
*   **`ConfirmDialog` para eliminar:** Título `t('agents.deleteSingleModal.title', { name })`, descripción `t('agents.deleteSingleModal.description')`.
*   **`AgentTestChat` (`src/components/features/agentes-ia/agent-test-chat.tsx`):** Componente en diálogo.
    *   Título `t('agents.testChatDialog.title', { name })`. Descripción `t('agents.testChatDialog.description')`. Mensaje de sistema `t('agents.testChatDialog.systemMessage', { name, systemPrompt })`. Placeholder `t('agents.testChatDialog.inputPlaceholder')`. Botón `t('agents.testChatDialog.sendButton')`. Texto "pensando" `t('agents.testChatDialog.thinking')`.
*   **`AISuggestionDialog` (`src/components/features/common/AISuggestionDialog.tsx`):**
    *   Título `t('agents.suggestionDialog.title')`. Descripción `t('agents.suggestionDialog.description')`. Label `t('agents.suggestionDialog.textareaLabel')`. Placeholder `t('agents.suggestionDialog.textareaPlaceholder')`. Botón `t('agents.suggestionDialog.submitButton')`.
*   **Lógica e Interacciones:**
    *   `handleOpenForm`: Abre `AgentForm`. Usa `_prepareEditingAgentStateFromSuggestion` para sugerencias.
    *   `handleSubmitAgentForm`: Llama a `addAgent` o `updateAgent`. Muestra toast.
    *   `handleDeleteAgent`: Abre `ConfirmDialog`.
    *   `confirmDeleteAgent`: Llama a `deleteAgent`. Muestra toast.
    *   `handleImportAgents`, `handleExportAgents`, `handleExportSingleAgent`.
    *   `handleTestAgent`: Abre `AgentTestChat`.
    *   `handleSuggestAgent`: Abre `AISuggestionDialog`, llama a `callSuggestAgentDefinition`. Muestra toast.
*   **Dependencias Clave:** `SparklesIcon`, `PlusCircle`, `Edit3`, `PlayCircle`, `Upload`, `Download`, `AgentForm`, `AgentTestChat`, `AISuggestionDialog`, `ConfirmDialog`.

### 2.11. Gestión de Grupos de Trabajo IA (`/grupos-trabajo-ia`)
*   **Propósito:** Define equipos de agentes.
*   **Componente Principal:** `src/app/grupos-trabajo-ia/page.tsx`. Es un Client Component.
*   **Estructura:** `div` (clase `space-y-6`).
    *   `Card`: Contiene `PageSectionHeader`.
        *   Icono: `Workflow`. Título: `t('groups.title')`. Descripción: `t('groups.description')`.
        *   Prop `actions` (`div` clase `flex flex-wrap gap-2`):
            *   Botón "Crear con IA" (`t('groups.createWithAIButton')`), icono `SparklesIcon`, `onClick={() => setIsSuggestGroupDialogOpen(true)}`.
            *   Botón "Crear Grupo" (`t('groups.createGroupButton')`), icono `PlusCircle`, `onClick={() => handleOpenForm()}`.
    *   `CardContent`:
        *   Mensaje si `groups.length === 0`: Párrafo `t('groups.noGroupsMessage')`.
        *   Grid (`div` clases `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`):
            *   Cada grupo es un `Card` (clase `flex flex-col`).
                *   `CardHeader`: `CardTitle` (`group.name`, badge `t('groups.defaultGroupBadge')` si `group.isDefault`), `CardDescription`.
                *   `CardContent`: Texto "Agentes:" (`t('groups.agentsLabel')`, formato `t('groups.agentsCountFormat', { count })`), Texto "Tarea:" (`t('groups.taskLabel')`, `group.mainTask`).
                *   `CardFooter`: Botones (variante `ghost`, size `icon`): "Ejecutar" (`t('groups.action.execute')`, icono `Play`), "Editar" (`t('groups.action.edit')`, icono `Edit3`), "Eliminar" (`t('groups.action.delete')`, icono `Trash2`).
*   **Formulario de Grupo (en `Dialog`):**
    *   `DialogHeader`: `DialogTitle` (texto dinámico, ej. `t('groups.form.title.edit')`), `DialogDescriptionComponent` (texto dinámico, ej. `t('groups.form.descriptionModal.create')`).
    *   `div` (clase `flex-grow overflow-hidden`) con `ScrollArea` (clase `h-full ...`): `div` (clase `space-y-4 py-4`).
        *   Campos: `Label` y `Input` para nombre (`t('groups.form.label.name')`). `Textarea` para descripción (`t('groups.form.label.description')`) y tarea principal (`t('groups.form.label.mainTask')`, placeholder `t('groups.form.placeholder.mainTask')`).
        *   `Label` `t('groups.form.label.selectAgents')`. Párrafo `t('groups.form.orchestratorImplicitNote')`.
        *   `ScrollArea` (clase `h-40 ...`) con lista de `Checkbox` para agentes (`availableAgentsForSelection`). Label de checkbox es `agent.name`.
        *   Mensaje si `availableAgentsForSelection.length === 0`: `t('groups.form.noAgentsToSelectError')`.
    *   `DialogFooter`: Botones `t('common.cancel')`, y texto dinámico para guardar/crear (ej. `t('groups.form.button.saveChanges')`).
*   **`ConfirmDialog` para eliminar:** Título `t('groups.deleteSingleModal.title', { name })`, descripción `t('groups.deleteSingleModal.description')`.
*   **`Dialog` para ejecución de grupo:** Título `t('groups.executionModal.title', { name })`. `DialogDescriptionComponent` con `t('groups.executionModal.mainTaskLabel')` y `executingGroup?.mainTask`.
    *   Contenido: `LogsDisplay` (título `t('groups.executionModal.logTitle')`, logs `executionLog`).
    *   Footer: Botón `t('groups.executionModal.stopButton')` (`onClick={handleStopExecution}`), Botón `t('common.close')`.
*   **`AISuggestionDialog`:** Título `t('groups.suggestionDialog.title')`. Footer (`extraFooterContent`) con `t('groups.suggestionDialog.noAgentsWarning')` si no hay agentes. Botón `t('groups.suggestionDialog.submitButton')` o `t('groups.suggestionDialog.submitButtonDisabled')`.
*   **Lógica e Interacciones:**
    *   `handleOpenForm`, `handleSubmitForm`, `handleDeleteGroup`, `confirmDeleteGroup`.
    *   `handleExecuteGroup`: Inicia bucle (`MAX_EXECUTION_TURNS`). Llama a `callChatWithAIGroup` (para el orquestador) y `callChatWithAgentOrGlobal` (para agentes). Actualiza `executionLog` con mensajes traducidos (ej. `t('groups.execution.log.turnPrefix')`).
    *   `handleSuggestGroup`: Llama a `callSuggestGroupDefinition`.
*   **Dependencias Clave:** `Workflow`, `SparklesIcon`, `Play`, y otras comunes.

### 2.12. Configuración (`/configuracion`)
*   **Propósito:** Ajustar parámetros globales.
*   **Componente Principal:** `src/app/configuracion/page.tsx`. Es un Client Component.
*   **Estructura:** `Card` principal (clase `max-w-3xl mx-auto`).
    *   **Cabecera (`PageSectionHeader`):**
        *   Icono: `SettingsIcon`.
        *   Título: `t('settings.title')`.
        *   Descripción: `t('settings.description')`.
        *   Prop `actions` (`div` clase `flex flex-wrap gap-2`):
            *   `Input` (type `file`, id `import-config-input`, oculto). Botón "Importar" (`t('settings.importButton')`), icono `Upload`, `onClick` para disparar input.
            *   Botón "Exportar" (`t('settings.exportButton')`), icono `Download`, `onClick={handleExportConfig}`.
            *   Botón "Guardar Configuración" (`t('settings.saveButton')`), icono `Save`, `onClick={handleSaveSettings}`.
    *   **Contenido del Card (`CardContent`, clase `pt-6 space-y-8`):** Múltiples `Card` anidadas:
        *   **Configuración LLM:** `Card`.
            *   `CardHeader`: `CardTitle` (`t('settings.llm.title')`), `CardDescription` (`t('settings.llm.description')`).
            *   `CardContent` (clase `space-y-4`):
                *   `Label` (para `llm-provider`): `t('settings.llm.providerLabel')`.
                *   `Select` (id `llm-provider`, `value={currentLLMConfig.provider}`, `onValueChange` llama a `handleLLMConfigChange`):
                    *   `SelectTrigger` con `SelectValue` (placeholder `t('settings.llm.providerPlaceholder')`).
                    *   `SelectContent`: `SelectItem` para cada proveedor en `LLM_PROVIDERS` (constante de `src/lib/constants.ts`, valores: "Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama").
                *   `Label` (para `llm-api-url`): `t('settings.llm.apiUrlLabel')`.
                *   `Input` (id `llm-api-url`, `value={currentLLMConfig.apiUrl}`, `placeholder={t('settings.llm.apiUrlPlaceholder')}` o URL por defecto de `LLM_PROVIDER_DEFAULT_API_URLS`). `p` con descripción `t('settings.llm.apiUrlDescription')`.
                *   `Label` (para `llm-api-key`): `t('settings.llm.apiKeyLabel')`.
                *   `Input` (id `llm-api-key`, type `password`, `value={currentLLMConfig.apiKey}`, `placeholder={t('settings.llm.apiKeyPlaceholder')}`).
                *   `Label` (para `llm-model`): `t('settings.llm.modelNameLabel')`. Icono `Loader2` si `isLoadingGroqModels`.
                *   `Select` (id `llm-model`, `value={currentLLMConfig.model}`):
                    *   `SelectTrigger` con `SelectValue` (placeholder dinámico según proveedor: `t('settings.llm.modelNamePlaceholderLocal', { provider })` o `t('settings.llm.modelNamePlaceholder')`).
                    *   `SelectContent`: `SelectItem` para cada modelo en `availableModels` (poblado estáticamente desde `getModelsForProvider` en `src/lib/utils.ts` o dinámicamente para Groq).
                        *   Modelos Estáticos (ejemplos de `getModelsForProvider`):
                            *   Groq (fallback): "llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"
                            *   OpenAI: "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"
                            *   Google Gemini: "gemini-1.5-pro-latest", "gemini-1.0-pro", "gemini-1.5-flash-latest"
                            *   Anthropic: "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"
                            *   LM Studio: "Local Model LM Studio (escribir nombre)", "Llama3-LMStudio", "Mistral-LMStudio"
                            *   Ollama: "llama3", "mistral", "codellama", "phi3"
                    *   Párrafo de descripción si es proveedor local: `t('settings.llm.modelNameDescriptionLocal', { provider })`.
            *   `CardFooter`: Botón (texto `isTestingLLM ? t('settings.llm.testingConnectionButton') : t('settings.llm.testConnectionButton')`), icono `Loader2` (si `isTestingLLM`).
        *   **Configuración Git:** `Card`.
            *   `CardHeader`: `CardTitle` (`t('settings.git.title')`), `CardDescription` (`t('settings.git.description')`).
            *   `CardContent` (clase `space-y-4`):
                *   `Label` (para `git-repo-url`): `t('settings.git.repoUrlLabel')`. `Input` (placeholder `t('settings.git.repoUrlPlaceholder')`).
                *   Grid con `Input` para "Nombre de Usuario Git" (`t('settings.git.usernameLabel')`) y "Email de Git" (`t('settings.git.emailLabel')`).
                *   `Label` (para `git-pat`): `t('settings.git.patLabel')`. `Input` (type `password`, placeholder `t('settings.git.patPlaceholder')`).
            *   `CardFooter`: Botón (texto `isTestingGit ? t('settings.git.testingConnectionButton') : t('settings.git.testConnectionButton')`), icono `Loader2`.
        *   **Idioma de la Aplicación:** `Card`.
            *   `CardHeader`: `CardTitle` (`t('settings.language.title')`), `CardDescription` (`t('settings.language.description')`).
            *   `CardContent`: `Label` (para `language-select`, texto `t('settings.language.selectLabel')`).
                *   `Select` (id `language-select`, `value={i18nLanguage}`, `onValueChange` llama a `handleLanguageChange`):
                    *   `SelectTrigger` con `SelectValue` (placeholder `t('settings.language.selectPlaceholder')`).
                    *   `SelectContent`: `SelectItem` para cada idioma en `SUPPORTED_LANGUAGES` (constante de `src/lib/i18n/constants.ts`, actualmente Español e Inglés).
        *   **Modo Depuración:** `Card`.
            *   `CardHeader`: `CardTitle` (`t('settings.debug.title')`), `CardDescription` (`t('settings.debug.description')`).
            *   `CardContent`: `div` (clase `flex items-center space-x-2`) con `Switch` (id `debug-mode`, `checked={currentDebugMode}`) y `Label` (`t('settings.debug.switchLabel')`).
*   **Lógica e Interacciones:**
    *   Cambios en campos actualizan estados locales (`currentLLMConfig`, `currentGitConfig`, `currentDebugMode`).
    *   `handleSaveSettings`: Actualiza `AppStateContext` y muestra toast (`t('settings.toast.saved.title')`).
    *   `handleLanguageChange`: Llama a `setI18nLanguage` (de `useI18n`), que actualiza el idioma en `I18nContext` y `AppStateContext`. Muestra toast (`t('settings.toast.languageChanged.title')`).
    *   `handleTestLLM`, `handleTestGit`: Simulan pruebas, muestran toasts.
    *   `handleExportConfig`, `handleImportConfig`: Manejan JSON de `AppSettings`. Muestran toasts.
    *   `fetchAndSetGroqModels`: Llama a Server Action `getGroqModels` (de `src/app/configuracion/actions.ts`). Actualiza `groqModels` y `availableModels`. Muestra toasts (`t('settings.toast.groqModelsLoadSuccess.title')`, etc.).
*   **Dependencias Clave:** `SettingsIcon`, `Loader2`, `Upload`, `Download`, `Save`, `Input`, `Select`, `Switch`, `Separator`.

### 2.13. Funcionalidad Multiidioma
*   **Mecanismo:** Se utiliza un `I18nContext` (`src/context/I18nContext.tsx`) que provee una función `t(key: TranslationKey, params?: Record<string, string | number>)` y el idioma actual (`language`). El idioma se persiste en `localStorage` a través de `AppStateContext` (`settings.language`).
*   **Idiomas Soportados:** Español (`es`, por defecto) e Inglés (`en`). Definidos en `src/lib/i18n/constants.ts` (`SUPPORTED_LANGUAGES`).
*   **Archivos de Traducción:** `src/lib/i18n/translations.ts` contiene un objeto `translationsData` con las cadenas para cada idioma.
    *   **Estructura:** Anidada para reflejar las claves (ej. `es: { sidebar: { dashboard: "Panel de Control" } }`).
*   **Resolución de Claves:** La función `t()` usa una helper `getNestedTranslation` que resuelve claves anidadas (ej. "sidebar.dashboard"). Primero verifica si la clave existe como propiedad directa (para claves que contienen puntos, como "app.title"), y si no, intenta resolverla como una ruta anidada. Si no se encuentra una traducción para el idioma activo, intenta con el idioma por defecto. Si sigue sin encontrarse, devuelve la clave literal y registra un error en consola.
*   **Ejemplos:**
    *   Barra Lateral: `t('sidebar.dashboard')` muestra "Panel de Control" o "Dashboard".
    *   Página de Configuración: `t('settings.llm.title')` muestra "Configuración del Proveedor LLM" o "LLM Provider Settings".

## 3. Interfaz de Usuario (UI) - Más Detalles

### 3.1. Estructura de la Aplicación
*   **Layout Principal:** `src/app/layout.tsx` define `<html>` y `<body>`. Incluye los proveedores de contexto (`AppStateProvider`, `DebugProvider`, `I18nProvider`). El atributo `lang` de `<html>` se establece inicialmente a `DEFAULT_LANGUAGE_CODE` y luego se actualiza dinámicamente en el cliente por `I18nContext`.
*   **Layout de Aplicación:** `src/components/layout/AppLayout.tsx` implementa la barra lateral y cabecera superior.
    *   Utiliza `Sidebar` de `@/components/ui/sidebar`. La barra lateral es colapsable en escritorio (botón `CollapsibleSidebarButton` en `SidebarHeader` con `ChevronsLeft`/`ChevronsRight`). Se convierte en `Sheet` en móviles (disparador `SidebarTrigger` con `MenuIcon` en la cabecera principal, con título `t('sidebar.mobile.title')`).
    *   El `SidebarHeader` contiene el logo (`FlaskConical`, `h-8 w-8 text-primary`) y el título de la aplicación (`t('app.title')`).
    *   La cabecera principal (`header` tag) muestra el icono y título de la sección actual (traducidos, ej. `LayoutDashboard` y `t('sidebar.dashboard')`). Icono `h-6 w-6 text-primary`, título `h1 text-2xl font-semibold`. La cabecera es `sticky top-0 z-10`.

### 3.2. Estilos Visuales
Definidos en `src/app/globals.css` y `tailwind.config.ts`.
*   **Paleta de Colores Principal (Modo Claro por defecto, variables HSL en `globals.css`):**
    *   `--background`: `210 17% 94%` (#ECEFF1) - Fondo principal.
    *   `--foreground`: `233 30% 15%` (#20263B) - Texto principal.
    *   `--card`: `0 0% 100%` (#FFFFFF) - Fondo de tarjetas.
    *   `--card-foreground`: `233 30% 15%` (#20263B) - Texto en tarjetas.
    *   `--popover`: `0 0% 100%` (#FFFFFF) - Fondo de popovers.
    *   `--popover-foreground`: `233 30% 15%` (#20263B) - Texto en popovers.
    *   `--primary`: `233 63% 30%` (#1A237E) - Color primario (azul oscuro índigo).
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
        *   `--sidebar-primary`, `--sidebar-accent`, etc., heredan de los principales o tienen valores ligeramente ajustados si se especifican.
*   **Paleta de Colores (Modo Oscuro):** Definida en `globals.css` bajo `.dark { ... }`.
    *   `--background`: `233 30% 12%` (#171C26).
    *   `--foreground`: `210 17% 85%` (#D0D6DB).
    *   (Se listan los equivalentes oscuros para las demás variables, ej. `--card: 233 30% 15%`).
*   **Tipografía:**
    *   Fuente Principal (Sans-serif): Geist Sans (de `geist/font/sans`). Aplicada al `body`.
    *   Fuente Monoespaciada: Geist Mono (de `geist/font/mono`). Usada para bloques de código (`CodeBlock`, `CodeEditor`), logs.
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
*   **`generateCodeFromDescriptionFlow`**: (`src/ai/flows/generate-code-from-description.ts`)
    *   Input: `GenerateCodeFromDescriptionInput { description: string; agentSystemPrompt?: string; }`
    *   Output: `GenerateCodeFromDescriptionOutput { explanation: string; code: string; groupLog?: string; }`
    *   Prompt: Instruye a la IA para generar código y una explicación basada en la descripción. Puede ser contextualizado por `agentSystemPrompt`.
*   **`generateProjectStructureFlow`**: (`src/ai/flows/generate-project-structure-flow.ts`)
    *   Input: `GenerateProjectInput { description: string; agentSystemPrompt?: string; }`
    *   Output: `ProjectGenerationResult { projectName: string; aiNotes: string; files: GeneratedFile[]; groupLog?: string; }`
    *   Prompt: Pide a la IA que genere una estructura de proyecto (nombre, notas, archivos) basada en la descripción.
*   **`refactorProjectWithAIFlow`**: (`src/ai/flows/refactor-project-with-ai.ts`)
    *   Input: `RefactorProjectWithAIInput { projectSource: string; goals?: string; priority?: string; searchDepth?: number; focusArea?: string; agentSystemPrompt?: string; }`
    *   Output: `RefactorProjectWithAIOutput { projectOverview: string; suggestions: Array<Omit<RefactorSuggestion, 'id' | 'status'>>; groupLog?: string; }`
    *   Prompt: Pide a la IA que analice un proyecto y sugiera refactorizaciones, comenzando con un `projectOverview`.
*   **`analyzeCodeSnippetFlow`**: (`src/ai/flows/analyze-code-snippet.ts`)
    *   Input: `AnalyzeCodeSnippetInput { code: string; userPrompt?: string; language?: string; agentSystemPrompt?: string; }`
    *   Output: `AnalyzeCodeSnippetOutput { explanation: string; originalCode: string; suggestedCode: string; }`
    *   Prompt: Pide a la IA que explique el código original, sus objetivos, y luego sugiera mejoras.
*   **`analyzeSelfCodeFlow` (usado para Analizar Proyecto y AutoUpdate)**: (`src/ai/flows/analyze-self-code.ts`)
    *   Input: `AnalyzeCodeInput { sourceCodeLocation: 'Local' | 'Git' | 'UploadedString'; projectContent?: string; gitRepoUrl?: string; analysisPreferences?: string; searchDepth?: number; focusArea?: string; agentSystemPrompt?: string; }`
    *   Output: `AnalyzeCodeOutput { analysisTitle: string; identifiedAreas: string[]; detailedSuggestions: Array<...>; generalAssessment: string; groupLog?: string; overallImprovementIdeas?: string[]; }`
    *   Prompt: Pide a la IA que analice un proyecto completo, comenzando el `generalAssessment` con los objetivos del proyecto. Genera sugerencias detalladas (incluyendo `suggestedPromptForImplementation`) e ideas generales.
*   **`chatWithAgentOrGlobalFlow`**: (`src/ai/flows/chat-with-agent-or-global-flow.ts`)
    *   Input: `ChatWithAgentOrGlobalInput { userMessage: string; agentSystemPrompt?: string; }`
    *   Output: `ChatWithAgentOrGlobalOutput { aiResponse: string; }`
    *   Prompt: Permite chatear con la configuración LLM global o con un agente específico (usando su `agentSystemPrompt`).
*   **`chatWithAIGroupFlow`**: (`src/ai/flows/chat-with-ai-group-flow.ts`)
    *   Input: `ChatWithAIGroupInput { userMessage: string; groupMainTask: string; participatingAgents: AgentInfoForGroupSuggestion[]; orchestratorAgentSystemPrompt: string; }`
    *   Output: `ChatWithAIGroupOutput { orchestratorResponse: string; }`
    *   Prompt: Facilita la interacción con un grupo de agentes a través de su orquestador. El orquestador recibe la tarea del grupo, la lista de agentes y el mensaje del usuario, y debe devolver su decisión en JSON.
*   **`suggestAgentDefinitionFlow`**: (`src/ai/flows/suggest-agent-definition-flow.ts`)
    *   Input: `SuggestAgentDefinitionInput { roleDescription: string; }`
    *   Output: `SuggestAgentDefinitionOutput { name: string; description: string; systemPrompt: string; capabilities: AgentCapabilities; }`
    *   Prompt: Pide a la IA que sugiera una definición completa para un agente (nombre, descripción, prompt, capacidades) basada en la descripción de su rol.
*   **`suggestGroupDefinitionFlow`**: (`src/ai/flows/suggest-group-definition-flow.ts`)
    *   Input: `SuggestGroupDefinitionInput { groupTaskDescription: string; availableAgents: AgentInfoForGroupSuggestion[]; }`
    *   Output: `SuggestGroupDefinitionOutput { name: string; description: string; mainTask: string; agentIds: string[]; }`
    *   Prompt: Pide a la IA que sugiera una definición para un grupo de trabajo (nombre, descripción, tarea principal, agentes participantes) basada en la descripción de la tarea y los agentes disponibles.
*   **`autoFixErrorWithGroupFlow`**: (`src/ai/flows/auto-fix-error-with-group-flow.ts`)
    *   Input: `AutoFixErrorWithGroupInput { errorMessage: string; codeContext?: string; userInstructions?: string; }`
    *   Output: `AutoFixErrorWithGroupOutput { suggestedSolution: string; diagnosticNotes: string; initialGroupLog: string; }`
    *   Lógica: Construye un prompt para el grupo "EquipoDesarrolloSoftware" con el error y contexto. Llama a `callChatWithAIGroup` para obtener una solución/diagnóstico.
*   **Manejo de Errores en Flujos (`apiClient.ts`):**
    *   `apiClient.ts` envuelve las llamadas a estos flujos.
    *   Utiliza `retryAsyncFunction` para reintentos con backoff exponencial para errores transitorios (red, 503, 429).
    *   Usa `parseError` para convertir errores crudos en `AppError` (con `friendlyMessage`, `originalError`, `type`, `redirectTo`, `statusCode`).
    *   Registra errores detallados en la consola y permite que la UI muestre `friendlyMessage`.

### 4.2. Server Actions
*   **`src/app/autoupdate/actions.ts`**:
    *   **`getApplicationSourceBundle(concatenate: boolean, parentExecutionLogs?: string[])`**: Lee archivos del proyecto en el servidor (raíz de Next.js) usando `fs/promises`, `path`, `glob`. Ignora patrones en `ignorePatterns`. Devuelve `Promise<{ success: boolean; files?: AppSourceFile[]; concatenatedSource?: string; error?: string; logsBuilt?: string[]; }>`. Los `AppSourceFile` contienen `fileName` y `content`.
    *   **`handleUploadToGit(gitConfig: GitUploadConfig, commitMessage: string, parentExecutionLogs?: string[])`**: Usa `simple-git`. Llama a `getApplicationSourceBundle`. Crea un directorio temporal. Realiza `init`, `addConfig` (para usuario y email), `add .`, `commit`, `addRemote` (o `set-url` si ya existe 'origin') con la URL autenticada (`https://${username}:${pat}@repoUrl`), y `push -u origin <defaultBranch> --force`. Devuelve `Promise<GitUploadResult>`. Registra logs detallados de la operación.
*   **`src/app/configuracion/actions.ts`**:
    *   **`getGroqModels(apiKey: string)`**: Usa `groq-sdk` (`new Groq({ apiKey })`) para llamar a `groq.models.list()`. Extrae los IDs de los modelos de `chatModels.data.map(model => model.id)`. Devuelve `Promise<{ success: boolean; models?: string[]; error?: string; debug?: any; }>`. Registra logs detallados.

### 4.3. Bases de Datos
No hay base de datos backend tradicional. El estado (configuraciones, agentes, grupos, snapshots, idioma) se persiste en el `localStorage` del navegador vía `useLocalStorage` y `AppStateContext`. Los datos persistidos incluyen:
*   `codealchemist-settings`: Objeto `AppSettings`.
*   `codealchemist-agents`: Array `Agent[]`.
*   `codealchemist-groups`: Array `AIAgentGroup[]`.
*   `codealchemist-snapshots`: Array `CodeSnapshot[]`.
*   `codealchemist-debug-mode`: Booleano.
*   `codealchemist-data-initialized`: Booleano (para la inicialización de datos por defecto).

### 4.4. Agentes y Grupos (Por Defecto)
Definidos en `src/lib/constants.ts` (`DEFAULT_AGENTS`, `DEFAULT_GROUPS`).
*   **Agentes por Defecto:**
    *   **`OrquestadorFlujoAgentes`**: ID `orquestador-flujo-agentes`. Descripción: "Gestiona el flujo de trabajo...". System Prompt: Detalla su rol de analizar tarea, decidir siguiente agente y devolver JSON `{"next_agent_id": "...", "instruction_for_next_agent": "...", "reasoning": "..."}`. Capacidades: todas `false`. LLM Config: `useGlobal: true`. `isDefault: true`, `isDeletable: false`, `isNameEditable: false`.
    *   **`RefactorizadorCodigoExperto`**: ID `refactorizador-codigo-experto`. Descripción: "Especializado en análisis y refactorización...". System Prompt: Detalla su rol de analizar código, sugerir mejoras (Clean Code, SOLID), y devolver JSON con `area`, `description`, `priority`, `snippetSuggested` (opcional), `fullFileContentSuggested` (opcional). Capacidades: `accessOwnCode: true`, otras `false`. LLM Config: `useGlobal: true`. `isDefault: true`.
    *   **`JefeDeProducto`**: ID `jefe-de-producto`. Descripción: "Define requisitos...". System Prompt: Detalla su rol de definir requisitos, historias de usuario (formato estándar), prioridades. Capacidades: todas `false`. LLM Config: `useGlobal: true`. `isDefault: true`.
    *   **`ArquitectoSoftware`**: ID `arquitecto-software`. Descripción: "Diseña la arquitectura...". System Prompt: Detalla su rol de diseñar arquitectura, seleccionar tecnologías, asegurar escalabilidad. Pide diagramas (texto/Mermaid). Capacidades: todas `false`. LLM Config: `useGlobal: true`. `isDefault: true`.
    *   **`DesarrolladorSoftware`**: ID `desarrollador-software`. Descripción: "Escribe el código...". System Prompt: Detalla su rol de escribir código limpio, eficiente, documentado, pruebas unitarias. Pide solo contenido de archivo si se genera. Capacidades: `accessOwnCode: true`, `execution: true`, `virtualEnv: false`, `readWrite: true`. LLM Config: `useGlobal: true`. `isDefault: true`.
    *   **`IngenieroPruebas`**: ID `ingeniero-pruebas`. Descripción: "Escribe y ejecuta pruebas...". System Prompt: Detalla su rol de crear/ejecutar planes de prueba, reportar errores. Puede generar scripts de prueba. Capacidades: `accessOwnCode: true`, `execution: true`, `virtualEnv: false`, `readWrite: false`. LLM Config: `useGlobal: true`. `isDefault: true`.
    *   **`IngenieroDevOps`**: ID `ingeniero-devops`. Descripción: "Gestiona infraestructura...". System Prompt: Detalla su rol de IaC, CI/CD, monitoreo. Puede generar scripts (GitHub Actions, Dockerfile). Capacidades: `accessOwnCode: false`, `execution: true`, `virtualEnv: true`, `readWrite: true`. LLM Config: `useGlobal: true`. `isDefault: true`.
    *   **`RepresentanteUsuario`**: ID `representante-usuario`. Descripción: "Proporciona feedback...". System Prompt: Detalla su rol de dar feedback sobre usabilidad, UX, identificar fricción. Capacidades: todas `false`. LLM Config: `useGlobal: true`. `isDefault: true`.
    *   **`ValidadorCodigo`**: ID `validador-codigo`. Descripción: "Analiza resultados de refactorización...". System Prompt: Detalla su rol de analizar código (post-refactorización/generación), detectar errores, inconsistencias. Capacidades: `accessOwnCode: true`, `execution: true`, `virtualEnv: false`, `readWrite: false`. LLM Config: `useGlobal: true`. `isDefault: true`.
*   **Grupo de Trabajo por Defecto:**
    *   **`EquipoDesarrolloSoftware`**: ID `equipo-desarrollo-software`. Descripción: "Simula un equipo de producción de software completo...". Tarea Principal: Detalla el objetivo de funcionar como un equipo de desarrollo completo (analizar, diseñar, desarrollar, refactorizar, probar, desplegar, incorporar feedback) y, adicionalmente, mejorar el sistema "Auto-Fix" de CodeAlchemist (priorización dinámica, aprendizaje predictivo, validación robusta, sincronización con Orquestador). Agentes: Todos los anteriores (excepto Orquestador, que es implícito). `isDefault: true`.

## 5. Configuración Técnica

### 5.1. Dependencias
Ver `package.json`. Clave:
*   **`dependencies`**: `next`, `react`, `react-dom`, `genkit`, `@genkit-ai/googleai`, `@genkit-ai/next`, `lucide-react`, `tailwindcss`, `zod`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `geist` (para fuentes), `uuid`, `jszip` (para zipping en cliente), `simple-git` (para Server Actions Git), `glob` (para Server Actions de archivos), `groq-sdk` (para Server Action de modelos Groq), ShadCN UI (Radix) componentes (`@radix-ui/react-accordion`, `react-alert-dialog`, etc.), `date-fns`, `react-day-picker`, `recharts`.
*   **`devDependencies`**: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `prettier`, `postcss`, `genkit-cli`, `eslint-plugin-prettier`, `eslint-config-prettier`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `@types/uuid`, `@types/glob`.

### 5.2. Variables de Entorno (`.env` o `.env.local`)
*   `GOOGLE_API_KEY`: (Opcional, si se usa Google Gemini con Genkit directamente) Clave API para Google AI Studio o Vertex AI.
*   Otras claves API (Groq, OpenAI, Anthropic) se ingresan a través de la UI en la sección "Configuración" y se almacenan en `localStorage`.

### 5.3. Pruebas
*   **Linting y Formateo:** ESLint y Prettier están configurados.
    *   `npm run lint`: Verifica el código con ESLint.
    *   `npm run lint:fix`: Intenta corregir automáticamente los problemas de ESLint.
    *   `npm run format`: Formatea el código con Prettier.
    *   `npm run format:check`: Verifica el formateo con Prettier.
*   **Pruebas Unitarias/Integración:** No configuradas en la estructura actual del proyecto. Se recomienda Jest y React Testing Library.
*   **Pruebas E2E:** No configuradas. Se recomienda Playwright o Cypress.

### 5.4. Despliegue
*   **Plataforma Recomendada:** Vercel (ideal para Next.js).
*   **Otros:** Cualquier plataforma Node.js (Netlify, AWS Amplify, Google Cloud Run, etc.).
*   **Build:** `npm run build`.
*   Variables de entorno relevantes (como `GOOGLE_API_KEY` si se usa de forma directa) deben configurarse en el entorno de producción.

## 6. Guía de Inicio Detallada (Instalación y Primer Uso)

### 6.1. Requisitos Previos
*   Node.js (v18.x o superior).
*   npm (v8+) o yarn (v1.22+).
*   Git.
*   Un navegador web moderno y actualizado (Chrome, Firefox, Edge, Safari).
*   (Opcional) Claves API para los proveedores LLM que desees usar (ej. Groq, Google AI Studio, OpenAI, Anthropic). Si no se proporcionan, ciertas funcionalidades de IA no estarán disponibles o dependerán de configuraciones de agentes/grupos.
*   (Opcional) Si usas modelos LLM locales (LM Studio, Ollama), tenerlos instalados, configurados y en ejecución en la máquina local o en un servidor accesible por la red.

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
    Esto instalará todas las dependencias listadas en `package.json`, incluyendo `jszip`, `simple-git`, `glob`, `groq-sdk`, etc.
3.  **Configurar Variables de Entorno (Opcional pero Recomendado):**
    *   Crea un archivo `.env.local` en la raíz del proyecto (puedes copiar `.env.example` si existe, o crearlo desde cero).
    *   Si planeas usar modelos de Google AI directamente a través de Genkit (además de la configuración en la UI), añade tu clave:
        ```env
        GOOGLE_API_KEY=TU_CLAVE_API_DE_GOOGLE_AI_STUDIO_O_VERTEX
        ```
    *   Otras claves API (como Groq, OpenAI, Anthropic) se pueden introducir directamente en la UI de Configuración de CodeAlchemist, donde se almacenarán en el `localStorage` de tu navegador. No es estrictamente necesario ponerlas en `.env.local` a menos que algún flujo Genkit específico o Server Action las requiera directamente del entorno del servidor.
4.  **Ejecutar el Servidor de Desarrollo:**
    ```bash
    npm run dev
    # o si usas yarn:
    # yarn dev
    ```
    Por defecto, la aplicación se ejecuta en `http://localhost:9002` (según el script `dev` en `package.json`).
5.  **(Opcional) Ejecutar el Servidor de Desarrollo de Genkit (si se desarrollan/prueban flujos localmente fuera de Next.js):**
    ```bash
    npm run genkit:dev
    # o para modo watch:
    # npm run genkit:watch
    ```
    Esto inicia el entorno de desarrollo de Genkit, que puede ser útil para probar flujos de forma aislada.

### 6.3. Primer Uso y Configuración Inicial
1.  **Acceder a la Aplicación**: Abre `http://localhost:9002` (o el puerto configurado) en tu navegador.
2.  **Internacionalización**: La aplicación carga por defecto en **Castellano**. Puedes cambiar el idioma en la sección "Configuración".
3.  **Configuración Inicial (Muy Recomendado)**:
    *   Navega a la sección **"Configuración"** (icono de engranaje `SettingsIcon` en la barra lateral).
    *   **Configura tu Proveedor LLM Global**:
        *   **Proveedor LLM**: Selecciona el servicio de IA que usarás por defecto. Opciones disponibles: "Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama".
        *   **URL del Endpoint de API**: Se auto-rellena al seleccionar un proveedor con su URL estándar (ej. Groq: `https://api.groq.com/openai/v1`, LM Studio: `http://localhost:1234/v1`). Ajústala si es necesario. Para Google Gemini, puede quedar vacía ya que el plugin de Genkit maneja la conexión.
        *   **Clave API**: Introduce tu clave API si el proveedor la requiere.
        *   **Nombre del Modelo**: Elige un modelo de la lista.
            *   Para **Groq**, si introduces una clave API válida, la lista de modelos se intentará obtener dinámicamente de la API de Groq. Si falla, se mostrará una lista estática de modelos comunes.
            *   Para **OpenAI**, modelos como: "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo".
            *   Para **Google Gemini**: "gemini-1.5-pro-latest", "gemini-1.0-pro", "gemini-1.5-flash-latest".
            *   Para **Anthropic**: "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307".
            *   Para **LM Studio / Ollama**: Debes escribir el nombre exacto del modelo que tienes cargado localmente (ej. "llama3", "mistral").
        *   Haz clic en **`t('settings.llm.testConnectionButton')`** para verificar. (Actualmente es una simulación de prueba).
    *   **(Opcional) Configura Git**: Si usarás "Subir a Git" en "AutoUpdate", completa los detalles (URL del Repositorio, Nombre de Usuario, Email, PAT) y prueba la conexión.
    *   **(Opcional) Activa el Modo Depuración**: Para ver logs detallados en el panel inferior.
    *   **(Opcional) Cambia el Idioma**: Selecciona tu idioma preferido.
    *   Haz clic en **`t('settings.saveButton')`**.
4.  **Inicialización de Agentes y Grupos por Defecto**: La aplicación crea automáticamente los agentes y el grupo de trabajo por defecto (como `OrquestadorFlujoAgentes`, `EquipoDesarrolloSoftware`) si no existen en el `localStorage`. Puedes revisarlos y editarlos en sus respectivas secciones ("Agentes IA", "Grupos de Trabajo IA").
5.  **Explorar Funcionalidades**:
    *   Revisa el "Panel de Control" para accesos directos.
    *   Prueba "Generar Código" con un prompt simple.
    *   Explora "Agentes IA" y "Grupos de Trabajo IA" para ver los elementos creados por defecto y cómo se configuran.

## 7. Documentación Adicional

### 7.1. Errores Comunes y Soluciones
*   **`Module not found` (ej. `jszip`, `glob`, `simple-git`, `groq-sdk`):** Ejecuta `npm install` o `yarn install`. Asegúrate de que la dependencia esté en `package.json`.
*   **Errores de API LLM (401, 403, 429, 500, 503):** Verifica claves API, límites de tasa, o estado del proveedor. `apiClient.ts` implementa reintentos para 429/503. Errores 401/403 suelen redirigir a `/configuracion`.
*   **Errores de CORS (con modelos locales):** Asegúrate que el servidor LLM local (LM Studio, Ollama) esté configurado para permitir solicitudes desde el origen de CodeAlchemist (ej. `http://localhost:9002`). A menudo se configura con `*` para desarrollo.
*   **Problemas de Traducción (claves en lugar de texto):** Verifica que la clave exista en `src/lib/i18n/translations.ts` con la estructura anidada correcta y que el componente que usa `t()` sea un Client Component (`"use client";`). Un reinicio del servidor de desarrollo puede ser necesario después de modificar `translations.ts`.
*   **"Hydration failed":** Indica diferencias entre el HTML renderizado en el servidor y el cliente. Usualmente causado por acceso a `localStorage` o `window` durante la renderización inicial en el cliente. Asegúrate de que dicho código esté en `useEffect` o hooks como `useLocalStorage` que manejan esto.
*   **Errores de `simple-git` en Server Actions:** Asegúrate de que Git esté instalado en el entorno del servidor y accesible en el PATH. Verifica los permisos de acceso al repositorio y la validez del PAT.

### 7.2. Contribución
*   **Flujo Git:** Se recomienda GitFlow (ramas `feature/*`, `develop`, `main`).
*   **Estilo de Código:** Ejecutar `npm run lint:fix` y `npm run format` antes de realizar un commit para mantener la consistencia.
*   **Mensajes de Commit:** Se recomienda seguir el estándar de Conventional Commits (ej. `feat: add new button`, `fix: resolve login error`).
*   **Comentarios en Código:** Utilizar JSDoc para documentar funciones, componentes, tipos e interfaces nuevas o modificadas significativamente.

### 7.3. Licencia y Créditos
*   **Licencia:** (Asumir MIT si no hay un archivo `LICENSE.md` explícito en el repositorio).
*   **Iconos:** Lucide Icons (Licencia ISC).
*   **Componentes UI:** ShadCN UI (Licencia MIT), construidos sobre Radix UI.
*   **Fuentes:** Geist Sans, Geist Mono (Licencia OFL).

## 8. Detalles Olvidados (o Aspectos Técnicos Adicionales)

### 8.1. Aspectos Técnicos Adicionales
*   **Server Actions:** Son funciones asíncronas que se ejecutan en el servidor, invocadas desde componentes de cliente. Usadas en `src/app/autoupdate/actions.ts` para `getApplicationSourceBundle` (acceso a `fs`, `glob`) y `handleUploadToGit` (uso de `simple-git`), y en `src/app/configuracion/actions.ts` para `getGroqModels` (uso de `groq-sdk`).
*   **Seguridad de Claves API y PATs:** Las claves API y PATs ingresadas en la UI ("Configuración") se almacenan en el `localStorage` del navegador del usuario. Esto es conveniente para el desarrollo y uso personal, pero implica que si el navegador del usuario está comprometido, estas claves podrían ser accesibles. Para entornos de producción compartidos o más seguros, se deberían considerar alternativas como un backend que gestione estas claves de forma segura. Las capacidades de agente marcadas como "Peligroso" (ejecución, lectura/escritura) deben usarse con extrema precaución.
*   **Actualización de Traducciones:** Actualmente, las traducciones se gestionan manualmente en el archivo `src/lib/i18n/translations.ts`. Para sistemas más grandes, se podrían usar plataformas de gestión de traducciones.
*   **Persistencia del Estado (`AppStateContext`):** Todos los datos configurables por el usuario (ajustes, agentes, grupos, snapshots, idioma seleccionado, modo debug) se guardan en `localStorage` usando el hook `useLocalStorage`, lo que permite que el estado de la aplicación persista entre sesiones del navegador.

### 8.2. Ejemplos de Uso / Pruebas Críticas de Funcionalidad
*   **Probar Configuración LLM (Groq Dinámico):** En "Configuración", seleccionar "Groq", introducir una clave API válida. La lista de modelos debería actualizarse dinámicamente. Si se introduce una clave inválida, se debería mostrar un error y usar la lista estática de fallback. Probar cambiar a otro proveedor y verificar que la lista de modelos cambie.
*   **Probar Internacionalización:** En "Configuración", cambiar el idioma entre "Español" e "Inglés". Todos los textos de la interfaz de usuario (botones, etiquetas, títulos, placeholders, etc.) deberían cambiar al idioma seleccionado.
*   **Probar Creación de Agente con IA:** En "Agentes IA", hacer clic en "Crear con IA". En el diálogo, describir un rol para un nuevo agente. Al enviar, el formulario de creación de agente debería pre-rellenarse con las sugerencias de la IA (nombre, descripción, prompt de sistema, capacidades).
*   **Probar Ejecución de Grupo:** En "Grupos de Trabajo IA", seleccionar el grupo por defecto "EquipoDesarrolloSoftware". Hacer clic en "Ejecutar". El modal de ejecución debería mostrar un log detallado de las interacciones multi-turno coordinadas por el `OrquestadorFlujoAgentes`.
*   **Probar AutoUpdate (Fuente Local y Descarga ZIP):**
    1.  En "AutoUpdate", seleccionar fuente "Local" y un agente (ej. `RefactorizadorCodigoExperto`).
    2.  Hacer clic en "Iniciar Auto-Análisis". Se deberían mostrar resultados.
    3.  Marcar algunas sugerencias como "Aplicadas".
    4.  Hacer clic en "Descargar Código Actual (ZIP)". Se debería descargar un archivo ZIP. Este ZIP contiene los archivos del proyecto obtenidos de la Server Action `getApplicationSourceBundle`, con las sugerencias marcadas "aplicadas" conceptualmente en el cliente antes de la compresión.
*   **Probar Subida a Git (AutoUpdate):**
    1.  En "Configuración", configurar una URL de repositorio Git válida, nombre de usuario, email y PAT.
    2.  En "AutoUpdate", después de un análisis, hacer clic en "Subir a Git".
    3.  Introducir un mensaje de commit. Al confirmar, la Server Action `handleUploadToGit` debería ejecutarse y (si `simple-git` y Git CLI están disponibles y configurados en el servidor) subir los cambios al repositorio remoto. Verificar el repositorio.

Este README exhaustivo debería servir como una guía completa para entender, ejecutar, y contribuir al proyecto CodeAlchemist.

    