import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Theme, ContentItem } from '../types';
import './ActionGroupBlock.css';

interface ActionGroupBlockProps {
  toolName: string;
  items: ContentItem[];
  theme?: Theme;
  onFileClick?: (filePath: string) => void;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractFileArg(args?: Record<string, unknown>): string | null {
  if (!args) return null;
  return (args.file_path || args.path || args.filename || args.filePath || null) as string | null;
}

function extractLineInfo(args?: Record<string, unknown>): string | null {
  if (!args) return null;
  const start = args.start_line || args.startLine || args.offset;
  const end = args.end_line || args.endLine || args.limit;
  if (start && end) return `L${start}-${end}`;
  if (start) return `L${start}`;
  return null;
}

export function ActionGroupBlock({ toolName, items, theme, onFileClick }: ActionGroupBlockProps) {
  const [groupExpanded, setGroupExpanded] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const name = capitalize(toolName || 'Tool');

  // 从第一个 item 提取文件路径（同组工具通常操作同一文件）
  const firstFilePath = extractFileArg(items[0]?.args);
  const firstLineInfo = extractLineInfo(items[0]?.args);

  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={theme === 'dark' ? oneDark : oneLight}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>{children}</code>
      );
    }
  };

  return (
    <div className="action-group">
      <div className="action-group-header" onClick={() => setGroupExpanded(!groupExpanded)}>
        <span className="action-group-tool">{name}</span>
        {firstFilePath && (
          <span
            className="action-group-file"
            onClick={e => { e.stopPropagation(); onFileClick?.(firstFilePath); }}
          >
            {firstFilePath}
          </span>
        )}
        {firstLineInfo && <span className="action-group-lines">{firstLineInfo}</span>}
        <span className="action-group-badge">{items.length}</span>
        <span className={`action-group-arrow ${groupExpanded ? 'expanded' : ''}`}>▾</span>
      </div>
      {groupExpanded && (
        <div className="action-group-list">
          {items.map((item, idx) => {
            const isOpen = expandedIndex === idx;
            const itemFile = extractFileArg(item.args);
            const itemLine = extractLineInfo(item.args);
            return (
              <div key={idx} className="action-group-item">
                <div className="action-group-item-header" onClick={() => setExpandedIndex(isOpen ? null : idx)}>
                  <span className="action-group-item-icon">{isOpen ? '▾' : '▸'}</span>
                  {itemFile ? (
                    <span
                      className="action-group-item-file"
                      onClick={e => { e.stopPropagation(); onFileClick?.(itemFile!); }}
                    >
                      {itemFile}
                    </span>
                  ) : (
                    <span className="action-group-item-idx">#{idx + 1}</span>
                  )}
                  {itemLine && <span className="action-group-item-lines">{itemLine}</span>}
                </div>
                {isOpen && (
                  <div className="action-group-item-content">
                    <ReactMarkdown remarkPlugins={[remarkBreaks]} components={markdownComponents}>
                      {item.text || '执行完成'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
