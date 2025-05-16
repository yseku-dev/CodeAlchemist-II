
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA.

**Idioma del Proyecto:** Todo el proyecto, incluyendo la interfaz de usuario, los mensajes, los comentarios en el código (donde aplique semánticamente) y la documentación (como este README), está desarrollado y presentado en **castellano**.

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
    *   **Iconos:** Lucide Icons
    *   **Gestión de Estado (Cliente):** React Context (`AppStateContext`, `DebugContext`, `I18nContext`) con `useLocalStorage` para persistencia.
    *   **Formateo y Linting:** ESLint y Prettier
    *   **Empaquetado (Cliente-Side ZIP):** JSZip
    *   **Interacción Git (Servidor):** `simple-git` (usado en Server Actions)
    *   **Acceso a Archivos (Servidor):** Módulos `fs`, `path`, `glob` de Node.js (usado en Server Actions)
*   **Arquitectura del Proyecto:**
    *   **Frontend:** Aplicación Next.js que se ejecuta en el navegador del cliente. Gestiona toda la interfaz de usuario y la lógica de presentación.
    *   **Backend (Lógica de IA y Acciones del Servidor):**
        *   **Flujos Genkit:** Definidos en `src/ai/flows/`, se ejecutan en el entorno del servidor de Next.js (o en un entorno Node.js separado si se despliega así Genkit). Manejan todas las interacciones con los modelos de lenguaje grandes (LLMs) para generación de código, análisis, etc.
        *   **Server Actions de Next.js:** Funciones definidas en archivos como `src/app/autoupdate/actions.ts` (con la directiva `"use server";`) que se ejecutan en el servidor. Se utilizan para operaciones que requieren acceso al sistema de archivos del servidor (ej. `getApplicationSourceBundle`) o para interactuar con herramientas del lado del servidor como `simple-git`.
    *   **APIs Externas:** Principalmente las APIs de los proveedores de LLM (Groq, Google AI Studio/Vertex AI, OpenAI, Anthropic, etc.) configuradas por el usuario.
    *   **Servicios Externos:** Potencialmente repositorios Git (GitHub, GitLab, etc.) para clonar o subir código.
    *   **Bases de Datos:** No utiliza una base de datos tradicional para su lógica principal. El estado de la aplicación (configuraciones, agentes, grupos, snapshots) se persiste en el `localStorage` del navegador del usuario.
*   **Requisitos Previos:**
    *   Node.js (versión recomendada: 18.x o superior)
    *   npm (o yarn)
    *   Git (para clonar el proyecto y para la funcionalidad de "Subir a Git")
    *   Un navegador web moderno (Chrome, Firefox, Edge, Safari).
    *   Claves API para los proveedores de LLM que se deseen utilizar (ej. `GOOGLE_API_KEY` para Genkit con Google AI, o claves para Groq, OpenAI, etc., que se configuran en la UI).

## 2. Funcionalidades y Características

CodeAlchemist ofrece un conjunto robusto de características diseñadas para asistir en diversas etapas del desarrollo de software:

*   **Generación de Código** (`/generar-codigo`): Permite a los usuarios crear fragmentos de código a partir de descripciones en lenguaje natural.
    *   **Inputs:**
        *   Selector "Usar Configuración LLM De" (`LLMConfigSelector`): Elige fuente de IA (Global, Agente, Grupo).
        *   Textarea "Describe tu necesidad": Prompt del usuario.
    *   **Lógica:**
        1.  Usuario llena el prompt y selecciona configuración LLM.
        2.  Botón "Generar Código" abre un diálogo de confirmación (`ConfirmDialog`).
        3.  Al confirmar, se llama a `callGenerateCodeFromDescription` (`apiClient.ts`), que invoca el flujo Genkit `generateCodeFromDescriptionFlow`.
        4.  Si se seleccionó un Agente o Grupo, su contexto (system prompt o main task del orquestador) se pasa al flujo para guiar al LLM.
    *   **Outputs:**
        *   Resultados muestran "Explicación" y "Fragmento de Código" (`CodeBlock`).
        *   Botón para copiar código.
        *   Si se usó un Grupo, se muestra un `LogsDisplay` con un log contextual del grupo.
    *   **Dependencias:** `LLMConfigSelector`, `ConfirmDialog`, `CodeBlock`, `LogsDisplay`, `useI18n`.
    *   **Interacciones:** El diálogo de confirmación permite revisar el prompt.

*   **Generación de Proyectos** (`/generar-proyecto`): Facilita la creación de una estructura base para nuevos proyectos.
    *   **Inputs:**
        *   Selector "Usar Configuración LLM De".
        *   Textarea "Describe tu proyecto".
    *   **Lógica:**
        1.  Usuario llena el prompt.
        2.  Botón "Generar Proyecto" abre `ConfirmDialog` que permite "Redefinir Prompt".
        3.  Al confirmar, se llama a `callGenerateProjectStructure` (`apiClient.ts`), que invoca `generateProjectStructureFlow`.
        4.  Contexto de Agente/Grupo se pasa al flujo.
    *   **Outputs:**
        *   Resultados: "Nombre Sugerido", "Notas de la IA".
        *   Lista de "Archivos Generados" usando `FileTreeDisplay`.
        *   Botón "Descargar Proyecto (ZIP)" (usa `JSZip` en cliente para crear un ZIP de los archivos generados).
        *   `LogsDisplay` si se usó un Grupo.
    *   **Dependencias:** `LLMConfigSelector`, `ConfirmDialog`, `FileTreeDisplay`, `JSZip`, `useI18n`.

