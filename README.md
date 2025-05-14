
# CodeAlchemist

CodeAlchemist es una plataforma de desarrollo asistido por inteligencia artificial (IA) diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software. Ofrece herramientas para la generación y análisis de código, refactorización asistida, gestión de versiones, ejecución de grupos de trabajo IA y análisis de proyectos completos, todo ello potenciado por diversos modelos de IA.

**Idioma del Proyecto:** Todo el proyecto, incluyendo la interfaz de usuario, los mensajes, los comentarios en el código (donde aplique semánticamente) y la documentación (como este README), está desarrollado y presentado en **castellano**.

**Operatividad:** Todas las funcionalidades descritas en este documento son completamente operativas y no incluyen procedimientos simulados o experimentales. Las acciones que implican modificación de código o interacción con sistemas externos se ejecutan de forma real según la configuración y permisos otorgados.

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
    *   Un botón **"Descargar Proyecto (ZIP)"** permite obtener todos los archivos generados empaquetados en un archivo ZIP.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página.

*   **Refactorizar Proyecto**: Permite analizar un proyecto existente para obtener sugerencias de refactorización generadas por la IA y aplicarlas.
    *   Selector **"Usar Configuración LLM De"**:
        *   **Ajustes Globales**: Utiliza la configuración general de la aplicación.
        *   **Agente**: Permite seleccionar un agente específico. Se recomienda uno especializado en refactorización, como `RefactorizadorCodigoExperto` (que se crea por defecto).
        *   **Grupo**: Permite seleccionar un grupo de trabajo que incluya agentes relevantes (como `RefactorizadorCodigoExperto` y el `OrquestadorFlujoAgentes`). Esto permite un análisis más colaborativo y profundo.
    *   **Fuente del Proyecto**:
        *   **Subir Archivo**: Admite archivos `.zip` (código fuente completo del proyecto), `.json` (una representación estructurada del proyecto, si se tiene), o archivos de texto individuales (ej. `.py`, `.js`, `.java`). Se valida el tipo y tamaño del archivo. La aplicación trabajará sobre una representación interna del proyecto subido.
        *   **URL de Git**: Permite introducir la URL HTTPS de un repositorio Git público. La IA (o un agente con capacidad de acceso a Git) obtendrá el contenido del repositorio para su análisis y posible refactorización en una copia local temporal.
    *   **Parámetros de Refactorización**:
        *   **Metas (opcional)**: Campo de texto para describir objetivos específicos de la refactorización (ej. "Mejorar rendimiento de la UI", "Simplificar la lógica de negocio en el módulo X", "Asegurar cumplimiento de estándares de codificación Y").
        *   **Prioridad General (opcional)**: Selector para un enfoque general de la refactorización (ej. "Priorizar Seguridad", "Priorizar Legibilidad", "Priorizar Rendimiento", "Estandarizar Código", "Reducir Complejidad").
    *   Botón **"Analizar para Refactorizar"**.
    *   **Resultados y Sugerencias**: Se muestra una lista de sugerencias, cada una con:
        *   **Área**: Archivo o componente específico afectado por la sugerencia.
        *   **Descripción**: Explicación detallada de la mejora propuesta y por qué es beneficiosa.
        *   **Prioridad**: Clasificación de la sugerencia (Alta, Media o Baja).
        *   **Snippet Sugerido (opcional)**: Si la sugerencia implica un cambio de código concreto y pequeño, se muestra un fragmento del código original y el modificado para ilustrar el cambio.
    *   **Acciones por Sugerencia**:
        *   **Aplicar**: Aplica la sugerencia de refactorización. Si el proyecto fue subido, los cambios se aplican a la representación interna. Si se obtuvo de Git, se prepara un conjunto de cambios que el usuario podrá luego revisar y/o descargar.
        *   **Ver Diff**: Muestra una comparación visual entre el fragmento original y el sugerido.
        *   **Descartar**: Omite la sugerencia y la marca como descartada en la interfaz.
    *   **Acción Masiva**: Botón **"Aplicar Todas las Sugerencias"** para aplicar todas las sugerencias pendientes.
    *   **Logs de Ejecución**: Si se utilizó un grupo de trabajo para el análisis, se muestra un log detallado de las interacciones entre agentes y las decisiones del orquestador.

*   **Análisis de Código Inteligente**: Permite obtener análisis detallados y sugerencias de mejora para fragmentos de código individuales o archivos.
    *   Selector **"Usar Configuración LLM De"** (Global, Agente, Grupo).
    *   **Fuente del Código**:
        *   **Subir un archivo de código (opcional)**: Botón para cargar un archivo de código fuente individual.
        *   **URL de Archivo Git (opcional)**: Campo para pegar la URL directa a un archivo "raw" en un repositorio Git (ej: un enlace de GitHub que muestre el contenido crudo del archivo). La aplicación intentará obtener el contenido de esta URL.
        *   Área de texto principal para pegar el código directamente.
    *   Botón **"Analizar Código"**.
    *   **Resultados**:
        *   **Explicación**: Una descripción en lenguaje natural del código original, generada por la IA.
        *   **Código Original**: Muestra el código que se analizó.
        *   **Código Sugerido**: Muestra la versión del código con las mejoras propuestas por la IA.
    *   Botones **"Guardar Original"** y **"Guardar Sugerido"** para crear snapshots del código original y del sugerido, respectivamente, en la sección "Versiones Guardadas".

*   **Análisis de Proyecto Completo**: Permite un análisis holístico de proyectos enteros, similar a "Refactorizar Proyecto" pero con un enfoque más amplio en la evaluación general.
    *   Selector **"Usar Configuración LLM De"** (Global, Agente, Grupo).
    *   **Fuente del Proyecto**:
        *   **Subir Archivo (ZIP/JSON)**: Botón para seleccionar un archivo `.zip` (proyecto completo) o `.json` (representación del proyecto).
        *   **URL de Git**: Campo para introducir la URL HTTPS de un repositorio Git público. La IA o un agente con capacidades Git intentará obtener el contenido.
    *   Botón **"Analizar Proyecto"**.
    *   Los **Resultados** se presentan con un resumen general del proyecto, áreas destacadas (puntos fuertes, débiles, áreas de mejora potencial) y, si aplica, sugerencias específicas (aunque menos detalladas que en "Refactorizar Proyecto").
    *   Se muestra un **Log Detallado** del proceso de análisis, especialmente si se usó un grupo de trabajo.

*   **AutoUpdate (Análisis del Propio Código)**: Permite que CodeAlchemist analice su propio código fuente para identificar áreas de mejora, bugs potenciales o aplicar refactorizaciones.
    *   Selector **"Usar Configuración LLM De"**. Por defecto, se recomienda usar el agente `RefactorizadorCodigoExperto` (creado automáticamente) o un grupo de trabajo configurado para esta tarea (que incluya al `RefactorizadorCodigoExperto` y al `OrquestadorFlujoAgentes`).
    *   **Fuente del Código para Auto-Análisis**:
        *   **Local** (opción por defecto): Analiza el código fuente actual de la aplicación CodeAlchemist que se está ejecutando.
        *   **URL del Repositorio Git (Opcional)**: Campo para introducir la URL de un repositorio Git de CodeAlchemist (puede ser el principal o un fork) para analizar esa versión específica. La aplicación intentará obtener el contenido del repositorio.
    *   **Preferencias de Análisis (Opcional)**: Campo de texto para guiar a la IA con objetivos específicos para el auto-análisis (ej. "Enfocarse en la optimización de las funciones de manejo de estado", "Revisar la seguridad de las interacciones con APIs externas", "Mejorar la modularidad de los componentes de UI"). Todas las sugerencias deben estar en castellano.
    *   Botón **"Iniciar Auto-Análisis"**.
    *   Muestra una **Barra de Progreso** durante el análisis, indicando el número de fragmentos de código procesados y el total, especialmente si el análisis no es gestionado por un grupo de trabajo (que tendría su propio log de turnos).
    *   **Resultados**:
        *   **Título del Análisis**: Un resumen conciso de los hallazgos.
        *   **Áreas Identificadas**: Componentes, módulos o archivos específicos que la IA ha destacado.
        *   **Sugerencias Detalladas**: Lista de sugerencias, cada una con:
            *   Área afectada.
            *   Descripción de la sugerencia.
            *   Prioridad.
            *   Si la sugerencia implica un cambio de código directo en un archivo, se proporciona el **Contenido Completo del Archivo Sugerido**.
        *   **Evaluación General**: Un resumen del estado general del código analizado.
    *   **Aplicar Sugerencias**: Para cada sugerencia que implique un cambio de código en un archivo:
        *   Botón **"Aplicar Sugerencia"**. Abre un diálogo de confirmación que muestra una vista previa del cambio (simulando un "diff" entre el contenido actual y el sugerido). Al confirmar, el archivo físico en el sistema de CodeAlchemist **SERÁ MODIFICADO**. Esta es una operación real y directa sobre el código fuente. (Nota: La modificación directa de archivos del sistema desde una aplicación web en el navegador tiene limitaciones de seguridad significativas; esta funcionalidad puede ser simulada en la UI o requerir una arquitectura con un backend o agente local con los permisos necesarios).
    *   **Descargar Código Fuente Completo**:
        *   Botón **"Descargar Código (ZIP)"**: Descarga un archivo ZIP que contiene el estado actual completo del código fuente de CodeAlchemist (todos los archivos necesarios para ejecutar la aplicación localmente). (Nota: La generación de ZIPs en el cliente puede ser compleja para estructuras de directorios grandes; puede ser una simulación o requerir un backend).
        *   Botón **"Descargar Código (JSON)"**: Descarga una representación JSON del código fuente, donde cada entrada es un objeto con la ruta del archivo y su contenido.
    *   **Subir a Git**: Botón para realizar `commit` y `push` del estado actual del código fuente de CodeAlchemist al repositorio Git configurado en la sección "Configuración". Solicita un mensaje de commit antes de proceder. Esta operación es real si la configuración Git es válida. (Nota: Las operaciones Git directas desde el navegador son complejas y generalmente requieren un backend o un entorno con herramientas Git instaladas y accesibles).
    *   **Manejo de Errores y Auto-Fix**:
        *   Los errores que ocurran durante el análisis, aplicación de sugerencias o subida a Git se muestran claramente.
        *   Botón **"Copiar Error"** disponible para la mayoría de los mensajes de error.
        *   Botón **"Auto-Fix"**: Utiliza la IA configurada (la misma que para el análisis o una específica para "Auto-Fix") para analizar el mensaje de error y el contexto, proponiendo soluciones en un diálogo modal. El sistema también considera:
            *   **Priorización dinámica de errores**: Análisis de criticidad para enfocar los esfuerzos de auto-corrección.
            *   **Aprendizaje predictivo**: Identificación de patrones de error para sugerencias proactivas.
            *   **Validación robusta**: Pruebas automatizadas antes de aplicar correcciones auto-generadas.
            *   **Sincronización con Orquestador**: Comunicación para asegurar coherencia en correcciones complejas.
    *   **Logs de Ejecución Detallados**: Una ventana en la parte inferior de la sección muestra logs detallados con botones para **Copiar Logs**, **Borrar Logs** y **Expandir/Contraer** la ventana de logs.

