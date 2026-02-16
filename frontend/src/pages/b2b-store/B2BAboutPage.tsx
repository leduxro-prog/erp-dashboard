import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Award, Truck, Headphones, Shield, Target, Zap, CheckCircle2 } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Despre Ledux',
        subtitle: 'Distribuitor autorizat de soluții de iluminat profesional din România',
        storyTitle: 'Povestea Noastră',
        storyP1: 'Ledux.ro a fost fondată cu o misiune clară: să ofere soluții de iluminat de calitate superioară la prețuri competitive pentru profesioniști și companii din România.',
        storyP2: 'Cu o experiență de peste 3 ani în domeniul electric și al corpurilor de iluminat, am construit parteneriate solide cu cei mai importanți producători din industrie, oferind clienților noștri acces la un portofoliu vast de peste 5,000 de produse.',
        storyP3: 'Platforma noastră B2B a fost dezvoltată special pentru a simplifica procesul de achiziție, oferind prețuri transparente, stocuri în timp real și livrare rapidă în toată România.',
        valuesTitle: 'Valorile Noastre',
        values: [
            { icon: 'award', title: 'Calitate', desc: 'Doar produse certificate CE, RoHS și TUV de la producători verificați.' },
            { icon: 'truck', title: 'Livrare Rapidă', desc: 'Livrare în 24-48h din stocul local. Logistică optimizată pentru comenzi B2B.' },
            { icon: 'headphones', title: 'Suport Dedicat', desc: 'Echipă de specialiști disponibili pentru consultanță tehnică și suport pre/post-vânzare.' },
            { icon: 'shield', title: 'Garanție', desc: 'Garanție producător pe toate produsele. Politică flexibilă de retur și înlocuire.' },
            { icon: 'target', title: 'Prețuri Competitive', desc: 'Discounturi progresive pe cantitate. Prețuri negociate direct cu producătorii.' },
            { icon: 'zap', title: 'Inovație', desc: 'Portofoliu actualizat constant cu cele mai noi tehnologii LED de pe piață.' },
        ],
        statsTitle: 'Ledux în Cifre',
        stats: [
            { value: '5,000+', label: 'Produse LED' },
            { value: '200+', label: 'Branduri Partenere' },
            { value: '500+', label: 'Clienți B2B Activi' },
            { value: '98%', label: 'Rată de Satisfacție' },
        ],
        brandsTitle: 'Branduri Partenere',
        ctaTitle: 'Devino Partener Ledux B2B',
        ctaDesc: 'Înregistrează-te acum și beneficiază de prețuri exclusive, suport dedicat și livrare rapidă.',
        ctaBtn: 'Creează Cont B2B',
    },
    en: {
        title: 'About Ledux',
        subtitle: 'Authorized distributor of professional lighting solutions in Romania',
        storyTitle: 'Our Story',
        storyP1: 'Ledux.ro was founded with a clear mission: to provide superior quality lighting solutions at competitive prices for professionals and companies in Romania.',
        storyP2: 'With over 3 years of experience in the electrical and lighting industry, we have built strong partnerships with the most important manufacturers, offering our clients access to a vast portfolio of over 5,000 products.',
        storyP3: 'Our B2B platform was specially developed to simplify the purchasing process, offering transparent pricing, real-time stock, and fast delivery across Romania.',
        valuesTitle: 'Our Values',
        values: [
            { icon: 'award', title: 'Quality', desc: 'Only CE, RoHS, and TUV certified products from verified manufacturers.' },
            { icon: 'truck', title: 'Fast Delivery', desc: '24-48h delivery from local stock. Optimized logistics for B2B orders.' },
            { icon: 'headphones', title: 'Dedicated Support', desc: 'Team of specialists available for technical consulting and pre/post-sales support.' },
            { icon: 'shield', title: 'Warranty', desc: 'Manufacturer warranty on all products. Flexible return and replacement policy.' },
            { icon: 'target', title: 'Competitive Pricing', desc: 'Progressive volume discounts. Prices negotiated directly with manufacturers.' },
            { icon: 'zap', title: 'Innovation', desc: 'Portfolio constantly updated with the latest LED technologies on the market.' },
        ],
        statsTitle: 'Ledux in Numbers',
        stats: [
            { value: '5,000+', label: 'LED Products' },
            { value: '200+', label: 'Partner Brands' },
            { value: '500+', label: 'Active B2B Clients' },
            { value: '98%', label: 'Satisfaction Rate' },
        ],
        brandsTitle: 'Partner Brands',
        ctaTitle: 'Become a Ledux B2B Partner',
        ctaDesc: 'Register now and benefit from exclusive pricing, dedicated support, and fast delivery.',
        ctaBtn: 'Create B2B Account',
    },
};

const iconMap: Record<string, React.ReactNode> = {
    award: <Award size={24} />,
    truck: <Truck size={24} />,
    headphones: <Headphones size={24} />,
    shield: <Shield size={24} />,
    target: <Target size={24} />,
    zap: <Zap size={24} />,
};

const brands = ['Philips', 'Osram', 'Ledvance', 'Eglo', 'V-TAC', 'Fucida', 'Lumen', 'Elba', 'ACA Lighting', 'Elmark', 'MPL', 'LEDprofiles'];

export const B2BAboutPage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            {/* Hero */}
            <div className="py-20 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <div className="max-w-4xl mx-auto px-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{t.title}</h1>
                    <p className="text-lg" style={{ color: '#888' }}>{t.subtitle}</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
                {/* Story */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <Users size={24} style={{ color: '#daa520' }} />
                        {t.storyTitle}
                    </h2>
                    <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#999' }}>
                        <p>{t.storyP1}</p>
                        <p>{t.storyP2}</p>
                        <p>{t.storyP3}</p>
                    </div>
                </section>

                {/* Values */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-8">{t.valuesTitle}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {t.values.map((v) => (
                            <div key={v.title} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(218,165,32,0.1)', color: '#daa520' }}>
                                    {iconMap[v.icon]}
                                </div>
                                <h3 className="text-white font-semibold mb-2">{v.title}</h3>
                                <p className="text-sm" style={{ color: '#777' }}>{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Stats */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-8 text-center">{t.statsTitle}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {t.stats.map((s) => (
                            <div key={s.label} className="text-center rounded-2xl py-8" style={{ background: 'rgba(218,165,32,0.04)', border: '1px solid rgba(218,165,32,0.1)' }}>
                                <div className="text-3xl font-bold mb-1" style={{ color: '#daa520' }}>{s.value}</div>
                                <div className="text-xs uppercase tracking-wider" style={{ color: '#666' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Brands */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-8 text-center">{t.brandsTitle}</h2>
                    <div className="flex flex-wrap justify-center gap-4">
                        {brands.map((b) => (
                            <span key={b} className="px-5 py-2.5 rounded-full text-sm font-medium" style={{ background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {b}
                            </span>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center rounded-2xl py-14 px-6" style={{ background: 'linear-gradient(135deg, rgba(218,165,32,0.08), rgba(184,134,11,0.04))', border: '1px solid rgba(218,165,32,0.15)' }}>
                    <h2 className="text-2xl font-bold text-white mb-3">{t.ctaTitle}</h2>
                    <p className="text-sm mb-6" style={{ color: '#888' }}>{t.ctaDesc}</p>
                    <Link to="/b2b-store/register" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-black font-semibold text-sm" style={{ background: 'linear-gradient(135deg, #daa520, #ffd700)' }}>
                        <CheckCircle2 size={18} />
                        {t.ctaBtn}
                    </Link>
                </section>
            </div>
        </div>
    );
};
