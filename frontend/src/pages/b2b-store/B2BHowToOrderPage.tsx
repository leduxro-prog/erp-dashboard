import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Search, ShoppingCart, CreditCard, Truck, CheckCircle2, ChevronRight } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Cum Comanzi',
        subtitle: 'Ghid pas cu pas pentru a plasa prima ta comandă B2B pe Ledux.ro',
        steps: [
            { icon: 'userplus', title: '1. Creează Cont B2B', desc: 'Completează formularul de înregistrare cu datele companiei tale (CUI, Reg. Com., adresă). Contul va fi validat de echipa noastră în maxim 24h.', tip: 'Pregătește CUI-ul și numărul de la Registrul Comerțului.' },
            { icon: 'search', title: '2. Explorează Catalogul', desc: 'Accesează catalogul nostru cu peste 5,000 de produse LED. Folosește filtrele avansate pentru a găsi rapid produsele dorite: putere, temperatură culoare, grad de protecție.', tip: 'Stocul este afișat în timp real — verifică disponibilitatea instant.' },
            { icon: 'cart', title: '3. Adaugă în Coș', desc: 'Selectează cantitățile dorite. Discounturile de volum se aplică automat: 5% la 10+ buc, 10% la 50+ buc, 15% la 100+ buc.', tip: 'Cu cât comanzi mai mult, cu atât economisești mai mult!' },
            { icon: 'credit', title: '4. Finalizează Comanda', desc: 'Alege metoda de plată: plată la termen (Net 30 zile) pentru clienți validați sau transfer bancar (OP). Confirmă adresa de livrare.', tip: 'Clienții cu istoric beneficiază de limită de credit mai mare.' },
            { icon: 'truck', title: '5. Livrare', desc: 'Produsele din stoc local sunt livrate în 24-48h. Pentru produse de la furnizor, termenul este de 3-7 zile lucrătoare. Transport gratuit peste 2,000 RON.', tip: 'Primești cod de tracking pentru monitorizare în timp real.' },
        ],
        faqTitle: 'Întrebări Frecvente',
        faqs: [
            { q: 'Cât durează validarea contului?', a: 'De obicei, contul este validat în maxim 24 de ore lucrătoare. Veți primi un email de confirmare.' },
            { q: 'Pot comanda fără cont B2B?', a: 'Nu, platforma B2B este destinată exclusiv companiilor înregistrate. Pentru achiziții retail, vizitați ledux.ro.' },
            { q: 'Care este comanda minimă?', a: 'Nu există o valoare minimă obligatorie, dar discounturile de volum se activează de la 10 bucăți per produs.' },
            { q: 'Pot solicita o ofertă personalizată?', a: 'Da! Pentru cantități mari (500+ buc) sau proiecte speciale, folosiți butonul "Solicită Ofertă" de pe pagina produsului.' },
        ],
        ctaTitle: 'Gata să comanzi?',
        ctaBtn: 'Creează Cont B2B',
        ctaBrowse: 'sau Explorează Catalogul',
    },
    en: {
        title: 'How to Order',
        subtitle: 'Step-by-step guide to place your first B2B order on Ledux.ro',
        steps: [
            { icon: 'userplus', title: '1. Create a B2B Account', desc: 'Fill in the registration form with your company details (Tax ID, Trade Registry, address). Your account will be validated by our team within 24h.', tip: 'Have your Tax ID and Trade Registry number ready.' },
            { icon: 'search', title: '2. Browse the Catalog', desc: 'Access our catalog with over 5,000 LED products. Use advanced filters to quickly find the products you need: wattage, color temperature, IP rating.', tip: 'Stock is displayed in real-time — check availability instantly.' },
            { icon: 'cart', title: '3. Add to Cart', desc: 'Select your desired quantities. Volume discounts apply automatically: 5% at 10+ pcs, 10% at 50+ pcs, 15% at 100+ pcs.', tip: 'The more you order, the more you save!' },
            { icon: 'credit', title: '4. Complete the Order', desc: 'Choose your payment method: Net 30 days for validated clients or bank transfer. Confirm your delivery address.', tip: 'Clients with a good history get higher credit limits.' },
            { icon: 'truck', title: '5. Delivery', desc: 'Products from local stock are delivered in 24-48h. For supplier items, the lead time is 3-7 business days. Free shipping over 2,000 RON.', tip: 'You receive a tracking code for real-time monitoring.' },
        ],
        faqTitle: 'Frequently Asked Questions',
        faqs: [
            { q: 'How long does account validation take?', a: 'Usually, the account is validated within 24 business hours. You will receive a confirmation email.' },
            { q: 'Can I order without a B2B account?', a: 'No, the B2B platform is for registered companies only. For retail purchases, visit ledux.ro.' },
            { q: 'What is the minimum order?', a: 'There is no mandatory minimum order, but volume discounts activate at 10 units per product.' },
            { q: 'Can I request a custom quote?', a: 'Yes! For large quantities (500+ pcs) or special projects, use the "Request Quote" button on the product page.' },
        ],
        ctaTitle: 'Ready to order?',
        ctaBtn: 'Create B2B Account',
        ctaBrowse: 'or Browse the Catalog',
    },
};

const iconMap: Record<string, React.ReactNode> = {
    userplus: <UserPlus size={24} />,
    search: <Search size={24} />,
    cart: <ShoppingCart size={24} />,
    credit: <CreditCard size={24} />,
    truck: <Truck size={24} />,
};

export const B2BHowToOrderPage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <h1 className="text-4xl font-bold text-white mb-3">{t.title}</h1>
                <p className="text-sm" style={{ color: '#888' }}>{t.subtitle}</p>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
                {/* Steps */}
                <div className="space-y-8">
                    {t.steps.map((step, idx) => (
                        <div key={idx} className="flex gap-6 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(218,165,32,0.1)', color: '#daa520' }}>
                                {iconMap[step.icon]}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                                <p className="text-sm mb-3" style={{ color: '#888' }}>{step.desc}</p>
                                <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(218,165,32,0.06)', color: '#daa520' }}>
                                    <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                                    {step.tip}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-8 text-center">{t.faqTitle}</h2>
                    <div className="space-y-4">
                        {t.faqs.map((faq, idx) => (
                            <div key={idx} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 className="text-sm font-semibold text-white mb-2">{faq.q}</h4>
                                <p className="text-sm" style={{ color: '#888' }}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <div className="text-center py-10">
                    <h3 className="text-xl font-bold text-white mb-6">{t.ctaTitle}</h3>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/b2b-store/register" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-black font-semibold text-sm" style={{ background: 'linear-gradient(135deg, #daa520, #ffd700)' }}>
                            {t.ctaBtn} <ChevronRight size={16} />
                        </Link>
                        <Link to="/b2b-store/catalog" className="text-sm font-medium" style={{ color: '#daa520' }}>
                            {t.ctaBrowse}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