*   **Versiones Guardadas (Snapshots)**: Gestiona instantáneas (snapshots) de código generadas desde "Analizar Código" o del estado completo de la aplicación.
    *   Muestra una lista de versiones guardadas, cada una con su nombre descriptivo y fecha de creación.
    *   **Acciones por Versión**:
        *   **Ver**: Abre un diálogo modal mostrando el contenido completo del código guardado en esa versión.
        *   **Descargar**: Descarga el código de la versión como un archivo de texto.
        *   **Eliminar**: Borra la versión seleccionada del almacenamiento local (con confirmación previa).
        *   **Seleccionar para Comparar (A/B)**: Dos botones ("A" y "B") permiten marcar hasta dos versiones para una comparación lado a lado.
    *   **Comparar Versiones**: Si se seleccionan dos versiones (A y B), se habilita un botón "Comparar A y B". Al pulsarlo, se abre un diálogo modal que muestra las diferencias entre el código de la versión A y la versión B (simulando un "diff").
    *   Botón **"Guardar Código Actual de CodeAlchemist"**: Toma un snapshot del código fuente completo y actual de la aplicación CodeAlchemist y lo guarda en esta sección.
    *   Botón **"Eliminar Todas"**: Borra todas las versiones guardadas del almacenamiento local (con confirmación previa).

*   **Chat con IA**: Permite interactuar con un asistente IA para consultas generales, ayuda con código, generación de ideas, etc.
    *   Selector **"Usar Configuración LLM De"** (Global, Agente, Grupo).
    *   Área de texto para escribir el mensaje. Se envía pulsando Enter (sin Shift) o con el botón de enviar.
    *   El historial de la conversación se muestra en la ventana principal, con mensajes del usuario y de la IA.
    *   Botón **"Borrar el Chat"** para limpiar el historial de la conversación actual.
    *   Manejo de errores con opciones para copiar el mensaje de error o intentar un **"Auto-Fix"** donde la IA analiza el error y propone soluciones.

*   **Gestión de Agentes IA**: Permite crear, configurar, probar y gestionar agentes IA individuales. Estos agentes son entidades especializadas que pueden ser usadas directamente o como parte de Grupos de Trabajo.
    *   Muestra una lista de agentes creados, con su nombre, descripción, configuración LLM y capacidades.
    *   Botones **"Importar Agentes"** (desde un archivo JSON) y **"Exportar Todos los Agentes"** (a un archivo JSON).
    *   **Formulario "Crear/Editar Agente"**:
        *   **Nombre**: Nombre único y descriptivo para el agente (ej. `AnalistaDeRequisitos`, `GeneradorDeTestsUnitarios`).
        *   **Descripción**: Breve explicación del propósito y especialización del agente.
        *   **Mensaje de Sistema (Prompt)**: El prompt base que define el rol, comportamiento, tono, y las instrucciones fundamentales del agente. Es la directriz principal para la IA.
        *   **Capacidades del Agente**: Interruptores para habilitar permisos específicos:
            *   **Acceso a Código Propio**: Permite al agente leer el código fuente de la aplicación CodeAlchemist.
            *   **Capacidad de Ejecución**: Permite al agente ejecutar comandos o scripts (marcado como "Peligroso" por implicaciones de seguridad).
            *   **Capacidad de Entorno Virtual**: Permite al agente interactuar con o gestionar entornos virtuales (ej. para instalar dependencias o ejecutar código aislado).
            *   **Capacidad Lectura/Escritura**: Permite al agente leer y escribir archivos en el sistema de CodeAlchemist (marcado como "Peligroso").
        *   **Configuración LLM del Agente**:
            *   Selector: **"Usar Configuración Global"** (usa los ajustes definidos en la sección "Configuración" de la aplicación) o **"Configuración Personalizada"**.
            *   Si se elige "Personalizada": Permite seleccionar un **Proveedor LLM** específico, un **Modelo** de ese proveedor, y opcionalmente sobrescribir la **Clave API** y la **URL de API** (útil para modelos locales o proxies).
    *   Se destaca la importancia del agente `OrquestadorFlujoAgentes` y su configuración sugerida (ver más abajo).
    *   **Acciones por Agente (en la lista)**:
        *   **Probar**: Abre una ventana de chat modal para interactuar directamente con el agente seleccionado, usando su mensaje de sistema y configuración LLM.
        *   **Exportar**: Descarga la configuración del agente seleccionado en formato JSON.
        *   **Editar**: Abre el formulario "Crear/Editar Agente" pre-rellenado con los datos del agente para su modificación. El nombre del agente `OrquestadorFlujoAgentes` no es editable para preservar su rol.
        *   **Eliminar**: Borra el agente del sistema (con confirmación previa). El agente `OrquestadorFlujoAgentes` no se puede eliminar.

*   **Gestión de Grupos de Trabajo IA**: Define equipos de agentes IA que pueden colaborar en tareas complejas, coordinados por un `OrquestadorFlujoAgentes`.
    *   Muestra una lista de grupos de trabajo creados.
    *   **Formulario "Crear/Editar Grupo"**:
        *   **Nombre**: Nombre único para el grupo de trabajo.
        *   **Descripción**: Breve explicación del propósito del grupo.
        *   **Tarea Principal del Grupo**: Un prompt detallado que describe el objetivo general que el grupo de trabajo debe alcanzar. Este es el input inicial para el `OrquestadorFlujoAgentes`.
        *   **Seleccionar Agentes Participantes**: Una lista de checkboxes para elegir los agentes que formarán parte del grupo. El agente `OrquestadorFlujoAgentes` es implícitamente añadido a cada grupo y no necesita ser seleccionado aquí (o si se muestra, está marcado como obligatorio/no deseleccionable). Se requiere al menos un agente adicional al Orquestador para que el grupo sea funcional.
    *   **Acciones por Grupo (en la lista)**:
        *   **Ejecutar**: Abre una ventana modal para la **"Ejecución del Grupo de Trabajo"**. Esta ventana muestra:
            *   La Tarea Principal del grupo.
            *   Un **Log de Ejecución Detallado** en tiempo real, que muestra:
                *   Número de turno.
                *   Decisiones del `OrquestadorFlujoAgentes` (a qué agente pasa el control y por qué).
                *   Respuestas o contribuciones de cada agente participante.
                *   Mensajes de sistema o errores que puedan ocurrir.
            *   Permite **Copiar los Logs** o **Detener la Ejecución** del grupo de trabajo.
        *   **Editar**: Abre el formulario "Crear/Editar Grupo" para modificar la configuración del grupo.
        *   **Eliminar**: Borra el grupo de trabajo del sistema (con confirmación previa).

