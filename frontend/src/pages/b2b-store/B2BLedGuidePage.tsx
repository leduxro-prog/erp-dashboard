import React from 'react';
import { Lightbulb, Thermometer, Zap, Gauge, Shield, Eye, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Ghid Tehnic LED',
        subtitle: 'Tot ce trebuie să știi despre tehnologia LED — de la bază la aplicații avansate',
        sections: [
            {
                icon: 'bulb', title: 'Ce este LED-ul?',
                text: 'LED (Light Emitting Diode) este un dispozitiv semiconductor care emite lumină atunci când curentul electric trece prin el. Comparativ cu becurile tradiționale incandescente, LED-urile sunt de până la 90% mai eficiente energetic și au o durată de viață de 25-50x mai mare.',
            },
            {
                icon: 'thermometer', title: 'Temperatura de Culoare (Kelvin)',
                text: 'Temperatura de culoare determină "căldura" sau "răceala" luminii:',
                items: ['2700K - 3000K: Alb cald (warm white) — ideal pentru spații rezidențiale, restaurante, hoteluri', '4000K - 4500K: Alb neutru (neutral white) — ideal pentru birouri, spații comerciale', '5000K - 6500K: Alb rece (daylight) — ideal pentru hale industriale, ateliere, spitale'],
            },
            {
                icon: 'zap', title: 'Eficiență Luminoasă (lm/W)',
                text: 'Eficiența luminoasă măsoară cantitatea de lumină produsă per W consumat. LED-urile moderne ating 120-200 lm/W, comparativ cu 10-17 lm/W la becurile incandescente. Exemplu: un panou LED de 40W produce aceeași lumină ca un bec incandescent de 300W.',
            },
            {
                icon: 'gauge', title: 'Indicele de Redare a Culorilor (CRI/Ra)',
                text: 'CRI (Color Rendering Index) măsoară cât de fidel redă o sursă de lumină culorile obiectelor, pe o scară de 0-100:',
                items: ['CRI > 90: Excelent — ideal pentru galerii, magazine de haine, spitale', 'CRI 80-90: Bun — potrivit pentru birouri, școli, retail general', 'CRI < 80: Acceptabil — suficient pentru iluminat industrial, parcări'],
            },
            {
                icon: 'shield', title: 'Grad de Protecție IP',
                text: 'Codul IP (Ingress Protection) indică nivelul de protecție al corpului de iluminat împotriva prafului și apei:',
                items: ['IP20: Interior standard (fără protecție la apă)', 'IP44: Protecție la stropire — ideal pentru băi, bucătării', 'IP65: Protecție la jet de apă — ideal pentru exterior, terase', 'IP67/68: Submersibil — ideal pentru fântâni, piscine'],
            },
            {
                icon: 'eye', title: 'Flicker și UGR',
                text: 'Flicker-ul (pâlpâirea) poate cauza oboseală oculară. Alegeți LED-uri cu driver fără flicker (flicker-free). UGR (Unified Glare Rating) măsoară strălucirea deranjantă — pentru birouri se recomandă UGR < 19, iar pentru zone industriale UGR < 25.',
            },
        ],
        tipTitle: 'Sfaturi pentru Alegerea Corpurilor LED',
        tips: [
            'Calculați necesarul luminos: pentru birouri se recomandă 500 lux, pentru hale industriale 300-500 lux.',
            'Verificați certificările: CE, RoHS și TUV sunt obligatorii pentru produse sigure.',
            'Alegeți drivere de calitate — un driver slab reduce drastic durata de viață a LED-ului.',
            'Pentru proiecte mari, solicitați calcule luminotehnice gratuite de la echipa Ledux.',
        ],
        ctaTitle: 'Ai nevoie de consultanță tehnică?',
        ctaBtn: 'Contactează un Specialist',
    },
    en: {
        title: 'LED Tech Guide',
        subtitle: 'Everything you need to know about LED technology — from basics to advanced applications',
        sections: [
            {
                icon: 'bulb', title: 'What is LED?',
                text: 'LED (Light Emitting Diode) is a semiconductor device that emits light when electric current passes through it. Compared to traditional incandescent bulbs, LEDs are up to 90% more energy efficient and have a 25-50x longer lifespan.',
            },
            {
                icon: 'thermometer', title: 'Color Temperature (Kelvin)',
                text: 'Color temperature determines the "warmth" or "coolness" of light:',
                items: ['2700K - 3000K: Warm white — ideal for residential spaces, restaurants, hotels', '4000K - 4500K: Neutral white — ideal for offices, commercial spaces', '5000K - 6500K: Daylight — ideal for industrial halls, workshops, hospitals'],
            },
            {
                icon: 'zap', title: 'Luminous Efficacy (lm/W)',
                text: 'Luminous efficacy measures the amount of light produced per W consumed. Modern LEDs achieve 120-200 lm/W, compared to 10-17 lm/W for incandescent bulbs. Example: a 40W LED panel produces the same light as a 300W incandescent bulb.',
            },
            {
                icon: 'gauge', title: 'Color Rendering Index (CRI/Ra)',
                text: 'CRI (Color Rendering Index) measures how faithfully a light source renders object colors, on a 0-100 scale:',
                items: ['CRI > 90: Excellent — ideal for galleries, clothing stores, hospitals', 'CRI 80-90: Good — suitable for offices, schools, general retail', 'CRI < 80: Acceptable — sufficient for industrial lighting, parking'],
            },
            {
                icon: 'shield', title: 'IP Protection Rating',
                text: 'The IP (Ingress Protection) code indicates the level of protection against dust and water:',
                items: ['IP20: Standard indoor (no water protection)', 'IP44: Splash-proof — ideal for bathrooms, kitchens', 'IP65: Jet-proof — ideal for outdoor, terraces', 'IP67/68: Submersible — ideal for fountains, pools'],
            },
            {
                icon: 'eye', title: 'Flicker and UGR',
                text: 'Flicker can cause eye strain. Choose LEDs with flicker-free drivers. UGR (Unified Glare Rating) measures discomfort glare — for offices UGR < 19 is recommended, for industrial areas UGR < 25.',
            },
        ],
        tipTitle: 'Tips for Choosing LED Fixtures',
        tips: [
            'Calculate your light requirements: 500 lux is recommended for offices, 300-500 lux for industrial halls.',
            'Check certifications: CE, RoHS, and TUV are mandatory for safe products.',
            'Choose quality drivers — a poor driver drastically reduces LED lifespan.',
            'For large projects, request free photometric calculations from the Ledux team.',
        ],
        ctaTitle: 'Need technical consulting?',
        ctaBtn: 'Contact a Specialist',
    },
};

