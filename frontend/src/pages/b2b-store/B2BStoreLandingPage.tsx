
import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Zap, Package, Truck, BarChart3,
    CreditCard, Headphones, ChevronRight, Star,
    CheckCircle2, Shield
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

const categories = [
    {
        title: 'Corpuri de Iluminat LED',
        desc: 'Plafoniere, aplice, suspensii, downlight-uri',
        image: '/images/b2b/cat-led-fixtures.png',
        count: '1,200+ produse',
    },
    {
        title: 'Panouri LED',
        desc: 'Panouri încastrate și aplicabile 600x600, 300x1200',
        image: '/images/b2b/cat-led-panels.png',
        count: '350+ produse',
    },
    {
        title: 'Iluminat Industrial',
        desc: 'High bay, proiectoare, tuburi LED T8/T5',
        image: '/images/b2b/cat-industrial.png',
        count: '800+ produse',
    },
    {
        title: 'Benzi & Accesorii LED',
        desc: 'Benzi RGB, alb cald/rece, surse, controllere',
        image: '/images/b2b/cat-led-strips.png',
        count: '500+ produse',
    },
];

const features = [
    {
        icon: <Zap className="h-6 w-6 text-white" />,
        title: 'Prețuri B2B Personalizate',
        desc: 'Niveluri de discount configurabile per client. Prețurile reale se afișează doar după validarea contului.',
        gradient: 'linear-gradient(135deg, #daa520, #b8860b)',
    },
    {
        icon: <Package className="h-6 w-6 text-white" />,
        title: 'Stoc în Timp Real',
        desc: 'Vizibilitate completă: stoc local cu livrare 24h și stoc furnizor cu estimare zile livrare.',
        gradient: 'linear-gradient(135deg, #4f8eff, #2563eb)',
    },
    {
        icon: <Truck className="h-6 w-6 text-white" />,
        title: 'Livrare Rapidă',
        desc: 'Expediere în 24-48h pentru stoc local. Tracking automat și notificări pe WhatsApp.',
        gradient: 'linear-gradient(135deg, #10b981, #059669)',
    },
    {
        icon: <BarChart3 className="h-6 w-6 text-white" />,
        title: 'Specificații Tehnice Complete',
        desc: 'Watt, Lumeni, IP rating, Temperatura culoare, CRI, Durata de viață — totul într-o fișă completă.',
        gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    },
    {
        icon: <CreditCard className="h-6 w-6 text-white" />,
        title: 'Facturare Net 30',
        desc: 'Plata la 30 de zile pentru clienții validați. Limită de credit dinamică bazată pe istoric.',
        gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    },
    {
        icon: <Headphones className="h-6 w-6 text-white" />,
        title: 'Suport Tehnic Dedicat',
        desc: 'Ghid de selecție produse, simulare proiecte și consultanță tehnică gratuită.',
        gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    },
];

const brands = [
    'Philips', 'Osram', 'Ledvance', 'Eglo',
    'V-TAC', 'Fucida', 'Lumen', 'Elba',
];

const stats = [
    { value: '5,000+', label: 'Produse LED' },
    { value: '200+', label: 'Branduri' },
    { value: '24-48h', label: 'Livrare' },
    { value: 'Net 30', label: 'Facturare' },
];

