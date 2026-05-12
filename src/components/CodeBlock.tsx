import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import './CodeBlock.css';

interface CodeBlockProps {
  language: string;
  code: string;
  inline?: boolean;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'yml': 'yaml',
  'sh': 'bash',
  'shell': 'bash',
  'zsh': 'bash',
};

export default function CodeBlock({ language, code, inline = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const normalizedLang = LANGUAGE_ALIASES[language] || language || 'text';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="inline-code">
        {code}
      </code>
    );
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <div className="code-block-lang">{normalizedLang}</div>
        <div className="code-block-actions">
          <button
            className={`code-block-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Dark"
          >
            🌙
          </button>
          <button
            className={`code-block-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            title="Light"
          >
            ☀️
          </button>
          <button
            className="code-block-btn copy"
            onClick={handleCopy}
            title="Copy"
          >
            {copied ? <CheckOutlined /> : <CopyOutlined />}
          </button>
        </div>
      </div>
      <div className="code-block-content">
        <SyntaxHighlighter
          language={normalizedLang}
          style={theme === 'dark' ? vscDarkPlus : oneLight}
          showLineNumbers={code.split('\n').length > 3}
          customStyle={{
            margin: 0,
            padding: '16px',
            fontSize: '13px',
            lineHeight: '1.5',
            background: 'transparent',
          }}
          codeTagProps={{
            style: {
              fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
