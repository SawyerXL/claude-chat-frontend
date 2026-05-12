import type { Artifact } from '../types';

// Pattern to detect artifacts in markdown
const ARTIFACT_BLOCK_PATTERN = /^```(?:artifact):(\w+)(?:\s*"([^"]*)")?\s*\n([\s\S]*?)^```$/gm;

interface ParsedArtifact {
  artifact: Artifact;
  before: string;
  after: string;
}

export function parseArtifacts(content: string): ParsedArtifact[] {
  const results: ParsedArtifact[] = [];
  let lastIndex = 0;
  let match;

  const regex = new RegExp(ARTIFACT_BLOCK_PATTERN.source, 'gm');

  while ((match = regex.exec(content)) !== null) {
    const [, type, title, code] = match;
    const artifact: Artifact = {
      id: `artifact-${Date.now()}-${results.length}`,
      type: type as Artifact['type'],
      title: title || getDefaultTitle(type),
      content: code.trim(),
      language: type,
      code: code.trim(),
      createdAt: Date.now(),
    };

    results.push({
      artifact,
      before: content.slice(lastIndex, match.index),
      after: '',
    });

    lastIndex = match.index + match[0].length;
  }

  return results;
}

function getDefaultTitle(type: string): string {
  const titles: Record<string, string> = {
    'react': 'React Component',
    'html': 'HTML',
    'svg': 'SVG',
    'python': 'Python',
    'html-react': 'React Component',
    '_generative': 'Generative Art',
    'notebook': 'Notebook',
  };
  return titles[type] || 'Code';
}

export function hasArtifacts(content: string): boolean {
  return /```(?:artifact):(\w+)/.test(content);
}

export function extractSimpleCodeBlocks(content: string): { language: string; code: string; fullMatch: string }[] {
  const results: { language: string; code: string; fullMatch: string }[] = [];
  const pattern = /^```(\w*)\s*\n([\s\S]*?)^```$/gm;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const [, language, code] = match;
    // Skip if it's an artifact block
    if (language.startsWith('artifact:')) continue;
    
    results.push({
      language: language || 'text',
      code: code.trim(),
      fullMatch: match[0],
    });
  }

  return results;
}

// Convert artifacts to plain text for message display
export function removeArtifacts(content: string): string {
  return content.replace(/^```(?:artifact):\w+(?:\s*"[^"]*")?\s*\n[\s\S]*?^```$/gm, '');
}