*   **Interfaz de Usuario Intuitiva**:
    *   Construida con tecnologías web modernas para una experiencia fluida y responsiva.
    *   La **Barra Lateral** (ubicada a la izquierda) es colapsable para maximizar el espacio de trabajo. Contiene un botón en su parte inferior con los iconos `ChevronsLeft` (Ocultar) o `ChevronsRight` (Mostrar) para controlar su estado.
    *   En dispositivos móviles, un menú tipo "hamburguesa" (`Menu`) en la esquina superior izquierda controla la visibilidad de la barra lateral, que se despliega como un panel.
    *   Utiliza una paleta de colores diseñada para ser clara, legible y profesional, con buen contraste y jerarquía visual.

*   **Configuración Personalizada**: Permite al usuario ajustar diversos parámetros de la aplicación.
    *   **Configuración del Proveedor LLM**:
        *   **Proveedor LLM**: Selector para el servicio de IA a utilizar globalmente (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
        *   **URL del Endpoint de API**: Campo para la URL base de la API. Es especialmente relevante para modelos locales (LM Studio, Ollama) o si se usa un proxy. Para proveedores en la nube, suele rellenarse automáticamente pero puede sobrescribirse.
        *   **Clave API**: Campo de texto (tipo contraseña) para introducir la clave API del proveedor seleccionado (si la requiere). Esta clave se guarda de forma segura en el almacenamiento local del navegador del usuario.
        *   **Nombre del Modelo**: Un selector que se actualiza dinámicamente según el Proveedor LLM seleccionado. Lista los modelos disponibles para ese proveedor, usualmente ordenados por capacidad o popularidad.
        *   Botón **"Probar Conexión (Proveedor LLM)"**: Verifica la comunicación con el servicio de IA usando la configuración actual, mostrando un mensaje de éxito o error.
    *   **Configuración de Git (Opcional)**: Para funcionalidades como "Subir a Git" en "AutoUpdate".
        *   **URL del Repositorio Git**: Campo para la URL HTTPS del repositorio remoto de CodeAlchemist o donde se deseen subir los cambios.
        *   **Nombre de Usuario Git**: Nombre de usuario para los commits.
        *   **Email de Git**: Email para los commits.
        *   **Token de Acceso Personal (PAT)**: Token de Git para autenticación (tipo contraseña).
        *   Botón **"Probar Conexión Git"**: Verifica la autenticación con el repositorio remoto usando las credenciales proporcionadas.
    *   **Modo Depuración**:
        *   Interruptor (checkbox o switch) para **"Activar modo Debug"**. Al activarlo, aparece un panel de logs detallados fijo en la parte inferior de la pantalla de la aplicación. Este panel es expandible/contraíble mediante botones (`ChevronUp`/`ChevronDown`) y tiene opciones para **Copiar Logs** (`Copy`) y **Borrar Logs** (`Trash2`).
    *   Botón **"Guardar Configuración"**: Guarda todos estos ajustes en el almacenamiento local del navegador para persistencia entre sesiones.

*   **Manejo de Errores Mejorado**:
    *   Los errores (de llamadas a IA, operaciones Git, errores internos de la aplicación, etc.) se muestran de forma clara al usuario, usualmente cerca de donde ocurrió el problema.
    *   Botón **"Copiar Error"** disponible junto a la mayoría de los mensajes de error para facilitar el reporte o la depuración.
    *   Botón **"Auto-Fix"**: Presente en secciones como "AutoUpdate" (para errores de análisis o subida a Git) y "Chat con IA". Al pulsarlo, la IA configurada analiza el mensaje de error y el contexto actual para proponer posibles soluciones o explicaciones en un diálogo modal. El sistema también considera:
        *   **Priorización dinámica de errores**: Análisis de criticidad para enfocar los esfuerzos de auto-corrección.
        *   **Aprendizaje predictivo**: Identificación de patrones de error para sugerencias proactivas.
        *   **Validación robusta**: Pruebas automatizadas antes de aplicar correcciones auto-generadas.
        *   **Sincronización con Orquestador**: Comunicación para asegurar coherencia en correcciones complejas.
    *   Gestión de errores comunes de API LLM, como límites de tokens/TPM (Tokens Per Minute) o timeouts, con estrategias de reintentos con backoff exponencial y fragmentación de datos grandes (ej. en "AutoUpdate").

## Guía de Inicio

### Requisitos Previos

*   Un navegador web moderno y actualizado (ej. Chrome, Firefox, Edge, Safari).
*   Conexión a internet para acceder a los proveedores de IA basados en la nube y, opcionalmente, a repositorios Git remotos.
*   (Opcional) Si se usan modelos LLM locales (LM Studio, Ollama), tenerlos instalados, configurados y en ejecución en la máquina local o en un servidor accesible.

### Instalación y Primer Uso

1.  **Acceder a la Aplicación**: Abre la URL donde CodeAlchemist está desplegado en tu navegador web.
2.  **Configuración Inicial (Muy Recomendado)**:
    *   Navega a la sección **"Configuración"** (icono de engranaje `Settings` en la barra lateral).
    *   **Configura tu Proveedor LLM Global**:
        *   Selecciona el **Proveedor LLM** que deseas usar (Groq, Google Gemini, etc.).
        *   Introduce tu **Clave API** si el proveedor la requiere. Se guarda localmente en tu navegador.
        *   Elige un **Nombre del Modelo** de la lista disponible para ese proveedor.
        *   Si usas un proveedor local como LM Studio u Ollama, asegúrate de que la **URL del Endpoint de API** sea correcta (ej. `http://localhost:1234/v1` para LM Studio, `http://localhost:11434/v1` o `/api/chat` para Ollama, dependiendo de la compatibilidad).
        *   Haz clic en **"Probar Conexión (Proveedor LLM)"** para asegurar que la comunicación con la IA es exitosa.
    *   **(Opcional) Configura Git**: Si planeas usar la funcionalidad de "Subir a Git" en "AutoUpdate", completa los detalles de Git (URL del Repositorio, Nombre de Usuario, Email, Token de Acceso Personal) y prueba la conexión con **"Probar Conexión Git"**.
    *   **(Opcional) Activa el Modo Depuración**: Si deseas ver logs detallados de la aplicación.
    *   Haz clic en **"Guardar Configuración"**.
3.  **Inicialización de Agentes y Grupos por Defecto**:
    *   Al cargar la aplicación por primera vez (o si no existen en el almacenamiento local), CodeAlchemist crea automáticamente un conjunto de agentes y un grupo de trabajo por defecto:
        *   **Agentes Creados por Defecto**:
            *   `OrquestadorFlujoAgentes`: Esencial para la gestión de grupos de trabajo. No se puede eliminar y su nombre no es editable. Su mensaje de sistema está predefinido para gestionar el flujo de trabajo entre agentes.
            *   `RefactorizadorCodigoExperto`: Especializado en análisis y refactorización de código. Su mensaje de sistema lo orienta a proponer mejoras basadas en principios de Clean Code y SOLID, y a devolver sugerencias en formato JSON.
            *   `JefeDeProducto`: Define requisitos, historias de usuario y prioridades.
            *   `ArquitectoSoftware`: Diseña la arquitectura del sistema y selecciona tecnologías.
            *   `DesarrolladorSoftware`: Escribe el código fuente de la aplicación. Puede tener capacidades de acceso a código propio, ejecución y lectura/escritura.
            *   `IngenieroPruebas`: Escribe y ejecuta pruebas para asegurar la calidad. Puede tener capacidad de ejecución.
            *   `IngenieroDevOps`: Gestiona infraestructura, despliegues y CI/CD. Puede tener capacidades de ejecución, entorno virtual y lectura/escritura.
            *   `RepresentanteUsuario`: Proporciona feedback desde la perspectiva del usuario final.
            *   `ValidadorCodigo`: Analiza resultados de refactorización para detectar errores y asegurar la calidad del código. Puede tener capacidades de acceso a código propio y ejecución.
        *   **Grupo de Trabajo Creado por Defecto**:
            *   `EquipoDesarrolloSoftware`: Incluye al `OrquestadorFlujoAgentes` y a los agentes `JefeDeProducto`, `ArquitectoSoftware`, `DesarrolladorSoftware`, `RefactorizadorCodigoExperto`, `ValidadorCodigo`, `IngenieroPruebas`, `IngenieroDevOps`, y `RepresentanteUsuario`. Su tarea principal está predefinida para simular un equipo de producción de software completo y versátil, capaz de abordar diversas tareas de desarrollo y de mejorar el sistema "Auto-Fix" de CodeAlchemist mediante la implementación de estrategias de refuerzo (priorización dinámica, aprendizaje predictivo, validación robusta y sincronización con el Orquestador principal).
    *   Estos elementos por defecto sirven como punto de partida y pueden ser editados (excepto el nombre y la eliminación del `OrquestadorFlujoAgentes`). Es importante destacar que tanto estos agentes y grupos por defecto, como cualquier otro que el usuario cree, están completamente definidos y son gestionables a través de sus respectivas secciones: "Agentes IA" y "Grupos de Trabajo IA". No existen agentes o grupos "ocultos" o pre-programados fuera de lo que el usuario puede visualizar y modificar en la interfaz.

## Tutorial de Uso Detallado

A continuación, se describe cómo utilizar cada sección principal de CodeAlchemist.

### 1. Navegación y Barra Lateral

*   La interfaz principal cuenta con una **Barra Lateral** a la izquierda que da acceso a todas las secciones de la aplicación.
    *   **Panel de Control**: (Icono: `LayoutDashboard`) Es la página de bienvenida de CodeAlchemist y sirve como punto de partida central para todas las funcionalidades. Presenta un diseño claro y atractivo, destacando el logo de la aplicación (un matraz de alquimista estilizado) para reforzar la identidad visual. La página incluye:
        *   Un **título de bienvenida** grande y prominente, como "Bienvenido a CodeAlchemist".
        *   Una **descripción concisa** de la aplicación, enfatizando su propósito como asistente de IA para el desarrollo de software, cubriendo generación, análisis, refactorización y gestión de versiones.
        *   Una sección de **"Características Principales"** o "Acceso Rápido", que consiste en una cuadrícula de tarjetas interactivas. Cada tarjeta representa una funcionalidad clave de la aplicación (ej. "Generar Código", "Analizar Proyecto", "AutoUpdate", "Configuración", etc.), mostrando:
            *   El icono distintivo de la funcionalidad (ej. `CodeXml` para Generar Código).
            *   El título de la funcionalidad.
            *   Una breve descripción de su propósito.
            *   Al hacer clic en una tarjeta, el usuario navega directamente a la sección correspondiente. Las tarjetas tienen efectos visuales sutiles al pasar el cursor sobre ellas (ej. cambio de sombra o borde) para mejorar la interactividad.
        *   Una sección de **"Guía Rápida de Inicio"**, que ofrece una lista numerada de los pasos recomendados para que los nuevos usuarios comiencen a utilizar la aplicación de manera efectiva, como:
            1.  Configurar los ajustes del proveedor LLM.
            2.  Explorar la generación de código.
            3.  Probar el análisis de un fragmento de código.
            4.  Interactuar con el chat IA.
            5.  Experimentar con la función de AutoUpdate.
            Cada paso puede incluir un enlace directo a la sección correspondiente.
        *   Visualmente, el Panel de Control utiliza la paleta de colores principal de la aplicación para mantener la coherencia, con un uso prominente del color primario y de acento para los elementos interactivos y los títulos.
    *   **Generar Código**: Para crear fragmentos de código a partir de descripciones. (Icono: `CodeXml`)
    *   **Generar Proyecto**: Para iniciar nuevas estructuras de proyecto desde cero. (Icono: `FolderPlus`)
    *   **Refactorizar Proyecto**: Para analizar y obtener sugerencias de refactorización de proyectos existentes. (Icono: `GitPullRequestDraft`)
    *   **Analizar Código**: Para análisis detallados de fragmentos de código o archivos individuales. (Icono: `ScanLine`)
    *   **Analizar Proyecto**: Para un análisis completo de un proyecto, ya sea subido o desde Git. (Icono: `FolderSearch`)
    *   **AutoUpdate**: Para que CodeAlchemist analice y sugiera mejoras para su propio código fuente. (Icono: `Sparkles`)
    *   **Versiones Guardadas**: Para gestionar snapshots (instantáneas) de código. (Icono: `GitCompareArrows`)
    *   **Chat con IA**: Para conversar con un asistente IA. (Icono: `MessageCircle`)
    *   **Agentes IA**: Para crear, configurar y gestionar agentes IA individuales. (Icono: `Users2`)
    *   **Grupos de Trabajo IA**: Para definir y ejecutar equipos de agentes IA colaborativos. (Icono: `Workflow`)
    *   **Configuración**: Para ajustar parámetros globales de la aplicación, como proveedor LLM, claves API y configuración Git. (Icono: `Settings`)
*   La barra lateral puede **Ocultarse/Mostrarse** haciendo clic en el botón respectivo en la parte inferior de la misma (en vista de escritorio), que muestra los iconos `ChevronsLeft` (Ocultar) o `ChevronsRight` (Mostrar). Esto es útil para maximizar el espacio de trabajo.
*   En dispositivos móviles (pantallas pequeñas), un icono de menú (`Menu`) en la esquina superior izquierda abrirá la barra lateral como un panel deslizable para ahorrar espacio.

### 2. Configuración (Sección "Configuración")

Es crucial configurar correctamente la aplicación para su óptimo funcionamiento. Accede mediante el icono `Settings` en la barra lateral.

*   **Configuración del Proveedor LLM**:
    *   **Proveedor LLM**: Un selector para elegir el servicio de IA global que usará la aplicación por defecto (Groq, Google Gemini, OpenAI, Anthropic, LM Studio, Ollama).
    *   **URL del Endpoint de API**: Un campo de texto. Para proveedores locales (LM Studio, Ollama) o proxies personalizados, introduce la URL base (ej. `http://localhost:1234/v1`). Para proveedores en la nube, este campo se suele rellenar automáticamente con la URL estándar, pero puede ser sobrescrita si es necesario.
    *   **Clave API**: Un campo de texto (tipo contraseña) para introducir tu clave API si el proveedor seleccionado la requiere. Esta clave se guarda de forma segura en el almacenamiento local de tu navegador y no se envía a ningún servidor externo a CodeAlchemist, excepto al proveedor LLM durante las llamadas directas.
    *   **Nombre del Modelo**: Un selector que se actualiza dinámicamente según el proveedor LLM seleccionado. Lista los modelos disponibles para ese proveedor, usualmente ordenados por popularidad o capacidad.
    *   Botón **"Probar Conexión (Proveedor LLM)"**: Verifica la comunicación con el servicio IA usando la configuración actual. Muestra un mensaje de éxito o error, ayudando a diagnosticar problemas de configuración.
*   **Configuración de Git**:
    *   **URL del Repositorio Git**: Campo para la URL HTTPS de tu repositorio Git (ej. para la funcionalidad de "Subir a Git" en "AutoUpdate").
    *   **Nombre de Usuario Git**: Campo para tu nombre de usuario Git, que se usará en los commits.
    *   **Email de Git**: Campo para el email asociado a tus commits en Git.
    *   **Token de Acceso Personal (PAT)**: Campo de texto (tipo contraseña) para tu Token de Acceso Personal de Git, necesario para autenticar operaciones como `push` a repositorios privados o que requieran autenticación.
    *   Botón **"Probar Conexión Git"**: Verifica la autenticación con el repositorio remoto usando las credenciales proporcionadas. Muestra un mensaje de éxito o error.
*   **Modo Depuración**:
    *   Un interruptor (checkbox o switch) para **"Activar modo Debug"**. Al activarlo, aparece un panel de logs detallados fijo en la parte inferior de la pantalla de la aplicación. Este panel es expandible/contraíble mediante botones (`ChevronUp`/`ChevronDown`) y tiene opciones para **Copiar Logs** (`Copy`) y **Borrar Logs** (`Trash2`) del panel.
*   Botón **"Guardar Configuración"**: Guarda todos los ajustes realizados en esta sección en el almacenamiento local del navegador, para que persistan entre sesiones.

### 3. Generar Código (Sección "Generar Código")

Accede mediante el icono `CodeXml` en la barra lateral.

*   **Usar Configuración LLM De**: Un selector para elegir la fuente de la configuración de IA que se utilizará para esta generación:
    *   **Ajustes Globales**: Utiliza la configuración LLM definida en la sección "Configuración".
    *   **Agente: [Nombre del Agente]**: Utiliza la configuración LLM específica (global o personalizada) del agente seleccionado de la lista de agentes creados.
    *   **Grupo: [Nombre del Grupo]**: La tarea de generación de código se pasa al `OrquestadorFlujoAgentes` del grupo seleccionado, quien coordinará a los agentes del grupo para producir el código.
*   **Describe tu necesidad**: Un área de texto grande para que el usuario escriba un prompt detallado describiendo el fragmento de código que necesita (ej. lenguaje, funcionalidad, entradas, salidas esperadas).
*   Botón **"Generar Código"**: Inicia el proceso de generación. Antes de contactar a la IA, puede mostrar un diálogo de confirmación con el prompt y la configuración LLM a usar.
*   **Resultados**:
    *   Se muestra una **Explicación** (opcional, generada por la IA) del código que se va a generar.
    *   A continuación, se presenta el **Fragmento de Código** generado por la IA.
    *   Un botón **"Copiar Código"** permite copiar fácilmente el fragmento generado al portapapeles.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página, que es expandible/contraíble y permite copiar su contenido. Este log muestra las interacciones entre los agentes del grupo durante el proceso de generación.

### 4. Generar Proyecto (Sección "Generar Proyecto")

Accede mediante el icono `FolderPlus` en la barra lateral.

*   **Usar Configuración LLM De**: Selector similar al de "Generar Código" (Global, Agente, Grupo).
*   **Describe tu proyecto**: Área de texto para el prompt detallado, donde el usuario especifica el tipo de proyecto, tecnologías principales, estructura de carpetas deseada, archivos iniciales, etc.
*   Botón **"Generar Proyecto"**: Al pulsarlo, se abre un diálogo modal de **"Confirmar Generación"**. En este diálogo:
    *   Se muestra el prompt actual introducido por el usuario.
    *   Un área de texto permite **"Redefinir Prompt (opcional)"** para que el usuario pueda ajustar o añadir detalles a su descripción antes de proceder con la generación.
    *   Botones para **"Cancelar"** la operación o **"Sí, Generar Proyecto"** para iniciarla.
*   **Resultados**:
    *   **Nombre Sugerido**: Un nombre para el proyecto, sugerido por la IA basado en la descripción.
    *   **Notas de la IA**: Comentarios o consideraciones adicionales de la IA sobre la estructura generada, posibles dependencias a instalar, o siguientes pasos recomendados.
    *   Lista de **"Archivos Generados"**: Se muestra una estructura de árbol o lista con las rutas relativas de los archivos y carpetas generados. Cada archivo puede expandirse para ver su contenido directamente en la interfaz.
    *   Botón **"Descargar Proyecto (ZIP)"**: Permite descargar todos los archivos y carpetas generados como un único archivo ZIP.
    *   Si se utilizó un grupo de trabajo, se muestra un **Log Detallado del Grupo** al final de la página.

### 5. Refactorizar Proyecto (Sección "Refactorizar Proyecto")

Accede mediante el icono `GitPullRequestDraft` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo). Se recomienda seleccionar un agente especializado como `RefactorizadorCodigoExperto` (creado por defecto) o un grupo de trabajo que lo incluya junto con el `OrquestadorFlujoAgentes`.
*   **Fuente del Proyecto**:
    *   **Subir Archivo**: Un botón que permite al usuario seleccionar un archivo de su sistema. Formatos admitidos:
        *   `.zip`: Para proyectos completos.
        *   `.json`: Si el proyecto está representado en un formato JSON estructurado.
        *   Archivos de texto individuales (ej. `.py`, `.js`, `.html`, `.css`, `.java`, etc.): Para analizar archivos específicos.
    *   **URL de Git**: Un campo de texto para introducir la URL HTTPS de un repositorio Git público. La aplicación (a través de un agente con capacidad Git o un servicio interno) intentará clonar u obtener el contenido del repositorio para su análisis.
