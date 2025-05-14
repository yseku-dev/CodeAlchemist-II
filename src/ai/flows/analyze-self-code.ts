// src/ai/flows/analyze-self-code.ts
'use server';

/**
 * @fileOverview Flow for analyzing CodeAlchemist's own source code to identify areas for improvement, bugs, or potential refactorings.
 *
 * - analyzeSelfCode - A function that initiates the self-analysis process.
 * - AnalyzeSelfCodeInput - The input type for the analyzeSelfCode function.
 * - AnalyzeSelfCodeOutput - The return type for the analyzeSelfCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeSelfCodeInputSchema = z.object({
  sourceCodeLocation: z.enum(['Local', 'Git']).describe('The location of the source code to analyze. Can be either the local file system or a Git repository.'),
  gitRepoUrl: z.string().optional().describe('The URL of the Git repository to analyze, if the source code location is Git.'),
  analysisPreferences: z.string().optional().describe('Specific areas or concerns to focus the analysis on (e.g., performance, security, specific components).'),
});
export type AnalyzeSelfCodeInput = z.infer<typeof AnalyzeSelfCodeInputSchema>;

const AnalyzeSelfCodeOutputSchema = z.object({
  analysisTitle: z.string().describe('A concise title summarizing the findings of the analysis.'),
  identifiedAreas: z.array(z.string()).describe('A list of components, modules, or files identified as areas of concern.'),
  detailedSuggestions: z.array(z.object({
    area: z.string().describe('The specific area affected by the suggestion (e.g., file path, component name).'),
    suggestion: z.string().describe('A detailed suggestion for improvement or correction.'),
    priority: z.enum(['Alta', 'Media', 'Baja']).describe('The priority of the suggestion.'),
    suggestedContent: z.string().optional().describe('The suggested content of the analyzed file. This includes the full file content, and not just a snippet.'),
  })).describe('A list of detailed suggestions for improvement.'),
  generalAssessment: z.string().describe('An overall assessment of the code quality and potential issues.'),
});
export type AnalyzeSelfCodeOutput = z.infer<typeof AnalyzeSelfCodeOutputSchema>;

export async function analyzeSelfCode(input: AnalyzeSelfCodeInput): Promise<AnalyzeSelfCodeOutput> {
  return analyzeSelfCodeFlow(input);
}

const analyzeSelfCodePrompt = ai.definePrompt({
  name: 'analyzeSelfCodePrompt',
  input: {schema: AnalyzeSelfCodeInputSchema},
  output: {schema: AnalyzeSelfCodeOutputSchema},
  prompt: `You are a code analysis expert tasked with analyzing the CodeAlchemist application's own source code to identify areas for improvement, potential bugs, and refactoring opportunities. All suggestions should be in castellano.

Source Code Location: {{{sourceCodeLocation}}}
{% if sourceCodeLocation === 'Git' %}
Git Repo URL: {{{gitRepoUrl}}}
{% endif %}
Analysis Preferences: {{{analysisPreferences}}}

Please provide the following information in your analysis:

*   Analysis Title: A concise title summarizing the findings.
*   Identified Areas: A list of components, modules, or files that require attention.
*   Detailed Suggestions: A list of specific suggestions for improvement, including the affected area, the suggestion itself, the priority (Alta, Media, or Baja), and the full file content, with the suggestions applied.
*   General Assessment: An overall assessment of the code quality and potential issues.
`,
});

const analyzeSelfCodeFlow = ai.defineFlow(
  {
    name: 'analyzeSelfCodeFlow',
    inputSchema: AnalyzeSelfCodeInputSchema,
    outputSchema: AnalyzeSelfCodeOutputSchema,
  },
  async input => {
    const {output} = await analyzeSelfCodePrompt(input);
    return output!;
  }
);

