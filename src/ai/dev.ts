import { config } from 'dotenv';
config();

import '@/ai/flows/generate-code-from-description.ts';
import '@/ai/flows/analyze-self-code.ts';
import '@/ai/flows/refactor-project-with-ai.ts';