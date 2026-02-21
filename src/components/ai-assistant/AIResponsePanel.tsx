"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, ChevronDown, Bot } from 'lucide-react';

interface AIResponsePanelProps {
  explanation: string;
  rawResponse?: string;
  latencyMs?: number | null;
  className?: string;
}

export function AIResponsePanel({
  explanation,
  rawResponse,
  latencyMs,
  className,
}: AIResponsePanelProps) {
  // Format latency for display
  const latencyDisplay = React.useMemo(() => {
    if (latencyMs === null || latencyMs === undefined) return null;
    if (latencyMs < 1000) return `${latencyMs}ms`;
    return `${(latencyMs / 1000).toFixed(1)}s`;
  }, [latencyMs]);

  // Parse explanation into sections
  const sections = React.useMemo(() => {
    if (!explanation) return [];
    // Split by common section headers
    const lines = explanation.split('\n');
    const parsed: Array<{ title?: string; content: string }> = [];
    let currentSection: { title?: string; content: string } = { content: '' };

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Check for markdown headers
      if (trimmedLine.startsWith('## ')) {
        if (currentSection.content.trim()) {
          parsed.push(currentSection);
        }
        currentSection = { title: trimmedLine.slice(3).trim(), content: '' };
      } else if (trimmedLine.startsWith('### ')) {
        if (currentSection.content.trim()) {
          parsed.push(currentSection);
        }
        currentSection = { title: trimmedLine.slice(4).trim(), content: '' };
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        // Bold line as section title
        if (currentSection.content.trim()) {
          parsed.push(currentSection);
        }
        currentSection = { title: trimmedLine.slice(2, -2).trim(), content: '' };
      } else if (trimmedLine) {
        currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
      }
    }

    if (currentSection.content.trim()) {
      parsed.push(currentSection);
    }

    return parsed;
  }, [explanation]);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-teal-500">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <CardTitle className="text-sm">Giai Thich Chien Luoc</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {latencyDisplay && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="mr-1 h-3 w-3" />
                {latencyDisplay}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parsed Sections */}
        {sections.length > 0 ? (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div key={index} className="space-y-1">
                {section.title && (
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {section.title}
                  </h4>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
            {explanation}
          </p>
        )}

        {/* Raw Response Toggle */}
        {rawResponse && (
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              <FileText className="h-3.5 w-3.5" />
              Xem phan hoi JSON goc
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-800">
              {rawResponse}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
