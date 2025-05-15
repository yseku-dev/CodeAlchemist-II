
// src/lib/i18n/translations.ts

import type { LanguageCode } from '@/types';

/**
 * @fileOverview Centralized translation strings for the CodeAlchemist application.
 * This file contains the text for different languages supported by the application.
 */

/**
 * Type for a single language's translations, mapping keys to strings or nested objects.
 */
export type TranslationSet = {
  [key: string]: string | TranslationSet;
};

/**
 * Type for all translations, mapping language codes to their respective TranslationSet.
 */
export type AllTranslations = {
  [lang in LanguageCode]: TranslationSet;
};

/**
 * Represents a key that can be used to look up a translation.
 */
export type TranslationKey = string;


/**
 * The actual translation strings for the application.
 * 'es' (Español) is the default language.
 */
const translationsData = {
  es: {
    "app.title": "CodeAlchemist",
    "sidebar": {
        "dashboard": "Panel de Control",
        "generateCode": "Generar Código",
        "generateProject": "Generar Proyecto",
        "refactorProject": "Refactorizar Proyecto",
        "analyzeCode": "Analizar Código",
        "analyzeProject": "Analizar Proyecto Completo",
        "autoupdate": "AutoUpdate",
        "snapshots": "Versiones Guardadas",
        "chat": "Chat con IA",
        "agents": "Agentes IA",
        "groups": "Grupos de Trabajo IA",
        "settings": "Configuración",
        "mobile": {
          "title": "Navegación Principal"
        }
    },
    "dashboard": {
        "welcome": "Bienvenido a CodeAlchemist",
        "description": "Tu plataforma de desarrollo asistido por IA, diseñada para optimizar y agilizar el ciclo de vida del desarrollo de software mediante la generación, análisis, refactorización y gestión de versiones de código.",
        "features": {
            "title": "Características Principales",
            "generateCode": {
                "title": "Generar Código",
                "description": "Crea fragmentos de código desde descripciones en lenguaje natural."
            },
            "generateProject": {
                "title": "Generar Proyecto",
                "description": "Inicia estructuras de proyecto completas a partir de especificaciones."
            },
            "refactorProject": {
                "title": "Refactorizar Proyecto",
                "description": "Analiza y refactoriza proyectos existentes con sugerencias de IA."
            },
            "analyzeCode": {
                "title": "Analizar Código",
                "description": "Obtén análisis detallados y sugerencias para fragmentos o archivos."
            },
            "analyzeProject": {
                "title": "Analizar Proyecto Completo",
                "description": "Realiza un análisis completo de un proyecto desde un archivo o Git."
            },
            "autoupdate": {
                "title": "AutoUpdate",
                "description": "Permite que CodeAlchemist analice y mejore su propio código fuente."
            },
            "snapshots": {
                "title": "Versiones Guardadas",
                "description": "Gestiona instantáneas de código generadas o del estado de la aplicación."
            },
            "chat": {
                "title": "Chat con IA",
                "description": "Interactúa con un asistente IA para consultas, ideas y más."
            },
            "agents": {
                "title": "Agentes IA",
                "description": "Crea, configura y gestiona agentes IA individuales."
            },
            "groups": {
                "title": "Grupos de Trabajo IA",
                "description": "Define y ejecuta equipos de agentes IA colaborativos."
            },
            "settings": {
                "title": "Configuración",
                "description": "Ajusta proveedores LLM, Git y otras opciones de la aplicación."
            }
        },
        "quickstart": {
            "title": "Guía Rápida de Inicio",
            "description": "Sigue estos pasos para comenzar a utilizar CodeAlchemist de manera efectiva:",
            "step1": {
                "link": "Configura tus ajustes del proveedor LLM",
                "text": " en la sección 'Configuración'."
            },
            "step2": {
                "link": "Explora la generación de código",
                "text": " con un prompt sencillo en 'Generar Código'."
            },
            "step3": {
                "link": "Prueba el análisis de un fragmento de código",
                "text": " en 'Analizar Código'."
            },
            "step4": {
                "link": "Interactúa con el Chat con IA",
                "text": " para consultas rápidas."
            },
            "step5": {
                "link": "Experimenta con AutoUpdate",
                "text": " para ver cómo CodeAlchemist se analiza a sí mismo."
            },
            "ctaButton": "Ir a Configuración"
        }
    },
    "settings": {
        "title": "Configuración General",
        "description": "Ajusta los parámetros globales de la aplicación y gestiona tu configuración.",
        "importButton": "Importar",
        "exportButton": "Exportar",
        "saveButton": "Guardar Configuración",
        "llm": {
            "title": "Configuración del Proveedor LLM",
            "description": "Ajusta la configuración global para la interacción con Modelos de Lenguaje Grandes.",
            "providerLabel": "Proveedor LLM",
            "providerPlaceholder": "Selecciona un proveedor",
            "apiUrlLabel": "URL del Endpoint de API",
            "apiUrlPlaceholder": "Ej: https://api.openai.com/v1",
            "apiUrlDescription": "Se auto-rellena al cambiar de proveedor. Modifícala si usas un proxy o un endpoint no estándar.",
            "apiKeyLabel": "Clave API",
            "apiKeyPlaceholder": "Introduce tu clave API (si es requerida)",
            "modelNameLabel": "Nombre del Modelo",
            "modelNamePlaceholder": "Selecciona un modelo",
            "modelNamePlaceholderGemini": "Selecciona o escribe un modelo (ej: gemini-1.5-pro-latest)",
            "modelNamePlaceholderLocal": "Selecciona o escribe un modelo (ej: nombre-modelo-local) ({provider})",
            "modelNamePlaceholderDefault": "Selecciona un proveedor primero",
            "modelNameDescriptionLocal": "Para {provider}, los modelos comunes se listan aquí pero también puedes escribir uno directamente si no aparece.",
            "testConnectionButton": "Probar Conexión LLM",
            "testingConnectionButton": "Probando..."
        },
        "git": {
            "title": "Configuración de Git (Opcional)",
            "description": "Configura los detalles para funcionalidades que interactúan con repositorios Git.",
            "repoUrlLabel": "URL del Repositorio Git",
            "repoUrlPlaceholder": "Ej: https://github.com/usuario/repo.git",
            "usernameLabel": "Nombre de Usuario Git",
            "emailLabel": "Email de Git",
            "patLabel": "Token de Acceso Personal (PAT)",
            "patPlaceholder": "Introduce tu PAT de Git",
            "testConnectionButton": "Probar Conexión Git",
            "testingConnectionButton": "Probando..."
        },
        "language": {
            "title": "Idioma de la Aplicación",
            "description": "Selecciona el idioma para la interfaz de usuario.",
            "selectLabel": "Idioma",
            "selectPlaceholder": "Seleccionar idioma"
        },
        "debug": {
            "title": "Modo Depuración",
            "description": "Activa un panel de logs detallados en la parte inferior de la aplicación.",
            "switchLabel": "Activar modo Debug"
        },
        "toast": {
            "saved": {
                "title": "Configuración Guardada",
                "description": "Tus ajustes han sido guardados localmente."
            },
            "llmConnectionSuccess": {
                "title": "Conexión Exitosa",
                "description": "La conexión con el proveedor LLM funciona."
            },
            "llmConnectionError": {
                "title": "Conexión Fallida",
                "description": "No se pudo conectar con el proveedor LLM. Revisa la configuración."
            },
            "gitConnectionSuccess": {
                "title": "Conexión Git Exitosa",
                "description": "La conexión con el repositorio Git funciona."
            },
            "gitConnectionError": {
                "title": "Conexión Git Fallida",
                "description": "No se pudo conectar con el repositorio Git. Revisa la URL y las credenciales."
            },
            "configExported": {
                "title": "Configuración Exportada",
                "description": "La configuración actual ha sido exportada."
            },
            "configExportError": {
                "title": "Error de Exportación",
                "description": "No se pudo exportar la configuración: {error}"
            },
            "configImported": {
                "title": "Configuración Importada",
                "description": "La configuración ha sido importada y aplicada."
            },
            "configImportError": {
                "title": "Error de Importación",
                "description": "{error}"
            },
            "languageChanged": {
                "title": "Idioma Cambiado",
                "description": "El idioma de la aplicación se ha establecido a {langName}."
            }
        }
    },
    "common": {
        "cancel": "Cancelar",
        "save": "Guardar",
        "close": "Cerrar",
        "confirm": "Confirmar",
        "delete": "Eliminar",
        "edit": "Editar",
        "test": "Testear",
        "apply": "Aplicar",
        "error": "Error",
        "loading": "Cargando...",
        "processing": "Procesando...",
        "uploading": "Subiendo...",
        "llmSourceLabel": "Usar Configuración LLM De",
        "globalSettings": "Ajustes Globales",
        "agentLabel": "Agente",
        "groupLabel": "Grupo",
        "selectPlaceholder": "Seleccionar...",
        "selectAgentPlaceholder": "Selecciona un agente",
        "selectGroupPlaceholder": "Selecciona un grupo",
        "noAgentsAvailable": "No hay agentes disponibles.",
        "noGroupsAvailable": "No hay grupos disponibles.",
        "copy": "Copiar",
        "clear": "Limpiar",
        "expand": "Expandir",
        "collapse": "Contraer"
    },
    "autoupdate": {
        "title": "AutoUpdate (Análisis del Propio Código)",
        "description": "Permite que CodeAlchemist analice su propio código fuente.",
        "config": {
            "llmSourceLabel": "Usar Configuración LLM De:",
            "codeSourceLabel": "Fuente del Código para Auto-Análisis",
            "sourceLocal": "Local (código actual de la app)",
            "sourceGit": "URL del Repositorio Git",
            "gitUrlLabel": "URL del Repositorio Git",
            "gitUrlPlaceholder": "URL HTTPS del repo CodeAlchemist",
            "analysisParamsLabel": "Parámetros de Auto-Análisis",
            "analysisPrefsLabel": "Preferencias de Análisis / Campo de Enfoque (opcional)",
            "analysisPrefsPlaceholder": "Ej: Enfocarse en optimización UI. Todas las sugerencias en castellano.",
            "startButton": "Iniciar Auto-Análisis",
            "startButtonLoading": "Analizando..."
        },
        "results": {
            "title": "Resultados del Auto-Análisis",
            "downloadSuggestionsJson": "Descargar Sugerencias (JSON)",
            "downloadProjectZip": "Descargar Código Actual (ZIP)",
            "uploadToGit": "Subir a Git",
            "noResults": "Inicia un análisis para ver los resultados.",
            "analysisTitleLabel": "Título del Análisis:",
            "generalAssessmentLabel": "Evaluación General:",
            "overallImprovementIdeasLabel": "Ideas Generales de Mejora Sugeridas por IA:",
            "detailedSuggestionsLabel": "Sugerencias Detalladas:",
            "noDetailedSuggestions": "No hay sugerencias detalladas.",
            "unifiedPromptLabel": "Prompt Unificado para Implementar Todas las Sugerencias:"
        },
        "suggestionCard": {
            "priorityLabel": "Prioridad:",
            "promptLabel": "Prompt:",
            "testInVenvButton": "Testear en Ent. Virtual",
            "saveEditButton": "Guardar Edición",
            "statusApplied": "Sugerencia Aplicada (marcada)",
            "statusDiscarded": "Sugerencia Descartada",
            "editContentLabel": "Editar Contenido Sugerido:"
        },
        "logs": {
            "groupContextLog": "Log de Contexto del Grupo de Trabajo:\n------------------------------------\nGrupo Seleccionado: {groupName}\nTarea Principal del Grupo: {groupTask}\nInput del Usuario: {userInput}\nContexto del Orquestador (usado para guiar a la IA):\n\"{orchestratorContext}...\"\n---\nNota: El flujo Genkit ({flowName}) fue ejecutado utilizando el contexto del orquestador del grupo seleccionado para guiar el proceso de la IA.",
            "analysisStarting": "Iniciando Auto-Análisis...",
            "analysisProcessingComplete": "Procesamiento del análisis de AutoUpdate completado.",
            "localCodeObtained": "Código local obtenido del servidor.",
            "analysisSuccessNonGroup": "Análisis de AutoUpdate (no-grupo) exitoso.",
            "analysisSuccessGroup": "Análisis de AutoUpdate (grupo) exitoso.",
            "suggestionMarkedApplied": "Sugerencia marcada como aplicada para {area}. (Modificación directa de archivo no es factible desde el navegador).",
            "downloadRequested": "Descarga solicitada: {format}",
            "suggestionsDownloadedJson": "Sugerencias de AutoUpdate descargadas como JSON.",
            "applyingSuggestionToZip": "Aplicando contenido de sugerencia a {fileName} para ZIP.",
            "appliedSuggestionsToZip": "Sugerencias 'applied' incorporadas conceptualmente para el ZIP.",
            "projectZipDownloaded": "Descarga de Proyecto con Sugerencias (ZIP conteniendo JSON de cambios). Este archivo ZIP ({filename}) contiene un archivo JSON que detalla los archivos que serían modificados por las sugerencias de IA y su nuevo contenido propuesto. No es un ZIP del proyecto ejecutable completo. Para 'correrlo en local' con estas mejoras, necesitarás: 1. El código fuente base de CodeAlchemist (obtenido de su repositorio Git). 2. Aplicar manualmente los cambios detallados en el JSON descargado a tu copia local del código fuente. Esta descarga te proporciona los 'diffs' o contenidos de archivo propuestos por la IA.",
            "zipGenerationFailed": "Generación de ZIP fallida: {error}",
            "gitUploadFailedConfig": "Subida a Git fallida: Configuración incompleta.",
            "commitMessageMissing": "Subida a Git fallida: Mensaje de commit requerido.",
            "initiatingGitUpload": "Iniciando subida a Git...",
            "gitUploadInProgress": "Subiendo a Git con mensaje: \"{message}\"",
            "gitUploadSuccess": "Subida a Git exitosa.",
            "gitUploadError": "Error en subida a Git: {error}",
            "gitUploadException": "Excepción durante subida a Git: {error}",
            "attemptingAutofix": "Intentando Auto-Fix para error: {error}",
            "venvSim": "Prueba simulada en entorno virtual para {area}.",
            "detailedExecutionLogsTitle": "Logs de Ejecución Detallados (AutoUpdate)",
            "analyzingWithGroup": "Analizando con grupo...",
            "waitingForGroup": "Esperando resultados del grupo..."
        },
        "analysis": {
            "fileMarker": "Archivo",
            "general": "Análisis general"
        },
        "prompts": {
            "unifiedHeader": "// --- INICIO: Prompt para mejorar el archivo: {area} ---",
            "unifiedFooter": "// --- FIN: Prompt para mejorar el archivo: {area} ---"
        },
        "toast": {
            "gettingLocalCode": {
                "title": "Obteniendo Código Local...",
                "description": "Contactando al servidor para el código fuente."
            },
            "analysisComplete": {
                "title": "Auto-Análisis Completado",
                "description": "Se han generado sugerencias para el código."
            },
            "analysisError": {
                "title": "Error de Auto-Análisis"
            },
            "noContentToApply": {
                "title": "Sin Contenido",
                "description": "Esta sugerencia no tiene contenido de archivo para aplicar."
            },
            "suggestionApplied": {
                "title": "Sugerencia Marcada como Aplicada",
                "description": "Cambios para {area} marcados. La modificación real de archivos no es posible desde el navegador."
            },
            "noSuggestionsToDownload": {
                "title": "Sin Sugerencias",
                "description": "No hay sugerencias para descargar."
            },
            "noContentToDownload": {
                "title": "Sin Contenido",
                "description": "Ninguna de las sugerencias tiene contenido de archivo para descargar."
            },
            "downloadComplete": {
                "title": "Descarga Completada",
                "suggestionsJsonDescription": "Sugerencias descargadas como {filename}.",
                "projectZipDescription": "Este archivo ZIP ({filename}) contiene un JSON con los cambios sugeridos por la IA. Para aplicar estas mejoras, necesitarás el código fuente base de CodeAlchemist (de Git) y aplicar manualmente los cambios del JSON."
            },
            "preparingProjectZip": {
                "title": "Preparando Descarga del Proyecto (ZIP)...",
                "description": "Obteniendo código del servidor..."
            },
            "projectZipDownloadInitiated": {
                "title": "Descarga de Proyecto con Sugerencias (ZIP conteniendo JSON de cambios)",
                "description": "Este archivo ZIP ({filename}) contiene un archivo JSON que detalla los archivos que serían modificados por las sugerencias de IA y su nuevo contenido propuesto. No es un ZIP del proyecto ejecutable completo. Para 'correrlo en local' con estas mejoras, necesitarás: 1. El código fuente base de CodeAlchemist (obtenido de su repositorio Git). 2. Aplicar manualmente los cambios detallados en el JSON descargado a tu copia local del código fuente. Esta descarga te proporciona los 'diffs' o contenidos de archivo propuestos por la IA."
            },
            "zipError": {
                "title": "Error al Generar ZIP"
            },
            "gitConfigIncomplete": {
                "title": "Configuración Git Incompleta",
                "description": "Completa la configuración en Ajustes antes de subir a Git."
            },
            "commitMessageRequired": {
                "title": "Mensaje de Commit Requerido"
            },
            "uploadingToGit": {
                "title": "Subiendo a Git...",
                "description": "Intentando subir a {repo}"
            },
            "gitUploadSuccess": {
                "title": "Subida a Git Exitosa"
            },
            "gitUploadError": {
                "title": "Error en Subida a Git"
            },
            "autofixSuggestion": {
                "title": "Sugerencia de Auto-Fix"
            },
            "autofixError": {
                "title": "Error en Auto-Fix"
            },
            "editSaved": {
                "title": "Edición Guardada",
                "description": "El contenido sugerido ha sido actualizado localmente."
            },
            "venvSim": {
                "title": "Simulación: Prueba en Entorno Virtual",
                "description": "Se simula el inicio de pruebas para {area}."
            }
        },
        "downloads": {
            "suggestionsJsonFilename": "autoupdate_sugerencias.json",
            "projectZipFilename": "CodeAlchemist_CodigoActual_Con_Sugerencias.zip"
        },
        "errors": {
            "getLocalSourceFailed": "No se pudo obtener el código fuente local para análisis.",
            "getLocalSourceBundleFailed": "Fallo al obtener el paquete de código fuente local",
            "analysisFailedUI": "Análisis de AutoUpdate fallido en la UI",
            "unknownAnalysisError": "Ocurrió un error desconocido durante el auto-análisis.",
            "getServerSourceFailedZip": "No se pudo obtener el código fuente del servidor para el ZIP.",
            "unknownZipError": "Error desconocido al generar ZIP.",
            "unknownGitUploadError": "Error desconocido durante la subida a Git.",
            "autofixHelperFailed": "No se pudo obtener ayuda de la IA para este error."
        },
        "dialogs": {
            "applySuggestion": {
                "title": "Aplicar Sugerencia a {area}",
                "confirmText": "Sí, Marcar como Aplicada",
                "description": {
                    "p1": "Se marcará como aplicada la sugerencia para {area}.",
                    "p2": "La modificación real del archivo no es posible desde el navegador. Revisa el contenido sugerido (o editado) y aplícalo manualmente en tu entorno de desarrollo:"
                }
            },
            "noContentToShow": "Error: No hay contenido para mostrar.",
            "testSuggestion": {
                "title": "Testear Sugerencia: {area}",
                "description": "Revisa el código sugerido o editado. La prueba real debe realizarse en tu entorno de desarrollo."
            },
            "noContentToTest": "No hay contenido para testear.",
            "testInVenv": {
                "title": "Testear Sugerencia en Entorno Virtual: {area}",
                "description": "Esta funcionalidad simularía la ejecución del código sugerido en un entorno virtual aislado (ej. Python venv, Node.js NVM). La ejecución real requiere una infraestructura local o backend.",
                "actionNote": "Acción: Se intentaría crear un entorno virtual, instalar dependencias (si se pudieran inferir) y ejecutar el código/pruebas.",
                "simulateButton": "Simular Inicio de Prueba"
            },
            "commitToGit": {
                "title": "Subir Cambios a Git",
                "confirmText": "Commit y Push",
                "placeholder": "Ej: Aplicadas sugerencias de AutoUpdate",
                "description": "Esta acción intentará realizar un commit y push al repositorio configurado. Asegúrate de que las credenciales en 'Configuración' son correctas."
            }
        },
        "autofix": {
            "errorContext": "Error a analizar: {error}\n\nContexto: Error ocurrido en la funcionalidad AutoUpdate de CodeAlchemist.",
            "focusArea": "Explica el siguiente error y propone una solución o pasos para depurarlo: \"{error}\""
        }
    },
    "refactorProject": {
        "title": "Refactorizar Proyecto",
        "description": "Analiza un proyecto para obtener sugerencias de refactorización y aplícalas.",
        "llmSourceLabel": "Usar Configuración LLM De:",
        "projectSourceLabel": "Fuente del Proyecto",
        "sourceUpload": "Subir Archivo",
        "sourceGit": "URL de Git",
        "uploadLabel": "Subir Archivo (.zip, .json, .py, .js, etc.)",
        "gitUrlLabel": "URL de Git",
        "gitUrlPlaceholder": "https://github.com/usuario/repo.git",
        "paramsLabel": "Parámetros de Refactorización",
        "goalsLabel": "Metas (opcional)",
        "goalsPlaceholder": "Ej: Mejorar rendimiento UI, simplificar lógica X...",
        "priorityLabel": "Prioridad General (opcional)",
        "priorityPlaceholder": "Seleccionar prioridad...",
        "priorityNone": "Ninguna",
        "depthLabel": "Profundidad de Búsqueda (opcional)",
        "depthPlaceholder": "Ej: 3 (niveles)",
        "focusLabel": "Campo de Enfoque del Análisis (opcional)",
        "focusPlaceholder": "Ej: Seguridad, UI, Módulo de pagos",
        "analyzeButton": "Analizar para Refactorizar",
        "results": {
            "title": "Resultados y Sugerencias",
            "applyAllButton": "Marcar Todas como Aplicadas",
            "noSuggestions": "Aún no hay sugerencias. Realiza un análisis para comenzar.",
            "projectSummaryCard": {
                "title": "Resumen del Proyecto",
                "noSummary": "No se proporcionó un resumen del proyecto."
            },
            "suggestionsTitle": "Sugerencias de Refactorización:",
            "noSpecificSuggestions": "No se generaron sugerencias específicas de refactorización."
        },
        "suggestion": {
            "priorityLabel": "Prioridad:",
            "snippetLabel": "Snippet Sugerido:",
            "snippetOriginal": "Original:",
            "snippetModified": "Modificado:",
            "viewDiffButton": "Ver Diff",
            "discardButton": "Descartar",
            "applyButton": "Marcar como Aplicada",
            "revertStateButton": "Revertir Estado"
        },
        "diffModal": {
            "title": "Comparación de Código (Diff)",
            "originalLabel": "Original:",
            "suggestedLabel": "Sugerido:",
            "noContent": "N/A"
        },
        "logs": {
            "groupContextLog": "Log de Contexto del Grupo de Trabajo:\n------------------------------------\nGrupo Seleccionado: {groupName}\nTarea Principal del Grupo: {groupTask}\nInput del Usuario: {userInput}\nContexto del Orquestador (usado para guiar a la IA):\n\"{orchestratorContext}...\"\n---\nNota: El flujo Genkit ({flowName}) fue ejecutado utilizando el contexto del orquestador del grupo seleccionado para guiar el proceso de la IA.",
            "groupLogTitle": "Log de Ejecución del Grupo"
        },
        "toast": {
            "invalidFile": {
                "title": "Archivo Inválido",
                "description": "Tipo de archivo no admitido o tamaño excede 10MB."
            },
            "sourceRequired": {
                "title": "Fuente del Proyecto Requerida",
                "description": "Sube un archivo o proporciona una URL de Git."
            },
            "analysisComplete": {
                "title": "Análisis Completado",
                "description": "Sugerencias de refactorización generadas."
            },
            "analysisError": {
                "title": "Error de Análisis"
            },
            "suggestionApplied": {
                "title": "Sugerencia Marcada como Aplicada",
                "description": "La sugerencia para \"{area}\" ha sido marcada. Recuerda aplicar los cambios manualmente en tu código si es necesario."
            },
            "noDiff": {
                "title": "Sin Diff Disponible",
                "description": "Esta sugerencia no tiene un snippet de código para comparar."
            },
            "suggestionDiscarded": {
                "title": "Sugerencia Descartada"
            },
            "allApplied": {
                "title": "Todas Marcadas como Aplicadas",
                "description": "Todas las sugerencias pendientes han sido marcadas. Aplica los cambios manualmente."
            }
        }
    },
    "analyzeProject": {
        "title": "Análisis de Proyecto Completo",
        "description": "Realiza un análisis holístico de un proyecto entero, subido o desde Git.",
        "llmSourceLabel": "Usar Configuración LLM De:",
        "projectSourceLabel": "Fuente del Proyecto",
        "sourceUpload": "Subir Archivo (ZIP/JSON)",
        "sourceGit": "URL de Git",
        "uploadLabel": "Subir Archivo (.zip, .json)",
        "gitUrlLabel": "URL de Git",
        "gitUrlPlaceholder": "https://github.com/usuario/repo.git",
        "paramsLabel": "Parámetros de Análisis",
        "depthLabel": "Profundidad de Búsqueda (opcional)",
        "depthPlaceholder": "Ej: 3 (niveles)",
        "focusLabel": "Campo de Enfoque del Análisis (opcional)",
        "focusPlaceholder": "Ej: Rendimiento, Seguridad de API",
        "analyzeButton": "Analizar Proyecto",
        "results": {
            "analyzing": "Analizando proyecto...",
            "noResults": "Aún no hay resultados. Realiza un análisis para comenzar.",
            "overallAssessmentLabel": "Evaluación General:",
            "improvementIdeasLabel": "Ideas Generales de Mejora:",
            "identifiedAreasLabel": "Áreas Identificadas:",
            "specificSuggestionsLabel": "Sugerencias Específicas:",
            "suggestionPriorityLabel": "Prioridad:",
            "suggestedPromptLabel": "Prompt Sugerido:",
            "groupLogTitle": "Log Detallado del Análisis",
            "groupContextLog": "Log de Contexto del Grupo de Trabajo:\n------------------------------------\nGrupo Seleccionado: {groupName}\nTarea Principal del Grupo: {groupTask}\nInput del Usuario: {userInput}\nContexto del Orquestador (usado para guiar a la IA):\n\"{orchestratorContext}...\"\n---\nNota: El flujo Genkit ({flowName}) fue ejecutado utilizando el contexto del orquestador del grupo seleccionado para guiar el proceso de la IA."
        },
        "toast": {
            "invalidFile": {
                "title": "Archivo Inválido",
                "description": "Sube un archivo .zip o .json de menos de 25MB."
            },
            "readError": {
                "title": "Error de Lectura",
                "description": "No se pudo leer el archivo."
            },
            "unsupportedFileType": {
                "title": "Tipo de Archivo no Soportado",
                "description": "El análisis de este tipo de archivo no está completamente implementado."
            },
            "sourceRequired": {
                "title": "Fuente del Proyecto Requerida",
                "description": "Sube un archivo o proporciona una URL de Git."
            },
            "analysisComplete": {
                "title": "Análisis Completado",
                "description": "El proyecto ha sido analizado."
            },
            "analysisError": {
                "title": "Error de Análisis"
            }
        }
    },
    "generateCode": {
      "title": "Generar Código",
      "description": "Crea fragmentos de código a partir de descripciones en lenguaje natural.",
      "describeNeedLabel": "Describe tu necesidad",
      "describeNeedPlaceholder": "Ej: Una función en Python que sume dos números y maneje errores de tipo.",
      "generateButton": "Generar Código",
      "results": {
        "explanationLabel": "Explicación:",
        "codeSnippetLabel": "Fragmento de Código:",
        "groupLogTitle": "Log Detallado del Grupo"
      },
      "logs": {
        "groupContextLog": "Log de Contexto del Grupo de Trabajo:\n------------------------------------\nGrupo Seleccionado: {groupName}\nTarea Principal del Grupo: {groupTask}\nInput del Usuario: {userInput}\nContexto del Orquestador (usado para guiar a la IA):\n\"{orchestratorContext}...\"\n---\nNota: El flujo Genkit ({flowName}) fue ejecutado utilizando el contexto del orquestador del grupo seleccionado para guiar el proceso de la IA."
      },
      "confirmDialog": {
        "title": "Confirmar Generación de Código",
        "llmSourceLabel": "Fuente LLM:",
        "promptLabel": "Prompt:"
      },
      "toast": {
        "descriptionEmpty": {
            "title": "Descripción Vacía",
            "description": "Por favor, describe tu necesidad."
        },
        "codeGenerated": {
            "title": "Código Generado",
            "description": "El fragmento de código ha sido generado exitosamente."
        },
        "generationError": {
            "title": "Error de Generación"
        },
        "autofixSimulated": {
            "title": "Auto-Fix (Simulado)",
            "description": "La IA está analizando el error para proponer una solución."
        }
      }
    },
    "generateProject": {
      "title": "Generar Proyecto",
      "description": "Crea una estructura base para nuevos proyectos a partir de tus especificaciones.",
      "describeProjectLabel": "Describe tu proyecto",
      "describeProjectPlaceholder": "Ej: Un API REST con Node.js y Express, con rutas para usuarios y productos, y una base de datos PostgreSQL.",
      "generateButton": "Generar Proyecto",
      "results": {
        "suggestedNameLabel": "Nombre Sugerido:",
        "aiNotesLabel": "Notas de la IA:",
        "generatedFilesLabel": "Archivos Generados:",
        "downloadButton": "Descargar Proyecto (ZIP)",
        "downloadNote": "Nota: La descarga será un archivo JSON con la estructura del proyecto.",
        "groupLogTitle": "Log Detallado del Grupo",
        "groupContextLog": "Log de Contexto del Grupo de Trabajo:\n------------------------------------\nGrupo Seleccionado: {groupName}\nTarea Principal del Grupo: {groupTask}\nInput del Usuario: {userInput}\nContexto del Orquestador (usado para guiar a la IA):\n\"{orchestratorContext}...\"\n---\nNota: El flujo Genkit ({flowName}) fue ejecutado utilizando el contexto del orquestador del grupo seleccionado para guiar el proceso de la IA."
      },
      "confirmDialog": {
        "title": "Confirmar Generación de Proyecto",
        "currentPromptLabel": "Prompt Actual:",
        "redefinePromptLabel": "Redefinir Prompt (opcional):",
        "llmConfigInfo": "Configuración LLM a usar:",
        "confirmButton": "Sí, Generar Proyecto"
      },
      "toast": {
        "descriptionEmpty": {
            "title": "Descripción Vacía",
            "description": "Por favor, describe tu proyecto."
        },
        "projectGenerated": {
            "title": "Proyecto Generado",
            "description": "La estructura base del proyecto \"{projectName}\" ha sido generada."
        },
        "generationError": {
            "title": "Error de Generación"
        },
        "downloadError": {
            "title": "Sin Resultados",
            "description": "No hay estructura de proyecto para descargar."
        },
        "downloadSuccess": { // For JSON download
            "title": "Estructura Descargada (JSON)",
            "description": "Se ha descargado un archivo JSON con la estructura y contenido del proyecto \"{projectName}\". Puedes usar este archivo para crear los archivos y carpetas manualmente o con un script."
        },
        "zipDownloadSuccess": { // For actual ZIP download
            "title": "Proyecto Descargado (ZIP)",
            "description": "Se ha descargado un archivo ZIP con la estructura y contenido del proyecto \"{projectName}\"."
        },
        "zipDownloadError": {
            "title": "Error de Descarga ZIP",
            "description": "No se pudo generar el archivo ZIP: {error}"
        },
         "autofixSimulated": {
            "title": "Auto-Fix (Simulado)",
            "description": "La IA está analizando el error para proponer una solución."
        }
      }
    },
    "analyzeCode": {
      "title": "Analizar Código",
      "description": "Obtén análisis detallados y sugerencias de mejora para fragmentos o archivos de código.",
      "codeSourceLabel": "Fuente del Código:",
      "uploadFileLabel": "Subir un archivo de código (opcional)",
      "gitFileUrlLabel": "URL de Archivo Git (opcional, raw content)",
      "gitFileUrlPlaceholder": "Ej: https://raw.githubusercontent.com/...",
      "fetchUrlButton": "Obtener",
      "pasteCodeInstruction": "O pega el código abajo",
      "pasteCodePlaceholder": "Pega tu código aquí para analizarlo...",
      "additionalInstructionsLabel": "Instrucciones Adicionales para el Análisis (opcional)",
      "additionalInstructionsPlaceholder": "Ej: Enfócate en la seguridad, o sugiere alternativas más performantes.",
      "analyzeButton": "Analizar Código",
      "results": {
        "explanationLabel": "Explicación:",
        "originalCodeLabel": "Código Original:",
        "suggestedCodeLabel": "Código Sugerido:",
        "saveOriginalButton": "Guardar Original",
        "saveSuggestedButton": "Guardar Sugerido"
      },
      "toast": {
        "invalidFile": {
            "title": "Archivo Inválido",
            "description": "Sube un archivo de texto de menos de 5MB."
        },
        "emptyUrl": {
            "title": "URL Vacía",
            "description": "Introduce una URL de archivo Git."
        },
        "fetchError": {
            "title": "Error de Obtención"
        },
        "codeFetched": {
            "title": "Código Obtenido",
            "description": "Contenido de la URL cargado."
        },
        "emptyCode": {
            "title": "Código Vacío",
            "description": "Introduce o carga código para analizar."
        },
        "analysisComplete": {
            "title": "Análisis Completado",
            "description": "El código ha sido analizado."
        },
        "analysisError": {
            "title": "Error de Análisis"
        },
        "snapshotError": {
            "title": "Error",
            "description": "No hay código {type} para guardar."
        },
        "autofixSimulated": {
            "title": "Auto-Fix (Simulado)",
            "description": "La IA está analizando el error para proponer una solución."
        }
      }
    },
    "errorDisplay": {
      "title": "Error Detectado",
      "copyButton": "Copiar Error",
      "autofixButton": "Auto-Fix con IA",
      "autofixingButton": "Analizando...",
      "toast": {
        "copied": {
            "title": "Error Copiado",
            "description": "El mensaje de error ha sido copiado al portapapeles."
        },
        "autofixAttempt": {
            "title": "Intentando Auto-Corrección",
            "description": "Consultando al 'EquipoDesarrolloSoftware' para una posible solución..."
        },
        "autofixSuggestionReceived": {
            "title": "Sugerencia de Auto-Corrección Recibida",
            "description": "'EquipoDesarrolloSoftware' ha proporcionado una sugerencia."
        },
        "autofixError": {
            "title": "Error en Auto-Corrección"
        }
      },
      "autofixModal": {
        "title": "Sugerencia de Auto-Corrección del Equipo de Software",
        "description": "El grupo 'EquipoDesarrolloSoftware' ha analizado el error y propone lo siguiente:",
        "originalErrorLabel": "Mensaje de Error Original:",
        "diagnosisLabel": "Diagnóstico del Grupo:",
        "solutionLabel": "Solución Sugerida:",
        "invocationLogLabel": "Log de Invocación del Grupo (para depuración)"
      }
    },
     "versions": {
        "title": "Versiones Guardadas (Snapshots)",
        "description": "Gestiona instantáneas de código generadas o del estado de la aplicación.",
        "saveAppStateButton": "Guardar Estado de App (JSON)",
        "saveAppStateDescription": "Guarda la configuración actual, agentes y grupos como un snapshot JSON.",
        "saveAndDownloadStateButton": "Guardar Estado y Descargar como ZIP",
        "saveAndDownloadStateDescription": "Guarda el estado actual de la aplicación y lo descarga como un archivo .zip (conteniendo el JSON del estado).",
        "compareButton": "Comparar A y B",
        "compareButtonDisabledTooltip": "Selecciona dos versiones (A y B) para comparar.",
        "deleteAllButton": "Eliminar Todas",
        "table": {
            "colA": "A",
            "colB": "B",
            "colName": "Nombre",
            "colCreatedAt": "Fecha de Creación",
            "colSource": "Origen",
            "colActions": "Acciones",
            "noVersions": "No hay versiones guardadas."
        },
        "action": {
            "view": "Ver",
            "downloadOriginal": "Descargar como {format}",
            "downloadZip": "Descargar como ZIP",
            "delete": "Eliminar",
            "selectA": "Seleccionar para A",
            "selectB": "Seleccionar para B"
        },
        "source": {
            "original": "Original (Análisis)",
            "suggested": "Sugerido (Análisis)",
            "codealchemist-app-state": "Estado App",
            "codealchemist-current": "Código Actual (AutoUpdate)",
            "unknown": "Desconocido"
        },
        "viewModal": {
            "title": "Viendo Snapshot: {name}",
            "noCode": "Error: Sin código para mostrar."
        },
        "compareModal": {
            "title": "Comparar Versiones (A vs B)",
            "versionA": "Versión A: {name}",
            "versionB": "Versión B: {name}",
            "noDiffLib": "La comparación visual detallada (diff) no está implementada. Se muestran los contenidos lado a lado."
        },
        "deleteAllModal": {
            "title": "Confirmar Eliminación Total",
            "description": "¿Estás seguro de que quieres eliminar TODOS los snapshots guardados? Esta acción no se puede deshacer.",
            "confirm": "Sí, Eliminar Todos"
        },
        "deleteSingleModal": {
            "title": "Confirmar Eliminación: {name}",
            "description": "¿Estás seguro de que quieres eliminar este snapshot? Esta acción no se puede deshacer.",
            "confirm": "Sí, Eliminar"
        },
        "toast": {
            "appStateSaved": {
                "title": "Estado de Aplicación Guardado",
                "description": "El estado actual de la aplicación \"{name}\" ha sido guardado."
            },
            "appStateSavedAndDownloaded": {
                "title": "Estado de Aplicación Guardado y Descargado",
                "description": "El estado actual \"{name}\" ha sido guardado y descargado como {filename}."
            },
            "snapshotSaved": {
                "title": "Snapshot Guardado",
                "description": "Snapshot \"{name}\" creado."
            },
            "snapshotDownloaded": {
                "title": "Snapshot Descargado",
                "description": "Snapshot \"{name}\" descargado como {filename}."
            },
            "snapshotDeleted": {
                "title": "Snapshot Eliminado",
                "description": "Snapshot \"{name}\" eliminado."
            },
            "compareError": {
                "notFound": "No se encontraron los snapshots seleccionados.",
                "selectionIncomplete": "Selecciona dos versiones (A y B) para comparar."
            },
            "allSnapshotsDeleted": {
                 "title": "Todos los Snapshots Eliminados",
                 "description": "Todas las versiones guardadas han sido eliminadas."
            }
        }
    },
    "chat": {
        "title": "Chat con IA",
        "description": "Interactúa con un asistente IA para consultas, ideas y más.",
        "inputPlaceholder": "Escribe tu mensaje aquí...",
        "sendButton": "Enviar",
        "clearButton": "Borrar Chat",
        "thinking": "Pensando...",
        "systemMessage": {
            "errorPrefix": "Error: ",
            "autofixErrorPrefix": "Error durante el Auto-Fix: "
        },
        "agent": {
            "assistant": "Asistente IA",
            "user": "Usuario",
            "system": "Sistema"
        },
        "toast": {
            "chatCleared": {
                "title": "Chat Limpiado",
                "description": "El historial de la conversación ha sido borrado."
            },
            "chatError": {
                "title": "Error de Chat"
            },
            "autofixError": {
                "title": "Error en Auto-Fix"
            }
        },
        "autofix": {
            "userRequest": "Por favor, analiza este error y sugiere una solución: {errorMsg}"
        }
    },
    "agents": {
        "title": "Gestión de Agentes IA",
        "description": "Crea, configura, prueba y gestiona agentes IA individuales.",
        "createWithAIButton": "Crear con IA",
        "importButton": "Importar",
        "exportAllButton": "Exportar Todos",
        "createAgentButton": "Crear Agente",
        "noAgentsMessage": "No hay agentes creados. ¡Crea uno para empezar!",
        "defaultAgentBadge": "(Por Defecto)",
        "llmLabel": "LLM:",
        "llmGlobalFormat": "Global ({provider})",
        "llmCustomFormat": "Personalizado ({provider})",
        "llmNotApplicable": "N/A",
        "capabilitiesLabel": "Capacidades:",
        "noCapabilities": "Ninguna",
        "action": {
            "test": "Probar Agente",
            "export": "Exportar Agente",
            "edit": "Editar Agente",
            "delete": "Eliminar Agente"
        },
        "toast": {
            "form": {
                "nameUneditableError": {
                    "title": "Error",
                    "description": "El nombre del agente \"{name}\" no puede ser editado."
                },
                "deleteError": {
                    "title": "Error",
                    "description": "El agente \"{name}\" no se puede eliminar."
                }
            },
            "import": {
                "success": {
                    "title": "Agentes Importados",
                    "description": "{count} agentes importados y/o actualizados."
                },
                "invalidFormat": "Formato JSON inválido para agentes.",
                "error": {
                    "title": "Error de Importación"
                }
            },
            "exportAll": {
                "success": {
                    "title": "Agentes Exportados",
                    "description": "Todos los agentes han sido exportados."
                }
            },
            "exportSingle": {
                "success": {
                    "title": "Agente Exportado",
                    "description": "Agente \"{name}\" exportado."
                }
            },
            "suggestion": {
                "roleRequired": {
                    "title": "Descripción Requerida",
                    "description": "Por favor, describe el rol del agente."
                },
                "received": {
                    "title": "Sugerencia Recibida",
                    "description": "La IA ha sugerido una definición para el agente {name}."
                },
                "error": {
                    "title": "Error de Sugerencia",
                    "description": "No se pudo obtener la sugerencia."
                }
            },
            "created": {
                "title": "Agente Creado",
                "description": "Agente \"{name}\" añadido."
            },
            "updated": {
                "title": "Agente Actualizado",
                "description": "Agente \"{name}\" guardado."
            },
            "deleted": {
                "title": "Agente Eliminado",
                "description": "Agente \"{name}\" eliminado."
            }
        },
        "form": {
            "title": {
                "edit": "Editar Agente",
                "create": "Crear Nuevo Agente",
                "reviewSuggestion": "Revisar Sugerencia de Agente"
            },
            "description": {
                "edit": "Modifica los detalles del agente \"{name}\".",
                "create": "Define un nuevo agente especializado para tus tareas de IA."
            },
            "label": {
                "name": "Nombre",
                "description": "Descripción",
                "systemPrompt": "Mensaje de Sistema (Prompt)",
                "capabilities": "Capacidades del Agente",
                "llmConfig": "Configuración LLM del Agente"
            },
            "placeholder": {
                "systemPrompt": "Define el rol, comportamiento y directrices del agente..."
            },
            "capability": {
                "accessOwnCode": "Acceso a Código Propio",
                "execution": "Capacidad de Ejecución",
                "virtualEnv": "Capacidad de Entorno Virtual",
                "readWrite": "Capacidad Lectura/Escritura",
                "dangerousTooltip": "(Peligroso)"
            },
            "llm": {
                "useGlobal": "Usar Configuración Global",
                "custom": {
                    "providerLabel": "Proveedor LLM",
                    "modelLabel": "Modelo",
                    "modelPlaceholder": {
                        "gemini": "Ej: gemini-1.5-pro-latest",
                        "selectProvider": "Selecciona proveedor",
                        "default": "Selecciona modelo"
                    },
                    "geminiModelDescription": "Modelos comunes listados. Puedes escribir otro si es necesario.",
                    "apiUrlLabel": "URL API (Opcional)",
                    "apiUrlPlaceholder": "Se auto-rellena al cambiar proveedor",
                    "apiUrlDescription": "Modifícala si usas un proxy o un endpoint no estándar.",
                    "apiKeyLabel": "Clave API (Opcional)",
                    "apiKeyPlaceholder": "Usar global si está vacía"
                }
            },
            "button": {
                "saveChanges": "Guardar Cambios",
                "createAgent": "Crear Agente"
            },
            "toast": {
                "nameRequired": {
                    "title": "Nombre Requerido",
                    "description": "El agente debe tener un nombre."
                }
            }
        },
        "suggestionDialog": {
            "title": "Sugerir Definición de Agente con IA",
            "description": "Describe el rol o la tarea principal del agente que necesitas, y la IA sugerirá una definición.",
            "textareaLabel": "Descripción del Rol del Agente",
            "textareaPlaceholder": "Ej: Un agente que resume textos largos en puntos clave.",
            "submitButton": "Obtener Sugerencia"
        },
        "testChatDialog": {
            "title": "Probando Agente: {name}",
            "description": "Interactúa directamente con el agente. Su prompt de sistema se muestra abajo.",
            "systemMessage": "Estás probando el agente: {name}.\n--- Inicio del Prompt de Sistema del Agente ---\n{systemPrompt}\n--- Fin del Prompt de Sistema del Agente ---",
            "inputPlaceholder": "Escribe tu mensaje al agente...",
            "sendButton": "Enviar",
            "thinking": "Agente está pensando...",
            "errorPrefix": "Error: "
        }
    },
    "groups": {
        "title": "Gestión de Grupos de Trabajo IA",
        "description": "Define y ejecuta equipos de agentes IA colaborativos.",
        "createWithAIButton": "Crear con IA",
        "createGroupButton": "Crear Grupo",
        "noGroupsMessage": "No hay grupos de trabajo creados.",
        "defaultGroupBadge": "(Por Defecto)",
        "agentsLabel": "Agentes:",
        "agentsCountFormat": "{count} (+ Orquestador)",
        "taskLabel": "Tarea:",
        "action": {
            "execute": "Ejecutar Grupo",
            "edit": "Editar Grupo",
            "delete": "Eliminar Grupo"
        },
        "form": {
            "title": {
                "edit": "Editar Grupo de Trabajo",
                "create": "Crear Nuevo Grupo de Trabajo",
                "reviewSuggestion": "Revisar Sugerencia de Grupo"
            },
            "label": {
                "name": "Nombre",
                "description": "Descripción",
                "mainTask": "Tarea Principal del Grupo",
                "selectAgents": "Seleccionar Agentes Participantes"
            },
            "placeholder": {
                "mainTask": "Describe el objetivo general que el grupo debe alcanzar..."
            },
            "orchestratorImplicitNote": "OrquestadorFlujoAgentes se añade implícitamente.",
            "noAgentsToSelectError": "No hay otros agentes disponibles para seleccionar. Crea agentes primero.",
            "button": {
                "saveChanges": "Guardar Cambios",
                "createGroupWithSuggestion": "Crear Grupo con Sugerencia",
                "createGroup": "Crear Grupo"
            },
            "toast": {
                "fieldsRequired": {
                    "title": "Campos Requeridos",
                    "description": "El nombre y la tarea principal son obligatorios."
                },
                "agentsRequired": {
                    "title": "Agentes Requeridos",
                    "description": "Selecciona al menos un agente participante (además del Orquestador)."
                }
            }
        },
        "toast": {
            "created": {
                "title": "Grupo Creado",
                "description": "Grupo \"{name}\" añadido."
            },
            "updated": {
                "title": "Grupo Actualizado",
                "description": "Grupo \"{name}\" guardado."
            },
            "deleted": {
                "title": "Grupo Eliminado",
                "description": "Grupo \"{name}\" eliminado."
            },
            "suggestion": {
                "taskRequired": {
                    "title": "Descripción Requerida",
                    "description": "Por favor, describe la tarea del grupo."
                },
                "received": {
                    "title": "Sugerencia Recibida",
                    "description": "La IA ha sugerido una definición para el grupo {name}."
                },
                "error": {
                    "title": "Error de Sugerencia"
                }
            },
            "execution": {
                "orchestratorNotFound": "Agente Orquestador no encontrado.",
                "orchestratorError": "Error de Orquestador",
                "groupError": "Error de Grupo",
                "generalError": "Error de Ejecución",
                "maxTurnsReached": "Se alcanzó el límite de turnos ({maxTurns}). Ejecución detenida.",
                "stoppedOrFinished": "Ejecución del grupo finalizada o detenida."
            }
        },
        "suggestionDialog": {
            "title": "Sugerir Definición de Grupo con IA",
            "description": "Describe la tarea o el objetivo principal del grupo, y la IA sugerirá una definición y agentes relevantes.",
            "textareaLabel": "Descripción de la Tarea del Grupo",
            "textareaPlaceholder": "Ej: Desarrollar un nuevo módulo de e-commerce para la aplicación.",
            "submitButton": "Obtener Sugerencia",
            "submitButtonDisabled": "Crea Agentes Primero",
            "noAgentsWarning": "Crea agentes primero para poder obtener sugerencias de grupos."
        },
        "executionModal": {
            "title": "Ejecución del Grupo: {name}",
            "mainTaskLabel": "Tarea Principal:",
            "logTitle": "Log de Ejecución Detallado",
            "stopButton": "Detener Ejecución"
        },
        "execution": {
            "starting": "Iniciando ejecución del grupo: {name}...\nTarea Principal: {mainTask}",
            "taskPrefix": "Tarea Principal: ",
            "criticalError": {
                "orchestratorNotFound": "Agente Orquestador ('orquestador-flujo-agentes') no encontrado. No se puede ejecutar el grupo.",
                "orchestratorParse": "Error al parsear la respuesta JSON del Orquestador.",
                "orchestratorIncomplete": "Respuesta del Orquestador incompleta (faltan next_agent_id o instruction_for_next_agent).",
                "agentNotFound": "Agente con ID \"{id}\" no encontrado."
            },
            "log": {
                "turnPrefix": "--- Turno {turn} ---",
                "orchestratorReceiving": "Orquestador recibiendo: \"{input}...\"",
                "orchestratorRawResponse": "Orquestador (raw JSON): {response}",
                "orchestratorDecision": "Decisión del Orquestador: Siguiente Agente: {nextAgentId}. Instrucción: \"{instruction}...\". Razón: \"{reasoning}\"",
                "taskCompleted": "--- Tarea Completada --- \nResultado Final del Grupo: {result}",
                "callingAgent": "Llamando a Agente: {name}...",
                "agentResponse": "Respuesta de {name}: \"{response}...\"",
                "errorInTurn": "Error en Turno {turn}: {errorMessage}",
                "maxTurnsReached": "\nSe alcanzó el número máximo de turnos ({maxTurns}). Ejecución detenida.",
                "executionStoppedOrFinished": "\nEjecución del grupo finalizada o detenida.",
                "userStopped": "Turno {turn}: Ejecución cancelada por el usuario."
            }
        }
    },
    "appLayout": {
        "debugPanel": {
            "title": "Panel de Depuración",
            "copyButton": "Copiar Logs",
            "clearButton": "Borrar Logs",
            "collapseButton": "Contraer",
            "expandButton": "Expandir",
            "noLogs": "No hay logs."
        },
        "toast": {
            "unexpectedError": {
                "title": "Error Inesperado",
                "description": "Ocurrió un error inesperado en la aplicación. Ya estamos trabajando en ello."
            }
        }
    },
    "fileTree": {
        "isFolder": "Esto es una carpeta.",
        "emptyFile": "Archivo vacío o contenido no visualizable aquí."
    },
    "codeEditor": {
        "toast": {
            "loadError": {
                "title": "Error de Carga",
                "description": "No se pudo cargar el estado guardado del editor para {id}."
            }
        }
    }
  },
  en: {
    "app.title": "CodeAlchemist",
    "sidebar": {
        "dashboard": "Dashboard",
        "generateCode": "Generate Code",
        "generateProject": "Generate Project",
        "refactorProject": "Refactor Project",
        "analyzeCode": "Analyze Code",
        "analyzeProject": "Analyze Full Project",
        "autoupdate": "AutoUpdate",
        "snapshots": "Saved Versions",
        "chat": "AI Chat",
        "agents": "AI Agents",
        "groups": "AI Workgroups",
        "settings": "Settings",
        "mobile": {
          "title": "Main Navigation"
        }
    },
    "dashboard": {
        "welcome": "Welcome to CodeAlchemist",
        "description": "Your AI-assisted development platform, designed to optimize and streamline the software development lifecycle through code generation, analysis, refactoring, and version management.",
        "features": {
            "title": "Main Features",
            "generateCode": {
                "title": "Generate Code",
                "description": "Create code snippets from natural language descriptions."
            },
            "generateProject": {
                "title": "Generate Project",
                "description": "Initiate complete project structures from specifications."
            },
            "refactorProject": {
                "title": "Refactor Project",
                "description": "Analyze and refactor existing projects with AI suggestions."
            },
            "analyzeCode": {
                "title": "Analyze Code",
                "description": "Get detailed analysis and suggestions for code snippets or files."
            },
            "analyzeProject": {
                "title": "Analyze Full Project",
                "description": "Perform a complete analysis of a project from a file or Git."
            },
            "autoupdate": {
                "title": "AutoUpdate",
                "description": "Allow CodeAlchemist to analyze and improve its own source code."
            },
            "snapshots": {
                "title": "Saved Versions",
                "description": "Manage generated code snapshots or application state."
            },
            "chat": {
                "title": "AI Chat",
                "description": "Interact with an AI assistant for queries, ideas, and more."
            },
            "agents": {
                "title": "AI Agents",
                "description": "Create, configure, and manage individual AI agents."
            },
            "groups": {
                "title": "AI Workgroups",
                "description": "Define and execute collaborative AI agent teams."
            },
            "settings": {
                "title": "Settings",
                "description": "Adjust LLM providers, Git, and other application options."
            }
        },
        "quickstart": {
            "title": "Quick Start Guide",
            "description": "Follow these steps to start using CodeAlchemist effectively:",
            "step1": {
                "link": "Configure your LLM provider settings",
                "text": " in the 'Settings' section."
            },
            "step2": {
                "link": "Explore code generation",
                "text": " with a simple prompt in 'Generate Code'."
            },
            "step3": {
                "link": "Try analyzing a code snippet",
                "text": " in 'Analyze Code'."
            },
            "step4": {
                "link": "Interact with the AI Chat",
                "text": " for quick queries."
            },
            "step5": {
                "link": "Experiment with AutoUpdate",
                "text": " to see CodeAlchemist analyze itself."
            },
            "ctaButton": "Go to Settings"
        }
    },
    "settings": {
        "title": "General Settings",
        "description": "Adjust global application parameters and manage your configuration.",
        "importButton": "Import",
        "exportButton": "Export",
        "saveButton": "Save Configuration",
        "llm": {
            "title": "LLM Provider Settings",
            "description": "Adjust global settings for interaction with Large Language Models.",
            "providerLabel": "LLM Provider",
            "providerPlaceholder": "Select a provider",
            "apiUrlLabel": "API Endpoint URL",
            "apiUrlPlaceholder": "E.g.: https://api.openai.com/v1",
            "apiUrlDescription": "Auto-fills when changing provider. Modify if using a proxy or non-standard endpoint.",
            "apiKeyLabel": "API Key",
            "apiKeyPlaceholder": "Enter your API key (if required)",
            "modelNameLabel": "Model Name",
            "modelNamePlaceholder": "Select a model",
            "modelNamePlaceholderGemini": "Select or type a model (e.g: gemini-1.5-pro-latest)",
            "modelNamePlaceholderLocal": "Select or type a model (e.g: local-model-name) ({provider})",
            "modelNamePlaceholderDefault": "Select a provider first",
            "modelNameDescriptionLocal": "For {provider}, common models are listed, but you can also type one directly if it doesn't appear.",
            "testConnectionButton": "Test LLM Connection",
            "testingConnectionButton": "Testing..."
        },
        "git": {
            "title": "Git Settings (Optional)",
            "description": "Configure details for features interacting with Git repositories.",
            "repoUrlLabel": "Git Repository URL",
            "repoUrlPlaceholder": "E.g.: https://github.com/user/repo.git",
            "usernameLabel": "Git Username",
            "emailLabel": "Git Email",
            "patLabel": "Personal Access Token (PAT)",
            "patPlaceholder": "Enter your Git PAT",
            "testConnectionButton": "Test Git Connection",
            "testingConnectionButton": "Testing..."
        },
        "language": {
            "title": "Application Language",
            "description": "Select the language for the user interface.",
            "selectLabel": "Language",
            "selectPlaceholder": "Select language"
        },
        "debug": {
            "title": "Debug Mode",
            "description": "Activates a detailed log panel at the bottom of the application.",
            "switchLabel": "Enable Debug mode"
        },
        "toast": {
            "saved": {
                "title": "Settings Saved",
                "description": "Your settings have been saved locally."
            },
            "llmConnectionSuccess": {
                "title": "Connection Successful",
                "description": "The connection with the LLM provider works."
            },
            "llmConnectionError": {
                "title": "Connection Failed",
                "description": "Could not connect to the LLM provider. Check your settings."
            },
            "gitConnectionSuccess": {
                "title": "Git Connection Successful",
                "description": "The connection with the Git repository works."
            },
            "gitConnectionError": {
                "title": "Git Connection Failed",
                "description": "Could not connect to the Git repository. Check URL and credentials."
            },
            "configExported": {
                "title": "Configuration Exported",
                "description": "Current configuration has been exported."
            },
            "configExportError": {
                "title": "Export Error",
                "description": "Could not export configuration: {error}"
            },
            "configImported": {
                "title": "Configuration Imported",
                "description": "Configuration has been imported and applied."
            },
            "configImportError": {
                "title": "Import Error",
                "description": "{error}"
            },
             "languageChanged": {
                "title": "Language Changed",
                "description": "Application language has been set to {langName}."
            }
        }
    },
    "common": {
        "cancel": "Cancel",
        "save": "Save",
        "close": "Close",
        "confirm": "Confirm",
        "delete": "Delete",
        "edit": "Edit",
        "test": "Test",
        "apply": "Apply",
        "error": "Error",
        "loading": "Loading...",
        "processing": "Processing...",
        "uploading": "Uploading...",
        "llmSourceLabel": "Use LLM Configuration From",
        "globalSettings": "Global Settings",
        "agentLabel": "Agent",
        "groupLabel": "Group",
        "selectPlaceholder": "Select...",
        "selectAgentPlaceholder": "Select an agent",
        "selectGroupPlaceholder": "Select a group",
        "noAgentsAvailable": "No agents available.",
        "noGroupsAvailable": "No groups available.",
        "copy": "Copy",
        "clear": "Clear",
        "expand": "Expand",
        "collapse": "Collapse"
    },
    "autoupdate": {
        "title": "AutoUpdate (Self-Code Analysis)",
        "description": "Allow CodeAlchemist to analyze its own source code.",
        "config": {
            "llmSourceLabel": "Use LLM Configuration From:",
            "codeSourceLabel": "Source Code for Self-Analysis",
            "sourceLocal": "Local (current app code)",
            "sourceGit": "Git Repository URL",
            "gitUrlLabel": "Git Repository URL",
            "gitUrlPlaceholder": "HTTPS URL of CodeAlchemist repo",
            "analysisParamsLabel": "Self-Analysis Parameters",
            "analysisPrefsLabel": "Analysis Preferences / Focus Area (optional)",
            "analysisPrefsPlaceholder": "E.g.: Focus on UI optimization. All suggestions in English.",
            "startButton": "Start Self-Analysis",
            "startButtonLoading": "Analyzing..."
        },
        "results": {
            "title": "Self-Analysis Results",
            "downloadSuggestionsJson": "Download Suggestions (JSON)",
            "downloadProjectZip": "Download Current Code (ZIP)",
            "uploadToGit": "Upload to Git",
            "noResults": "Start an analysis to see results.",
            "analysisTitleLabel": "Analysis Title:",
            "generalAssessmentLabel": "General Assessment:",
            "overallImprovementIdeasLabel": "General Improvement Ideas Suggested by AI:",
            "detailedSuggestionsLabel": "Detailed Suggestions:",
            "noDetailedSuggestions": "No detailed suggestions.",
            "unifiedPromptLabel": "Unified Prompt to Implement All Suggestions:"
        },
        "suggestionCard": {
            "priorityLabel": "Priority:",
            "promptLabel": "Prompt:",
            "testInVenvButton": "Test in Virtual Env.",
            "saveEditButton": "Save Edit",
            "statusApplied": "Suggestion Applied (marked)",
            "statusDiscarded": "Suggestion Discarded",
            "editContentLabel": "Edit Suggested Content:"
        },
        "logs": {
            "groupContextLog": "Workgroup Context Log:\n------------------------------------\nSelected Group: {groupName}\nGroup Main Task: {groupTask}\nUser Input: {userInput}\nOrchestrator Context (used to guide AI):\n\"{orchestratorContext}...\"\n---\nNote: The Genkit flow ({flowName}) was executed using the selected group's orchestrator context to guide the AI process.",
            "analysisStarting": "Starting Self-Analysis...",
            "analysisProcessingComplete": "AutoUpdate analysis processing complete.",
            "localCodeObtained": "Local code obtained from server.",
            "analysisSuccessNonGroup": "AutoUpdate analysis (non-group) successful.",
            "analysisSuccessGroup": "AutoUpdate analysis (group) successful.",
            "suggestionMarkedApplied": "Suggestion marked as applied for {area}. (Direct file modification not feasible from browser).",
            "downloadRequested": "Download requested: {format}",
            "suggestionsDownloadedJson": "AutoUpdate suggestions downloaded as JSON.",
            "applyingSuggestionToZip": "Applying suggestion content to {fileName} for ZIP.",
            "appliedSuggestionsToZip": "'Applied' suggestions conceptually incorporated for ZIP.",
            "projectZipDownloaded": "Project ZIP download ({filename}) initiated. It contains a JSON file with the content of project files obtained from the server, with 'applied' suggestions conceptually included. It's not a directly executable project ZIP.",
            "zipGenerationFailed": "ZIP generation failed: {error}",
            "gitUploadFailedConfig": "Git upload failed: Configuration incomplete.",
            "commitMessageMissing": "Git upload failed: Commit message required.",
            "initiatingGitUpload": "Initiating Git upload...",
            "gitUploadInProgress": "Uploading to Git with message: \"{message}\"",
            "gitUploadSuccess": "Git upload successful.",
            "gitUploadError": "Error in Git upload: {error}",
            "gitUploadException": "Exception during Git upload: {error}",
            "attemptingAutofix": "Attempting Auto-Fix for error: {error}",
            "venvSim": "Simulated virtual environment test for {area}.",
            "detailedExecutionLogsTitle": "Detailed Execution Logs (AutoUpdate)",
            "analyzingWithGroup": "Analyzing with group...",
            "waitingForGroup": "Waiting for group results..."
        },
        "analysis": {
            "fileMarker": "File",
            "general": "General analysis"
        },
        "prompts": {
            "unifiedHeader": "// --- START: Prompt to improve file: {area} ---",
            "unifiedFooter": "// --- END: Prompt to improve file: {area} ---"
        },
        "toast": {
            "gettingLocalCode": {
                "title": "Getting Local Code...",
                "description": "Contacting server for source code."
            },
            "analysisComplete": {
                "title": "Self-Analysis Complete",
                "description": "Suggestions for the code have been generated."
            },
            "analysisError": {
                "title": "Self-Analysis Error"
            },
            "noContentToApply": {
                "title": "No Content",
                "description": "This suggestion has no file content to apply."
            },
            "suggestionApplied": {
                "title": "Suggestion Marked as Applied",
                "description": "Changes for {area} marked. Actual file modification is not possible from the browser."
            },
            "noSuggestionsToDownload": {
                "title": "No Suggestions",
                "description": "There are no suggestions to download."
            },
            "noContentToDownload": {
                "title": "No Content",
                "description": "None of the suggestions have file content to download."
            },
            "downloadComplete": {
                "title": "Download Complete",
                "suggestionsJsonDescription": "Suggestions downloaded as {filename}.",
                "projectZipDescription": "This ZIP file ({filename}) contains a JSON file with the AI-suggested changes. To apply these improvements, you'll need the base CodeAlchemist source code (from Git) and manually apply the changes from the JSON."
            },
            "preparingProjectZip": {
                "title": "Preparing Project Download (ZIP)...",
                "description": "Getting code from server..."
            },
            "projectZipDownloadInitiated": {
                "title": "Download of Project with Suggestions (ZIP containing JSON of changes)",
                "description": "This ZIP file ({filename}) contains a JSON file detailing files that would be modified by AI suggestions and their new proposed content. It is not a ZIP of the full executable project. To 'run it locally' with these improvements, you would need: 1. The base source code of CodeAlchemist (obtained from its Git repository). 2. To manually apply the changes detailed in the downloaded JSON to your local copy of the source code. This download provides you with the 'diffs' or proposed file contents from the AI."
            },
            "zipError": {
                "title": "Error Generating ZIP"
            },
            "gitConfigIncomplete": {
                "title": "Git Configuration Incomplete",
                "description": "Complete Git settings in Configuration before uploading."
            },
            "commitMessageRequired": {
                "title": "Commit Message Required"
            },
            "uploadingToGit": {
                "title": "Uploading to Git...",
                "description": "Attempting to upload to {repo}"
            },
            "gitUploadSuccess": {
                "title": "Git Upload Successful"
            },
            "gitUploadError": {
                "title": "Git Upload Error"
            },
            "autofixSuggestion": {
                "title": "Auto-Fix Suggestion"
            },
            "autofixError": {
                "title": "Auto-Fix Error"
            },
            "editSaved": {
                "title": "Edit Saved",
                "description": "Suggested content has been updated locally."
            },
            "venvSim": {
                "title": "Simulation: Test in Virtual Env",
                "description": "Simulating test start for {area}."
            }
        },
        "downloads": {
            "suggestionsJsonFilename": "autoupdate_sugerencias.json",
            "projectZipFilename": "CodeAlchemist_CodigoActual_Con_Sugerencias.zip"
        },
        "errors": {
            "getLocalSourceFailed": "Could not get local source code for analysis.",
            "getLocalSourceBundleFailed": "Failed to get local source bundle",
            "analysisFailedUI": "AutoUpdate analysis failed in UI",
            "unknownAnalysisError": "An unknown error occurred during self-analysis.",
            "getServerSourceFailedZip": "Could not get server source code for ZIP.",
            "unknownZipError": "Unknown error generating ZIP.",
            "unknownGitUploadError": "Unknown error during Git upload.",
            "autofixHelperFailed": "Could not get AI help for this error."
        },
        "dialogs": {
            "applySuggestion": {
                "title": "Apply Suggestion to {area}",
                "confirmText": "Yes, Mark as Applied",
                "description": {
                    "p1": "The suggestion for {area} will be marked as applied.",
                    "p2": "Actual file modification is not possible from the browser. Review the suggested (or edited) content and apply it manually in your development environment:"
                }
            },
            "noContentToShow": "Error: No content to display.",
            "testSuggestion": {
                "title": "Test Suggestion: {area}",
                "description": "Review the suggested or edited code. Actual testing must be done in your development environment."
            },
            "noContentToTest": "No content to test.",
            "testInVenv": {
                "title": "Test Suggestion in Virtual Environment: {area}",
                "description": "This functionality would simulate running the suggested code in an isolated virtual environment (e.g., Python venv, Node.js NVM). Actual execution requires a local setup or backend infrastructure.",
                "actionNote": "Action: It would attempt to create a virtual environment, install dependencies (if inferable), and run the code/tests.",
                "simulateButton": "Simulate Test Start"
            },
            "commitToGit": {
                "title": "Commit Changes to Git",
                "confirmText": "Commit and Push",
                "placeholder": "E.g.: Applied AutoUpdate suggestions",
                "description": "This action will attempt to commit and push to the configured repository. Ensure credentials in 'Settings' are correct."
            }
        },
        "autofix": {
            "errorContext": "Error to analyze: {error}\n\nContext: Error occurred in CodeAlchemist's AutoUpdate feature.",
            "focusArea": "Explain the following error and propose a solution or debugging steps: \"{error}\""
        }
    },
    "refactorProject": {
        "title": "Refactor Project",
        "description": "Analyze a project to get refactoring suggestions and apply them.",
        "llmSourceLabel": "Use LLM Configuration From:",
        "projectSourceLabel": "Project Source",
        "sourceUpload": "Upload File",
        "sourceGit": "Git URL",
        "uploadLabel": "Upload File (.zip, .json, .py, .js, etc.)",
        "gitUrlLabel": "Git URL",
        "gitUrlPlaceholder": "https://github.com/user/repo.git",
        "paramsLabel": "Refactoring Parameters",
        "goalsLabel": "Goals (optional)",
        "goalsPlaceholder": "E.g.: Improve UI performance, simplify logic X...",
        "priorityLabel": "General Priority (optional)",
        "priorityPlaceholder": "Select priority...",
        "priorityNone": "None",
        "depthLabel": "Search Depth (optional)",
        "depthPlaceholder": "E.g.: 3 (levels)",
        "focusLabel": "Analysis Focus Area (optional)",
        "focusPlaceholder": "E.g.: Security, UI, Payment module",
        "analyzeButton": "Analyze for Refactoring",
        "results": {
            "title": "Results and Suggestions",
            "applyAllButton": "Mark All as Applied",
            "noSuggestions": "No suggestions yet. Perform an analysis to start.",
            "projectSummaryCard": {
                "title": "Project Summary",
                "noSummary": "No project summary was provided."
            },
            "suggestionsTitle": "Refactoring Suggestions:",
            "noSpecificSuggestions": "No specific refactoring suggestions were generated."
        },
        "suggestion": {
            "priorityLabel": "Priority:",
            "snippetLabel": "Suggested Snippet:",
            "snippetOriginal": "Original:",
            "snippetModified": "Modified:",
            "viewDiffButton": "View Diff",
            "discardButton": "Discard",
            "applyButton": "Mark as Applied",
            "revertStateButton": "Revert Status"
        },
        "diffModal": {
            "title": "Code Comparison (Diff)",
            "originalLabel": "Original:",
            "suggestedLabel": "Suggested:",
            "noContent": "N/A"
        },
        "logs": {
            "groupContextLog": "Workgroup Context Log:\n------------------------------------\nSelected Group: {groupName}\nGroup Main Task: {groupTask}\nUser Input: {userInput}\nOrchestrator Context (used to guide AI):\n\"{orchestratorContext}...\"\n---\nNote: The Genkit flow ({flowName}) was executed using the selected group's orchestrator context to guide the AI process.",
            "groupLogTitle": "Group Execution Log"
        },
        "toast": {
            "invalidFile": {
                "title": "Invalid File",
                "description": "Unsupported file type or size exceeds 10MB."
            },
            "sourceRequired": {
                "title": "Project Source Required",
                "description": "Upload a file or provide a Git URL."
            },
            "analysisComplete": {
                "title": "Analysis Complete",
                "description": "Refactoring suggestions generated."
            },
            "analysisError": {
                "title": "Analysis Error"
            },
            "suggestionApplied": {
                "title": "Suggestion Marked as Applied",
                "description": "The suggestion for \"{area}\" has been marked. Remember to apply changes manually to your code if necessary."
            },
            "noDiff": {
                "title": "No Diff Available",
                "description": "This suggestion does not have a code snippet to compare."
            },
            "suggestionDiscarded": {
                "title": "Suggestion Discarded"
            },
            "allApplied": {
                "title": "All Marked as Applied",
                "description": "All pending suggestions have been marked. Apply changes manually."
            }
        }
    },
    "analyzeProject": {
        "title": "Analyze Full Project",
        "description": "Perform a holistic analysis of an entire project, uploaded or from Git.",
        "llmSourceLabel": "Use LLM Configuration From:",
        "projectSourceLabel": "Project Source",
        "sourceUpload": "Upload File (ZIP/JSON)",
        "sourceGit": "Git URL",
        "uploadLabel": "Upload File (.zip, .json)",
        "gitUrlLabel": "Git URL",
        "gitUrlPlaceholder": "https://github.com/user/repo.git",
        "paramsLabel": "Analysis Parameters",
        "depthLabel": "Search Depth (optional)",
        "depthPlaceholder": "E.g.: 3 (levels)",
        "focusLabel": "Analysis Focus Area (optional)",
        "focusPlaceholder": "E.g.: Performance, API Security",
        "analyzeButton": "Analyze Project",
        "results": {
            "analyzing": "Analyzing project...",
            "noResults": "No results yet. Perform an analysis to start.",
            "overallAssessmentLabel": "Overall Assessment:",
            "improvementIdeasLabel": "General Improvement Ideas:",
            "identifiedAreasLabel": "Identified Areas:",
            "specificSuggestionsLabel": "Specific Suggestions:",
            "suggestionPriorityLabel": "Priority:",
            "suggestedPromptLabel": "Suggested Prompt:",
            "groupLogTitle": "Detailed Analysis Log",
            "groupContextLog": "Workgroup Context Log:\n------------------------------------\nSelected Group: {groupName}\nGroup Main Task: {groupTask}\nUser Input: {userInput}\nOrchestrator Context (used to guide AI):\n\"{orchestratorContext}...\"\n---\nNote: The Genkit flow ({flowName}) was executed using the selected group's orchestrator context to guide the AI process."
        },
        "toast": {
            "invalidFile": {
                "title": "Invalid File",
                "description": "Upload a .zip or .json file under 25MB."
            },
            "readError": {
                "title": "Read Error",
                "description": "Could not read the file."
            },
            "unsupportedFileType": {
                "title": "Unsupported File Type",
                "description": "Analysis for this file type is not fully implemented."
            },
            "sourceRequired": {
                "title": "Project Source Required",
                "description": "Upload a file or provide a Git URL."
            },
            "analysisComplete": {
                "title": "Analysis Complete",
                "description": "The project has been analyzed."
            },
            "analysisError": {
                "title": "Analysis Error"
            }
        }
    },
    "generateCode": {
      "title": "Generate Code",
      "description": "Create code snippets from natural language descriptions.",
      "describeNeedLabel": "Describe your need",
      "describeNeedPlaceholder": "E.g.: A Python function that sums two numbers and handles type errors.",
      "generateButton": "Generate Code",
      "results": {
        "explanationLabel": "Explanation:",
        "codeSnippetLabel": "Code Snippet:",
        "groupLogTitle": "Detailed Group Log"
      },
      "logs": {
        "groupContextLog": "Workgroup Context Log:\n------------------------------------\nSelected Group: {groupName}\nGroup Main Task: {groupTask}\nUser Input: {userInput}\nOrchestrator Context (used to guide AI):\n\"{orchestratorContext}...\"\n---\nNote: The Genkit flow ({flowName}) was executed using the selected group's orchestrator context to guide the AI process."
      },
      "confirmDialog": {
        "title": "Confirm Code Generation",
        "llmSourceLabel": "LLM Source:",
        "promptLabel": "Prompt:"
      },
      "toast": {
        "descriptionEmpty": {
            "title": "Empty Description",
            "description": "Please describe your need."
        },
        "codeGenerated": {
            "title": "Code Generated",
            "description": "The code snippet has been generated successfully."
        },
        "generationError": {
            "title": "Generation Error"
        },
        "autofixSimulated": {
            "title": "Auto-Fix (Simulated)",
            "description": "AI is analyzing the error to propose a solution."
        }
      }
    },
    "generateProject": {
      "title": "Generate Project",
      "description": "Create a base structure for new projects from your specifications.",
      "describeProjectLabel": "Describe your project",
      "describeProjectPlaceholder": "E.g.: A REST API with Node.js and Express, with routes for users and products, and a PostgreSQL database.",
      "generateButton": "Generate Project",
      "results": {
        "suggestedNameLabel": "Suggested Name:",
        "aiNotesLabel": "AI Notes:",
        "generatedFilesLabel": "Generated Files:",
        "downloadButton": "Download Project (ZIP)",
        "downloadNote": "Note: The download will be a JSON file with the project structure.",
        "groupLogTitle": "Detailed Group Log",
        "groupContextLog": "Workgroup Context Log:\n------------------------------------\nSelected Group: {groupName}\nGroup Main Task: {groupTask}\nUser Input: {userInput}\nOrchestrator Context (used to guide AI):\n\"{orchestratorContext}...\"\n---\nNote: The Genkit flow ({flowName}) was executed using the selected group's orchestrator context to guide the AI process."
      },
      "confirmDialog": {
        "title": "Confirm Project Generation",
        "currentPromptLabel": "Current Prompt:",
        "redefinePromptLabel": "Redefine Prompt (optional):",
        "llmConfigInfo": "LLM configuration to use:",
        "confirmButton": "Yes, Generate Project"
      },
      "toast": {
        "descriptionEmpty": {
            "title": "Empty Description",
            "description": "Please describe your project."
        },
        "projectGenerated": {
            "title": "Project Generated",
            "description": "The base structure for project \"{projectName}\" has been generated."
        },
        "generationError": {
            "title": "Generation Error"
        },
        "downloadError": {
            "title": "No Results",
            "description": "There is no project structure to download."
        },
        "downloadSuccess": { // For JSON download
            "title": "Structure Downloaded (JSON)",
            "description": "A JSON file with the project structure and content for \"{projectName}\" has been downloaded. You can use this file to create the files and folders manually or with a script."
        },
        "zipDownloadSuccess": { // For actual ZIP download
            "title": "Project Downloaded (ZIP)",
            "description": "A ZIP file with the project structure and content for \"{projectName}\" has been downloaded."
        },
        "zipDownloadError": {
            "title": "ZIP Download Error",
            "description": "Could not generate the ZIP file: {error}"
        },
         "autofixSimulated": {
            "title": "Auto-Fix (Simulated)",
            "description": "AI is analyzing the error to propose a solution."
        }
      }
    },
    "analyzeCode": {
      "title": "Analyze Code",
      "description": "Get detailed analysis and improvement suggestions for code snippets or files.",
      "codeSourceLabel": "Code Source:",
      "uploadFileLabel": "Upload a code file (optional)",
      "gitFileUrlLabel": "Git File URL (optional, raw content)",
      "gitFileUrlPlaceholder": "E.g.: https://raw.githubusercontent.com/...",
      "fetchUrlButton": "Fetch",
      "pasteCodeInstruction": "Or paste code below",
      "pasteCodePlaceholder": "Paste your code here to analyze it...",
      "additionalInstructionsLabel": "Additional Instructions for Analysis (optional)",
      "additionalInstructionsPlaceholder": "E.g.: Focus on security, or suggest more performant alternatives.",
      "analyzeButton": "Analyze Code",
      "results": {
        "explanationLabel": "Explanation:",
        "originalCodeLabel": "Original Code:",
        "suggestedCodeLabel": "Suggested Code:",
        "saveOriginalButton": "Save Original",
        "saveSuggestedButton": "Save Suggested"
      },
      "toast": {
        "invalidFile": {
            "title": "Invalid File",
            "description": "Upload a text file under 5MB."
        },
        "emptyUrl": {
            "title": "Empty URL",
            "description": "Enter a Git file URL."
        },
        "fetchError": {
            "title": "Fetch Error"
        },
        "codeFetched": {
            "title": "Code Fetched",
            "description": "URL content loaded."
        },
        "emptyCode": {
            "title": "Empty Code",
            "description": "Enter or upload code to analyze."
        },
        "analysisComplete": {
            "title": "Analysis Complete",
            "description": "The code has been analyzed."
        },
        "analysisError": {
            "title": "Analysis Error"
        },
        "snapshotError": {
            "title": "Error",
            "description": "No {type} code to save."
        },
        "autofixSimulated": {
            "title": "Auto-Fix (Simulated)",
            "description": "AI is analyzing the error to propose a solution."
        }
      }
    },
    "errorDisplay": {
      "title": "Error Detected",
      "copyButton": "Copy Error",
      "autofixButton": "Auto-Fix with AI",
      "autofixingButton": "Analyzing...",
      "toast": {
        "copied": {
            "title": "Error Copied",
            "description": "The error message has been copied to the clipboard."
        },
        "autofixAttempt": {
            "title": "Attempting Auto-Fix",
            "description": "Consulting 'EquipoDesarrolloSoftware' for a possible solution..."
        },
        "autofixSuggestionReceived": {
            "title": "Auto-Fix Suggestion Received",
            "description": "'EquipoDesarrolloSoftware' has provided a suggestion."
        },
        "autofixError": {
            "title": "Auto-Fix Error"
        }
      },
      "autofixModal": {
        "title": "Sugerencia de Auto-Corrección del Equipo de Software",
        "description": "El grupo 'EquipoDesarrolloSoftware' ha analizado el error y propone lo siguiente:",
        "originalErrorLabel": "Mensaje de Error Original:",
        "diagnosisLabel": "Diagnóstico del Grupo:",
        "solutionLabel": "Solución Sugerida:",
        "invocationLogLabel": "Log de Invocación del Grupo (para depuración)"
      }
    },
     "versions": {
        "title": "Versiones Guardadas (Snapshots)",
        "description": "Gestiona instantáneas de código generadas o del estado de la aplicación.",
        "saveAppStateButton": "Guardar Estado de App (JSON)",
        "saveAppStateDescription": "Guarda la configuración actual, agentes y grupos como un snapshot JSON.",
        "saveAndDownloadStateButton": "Guardar Estado y Descargar como ZIP",
        "saveAndDownloadStateDescription": "Guarda el estado actual de la aplicación y lo descarga como un archivo .zip (conteniendo el JSON del estado).",
        "compareButton": "Comparar A y B",
        "compareButtonDisabledTooltip": "Selecciona dos versiones (A y B) para comparar.",
        "deleteAllButton": "Eliminar Todas",
        "table": {
            "colA": "A",
            "colB": "B",
            "colName": "Name",
            "colCreatedAt": "Creation Date",
            "colSource": "Source",
            "colActions": "Actions",
            "noVersions": "No saved versions."
        },
        "action": {
            "view": "View",
            "downloadOriginal": "Download as {format}",
            "downloadZip": "Download as ZIP",
            "delete": "Delete",
            "selectA": "Select for A",
            "selectB": "Select for B"
        },
        "source": {
            "original": "Original (Analysis)",
            "suggested": "Suggested (Analysis)",
            "codealchemist-app-state": "App State",
            "codealchemist-current": "Current Code (AutoUpdate)",
            "unknown": "Unknown"
        },
        "viewModal": {
            "title": "Viewing Snapshot: {name}",
            "noCode": "Error: No code to display."
        },
        "compareModal": {
            "title": "Compare Versions (A vs B)",
            "versionA": "Version A: {name}",
            "versionB": "Version B: {name}",
            "noDiffLib": "Detailed visual comparison (diff) is not implemented. Contents are shown side-by-side."
        },
        "deleteAllModal": {
            "title": "Confirm Total Deletion",
            "description": "Are you sure you want to delete ALL saved snapshots? This action cannot be undone.",
            "confirm": "Yes, Delete All"
        },
        "deleteSingleModal": {
            "title": "Confirm Deletion: {name}",
            "description": "Are you sure you want to delete this snapshot? This action cannot be undone.",
            "confirm": "Yes, Delete"
        },
        "toast": {
            "appStateSaved": {
                "title": "Application State Saved",
                "description": "Current application state \"{name}\" has been saved."
            },
            "appStateSavedAndDownloaded": {
                "title": "Application State Saved & Downloaded",
                "description": "Current state \"{name}\" has been saved and downloaded as {filename}."
            },
            "snapshotSaved": {
                "title": "Snapshot Saved",
                "description": "Snapshot \"{name}\" created."
            },
            "snapshotDownloaded": {
                "title": "Snapshot Downloaded",
                "description": "Snapshot \"{name}\" downloaded as {filename}."
            },
            "snapshotDeleted": {
                "title": "Snapshot Deleted",
                "description": "Snapshot \"{name}\" deleted."
            },
            "compareError": {
                "notFound": "Could not find the selected snapshots.",
                "selectionIncomplete": "Select two versions (A and B) to compare."
            },
            "allSnapshotsDeleted": {
                 "title": "All Snapshots Deleted",
                 "description": "All saved versions have been deleted."
            }
        }
    },
    "chat": {
        "title": "AI Chat",
        "description": "Interact with an AI assistant for queries, ideas, and more.",
        "inputPlaceholder": "Type your message here...",
        "sendButton": "Send",
        "clearButton": "Clear Chat",
        "thinking": "Thinking...",
        "systemMessage": {
            "errorPrefix": "Error: ",
            "autofixErrorPrefix": "Error during Auto-Fix: "
        },
        "agent": {
            "assistant": "AI Assistant",
            "user": "User",
            "system": "System"
        },
        "toast": {
            "chatCleared": {
                "title": "Chat Cleared",
                "description": "The conversation history has been cleared."
            },
            "chatError": {
                "title": "Chat Error"
            },
            "autofixError": {
                "title": "Auto-Fix Error"
            }
        },
        "autofix": {
            "userRequest": "Please analyze this error and suggest a solution: {errorMsg}"
        }
    },
    "agents": {
        "title": "AI Agent Management",
        "description": "Create, configure, test, and manage individual AI agents.",
        "createWithAIButton": "Create with AI",
        "importButton": "Import",
        "exportAllButton": "Export All",
        "createAgentButton": "Create Agent",
        "noAgentsMessage": "No agents created. Create one to get started!",
        "defaultAgentBadge": "(Default)",
        "llmLabel": "LLM:",
        "llmGlobalFormat": "Global ({provider})",
        "llmCustomFormat": "Custom ({provider})",
        "llmNotApplicable": "N/A",
        "capabilitiesLabel": "Capabilities:",
        "noCapabilities": "None",
        "action": {
            "test": "Test Agent",
            "export": "Export Agent",
            "edit": "Edit Agent",
            "delete": "Delete Agent"
        },
        "toast": {
            "form": {
                "nameUneditableError": {
                    "title": "Error",
                    "description": "Agent name \"{name}\" cannot be edited."
                },
                "deleteError": {
                    "title": "Error",
                    "description": "Agent \"{name}\" cannot be deleted."
                }
            },
            "import": {
                "success": {
                    "title": "Agents Imported",
                    "description": "{count} agents imported and/or updated."
                },
                "invalidFormat": "Invalid JSON format for agents.",
                "error": {
                    "title": "Import Error"
                }
            },
            "exportAll": {
                "success": {
                    "title": "Agents Exported",
                    "description": "All agents have been exported."
                }
            },
            "exportSingle": {
                "success": {
                    "title": "Agent Exported",
                    "description": "Agent \"{name}\" exported."
                }
            },
            "suggestion": {
                "roleRequired": {
                    "title": "Description Required",
                    "description": "Please describe the agent's role."
                },
                "received": {
                    "title": "Suggestion Received",
                    "description": "AI has suggested a definition for agent {name}."
                },
                "error": {
                    "title": "Suggestion Error",
                    "description": "Could not get suggestion."
                }
            },
            "created": {
                "title": "Agent Created",
                "description": "Agent \"{name}\" added."
            },
            "updated": {
                "title": "Agent Updated",
                "description": "Agent \"{name}\" saved."
            },
            "deleted": {
                "title": "Agent Deleted",
                "description": "Agent \"{name}\" deleted."
            }
        },
        "form": {
            "title": {
                "edit": "Edit Agent",
                "create": "Create New Agent",
                "reviewSuggestion": "Review Agent Suggestion"
            },
            "description": {
                "edit": "Modify details for agent \"{name}\".",
                "create": "Define a new specialized agent for your AI tasks."
            },
            "label": {
                "name": "Name",
                "description": "Description",
                "systemPrompt": "System Message (Prompt)",
                "capabilities": "Agent Capabilities",
                "llmConfig": "Agent LLM Configuration"
            },
            "placeholder": {
                "systemPrompt": "Define the agent's role, behavior, and guidelines..."
            },
            "capability": {
                "accessOwnCode": "Access Own Code",
                "execution": "Execution Capability",
                "virtualEnv": "Virtual Environment Capability",
                "readWrite": "Read/Write Capability",
                "dangerousTooltip": "(Dangerous)"
            },
            "llm": {
                "useGlobal": "Use Global Configuration",
                "custom": {
                    "providerLabel": "LLM Provider",
                    "modelLabel": "Model",
                    "modelPlaceholder": {
                        "gemini": "E.g.: gemini-1.5-pro-latest",
                        "selectProvider": "Select provider",
                        "default": "Select model"
                    },
                    "geminiModelDescription": "Common models listed. You can type another if needed.",
                    "apiUrlLabel": "API URL (Optional)",
                    "apiUrlPlaceholder": "Auto-fills on provider change",
                    "apiUrlDescription": "Modify if using a proxy or non-standard endpoint.",
                    "apiKeyLabel": "API Key (Optional)",
                    "apiKeyPlaceholder": "Use global if empty"
                }
            },
            "button": {
                "saveChanges": "Save Changes",
                "createAgent": "Create Agent"
            },
            "toast": {
                "nameRequired": {
                    "title": "Name Required",
                    "description": "The agent must have a name."
                }
            }
        },
        "suggestionDialog": {
            "title": "Suggest Agent Definition with AI",
            "description": "Describe the role or main task of the agent you need, and AI will suggest a definition.",
            "textareaLabel": "Agent Role Description",
            "textareaPlaceholder": "E.g.: An agent that summarizes long texts into key points.",
            "submitButton": "Get Suggestion"
        },
        "testChatDialog": {
            "title": "Testing Agent: {name}",
            "description": "Interact directly with the agent. Its system prompt is shown below.",
            "systemMessage": "You are testing agent: {name}.\n--- Start of Agent System Prompt ---\n{systemPrompt}\n--- End of Agent System Prompt ---",
            "inputPlaceholder": "Type your message to the agent...",
            "sendButton": "Send",
            "thinking": "Agent is thinking...",
            "errorPrefix": "Error: "
        }
    },
    "groups": {
        "title": "AI Workgroup Management",
        "description": "Define and execute collaborative AI agent teams.",
        "createWithAIButton": "Create with AI",
        "createGroupButton": "Create Group",
        "noGroupsMessage": "No workgroups created.",
        "defaultGroupBadge": "(Default)",
        "agentsLabel": "Agents:",
        "agentsCountFormat": "{count} (+ Orchestrator)",
        "taskLabel": "Task:",
        "action": {
            "execute": "Execute Group",
            "edit": "Edit Group",
            "delete": "Delete Group"
        },
        "form": {
            "title": {
                "edit": "Edit Workgroup",
                "create": "Create New Workgroup",
                "reviewSuggestion": "Review Group Suggestion"
            },
            "label": {
                "name": "Name",
                "description": "Description",
                "mainTask": "Group Main Task",
                "selectAgents": "Select Participating Agents"
            },
            "placeholder": {
                "mainTask": "Describe the overall goal the workgroup should achieve..."
            },
            "orchestratorImplicitNote": "OrchestratorFlujoAgentes is added implicitly.",
            "noAgentsToSelectError": "No other agents available for selection. Create agents first.",
            "button": {
                "saveChanges": "Save Changes",
                "createGroupWithSuggestion": "Create Group with Suggestion",
                "createGroup": "Create Group"
            },
            "toast": {
                "fieldsRequired": {
                    "title": "Required Fields",
                    "description": "Name and main task are mandatory."
                },
                "agentsRequired": {
                    "title": "Agents Required",
                    "description": "Select at least one participating agent (besides the Orchestrator)."
                }
            }
        },
        "toast": {
            "created": {
                "title": "Group Created",
                "description": "Group \"{name}\" added."
            },
            "updated": {
                "title": "Group Updated",
                "description": "Group \"{name}\" saved."
            },
            "deleted": {
                "title": "Group Deleted",
                "description": "Group \"{name}\" deleted."
            },
            "suggestion": {
                "taskRequired": {
                    "title": "Description Required",
                    "description": "Please describe the group's task."
                },
                "received": {
                    "title": "Suggestion Received",
                    "description": "AI has suggested a definition for group {name}."
                },
                "error": {
                    "title": "Suggestion Error"
                }
            },
            "execution": {
                "orchestratorNotFound": "Orchestrator agent not found.",
                "orchestratorError": "Orchestrator Error",
                "groupError": "Group Error",
                "generalError": "Execution Error",
                "maxTurnsReached": "Maximum turns ({maxTurns}) reached. Execution stopped.",
                "stoppedOrFinished": "Group execution finished or stopped."
            }
        },
        "suggestionDialog": {
            "title": "Suggest Group Definition with AI",
            "description": "Describe the group's main task or objective, and AI will suggest a definition and relevant agents.",
            "textareaLabel": "Group Task Description",
            "textareaPlaceholder": "E.g.: Develop a new e-commerce module for the application.",
            "submitButton": "Get Suggestion",
            "submitButtonDisabled": "Create Agents First",
            "noAgentsWarning": "Create agents first to get group suggestions."
        },
        "executionModal": {
            "title": "Group Execution: {name}",
            "mainTaskLabel": "Main Task:",
            "logTitle": "Detailed Execution Log",
            "stopButton": "Stop Execution"
        },
        "execution": {
            "starting": "Starting group execution: {name}...\nMain Task: {mainTask}",
            "taskPrefix": "Main Task: ",
            "criticalError": {
                "orchestratorNotFound": "Orchestrator agent ('orquestador-flujo-agentes') not found. Cannot execute group.",
                "orchestratorParse": "Error parsing Orchestrator's JSON response.",
                "orchestratorIncomplete": "Orchestrator response incomplete (missing next_agent_id or instruction_for_next_agent).",
                "agentNotFound": "Agent with ID \"{id}\" not found."
            },
            "log": {
                "turnPrefix": "--- Turn {turn} ---",
                "orchestratorReceiving": "Orchestrator receiving: \"{input}...\"",
                "orchestratorRawResponse": "Orchestrator (raw JSON): {response}",
                "orchestratorDecision": "Orchestrator Decision: Next Agent: {nextAgentId}. Instruction: \"{instruction}...\". Reason: \"{reasoning}\"",
                "taskCompleted": "--- Task Completed ---\nFinal Group Result: {result}",
                "callingAgent": "Calling Agent: {name}...",
                "agentResponse": "Response from {name}: \"{response}...\"",
                "errorInTurn": "Error in Turn {turn}: {errorMessage}",
                "maxTurnsReached": "\nMaximum number of turns ({maxTurns}) reached. Execution stopped.",
                "executionStoppedOrFinished": "\nGroup execution finished or stopped.",
                "userStopped": "Turn {turn}: Execution cancelled by user."
            }
        }
    },
    "appLayout": {
        "debugPanel": {
            "title": "Debug Panel",
            "copyButton": "Copy Logs",
            "clearButton": "Clear Logs",
            "collapseButton": "Collapse",
            "expandButton": "Expand",
            "noLogs": "No logs."
        },
        "toast": {
            "unexpectedError": {
                "title": "Unexpected Error",
                "description": "An unexpected error occurred in the application. We are working on it."
            }
        }
    },
    "fileTree": {
        "isFolder": "This is a folder.",
        "emptyFile": "Empty file or content not viewable here."
    },
    "codeEditor": {
        "toast": {
            "loadError": {
                "title": "Loading Error",
                "description": "Could not load saved editor state for {id}."
            }
        }
    }
  }
} as const;

/**
 * Export the translations object directly.
 */
export const translations: AllTranslations = translationsData;