export const B2BStoreLandingPage: React.FC = () => {
    return (
        <div style={{ background: '#0a0a0f' }}>

            {/* ========== HERO ========== */}
            <section className="relative overflow-hidden" style={{ minHeight: '85vh' }}>
                {/* Background Image */}
                <div className="absolute inset-0">
                    <img
                        src="/images/b2b/hero-lighting.png"
                        alt="Showroom iluminat LED"
                        className="w-full h-full object-cover"
                        style={{ opacity: 0.35 }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(180deg, rgba(10,10,15,0.7) 0%, rgba(10,10,15,0.95) 100%)',
                        }}
                    />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 lg:pt-36 lg:pb-32">
                    <div className="max-w-4xl">
                        {/* Badge */}
                        <div
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-8"
                            style={{
                                background: 'rgba(218, 165, 32, 0.12)',
                                border: '1px solid rgba(218, 165, 32, 0.25)',
                                color: '#daa520',
                            }}
                        >
                            <span className="relative flex h-2 w-2">
                                <span
                                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                    style={{ background: '#daa520' }}
                                />
                                <span
                                    className="relative inline-flex rounded-full h-2 w-2"
                                    style={{ background: '#daa520' }}
                                />
                            </span>
                            Portal B2B — Prețuri Exclusive pentru Profesioniști
                        </div>

                        <h1
                            className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]"
                            style={{ color: '#fff' }}
                        >
                            Iluminat Profesional
                            <br />
                            la{' '}
                            <span
                                style={{
                                    backgroundImage: 'linear-gradient(135deg, #daa520, #ffd700)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                Prețuri B2B
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl mb-10 leading-relaxed max-w-2xl" style={{ color: '#8a8a9a' }}>
                            Catalog complet de corpuri LED, panouri, spoturi, proiectoare și accesorii.
                            Stoc în timp real, livrare 24h și facturare la 30 zile.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 mb-12">
                            <Link to="/b2b-store/register">
                                <Button
                                    size="lg"
                                    className="h-14 px-8 text-lg font-semibold text-black rounded-full shadow-xl"
                                    style={{
                                        background: 'linear-gradient(135deg, #daa520, #ffd700)',
                                        boxShadow: '0 8px 32px rgba(218, 165, 32, 0.25)',
                                    }}
                                >
                                    Creează Cont Business
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link to="/b2b-store/catalog">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-14 px-8 text-lg rounded-full"
                                    style={{
                                        borderColor: 'rgba(218,165,32,0.3)',
                                        color: '#daa520',
                                        background: 'transparent',
                                    }}
                                >
                                    Vezi Catalogul
                                </Button>
                            </Link>
                        </div>

                        {/* Trust indicators */}
                        <div className="flex flex-wrap items-center gap-6 text-sm" style={{ color: '#666' }}>
                            {[
                                'Aprobare Instantă',
                                'Fără Card Bancar',
                                'Suport WhatsApp',
                            ].map((item) => (
                                <div key={item} className="flex items-center gap-2">
                                    <CheckCircle2 size={14} style={{ color: '#daa520' }} />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Decorative glow */}
                <div
                    className="absolute top-1/2 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #daa520, transparent)' }}
                />
            </section>

            {/* ========== STATS BAR ========== */}
            <section
                className="py-8"
                style={{
                    background: 'rgba(218, 165, 32, 0.04)',
                    borderTop: '1px solid rgba(218,165,32,0.1)',
                    borderBottom: '1px solid rgba(218,165,32,0.1)',
                }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                        {stats.map((s) => (
                            <div key={s.label}>
                                <div className="text-3xl md:text-4xl font-bold mb-1" style={{ color: '#daa520' }}>
                                    {s.value}
                                </div>
                                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== CATEGORY SHOWCASE ========== */}
            <section className="py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#daa520' }}>
                            Catalog Profesional
                        </p>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Categorii de Produse
                        </h2>
                        <p className="text-lg" style={{ color: '#666' }}>
                            De la iluminat rezidențial la hale industriale — tot ce ai nevoie dintr-un singur loc.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {categories.map((cat) => (
                            <Link
                                to="/b2b-store/catalog"
                                key={cat.title}
                                className="group relative overflow-hidden rounded-2xl"
                                style={{
                                    border: '1px solid rgba(218,165,32,0.1)',
                                    height: '320px',
                                }}
                            >
                                <img
                                    src={cat.image}
                                    alt={cat.title}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div
                                    className="absolute inset-0 transition-opacity duration-300"
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)',
                                    }}
                                />
                                <div className="absolute bottom-0 left-0 right-0 p-7">
                                    <span className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: '#daa520' }}>
                                        {cat.count}
                                    </span>
                                    <h3 className="text-2xl font-bold text-white mb-1">{cat.title}</h3>
                                    <p className="text-sm mb-4" style={{ color: '#999' }}>{cat.desc}</p>
                                    <div
                                        className="inline-flex items-center gap-1.5 text-sm font-medium transition-all group-hover:gap-3"
                                        style={{ color: '#daa520' }}
                                    >
                                        Vezi Produsele <ChevronRight size={14} />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== FEATURES GRID ========== */}
            <section
                className="py-24"
                style={{
                    background: 'linear-gradient(180deg, rgba(218,165,32,0.03) 0%, rgba(10,10,15,1) 100%)',
                }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#daa520' }}>
                            De Ce Să Alegi Ledux B2B
                        </p>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Totul pentru afacerea ta de iluminat
                        </h2>
                        <p className="text-lg" style={{ color: '#666' }}>
                            Platformă construită special pentru distribuitori, instalatori și magazine de specialitate.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f, idx) => (
                            <div
                                key={idx}
                                className="rounded-2xl p-8 group transition-all duration-300 hover:-translate-y-1"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(218,165,32,0.2)';
                                    e.currentTarget.style.background = 'rgba(218,165,32,0.04)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                }}
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-lg"
                                    style={{ background: f.gradient }}
                                >
                                    {f.icon}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                                <p className="leading-relaxed" style={{ color: '#777' }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== BRANDS TRUST BAR ========== */}
            <section className="py-16" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-xs font-medium uppercase tracking-wider mb-10" style={{ color: '#555' }}>
                        Branduri Partenere
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16">
                        {brands.map((brand) => (
                            <span
                                key={brand}
                                className="text-2xl md:text-3xl font-bold tracking-tight opacity-25 hover:opacity-50 transition-opacity cursor-default"
                                style={{ color: '#fff' }}
                            >
                                {brand}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== HOW IT WORKS ========== */}
            <section className="py-24" style={{ background: 'rgba(218,165,32,0.03)' }}>
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#daa520' }}>
                            Cum Funcționează
                        </p>
                        <h2 className="text-3xl md:text-4xl font-bold text-white">
                            3 Pași Simpli
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Înregistrare',
                                desc: 'Completează formularul cu datele firmei. Validăm contul în maxim 24h.',
                                icon: <Shield size={24} />,
                            },
                            {
                                step: '02',
                                title: 'Navighează & Comandă',
                                desc: 'Accesezi cataloful cu prețuri B2B, adaugi în coș și plasezi comanda.',
                                icon: <Package size={24} />,
                            },
                            {
                                step: '03',
                                title: 'Livrare & Facturare',
                                desc: 'Primești livrarea în 24-48h și factura cu termen de plată negociat.',
                                icon: <Truck size={24} />,
                            },
                        ].map((s) => (
                            <div key={s.step} className="text-center">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                                    style={{
                                        background: 'rgba(218,165,32,0.08)',
                                        border: '1px solid rgba(218,165,32,0.15)',
                                        color: '#daa520',
                                    }}
                                >
                                    {s.icon}
                                </div>
                                <span
                                    className="text-xs font-bold uppercase tracking-widest block mb-2"
                                    style={{ color: '#daa520' }}
                                >
                                    Pasul {s.step}
                                </span>
                                <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: '#666' }}>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== CTA SECTION ========== */}
            <section className="py-24 relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(218,165,32,0.15), transparent 70%)',
                    }}
                />
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <div
                        className="inline-flex items-center gap-1.5 mb-6 px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                            background: 'rgba(218,165,32,0.1)',
                            color: '#daa520',
                            border: '1px solid rgba(218,165,32,0.2)',
                        }}
                    >
                        <Star size={12} /> Ofertă Specială Lansare
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Gata să comanzi la prețuri
                        <br />
                        <span style={{ color: '#daa520' }}>de distribuitor?</span>
                    </h2>
                    <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#666' }}>
                        Creează-ți contul business și accesează instantaneu prețurile wholesale
                        pentru întregul catalog de iluminat LED.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/b2b-store/register">
                            <Button
                                size="lg"
                                className="h-14 px-10 text-lg font-semibold text-black rounded-full shadow-xl"
                                style={{
                                    background: 'linear-gradient(135deg, #daa520, #ffd700)',
                                    boxShadow: '0 8px 32px rgba(218, 165, 32, 0.3)',
                                }}
                            >
                                Creează Cont Business
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Link to="/b2b-store/contact">
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-14 px-10 text-lg rounded-full"
                                style={{
                                    borderColor: 'rgba(255,255,255,0.15)',
                                    color: '#aaa',
                                    background: 'transparent',
                                }}
                            >
                                Solicită Ofertă
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};