*   **Parámetros de Refactorización**:
    *   **Metas (opcional)**: Campo de texto para que el usuario describa objetivos específicos de la refactorización (ej. "Mejorar el rendimiento de las consultas a base de datos en el módulo X", "Aplicar el patrón Observer en los componentes de UI Y y Z", "Reducir la complejidad ciclomática de las funciones en `utils.py`").
    *   **Prioridad General (opcional)**: Un selector para indicar un enfoque general que la IA debe considerar (ej. "Priorizar Seguridad", "Priorizar Legibilidad", "Priorizar Rendimiento", "Estandarizar Código" según una guía de estilo implícita, "Reducir Complejidad").
*   Botón **"Analizar para Refactorizar"**: Inicia el proceso de análisis del proyecto proporcionado.
*   **Resultados y Sugerencias**: Se presenta una lista de sugerencias de refactorización. Cada sugerencia incluye:
    *   **Área**: El archivo, clase o función específica afectada por la sugerencia.
    *   **Descripción**: Una explicación clara de la mejora propuesta, el problema que soluciona o el principio de diseño que aplica.
    *   **Prioridad**: Un indicador de la importancia o impacto de la sugerencia (Alta, Media, Baja).
    *   **Snippet Sugerido (opcional)**: Si es aplicable, un fragmento del código original y el código modificado sugerido para ilustrar el cambio.
