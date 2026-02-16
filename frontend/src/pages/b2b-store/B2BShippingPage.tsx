import React from 'react';
import { Truck, RotateCcw, Package, Clock, MapPin, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Livrare & Retur',
        subtitle: 'Toate informațiile despre livrare, costuri de transport și politica de retur',
        deliveryTitle: 'Informații Livrare',
        deliveryItems: [
            { icon: 'package', title: 'Stoc Local — Livrare 24-48h', desc: 'Produsele disponibile în stocul nostru local sunt expediate în aceeași zi (comenzi plasate până la ora 14:00) și ajung la destinație în 24-48h.' },
            { icon: 'clock', title: 'Stoc Furnizor — 3-7 Zile Lucrătoare', desc: 'Produsele comandate de la furnizori necesită un termen suplimentar de 3-7 zile lucrătoare, în funcție de disponibilitate.' },
            { icon: 'truck', title: 'Transport Gratuit peste 2,000 RON', desc: 'Pentru comenzi cu valoare de minim 2,000 RON (fără TVA), transportul este gratuit pe întreg teritoriul României.' },
            { icon: 'mappin', title: 'Acoperire Națională', desc: 'Livrăm în toată România, prin curierat rapid. Opțiune de livrare express disponibilă contra cost suplimentar.' },
        ],
        costsTitle: 'Costuri Transport',
        costs: [
            { range: 'Comenzi sub 500 RON', cost: '25 RON' },
            { range: 'Comenzi 500 - 1,999 RON', cost: '15 RON' },
            { range: 'Comenzi peste 2,000 RON', cost: 'GRATUIT' },
            { range: 'Livrare Express (24h)', cost: '+35 RON' },
        ],
        returnTitle: 'Politica de Retur',
        returnItems: [
            { title: 'Termen Retur: 30 de Zile', desc: 'Aveți dreptul de a returna produsele în termen de 30 de zile calendaristice de la data primirii, fără a fi necesară justificarea deciziei.' },
            { title: 'Condiții de Retur', desc: 'Produsele trebuie returnate în ambalajul original, nefolosite și în stare completă. Etichetele și sigiliile nu trebuie deteriorate.' },
            { title: 'Retur Gratuit pentru Produse Defecte', desc: 'În cazul produselor defecte sau deteriorate din fabricație, costul returnării este suportat integral de Ledux.ro.' },
            { title: 'Rambursare', desc: 'Rambursarea se efectuează în maxim 14 zile lucrătoare de la primirea produselor returnate. Sumele se returnează prin aceeași metodă de plată folosită la achiziție.' },
        ],
        warrantyTitle: 'Garanție',
        warrantyItems: [
            'Garanție producător pe toate produsele — minim 2 ani, până la 5 ani pentru anumite game.',
            'Certificare completă: CE, RoHS, TUV pentru toate produsele din portofoliu.',
            'Suport tehnic și asistență în procesul de garanție.',
            'Înlocuire rapidă pentru produsele constatate defecte în perioada de garanție.',
        ],
    },
    en: {
        title: 'Shipping & Returns',
        subtitle: 'All information about delivery, shipping costs, and return policy',
        deliveryTitle: 'Delivery Information',
        deliveryItems: [
            { icon: 'package', title: 'Local Stock — 24-48h Delivery', desc: 'Products available in our local stock are shipped the same day (orders placed before 2:00 PM) and arrive within 24-48h.' },
            { icon: 'clock', title: 'Supplier Stock — 3-7 Business Days', desc: 'Products ordered from suppliers require an additional 3-7 business days, depending on availability.' },
            { icon: 'truck', title: 'Free Shipping over 2,000 RON', desc: 'For orders with a minimum value of 2,000 RON (excl. VAT), shipping is free across Romania.' },
            { icon: 'mappin', title: 'National Coverage', desc: 'We deliver across all of Romania through express courier. Express delivery option available at an extra cost.' },
        ],
        costsTitle: 'Shipping Costs',
        costs: [
            { range: 'Orders under 500 RON', cost: '25 RON' },
            { range: 'Orders 500 - 1,999 RON', cost: '15 RON' },
            { range: 'Orders over 2,000 RON', cost: 'FREE' },
            { range: 'Express Delivery (24h)', cost: '+35 RON' },
        ],
        returnTitle: 'Return Policy',
        returnItems: [
            { title: 'Return Period: 30 Days', desc: 'You have the right to return products within 30 calendar days from receipt, without requiring justification.' },
            { title: 'Return Conditions', desc: 'Products must be returned in original packaging, unused and in complete condition. Labels and seals must not be damaged.' },
            { title: 'Free Returns for Defective Products', desc: 'In the case of defective or factory-damaged products, the return cost is fully covered by Ledux.ro.' },
            { title: 'Refund', desc: 'Refunds are processed within 14 business days from receiving the returned products. Amounts are returned via the same payment method used for purchase.' },
        ],
        warrantyTitle: 'Warranty',
        warrantyItems: [
            'Manufacturer warranty on all products — minimum 2 years, up to 5 years for certain ranges.',
            'Full certification: CE, RoHS, TUV for all products in the portfolio.',
            'Technical support and assistance in the warranty process.',
            'Quick replacement for products found defective during the warranty period.',
        ],
    },
};

const iconMap: Record<string, React.ReactNode> = {
    package: <Package size={20} />,
    clock: <Clock size={20} />,
    truck: <Truck size={20} />,
    mappin: <MapPin size={20} />,
};

export const B2BShippingPage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <h1 className="text-4xl font-bold text-white mb-3">{t.title}</h1>
                <p className="text-sm" style={{ color: '#888' }}>{t.subtitle}</p>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
                {/* Delivery */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                        <Truck size={24} style={{ color: '#daa520' }} /> {t.deliveryTitle}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {t.deliveryItems.map((item) => (
                            <div key={item.title} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span style={{ color: '#daa520' }}>{iconMap[item.icon]}</span>
                                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                                </div>
                                <p className="text-sm" style={{ color: '#888' }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Costs Table */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-6">{t.costsTitle}</h2>
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {t.costs.map((row, idx) => (
                            <div key={row.range} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: idx < t.costs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <span className="text-sm" style={{ color: '#888' }}>{row.range}</span>
                                <span className="text-sm font-bold" style={{ color: row.cost === 'GRATUIT' || row.cost === 'FREE' ? '#10b981' : '#daa520' }}>{row.cost}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Returns */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                        <RotateCcw size={24} style={{ color: '#daa520' }} /> {t.returnTitle}
                    </h2>
                    <div className="space-y-4">
                        {t.returnItems.map((item) => (
                            <div key={item.title} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                    <AlertCircle size={14} style={{ color: '#daa520' }} /> {item.title}
                                </h4>
                                <p className="text-sm" style={{ color: '#888' }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Warranty */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <Shield size={24} style={{ color: '#daa520' }} /> {t.warrantyTitle}
                    </h2>
                    <div className="rounded-2xl p-6" style={{ background: 'rgba(218,165,32,0.03)', border: '1px solid rgba(218,165,32,0.1)' }}>
                        <ul className="space-y-3">
                            {t.warrantyItems.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm" style={{ color: '#999' }}>
                                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#daa520' }} />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
};
