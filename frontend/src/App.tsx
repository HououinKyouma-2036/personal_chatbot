import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
  isStreaming?: boolean;
}

// Helper function to detect and parse code blocks in markdown
const parseCodeBlocks = (text: string) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // Add code block
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return parts;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [botRole, setBotRole] = useState('');
  const [roleSelected, setRoleSelected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Handle role selection
  const handleRoleSelect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botRole.trim()) return;
    
    setRoleSelected(true);
  };

  // Sends conversation history (messages array) to the backend.
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Append the new user message to the conversation.
    const newMessages: Message[] = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      console.log("Sending request to backend...");
      console.log("Bot role being sent:", botRole);
      const apiUrl = 'http://127.0.0.1:5000/api/chat';
      console.log("API URL:", apiUrl);
      
      // Clean messages before sending to backend - remove reasoning_content
      const cleanedMessages = newMessages.map(({ role, content }) => ({
        role,
        content
      }));
      
      // Add a placeholder for the assistant's response
      const placeholderMessage: Message = {
        role: 'assistant',
        content: '',
        reasoning_content: '',
        isStreaming: true
      };
      
      setMessages(prev => [...prev, placeholderMessage]);
      
      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Use fetch with POST for the initial request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: cleanedMessages,
          stream: true,
          botRole: botRole // Send the bot role to the backend
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }
      
      // Process the stream
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            
            if (data === '[DONE]') {
              // Stream is complete
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant' && lastMessage.isStreaming) {
                  lastMessage.isStreaming = false;
                }
                return newMessages;
              });
              break;
            }
            
            try {
              const parsedData = JSON.parse(data);
              
              // Update the streaming message
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant' && lastMessage.isStreaming) {
                  lastMessage.content = parsedData.content || '';
                  lastMessage.reasoning_content = parsedData.reasoning_content || '';
                  lastMessage.isStreaming = !parsedData.is_complete;
                }
                return newMessages;
              });
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Display network error to the user
      setMessages(prev => {
        // Remove the placeholder message if it exists
        const newMessages = prev.filter(msg => !(msg.role === 'assistant' && msg.isStreaming));
        
        return [...newMessages, { 
          role: 'assistant', 
          content: `Network error: Could not connect to the server. Please check your connection and try again. Details: ${error instanceof Error ? error.message : String(error)}` 
        }];
      });
    } finally {
      setLoading(false);
    }
  };

  // Render message content with code highlighting and proper Markdown/LaTeX support
  const renderMessageContent = (content: string) => {
    const parts = parseCodeBlocks(content);
    
    return parts.map((part, index) => {
      if (part.type === 'text') {
        // Use ReactMarkdown with math plugins and GFM for text parts
        return (
          <div key={index} className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {part.content}
            </ReactMarkdown>
          </div>
        );
      } else {
        // Render code block with syntax highlighting
        return (
          <div key={index} className="code-block-container">
            <div className="code-block-header">
              <span className="code-language">{part.language}</span>
              <button 
                className="copy-button"
                onClick={() => navigator.clipboard.writeText(part.content)}
              >
                Copy
              </button>
            </div>
            <SyntaxHighlighter 
              language={part.language} 
              style={tomorrow}
              customStyle={{
                borderRadius: '0 0 4px 4px',
                margin: '0'
              }}
            >
              {part.content}
            </SyntaxHighlighter>
          </div>
        );
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Handle paste event
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Handle image selection
  };

  const handleRemoveImage = (index: number) => {
    // Handle image removal
  };

  // Handle key press in the input field
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter is pressed without Shift, send the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default behavior (new line)
      if (input.trim() || selectedImages.length > 0) {
        handleSend(e as unknown as React.FormEvent);
      }
    }
    // If Shift+Enter is pressed, allow new line (default behavior)
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>DeepSeek Reasoner Chatbot</h1>
      </header>
      
      {!roleSelected ? (
        <div className="role-selection-container">
          <h2>Choose a role for your AI assistant</h2>
          <p>Define what kind of expert you want the AI to be</p>
          <form onSubmit={handleRoleSelect} className="role-form">
            <input
              type="text"
              value={botRole}
              onChange={e => setBotRole(e.target.value)}
              placeholder="e.g., 'a coding expert', 'a math tutor', 'a science advisor'"
              className="role-input"
            />
            <button
              type="submit"
              className="role-button"
            >
              Start Chat
            </button>
          </form>
          <div className="role-examples">
            <p>Suggested roles:</p>
            <div className="role-chips">
              <button onClick={() => setBotRole("a coding expert")} className="role-chip">Coding Expert</button>
              <button onClick={() => setBotRole("a math tutor")} className="role-chip">Math Tutor</button>
              <button onClick={() => setBotRole("a science advisor")} className="role-chip">Science Advisor</button>
              <button onClick={() => setBotRole("a history professor")} className="role-chip">History Professor</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="current-role">
            <span>Current role: <strong>{botRole}</strong></span>
            <button 
              onClick={() => setRoleSelected(false)} 
              className="change-role-button"
              disabled={loading}
            >
              Change Role
            </button>
          </div>
          
          <div className="messages-container">
            {messages.length === 0 && (
              <div className="welcome-message">
                <h2>Welcome to DeepSeek Reasoner!</h2>
                <p>I'm your {botRole}. Ask me anything, and I'll provide both an answer and my reasoning process.</p>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'} ${msg.isStreaming ? 'streaming' : ''}`}
              >
                <div className="message-header">
                  <strong>{msg.role === 'user' ? 'You' : 'DeepSeek'}</strong>
                  {msg.isStreaming && <span className="streaming-indicator">Thinking...</span>}
                </div>
                
                {/* Show reasoning first for assistant messages */}
                {msg.role === 'assistant' && msg.reasoning_content && (
                  <div className="reasoning-content">
                    <details open={msg.isStreaming}>
                      <summary>
                        {msg.isStreaming ? 'Reasoning in progress...' : 'View Reasoning'}
                      </summary>
                      <div className="reasoning-text">
                        {renderMessageContent(msg.reasoning_content)}
                        {msg.isStreaming && <span className="cursor"></span>}
                      </div>
                    </details>
                  </div>
                )}
                
                {/* Show main content after reasoning */}
                <div className="message-content">
                  {renderMessageContent(msg.content)}
                  {msg.isStreaming && <span className="cursor"></span>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSend} className="input-form">
            <div className="input-container">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                disabled={loading}
                className="message-input"
                rows={1}
                onInput={(e) => {
                  // Auto-resize the textarea based on content
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  const newHeight = Math.min(200, Math.max(24, target.scrollHeight)); // Min height of 24px, max of 200px
                  target.style.height = `${newHeight}px`;
                }}
              />
              <button
                type="button"
                className="image-upload-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleImageSelect}
                multiple
                style={{ display: 'none' }}
              />
            </div>
            
            {/* Image previews */}
            {previewImages.length > 0 && (
              <div className="image-preview-container">
                {previewImages.map((url, index) => (
                  <div key={index} className="image-preview">
                    <img src={url} alt={`Preview ${index}`} />
                    <button 
                      type="button" 
                      className="remove-image-button"
                      onClick={() => handleRemoveImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <button
              type="submit"
              className="send-button"
              disabled={loading || (!input.trim() && selectedImages.length === 0)}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default App;
