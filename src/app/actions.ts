// src/app/actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';

interface GetReadmeContentResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Server Action to read the content of the README.md file from the project root.
 * @returns {Promise<GetReadmeContentResult>} An object containing the success status,
 *                                          the content of the README.md file, or an error message.
 */
export async function getReadmeContent(): Promise<GetReadmeContentResult> {
  try {
    const readmePath = path.join(process.cwd(), 'README.md');
    const content = await fs.readFile(readmePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    console.error('[Server Action getReadmeContent] Error reading README.md:', error);
    return {
      success: false,
      error: 'No se pudo leer el archivo README.md del servidor.',
    };
  }
}
