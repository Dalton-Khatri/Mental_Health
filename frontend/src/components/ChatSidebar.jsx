import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import './ChatSidebar.css';


// Simple ChatSidebar component
export default function ChatSidebar({ user, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const resp = await fetch(`${baseUrl}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content, userId: user?.id })
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error ${resp.status}`);
      }
      const data = await resp.json();
      const assistantMsg = { role: "assistant", content: data.reply };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <aside className="sr-chat-sidebar" aria-label="Chat Assistant">
      <div className="sr-chat-header">
        <h3>Mental‑Health Assistant</h3>
        <button onClick={onClose} aria-label="Close chat" className="sr-chat-close-btn">✕</button>
      </div>
      <div className="sr-chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`sr-chat-bubble sr-chat-${msg.role}`}> {msg.content} </div>
        ))}
        {loading && (
          <div className="sr-chat-bubble sr-chat-assistant">
            <Loader2 className="animate-spin" size={16} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="sr-chat-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          rows={1}
          className="sr-chat-textarea"
        />
        <button onClick={sendMessage} disabled={loading} className="sr-chat-send-btn" aria-label="Send message">
          <Send size={18} />
        </button>
      </div>
    </aside>
  );
}