const iconMap: Record<string, React.ReactNode> = {
    bulb: <Lightbulb size={22} />,
    thermometer: <Thermometer size={22} />,
    zap: <Zap size={22} />,
    gauge: <Gauge size={22} />,
    shield: <Shield size={22} />,
    eye: <Eye size={22} />,
};

export const B2BLedGuidePage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <h1 className="text-4xl font-bold text-white mb-3">{t.title}</h1>
                <p className="text-sm" style={{ color: '#888' }}>{t.subtitle}</p>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
                {t.sections.map((sec) => (
                    <section key={sec.title} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <span style={{ color: '#daa520' }}>{iconMap[sec.icon]}</span>
                            <h2 className="text-lg font-bold text-white">{sec.title}</h2>
                        </div>
                        <p className="text-sm leading-relaxed mb-3" style={{ color: '#888' }}>{sec.text}</p>
                        {sec.items && (
                            <ul className="space-y-2 ml-2">
                                {sec.items.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: '#999' }}>
                                        <ChevronRight size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#daa520' }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}

                {/* Tips */}
                <section className="rounded-2xl p-6" style={{ background: 'rgba(218,165,32,0.03)', border: '1px solid rgba(218,165,32,0.1)' }}>
                    <h2 className="text-lg font-bold text-white mb-4">💡 {t.tipTitle}</h2>
                    <ul className="space-y-3">
                        {t.tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: '#999' }}>
                                <span className="font-bold" style={{ color: '#daa520' }}>{idx + 1}.</span>
                                {tip}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* CTA */}
                <div className="text-center py-8">
                    <h3 className="text-xl font-bold text-white mb-4">{t.ctaTitle}</h3>
                    <Link to="/b2b-store/contact" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-black font-semibold text-sm" style={{ background: 'linear-gradient(135deg, #daa520, #ffd700)' }}>
                        {t.ctaBtn}
                    </Link>
                </div>
            </div>
        </div>
    );
};
