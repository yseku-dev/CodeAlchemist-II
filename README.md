
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA.

**Idioma del Proyecto:** Todo el proyecto, incluyendo la interfaz de usuario, los mensajes, los comentarios en el código (donde aplique semánticamente) y la documentación (como este README), está desarrollado y presentado en **castellano**.

**Operatividad:** Todas las funcionalidades descritas en este documento son completamente operativas y no incluyen procedimientos simulados o experimentales donde se indique que la funcionalidad es real. Las acciones que implican modificación de código (sugeridas por la IA y aplicadas por el usuario) o interacción con sistemas externos (como APIs de LLMs o Git) se ejecutan de forma real según la configuración y permisos otorgados. Las limitaciones inherentes a un entorno de navegador (como la modificación directa de archivos del sistema) se indican cuando son relevantes.

## Características Principales

CodeAlchemist ofrece un conjunto robusto de características diseñadas para asistir en diversas etapas del desarrollo de software:

*   **Generación de Código**: Permite a los usuarios crear fragmentos de código a partir de descripciones en lenguaje natural. Esta funcionalidad utiliza la configuración de IA seleccionada, que puede ser la configuración global de la aplicación, la configuración específica de un agente IA, o la de un grupo de trabajo IA. El proceso implica:
    *   Un selector **"Usar Configuración LLM De"** para elegir la fuente de IA (Global, Agente específico, o Grupo de Trabajo).
    *   Un área de texto **"Describe tu necesidad"** para que el usuario ingrese el prompt detallado sobre el código que desea generar.
    *   Un botón **"Generar Código"**. Al pulsarlo, y tras una posible confirmación donde se muestra el prompt y la configuración LLM a usar, se inicia el proceso de generación.
    *   La sección de **Resultados** muestra primero una **Explicación** (opcional, generada por la IA) del código que se va a generar, seguida del **Fragmento de Código** en sí. Dispone de un botón para **Copiar Código**.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página, el cual es expandible/contraíble y permite copiar su contenido.

*   **Generación de Proyectos**: Facilita la creación de una estructura base para nuevos proyectos (archivos y carpetas) a partir de especificaciones del usuario. Utiliza la configuración de IA seleccionada (global, agente específico o grupo de trabajo).
    *   Selector **"Usar Configuración LLM De"**.
    *   Área de texto **"Describe tu proyecto"** para el prompt detallado, indicando tipo de proyecto, tecnologías, estructura deseada, etc.
    *   Botón **"Generar Proyecto"**. Al pulsarlo, se abre un diálogo de **"Confirmar Generación"** donde el usuario puede revisar el prompt actual y, si es necesario, **Redefinir Prompt (opcional)** para ajustarlo antes de continuar. También se muestran botones para "Cancelar" o "Sí, Generar Proyecto".
    *   En los **Resultados**, se muestra un **"Nombre Sugerido"** para el proyecto (generado por la IA) y **"Notas de la IA"** con comentarios sobre la estructura generada o posibles próximos pasos.
    *   Se presenta una lista de **"Archivos Generados"** con sus rutas relativas y contenido. Cada archivo puede expandirse para ver su código directamente en la interfaz.
    *   Un botón **"Descargar Proyecto (ZIP)"** permite obtener un archivo JSON que contiene la estructura y el contenido de todos los archivos generados, empaquetado con extensión `.zip`. (Nota: El archivo ZIP contiene un único JSON, no una estructura de directorios y archivos individuales, debido a las limitaciones del navegador para generar ZIPs complejos).
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página.

