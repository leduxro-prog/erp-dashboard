import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Politica de Confidențialitate',
        lastUpdated: 'Ultima actualizare: 10 Februarie 2026',
        sections: [
            { title: '1. Informații Generale', text: 'Ledux.ro (denumit în continuare „Operatorul") respectă confidențialitatea datelor dumneavoastră personale și se angajează să protejeze informațiile pe care ni le furnizați prin intermediul platformei B2B. Această politică descrie modul în care colectăm, utilizăm și protejăm datele dumneavoastră personale, în conformitate cu Regulamentul General privind Protecția Datelor (GDPR - Regulamentul UE 2016/679).' },
            { title: '2. Date Personale Colectate', text: 'Colectăm următoarele categorii de date personale:\n• Date de identificare: nume, prenume, funcție în cadrul companiei\n• Date de contact: adresă email, număr de telefon, adresă poștală\n• Date ale companiei: denumire firmă, CUI, nr. Registrul Comerțului, adresă sediu social\n• Date financiare: IBAN, denumire bancă\n• Date de navigare: adresă IP, tip browser, pagini accesate, durata vizitei\n• Date de tranzacție: istoricul comenzilor, preferințe de produse' },
            { title: '3. Scopul Prelucrării Datelor', text: 'Datele dumneavoastră personale sunt prelucrate în următoarele scopuri:\n• Procesarea și gestionarea contului B2B\n• Procesarea comenzilor și a livrărilor\n• Emiterea facturilor și a documentelor financiare\n• Comunicări comerciale (cu consimțământul dumneavoastră explicit)\n• Îmbunătățirea serviciilor și a platformei B2B\n• Respectarea obligațiilor legale și fiscale' },
            { title: '4. Temeiul Legal al Prelucrării', text: 'Prelucrarea datelor se bazează pe:\n• Executarea contractului B2B (Art. 6(1)(b) GDPR)\n• Obligațiile legale ale Operatorului (Art. 6(1)(c) GDPR)\n• Interesul legitim al Operatorului (Art. 6(1)(f) GDPR)\n• Consimțământul dumneavoastră (Art. 6(1)(a) GDPR) — pentru comunicări de marketing' },
            { title: '5. Durata Stocării Datelor', text: 'Datele personale sunt stocate pe durata relației contractuale și ulterior pentru o perioadă de 5 ani de la ultima tranzacție, conform obligațiilor legale de arhivare. Datele de navigare sunt stocate pentru maximum 12 luni.' },
            { title: '6. Drepturile Dumneavoastră', text: 'În conformitate cu GDPR, aveți următoarele drepturi:\n• Dreptul de acces la datele personale\n• Dreptul la rectificarea datelor inexacte\n• Dreptul la ștergerea datelor („dreptul de a fi uitat")\n• Dreptul la restricționarea prelucrării\n• Dreptul la portabilitatea datelor\n• Dreptul de opoziție la prelucrare\n• Dreptul de a depune plângere la ANSPDCP (Autoritatea Națională de Supraveghere)' },
            { title: '7. Securitatea Datelor', text: 'Implementăm măsuri tehnice și organizatorice adecvate pentru protejarea datelor personale, inclusiv criptare SSL/TLS, acces restricționat pe bază de rol, monitorizare continuă a sistemelor și backup-uri regulate.' },
            { title: '8. Contact', text: 'Pentru orice întrebări privind prelucrarea datelor personale, ne puteți contacta la:\n• Email: privacy@ledux.ro\n• Telefon: +40 XXX XXX XXX\n• Adresă: România' },
        ],
    },
    en: {
        title: 'Privacy Policy',
        lastUpdated: 'Last updated: February 10, 2026',
        sections: [
            { title: '1. General Information', text: 'Ledux.ro (hereinafter referred to as "the Operator") respects the confidentiality of your personal data and is committed to protecting the information you provide through the B2B platform. This policy describes how we collect, use, and protect your personal data, in accordance with the General Data Protection Regulation (GDPR - EU Regulation 2016/679).' },
            { title: '2. Personal Data Collected', text: 'We collect the following categories of personal data:\n• Identification data: name, surname, position within the company\n• Contact data: email address, phone number, postal address\n• Company data: company name, Tax ID, Trade Registry number, registered office address\n• Financial data: IBAN, bank name\n• Browsing data: IP address, browser type, pages visited, visit duration\n• Transaction data: order history, product preferences' },
            { title: '3. Purpose of Data Processing', text: 'Your personal data is processed for the following purposes:\n• Processing and managing the B2B account\n• Processing orders and deliveries\n• Issuing invoices and financial documents\n• Commercial communications (with your explicit consent)\n• Improving B2B services and platform\n• Compliance with legal and fiscal obligations' },
            { title: '4. Legal Basis for Processing', text: 'Data processing is based on:\n• Performance of the B2B contract (Art. 6(1)(b) GDPR)\n• Legal obligations of the Operator (Art. 6(1)(c) GDPR)\n• Legitimate interest of the Operator (Art. 6(1)(f) GDPR)\n• Your consent (Art. 6(1)(a) GDPR) — for marketing communications' },
            { title: '5. Data Retention Period', text: 'Personal data is stored for the duration of the contractual relationship and subsequently for a period of 5 years from the last transaction, in accordance with legal archiving obligations. Browsing data is stored for a maximum of 12 months.' },
            { title: '6. Your Rights', text: 'In accordance with GDPR, you have the following rights:\n• Right of access to personal data\n• Right to rectification of inaccurate data\n• Right to erasure ("right to be forgotten")\n• Right to restriction of processing\n• Right to data portability\n• Right to object to processing\n• Right to lodge a complaint with the supervisory authority (ANSPDCP)' },
            { title: '7. Data Security', text: 'We implement appropriate technical and organizational measures to protect personal data, including SSL/TLS encryption, role-based access control, continuous system monitoring, and regular backups.' },
            { title: '8. Contact', text: 'For any questions regarding personal data processing, you can contact us at:\n• Email: privacy@ledux.ro\n• Phone: +40 XXX XXX XXX\n• Address: Romania' },
        ],
    },
};

export const B2BPrivacyPage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <ShieldCheck size={32} className="mx-auto mb-3" style={{ color: '#daa520' }} />
                <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
                <p className="text-xs" style={{ color: '#666' }}>{t.lastUpdated}</p>
            </div>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
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
