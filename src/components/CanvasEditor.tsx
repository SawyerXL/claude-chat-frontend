import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayIcon, StopIcon, TrashIcon, CopyIcon, SpinnerIcon } from './icons/ClaudeIcons';
import './CanvasEditor.css';

interface ConsoleEntry {
  type: 'log' | 'error' | 'warn' | 'info' | 'result';
  content: string;
  timestamp: number;
}

interface CanvasEditorProps {
  initialCode: string;
  language?: 'javascript' | 'python' | 'html';
  onCodeChange?: (code: string) => void;
  onClose?: () => void;
}

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<any>;
  runPython: (code: string) => string;
  globals: any;
}

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';

let cachedPyodide: PyodideInstance | null = null;
let pyodideLoadingPromise: Promise<PyodideInstance> | null = null;

async function loadPyodide(): Promise<PyodideInstance> {
  if (cachedPyodide) return cachedPyodide;
  
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = new Promise(async (resolve, reject) => {
    try {
      if (!(window as any).loadPyodide) {
        await new Promise<void>((res, rej) => {
          const script = document.createElement('script');
          script.src = PYODIDE_CDN;
          script.onload = () => res();
          script.onerror = () => rej(new Error('Failed to load Pyodide script'));
          document.head.appendChild(script);
        });
      }
      const pyodide = await (window as any).loadPyodide();
      cachedPyodide = pyodide;
      resolve(pyodide);
    } catch (err) {
      pyodideLoadingPromise = null;
      reject(err);
    }
  });

  return pyodideLoadingPromise;
}