*   **Refactorizar Proyecto** (`/refactorizar-proyecto`): Analiza un proyecto existente para obtener sugerencias de refactorización.
    *   **Inputs:**
        *   Selector "Usar Configuración LLM De".
        *   Fuente del Proyecto: Upload (ZIP, JSON, texto) o URL de Git.
        *   Parámetros: Metas (texto), Prioridad General (select), Profundidad de Búsqueda (numérico), Campo de Enfoque (texto).
    *   **Lógica:**
        1.  Usuario configura y pulsa "Analizar para Refactorizar".
        2.  Se llama a `callRefactorProjectWithAI` (`apiClient.ts`), que invoca `refactorProjectWithAIFlow`.
        3.  Contexto de Agente/Grupo y parámetros de refactorización se pasan al flujo.
    *   **Outputs:**
        *   Resultados: "Resumen del Proyecto", lista de "Sugerencias" (área, descripción, prioridad, snippet).
        *   Acciones por sugerencia: "Aplicar" (marca estado en UI), "Ver Diff" (abre modal con `CodeBlock`), "Descartar".
        *   Acción masiva: "Aplicar Todas".
        *   `LogsDisplay` si se usó un Grupo.
    *   **Dependencias:** `LLMConfigSelector`, `CodeBlock`, `ConfirmDialog` (implícito para Diff), `LogsDisplay`, `useI18n`.

*   **Análisis de Código Inteligente** (`/analizar-codigo`): Análisis detallado para fragmentos o archivos.
    *   **Inputs:**
        *   Selector "Usar Configuración LLM De".
        *   Fuente del Código: Upload, URL Git (raw), o pegar en `CodeEditor`.
        *   Campo "Instrucciones Adicionales".
    *   **Lógica:**
        1.  Usuario proporciona código y pulsa "Analizar Código".
        2.  Se llama a `callAnalyzeCodeSnippet` (`apiClient.ts`), que invoca `analyzeCodeSnippetFlow`.
        3.  Contexto de Agente/Grupo e instrucciones adicionales se pasan al flujo.
    *   **Outputs:**
        *   Resultados: "Explicación", "Código Original", "Código Sugerido" (todos en `CodeBlock`).
        *   Botones "Guardar Original" y "Guardar Sugerido" (crean snapshots en `AppStateContext`).
    *   **Dependencias:** `LLMConfigSelector`, `CodeEditor`, `CodeBlock`, `useI18n`.

*   **Análisis de Proyecto Completo** (`/analizar-proyecto`): Análisis holístico de proyectos.
    *   **Inputs:**
        *   Selector "Usar Configuración LLM De".
        *   Fuente del Proyecto: Upload (ZIP/JSON) o URL de Git.
        *   Parámetros: Profundidad de Búsqueda (numérico), Campo de Enfoque (texto).
    *   **Lógica:**
        1.  Usuario configura y pulsa "Analizar Proyecto".
        2.  Se llama a `callAnalyzeSelfCode` (que invoca `analyzeSelfCodeFlow`, renombrado conceptualmente a `analyzeProjectCodeFlow` en el prompt).
        3.  Contexto de Agente/Grupo y parámetros se pasan al flujo.
    *   **Outputs:**
        *   Resultados: "Título del Análisis", "Evaluación General" (comienza con objetivos del proyecto), "Ideas Generales de Mejora", "Áreas Identificadas", "Sugerencias Específicas" (con prompt sugerido).
        *   `LogsDisplay` si se usó un Grupo.
    *   **Dependencias:** `LLMConfigSelector`, `LogsDisplay`, `useI18n`.

*   **AutoUpdate (Análisis del Propio Código)** (`/autoupdate`): CodeAlchemist analiza su propio código.
    *   **Inputs:**
        *   Selector "Usar Configuración LLM De" (defecto: `RefactorizadorCodigoExperto`).
        *   Fuente: "Local" (Server Action `getApplicationSourceBundle` para obtener código del servidor) o "URL del Repositorio Git".
        *   "Preferencias de Análisis" (Campo de Enfoque).
    *   **Lógica:**
        1.  Usuario pulsa "Iniciar Auto-Análisis".
        2.  Si es "Local", se llama a Server Action `getApplicationSourceBundle`.
        3.  Se llama a `callAnalyzeSelfCode` con el código obtenido/referencia Git y preferencias.
    *   **Outputs (`AutoUpdateResultsDisplay`):**
        *   Resultados: Título, Evaluación General (comienza con objetivos del proyecto), Ideas Generales, Sugerencias Detalladas (con área, sugerencia, prioridad, contenido completo sugerido, prompt de implementación).
        *   Acciones por sugerencia (`autoupdate-suggestion-card`):
            *   "Editar Contenido": Permite modificar el `suggestedFullFileContent` en un `Textarea`.
            *   "Testear Sugerencia": Modal con código para revisión conceptual.
            *   "Testear en Ent. Virtual": Modal similar, explica que la ejecución real requiere infraestructura.
            *   "Aplicar Sugerencia": Modal de confirmación. Marca sugerencia como "applied" en UI. (Modificación real de archivos de CodeAlchemist no es posible desde navegador; Server Action sería necesaria).
        *   Descargas:
            *   "Descargar Sugerencias (JSON)": JSON de sugerencias (ruta -> contenido).
            *   "Descargar Código Actual (ZIP)": Llama a Server Action `getApplicationSourceBundle`, luego el cliente aplica conceptualmente las sugerencias "applied" y usa `JSZip` para crear un ZIP.
        *   "Subir a Git": Llama a Server Action `handleUploadToGit` (usa `simple-git` en servidor).
        *   Manejo de Errores con "Copiar Error" y "Auto-Fix" (usa `callAutoFixErrorWithGroup`).
        *   `LogsDisplay` para logs detallados.
    *   **Dependencias:** `LLMConfigSelector`, `AutoUpdateConfigForm`, `AutoUpdateResultsDisplay`, `autoupdate-suggestion-card`, `CodeBlock`, `ConfirmDialog`, `JSZip`, `useI18n`. Server Actions `getApplicationSourceBundle`, `handleUploadToGit`.

