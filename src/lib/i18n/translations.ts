
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
 * Using string for broader compatibility with dotted paths.
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
        "analyzeProject": "Analizar Proyecto",
        "autoupdate": "AutoUpdate",
        "snapshots": "Versiones Guardadas",
        "chat": "Chat con IA",
        "agents": "Agentes IA",
        "groups": "Grupos de Trabajo IA",
        "settings": "Configuración",
        "toggle": {
            "hide": "Ocultar barra lateral",
            "show": "Mostrar barra lateral"
        },
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
                "title": "Analizar Proyecto",
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
            "executingAnalysis": "Ejecutando análisis para AutoUpdate...",
            "analysisStarting": "Iniciando Auto-Análisis...",
            "groupContextLog": "Log de Contexto del Grupo de Trabajo:\n------------------------------------\nGrupo Seleccionado: {groupName}\nTarea Principal del Grupo: {groupTask}\nInput del Usuario: {userInput}\nContexto del Orquestador (usado para guiar a la IA):\n\"{orchestratorContext}...\"\n---\nNota: El flujo Genkit ({flowName}) fue ejecutado utilizando el contexto del orquestrador del grupo seleccionado para guiar el proceso de la IA.",
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
                "projectZipDescription": "Descarga de Proyecto con Sugerencias (ZIP conteniendo JSON de cambios). Este archivo ZIP ({filename}) contiene un archivo JSON que detalla los archivos que serían modificados por las sugerencias de IA y su nuevo contenido propuesto. No es un ZIP del proyecto ejecutable completo. Para 'correrlo en local' con estas mejoras, necesitarás: 1. El código fuente base de CodeAlchemist (obtenido de su repositorio Git). 2. Aplicar manualmente los cambios detallados en el JSON descargado a tu copia local del código fuente. Esta descarga te proporciona los 'diffs' o contenidos de archivo propuestos por la IA."
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
            "groupLogTitle": "Log Detallado del Análisis"
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
      "confirmDialog": {
        "title": "Confirmar Generación de Código",
        "llmSource": "Fuente LLM:",
        "promptLabel": "Prompt:"
      },
      "toast": {
        "descriptionEmpty": "Por favor, describe tu necesidad.",
        "codeGenerated": "El fragmento de código ha sido generado exitosamente.",
        "generationError": "Error de Generación"
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
        "downloadNote": "Nota: La descarga será un archivo ZIP con la estructura y contenido del proyecto.",
        "groupLogTitle": "Log Detallado del Grupo"
      },
      "confirmDialog": {
        "title": "Confirmar Generación de Proyecto",
        "currentPromptLabel": "Prompt Actual:",
        "redefinePromptLabel": "Redefinir Prompt (opcional):",
        "llmConfigInfo": "Configuración LLM a usar:",
        "confirmButton": "Sí, Generar Proyecto"
      },
      "toast": {
        "descriptionEmpty": "Por favor, describe tu proyecto.",
        "projectGenerated": "La estructura base del proyecto ha sido generada.",
        "generationError": "Error de Generación",
        "downloadError": "Sin Resultados",
        "downloadErrorDescription": "No hay estructura de proyecto para descargar.",
        "downloadSuccess": "Proyecto Descargado (ZIP)",
        "downloadSuccessDescription": "Se ha descargado un archivo ZIP con la estructura y contenido del proyecto \"{projectName}\"."
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
        }
      }
    },
    "errorDisplay": {
      "title": "Error Detectado",
      "copyButton": "Copiar Error",
      "autofixButton": "Auto-Fix con IA",
      "autofixingButton": "Analizando...",
      "toast": {
        "copied": "Error Copiado",
        "copiedDescription": "El mensaje de error ha sido copiado al portapapeles."
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
            "snapshotSaved": "Snapshot Guardado",
            "snapshotSavedDescription": "Snapshot \"{name}\" creado.",
            "snapshotDownloaded": "Snapshot Descargado",
            "snapshotDownloadedDescription": "Snapshot \"{name}\" descargado como {filename}.",
            "snapshotDeleted": "Snapshot Eliminado",
            "snapshotDeletedDescription": "Snapshot \"{name}\" eliminado.",
            "compareError": {
                "notFound": "No se encontraron los snapshots seleccionados.",
                "selectionIncomplete": "Selecciona dos versiones (A y B) para comparar."
            },
            "allSnapshotsDeleted": "Todos los Snapshots Eliminados"
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
            "chatCleared": "Chat Limpiado",
            "chatClearedDescription": "El historial de la conversación ha sido borrado.",
            "chatError": "Error de Chat",
            "autofixError": "Error en Auto-Fix"
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
                "nameUneditableError": "El nombre del agente \"{name}\" no puede ser editado.",
                "deleteError": "El agente \"{name}\" no se puede eliminar."
            },
            "import": {
                "success": "Agentes Importados",
                "successDescription": "{count} agentes importados y/o actualizados.",
                "invalidFormat": "Formato JSON inválido para agentes.",
                "error": "Error de Importación"
            },
            "exportAll": {
                "success": "Agentes Exportados",
                "description": "Todos los agentes han sido exportados."
            },
            "exportSingle": {
                "success": "Agente Exportado",
                "description": "Agente \"{name}\" exportado."
            },
            "suggestion": {
                "roleRequired": "Descripción Requerida",
                "roleRequiredDescription": "Por favor, describe el rol del agente.",
                "received": "Sugerencia Recibida",
                "receivedDescription": "La IA ha sugerido una definición para el agente {name}.",
                "error": "Error de Sugerencia",
                "errorDescription": "No se pudo obtener la sugerencia."
            },
            "created": "Agente Creado",
            "createdDescription": "Agente \"{name}\" añadido.",
            "updated": "Agente Actualizado",
            "updatedDescription": "Agente \"{name}\" guardado.",
            "deleted": "Agente Eliminado",
            "deletedDescription": "Agente \"{name}\" eliminado."
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
                "nameRequired": "Nombre Requerido",
                "nameRequiredDescription": "El agente debe tener un nombre."
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
                "fieldsRequired": "Campos Requeridos",
                "fieldsRequiredDescription": "El nombre y la tarea principal son obligatorios.",
                "agentsRequired": "Agentes Requeridos",
                "agentsRequiredDescription": "Selecciona al menos un agente participante (además del Orquestador)."
            }
        },
        "toast": {
            "created": "Grupo Creado",
            "createdDescription": "Grupo \"{name}\" añadido.",
            "updated": "Grupo Actualizado",
            "updatedDescription": "Grupo \"{name}\" guardado.",
            "deleted": "Grupo Eliminado",
            "deletedDescription": "Grupo \"{name}\" eliminado.",
            "suggestion": {
                "taskRequired": "Descripción Requerida",
                "taskRequiredDescription": "Por favor, describe la tarea del grupo.",
                "received": "Sugerencia Recibida",
                "receivedDescription": "La IA ha sugerido una definición para el grupo {name}.",
                "error": "Error de Sugerencia"
            },
            "execution": {
                "orchestratorError": "Error de Orquestador",
                "groupError": "Error de Grupo",
                "generalError": "Error de Ejecución"
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
            "starting": "Iniciando ejecución del grupo: {name}...",
            "taskPrefix": "Tarea Principal: ",
            "criticalError": {
                "orchestratorNotFound": "Agente Orquestrador ('orquestador-flujo-agentes') no encontrado. No se puede ejecutar el grupo.",
                "orchestratorParse": "Error al parsear la respuesta JSON del Orquestador.",
                "orchestratorIncomplete": "Respuesta del Orquestrador incompleta (faltan next_agent_id o instruction_for_next_agent).",
                "agentNotFound": "Agente con ID \"{id}\" no encontrado."
            },
            "log": {
                "turnPrefix": "--- Turno {turn} ---",
                "orchestratorReceiving": "Orquestrador recibiendo: \"{input}...\"",
                "orchestratorRawResponse": "Orquestrador (raw JSON): {response}",
                "orchestratorDecision": "Decisión del Orquestrador: Siguiente Agente: {nextAgentId}. Instrucción: \"{instruction}...\". Razón: \"{reasoning}\"",
                "taskCompleted": "--- Tarea Completada --- \nResultado Final del Grupo: {result}",
                "callingAgent": "Llamando a Agente: {name}...",
                "agentResponse": "Respuesta de {name}: \"{response}...\"",
                "errorInTurn": "Error en Turno {turn}: {errorMessage}",
                "maxTurnsReached": "Se alcanzó el número máximo de turnos ({maxTurns}). Ejecución detenida.",
                "executionStoppedOrFinished": "Ejecución del grupo finalizada o detenida.",
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
        "analyzeProject": "Analyze Project",
        "autoupdate": "AutoUpdate",
        "snapshots": "Saved Versions",
        "chat": "AI Chat",
        "agents": "AI Agents",
        "groups": "AI Workgroups",
        "settings": "Settings",
        "toggle": {
            "hide": "Hide sidebar",
            "show": "Show sidebar"
        },
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
                "title": "Analyze Project",
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
            "executingAnalysis": "Executing self-analysis for AutoUpdate...",
            "analysisStarting": "Starting Self-Analysis...",
            "groupContextLog": "Workgroup Context Log:\n------------------------------------\nSelected Group: {groupName}\nGroup Main Task: {groupTask}\nUser Input: {userInput}\nOrchestrator Context (used to guide AI):\n\"{orchestratorContext}...\"\n---\nNote: The Genkit flow ({flowName}) was executed using the selected group's orchestrator context to guide the AI process.",
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
                "projectZipDescription": "Download of Project with Suggestions (ZIP containing JSON of changes) initiated. This ZIP file ({filename}) contains a JSON file detailing which files would be modified by AI suggestions and their new proposed content. It is not a ZIP of the full executable project. To 'run it locally' with these improvements, you would need: 1. The base source code of CodeAlchemist (obtained from its Git repository). 2. To manually apply the changes detailed in the downloaded JSON to your local copy of the source code. This download provides you with the 'diffs' or proposed file contents from the AI."
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
            "getLocalSourceFailed": "No se pudo obtener el código fuente local para análisis.",
            "getLocalSourceBundleFailed": "Failed to get local source bundle",
            "analysisFailedUI": "AutoUpdate analysis failed in UI",
            "unknownAnalysisError": "An unknown error occurred during self-analysis.",
            "getServerSourceFailedZip": "No se pudo obtener el código fuente del servidor para el ZIP.",
            "unknownZipError": "Unknown error generating ZIP.",
            "unknownGitUploadError": "Unknown error during Git upload.",
            "autofixHelperFailed": "Could not get AI help for this error."
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
            "groupLogTitle": "Log Detallado del Análisis"
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
      "confirmDialog": {
        "title": "Confirmar Generación de Código",
        "llmSource": "Fuente LLM:",
        "promptLabel": "Prompt:"
      },
      "toast": {
        "descriptionEmpty": "Por favor, describe tu necesidad.",
        "codeGenerated": "El fragmento de código ha sido generado exitosamente.",
        "generationError": "Error de Generación"
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
        "downloadNote": "Nota: La descarga será un archivo ZIP con la estructura y contenido del proyecto.",
        "groupLogTitle": "Log Detallado del Grupo"
      },
      "confirmDialog": {
        "title": "Confirmar Generación de Proyecto",
        "currentPromptLabel": "Prompt Actual:",
        "redefinePromptLabel": "Redefinir Prompt (opcional):",
        "llmConfigInfo": "Configuración LLM a usar:",
        "confirmButton": "Sí, Generar Proyecto"
      },
      "toast": {
        "descriptionEmpty": "Por favor, describe tu proyecto.",
        "projectGenerated": "La estructura base del proyecto ha sido generada.",
        "generationError": "Error de Generación",
        "downloadError": "Sin Resultados",
        "downloadErrorDescription": "No hay estructura de proyecto para descargar.",
        "downloadSuccess": "Proyecto Descargado (ZIP)",
        "downloadSuccessDescription": "Se ha descargado un archivo ZIP con la estructura y contenido del proyecto \"{projectName}\"."
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
        }
      }
    },
    "errorDisplay": {
      "title": "Error Detectado",
      "copyButton": "Copiar Error",
      "autofixButton": "Auto-Fix con IA",
      "autofixingButton": "Analizando...",
      "toast": {
        "copied": "Error Copiado",
        "copiedDescription": "El mensaje de error ha sido copiado al portapapeles."
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
            "snapshotSaved": "Snapshot Guardado",
            "snapshotSavedDescription": "Snapshot \"{name}\" creado.",
            "snapshotDownloaded": "Snapshot Descargado",
            "snapshotDownloadedDescription": "Snapshot \"{name}\" descargado como {filename}.",
            "snapshotDeleted": "Snapshot Eliminado",
            "snapshotDeletedDescription": "Snapshot \"{name}\" eliminado.",
            "compareError": {
                "notFound": "No se encontraron los snapshots seleccionados.",
                "selectionIncomplete": "Selecciona dos versiones (A y B) para comparar."
            },
            "allSnapshotsDeleted": "Todos los Snapshots Eliminados"
        }
    },
    "chat": {
        "title": "AI Chat",
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
            "chatCleared": "Chat Limpiado",
            "chatClearedDescription": "El historial de la conversación ha sido borrado.",
            "chatError": "Error de Chat",
            "autofixError": "Error en Auto-Fix"
        },
        "autofix": {
            "userRequest": "Por favor, analiza este error y sugiere una solución: {errorMsg}"
        }
    },
    "agents": {
        "title": "AI Agent Management",
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
                "nameUneditableError": "El nombre del agente \"{name}\" no puede ser editado.",
                "deleteError": "El agente \"{name}\" no se puede eliminar."
            },
            "import": {
                "success": "Agentes Importados",
                "successDescription": "{count} agentes importados y/o actualizados.",
                "invalidFormat": "Formato JSON inválido para agentes.",
                "error": "Error de Importación"
            },
            "exportAll": {
                "success": "Agentes Exportados",
                "description": "Todos los agentes han sido exportados."
            },
            "exportSingle": {
                "success": "Agente Exportado",
                "description": "Agente \"{name}\" exportado."
            },
            "suggestion": {
                "roleRequired": "Descripción Requerida",
                "roleRequiredDescription": "Por favor, describe el rol del agente.",
                "received": "Sugerencia Recibida",
                "receivedDescription": "La IA ha sugerido una definición para el agente {name}.",
                "error": "Error de Sugerencia",
                "errorDescription": "No se pudo obtener la sugerencia."
            },
            "created": "Agente Creado",
            "createdDescription": "Agente \"{name}\" añadido.",
            "updated": "Agente Actualizado",
            "updatedDescription": "Agente \"{name}\" guardado.",
            "deleted": "Agente Eliminado",
            "deletedDescription": "Agente \"{name}\" eliminado."
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
                "nameRequired": "Nombre Requerido",
                "nameRequiredDescription": "El agente debe tener un nombre."
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
        "title": "AI Workgroup Management",
        "description": "Define y ejecuta equipos de agentes IA colaborativos.",
        "createWithAIButton": "Crear con IA",
        "createGroupButton": "Crear Grupo",
        "noGroupsMessage": "No hay grupos de trabajo creados.",
        "defaultGroupBadge": "(Por Defecto)",
        "agentsLabel": "Agentes:",
        "agentsCountFormat": "{count} (+ Orchestrator)",
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
                "fieldsRequired": "Campos Requeridos",
                "fieldsRequiredDescription": "El nombre y la tarea principal son obligatorios.",
                "agentsRequired": "Agentes Requeridos",
                "agentsRequiredDescription": "Selecciona al menos un agente participante (además del Orquestador)."
            }
        },
        "toast": {
            "created": "Grupo Creado",
            "createdDescription": "Grupo \"{name}\" añadido.",
            "updated": "Grupo Actualizado",
            "updatedDescription": "Grupo \"{name}\" guardado.",
            "deleted": "Grupo Eliminado",
            "deletedDescription": "Grupo \"{name}\" eliminado.",
            "suggestion": {
                "taskRequired": "Descripción Requerida",
                "taskRequiredDescription": "Por favor, describe la tarea del grupo.",
                "received": "Sugerencia Recibida",
                "receivedDescription": "La IA ha sugerido una definición para el grupo {name}.",
                "error": "Error de Sugerencia"
            },
            "execution": {
                "orchestratorError": "Error de Orquestador",
                "groupError": "Error de Grupo",
                "generalError": "Error de Ejecución"
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
            "starting": "Iniciando ejecución del grupo: {name}...",
            "taskPrefix": "Tarea Principal: ",
            "criticalError": {
                "orchestratorNotFound": "Agente Orquestrador ('orquestador-flujo-agentes') no encontrado. No se puede ejecutar el grupo.",
                "orchestratorParse": "Error al parsear la respuesta JSON del Orquestrador.",
                "orchestratorIncomplete": "Respuesta del Orquestrador incompleta (faltan next_agent_id o instruction_for_next_agent).",
                "agentNotFound": "Agente con ID \"{id}\" no encontrado."
            },
            "log": {
                "turnPrefix": "--- Turno {turn} ---",
                "orchestratorReceiving": "Orquestrador recibiendo: \"{input}...\"",
                "orchestratorRawResponse": "Orquestrador (raw JSON): {response}",
                "orchestratorDecision": "Decisión del Orquestrador: Siguiente Agente: {nextAgentId}. Instrucción: \"{instruction}...\". Razón: \"{reasoning}\"",
                "taskCompleted": "--- Tarea Completada --- \nResultado Final del Grupo: {result}",
                "callingAgent": "Llamando a Agente: {name}...",
                "agentResponse": "Respuesta de {name}: \"{response}...\"",
                "errorInTurn": "Error en Turno {turn}: {errorMessage}",
                "maxTurnsReached": "Se alcanzó el número máximo de turnos ({maxTurns}). Ejecución detenida.",
                "executionStoppedOrFinished": "Ejecución del grupo finalizada o detenida.",
                "userStopped": "Turno {turn}: Ejecución cancelada por el usuario."
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

/**
 * Utility type to extract all dot-separated keys from a nested object.
 * This can be used to create a more type-safe `TranslationKey` type.
 *
 * Example:
 * type EsKeys = DotNestedKeys<typeof translationsData['es']>;
 * // EsKeys would be "app.title" | "sidebar.dashboard" | "sidebar.toggle.hide" | etc.
 */
type Dot<T extends string, U extends string> = `` extends U ? T : `${T}.${U}`;

type DotNestedKeys<T> = T extends object
  ? {
      [K in Exclude<keyof T, symbol>]: K extends string
        ? Dot<K, DotNestedKeys<T[K]>> | K
        : never;
    }[Exclude<keyof T, symbol>]
  : '';

// To use the more type-safe keys, you could define:
// export type AppTranslationKey = DotNestedKeys<typeof translationsData['es']>;
// And then use AppTranslationKey instead of string for the `t` function's key parameter.
// For now, we keep TranslationKey as string for simplicity with potentially dynamic keys.

    