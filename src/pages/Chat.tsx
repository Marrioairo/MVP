import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, Timestamp, doc, updateDoc } from "firebase/firestore";
import { Send, Plus, MessageSquare, Trash2, MoreVertical, Copy, Check, Sparkles, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: any;
}

const Chat: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [mode, setMode] = useState<"analyst" | "support">("analyst");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });
    return () => unsubscribe();
  }, [user]);

  // Listen for proactive AI suggestions from the Scorekeeper/Backend
  useEffect(() => {
    if (!user) return;
    const eventSource = new EventSource("/api/events/sse");
    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "AI_SUGGESTION") {
          const content = typeof data.message === "string" 
            ? data.message 
            : data.message?.choices?.[0]?.message?.content || "Tactical adjustment needed.";
          
          await addDoc(collection(db, "chats"), {
            userId: user.uid,
            role: "assistant",
            content: `🚨 **Proactive Tactical Alert (${data.team.toUpperCase()} TEAM):**\n\n${content}`,
            mode: "analyst",
            timestamp: Timestamp.now(),
          });
        }
      } catch (e) {
        console.error("Error parsing SSE in Chat:", e);
      }
    };
    return () => eventSource.close();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage = input;
    setInput("");
    
    await addDoc(collection(db, "chats"), {
      userId: user.uid,
      role: "user",
      content: userMessage,
      mode,
      timestamp: Timestamp.now(),
    });

    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const response = await fetch("/api/ia/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          mode,
          matchData: {}, // Context could be passed here
        }),
      });

      if (!response.ok) throw new Error("Failed to get AI response");

      const data = await response.json();
      const aiContent = data.choices[0].message.content;

      await addDoc(collection(db, "chats"), {
        userId: user.uid,
        role: "assistant",
        content: aiContent,
        mode,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-200 bg-neutral-50 p-4 hidden md:flex flex-col">
        <button 
          onClick={() => setMode(mode === "analyst" ? "support" : "analyst")}
          className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-500 transition-all"
        >
          {mode === "analyst" ? <HelpCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {mode === "analyst" ? t('support_agent') : t('ai_analyst')}
        </button>
        
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Recent Conversations</h3>
          {/* List of recent chats could go here */}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${mode === 'analyst' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'} mb-6`}>
                  {mode === 'analyst' ? <Sparkles className="h-8 w-8" /> : <HelpCircle className="h-8 w-8" />}
                </div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  {mode === 'analyst' ? t('ai_analyst') : t('support_agent')}
                </h2>
                <p className="mt-2 text-neutral-500">
                  {mode === 'analyst' ? "Analyze matches, players, and tactical trends." : "Ask me anything about how to use HoopsAI."}
                </p>
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(mode === 'analyst' ? [
                    "Analyze Real Madrid's defensive form",
                    "Predict the next Lakers game",
                    "Compare Haaland vs Mbappe stats",
                    "Explain Moneyball in basketball"
                  ] : [
                    t('how_to_register'),
                    t('how_to_export'),
                    t('how_to_roster'),
                    "How to upgrade to Pro?"
                  ]).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="rounded-xl border border-neutral-200 bg-white p-4 text-left text-sm text-neutral-600 hover:border-orange-300 hover:bg-orange-50 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-white ${
                  message.role === "user" ? "bg-neutral-800" : "bg-orange-600"
                }`}>
                  {message.role === "user" ? "U" : "AI"}
                </div>
                <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  message.role === "user" ? "bg-neutral-900 text-white" : "bg-neutral-50 text-neutral-800"
                }`}>
                  <div className="prose prose-sm max-w-none prose-neutral dark:prose-invert">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-neutral-200 bg-white p-4 sm:p-6">
          <form onSubmit={handleSendMessage} className="mx-auto max-w-3xl relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder={mode === 'analyst' ? "Ask HoopsAI..." : "Ask Support..."}
              className="w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 pr-12 text-sm focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all min-h-[56px] max-h-40"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 bottom-2 p-2 rounded-xl bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Chat;
