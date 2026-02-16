import React, { useState } from 'react';
import { FileText, Send, CheckCircle, Loader2 } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Cerere Ofertă',
        subtitle: 'Completează formularul de mai jos și vei primi o ofertă personalizată în maxim 24 de ore.',
        company: 'Denumire Firmă',
        name: 'Persoană de Contact',
        email: 'Email',
        phone: 'Telefon',
        products: 'Produse / Descriere Proiect',
        productsPlaceholder: 'Descrieți produsele și cantitățile dorite, sau proiectul pentru care aveți nevoie de ofertă. Includeți detalii tehnice relevante (puterea, temperatura de culoare, grad IP, etc.).',
        quantity: 'Cantitate Estimativă',
        deadline: 'Dată Livrare Dorită',
        notes: 'Observații Suplimentare',
        send: 'Trimite Cererea de Ofertă',
        sending: 'Se trimite...',
        successTitle: 'Cerere Trimisă!',
        successMsg: 'Vă mulțumim! Un specialist vă va contacta în maxim 24 de ore cu oferta personalizată.',
    },
    en: {
        title: 'Request Quote',
        subtitle: 'Fill in the form below and you will receive a personalized quote within 24 hours.',
        company: 'Company Name',
        name: 'Contact Person',
        email: 'Email',
        phone: 'Phone',
        products: 'Products / Project Description',
        productsPlaceholder: 'Describe the products and quantities you need, or the project you need a quote for. Include relevant technical details (wattage, color temperature, IP rating, etc.).',
        quantity: 'Estimated Quantity',
        deadline: 'Desired Delivery Date',
        notes: 'Additional Notes',
        send: 'Submit Quote Request',
        sending: 'Sending...',
        successTitle: 'Request Sent!',
        successMsg: 'Thank you! A specialist will contact you within 24 hours with a personalized quote.',
    },
};

const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

export const B2BRequestQuotePage: React.FC = () => {
    const { language } = useGlobalLanguage();
    const t = content[language];
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => { setLoading(false); setSent(true); }, 1200);
    };

    return (
        <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
            <div className="py-16 text-center" style={{ background: 'linear-gradient(180deg, rgba(218,165,32,0.08) 0%, transparent 100%)' }}>
                <FileText size={32} className="mx-auto mb-3" style={{ color: '#daa520' }} />
                <h1 className="text-4xl font-bold text-white mb-3">{t.title}</h1>
                <p className="text-sm" style={{ color: '#888' }}>{t.subtitle}</p>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {sent ? (
                        <div className="text-center py-12">
                            <CheckCircle size={48} style={{ color: '#10b981' }} className="mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">{t.successTitle}</h3>
                            <p className="text-sm" style={{ color: '#888' }}>{t.successMsg}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.company} *</label>
                                    <input required type="text" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={inputStyle} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.name} *</label>
                                    <input required type="text" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={inputStyle} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.email} *</label>
                                    <input required type="email" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={inputStyle} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.phone}</label>
                                    <input type="tel" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.products} *</label>
                                <textarea required rows={6} className="w-full px-4 py-2.5 rounded-lg text-sm text-white resize-none" style={inputStyle} placeholder={t.productsPlaceholder} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.quantity}</label>
                                    <input type="text" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={inputStyle} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.deadline}</label>
                                    <input type="date" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.notes}</label>
                                <textarea rows={3} className="w-full px-4 py-2.5 rounded-lg text-sm text-white resize-none" style={inputStyle} />
                            </div>
                            <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #daa520, #ffd700)' }}>
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {loading ? t.sending : t.send}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
