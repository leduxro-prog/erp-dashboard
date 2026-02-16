import React, { useState } from 'react';
import { Sparkles, X, Lightbulb, Loader2 } from 'lucide-react';
import { useAi, CrmClient } from '../../hooks/useAi';

interface StrategicAnalysisProps {
    clients: CrmClient[];
    isDark?: boolean;
}

export const StrategicAnalysis: React.FC<StrategicAnalysisProps> = ({ clients, isDark = false }) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showPanel, setShowPanel] = useState(false);
    const { analyzeCrm, isLoading } = useAi();

    const handleAnalysis = async () => {
        if (showPanel && suggestions.length > 0) return;

        setShowPanel(true);
        if (suggestions.length === 0) {
            const results = await analyzeCrm(clients);
            if (results && results.length > 0) {
                setSuggestions(results);
            } else {
                setSuggestions(['Nu am putut genera sugestii. Verificați conexiunea sau încercați din nou.']);
            }
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleAnalysis}
                disabled={isLoading}
                title="Analiză Strategică AI"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:shadow-purple-500/20 active:scale-95
                  bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-[length:200%_auto] hover:bg-right duration-500
                  ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
            >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isLoading ? 'Analizez...' : 'Sugestii AI'}
            </button>

            {showPanel && (
                <div className={`absolute top-full right-0 mt-4 w-96 p-4 rounded-xl border animate-in slide-in-from-top-4 duration-300 z-50 shadow-2xl backdrop-blur-xl
                 ${isDark ? 'bg-purple-900/40 border-purple-500/30 text-white' : 'bg-white/95 border-purple-200 text-gray-800'}`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                                <Lightbulb size={16} className="text-purple-500" />
                            </div>
                            <div>
                                <h3 className={`text-sm font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Analiză Portofoliu</h3>
                                <p className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Sugestii generate de Gemini AI</p>
                            </div>
                        </div>
                        <button onClick={() => setShowPanel(false)} title="Close Panel" className={`p-1 rounded-lg hover:bg-black/10 transition-colors ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <X size={16} />
                        </button>
                    </div>

                    {isLoading && suggestions.length === 0 ? (
                        <div className="flex flex-col gap-2 p-2">
                            <div className={`h-4 w-3/4 rounded animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                            <div className={`h-4 w-1/2 rounded animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                            <div className={`h-4 w-2/3 rounded animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {suggestions.map((suggestion, idx) => (
                                <div key={idx} className="flex gap-2 items-start text-sm group">
                                    <span className="text-purple-500 font-bold mt-0.5 group-hover:scale-125 transition-transform duration-300">•</span>
                                    <span className={`leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{suggestion}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
