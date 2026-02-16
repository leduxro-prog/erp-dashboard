import React, { useState, useRef, useEffect } from 'react';
import { chatService, ChatMessage } from '../../services/chatService';
import { Send, X, MessageCircle, Minimize2, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const B2BChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            text: 'Bună ziua! Sunt asistentul tău B2B dedicat. Te pot ajuta cu stocuri, comenzi sau specificații tehnice.',
            sender: 'bot',
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const responseText = await chatService.sendMessage(userMsg.text);
            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                text: 'Îmi pare rău, am întâmpinat o eroare. Te rog să încerci din nou mai târziu.',
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform hover:scale-110 z-50 flex items-center justify-center animate-bounce"
                aria-label="Open support chat"
            >
                <MessageCircle size={28} />
            </button>
        );
    }

    if (isMinimized) {
        return (
            <div
                className="fixed bottom-6 right-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden w-72 cursor-pointer"
                onClick={() => setIsMinimized(false)}
            >
                <div className="p-3 bg-blue-600 text-white flex justify-between items-center">
                    <span className="font-semibold flex items-center gap-2">
                        <MessageCircle size={18} /> Asistent B2B
                    </span>
                    <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }} title="Expand">
                            <Maximize2 size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} title="Close">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden animate-fade-in-up">
            {/* Header */}
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center shadow-md">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-sm" />
                    <h3 className="font-semibold text-lg">Asistent B2B</h3>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-blue-500 rounded transition-colors" title="Minimize">
                        <Minimize2 size={18} />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-blue-500 rounded transition-colors" title="Close">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm text-sm ${msg.sender === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                                }`}
                        >
                            {msg.sender === 'bot' ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            ) : (
                                <p>{msg.text}</p>
                            )}
                            <span className={`text-[10px] block mt-1.5 opacity-70 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-bl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Întreabă despre produse..."
                        className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-none rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-white placeholder-gray-500 text-sm transition-all"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isLoading}
                        className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition-all disabled:opacity-50 disabled:scale-100 transform active:scale-95"
                        aria-label="Send message"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};