*   **Versiones Guardadas (Snapshots)** (`/versiones-guardadas`): Gestiona instantáneas de código o estado.
    *   **Lógica:** Muestra lista de snapshots de `AppStateContext`.
    *   Acciones por versión:
        *   "Ver": Modal con `CodeBlock`.
        *   "Descargar" (DropdownMenu): "como [JSON/TXT]" o "como ZIP" (descarga el contenido original con extensión .zip).
        *   "Eliminar".
        *   "Seleccionar para Comparar (A/B)".
    *   "Comparar Versiones": Modal con dos `CodeBlock` lado a lado.
    *   "Guardar Estado Actual de la Aplicación (JSON)": Guarda `settings`, `agents`, `groups` como un snapshot JSON.
    *   "Guardar Estado y Descargar como ZIP": Guarda estado y lo descarga como ZIP (conteniendo el JSON).
    *   "Eliminar Todas".
    *   **Dependencias:** `CodeBlock`, `ConfirmDialog`, `DropdownMenu`, `useI18n`.

*   **Chat con IA** (`/chat-ia`): Interactúa con un asistente IA.
    *   **Inputs:** Selector "Usar Configuración LLM De", Textarea para mensaje.
    *   **Lógica:**
        1.  Llama a `callChatWithAgentOrGlobal` o `callChatWithAIGroup` (`apiClient.ts`).
        2.  `chatWithAgentOrGlobalFlow` usa el prompt de sistema del Agente si se selecciona.
        3.  `chatWithAIGroupFlow` pasa la tarea al Orquestador del Grupo, quien devuelve su decisión/respuesta inicial.
    *   **Outputs:** Historial de conversación. "Borrar Chat". Manejo de errores con "Auto-Fix" (usa `callAutoFixErrorWithGroup`).
    *   **Dependencias:** `LLMConfigSelector`, `ErrorDisplay`, `useI18n`.

*   **Gestión de Agentes IA** (`/agentes-ia`): Crea, configura, prueba y gestiona agentes.
    *   **Lógica:** Lista agentes de `AppStateContext`.
    *   Botones: "Crear con IA" (`AISuggestionDialog` llama a `callSuggestAgentDefinition`), "Importar Agentes" (JSON), "Exportar Todos los Agentes" (JSON), "Crear Agente".
    *   Formulario "Crear/Editar Agente" (`agent-form`): Nombre, Descripción, Mensaje de Sistema, Capacidades (checkboxes), Configuración LLM (Global/Personalizada).
    *   Agentes por defecto `OrquestadorFlujoAgentes`, `RefactorizadorCodigoExperto` y otros.
    *   Acciones por agente: "Probar" (`agent-test-chat` llama a `callChatWithAgentOrGlobal`), "Exportar" (JSON individual), "Editar", "Eliminar".
    *   **Dependencias:** `AISuggestionDialog`, `agent-form`, `agent-test-chat`, `ConfirmDialog`, `useI18n`.

*   **Gestión de Grupos de Trabajo IA** (`/grupos-trabajo-ia`): Define equipos de agentes.
    *   **Lógica:** Lista grupos de `AppStateContext`.
    *   "Crear con IA" (`AISuggestionDialog` llama a `callSuggestGroupDefinition`).
    *   Formulario "Crear/Editar Grupo": Nombre, Descripción, Tarea Principal, Seleccionar Agentes (Orquestador implícito).
    *   Grupo por defecto `EquipoDesarrolloSoftware`.
    *   Acciones por grupo: "Ejecutar" (modal con `LogsDisplay` para log de ejecución multi-turno real, coordinado por `callChatWithAIGroup` y `callChatWithAgentOrGlobal` en bucle), "Editar", "Eliminar".
    *   **Dependencias:** `AISuggestionDialog`, `LogsDisplay`, `ConfirmDialog`, `useI18n`.