*   **Refactorizar Proyecto**: Permite analizar un proyecto existente para obtener sugerencias de refactorización generadas por la IA y aplicarlas.
    *   Selector **"Usar Configuración LLM De"**:
        *   **Ajustes Globales**: Utiliza la configuración general de la aplicación.
        *   **Agente**: Permite seleccionar un agente específico. Se recomienda uno especializado en refactorización, como `RefactorizadorCodigoExperto`.
        *   **Grupo**: Permite seleccionar un grupo de trabajo que incluya agentes relevantes.
    *   **Fuente del Proyecto**:
        *   **Subir Archivo**: Admite archivos `.zip`, `.json`, o archivos de texto individuales.
        *   **URL de Git**: Permite introducir la URL HTTPS de un repositorio Git público.
    *   **Parámetros de Refactorización**:
        *   **Metas (opcional)**.
        *   **Prioridad General (opcional)**: Selector (ej. "Priorizar Seguridad", "Priorizar Legibilidad").
        *   **Profundidad de Búsqueda (opcional)**: Campo numérico.
        *   **Campo de Enfoque del Análisis (opcional)**: Campo de texto.
    *   Botón **"Analizar para Refactorizar"**.
    *   **Resultados y Sugerencias**: Lista de sugerencias con Área, Descripción, Prioridad, y Snippet Sugerido (opcional). Comienza con un resumen del proyecto.
    *   **Acciones por Sugerencia**: "Marcar como Aplicada" (actualiza estado en UI), "Ver Diff", "Descartar".
    *   **Acción Masiva**: "Marcar Todas como Aplicadas".
    *   **Logs de Ejecución**: Si se usó un grupo.

*   **Análisis de Código Inteligente**: Permite obtener análisis detallados y sugerencias para fragmentos de código.
    *   Selector **"Usar Configuración LLM De"**.
    *   **Fuente del Código**: Subir archivo, URL de archivo Git, o pegar código. Campo para "Instrucciones Adicionales".
    *   Botón **"Analizar Código"**.
    *   **Resultados**: Explicación (objetivos del código original), Código Original, Código Sugerido.
    *   Botones **"Guardar Original"** y **"Guardar Sugerido"** para la sección "Versiones Guardadas".

*   **Análisis de Proyecto Completo**: Para un análisis holístico de proyectos.
    *   Selector **"Usar Configuración LLM De"**.
    *   **Fuente del Proyecto**: Subir ZIP/JSON o URL de Git.
    *   **Parámetros de Análisis**: "Profundidad de Búsqueda", "Campo de Enfoque".
    *   Botón **"Analizar Proyecto"**.
    *   **Resultados**: Título del análisis, Evaluación General (comenzando con objetivos y funcionalidades del proyecto), Ideas Generales de Mejora, Áreas Identificadas, Sugerencias Específicas (con área, descripción, prioridad y prompt sugerido para implementación).
    *   **Log Detallado**: Si se usó un grupo.

*   **AutoUpdate (Análisis del Propio Código)**: Permite que CodeAlchemist analice su propio código fuente.
    *   Selector **"Usar Configuración LLM De"** (defecto: `RefactorizadorCodigoExperto`).
    *   **Fuente del Código**: "Local" (código del servidor donde se ejecuta CodeAlchemist, obtenido vía Server Action) o "URL del Repositorio Git".
    *   **Preferencias de Análisis (Opcional)**: Guía para la IA.
    *   Botón **"Iniciar Auto-Análisis"**.
    *   **Barra de Progreso**: Si el análisis no es por grupo.
    *   **Resultados**: Título del Análisis, Evaluación General (comenzando con objetivos del proyecto), Ideas Generales de Mejora, Sugerencias Detalladas (con área, sugerencia, prioridad, contenido completo sugerido del archivo, y prompt sugerido para implementación por IA).
    *   **Acciones por Sugerencia**:
        *   Botón **"Editar Contenido"**: Permite modificar el contenido sugerido por la IA en un área de texto.
        *   Botón **"Testear Sugerencia"**: Abre un diálogo modal con el código (sugerido o editado) para revisión, aclarando que la prueba real debe hacerse en el entorno de desarrollo.
        *   Botón **"Testear en Ent. Virtual"**: Abre un diálogo similar, explicando que la ejecución real en un entorno virtualizado (venv, nvm) requeriría infraestructura local/backend.
        *   Botón **"Aplicar Sugerencia"**: Abre diálogo de confirmación con vista previa del cambio. Al confirmar, se marca como "aplicada" en la UI. (La modificación real de archivos de CodeAlchemist no es posible desde el navegador).
    *   **Descargar Código**:
        *   **"Descargar Código Actual (ZIP)"**: Inicia una Server Action para obtener el código fuente actual de CodeAlchemist del servidor, aplica conceptualmente las sugerencias marcadas como "applied" en el cliente, y luego usa JSZip en el cliente para empaquetar estos archivos en un ZIP.
        *   **"Descargar Sugerencias (JSON)"**: Descarga un JSON con las rutas y el contenido completo sugerido/editado de los archivos afectados por las sugerencias.
    *   **Subir a Git**: Botón para conceptualizar un `commit` y `push` al repo configurado (requiere implementación real de backend/Server Action con `simple-git`). Muestra un diálogo para mensaje de commit.
    *   **Manejo de Errores y Auto-Fix**: Botones "Copiar Error" y "Auto-Fix" (usa IA para analizar error).
    *   **Logs de Ejecución Detallados**: Panel expandible/contraíble.

