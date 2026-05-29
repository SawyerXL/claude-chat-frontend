import { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  CopyIcon,
} from './icons/ClaudeIcons';
import './CanvasEditor.css';

interface ConsoleEntry {
  type: 'log' | 'error' | 'warn' | 'result';
  content: string;
  timestamp: number;
}

interface CanvasEditorProps {
  initialCode: string;
  language?: 'javascript' | 'python' | 'html';
  onCodeChange?: (code: string) => void;
  onClose?: () => void;
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
  const [output, setOutput] = useState<string>('');
  const consoleRef = useRef<HTMLDivElement>(null);

  const clearConsole = () => {
    setConsoleLogs([]);
    setOutput('');
  };

  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [consoleLogs, output]);

  const executeJavaScript = (jsCode: string) => {
    setIsRunning(true);
    setConsoleLogs([]);
    setOutput('');

    // Create a sandboxed iframe for execution
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      setConsoleLogs([{ type: 'error', content: '无法创建执行环境', timestamp: Date.now() }]);
      setIsRunning(false);
      document.body.removeChild(iframe);
      return;
    }

    // Override console methods to capture output
    const capturedLogs: ConsoleEntry[] = [];
    
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          // Override console methods
          const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
          };
          
          function sendToParent(type, args) {
            const message = Array.from(args).map(arg => {
              if (typeof arg === 'object') {
                try {
                  return JSON.stringify(arg, null, 2);
                } catch {
                  return String(arg);
                }
              }
              return String(arg);
            }).join(' ');
            window.parent.postMessage({ type: 'console', consoleType: type, content: message }, '*');
          }
          
          console.log = function() { sendToParent('log', arguments); originalConsole.log.apply(console, arguments); };
          console.error = function() { sendToParent('error', arguments); originalConsole.error.apply(console, arguments); };
          console.warn = function() { sendToParent('warn', arguments); originalConsole.warn.apply(console, arguments); };
          console.info = function() { sendToParent('info', arguments); originalConsole.info.apply(console, arguments); };
          
          // Listen for code execution
          window.addEventListener('message', function(e) {
            if (e.data.type === 'execute') {
              try {
                const result = eval(e.data.code);
                if (result !== undefined) {
                  window.parent.postMessage({ type: 'result', content: JSON.stringify(result, null, 2) }, '*');
                }
              } catch (err) {
                window.parent.postMessage({ type: 'error', content: err.message }, '*');
              }
            }
          });
          
          // Notify ready
          window.parent.postMessage({ type: 'ready' }, '*');
        </script>
      </head>
      <body></body>
      </html>
    `);
    iframeDoc.close();

    // Listen for messages from iframe
    const messageHandler = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      
      const { type, consoleType, content } = event.data;
      
      if (type === 'ready') {
        // Iframe is ready, send code to execute
        iframe.contentWindow?.postMessage({ type: 'execute', code: jsCode }, '*');
      } else if (type === 'console') {
        capturedLogs.push({
          type: consoleType,
          content: content,
          timestamp: Date.now()
        });
        setConsoleLogs([...capturedLogs]);
      } else if (type === 'result') {
        setOutput(content);
      } else if (type === 'error') {
        capturedLogs.push({
          type: 'error',
          content: content,
          timestamp: Date.now()
        });
        setConsoleLogs([...capturedLogs]);
      }
    };

    window.addEventListener('message', messageHandler);

    // Timeout for execution
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      setIsRunning(false);
      document.body.removeChild(iframe);
    }, 30000);
  };

  const executePython = async (pyCode: string) => {
    setIsRunning(true);
    setConsoleLogs([]);
    setOutput('正在执行 Python 代码...\n');
    
    try {
      // Try to use Pyodide if available, otherwise show message
      const hasPyodide = (window as any).loadPyodide;
      
      if (!hasPyodide) {
        // Load Pyodide dynamically
        setOutput('正在加载 Python 环境...\n');
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        document.head.appendChild(script);
        
        script.onload = async () => {
          try {
            const pyodide = await (window as any).loadPyodide();
            
            // Redirect stdout
            await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
            `);
            
            // Run the code
            setOutput('执行中...\n');
            await pyodide.runPythonAsync(pyCode);
            
            // Get output
            const stdout = pyodide.runPython('sys.stdout.getvalue()');
            const stderr = pyodide.runPython('sys.stderr.getvalue()');
            
            let result = '';
            if (stdout) result += stdout;
            if (stderr) result += '\n[Error]\n' + stderr;
            
            setOutput(result || '(无输出)');
            setIsRunning(false);
          } catch (err: any) {
            setConsoleLogs([{ type: 'error', content: err.message, timestamp: Date.now() }]);
            setIsRunning(false);
          }
        };
        
        script.onerror = () => {
          setConsoleLogs([{ 
            type: 'error', 
            content: '无法加载 Python 环境。请检查网络连接。', 
            timestamp: Date.now() 
          }]);
          setIsRunning(false);
        };
      }
    } catch (err: any) {
      setConsoleLogs([{ type: 'error', content: err.message, timestamp: Date.now() }]);
      setIsRunning(false);
    }
  };

  const handleRun = () => {
    if (language === 'python') {
      executePython(code);
    } else {
      executeJavaScript(code);
    }
    onCodeChange?.(code);
  };

  const handleStop = () => {
    setIsRunning(false);
    // Note: We can't actually stop iframe execution, but we can stop the UI state
  };

  const handleCopyOutput = () => {
    const allOutput = [
      ...consoleLogs.map(l => `[${l.type}] ${l.content}`),
      output ? `\n=== Output ===\n${output}` : ''
    ].join('\n');
    
    navigator.clipboard.writeText(allOutput);
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'result': return '✅';
      default: return '📝';
    }
  };

  return (
    <div className="canvas-editor">
      <div className="canvas-header">
        <div className="canvas-title">
          <span className="canvas-icon">🎨</span>
          <span>Canvas - {language === 'python' ? 'Python' : 'JavaScript'}</span>
        </div>
        <div className="canvas-actions">
          <button 
            className="canvas-btn run" 
            onClick={handleRun}
            disabled={isRunning}
            title="运行代码"
          >
            {isRunning ? <span className="spinner" /> : <PlayIcon />}
            <span>{isRunning ? '运行中...' : '运行'}</span>
          </button>
          {isRunning && (
            <button className="canvas-btn stop" onClick={handleStop} title="停止">
              <StopIcon />
            </button>
          )}
          <button className="canvas-btn" onClick={clearConsole} title="清除输出">
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
            <select 
              value={language} 
              onChange={() => {/* language change would reset code */}}
              className="language-select"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
            </select>
          </div>
          <textarea
            className="code-textarea"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              onCodeChange?.(e.target.value);
            }}
            placeholder={language === 'python' 
              ? '# Python 代码\nprint("Hello, World!")' 
              : '// JavaScript 代码\nconsole.log("Hello, World!");'
            }
            spellCheck={false}
          />
        </div>

        <div className="canvas-output-area" ref={consoleRef}>
          <div className="output-header">
            <span>控制台输出</span>
            <span className="log-count">{consoleLogs.length} 条日志</span>
          </div>
          <div className="console-output">
            {consoleLogs.length === 0 && !output && (
              <div className="empty-console">
                点击"运行"按钮执行代码，结果将显示在这里
              </div>
            )}
            {consoleLogs.map((log, idx) => (
              <div key={idx} className={`console-entry ${log.type}`}>
                <span className="log-icon">{getLogIcon(log.type)}</span>
                <span className="log-content">{log.content}</span>
              </div>
            ))}
            {output && (
              <div className="output-section">
                <div className="output-label">📤 输出结果:</div>
                <pre className="output-content">{output}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="canvas-footer">
        <div className="footer-hint">
          💡 提示: JavaScript 在浏览器沙盒中执行，Python 需要加载 Pyodide 环境
        </div>
        <div className="footer-shortcuts">
          <span>Ctrl+Enter: 运行</span>
          <span>Ctrl+L: 清除</span>
        </div>
      </div>
    </div>
  );
}