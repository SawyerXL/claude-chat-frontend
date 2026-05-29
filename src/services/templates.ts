/**
 * Template Variables Service
 * Handles prompt templates with dynamic variables
 */

const TEMPLATES_KEY = 'claude_prompt_templates';

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number';
  defaultValue?: string;
  options?: string[]; // For select type
  required?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string; // Template content with {{variable}} syntax
  variables: TemplateVariable[];
  createdAt: number;
  updatedAt: number;
  category?: string;
}

function loadTemplates(): PromptTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveTemplates(templates: PromptTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

/**
 * Get all templates
 */
export function getTemplates(): PromptTemplate[] {
  return loadTemplates();
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): PromptTemplate | null {
  const templates = loadTemplates();
  return templates.find(t => t.id === id) || null;
}

/**
 * Create a new template
 */
export function createTemplate(
  name: string,
  description: string,
  template: string,
  variables: TemplateVariable[],
  category?: string
): PromptTemplate {
  const templates = loadTemplates();
  const newTemplate: PromptTemplate = {
    id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    description,
    template,
    variables,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category,
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  return newTemplate;
}

/**
 * Update a template
 */
export function updateTemplate(
  id: string,
  updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>
): PromptTemplate | null {
  const templates = loadTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx < 0) return null;

  templates[idx] = {
    ...templates[idx],
    ...updates,
    updatedAt: Date.now(),
  };
  saveTemplates(templates);
  return templates[idx];
}

/**
 * Delete a template
 */
export function deleteTemplate(id: string): boolean {
  const templates = loadTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx < 0) return false;

  templates.splice(idx, 1);
  saveTemplates(templates);
  return true;
}

/**
 * Parse template and return variable names
 */
export function parseTemplateVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Apply variable values to template
 */
export function applyTemplateValues(
  template: string,
  values: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Build a template with default values
 */
export function buildTemplate(
  promptTemplate: PromptTemplate,
  customValues?: Record<string, string>
): string {
  const values: Record<string, string> = {};

  // Fill in default values
  for (const variable of promptTemplate.variables) {
    values[variable.name] = variable.defaultValue || '';
  }

  // Override with custom values
  if (customValues) {
    for (const [key, value] of Object.entries(customValues)) {
      if (key in values || promptTemplate.variables.some(v => v.name === key)) {
        values[key] = value;
      }
    }
  }

  return applyTemplateValues(promptTemplate.template, values);
}

/**
 * Default templates
 */
export const DEFAULT_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Code Review',
    description: 'Review code for bugs, style issues, and improvements',
    template: `Please review the following code:\n\n{{code}}\n\nFocus on:\n- Potential bugs\n- Code style\n- Performance improvements\n- Security issues`,
    variables: [
      { name: 'code', label: 'Code', type: 'text', required: true },
    ],
    category: 'Development',
  },
  {
    name: 'Translation',
    description: 'Translate text between languages',
    template: `Translate the following text to {{target_language}}:\n\n{{text}}`,
    variables: [
      { name: 'text', label: 'Text to translate', type: 'text', required: true },
      {
        name: 'target_language',
        label: 'Target Language',
        type: 'select',
        defaultValue: 'Chinese',
        options: ['Chinese', 'English', 'Japanese', 'Korean', 'French', 'German', 'Spanish'],
      },
    ],
    category: 'General',
  },
  {
    name: 'Meeting Summary',
    description: 'Summarize meeting notes',
    template: `Summarize the following meeting notes:\n\n{{notes}}\n\nFormat:\n- Key decisions\n- Action items\n- Next steps`,
    variables: [
      { name: 'notes', label: 'Meeting Notes', type: 'text', required: true },
    ],
    category: 'Business',
  },
  {
    name: 'Email Draft',
    description: 'Draft a professional email',
    template: `Write a professional email:\n\nTo: {{to}}\nSubject: {{subject}}\n\nPurpose: {{purpose}}`,
    variables: [
      { name: 'to', label: 'Recipient', type: 'text', required: true },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'purpose', label: 'Email Purpose', type: 'text', required: true },
    ],
    category: 'Business',
  },
];

/**
 * Initialize default templates
 */
export function initDefaultTemplates() {
  const templates = loadTemplates();
  if (templates.length === 0) {
    for (const tmpl of DEFAULT_TEMPLATES) {
      createTemplate(
        tmpl.name,
        tmpl.description,
        tmpl.template,
        tmpl.variables,
        tmpl.category
      );
    }
  }
}