*   **Versiones Guardadas (Snapshots)**: Gestiona instantáneas de código o estado de la aplicación.
    *   Muestra lista de snapshots (nombre, fecha, origen).
    *   **Acciones por Versión**: "Ver", "Descargar" (menú con "como [JSON/TXT]" y "como ZIP"), "Eliminar", "Seleccionar para Comparar (A/B)".
    *   **Comparar Versiones**: Diálogo modal con vista lado a lado (no diff real).
    *   **"Guardar Estado Actual de la Aplicación (JSON)"**: Guarda la configuración, agentes y grupos actuales como un snapshot JSON.
    *   **"Guardar Estado y Descargar como ZIP"**: Guarda el estado de la app y lo descarga como un archivo `.zip` (conteniendo el JSON del estado).
    *   Botón **"Eliminar Todas"**.

*   **Chat con IA**: Permite interactuar con un asistente IA.
    *   Selector **"Usar Configuración LLM De"**.
    *   Historial de conversación.
    *   Botón **"Borrar el Chat"**.
    *   Manejo de errores con "Copiar Error" y "Auto-Fix". Las interacciones son reales, llamando a flujos Genkit.

*   **Gestión de Agentes IA**: Para crear, configurar, probar y gestionar agentes.
    *   Lista de agentes con detalles.
    *   Botones **"Crear con IA"** (diálogo para describir rol, IA sugiere definición completa), **"Importar Agentes"** (JSON), **"Exportar Todos los Agentes"** (JSON).
    *   **Formulario "Crear/Editar Agente"**: Nombre, Descripción, Mensaje de Sistema, Capacidades (Acceso Código Propio, Ejecución, Entorno Virtual, Lectura/Escritura), Configuración LLM (Global o Personalizada).
    *   Agentes por defecto `OrquestadorFlujoAgentes` y `RefactorizadorCodigoExperto` con protecciones.
    *   **Acciones por Agente**: "Probar" (chat modal con agente real), "Exportar" (JSON individual), "Editar", "Eliminar".

*   **Gestión de Grupos de Trabajo IA**: Define equipos de agentes IA.
    *   Lista de grupos.
    *   **"Crear con IA"**: Diálogo para describir tarea, IA sugiere definición y agentes.
    *   **Formulario "Crear/Editar Grupo"**: Nombre, Descripción, Tarea Principal, Seleccionar Agentes (Orquestador implícito, requiere al menos uno más).
    *   Grupo por defecto `EquipoDesarrolloSoftware`.
    *   **Acciones por Grupo**: "Ejecutar" (diálogo modal con log de ejecución multi-turno real, coordinado por el Orquestador), "Editar", "Eliminar".

*   **Interfaz de Usuario Intuitiva**:
    *   Tecnologías web modernas, responsiva.
    *   **Barra Lateral** colapsable (control `ChevronsLeft`/`ChevronsRight` arriba a la derecha del header del sidebar).
    *   Menú "hamburguesa" (`Menu`) en móviles para la barra lateral.
    *   Paleta de colores profesional y legible.