*   **Acciones por Sugerencia**:
    *   Botón **"Aplicar"**: Aplica la sugerencia. Si el proyecto se subió, los cambios se gestionan internamente. Si es de Git, se preparan los cambios para revisión.
    *   Botón **"Ver Diff"**: Muestra una comparación visual entre el código original y el sugerido para esa sugerencia específica.
    *   Botón **"Descartar"**: Marca la sugerencia como "descartada" y la oculta o atenúa en la lista.
*   **Acción Masiva**: Un botón **"Aplicar Todas las Sugerencias"** para marcar todas las sugerencias pendientes como aplicadas.
*   **Logs de Ejecución**: Si se utilizó un grupo de trabajo, se muestra un log detallado de las interacciones entre agentes y las decisiones del orquestador durante el análisis.

### 6. Analizar Código (Sección "Analizar Código")

Accede mediante el icono `ScanLine` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   **Fuente del Código**: Proporciona múltiples maneras de introducir el código a analizar:
    *   Botón **"Sube un archivo de código (opcional)"**: Permite al usuario cargar un archivo de código fuente desde su sistema.
    *   Campo **"URL de Archivo Git (opcional)"**: Permite pegar la URL directa a un archivo "raw" (contenido crudo) en un repositorio Git (ej. GitHub, GitLab). La aplicación intentará descargar el contenido de esa URL.
    *   Área de texto principal: El usuario puede pegar directamente el fragmento de código que desea analizar.
*   Botón **"Analizar Código"**: Inicia el análisis del código proporcionado.
*   **Resultados**:
    *   **Explicación**: La IA genera una explicación en lenguaje natural del funcionamiento del código original.
    *   **Código Original**: Muestra el código que se introdujo para el análisis.
    *   **Código Sugerido**: Presenta una versión del código con las mejoras, correcciones u optimizaciones propuestas por la IA.
*   Botones **"Guardar Original"** y **"Guardar Sugerido"**: Permiten crear "snapshots" (instantáneas) del código original y del código sugerido, respectivamente. Estas versiones se almacenan en la sección "Versiones Guardadas" para su posterior revisión o comparación.

### 7. Analizar Proyecto Completo (Sección "Analizar Proyecto")

Accede mediante el icono `FolderSearch` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo).
*   **Fuente del Proyecto**:
    *   Botón **"Subir Archivo (ZIP/JSON)"**: Permite subir un proyecto completo empaquetado en un archivo `.zip` o una representación del proyecto en formato `.json`.
    *   Campo **"URL de Git"**: Para introducir la URL HTTPS de un repositorio Git público. La aplicación (o un agente con capacidades Git) intentará obtener el contenido del repositorio.
*   Botón **"Analizar Proyecto"**: Inicia el análisis holístico del proyecto.
*   **Resultados**:
    *   Se muestra un resumen general del análisis, destacando áreas clave, posibles problemas de alto nivel, o la calidad general percibida por la IA.
    *   Puede incluir una lista de áreas identificadas o sugerencias más generales que en "Refactorizar Proyecto".
*   **Log Detallado**: Muestra un log del proceso de análisis, especialmente si se utilizó un grupo de trabajo, detallando las interacciones entre los agentes.

### 8. AutoUpdate (Sección "AutoUpdate")

Accede mediante el icono `Sparkles` en la barra lateral. Esta sección permite que CodeAlchemist se analice a sí mismo.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo). Por defecto, se recomienda usar el agente `RefactorizadorCodigoExperto` (creado automáticamente) o un grupo de trabajo que lo incluya junto con el `OrquestadorFlujoAgentes`.
*   **Fuente del Código para Auto-Análisis**:
    *   **Local** (opción por defecto): Analiza el código fuente actual de la aplicación CodeAlchemist que se está ejecutando en el entorno.
    *   **URL del Repositorio Git (Opcional)**: Un campo para introducir la URL de un repositorio Git de CodeAlchemist (puede ser el repositorio principal o un fork). Esto permite analizar una versión específica del código base. La aplicación intentará obtener el contenido de esta URL.
