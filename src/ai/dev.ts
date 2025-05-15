
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-code-from-description.ts';
import '@/ai/flows/analyze-self-code.ts';
import '@/ai/flows/refactor-project-with-ai.ts';
import '@/ai/flows/chat-with-agent-or-global-flow.ts';
import '@/ai/flows/chat-with-ai-group-flow.ts';
import '@/ai/flows/suggest-agent-definition-flow.ts';
import '@/ai/flows/suggest-group-definition-flow.ts';
import '@/ai/flows/analyze-code-snippet.ts';
import '@/ai/flows/generate-project-structure-flow.ts';
import '@/ai/flows/auto-fix-error-with-group-flow.ts';