*   **Configuración Personalizada**: Ajuste de parámetros globales.
    *   **Configuración del Proveedor LLM**: Proveedor, URL Endpoint (auto-rellenada), Clave API, Nombre del Modelo. Botón "Probar Conexión".
    *   **Configuración de Git (Opcional)**: URL Repositorio, Usuario, Email, PAT. Botón "Probar Conexión".
    *   **Modo Depuración**: Interruptor para panel de logs detallados (expandible, copiar, borrar).
    *   Botones **"Importar" / "Exportar Configuración" / "Guardar Configuración"** en la cabecera de la página.

*   **Manejo de Errores Mejorado**:
    *   Visualización clara. Botón "Copiar Error".
    *   Botón **"Auto-Fix"** en secciones relevantes para análisis de error por IA.
    *   Consideraciones para **Priorización dinámica de errores, Aprendizaje predictivo, Validación robusta, Sincronización con Orquestador**.
    *   Gestión de errores comunes de API LLM (límites de tokens, timeouts) con reintentos y backoff exponencial.

## Guía de Inicio

### Requisitos Previos

*   Un navegador web moderno y actualizado (ej. Chrome, Firefox, Edge, Safari).
*   Node.js (versión recomendada: 18.x o superior) y npm (o yarn).
*   Git instalado.
*   Conexión a internet para clonar el repositorio, instalar dependencias, y acceder a APIs de LLM.
*   (Opcional) Si se usan modelos LLM locales (LM Studio, Ollama), tenerlos instalados, configurados y en ejecución.

### Instalación y Primer Uso

1.  **Clonar el Repositorio**:
    Abre tu terminal y clona el proyecto desde GitHub:
    ```bash
    git clone https://github.com/yseku-dev/studio.git codealchemist
    ```
2.  **Navegar al Directorio del Proyecto**:
    ```bash
    cd codealchemist
    ```
3.  **Instalar Dependencias**:
    Usa npm o yarn para instalar todas las dependencias del proyecto:
    ```bash
    npm install
    # o si prefieres yarn:
    # yarn install
    ```