*   **Preferencias de Análisis (Opcional)**: Un campo de texto para que el usuario guíe a la IA con objetivos específicos para el auto-análisis (ej. "Optimizar el rendimiento de los componentes de UI", "Mejorar la seguridad en las interacciones con APIs de terceros", "Asegurar que los comentarios del código estén en castellano"). Es importante indicar que "Todas las sugerencias deben estar en castellano" si se desea ese idioma.
*   Botón **"Iniciar Auto-Análisis"**: Comienza el proceso de auto-análisis.
*   Muestra una **Barra de Progreso** si el análisis se realiza por fragmentos (no gestionado por un grupo), indicando "Procesando fragmento X de Y".
*   **Resultados**:
    *   **Título del Análisis**: Un resumen conciso de los hallazgos del auto-análisis.
    *   **Áreas Identificadas**: Componentes, módulos o archivos específicos que la IA ha destacado.
    *   **Sugerencias Detalladas**: Una lista de sugerencias, cada una con:
        *   Área afectada (ej. ruta de archivo).
        *   Sugerencia específica de mejora o corrección.
        *   Prioridad (Alta, Media, Baja).
        *   Si la sugerencia implica un cambio de código directo en un archivo, se proporciona el **Contenido Completo del Archivo Sugerido**.
    *   **Evaluación General**: Un resumen de la IA sobre el estado general del código de CodeAlchemist analizado.
*   **Aplicar Sugerencias**: Para cada sugerencia que proponga un cambio de código en un archivo:
    *   Botón **"Aplicar Sugerencia"**. Al pulsarlo, se abre un diálogo de confirmación que muestra una vista previa del cambio (simulando un "diff" entre el contenido actual del archivo y el contenido sugerido).
    *   Al confirmar en el diálogo, el archivo físico correspondiente en el sistema de CodeAlchemist **SERÁ MODIFICADO DIRECTAMENTE**. Esta es una operación real. (Nota: La modificación directa de archivos del sistema desde una aplicación web en el navegador tiene limitaciones de seguridad significativas; esta funcionalidad puede ser simulada en la UI o requerir una arquitectura con un backend o agente local con los permisos necesarios).
*   **Descargar Código Fuente Completo**:
    *   Botón **"Descargar Código (ZIP)"**: Descarga un archivo ZIP que contiene el estado actual completo del código fuente de CodeAlchemist (todos los archivos necesarios para ejecutar la aplicación). (Nota: La generación de ZIPs en el cliente puede ser compleja para estructuras de directorios grandes; puede ser una simulación o requerir un backend).
    *   Botón **"Descargar Código (JSON)"**: Descarga una representación JSON del código fuente, donde cada entrada es un objeto con la ruta del archivo y su contenido.
*   **Subir a Git**:
    *   Botón para iniciar el proceso de `commit` y `push` del estado actual del código fuente de CodeAlchemist al repositorio Git configurado en la sección "Configuración".
    *   Solicita al usuario un mensaje de commit antes de proceder.
    *   Esta operación es real si la configuración Git es válida y el repositorio remoto es accesible. (Nota: Las operaciones Git directas desde el navegador son complejas y generalmente requieren un backend o un entorno con herramientas Git instaladas y accesibles).
*   **Manejo de Errores y Auto-Fix**:
    *   Los errores que ocurran durante el análisis, aplicación de sugerencias, o subida a Git se muestran claramente.
    *   Botón **"Copiar Error"** disponible para la mayoría de los mensajes de error.
    *   Botón **"Auto-Fix"**: Utiliza la IA configurada para analizar el mensaje de error y el contexto actual, proponiendo soluciones o explicaciones en un diálogo modal.
*   **Logs de Ejecución Detallados**: Un panel en la parte inferior de la sección muestra logs detallados del proceso. Este panel es expandible/contraíble y cuenta con botones para **Copiar Logs** y **Borrar Logs**.

### 9. Versiones Guardadas (Sección "Versiones Guardadas")

Accede mediante el icono `GitCompareArrows` en la barra lateral. Gestiona instantáneas de código.

*   Muestra una lista de las versiones de código que se han guardado, cada una con su nombre descriptivo y la fecha/hora de creación.
*   **Acciones por Versión**: Para cada versión en la lista, se dispone de las siguientes acciones:
    *   **Ver**: Abre un diálogo modal que muestra el contenido completo del código guardado en esa versión.
    *   **Descargar**: Permite descargar el código de la versión como un archivo de texto plano.
    *   **Eliminar**: Borra la versión seleccionada del almacenamiento local (se pide confirmación antes de eliminar).
    *   **Seleccionar para Comparar (A/B)**: Dos botones ("A" y "B") junto a cada versión. Al pulsar "A" en una versión, se marca como la primera para la comparación. Al pulsar "B" en otra versión, se marca como la segunda.
*   **Comparar Versiones**: Si se han seleccionado dos versiones (una como A y otra como B), se habilita un botón (o se muestra automáticamente) para "Comparar A y B". Al activarlo, se abre un diálogo modal que muestra las diferencias entre el código de la versión A y la versión B, resaltando las líneas añadidas, eliminadas o modificadas (simulando un "diff").
*   Botón **"Guardar Código Actual de CodeAlchemist"**: Permite tomar una instantánea del código fuente completo y actual de la aplicación CodeAlchemist y guardarla en esta sección con un nombre y fecha generados automáticamente.
*   Botón **"Eliminar Todas"**: Borra todas las versiones guardadas del almacenamiento local (se pide confirmación antes de proceder).

### 10. Chat con IA (Sección "Chat con IA")

Accede mediante el icono `MessageCircle` en la barra lateral.

*   **Usar Configuración LLM De**: Selector (Global, Agente, Grupo). Permite dirigir la conversación al LLM configurado globalmente, a un agente específico, o a un grupo de trabajo.
*   Área de texto para que el usuario escriba sus mensajes o preguntas a la IA. Se puede enviar pulsando Enter (si no se usa Shift+Enter para nueva línea) o mediante un botón de enviar.
*   El historial de la conversación (mensajes del usuario y respuestas de la IA) se muestra en la ventana principal del chat.
*   Botón **"Borrar el Chat"** para limpiar el historial de la conversación actual.
*   En caso de errores en la respuesta de la IA, se muestra el mensaje de error con opciones para **Copiar Error** o intentar un **"Auto-Fix"**.

### 11. Gestión de Agentes IA (Sección "Agentes IA")

Accede mediante el icono `Users2` en la barra lateral. Todos los agentes, incluyendo los creados por defecto, son completamente gestionables desde esta sección.

*   Muestra una lista de todos los agentes IA creados, con su nombre, descripción, configuración LLM y un resumen de sus capacidades.
*   Botones **"Importar Agentes"** (permite subir un archivo JSON que contenga la configuración de uno o más agentes) y **"Exportar Todos los Agentes"** (descarga un archivo JSON con la configuración de todos los agentes actuales).
*   **Formulario "Crear/Editar Agente"** (accesible mediante un botón "Crear Agente Nuevo" o al editar un agente existente):
    *   **Nombre**: Campo de texto para un nombre único y descriptivo del agente (ej. `AnalistaDeRequisitos`, `GeneradorDeTestsUnitarios`, `ExpertoEnPython`).
    *   **Descripción**: Campo de texto para una breve explicación del propósito y la especialización del agente.
    *   **Mensaje de Sistema (Prompt)**: Un área de texto grande para definir el prompt base del agente. Este prompt es crucial, ya que define el rol, el comportamiento, el tono, las instrucciones fundamentales y las restricciones que la IA debe seguir al actuar como este agente.
    *   **Capacidades del Agente**: Un conjunto de interruptores (checkboxes) para habilitar permisos específicos para el agente:
        *   Checkbox **"Acceso a Código Propio"**: Si está marcado, el agente tiene permiso para leer el código fuente de la aplicación CodeAlchemist.
        *   Checkbox **"Capacidad de Ejecución"**: Si está marcado, el agente tiene permiso para ejecutar comandos o scripts en el sistema. Esta opción está marcada con una advertencia de "Peligroso" debido a las implicaciones de seguridad.
        *   Checkbox **"Capacidad de Entorno Virtual"**: Si está marcado, el agente puede tener la capacidad de interactuar con o gestionar entornos virtuales (ej. para instalar dependencias o ejecutar código de forma aislada).
        *   Checkbox **"Capacidad Lectura/Escritura"**: Si está marcado, el agente tiene permiso para leer y escribir archivos en el sistema donde se ejecuta CodeAlchemist. Esta opción también está marcada con una advertencia de "Peligroso".
    *   **Configuración LLM del Agente**: Permite definir qué modelo de lenguaje grande usará este agente:
        *   Selector: **"Usar Configuración Global"** (el agente usará los ajustes de Proveedor LLM, Modelo, API Key, etc., definidos en la sección "Configuración" de la aplicación) o **"Configuración Personalizada"**.
        *   Si se elige "Configuración Personalizada": Se muestran campos adicionales para seleccionar un **Proveedor LLM** (Groq, Google Gemini, etc.), un **Modelo** específico de ese proveedor, y opcionalmente, sobrescribir la **Clave API** (tipo contraseña) y la **URL de API** (si aplica para el proveedor, ej. para modelos locales). Si se dejan vacíos la clave o URL personalizadas, se usarán las globales si existen para ese proveedor.
