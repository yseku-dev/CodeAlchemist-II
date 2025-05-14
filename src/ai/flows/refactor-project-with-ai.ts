// src/ai/flows/refactor-project-with-ai.ts
'use server';

/**
 * @fileOverview Refactors a project with AI to provide refactoring suggestions.
 *
 * - refactorProjectWithAI - A function that handles the project refactoring process.
 * - RefactorProjectWithAIInput - The input type for the refactorProjectWithAI function.
 * - RefactorProjectWithAIOutput - The return type for the refactorProjectWithAI function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefactorProjectWithAIInputSchema = z.object({
  projectSource: z.string().describe('The project source, either a ZIP file or a Git URL.'),
  goals: z.string().optional().describe('Specific goals for the refactoring process.'),
  priority: z
    .string()
    .optional() // Consider making this an enum with values like 'Security', 'Readability', 'Performance'
    .describe('General priority for the refactoring, e.g., Security, Readability, Performance.'),
});
export type RefactorProjectWithAIInput = z.infer<typeof RefactorProjectWithAIInputSchema>;

const RefactorProjectWithAIOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      area: z.string().describe('The file or component affected by the suggestion.'),
      description: z.string().describe('A detailed explanation of the proposed improvement.'),
      priority: z.string().describe('The priority of the suggestion (High, Medium, Low).'),
      snippetSuggested: z
        .object({
          original: z.string().optional().describe('Original code snippet.'),
          modified: z.string().optional().describe('Modified code snippet.'),
        })
        .optional()
        .describe('Suggested code snippet with original and modified code.'),
    })
  ),
});
export type RefactorProjectWithAIOutput = z.infer<typeof RefactorProjectWithAIOutputSchema>;

export async function refactorProjectWithAI(input: RefactorProjectWithAIInput): Promise<RefactorProjectWithAIOutput> {
  return refactorProjectWithAIFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refactorProjectWithAIPrompt',
  input: {schema: RefactorProjectWithAIInputSchema},
  output: {schema: RefactorProjectWithAIOutputSchema},
  prompt: `You are an AI expert in code refactoring. Analyze the provided project source and provide refactoring suggestions.

Project Source: {{{projectSource}}}
Goals: {{{goals}}}
Priority: {{{priority}}}

Provide suggestions in the following JSON format:

{
  "suggestions": [
    {
      "area": "file/component/affected",
      "description": "explanation of improvement",
      "priority": "High/Medium/Low",
      "snippetSuggested": {
        "original": "original code snippet",
        "modified": "modified code snippet"
      }
    }
  ]
}
`,
});

const refactorProjectWithAIFlow = ai.defineFlow(
  {
    name: 'refactorProjectWithAIFlow',
    inputSchema: RefactorProjectWithAIInputSchema,
    outputSchema: RefactorProjectWithAIOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
