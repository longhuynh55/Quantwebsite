"use client";

import { cn } from '@/lib/utils';
import type { AssistantMessageBlock, Message } from '@/types/assistant';
import { User, Bot } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gradient-to-br from-blue-500 to-teal-500 text-white'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex-1 max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MessageContent content={message.content} isUser={isUser} />
        </div>
        {!isUser && message.messageBlocks && message.messageBlocks.length > 0 && (
          <div className="mt-3 space-y-3">
            {message.messageBlocks.map((block, idx) => (
              <MessageBlockView key={`${message.id}-block-${idx}`} block={block} />
            ))}
          </div>
        )}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 border-t border-gray-200/70 dark:border-gray-700/70 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Sources
            </p>
            <div className="space-y-1">
              {message.citations.map((citation) => (
                <div key={citation.id} className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-medium">{citation.title}</span>
                  {citation.symbol && <span> | {citation.symbol}</span>}
                  {citation.period && <span> | {citation.period}</span>}
                  {citation.endpoint && (
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400 break-all">
                      {citation.endpoint}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div
          className={cn(
            'text-xs mt-2 flex items-center gap-2 flex-wrap',
            isUser ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
          )}
        >
          {formatTime(message.timestamp)}
          {!isUser && message.grounded && (
            <span className="px-2 py-0.5 rounded-full border border-emerald-400/40 text-emerald-600 dark:text-emerald-300 text-[10px] uppercase tracking-wide">
              Grounded
            </span>
          )}
          {!isUser && message.policyStatus === 'fallback' && (
            <span className="px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-600 dark:text-amber-300 text-[10px] uppercase tracking-wide">
              Guarded
            </span>
          )}
          {!isUser && message.policyStatus === 'shadow_blocked' && (
            <span className="px-2 py-0.5 rounded-full border border-orange-400/40 text-orange-600 dark:text-orange-300 text-[10px] uppercase tracking-wide">
              Shadow Guard
            </span>
          )}
          {!isUser && message.dataConfidence && (
            <span className="text-[10px] uppercase tracking-wide">
              confidence: {message.dataConfidence}
            </span>
          )}
          {!isUser && message.meta?.providerUsed && (
            <span className="text-[10px]">
              via {message.meta.providerUsed}
              {message.meta.fallbackUsed ? ' (fallback)' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBlockView({ block }: { block: AssistantMessageBlock }) {
  if (!block) return null;

  if (block.type === "text") {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30 p-3">
        {block.title && (
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            {block.title}
          </p>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{block.content}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30 p-3 overflow-x-auto">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        {block.title}
      </p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {block.columns.map((column) => (
              <th
                key={column}
                className="text-left py-1 px-2 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="py-1 px-2 border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                >
                  {typeof cell === "number" && Number.isFinite(cell) ? cell.toLocaleString("en-US", { maximumFractionDigits: 4 }) : String(cell ?? "n/a")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {block.note && (
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{block.note}</p>
      )}
    </div>
  );
}

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  // Lightweight markdown-like formatting (headings, bullets, bold, inline code, fenced code).
  const formatContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const codeMatch = part.match(/^```[\w-]*\n?([\s\S]*?)```$/);
        const codeContent = codeMatch ? codeMatch[1] : part.replace(/```/g, '');
        return (
          <pre
            key={index}
            className={cn(
              'overflow-x-auto p-3 rounded-lg text-sm my-2',
              isUser
                ? 'bg-blue-700/50'
                : 'bg-gray-200 dark:bg-gray-900'
            )}
          >
            <code>{codeContent}</code>
          </pre>
        );
      }

      // Process inline formatting
      return (
        <span key={index}>
          {part.split('\n').map((line, lineIndex) => (
            <span key={`${index}-${lineIndex}`}>
              {lineIndex > 0 && <br />}
              {formatLine(line, isUser)}
            </span>
          ))}
        </span>
      );
    });
  };

  return <div className="whitespace-pre-wrap break-words">{formatContent(content)}</div>;
}

function formatLine(line: string, isUser: boolean): ReactNode {
  // Headers (simplified)
  if (line.startsWith('### ')) {
    return <span className="font-bold text-sm">{renderInline(line.slice(4), isUser)}</span>;
  }
  if (line.startsWith('## ')) {
    return <span className="font-bold">{renderInline(line.slice(3), isUser)}</span>;
  }
  if (line.startsWith('# ')) {
    return <span className="font-bold text-lg">{renderInline(line.slice(2), isUser)}</span>;
  }

  // Bullet points
  if (line.startsWith('- ') || line.startsWith('* ')) {
    return (
      <span className="pl-2">
        {'\u2022'} {renderInline(line.slice(2), isUser)}
      </span>
    );
  }

  return renderInline(line, isUser);
}

function renderInline(line: string, isUser: boolean): ReactNode {
  if (!line) return '';

  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of line.matchAll(tokenRegex)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(line.slice(lastIndex, index));
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`bold-${matchIndex}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`code-${matchIndex}`}
          className={cn(
            'px-1.5 py-0.5 rounded text-sm',
            isUser ? 'bg-blue-700/50' : 'bg-gray-200 dark:bg-gray-700'
          )}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = index + token.length;
    matchIndex += 1;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  if (nodes.length === 0) return line;
  if (nodes.length === 1) return nodes[0];
  return <>{nodes}</>;
}

function formatTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
