import type { Audience } from '../../types/api';
import { runDeepSeekJson } from './client';
import { editorPrompt } from './prompts';

export type EditorOutput = {
  coreEvent: string;
  facts: string[];
  uncertainClaims: string[];
  topicSuggestions: {
    title: string;
    angle: string;
    reason: string;
    audiences: Audience[];
  }[];
};

export async function runEditorAgent(input: { rawText: string; title?: string; url?: string }) {
  return runDeepSeekJson<EditorOutput>(editorPrompt(input));
}
