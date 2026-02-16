import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageCircle, Minimize2, Maximize2, Sparkles, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAi } from '../../hooks/useAi';

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

export const ChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            text: 'Salut! Sunt asistentul tău inteligent. Cu ce te pot ajuta astăzi?',
            sender: 'bot',
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { chat, isLoading } = useAi();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, isLoading]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');

        try {
            const responseText = await chat(userMsg.text);

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                text: responseText || 'Îmi pare rău, nu am putut genera un răspuns.',
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                text: 'A apărut o eroare de conexiune.',
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg transition-all hover:scale-110 z-50 flex items-center justify-center animate-bounce shadow-blue-500/30"
                aria-label="Open AI Assistant"
            >
                <Sparkles size={24} />
            </button>
        );
    }

    if (isMinimized) {
        return (
            <div
                className="fixed bottom-6 right-6 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden w-72 cursor-pointer transition-all hover:shadow-2xl"
                onClick={() => setIsMinimized(false)}
            >
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
                    <span className="font-bold flex items-center gap-2">
                        <Sparkles size={16} /> AI Assistant
                    </span>
                    <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }} className="hover:bg-white/20 p-1 rounded">
                            <Maximize2 size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="hover:bg-white/20 p-1 rounded">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight">AI Assistant</h3>
                        <p className="text-xs text-blue-100 opacity-90">Powered by Gemini</p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setIsMinimized(true)} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Minimize">
                        <Minimize2 size={18} />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Close">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 dark:bg-gray-900/50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.sender === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                            {msg.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div
                            className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.sender === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                                }`}
                        >
                            {msg.sender === 'bot' ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            ) : (
                                <p>{msg.text}</p>
                            )}
                            <span className={`text-[10px] block mt-2 opacity-70 ${msg.sender === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Bot size={14} />
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <form onSubmit={handleSendMessage} className="relative flex items-center">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Întreabă AI-ul..."
                        className="w-full pl-5 pr-12 py-3 bg-gray-100 dark:bg-gray-700 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white placeholder-gray-500 text-sm transition-all shadow-inner"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isLoading}
                        className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};