export default function CanvasEditor({
  initialCode,
  language = 'javascript',
  onCodeChange,
  onClose
}: CanvasEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideStatus, setPyodideStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearConsole = useCallback(() => {
    setConsoleLogs([]);
    setExecutionTime(null);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [consoleLogs, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener('message', messageHandlerRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (iframeRef.current) {
        document.body.removeChild(iframeRef.current);
      }
    };
  }, []);

  const addLog = useCallback((type: ConsoleEntry['type'], content: string) => {
    setConsoleLogs(prev => [...prev, { type, content, timestamp: Date.now() }]);
  }, []);

  const executeJavaScript = useCallback((jsCode: string) => {
    setIsRunning(true);
    setConsoleLogs([]);
    setExecutionTime(null);
    const startTime = Date.now();

    if (iframeRef.current) {
      document.body.removeChild(iframeRef.current);
    }
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
    }

    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframeRef.current = iframe;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      addLog('error', '无法创建执行环境');
      setIsRunning(false);
      return;
    }

    const capturedLogs: ConsoleEntry[] = [];

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          function sendToParent(type, args) {
            const message = Array.from(args).map(arg => {
              if (typeof arg === 'object') {
                try { return JSON.stringify(arg, null, 2); }
                catch { return String(arg); }
              }
              return String(arg);
            }).join(' ');
            window.parent.postMessage({ type: 'console', consoleType: type, content: message }, '*');
          }

          console.log = function() { sendToParent('log', arguments); };
          console.error = function() { sendToParent('error', arguments); };
          console.warn = function() { sendToParent('warn', arguments); };
          console.info = function() { sendToParent('info', arguments); };

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
        </script>
      </head>
      <body></body>
      </html>
    `);
    iframeDoc.close();

    const messageHandler = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;

      const { type, consoleType, content } = event.data;

      if (type === 'ready') {
        iframe.contentWindow?.postMessage({ type: 'execute', code: jsCode }, '*');
      } else if (type === 'console') {
        capturedLogs.push({ type: consoleType, content, timestamp: Date.now() });
        setConsoleLogs([...capturedLogs]);
      } else if (type === 'result') {
        if (content) {
          capturedLogs.push({ type: 'result', content, timestamp: Date.now() });
          setConsoleLogs([...capturedLogs]);
        }
        setExecutionTime(Date.now() - startTime);
      } else if (type === 'error') {
        capturedLogs.push({ type: 'error', content, timestamp: Date.now() });
        setConsoleLogs([...capturedLogs]);
        setExecutionTime(Date.now() - startTime);
      }
    };

    messageHandlerRef.current = messageHandler;
    window.addEventListener('message', messageHandler);

    timeoutRef.current = window.setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      setIsRunning(false);
      if (capturedLogs.length === 0) {
        addLog('error', '执行超时 (30秒)');
      }
    }, 30000);
  }, [addLog]);

  const executePython = useCallback(async (pyCode: string) => {
    setIsRunning(true);
    setConsoleLogs([]);
    setExecutionTime(null);
    setPyodideStatus('loading');
    const startTime = Date.now();

    try {
      const pyodide = await loadPyodide();
      setPyodideStatus('ready');

      await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      try {
        await pyodide.runPythonAsync(pyCode);
        const stdout = pyodide.runPython('sys.stdout.getvalue()');
        const stderr = pyodide.runPython('sys.stderr.getvalue()');

        if (stdout) {
          stdout.split('\n').filter((line: string) => line.trim()).forEach((line: string) => addLog('log', line));
        }
        if (stderr) {
          stderr.split('\n').filter((line: string) => line.trim()).forEach((line: string) => addLog('error', line));
        }
        if (!stdout && !stderr) {
          addLog('info', '(无输出)');
        }
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        errorMsg.split('\n').forEach((line: string) => addLog('error', line));
      }

      setExecutionTime(Date.now() - startTime);
    } catch (err: any) {
      setPyodideStatus('error');
      addLog('error', `加载 Python 环境失败: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [addLog]);

  const handleRun = useCallback(() => {
    if (isRunning) return;
    onCodeChange?.(code);
    if (language === 'python') {
      executePython(code);
    } else {
      executeJavaScript(code);
    }
  }, [code, language, isRunning, executePython, executeJavaScript, onCodeChange]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    addLog('info', '已停止执行');
  }, [addLog]);

  const handleCopyOutput = useCallback(() => {
    const allOutput = [
      ...consoleLogs.map(l => `[${l.type}] ${l.content}`),
    ].join('\n');
    navigator.clipboard.writeText(allOutput || '(无输出)');
  }, [consoleLogs]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newCode = code.substring(0, start) + '  ' + code.substring(end);
        setCode(newCode);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
        onCodeChange?.(newCode);
      }
    }
  }, [code, handleRun, onCodeChange]);

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'result': return '✅';
      default: return '📝';
    }
  };

  const lineCount = code.split('\n').length;
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="canvas-editor">
      <div className="canvas-header">
        <div className="canvas-title">
          <span className="canvas-icon">🎨</span>
          <span>Canvas - {language === 'python' ? 'Python' : language === 'html' ? 'HTML' : 'JavaScript'}</span>
          {isRunning && <SpinnerIcon style={{ marginLeft: 8, fontSize: 14 }} />}
        </div>
        <div className="canvas-actions">
          <button
            className="canvas-btn run"
            onClick={handleRun}
            disabled={isRunning}
            title="运行代码 (Ctrl+Enter)"
          >
            {isRunning ? <SpinnerIcon /> : <PlayIcon />}
            <span>{isRunning ? '运行中...' : '运行'}</span>
          </button>
          {isRunning && (
            <button className="canvas-btn stop" onClick={handleStop} title="停止">
              <StopIcon />
              <span>停止</span>
            </button>
          )}
          <button className="canvas-btn" onClick={clearConsole} title="清除输出 (Ctrl+L)">
            <TrashIcon />
          </button>
          <button className="canvas-btn" onClick={handleCopyOutput} title="复制输出">
            <CopyIcon />
          </button>
          {onClose && (
            <button className="canvas-btn close" onClick={onClose} title="关闭">
              <span>✕</span>
            </button>
          )}
        </div>
      </div>

      <div className="canvas-body">
        <div className="canvas-code-area">
          <div className="code-header">
            <span>代码编辑器</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {language === 'python' && (
                <span className={`pyodide-status ${pyodideStatus}`}>
                  {pyodideStatus === 'loading' && '⏳ 加载 Python...'}
                  {pyodideStatus === 'ready' && '✅ Python 就绪'}
                  {pyodideStatus === 'error' && '❌ Python 加载失败'}
                </span>
              )}
              {executionTime !== null && (
                <span className="execution-time">⏱ {executionTime}ms</span>
              )}
            </div>
          </div>
          <div className="code-editor-container">
            <div className="line-numbers">
              {lines.map(n => (
                <div key={n} className="line-number">{n}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="code-textarea"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                onCodeChange?.(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={language === 'python'
                ? '# Python 代码\nprint("Hello, World!")'
                : language === 'html'
                ? '<!-- HTML 代码 -->\n<div>Hello World</div>'
                : '// JavaScript 代码\nconsole.log("Hello, World!");'
              }
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>

        <div className="canvas-output-area" ref={consoleRef}>
          <div className="output-header">
            <span>控制台输出</span>
            <span className="log-count">{consoleLogs.length} 条</span>
          </div>
          <div className="console-output">
            {consoleLogs.length === 0 && (
              <div className="empty-console">
                {isRunning ? '执行中...' : '点击"运行"按钮或按 Ctrl+Enter 执行代码'}
              </div>
            )}
            {consoleLogs.map((log, idx) => (
              <div key={idx} className={`console-entry ${log.type}`}>
                <span className="log-icon">{getLogIcon(log.type)}</span>
                <span className="log-content">{log.content}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="canvas-footer">
        <div className="footer-hint">
          💡 {language === 'python' ? 'Python 首次加载 Pyodide 可能需要几秒' : 'JavaScript 在沙盒中执行'}
        </div>
        <div className="footer-shortcuts">
          <span>Ctrl+Enter: 运行</span>
          <span>Tab: 缩进</span>
        </div>
      </div>
    </div>
  );
}