*   **Interfaz de Usuario Intuitiva**:
    *   Tecnologías: Next.js, React, TypeScript, ShadCN UI, Tailwind CSS.
    *   Barra Lateral (`AppLayout` y `Sidebar` de ShadCN UI): Colapsable (control `CollapsibleSidebarButton` con `ChevronsLeft`/`ChevronsRight` en el header del sidebar). Menú "hamburguesa" (`MenuIcon` y `SidebarTrigger`) en móviles.
    *   Paleta de colores profesional (detallada en sección "Diseño Visual").

*   **Configuración Personalizada** (`/configuracion`): Ajuste de parámetros globales.
    *   **Configuración LLM:** Proveedor, URL Endpoint, Clave API, Modelo. Botón "Probar Conexión" (simulado). Carga dinámica de modelos Groq vía Server Action `getGroqModels`.
    *   **Configuración Git:** URL Repositorio, Usuario, Email, PAT. Botón "Probar Conexión" (simulado).
    *   **Idioma:** Selector para cambiar entre 'es' y 'en'.
    *   **Modo Depuración:** Interruptor para panel de logs (`DebugPanel` en `AppLayout`).
    *   Botones "Importar"/"Exportar Configuración"/"Guardar Configuración" en cabecera de página.
    *   **Dependencias:** `Select`, `Input`, `Switch`, `Button`, `useI18n`.

*   **Manejo de Errores Mejorado**:
    *   `ErrorDisplay` muestra errores con opción de "Copiar Error" y "Auto-Fix" (usa `callAutoFixErrorWithGroup`).
    *   `apiClient.ts` centraliza llamadas a flujos, parsea errores a `AppError`, implementa reintentos con backoff.
    *   `src/app/error.tsx` como Error Boundary global.
    *   Listeners globales en `AppLayout.tsx` para errores JS no capturados.

### Funcionalidad Multiidioma
*   **Mecanismo:** Se utiliza un `I18nContext` (`src/context/I18nContext.tsx`) que provee una función `t(key: TranslationKey, params?: Record<string, string | number>)` y el idioma actual. El idioma se persiste en `localStorage` a través de `AppStateContext`.
*   **Idiomas Soportados:** Español (`es`, por defecto) e Inglés (`en`). Definidos en `src/lib/i18n/constants.ts`.
*   **Archivos de Traducción:** `src/lib/i18n/translations.ts` contiene un objeto `translationsData` con las cadenas para cada idioma.
    *   **Estructura:**
        ```javascript
        export const translationsData = {
          es: {
            app: { title: "CodeAlchemist" },
            sidebar: { dashboard: "Panel de Control", ... },
            // ... otras secciones
          },
          en: { /* traducciones en inglés */ }
        };
        ```
*   **Ejemplos:**
    *   Barra Lateral: `t('sidebar.dashboard')` muestra "Panel de Control" o "Dashboard".
    *   Página de Configuración: `t('settings.llm.title')` muestra "Configuración del Proveedor LLM" o "LLM Provider Settings".

## 3. Interfaz de Usuario (UI)

### Estructura de la Aplicación
La aplicación sigue la estructura del App Router de Next.js.
*   **Layout Principal:** `src/app/layout.tsx` define el `<html>` y `<body>` e incluye los proveedores de contexto globales (`AppStateProvider`, `DebugProvider`, `I18nProvider`).
*   **Layout de Aplicación:** `src/components/layout/AppLayout.tsx` implementa la barra lateral persistente y la cabecera superior, renderizando el contenido de la página actual.
    *   Utiliza el componente `Sidebar` de `@/components/ui/sidebar` (una personalización de ShadCN).
*   **Páginas Principales:** Residen en `src/app/` (ej. `src/app/page.tsx`, `src/app/configuracion/page.tsx`).

### Páginas y Componentes Clave

(Solo se listan algunos ejemplos, la lista completa sería demasiado extensa)

*   **`src/app/page.tsx` (Panel de Control)**
    *   **Ruta:** `/`
    *   **Propósito:** Página de bienvenida, accesos directos a funcionalidades.
    *   **Estructura:** `div` principal, `header` con logo (`FlaskConical`) y títulos, sección `grid` para tarjetas de características (`Card`), sección para guía rápida (`Card`).
    *   **Textos (ejemplos en español, gestionados por i18n):**
        *   Título: "Bienvenido a CodeAlchemist" (h1, text-4xl md:text-5xl font-bold).
        *   Descripción: "Tu plataforma de desarrollo asistido por IA..." (p, text-lg md:text-xl text-muted-foreground).
    *   **Botones (ejemplo):** "Ir a Configuración" (`Button` primario, size lg).
*   **`src/app/configuracion/page.tsx` (Configuración)**
    *   **Ruta:** `/configuracion`
    *   **Propósito:** Ajustar parámetros globales.
    *   **Estructura:** `Card` principal con `PageSectionHeader`. Múltiples `Card` anidadas para secciones (LLM, Git, Idioma, Debug).
    *   **Elementos (ejemplos):**
        *   `PageSectionHeader`: Icono `SettingsIcon`, título `t('settings.title')`. Acciones: botones "Importar", "Exportar", "Guardar".
        *   **LLM:** `Label` `t('settings.llm.providerLabel')`, `Select` para proveedor, `Input` para URL API (placeholder `t('settings.llm.apiUrlPlaceholder')`), `Input` tipo password para API Key, `Select` para Modelo. `Button` `t('settings.llm.testConnectionButton')`.
        *   **Idioma:** `Label` `t('settings.language.selectLabel')`, `Select` para idioma.