4.  **Configurar Variables de Entorno**:
    *   Crea un archivo llamado `.env.local` en la raíz del proyecto. Este archivo es para tus variables de entorno locales y no se subirá a Git (está en `.gitignore`).
    *   Añade las claves API necesarias. Por ejemplo, si vas a usar Google Gemini a través de Genkit (que es la configuración por defecto en `src/ai/genkit.ts`), necesitarás una clave API de Google AI Studio o Google Cloud:
        ```env
        GOOGLE_API_KEY=TU_CLAVE_API_DE_GOOGLE_AQUI
        ```
        Si planeas usar otros proveedores LLM, necesitarás sus respectivas claves (ej. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`). Estas claves las ingresarás directamente en la interfaz de CodeAlchemist (sección "Configuración"), donde se guardarán en el `localStorage` de tu navegador. La variable `GOOGLE_API_KEY` en `.env.local` es específicamente para el backend de Genkit si se usa GoogleAI.
5.  **Ejecutar la Aplicación en Modo Desarrollo**:
    *   Inicia el servidor de desarrollo de Next.js (que también iniciará Genkit si está configurado para el modo desarrollo):
        ```bash
        npm run dev
        # o con yarn:
        # yarn dev
        ```
    *   Este comando usualmente también inicia el observador de Genkit (`genkit start -- tsx --watch src/ai/dev.ts`) como parte del script `dev`.
6.  **Acceder a la Aplicación**:
    Abre tu navegador web y ve a `http://localhost:9002` (o el puerto que se indique en la consola si el 9002 está ocupado).

7.  **Configuración Inicial en CodeAlchemist (Muy Recomendado)**:
    *   Una vez que la aplicación cargue, navega a la sección **"Configuración"** (icono de engranaje `Settings` en la barra lateral).
    *   **Configura tu Proveedor LLM Global**:
        *   Selecciona el **Proveedor LLM** que deseas usar (Groq, Google Gemini, OpenAI, etc.).
        *   La **URL del Endpoint de API** se rellenará automáticamente para la mayoría de los proveedores. Ajusta si es necesario (especialmente para LM Studio u Ollama, ej. `http://localhost:1234/v1` o `http://localhost:11434/v1`).
        *   Introduce tu **Clave API** si el proveedor la requiere y no la has configurado vía variables de entorno que el backend pudiera usar. La clave ingresada aquí se guarda localmente en tu navegador.
        *   Elige un **Nombre del Modelo** de la lista disponible para ese proveedor.
        *   Haz clic en **"Probar Conexión (Proveedor LLM)"** para asegurar que la comunicación con la IA es exitosa.
    *   **(Opcional) Configura Git**: Si planeas usar la funcionalidad de "Subir a Git" en "AutoUpdate", completa los detalles de Git (URL del Repositorio, Nombre de Usuario, Email, Token de Acceso Personal) y prueba la conexión con **"Probar Conexión Git"**.
    *   **(Opcional) Activa el Modo Depuración**: Si deseas ver logs detallados de la aplicación en un panel inferior.
    *   Haz clic en **"Guardar Configuración"**.

8.  **Inicialización de Agentes y Grupos por Defecto**:
    *   Al cargar la aplicación por primera vez (o si no existen en el `localStorage`), CodeAlchemist crea automáticamente un conjunto de agentes y un grupo de trabajo por defecto. Estos están definidos en `src/lib/constants.ts`.
    *   **Agentes Creados por Defecto**:
        *   `OrquestadorFlujoAgentes`: Esencial para la gestión de grupos. No eliminable, nombre no editable. Prompt predefinido para gestionar el flujo de trabajo.
        *   `RefactorizadorCodigoExperto`: Especializado en análisis y refactorización. Prompt orientado a Clean Code, SOLID y salida JSON.
        *   `JefeDeProducto`: Define requisitos, historias de usuario.
        *   `ArquitectoSoftware`: Diseña arquitectura, selecciona tecnologías.
        *   `DesarrolladorSoftware`: Escribe código. Capacidades: acceso código propio, ejecución, lectura/escritura.
        *   `IngenieroPruebas`: Escribe y ejecuta pruebas. Capacidad: ejecución.
        *   `IngenieroDevOps`: Gestiona infraestructura, despliegues, CI/CD. Capacidades: ejecución, entorno virtual, lectura/escritura.
        *   `RepresentanteUsuario`: Proporciona feedback de usuario.
        *   `ValidadorCodigo`: Analiza resultados de refactorización. Capacidades: acceso código propio, ejecución.
    *   **Grupo de Trabajo Creado por Defecto**:
        *   `EquipoDesarrolloSoftware`: Incluye Orquestador y los agentes JefeDeProducto, ArquitectoSoftware, DesarrolladorSoftware, RefactorizadorCodigoExperto, ValidadorCodigo, IngenieroPruebas, IngenieroDevOps, y RepresentanteUsuario. Tarea principal predefinida para simular un equipo de producción de software completo y mejorar el sistema "Auto-Fix".
    *   Estos elementos por defecto sirven como punto de partida y pueden ser editados (con las excepciones mencionadas). Son gestionables a través de las secciones "Agentes IA" y "Grupos de Trabajo IA".

## Tutorial de Uso Detallado

### 1. Navegación y Barra Lateral

*   La interfaz principal cuenta con una **Barra Lateral** a la izquierda para acceder a todas las secciones.
    *   **Panel de Control**: (Icono: `LayoutDashboard`) Página de bienvenida y punto de partida.
        *   Muestra el logo `FlaskConical` y el título "Bienvenido a CodeAlchemist".
        *   Descripción concisa de la aplicación.
        *   Sección **"Características Principales"**: Cuadrícula de tarjetas interactivas (icono, título, descripción) que enlazan a cada funcionalidad, con efectos hover.
        *   Sección **"Guía Rápida de Inicio"**: Lista numerada de pasos recomendados para nuevos usuarios, con enlaces.
    *   **Generar Código**: (Icono: `CodeXml`)
    *   **Generar Proyecto**: (Icono: `FolderPlus`)
    *   **Refactorizar Proyecto**: (Icono: `GitPullRequestDraft`)
    *   **Analizar Código**: (Icono: `ScanLine`)
    *   **Analizar Proyecto**: (Icono: `FolderSearch`)
    *   **AutoUpdate**: (Icono: `Sparkles`)
    *   **Versiones Guardadas**: (Icono: `GitCompareArrows`)
    *   **Chat con IA**: (Icono: `MessageCircle`)
    *   **Agentes IA**: (Icono: `Users2`)
    *   **Grupos de Trabajo IA**: (Icono: `Workflow`)
    *   **Configuración**: (Icono: `SettingsIcon`)
*   La barra lateral se oculta/muestra con el botón `ChevronsLeft`/`ChevronsRight` (arriba a la derecha del header del sidebar en escritorio).
*   En móviles, un icono `Menu` (hamburguesa) en la cabecera superior izquierda controla el panel deslizable de la barra lateral.

### 2. Configuración (Sección "Configuración")

Accede mediante `SettingsIcon`.
*   **Configuración del Proveedor LLM**:
    *   Selector `Proveedor LLM`.
    *   Campo `URL del Endpoint de API` (auto-rellenada, editable).
    *   Campo `Clave API` (tipo contraseña).
    *   Selector `Nombre del Modelo` (dinámico según proveedor).
    *   Botón `Probar Conexión (Proveedor LLM)`.
*   **Configuración de Git**:
    *   Campos `URL del Repositorio Git`, `Nombre de Usuario Git`, `Email de Git`, `Token de Acceso Personal (PAT)`.
    *   Botón `Probar Conexión Git`.
*   **Modo Depuración**:
    *   Interruptor `Activar modo Debug`. Muestra panel de logs inferior (expandible, con botones `Copy`, `Trash2`, `ChevronUp`/`ChevronDown`).
*   Botones **"Importar" / "Exportar Configuración" / "Guardar Configuración"** en la cabecera de la página.

*(El tutorial detallado para cada sección principal (Generar Código, Generar Proyecto, etc.) sigue la descripción de "Características Principales" ya proporcionada, detallando cada campo y botón como se describe en ese apartado del PRD. Omitido aquí por brevedad pero se asume cubierto por dicha sección.)*

## Flujo de Trabajo con IA

### Selección de Fuente de Configuración LLM

En la mayoría de las secciones que utilizan IA, el selector **"Usar Configuración LLM De:"** permite elegir:
1.  **Ajustes Globales**: Usa la configuración de la sección "Configuración".
2.  **Agente: [Nombre del Agente]**: Usa la configuración y el Mensaje de Sistema del agente seleccionado.
3.  **Grupo: [Nombre del Grupo]**: La tarea se pasa al `OrquestadorFlujoAgentes` del grupo. El contexto del grupo (su tarea principal o el prompt del orquestador) guía la IA.

### Agentes y Grupos de Trabajo

*   **Agentes**: Entidades IA individuales con Mensaje de Sistema, Capacidades y Configuración LLM. Son especialistas.
*   **Grupos de Trabajo**: Equipos de agentes para tareas complejas.
    *   `OrquestadorFlujoAgentes`: Componente central obligatorio. Recibe tarea, gestiona flujo, evalúa respuestas, decide siguiente agente, asegura coordinación. La comunicación entre agentes pasa por él.

## Manejo de Errores

*   **Visualización Clara**: Errores de API LLM, Git, internos, etc., se muestran cerca de donde ocurren o como toasts.
*   **Copia de Errores**: Botón `Copiar Error` junto a la mayoría de mensajes.
*   **Auto-Fix**: En secciones como "AutoUpdate" y "Chat con IA". Botón `Auto-Fix` envía error y contexto a IA configurada, que propone soluciones en diálogo modal.
    *   **Refuerzo del Sistema Auto-Fix**: Se consideran estrategias de Priorización dinámica, Aprendizaje predictivo, Validación robusta y Sincronización con Orquestador.
*   **Errores de API LLM**:
    *   Gestión de errores `429 Too Many Requests` (límites de tasa) con reintentos y backoff exponencial.
    *   Fragmentación de datos grandes en "AutoUpdate".
    *   Timeouts configurados para llamadas a APIs LLM.

## Cuestiones Técnicas

*   **Stack Principal**:
    *   **Next.js (con App Router)**: Framework React para la estructura de la aplicación y enrutamiento.
    *   **React**: Biblioteca para la construcción de la interfaz de usuario.
    *   **TypeScript**: Para tipado estático y mejora de la calidad del código.
    *   **ShadCN UI**: Colección de componentes de UI reutilizables, construidos sobre Radix UI y Tailwind CSS.
    *   **Tailwind CSS**: Framework CSS de utilidad para estilizado rápido y consistente.
    *   **Genkit (de Google)**: Framework para construir flujos de IA que interactúan con modelos de lenguaje grandes (LLMs). Se usa para todas las interacciones con IA.
    *   **Lucide Icons**: Biblioteca de iconos SVG.
*   **Gestión de Estado**:
    *   Principalmente React Context (`AppStateContext` para estado global de la aplicación como configuraciones, agentes, grupos; `DebugContext` para logs de depuración).
    *   `useLocalStorage` hook para persistir el estado en el almacenamiento local del navegador.
*   **Interacciones Backend/Servidor**:
    *   Las funciones definidas en archivos con la directiva `"use server";` (Server Actions de Next.js) se utilizan para operaciones que requieren acceso al entorno del servidor, como `getApplicationSourceBundle` en `src/app/autoupdate/actions.ts` que lee el sistema de archivos.
    *   Los flujos de Genkit (en `src/ai/flows/`) también se ejecutan en el entorno del servidor.
*   **Persistencia de Datos del Usuario**:
    *   Configuraciones, agentes creados por el usuario, grupos y snapshots se guardan en el `localStorage` del navegador. Esto significa que son específicos del navegador y la máquina del usuario.
*   **Manejo de Errores Centralizado**:
    *   `src/utils/apiClient.ts` envuelve las llamadas a los flujos Genkit, implementando reintentos y parseando errores en un `AppError` personalizado.
    *   `src/app/error.tsx` actúa como Error Boundary global de Next.js.
    *   Listeners globales en `AppLayout.tsx` para errores de JavaScript no capturados.
*   **Limitaciones del Frontend**:
    *   **Modificación Directa de Archivos**: CodeAlchemist no puede modificar directamente los archivos de su propio código fuente en el servidor ni los archivos de proyectos subidos/clonados desde el navegador debido a restricciones de seguridad. Las funciones de "aplicar sugerencia" marcan cambios en la UI, y el usuario debe aplicar los cambios manualmente en su entorno de desarrollo.
    *   **Generación de ZIPs Complejos**: La generación de archivos ZIP con estructuras de directorios complejas directamente en el cliente es limitada. Las descargas ZIP de "proyectos" suelen ser un archivo JSON con la estructura del proyecto. La descarga ZIP del "código actual" en AutoUpdate utiliza `JSZip` en el cliente sobre datos obtenidos de una Server Action, lo cual es una aproximación.
    *   **Operaciones Git Directas**: Funciones como "Subir a Git" en AutoUpdate requerirían una Server Action robusta con `simple-git` y manejo seguro de credenciales; la UI actual prepara para esta interacción.

## Diseño (Aspectos Visuales)

CodeAlchemist utiliza una interfaz de usuario moderna y profesional, diseñada para ser intuitiva y funcional.

*   **Paleta de Colores Principal** (definida en `src/app/globals.css` usando variables HSL CSS):
    *   **Fondo (Background)**: Gris claro (`hsl(210 17% 94%)` - `#ECEFF1`). Proporciona un lienzo limpio y minimiza la fatiga visual.
    *   **Texto Principal (Foreground)**: Gris muy oscuro (`hsl(233 30% 15%)`). Alto contraste para legibilidad.
    *   **Color Primario (Primary)**: Azul oscuro intenso (`hsl(233 63% 30%)` - `#1A237E`). Usado para acciones principales, botones destacados, marca.
    *   **Texto sobre Primario (Primary Foreground)**: Gris claro (`hsl(210 17% 85%)`). Buen contraste sobre el azul primario.
    *   **Color Secundario (Secondary)**: Gris ligeramente más oscuro que el fondo (`hsl(210 17% 88%)`). Usado para bordes sutiles, fondos de inputs.
    *   **Texto sobre Secundario (Secondary Foreground)**: Gris oscuro (`hsl(233 30% 20%)`).
    *   **Color de Acento (Accent)**: Verde azulado/Teal (`hsl(174 60% 40%)` - `#26A69A`). Usado para énfasis, enlaces, iconos informativos.
    *   **Texto sobre Acento (Accent Foreground)**: Gris oscuro (`hsl(210 17% 15%)`).
    *   **Color Destructivo (Destructive)**: Rojo vibrante (`hsl(0 84.2% 60.2%)`). Para acciones de eliminación, errores críticos.
    *   **Texto sobre Destructivo (Destructive Foreground)**: Gris muy oscuro (`hsl(0 0% 10%)`).
    *   **Fondo de Tarjetas/Popovers (Card/Popover Background)**: Blanco (`hsl(0 0% 100%)` - `#FFFFFF`).
    *   **Texto sobre Tarjetas/Popovers (Card/Popover Foreground)**: Gris muy oscuro (`hsl(233 30% 15%)`).
    *   **Colores Muted**: Fondos (`hsl(210 17% 90%)`), Texto (`hsl(233 20% 40%)`).
    *   **Bordes Generales (Border)**: Gris claro (`hsl(210 17% 85%)`).
    *   **Fondo de Inputs (Input Background)**: Gris claro (`hsl(210 17% 85%)`).
    *   **Anillo de Enfoque (Ring/Focus Ring)**: Color de acento Teal (`hsl(174 60% 40%)`).
    *   **Colores de Sidebar**: Variables específicas (`--sidebar-background`, etc.) definidas en `globals.css` para temas claro y oscuro, manteniendo coherencia.
*   **Iconografía**:
    *   Se utiliza **Lucide Icons** consistentemente para representar secciones, acciones y conceptos.
    *   El icono principal/logo de la aplicación es `FlaskConical` (matraz de alquimista estilizado), simbolizando la transformación y experimentación.
*   **Tipografía**:
    *   **Fuente Principal (Sans-serif)**: **Geist Sans**. Moderna y legible para toda la interfaz.
    *   **Fuente Monoespaciada**: **Geist Mono**. Para visualización de código, logs, snippets.
*   **Diseño General y Estructura de Páginas**:
    *   Diseño moderno, responsivo, con jerarquía visual clara.
    *   Uso de componentes ShadCN UI: `Card` como contenedor principal en la mayoría de las páginas, `Textarea` amplias, `ScrollArea` para contenido extenso.
    *   Esquinas redondeadas (`rounded-md`, `rounded-lg`) y sombras sutiles (`shadow-sm`, `shadow-lg`) para elementos de UI, aportando modernidad y profundidad.
    *   Barra lateral izquierda colapsable; panel de depuración (si activo) fijo en la parte inferior.

## Notas Importantes y Consideraciones

*   **Sugerencias de IA**: Son recomendaciones. Revisa y prueba exhaustivamente cualquier código o cambio antes de aplicarlo en producción.
*   **Límites de API y Timeouts**: El uso intensivo puede alcanzar límites de proveedores LLM. La aplicación intenta gestionar esto, pero pueden ocurrir interrupciones.
*   **Seguridad**:
    *   "Aplicar Sugerencia" en AutoUpdate: la modificación real de archivos no ocurre desde el navegador. Procede con precaución si implementas una solución backend.
    *   Capacidades de agente peligrosas (Ejecución, Lectura/Escritura): Habilítalas solo si comprendes los riesgos.
    *   Claves API (si se ingresan en la UI): Se guardan en `localStorage`. Considera implicaciones de seguridad.
*   **Costes de API**: Proveedores LLM en la nube pueden incurrir en costes. Modelos locales (LM Studio, Ollama) requieren recursos computacionales propios.
*   **Privacidad**: Al usar LLMs en la nube, datos como código y prompts se envían a esos proveedores. Revisa sus políticas de privacidad. Considera modelos locales para máxima privacidad.
