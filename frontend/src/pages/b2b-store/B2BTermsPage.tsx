import React from 'react';
import { FileText } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Termeni și Condiții',
        lastUpdated: 'Ultima actualizare: 10 Februarie 2026',
        sections: [
            { title: '1. Definiții', text: '„Vânzătorul" — Ledux.ro, operator al platformei B2B.\n„Cumpărătorul" — persoana juridică înregistrată pe platforma B2B.\n„Platforma" — site-ul B2B Ledux.ro și aplicațiile asociate.\n„Produse" — corpuri de iluminat LED și accesorii comercializate prin platformă.\n„Comandă" — solicitarea de achiziție a produselor prin platformă.' },
            { title: '2. Obiectul Contractului', text: 'Prezentele Termeni și Condiții reglementează relația comercială B2B dintre Vânzător și Cumpărător, inclusiv procesul de înregistrare, plasare comenzi, livrare, plată și returnare a produselor.' },
            { title: '3. Înregistrare și Cont B2B', text: '• Accesul la platforma B2B este condiționat de înregistrarea și validarea contului.\n• Cumpărătorul garantează exactitatea și actualitatea datelor furnizate (CUI, Reg. Com., date contact).\n• Vânzătorul își rezervă dreptul de a refuza sau suspenda orice cont B2B, fără obligația de a justifica decizia.\n• Cumpărătorul este responsabil pentru securitatea credențialelor de acces.' },
            { title: '4. Prețuri și Plată', text: '• Toate prețurile afișate sunt exprimate în RON, fără TVA (dacă nu se specifică altfel).\n• Prețurile pot fi modificate fără notificare prealabilă, dar comenzile confirmate rămân la prețul acceptat.\n• Metode de plată acceptate: transfer bancar (OP), plată la termen (Net 30/60 zile — disponibilă doar pentru clienți validați).\n• Facturile sunt emise electronic și transmise pe email.\n• Întârzierile la plată pot atrage penalități de 0.5% pe zi din valoarea facturii restante.' },
            { title: '5. Comanda și Confirmarea', text: '• Comanda este considerată fermă după confirmarea scrisă (email) din partea Vânzătorului.\n• Vânzătorul își rezervă dreptul de a anula comenzile pentru care stocul nu este disponibil, notificând Cumpărătorul.\n• Cantitatea minimă per produs poate varia; verificați specificațiile din catalog.' },
            { title: '6. Livrare', text: '• Livrarea se efectuează conform politicii de livrare descrisă pe pagina „Livrare & Retur".\n• Termenele de livrare sunt estimative și nu constituie obligații ferme, cu excepția cazurilor expres menționate.\n• Riscul pierderii sau deteriorării trece la Cumpărător în momentul predării produselor către curier.\n• Cumpărătorul are obligația de a verifica coletul la primire și de a nota eventualele avarieri pe documentul de transport.' },
            { title: '7. Garanție și Conformitate', text: '• Toate produsele beneficiază de garanție producător conform legislației în vigoare (minim 24 luni).\n• Garanția acoperă defectele de fabricație, nu uzura normală sau utilizarea necorespunzătoare.\n• Certificarea produselor (CE, RoHS, TUV) este asigurată de producători.' },
            { title: '8. Returnări', text: '• Cumpărătorul poate returna produsele în termen de 30 de zile calendaristice, conform politicii de retur.\n• Produsele trebuie să fie în stare originală, nefolosite, cu ambalajul intact.\n• Cheltuielile de returnare sunt suportate de Cumpărător, cu excepția produselor defecte.' },
            { title: '9. Limitarea Răspunderii', text: '• Vânzătorul nu răspunde pentru daune indirecte, pierderi de profit sau întreruperi de activitate cauzate de utilizarea sau imposibilitatea utilizării produselor.\n• Răspunderea maximă a Vânzătorului este limitată la valoarea comenzii aferente.' },
            { title: '10. Forță Majoră', text: 'Niciuna dintre părți nu va fi responsabilă pentru neîndeplinirea obligațiilor contractuale din cauza unor evenimente de forță majoră (calamități naturale, războaie, pandemii, restricții guvernamentale, etc.).' },
            { title: '11. Drept Aplicabil', text: 'Prezentele Termeni și Condiții sunt guvernate de legislația românească. Orice litigiu va fi soluționat pe cale amiabilă sau, în caz de eșec, de instanțele competente din România.' },
        ],
    },
    en: {
        title: 'Terms and Conditions',
        lastUpdated: 'Last updated: February 10, 2026',
        sections: [
            { title: '1. Definitions', text: '"Seller" — Ledux.ro, operator of the B2B platform.\n"Buyer" — the legal entity registered on the B2B platform.\n"Platform" — the Ledux.ro B2B website and associated applications.\n"Products" — LED lighting fixtures and accessories sold through the platform.\n"Order" — a request to purchase products through the platform.' },
            { title: '2. Contract Object', text: 'These Terms and Conditions govern the B2B commercial relationship between the Seller and Buyer, including the registration process, order placement, delivery, payment, and product returns.' },
            { title: '3. Registration and B2B Account', text: '• Access to the B2B platform requires account registration and validation.\n• The Buyer guarantees the accuracy and currency of provided data (Tax ID, Trade Registry, contact details).\n• The Seller reserves the right to refuse or suspend any B2B account without obligation to justify the decision.\n• The Buyer is responsible for the security of access credentials.' },
            { title: '4. Prices and Payment', text: '• All displayed prices are in RON, excluding VAT (unless otherwise stated).\n• Prices may be modified without prior notice, but confirmed orders remain at the accepted price.\n• Accepted payment methods: bank transfer, net payment terms (Net 30/60 days — available only for validated clients).\n• Invoices are issued electronically and sent via email.\n• Late payments may incur penalties of 0.5% per day on the outstanding invoice value.' },
            { title: '5. Order and Confirmation', text: '• An order is considered firm after written confirmation (email) from the Seller.\n• The Seller reserves the right to cancel orders for out-of-stock items, notifying the Buyer.\n• Minimum quantity per product may vary; check catalog specifications.' },
            { title: '6. Delivery', text: '• Delivery is performed according to the delivery policy described on the "Shipping & Returns" page.\n• Delivery times are estimates and do not constitute firm commitments, except for expressly mentioned cases.\n• Risk of loss or damage passes to the Buyer upon handover to the courier.\n• The Buyer must inspect the package upon receipt and note any damage on the transport document.' },
            { title: '7. Warranty and Compliance', text: '• All products carry manufacturer warranty in accordance with applicable law (minimum 24 months).\n• The warranty covers manufacturing defects, not normal wear or improper use.\n• Product certification (CE, RoHS, TUV) is ensured by manufacturers.' },
            { title: '8. Returns', text: '• The Buyer may return products within 30 calendar days, in accordance with the return policy.\n• Products must be in original condition, unused, with intact packaging.\n• Return shipping costs are borne by the Buyer, except for defective products.' },
            { title: '9. Limitation of Liability', text: '• The Seller is not liable for indirect damages, lost profits, or business interruptions caused by the use or inability to use the products.\n• The Seller\'s maximum liability is limited to the value of the relevant order.' },
            { title: '10. Force Majeure', text: 'Neither party shall be responsible for the non-fulfillment of contractual obligations due to force majeure events (natural disasters, wars, pandemics, government restrictions, etc.).' },
            { title: '11. Applicable Law', text: 'These Terms and Conditions are governed by Romanian law. Any dispute shall be resolved amicably or, failing that, by the competent courts in Romania.' },
        ],
    },
};

export const B2BTermsPage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <FileText size={32} className="mx-auto mb-3" style={{ color: '#daa520' }} />
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
