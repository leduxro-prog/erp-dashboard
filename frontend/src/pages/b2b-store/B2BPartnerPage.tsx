import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, TrendingUp, Percent, Headphones, Award, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Program Partener B2B',
        subtitle: 'Creștem împreună — beneficii exclusive pentru partenerii Ledux',
        tiers: [
            { name: 'Silver', minOrder: '5,000 RON/lună', discount: '5%', benefits: ['Discount 5% pe toate produsele', 'Manager cont dedicat', 'Suport prioritar'] },
            { name: 'Gold', minOrder: '15,000 RON/lună', discount: '10%', benefits: ['Discount 10% pe toate produsele', 'Manager cont dedicat', 'Suport prioritar 24/7', 'Credit Net 30 zile', 'Transport gratuit'] },
            { name: 'Platinum', minOrder: '50,000 RON/lună', discount: '15%', benefits: ['Discount 15% pe toate produsele', 'Manager cont senior dedicat', 'Suport 24/7 + linie directă', 'Credit Net 60 zile', 'Transport gratuit + express', 'Prețuri negociate la proiecte', 'Acces anticipat la produse noi'] },
        ],
        benefitsTitle: 'Beneficii Generale',
        benefits: [
            { icon: 'percent', title: 'Prețuri Progresive', desc: 'Cu cât achiziționezi mai mult, cu atât beneficiezi de prețuri mai avantajoase.' },
            { icon: 'trending', title: 'Creștere Sustenabilă', desc: 'Suport de marketing, materiale promoționale și training produse pentru echipa ta.' },
            { icon: 'headphones', title: 'Suport Tehnic Expert', desc: 'Consultanță specializată în iluminat LED, planificare proiecte și calcule luminotehnice.' },
            { icon: 'award', title: 'Program Recompense', desc: 'Bonusuri și recompense speciale la atingerea pragurilor anuale de achiziții.' },
        ],
        ctaTitle: 'Aplică la Programul de Parteneriat',
        ctaDesc: 'Înregistrează-te acum și un specialist te va contacta pentru detalii.',
        ctaBtn: 'Aplică Acum',
    },
    en: {
        title: 'B2B Partner Program',
        subtitle: 'Growing together — exclusive benefits for Ledux partners',
        tiers: [
            { name: 'Silver', minOrder: '5,000 RON/month', discount: '5%', benefits: ['5% discount on all products', 'Dedicated account manager', 'Priority support'] },
            { name: 'Gold', minOrder: '15,000 RON/month', discount: '10%', benefits: ['10% discount on all products', 'Dedicated account manager', '24/7 priority support', 'Net 30 day credit', 'Free shipping'] },
            { name: 'Platinum', minOrder: '50,000 RON/month', discount: '15%', benefits: ['15% discount on all products', 'Senior dedicated account manager', '24/7 support + direct line', 'Net 60 day credit', 'Free shipping + express', 'Negotiated project pricing', 'Early access to new products'] },
        ],
        benefitsTitle: 'General Benefits',
        benefits: [
            { icon: 'percent', title: 'Progressive Pricing', desc: 'The more you purchase, the better your pricing becomes.' },
            { icon: 'trending', title: 'Sustainable Growth', desc: 'Marketing support, promotional materials, and product training for your team.' },
            { icon: 'headphones', title: 'Expert Technical Support', desc: 'Specialized LED lighting consulting, project planning, and photometric calculations.' },
            { icon: 'award', title: 'Rewards Program', desc: 'Special bonuses and rewards when reaching annual purchase thresholds.' },
        ],
        ctaTitle: 'Apply to the Partner Program',
        ctaDesc: 'Register now and a specialist will contact you for details.',
        ctaBtn: 'Apply Now',
    },
};

const iconMap: Record<string, React.ReactNode> = {
    percent: <Percent size={22} />,
    trending: <TrendingUp size={22} />,
    headphones: <Headphones size={22} />,
    award: <Award size={22} />,
};

const tierColors: Record<string, { bg: string; border: string; badge: string }> = {
    Silver: { bg: 'rgba(192,192,192,0.04)', border: 'rgba(192,192,192,0.15)', badge: '#c0c0c0' },
    Gold: { bg: 'rgba(218,165,32,0.04)', border: 'rgba(218,165,32,0.15)', badge: '#daa520' },
    Platinum: { bg: 'rgba(229,228,226,0.04)', border: 'rgba(229,228,226,0.15)', badge: '#e5e4e2' },
};

export const B2BPartnerPage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <div className="flex items-center justify-center gap-3 mb-4">
                    <Briefcase size={32} style={{ color: '#daa520' }} />
                    <h1 className="text-4xl font-bold text-white">{t.title}</h1>
                </div>
                <p className="text-sm" style={{ color: '#888' }}>{t.subtitle}</p>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
                {/* Tiers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {t.tiers.map((tier) => {
                        const colors = tierColors[tier.name];
                        return (
                            <div key={tier.name} className="rounded-2xl p-6 flex flex-col" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                                <div className="text-center mb-6">
                                    <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3" style={{ color: colors.badge, background: `${colors.badge}15` }}>
                                        {tier.name}
                                    </span>
                                    <div className="text-3xl font-bold text-white mb-1">-{tier.discount}</div>
                                    <div className="text-xs" style={{ color: '#666' }}>min. {tier.minOrder}</div>
                                </div>
                                <ul className="space-y-3 flex-grow">
                                    {tier.benefits.map((b) => (
                                        <li key={b} className="flex items-start gap-2 text-sm" style={{ color: '#999' }}>
                                            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: colors.badge }} />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                {/* Benefits */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-8 text-center">{t.benefitsTitle}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {t.benefits.map((b) => (
                            <div key={b.title} className="flex gap-4 rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(218,165,32,0.1)', color: '#daa520' }}>
                                    {iconMap[b.icon]}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white mb-1">{b.title}</h3>
                                    <p className="text-sm" style={{ color: '#777' }}>{b.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <div className="text-center rounded-2xl py-14 px-6" style={{ background: 'linear-gradient(135deg, rgba(218,165,32,0.08), rgba(184,134,11,0.04))', border: '1px solid rgba(218,165,32,0.15)' }}>
                    <h2 className="text-2xl font-bold text-white mb-3">{t.ctaTitle}</h2>
                    <p className="text-sm mb-6" style={{ color: '#888' }}>{t.ctaDesc}</p>
                    <Link to="/b2b-store/register" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-black font-semibold text-sm" style={{ background: 'linear-gradient(135deg, #daa520, #ffd700)' }}>
                        {t.ctaBtn} <ChevronRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
};
