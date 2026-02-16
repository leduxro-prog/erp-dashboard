import React from 'react';
import { Cookie } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Politica Cookies',
        lastUpdated: 'Ultima actualizare: 10 Februarie 2026',
        sections: [
            { title: '1. Ce sunt Cookie-urile?', text: 'Cookie-urile sunt fișiere text de mici dimensiuni stocate pe dispozitivul dumneavoastră (computer, telefon, tabletă) atunci când vizitați un site web. Acestea permit site-ului să rețină informații despre vizita dumneavoastră, ceea ce poate facilita următoarea vizită și poate face site-ul mai util pentru dumneavoastră.' },
            { title: '2. Tipuri de Cookie-uri Utilizate', text: '• Cookie-uri strict necesare: Esențiale pentru funcționarea platformei B2B (autentificare, coș de cumpărături, preferințe de sesiune). Nu pot fi dezactivate.\n\n• Cookie-uri de performanță: Colectează informații anonime despre modul de utilizare a site-ului (pagini vizitate, timpi de încărcare). Utilizate pentru îmbunătățirea performanței.\n\n• Cookie-uri funcționale: Rețin preferințele dumneavoastră (limba selectată, setările contului). Îmbunătățesc experiența de utilizare.\n\n• Cookie-uri de marketing: Urmăresc activitatea dumneavoastră pe site pentru a afișa reclame relevante. Pot fi partajate cu terți (Google Analytics, etc.).' },
            { title: '3. Cookie-uri Specifice Utilizate', text: '• b2b_language — Tipul: Funcțional | Durată: Permanent | Scop: Salvarea preferinței de limbă (RO/EN)\n• session_id — Tip: Strict necesar | Durată: Sesiune | Scop: Menținerea sesiunii de autentificare\n• cart_items — Tip: Strict necesar | Durată: 7 zile | Scop: Salvarea conținutului coșului\n• _ga, _gid — Tip: Performanță | Durată: 2 ani / 24h | Scop: Google Analytics' },
            { title: '4. Gestionarea Cookie-urilor', text: 'Puteți gestiona cookie-urile prin setările browserului dumneavoastră:\n• Google Chrome: Setări > Confidențialitate și securitate > Cookie-uri\n• Mozilla Firefox: Opțiuni > Confidențialitate & Securitate\n• Safari: Preferințe > Confidențialitate\n• Microsoft Edge: Setări > Cookie-uri și permisiuni site\n\nAtentie: Dezactivarea cookie-urilor strict necesare poate afecta funcționalitatea platformei B2B.' },
            { title: '5. Cookie-uri Terțe', text: 'Platforma noastră poate utiliza servicii terțe care instalează propriile cookie-uri:\n• Google Analytics — analiză trafic\n• Google Tag Manager — managementul tag-urilor\n• Hotjar — analiza comportamentului utilizatorilor\n\nAceste cookie-uri sunt guvernate de politicile de confidențialitate ale serviciilor respective.' },
            { title: '6. Consimțământ', text: 'La prima vizită pe platforma noastră, veți fi informat despre utilizarea cookie-urilor printr-un banner dedicat. Aveți opțiunea de a accepta sau refuza cookie-urile opționale. Consimțământul poate fi retras oricând prin setările browserului sau secțiunea de preferințe din contul dumneavoastră.' },
            { title: '7. Contact', text: 'Pentru întrebări despre politica noastră privind cookie-urile, ne puteți contacta la: privacy@ledux.ro' },
        ],
    },
    en: {
        title: 'Cookie Policy',
        lastUpdated: 'Last updated: February 10, 2026',
        sections: [
            { title: '1. What are Cookies?', text: 'Cookies are small text files stored on your device (computer, phone, tablet) when you visit a website. They allow the site to remember information about your visit, which can make the next visit easier and the site more useful to you.' },
            { title: '2. Types of Cookies Used', text: '• Strictly necessary cookies: Essential for B2B platform operation (authentication, shopping cart, session preferences). Cannot be disabled.\n\n• Performance cookies: Collect anonymous information about how the site is used (pages visited, load times). Used to improve performance.\n\n• Functional cookies: Remember your preferences (selected language, account settings). Improve user experience.\n\n• Marketing cookies: Track your activity on the site to display relevant ads. May be shared with third parties (Google Analytics, etc.).' },
            { title: '3. Specific Cookies Used', text: '• b2b_language — Type: Functional | Duration: Permanent | Purpose: Saving language preference (RO/EN)\n• session_id — Type: Strictly necessary | Duration: Session | Purpose: Maintaining authentication session\n• cart_items — Type: Strictly necessary | Duration: 7 days | Purpose: Saving cart contents\n• _ga, _gid — Type: Performance | Duration: 2 years / 24h | Purpose: Google Analytics' },
            { title: '4. Managing Cookies', text: 'You can manage cookies through your browser settings:\n• Google Chrome: Settings > Privacy and security > Cookies\n• Mozilla Firefox: Options > Privacy & Security\n• Safari: Preferences > Privacy\n• Microsoft Edge: Settings > Cookies and site permissions\n\nNote: Disabling strictly necessary cookies may affect B2B platform functionality.' },
            { title: '5. Third-Party Cookies', text: 'Our platform may use third-party services that install their own cookies:\n• Google Analytics — traffic analysis\n• Google Tag Manager — tag management\n• Hotjar — user behavior analysis\n\nThese cookies are governed by the respective service privacy policies.' },
            { title: '6. Consent', text: 'On your first visit to our platform, you will be informed about cookie usage through a dedicated banner. You have the option to accept or refuse optional cookies. Consent can be withdrawn at any time through browser settings or the preferences section in your account.' },
            { title: '7. Contact', text: 'For questions about our cookie policy, you can contact us at: privacy@ledux.ro' },
        ],
    },
};

export const B2BCookiesPage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <Cookie size={32} className="mx-auto mb-3" style={{ color: '#daa520' }} />
                <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
                <p className="text-xs" style={{ color: '#666' }}>{t.lastUpdated}</p>
            </div>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
                {t.sections.map((s) => (
                    <section key={s.title} className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h2 className="text-sm font-bold text-white mb-3">{s.title}</h2>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#888' }}>{s.text}</p>
                    </section>
                ))}
            </div>
        </div>
    );
};
