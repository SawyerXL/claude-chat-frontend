import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyIcon, CheckIcon, PlayIcon, StopIcon } from './icons/ClaudeIcons';
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

const RUNNABLE_LANGUAGES = ['javascript', 'js', 'python', 'py'];

export default function CodeBlock({ language, code, inline = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');

  const normalizedLang = LANGUAGE_ALIASES[language] || language || 'text';
  const canRun = RUNNABLE_LANGUAGES.includes(normalizedLang);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }

    setIsRunning(true);
    setOutput('⏳ 运行中...\n');

    if (normalizedLang === 'python' || normalizedLang === 'py') {
      // Python: use Pyodide
      try {
        if (!(window as any).loadPyodide) {
          setOutput('⏳ 加载 Python 环境...\n');
          await new Promise<void>((res, rej) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
            script.onload = () => res();
            script.onerror = () => rej(new Error('加载失败'));
            document.head.appendChild(script);
          });
        }

        const pyodide = await (window as any).loadPyodide();
        await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
        `);

        await pyodide.runPythonAsync(code);
        const stdout = pyodide.runPython('sys.stdout.getvalue()');
        const stderr = pyodide.runPython('sys.stderr.getvalue()');

        let result = '';
        if (stdout) result += stdout;
        if (stderr) result += '\n[Error]\n' + stderr;
        setOutput(result || '✅ 执行完成 (无输出)');
      } catch (err: any) {
        setOutput('❌ ' + (err.message || String(err)));
      }
    } else {
      // JavaScript: sandboxed iframe
      try {
        const iframe = document.createElement('iframe');
        iframe.sandbox.add('allow-scripts');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          setOutput('❌ 无法创建执行环境');
          setIsRunning(false);
          return;
        }

        let outputLines: string[] = [];

        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
          <script>
            const originalConsole = { log: console.log, error: console.error, warn: console.warn };
            function sendToParent(type, args) {
              const msg = Array.from(args).map(arg => {
                if (typeof arg === 'object') {
                  try { return JSON.stringify(arg, null, 2); }
                  catch { return String(arg); }
                }
                return String(arg);
              }).join(' ');
              window.parent.postMessage({ type: 'console', consoleType: type, content: msg }, '*');
            }
            console.log = function() { sendToParent('log', arguments); };
            console.error = function() { sendToParent('error', arguments); };
            console.warn = function() { sendToParent('warn', arguments); };
            window.addEventListener('message', function(e) {
              if (e.data.type === 'execute') {
                try {
                  const result = eval(e.data.code);
                  if (result !== undefined) {
                    window.parent.postMessage({ type: 'result', content: JSON.stringify(result, null, 2) }, '*');
                  } else {
                    window.parent.postMessage({ type: 'result', content: '' }, '*');
                  }
                } catch (err) {
                  window.parent.postMessage({ type: 'error', content: err.message }, '*');
                }
              }
            });
            window.parent.postMessage({ type: 'ready' }, '*');
          <\/script>
          </head>
          <body></body>
          </html>
        `);
        iframeDoc.close();

        const timeoutId = setTimeout(() => {
          document.body.removeChild(iframe);
          if (outputLines.length === 0) setOutput('⏰ 执行超时 (30秒)');
        }, 30000);

        const handler = (event: MessageEvent) => {
          if (event.source !== iframe.contentWindow) return;
          const { type, consoleType, content } = event.data;
          if (type === 'ready') {
            iframe.contentWindow?.postMessage({ type: 'execute', code }, '*');
          } else if (type === 'console') {
            outputLines.push(`[${consoleType}] ${content}`);
          } else if (type === 'result' || type === 'error') {
            if (type === 'error') outputLines.push(`❌ ${content}`);
            else if (content) outputLines.push(`📤 ${content}`);
            clearTimeout(timeoutId);
            window.removeEventListener('message', handler);
            document.body.removeChild(iframe);
            setOutput(outputLines.join('\n') || '✅ 执行完成');
          }
        };

        window.addEventListener('message', handler);
        return; // Don't setIsRunning(false) here, wait for result
      } catch (err: any) {
        setOutput('❌ ' + (err.message || String(err)));
      }
    }

    setIsRunning(false);
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
          {canRun && (
            <button
              className={`code-block-btn run ${isRunning ? 'running' : ''}`}
              onClick={handleRun}
              title={isRunning ? '停止' : '运行'}
            >
              {isRunning ? <StopIcon /> : <PlayIcon />}
              <span>{isRunning ? '停止' : '运行'}</span>
            </button>
          )}
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
            {copied ? <CheckIcon /> : <CopyIcon />}
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
      {output && (
        <div className="code-block-output">
          <div className="output-header">输出</div>
          <pre className="output-content">{output}</pre>
        </div>
      )}
    </div>
  );
}