*   Agente especial **`OrquestadorFlujoAgentes`**:
    *   Este agente se crea automáticamente por defecto y es crucial para el funcionamiento de los Grupos de Trabajo.
    *   Su descripción y Mensaje de Sistema están predefinidos para detallar su rol crítico: recibir y gestionar todas las respuestas generadas dentro de un grupo, decidir qué agente actúa a continuación basado en la tarea principal, el historial y el estado actual, para asegurar un flujo coordinado y la toma de decisiones centralizada.
    *   Se recomienda usar un modelo LLM capaz de seguir instrucciones JSON estrictas para este agente, ya que su respuesta debe ser un JSON que indique el próximo agente y la razón.
    *   El nombre de este agente no es editable y no se puede eliminar.
*   Agente especial **`RefactorizadorCodigoExperto`**:
    *   Este agente también se crea automáticamente por defecto.
    *   Está especializado en analizar código y proponer refactorizaciones, priorizando estándares como SOLID y Clean Code. Su mensaje de sistema está orientado a esta tarea y a devolver sugerencias en formato JSON.
*   **Acciones por Agente (en la lista)**:
    *   Botón **"Probar"**: Abre una ventana de chat modal diseñada para interactuar directamente con el agente seleccionado. Se utiliza el mensaje de sistema y la configuración LLM del agente para esta prueba.
    *   Botón **"Exportar"**: Descarga un archivo JSON con la configuración completa del agente seleccionado.
    *   Botón **"Editar"**: Abre el formulario "Crear/Editar Agente" pre-rellenado con los datos del agente para su modificación. (El nombre del `OrquestadorFlujoAgentes` no es editable).
    *   Botón **"Eliminar"**: Permite borrar el agente del sistema (se pide confirmación). (Deshabilitado para `OrquestadorFlujoAgentes`).

### 12. Gestión de Grupos de Trabajo IA (Sección "Grupos de Trabajo IA")

Accede mediante el icono `Workflow` en la barra lateral. Todos los grupos, incluyendo los creados por defecto, son completamente gestionables desde esta sección.

*   Muestra una lista de los grupos de trabajo creados, con su nombre y descripción.
*   **Formulario "Crear/Editar Grupo"** (accesible mediante un botón "Crear Grupo Nuevo" o al editar un grupo existente):
    *   **Nombre**: Campo de texto para un nombre único para el grupo de trabajo.
    *   **Descripción**: Campo de texto para una breve explicación del propósito o la especialización del grupo.
    *   **Tarea Principal del Grupo**: Un área de texto para definir el prompt detallado que describe el objetivo general que el grupo de trabajo debe alcanzar. Este es el input inicial que recibirá el `OrquestadorFlujoAgentes` del grupo.
    *   **Seleccionar Agentes Participantes**: Una lista de checkboxes que muestra todos los agentes disponibles (excepto el `OrquestadorFlujoAgentes`, que se añade implícitamente). El usuario debe seleccionar al menos un agente para que participe en el grupo además del orquestador.
*   Grupo de trabajo por defecto **`EquipoDesarrolloSoftware`**:
    *   Se crea automáticamente si no existe.
    *   Incluye al `OrquestadorFlujoAgentes` y una selección de otros agentes por defecto como `JefeDeProducto`, `ArquitectoSoftware`, `DesarrolladorSoftware`, `RefactorizadorCodigoExperto`, `IngenieroPruebas`, etc.
    *   Su tarea principal describe las capacidades del grupo como un equipo de producción de software versátil y auto-mejorable, en lugar de un objetivo de proyecto específico.
*   **Acciones por Grupo (en la lista)**:
    *   Botón **"Ejecutar"**: Abre un diálogo modal titulado **"Ejecución del Grupo de Trabajo"**. Esta ventana es interactiva y muestra:
        *   La **Tarea Principal** asignada al grupo.
        *   Se inicia la ejecución del grupo, comenzando con el `OrquestadorFlujoAgentes`.
        *   Un **Log de Ejecución Detallado** se actualiza en tiempo real, mostrando:
            *   El número de turno actual.
            *   Las decisiones del `OrquestadorFlujoAgentes` (a qué agente le pasa el control y por qué).
            *   Las respuestas o contribuciones textuales de cada agente participante.
            *   Cualquier mensaje de sistema relevante o error que pueda ocurrir durante la ejecución.
        *   Un botón para **"Copiar los Logs"** al portapapeles.
        *   Un botón para **"Detener la Ejecución"** del grupo de trabajo.
    *   Botón **"Editar"**: Abre el formulario "Crear/Editar Grupo" pre-rellenado con los datos del grupo para su modificación.
    *   Botón **"Eliminar"**: Permite borrar el grupo de trabajo del sistema (se pide confirmación).

## Flujo de Trabajo con IA

### Selección de Fuente de Configuración LLM

En la mayoría de las secciones que utilizan capacidades de IA (como "Generar Código", "Analizar Código", "AutoUpdate", "Chat con IA"), el usuario encontrará un selector desplegable etiquetado como **"Usar Configuración LLM De:"**. Este selector ofrece las siguientes opciones para determinar qué modelo de lenguaje y configuración se utilizará:

1.  **Ajustes Globales**: Si se selecciona esta opción, la operación de IA utilizará la configuración (Proveedor LLM, Modelo, Clave API, URL de API) definida globalmente en la sección **"Configuración"** de la aplicación.
2.  **Agente: [Nombre del Agente]**: Esta opción lista todos los agentes IA que el usuario ha creado en la sección "Agentes IA". Al seleccionar un agente específico, la operación de IA utilizará la configuración LLM definida para ese agente (que puede ser la global o una personalizada para ese agente) y su Mensaje de Sistema como prompt principal.
3.  **Grupo: [Nombre del Grupo]**: Esta opción lista todos los grupos de trabajo que el usuario ha creado en la sección "Grupos de Trabajo IA". Al seleccionar un grupo, la tarea o prompt del usuario se entrega como la "Tarea Principal" al `OrquestadorFlujoAgentes` de ese grupo. El Orquestador entonces utiliza su propia configuración LLM y coordina a los demás agentes del grupo (cada uno usando su respectiva configuración LLM) para completar la tarea. El resultado final es la respuesta consolidada o generada por el grupo.

### Agentes y Grupos de Trabajo

*   **Agentes**: Son entidades de IA individuales, cada una con:
    *   Un **Mensaje de Sistema (Prompt)** que define su rol, personalidad, instrucciones y restricciones.
    *   **Capacidades** específicas (acceso a código, ejecución, etc.) que determinan qué acciones pueden realizar.
    *   Una **Configuración LLM** (global o personalizada) que especifica el modelo de lenguaje que utilizará.
    Los agentes están diseñados para ser especialistas en tareas concretas.

*   **Grupos de Trabajo**: Son equipos de agentes IA diseñados para colaborar en tareas más complejas que podrían requerir múltiples especializaciones o pasos.
    *   El agente **`OrquestadorFlujoAgentes`** es un componente obligatorio y central en cada grupo. No realiza la tarea directamente, sino que:
        *   Recibe la tarea principal del grupo (o el prompt del usuario si se usa un grupo en una sección como "Generar Código").
        *   Gestiona el flujo de interacción entre los agentes.
        *   Recibe y evalúa todas las respuestas generadas por los agentes participantes.
        *   Decide qué agente (o subgrupo, conceptualmente) debe actuar a continuación para avanzar hacia el objetivo. Si el usuario no guía explícitamente el siguiente paso, el Orquestador prioriza a los agentes cuyas capacidades son más relevantes para el estado actual de la tarea.
        *   Asegura la coordinación y la toma de decisiones centralizada.
    *   La comunicación entre agentes dentro de un grupo siempre pasa a través del Orquestador.

## Manejo de Errores

CodeAlchemist implementa varios mecanismos para gestionar y comunicar errores:

*   **Visualización Clara**: Los errores generados por la API del LLM, operaciones Git, o fallos internos de la aplicación se muestran al usuario de forma clara, usualmente en la sección donde se originó el error o mediante notificaciones (toasts).
*   **Copia de Errores**: La mayoría de los mensajes de error mostrados en la interfaz de usuario van acompañados de un botón **"Copiar Error"**. Esto facilita al usuario copiar el mensaje exacto para buscar ayuda, reportar un bug o analizarlo.
*   **Auto-Fix**:
    *   En secciones como "AutoUpdate" y "Chat con IA", si ocurre un error, se presenta un botón **"Auto-Fix"**.
    *   Al pulsarlo, la aplicación envía el mensaje de error y el contexto relevante (como el prompt que causó el error o el estado actual) a la IA configurada.
    *   La IA analiza esta información y propone una o más posibles causas y soluciones en un diálogo modal. El usuario puede entonces revisar estas sugerencias para intentar resolver el problema.
    *   **Refuerzo del Sistema Auto-Fix**:
        *   **Priorización dinámica**: Un módulo de análisis clasifica errores por su criticidad (impacto en rendimiento, seguridad, usabilidad) para enfocar los esfuerzos de auto-corrección.
        *   **Aprendizaje automático predictivo**: Un modelo entrenado con datos históricos de errores y sus correcciones identifica patrones y sugiere soluciones proactivas.
        *   **Validación robusta**: Antes de aplicar correcciones auto-generadas (especialmente en "AutoUpdate"), se ejecutan pruebas automatizadas (unitarias, integración) para minimizar falsos positivos.
        *   **Sincronización con el Orquestador**: Se establecen canales de comunicación entre el sistema Auto-Fix y el `OrquestadorFlujoAgentes` para asegurar que las correcciones automáticas sean coherentes con los flujos de trabajo activos.
