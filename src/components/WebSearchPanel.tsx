import { useState } from 'react';
import { SearchIcon, LinkIcon, CloseIcon, ChevronDownIcon, ChevronUpIcon } from './icons/ClaudeIcons';
import './WebSearchPanel.css';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchPanelProps {
  onInsertSources?: (results: SearchResult[]) => void;
  onClose: () => void;
  open?: boolean;
}

export default function WebSearchPanel({ onInsertSources, onClose, open = true }: WebSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/session-api/api/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      
      if (json.code === 0 && json.data) {
        setResults(json.data.results || []);
      } else {
        setError(json.error || 'Search failed');
      }
    } catch (err) {
      setError('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInsertResults = () => {
    if (results.length > 0 && onInsertSources) {
      onInsertSources(results);
    }
    onClose();
  };

  return (
    <div className="web-search-panel">
      <div className="web-search-header">
        <div className="web-search-title">
          <SearchIcon />
          <span>Web Search</span>
        </div>
        <button className="web-search-close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="web-search-input-wrapper">
        <input
          type="text"
          className="web-search-input"
          placeholder="Search the web..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          className="web-search-btn" 
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="web-search-error">
          <span>⚠️ {error}</span>
          <span className="web-search-hint">
            提示: Web Search 需要后端服务支持。请联系管理员配置搜索API。
          </span>
        </div>
      )}

      {results.length > 0 && (
        <div className="web-search-results">
          <div className="web-search-results-header">
            <span>{results.length} results found</span>
            <button className="web-search-insert-btn" onClick={handleInsertResults}>
              Insert References
            </button>
          </div>
          {results.map((result, idx) => (
            <div key={idx} className="web-search-result-item">
              <div className="web-search-result-title">
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  {result.title}
                </a>
                <span className="web-search-result-badge">#{idx + 1}</span>
              </div>
              <div className="web-search-result-url">
                <LinkIcon />
                <span>{result.url}</span>
              </div>
              {result.snippet && (
                <div className="web-search-result-snippet">
                  {result.snippet}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="web-search-footer">
        <span>💡 Tip: Search results will be added as inline citations in your message</span>
      </div>
    </div>
  );
}

// Citation display component for messages
interface CitationDisplayProps {
  citations: SearchResult[];
}

export function CitationDisplay({ citations }: CitationDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (citations.length === 0) return null;

  return (
    <div className="citation-display">
      <button 
        className="citation-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span>📚 {citations.length} sources</span>
        {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
      
      {expanded && (
        <div className="citation-list">
          {citations.map((citation, idx) => (
            <div key={idx} className="citation-item">
              <span className="citation-number">[{idx + 1}]</span>
              <div className="citation-content">
                <a href={citation.url} target="_blank" rel="noopener noreferrer">
                  {citation.title}
                </a>
                {citation.snippet && (
                  <p className="citation-snippet">{citation.snippet}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}