/**
 * AI Assistant (Gemini-powered)
 * Floating AI chatbot with glassmorphism design
 */

import React, { useState, useRef, useEffect } from 'react';
import { ThemeVariant, isDarkTheme } from '../../styles/themes';
import { X, Send, Sparkles, Loader2, Zap } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeVariant;
}

const QUICK_ACTIONS = [
  { label: 'Analizeaza comenzile de azi', query: 'Analizează comenzile de astazi. Care sunt cele mai importante?' },
  { label: 'Produse cu stoc scazut', query: 'Arată-mi produsele cu stoc scăzut. Ce trebuie aprovizionat?' },
  { label: 'Raport vanzari saptamanal', query: 'Generează raport de vânzări pentru săptămâna aceasta.' },
  { label: 'Sugestii optimizare pret', query: 'Ce sugestii ai pentru optimizarea prețurilor?' },
];

// Mock AI responses based on keywords
const getMockResponse = (query: string): string => {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('comenzi') || lowerQuery.includes('orders')) {
    return '📊 Astazi avem 47 comenzi în total. Dintre acestea, 23 sunt în status "Procesare", 18 în "Expediere" și 6 finalizate. Valoarea totală este €12,450. Cea mai mare comandă este de la clientul "TechCorp" - €3,200.';
  }

  if (lowerQuery.includes('stoc') || lowerQuery.includes('inventory')) {
    return '⚠️ Am identificat 12 produse cu stoc critic: Placa Bază X570 (2 buc), RAM DDR4 32GB (1 buc), SSD NVMe 1TB (3 buc). Recomand reaprovizionare urgență pentru acelea 3 categorii.';
  }

  if (lowerQuery.includes('vânzar') || lowerQuery.includes('vanzari')) {
    return '📈 Raportul săptămânii: Total vânzări €18,950 (+12% față de săptămâna trecută). Produsele Top 3: Monitoare (€6,200), Carcasă Gaming (€4,150), Tastatură Mecanică (€2,800). Crestere deosebita în categoria "Gaming Gear".';
  }

  if (lowerQuery.includes('preț') || lowerQuery.includes('pret')) {
    return '💰 Analiză preț: Placa Video RTX 4090 are marja de 18% comparativ cu piața. Recomand creștere cu 5-8%. RAM-ul are pret competitiv. Carcasele Gaming au potențial de crestere la marja de 25%.';
  }

  if (lowerQuery.includes('client') || lowerQuery.includes('customers')) {
    return '👥 Clienti activi: 234. Top client: "TechCorp Enterprise" cu €45,600 în vânzări YTD. Rate de reținere: 94%. Recomand program loyalty pentru Top 10 clienți.';
  }

  return '🤖 Mulțumesc pentru întrebare! Pot ajuta cu analiză comenzi, stocuri, rapoarte de vânzări, strategie de preț, și date de clienți. Ce anume te interesează?';
};

export const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  currentTheme,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: '🤖 Salut! Sunt asistentul CYPHER AI. Pot analiza comenzi, stocuri, rapoarte și mai multe. Cu ce te pot ajuta?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDark = isDarkTheme(currentTheme);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        if (!isOpen) {
          // Toggle would be handled by parent
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simulate API delay
    setTimeout(() => {
      const response = getMockResponse(input);
      const assistantMessage: Message = {
        role: 'assistant',
        text: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLoading(false);
    }, 800);
  };

  const handleQuickAction = (query: string) => {
    const userMessage: Message = {
      role: 'user',
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    setTimeout(() => {
      const response = getMockResponse(query);
      const assistantMessage: Message = {
        role: 'assistant',
        text: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLoading(false);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`
        fixed bottom-20 right-6 w-[420px] h-[560px]
        rounded-2xl border overflow-hidden
        shadow-2xl z-50 flex flex-col
        transition-all duration-300
        ${isDark
          ? 'bg-gray-900/95 border-gray-700 text-white backdrop-blur-2xl'
          : 'bg-white/95 border-gray-200 text-gray-900 backdrop-blur-2xl'
        }
      `}
    >
      {/* Header */}
      <div
        className={`
          p-4 flex justify-between items-center border-b
          ${isDark ? 'border-gray-700/50' : 'border-gray-200/50'}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-blue-500 to-purple-500">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">CYPHER AI</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              Analist inteligent
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`
            p-2 rounded-lg transition-colors
            ${isDark
              ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }
          `}
        >
          <X size={18} />
        </button>
      </div>

      {/* Quick Actions (on first message) */}
      {messages.length === 1 && (
        <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700/50 bg-gray-800/30' : 'border-gray-200/50 bg-gray-50/50'}`}>
          <div className={`text-xs font-semibold mb-2.5 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
            Intrebari rapide:
          </div>
          <div className="grid grid-cols-1 gap-2">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(action.query)}
                className={`
                  p-2 rounded-lg text-left text-xs font-medium
                  transition-colors flex items-center gap-2
                  ${isDark
                    ? 'bg-gray-800/50 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                `}
              >
                <Zap size={14} className="text-blue-500" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50/30'}`}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`
                max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : isDark
                  ? 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
                  : 'bg-white text-gray-900 rounded-bl-none border border-gray-200 shadow-sm'
                }
              `}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className={`
                p-3 rounded-2xl rounded-bl-none flex items-center gap-2
                ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700 border border-gray-200'}
              `}
            >
              <Loader2 size={16} className="animate-spin text-blue-500" />
              <span className="text-xs">Analizez...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className={`
          p-3 border-t
          ${isDark ? 'border-gray-700/50 bg-gray-900/70' : 'border-gray-200/50 bg-white/70'}
        `}
      >
        <div
          className={`
            flex items-center gap-2 rounded-xl px-3 py-2 border
            transition-all
            ${isDark
              ? 'bg-gray-800/50 border-gray-600 focus-within:border-blue-500'
              : 'bg-white/70 border-gray-300 focus-within:border-blue-400'
            }
          `}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Întreabă despre comenzi, stocuri..."
            className={`
              flex-1 bg-transparent outline-none text-sm min-w-0
              ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-500'}
            `}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={`
              p-1.5 rounded-lg transition-all
              ${input.trim() && !loading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : isDark
                ? 'bg-gray-700/30 text-gray-500'
                : 'bg-gray-200 text-gray-400'
              }
            `}
          >
            <Send size={14} />
          </button>
        </div>

        <div className={`text-xs mt-2 text-center ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
          Cmd+K pentru inchidere
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