*   **Errores de API LLM**:
    *   **Límites de Tokens/TPM (Tokens Per Minute)**: La aplicación intenta gestionar los errores `429 Too Many Requests` (comunes cuando se exceden los límites de tasa de la API) mediante reintentos automáticos con una estrategia de backoff exponencial (aumentando el tiempo de espera entre reintentos). En funciones como "AutoUpdate", si el código fuente es muy grande, se fragmenta en trozos más pequeños antes de enviarlo a la IA para evitar errores de "payload too large" y también para mitigar el impacto en los límites de tokens por minuto.
    *   **Timeouts**: Las llamadas a las APIs LLM tienen configurados tiempos de espera para evitar que la aplicación se bloquee indefinidamente si la API no responde. Si una solicitud excede este tiempo, se cancela y se informa al usuario.

## Notas Importantes y Consideraciones

*   **Sugerencias de IA**: Las sugerencias de código, refactorización o análisis proporcionadas por la IA deben ser consideradas como recomendaciones. Siempre revisa, comprende y prueba exhaustivamente cualquier cambio antes de aplicarlo a un entorno de producción.
*   **Límites de API y Timeouts**: El uso intensivo de las funcionalidades de IA puede llevar a alcanzar los límites de uso impuestos por los proveedores de API LLM (ej. tokens por minuto, peticiones por minuto). La aplicación intenta manejar esto con reintentos y fragmentación de datos, pero pueden ocurrir interrupciones. En "AutoUpdate", la fragmentación del código y los retrasos entre el procesamiento de fragmentos ayudan a mitigar esto.
*   **Seguridad**:
    *   La función "Aplicar Sugerencia" en la sección "AutoUpdate" modifica directamente los archivos del código fuente de CodeAlchemist. Procede con precaución.
    *   Las capacidades de agente como "Capacidad de Ejecución" o "Capacidad Lectura/Escritura" son intrínsecamente peligrosas si no se gestionan en un entorno seguro y controlado. Habilítalas solo si comprendes los riesgos.
    *   Las claves API se guardan en el almacenamiento local de tu navegador. Aunque esto es conveniente, considera las implicaciones de seguridad si compartes tu navegador o si tu sistema está comprometido.
*   **Costes de API**: El uso de proveedores de IA en la nube (Groq, Google Gemini, OpenAI, Anthropic) puede incurrir en costes económicos dependiendo de tu plan y el volumen de uso. Los modelos LLM locales (LM Studio, Ollama) no incurren en estos costes de API, pero requieren recursos computacionales propios.
*   **Privacidad**: Al usar proveedores de IA en la nube, el código fuente, los prompts y otros datos que introduzcas en CodeAlchemist se envían a los servidores de dichos proveedores. Revisa sus políticas de privacidad y uso de datos. Para máxima privacidad, considera utilizar modelos LLM locales.

## Diseño (Aspectos Visuales)

CodeAlchemist utiliza una interfaz de usuario moderna y profesional, diseñada para ser intuitiva, funcional y agradable a la vista.

*   **Paleta de Colores Principal**: La aplicación emplea una paleta de colores cuidadosamente seleccionada para asegurar claridad, legibilidad y una estética profesional.
    *   Fondo principal (Background): Un gris claro (`#ECEFF1`, HSL: `210 17% 94%`), que proporciona un lienzo limpio y neutro, minimizando la fatiga visual.
    *   Texto principal (Foreground): Un gris muy oscuro (`HSL: 233 30% 15%`) para ofrecer el máximo contraste y legibilidad sobre el fondo claro.
    *   Color primario (Primary): Un azul oscuro intenso (`#1A237E`, HSL: `233 63% 30%`), utilizado para acciones principales, botones destacados, elementos activos y la marca de la aplicación.
    *   Texto sobre color primario (Primary Foreground): Un gris claro (`HSL: 210 17% 85%`) para asegurar un buen contraste sobre el azul primario.
    *   Color secundario (Secondary): Un gris ligeramente más oscuro que el fondo principal (`HSL: 210 17% 88%`), usado para bordes sutiles, fondos de elementos de entrada (inputs) y elementos menos prominentes.
    *   Texto sobre color secundario (Secondary Foreground): Un gris oscuro (`HSL: 233 30% 20%`).
    *   Color de acento (Accent): Un verde azulado o teal (`#26A69A`, HSL: `174 60% 40%`), utilizado para elementos de énfasis, enlaces, iconos informativos y para destacar ciertas interacciones.
    *   Texto sobre color de acento (Accent Foreground): Un gris oscuro (`HSL: 210 17% 15%`).
    *   Color destructivo (Destructive): Un rojo vibrante (`HSL: 0 84.2% 60.2%`), reservado para acciones de eliminación, mensajes de error críticos y advertencias importantes.
    *   Texto sobre color destructivo (Destructive Foreground): Un gris muy oscuro, casi negro (`HSL: 0 0% 10%`), para garantizar la legibilidad sobre el rojo.
    *   Fondo de tarjetas y popovers (Card/Popover Background): Blanco (`#FFFFFF`, HSL: `0 0% 100%`) para que el contenido de estos elementos resalte claramente.
    *   Texto sobre tarjetas y popovers (Card/Popover Foreground): El mismo gris muy oscuro del texto principal (`HSL: 233 30% 15%`).
    *   Colores Muted (para texto secundario, descripciones menos importantes, fondos de elementos desactivados): Gris claro para fondos (`HSL: 210 17% 90%`) y un gris medio para texto (`HSL: 233 20% 40%`).
    *   Color de bordes generales (Border): Un gris claro (`HSL: 210 17% 85%`), usado para delinear componentes y contenedores.
    *   Color de fondo de campos de entrada (Input Background): El mismo gris claro de los bordes (`HSL: 210 17% 85%`) para una apariencia integrada.
    *   Color de "anillo" de enfoque (Focus Ring): El color de acento teal (`HSL: 174 60% 40%`) se usa para resaltar los elementos que tienen el foco, mejorando la accesibilidad y la navegación por teclado.
*   **Iconografía**:
    *   Se utiliza un conjunto de iconos vectoriales consistentes y limpios (Lucide Icons) para representar las diferentes secciones, acciones y conceptos dentro de la aplicación. Esto asegura claridad visual, una estética cohesiva y escalabilidad sin pérdida de calidad.
    *   El icono principal o logo de la aplicación es una representación estilizada de un matraz de alquimista (`FlaskConical`), simbolizando la transformación, la experimentación y la "alquimia" de convertir ideas y código en soluciones mejoradas y eficientes.
*   **Tipografía**:
    *   Se emplea una fuente sans-serif moderna y altamente legible (Geist Sans) para todo el texto de la interfaz, optimizando la experiencia de lectura y la claridad de la información en diferentes tamaños y densidades de pantalla.
    *   Para la visualización de código y en áreas donde se requiere monoespaciado (como logs o snippets de código), se utiliza una fuente monoespaciada (Geist Mono).
*   **Diseño General y Estructura de Páginas**:
    *   La aplicación presenta un diseño moderno, con una clara jerarquía visual que guía al usuario a través de las diferentes funcionalidades.
    *   Es responsiva, adaptándose a diferentes tamaños de pantalla para una experiencia óptima tanto en escritorio como en dispositivos móviles.
    *   Se utilizan esquinas redondeadas (`rounded-md`, `rounded-lg`) para botones, tarjetas, campos de entrada y otros elementos de la interfaz, aportando una sensación de suavidad y modernidad.
    *   Se aplican sombras sutiles (`shadow-sm`, `shadow-lg`) a elementos como tarjetas y diálogos modales para darles profundidad y destacarlos del fondo, creando una apariencia profesional y pulida.
    *   La disposición de los elementos en cada página está pensada para ser intuitiva. Generalmente, las páginas presentan una `Card` principal que contiene los controles y resultados de la sección. Las entradas de texto (como prompts o código) suelen ser `Textarea` amplias, y los resultados se muestran en áreas de solo lectura o `ScrollArea` para manejar contenido extenso. Los botones de acción principal están claramente visibles.
    *   La barra lateral izquierda proporciona la navegación principal y es colapsable. La ventana de depuración (si está activa) se fija en la parte inferior.
    *   Usa las mejores practicas de programacion usando estandares de programacion y archivos pequeños para una mejor mantenibilidad, escalabilidad y aprovechamiento.
