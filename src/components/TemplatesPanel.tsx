import { useState, useEffect } from 'react';
import { getTemplates, initDefaultTemplates, type PromptTemplate } from '../services/templates';
import { CloseIcon } from './icons/ClaudeIcons';
import '../styles/templates.css';

interface TemplatesPanelProps {
  open: boolean;
  onClose: () => void;
  onInsertTemplate: (content: string) => void;
}

export default function TemplatesPanel({ open, onClose, onInsertTemplate }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    if (open) {
      initDefaultTemplates();
      setTemplates(getTemplates());
    }
  }, [open]);

  const handleSelectTemplate = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    // Initialize variable values with defaults
    const defaults: Record<string, string> = {};
    template.variables.forEach(v => {
      defaults[v.name] = v.defaultValue || '';
    });
    setVariableValues(defaults);
    setShowEditor(true);
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;

    let result = selectedTemplate.template;
    for (const [key, value] of Object.entries(variableValues)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value || `{{${key}}}`);
    }

    onInsertTemplate(result);
    handleClose();
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setVariableValues({});
    setShowEditor(false);
    onClose();
  };

  // Group templates by category
  const categories = templates.reduce((acc, t) => {
    const cat = t.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, PromptTemplate[]>);

  if (!open) return null;

  return (
    <div className="templates-overlay" onClick={handleClose}>
      <div className="templates-panel" onClick={(e) => e.stopPropagation()}>
        <div className="templates-header">
          <h2>Prompt Templates</h2>
          <button className="close-btn" onClick={handleClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="templates-content">
          {showEditor && selectedTemplate ? (
            <div className="template-editor">
              <div className="template-editor-header">
                <button className="back-btn" onClick={() => setShowEditor(false)}>
                  ← Back
                </button>
                <h3>{selectedTemplate.name}</h3>
              </div>

              <div className="template-description">
                {selectedTemplate.description}
              </div>

              <div className="template-variables">
                {selectedTemplate.variables.map(variable => (
                  <div key={variable.name} className="variable-field">
                    <label>
                      {variable.label}
                      {variable.required && <span className="required">*</span>}
                    </label>
                    {variable.type === 'select' && variable.options ? (
                      <select
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      >
                        {variable.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <textarea
                        placeholder={`Enter ${variable.label.toLowerCase()}...`}
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                        rows={variable.type === 'text' ? 4 : 1}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="template-preview">
                <h4>Preview</h4>
                <div className="preview-content">
                  {(() => {
                    let result = selectedTemplate.template;
                    for (const [key, value] of Object.entries(variableValues)) {
                      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                      result = result.replace(regex, value || `<span class="placeholder">{{${key}}}</span>`);
                    }
                    return result;
                  })()}
                </div>
              </div>

              <div className="template-actions">
                <button className="apply-btn" onClick={handleApplyTemplate}>
                  Apply Template
                </button>
              </div>
            </div>
          ) : (
            <div className="templates-list">
              {Object.entries(categories).map(([category, items]) => (
                <div key={category} className="template-category">
                  <h4>{category}</h4>
                  <div className="template-items">
                    {items.map(template => (
                      <div
                        key={template.id}
                        className="template-item"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <div className="template-name">{template.name}</div>
                        <div className="template-desc">{template.description}</div>
                        <div className="template-vars">
                          {template.variables.map(v => (
                            <span key={v.name} className="var-tag">{v.label}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {templates.length === 0 && (
                <div className="templates-empty">
                  <p>No templates yet.</p>
                  <p>Create templates with dynamic variables like {'{{name}}'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}