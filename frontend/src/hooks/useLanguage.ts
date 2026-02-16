import { useState, useEffect, useCallback } from 'react';

export type Language = 'ro' | 'en';

const STORAGE_KEY = 'b2b_language';

export const useLanguage = () => {
    const [language, setLanguageState] = useState<Language>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'en' || stored === 'ro') return stored;
        } catch { /* ignore */ }
        return 'ro';
    });

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch { /* ignore */ }
    }, []);

    const toggleLanguage = useCallback(() => {
        setLanguage(language === 'ro' ? 'en' : 'ro');
    }, [language, setLanguage]);

    return { language, setLanguage, toggleLanguage };
};

// Global language state for components that can't use the hook directly
let globalLanguage: Language = (() => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'ro') return stored;
    } catch { /* ignore */ }
    return 'ro';
})();

const listeners = new Set<(lang: Language) => void>();

export const getLanguage = () => globalLanguage;

export const setGlobalLanguage = (lang: Language) => {
    globalLanguage = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    listeners.forEach(fn => fn(lang));
};

export const subscribeLanguage = (fn: (lang: Language) => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
};

// Hook that syncs with global state
export const useGlobalLanguage = () => {
    const [lang, setLang] = useState<Language>(getLanguage);

    useEffect(() => {
        return subscribeLanguage(setLang);
    }, []);

    const setLanguage = useCallback((l: Language) => {
        setGlobalLanguage(l);
    }, []);

    const toggleLanguage = useCallback(() => {
        setGlobalLanguage(globalLanguage === 'ro' ? 'en' : 'ro');
    }, []);

    return { language: lang, setLanguage, toggleLanguage };
};
