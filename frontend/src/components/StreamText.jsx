import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

// Configure marked to break lines on newlines automatically
marked.setOptions({
  breaks: true,
  gfm: true
});

/**
 * Reusable component to simulate LLM text-streaming / typewriter effect.
 * @param {string} text - The full text to stream.
 * @param {number} speed - The delay per character in milliseconds (default: 15).
 * @param {boolean} simulate - If true, simulates streaming. If false, shows text immediately.
 * @param {boolean} markdown - If true, parses text as Markdown.
 */
export const StreamText = ({ text = '', speed = 15, simulate = true, markdown = false }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsStreaming(false);
      return;
    }

    const textStr = String(text);

    if (!simulate) {
      setDisplayedText(textStr);
      setIsStreaming(false);
      return;
    }

    setDisplayedText('');
    setIsStreaming(true);
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < textStr.length) {
        const char = textStr.charAt(index);
        setDisplayedText((prev) => prev + char);
        index++;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, simulate]);

  if (markdown) {
    // Append typewriter cursor inside the parsed HTML content if streaming
    const contentToParse = displayedText + (isStreaming ? ' <span class="terminal-cursor"></span>' : '');
    const rawMarkup = marked.parse(contentToParse);
    
    return (
      <div 
        className="markdown-content" 
        dangerouslySetInnerHTML={{ __html: rawMarkup }} 
      />
    );
  }

  return (
    <span style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
      {displayedText}
      {isStreaming && <span className="terminal-cursor"></span>}
    </span>
  );
};

export default StreamText;