*   **`src/components/ui/card.tsx` (Componente Card de ShadCN)**
    *   Usado extensamente para contener secciones de contenido.
    *   Clases: `rounded-lg border bg-card text-card-foreground shadow-sm`.
    *   Hijos: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
*   **`src/components/llm-config-selector.tsx`**
    *   **Propósito:** Selector reutilizable para fuente de configuración LLM.
    *   **Estructura:** `Button` que abre un `Dialog`. `DialogContent` con `ScrollArea` y lista de opciones.
    *   **Textos (ejemplos):** Botón muestra selección actual (ej. `t('common.globalSettings')`), título del diálogo es `label` prop.

### Estilos Visuales
Definidos principalmente en `src/app/globals.css` usando variables CSS HSL y clases de Tailwind CSS.

*   **Paleta de Colores Principal (Claro por defecto):**
    *   `--background`: `210 17% 94%` (#ECEFF1) - Fondo principal.
    *   `--foreground`: `233 30% 15%` - Texto principal.
    *   `--card`: `0 0% 100%` (#FFFFFF) - Fondo de tarjetas.
    *   `--card-foreground`: `233 30% 15%`.
    *   `--popover`: `0 0% 100%`.
    *   `--popover-foreground`: `233 30% 15%`.
    *   `--primary`: `233 63% 30%` (#1A237E) - Color primario (azul oscuro).
    *   `--primary-foreground`: `210 17% 85%` - Texto sobre primario.
    *   `--secondary`: `210 17% 88%` - Color secundario (gris claro).
    *   `--secondary-foreground`: `233 30% 20%`.
    *   `--muted`: `210 17% 90%`.
    *   `--muted-foreground`: `233 20% 40%`.
    *   `--accent`: `174 60% 40%` (#26A69A) - Color de acento (teal).
    *   `--accent-foreground`: `210 17% 15%`.
    *   `--destructive`: `0 84.2% 60.2%` (Rojo).
    *   `--destructive-foreground`: `0 0% 10%`.
    *   `--border`: `210 17% 85%`.
    *   `--input`: `210 17% 85%`.
    *   `--ring`: `174 60% 40%` (Anillo de enfoque, teal).
    *   **Sidebar (Claro):**
        *   `--sidebar-background`: `220 13% 95%` (#F0F2F5).
        *   `--sidebar-foreground`: `233 30% 25%`.
        *   ... otras variables de sidebar.
*   **Paleta de Colores (Oscuro):** Definida en `globals.css` bajo el selector `.dark { ... }`.
    *   `--background`: `233 30% 12%`.
    *   `--foreground`: `210 17% 85%`.
    *   ... y equivalentes oscuros para las demás variables.
*   **Tipografía:**
    *   **Fuente Principal (Sans-serif):** Geist Sans (de `geist/font/sans`). Aplicada al `body`.
    *   **Fuente Monoespaciada:** Geist Mono (de `geist/font/mono`). Usada para bloques de código, logs.
*   **Iconografía:**
    *   **Biblioteca Principal:** Lucide Icons (`lucide-react`).
    *   **Logo de la Aplicación:** `FlaskConical` (matraz de alquimista). Color: `text-primary`.
*   **Layout General:**
    *   Diseño responsivo usando Tailwind CSS.
    *   Esquinas redondeadas (`rounded-md`, `rounded-lg` de ShadCN/Tailwind).
    *   Sombras sutiles (`shadow-sm`, `shadow-lg`).
*   **Animaciones y Transiciones:**
    *   Transiciones de color/fondo en hover para botones y elementos interactivos (definidas por Tailwind/ShadCN).
    *   Animaciones de acordeón (`accordion-down`, `accordion-up` en `tailwind.config.ts`).
    *   Animaciones de entrada/salida para diálogos y popovers (definidas por Radix UI/ShadCN).

### Interacciones del Usuario (Ejemplos)
*   **Click en Botón:**
    *   "Generar Código": Abre `ConfirmDialog`, luego llama a flujo Genkit.
    *   "Guardar Configuración": Actualiza `AppStateContext` y `localStorage`.
    *   "Aplicar Sugerencia" (AutoUpdate): Abre `ConfirmDialog`, marca estado en UI.
*   **Selección en `Select`:**
    *   Proveedor LLM (Configuración): Actualiza `currentLLMConfig`, recarga modelos si es Groq.
    *   Idioma (Configuración): Llama a `setI18nLanguage`.
*   **Entrada en `Textarea` / `Input`:**
    *   Formularios controlados por estado React.
    *   `CodeEditor` persiste en `localStorage` al cambiar o perder foco.
*   **Responsive Design:**
    *   Barra lateral colapsa a modo "icono" en escritorio o se convierte en panel deslizable (`Sheet`) en móviles.
    *   Grids (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) se adaptan.
    *   Elementos Flexbox (`flex-col sm:flex-row`) cambian dirección.

## 4. Lógica y Backend

### Servicios y Endpoints (Flujos Genkit)
La lógica de IA se maneja mediante flujos Genkit definidos en `src/ai/flows/`. Estos se ejecutan en el servidor. Son llamados desde el frontend mediante funciones wrapper en `src/utils/apiClient.ts`.

*   **`generateCodeFromDescriptionFlow`**:
    *   Input: `{ description: string, agentSystemPrompt?: string }`
    *   Output: `{ explanation: string, code: string, groupLog?: string }`
    *   Lógica: Pasa la descripción (y contexto opcional) al LLM para generar código y una explicación.
*   **`generateProjectStructureFlow`**:
    *   Input: `{ description: string, agentSystemPrompt?: string }`
    *   Output: `{ projectName: string, aiNotes: string, files: GeneratedFile[], groupLog?: string }`
    *   Lógica: Pasa descripción al LLM para generar estructura de proyecto, nombres de archivo, contenido y notas.
*   **`refactorProjectWithAIFlow`**:
    *   Input: `RefactorProjectWithAIInput` (incluye `projectSource`, `goals`, `priority`, `searchDepth`, `focusArea`, `agentSystemPrompt`)
    *   Output: `RefactorProjectWithAIOutput` (incluye `projectOverview`, `suggestions`, `groupLog`)
    *   Lógica: Analiza código (referencia) y parámetros para sugerir refactorizaciones.
*   **`analyzeCodeSnippetFlow`**:
    *   Input: `AnalyzeCodeSnippetInput` (incluye `code`, `userPrompt`, `language`, `agentSystemPrompt`)
    *   Output: `AnalyzeCodeSnippetOutput` (incluye `explanation`, `originalCode`, `suggestedCode`)
*   **`analyzeSelfCodeFlow` (`analyzeProjectCodeFlow`)**:
    *   Input: `AnalyzeCodeInput` (incluye `sourceCodeLocation`, `projectContent`, `gitRepoUrl`, `focusArea`, `searchDepth`, `agentSystemPrompt`)
    *   Output: `AnalyzeCodeOutput` (incluye `analysisTitle`, `generalAssessment`, `identifiedAreas`, `detailedSuggestions` con `suggestedPromptForImplementation`, `overallImprovementIdeas`, `groupLog`)
*   **`chatWithAgentOrGlobalFlow`**:
    *   Input: `{ userMessage: string, agentSystemPrompt?: string }`
    *   Output: `{ aiResponse: string }`
*   **`chatWithAIGroupFlow`**:
    *   Input: `ChatWithAIGroupInput` (incluye `userMessage`, `groupMainTask`, `participatingAgents`, `orchestratorAgentSystemPrompt`)
    *   Output: `{ orchestratorResponse: string }` (JSON con decisión del orquestador)
*   **`suggestAgentDefinitionFlow`**:
    *   Input: `{ roleDescription: string }`
    *   Output: `SuggestAgentDefinitionOutput` (nombre, descripción, prompt, capacidades)
*   **`suggestGroupDefinitionFlow`**:
    *   Input: `{ groupTaskDescription: string, availableAgents: AgentInfoForGroupSuggestion[] }`
    *   Output: `SuggestGroupDefinitionOutput` (nombre, descripción, tarea principal, agentIds)
*   **`autoFixErrorWithGroupFlow`**:
    *   Input: `AutoFixErrorWithGroupInput` (incluye `errorMessage`, `codeContext`, `userInstructions`)
    *   Output: `AutoFixErrorWithGroupOutput` (incluye `suggestedSolution`, `diagnosticNotes`, `initialGroupLog`)
*   **Manejo de Errores en Flujos:** Los flujos Genkit pueden lanzar errores si el LLM falla. `apiClient.ts` los captura, los parsea a `AppError` y los relanza para que la UI los maneje. Implementa reintentos para errores transitorios.

### Bases de Datos
No hay una base de datos backend tradicional. El estado persistente de la aplicación (configuraciones, agentes, grupos, snapshots) se guarda en el `localStorage` del navegador del usuario.

### Agentes y Grupos (Definiciones por Defecto en `src/lib/constants.ts`)
*   **Roles de Usuario:** No hay un sistema formal de roles de usuario con diferentes permisos a nivel de aplicación. Todas las funcionalidades están disponibles para cualquier usuario.
*   **Autenticación/Autorización:** No implementadas. La aplicación es de uso local en el navegador y no requiere login. Las claves API se guardan localmente.
*   **Agentes por Defecto:**
    *   **`OrquestadorFlujoAgentes`**:
        *   **ID:** `orquestador-flujo-agentes`
        *   **Descripción:** Gestiona flujo de trabajo entre agentes en un grupo.
        *   **Prompt de Sistema:** Instruye para analizar tarea, decidir siguiente agente, formular instrucción y devolver decisión en JSON: `{"next_agent_id": "...", "instruction_for_next_agent": "...", "reasoning": "..."}`. Si la tarea está completa, `next_agent_id` es "COMPLETADO".
        *   **Capacidades:** Ninguna peligrosa.
        *   **No editable, no eliminable.**
    *   **`RefactorizadorCodigoExperto`**:
        *   **ID:** `refactorizador-codigo-experto`
        *   **Descripción:** Especializado en análisis y refactorización.
        *   **Prompt de Sistema:** Instruye para sugerir mejoras (Clean Code, SOLID), devolver en JSON con `area`, `description`, `priority`, `snippetSuggested` (opcional), `fullFileContentSuggested` (opcional).
        *   **Capacidades:** `accessOwnCode: true`.
    *   **`JefeDeProducto`**: Define requisitos, historias de usuario.
    *   **`ArquitectoSoftware`**: Diseña arquitectura, selecciona tecnologías.
    *   **`DesarrolladorSoftware`**: Escribe código. Capacidades: `accessOwnCode`, `execution`, `readWrite`.
    *   **`IngenieroPruebas`**: Escribe y ejecuta pruebas. Capacidades: `accessOwnCode`, `execution`.
    *   **`IngenieroDevOps`**: Gestiona infraestructura, CI/CD. Capacidades: `execution`, `virtualEnv`, `readWrite`.
    *   **`RepresentanteUsuario`**: Proporciona feedback de usuario.
    *   **`ValidadorCodigo`**: Analiza resultados de refactorización. Capacidades: `accessOwnCode`, `execution`.
*   **Grupo de Trabajo por Defecto:**
    *   **`EquipoDesarrolloSoftware`**:
        *   **ID:** `equipo-desarrollo-software`
        *   **Descripción:** Simula un equipo de producción de software completo.
        *   **Tarea Principal:** Ser un equipo versátil para desarrollo y mejorar el sistema "Auto-Fix" de CodeAlchemist (priorización dinámica, aprendizaje predictivo, validación robusta, sincronización con Orquestador).
        *   **Agentes Participantes:** `JefeDeProducto`, `ArquitectoSoftware`, `DesarrolladorSoftware`, `RefactorizadorCodigoExperto`, `ValidadorCodigo`, `IngenieroPruebas`, `IngenieroDevOps`, `RepresentanteUsuario`.

## 5. Configuración Técnica

### Dependencias
Ver el archivo `package.json` para la lista completa de dependencias y devDependencies. Algunas clave son:
*   `next`, `react`, `react-dom`
*   `@genkit-ai/googleai`, `genkit`
*   `lucide-react` (iconos)
*   `tailwindcss`, `tailwind-merge`, `tailwindcss-animate`
*   ShadCN UI (Radix UI) componentes: `@radix-ui/react-dialog`, `@radix-ui/react-select`, etc.
*   `zod` (validación de esquemas para Genkit)
*   `jszip` (creación de ZIPs en cliente)
*   `simple-git` (operaciones Git en Server Actions)
*   `glob` (búsqueda de archivos en Server Actions)
*   `groq-sdk` (para la API de modelos de Groq)
*   ESLint, Prettier y plugins asociados.

### Variables de Entorno (`.env.local`)
*   `GOOGLE_API_KEY`: Requerida si se usa el plugin `googleAI` de Genkit con modelos de Google.
*   Otras claves API (ej. `GROQ_API_KEY`, `OPENAI_API_KEY`) no se gestionan típicamente como variables de entorno para esta aplicación, sino que se ingresan en la UI (sección Configuración) y se guardan en `localStorage`. La `GROQ_API_KEY` se usa en una Server Action si se pasa desde el cliente.

### Pruebas
*   **Linting y Formateo:** ESLint y Prettier están configurados.
    *   `npm run lint`: Verifica el código.
    *   `npm run lint:fix`: Intenta corregir errores de linting.
    *   `npm run format`: Formatea el código con Prettier.
*   **Pruebas Unitarias/Integración:** No hay un framework de pruebas (Jest, RTL) configurado actualmente. Se recomienda implementarlo.
*   **Pruebas E2E:** No configuradas. Se recomienda Playwright o Cypress.

### Despliegue
*   **Plataforma Recomendada:** Vercel (por los creadores de Next.js), ya que ofrece una integración óptima.
*   **Otros:** Cualquier plataforma que soporte Node.js (Netlify, AWS Amplify, DigitalOcean App Platform, Heroku, VPS con PM2 o Docker).
*   **Build:** `npm run build` crea una versión optimizada para producción.
*   **Variables de Entorno en Producción:** Se deben configurar las mismas variables de entorno que en desarrollo (ej. `GOOGLE_API_KEY`) en la plataforma de despliegue.
*   **Flujos Genkit:** Si los flujos Genkit se despliegan como parte de la app Next.js (comportamiento por defecto con `@genkit-ai/next`), se escalarán con la aplicación. Si se despliegan como un servicio separado (ej. Cloud Functions, Cloud Run), la app Next.js necesitaría la URL de ese endpoint.
*   **Caching:** Next.js maneja caching de datos y renderizado. Se pueden configurar cabeceras HTTP para caching de assets estáticos en el servidor de despliegue.

## 6. Documentación Adicional

### Errores Comunes y Soluciones
*   **"Module not found" (ej. `jszip`, `glob`, `simple-git`, `groq-sdk`):** Asegúrate de haber ejecutado `npm install` o `yarn install` después de clonar el repositorio o después de que se añadan nuevas dependencias al `package.json`.
*   **Errores de API LLM (401, 403, 429):**
    *   **401/403 (No autorizado/Prohibido):** Verifica que la Clave API ingresada en Configuración sea correcta y tenga los permisos necesarios para el modelo seleccionado.
    *   **429 (Demasiadas Solicitudes):** Has alcanzado el límite de tasa de la API. Espera un momento e inténtalo de nuevo. Considera modelos menos demandados o planes de API superiores si ocurre frecuentemente.
*   **Errores de API LLM (500, 503):** Indican un problema en el servidor del proveedor LLM. Inténtalo más tarde. La app tiene reintentos automáticos para esto.
*   **Errores de CORS (si se usan endpoints de API personalizados):** Asegúrate de que el servidor LLM (especialmente para modelos locales) esté configurado para permitir solicitudes desde el origen donde se ejecuta CodeAlchemist.
*   **Problemas de Traducción (claves mostradas en lugar de texto):**
    1.  Reinicia el servidor de desarrollo.
    2.  Verifica que la clave exista exactamente (sensible a mayúsculas/minúsculas y anidación) en `src/lib/i18n/translations.ts` para el idioma activo y el de por defecto.
    3.  Asegúrate de que el componente que usa `t()` sea un Client Component (`"use client";`).
*   **"Hydration failed" (Errores de Hidratación de React):** Generalmente indican una diferencia entre el HTML renderizado en servidor y el primer renderizado en cliente. A menudo relacionado con el uso de APIs de navegador (como `localStorage` o `window`) directamente en la lógica de renderizado inicial. Asegúrate de que dichos accesos estén dentro de `useEffect` o se manejen de forma que el primer renderizado sea consistente.

### Contribución
*   **Flujo de Trabajo Git:** Se recomienda seguir un flujo como GitFlow (ramas `feature`, `develop`, `main`).
*   **Estilo de Código:** Ejecuta `npm run lint:fix` y `npm run format` antes de hacer commit.
*   **Mensajes de Commit:** Sigue un estándar (ej. Conventional Commits).
*   **Comentarios:** Documenta el código nuevo o modificado con JSDoc.

### Licencia y Créditos
*   **Licencia:** (Asumir MIT si no hay archivo LICENSE.md. El desarrollador debe añadirlo).
*   **Iconos:** Lucide Icons (Licencia ISC).
*   **Componentes UI:** ShadCN UI (Licencia MIT).
*   **Fuentes:** Geist Sans, Geist Mono (Licencia OFL).

## 7. Detalles Olvidados

### Aspectos Técnicos Adicionales
*   **Server Actions:** Se utilizan para operaciones del lado del servidor que necesitan acceso al sistema de archivos (ej. `getApplicationSourceBundle` en `autoupdate/actions.ts`) o para interactuar con librerías Node.js pesadas (ej. `simple-git` en `autoupdate/actions.ts` para la subida a Git, o `groq-sdk` en `configuracion/actions.ts`). Esto mantiene la lógica sensible fuera del cliente.
*   **Seguridad:**
    *   Las claves API ingresadas en la UI se guardan en `localStorage`. Esto es conveniente pero tiene implicaciones si el navegador del usuario está comprometido.
    *   La funcionalidad de "Subir a Git" en AutoUpdate requiere un PAT que, si es comprometido, podría dar acceso al repositorio.
    *   Las capacidades "peligrosas" de los agentes (ejecución, lectura/escritura) deben usarse con extrema precaución.
*   **Actualización de Traducciones:** Actualmente, las traducciones están en `src/lib/i18n/translations.ts`. Para añadir/modificar, se edita este archivo directamente. No hay un CMS de traducciones integrado.
*   **Persistencia del Estado:** El estado principal de la aplicación (configuración, agentes, grupos, snapshots, idioma) se persiste en `localStorage` usando el hook `useLocalStorage`.

### Ejemplos de Uso / Pruebas Críticas
*   **Probar Configuración LLM:** Ve a "Configuración", selecciona un proveedor (ej. Groq), ingresa tu clave API y modelo, y pulsa "Probar Conexión". Para Groq, la lista de modelos debería cargarse dinámicamente.
*   **Probar Internacionalización:** Ve a "Configuración", cambia el idioma a "English". Navega por la aplicación; la mayoría de los textos de la UI deberían cambiar. Cambia de nuevo a "Español".
*   **Probar Creación de Agente con IA:** Ve a "Agentes IA", pulsa "Crear con IA", describe un rol (ej. "un agente que escribe código Python para web scraping"), y observa cómo se pre-rellena el formulario.
*   **Probar Ejecución de Grupo:** Ve a "Grupos de Trabajo IA", selecciona "EquipoDesarrolloSoftware", pulsa "Ejecutar". En el modal, introduce una tarea simple como "Resume los objetivos principales de este grupo de trabajo" y observa el log de ejecución (será una simulación de turnos con el orquestador).
*   **Probar AutoUpdate (Análisis Local):** Ve a "AutoUpdate", selecciona "Local" y un agente (ej. `RefactorizadorCodigoExperto`), y pulsa "Iniciar Auto-Análisis". Observa las sugerencias. Intenta descargar el "Código Actual (ZIP)" (recordando que usa la Server Action para obtener los archivos del servidor y JSZip en cliente).

Este README exhaustivo debería servir como una guía completa para entender, ejecutar, y contribuir al proyecto CodeAlchemist.
