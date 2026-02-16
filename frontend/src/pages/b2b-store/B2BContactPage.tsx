import React, { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';

const content = {
    ro: {
        title: 'Contact',
        subtitle: 'Suntem aici să te ajutăm. Contactează-ne prin orice canal preferi.',
        formTitle: 'Trimite-ne un Mesaj',
        name: 'Nume Complet',
        email: 'Email',
        phone: 'Telefon',
        subject: 'Subiect',
        message: 'Mesaj',
        send: 'Trimite Mesajul',
        sending: 'Se trimite...',
        successTitle: 'Mesaj Trimis!',
        successMsg: 'Vă mulțumim! Vă vom contacta în cel mai scurt timp posibil.',
        infoTitle: 'Informații de Contact',
        phoneLabel: 'Telefon',
        emailLabel: 'Email',
        addressLabel: 'Adresă',
        addressVal: 'România',
        schedule: 'Program',
        scheduleVal: 'Luni - Vineri: 08:00 - 17:00',
        subjects: ['Solicitare ofertă', 'Informații produse', 'Suport tehnic', 'Parteneriat', 'Reclamație', 'Altele'],
    },
    en: {
        title: 'Contact',
        subtitle: 'We are here to help. Contact us through any channel you prefer.',
        formTitle: 'Send us a Message',
        name: 'Full Name',
        email: 'Email',
        phone: 'Phone',
        subject: 'Subject',
        message: 'Message',
        send: 'Send Message',
        sending: 'Sending...',
        successTitle: 'Message Sent!',
        successMsg: 'Thank you! We will get back to you as soon as possible.',
        infoTitle: 'Contact Information',
        phoneLabel: 'Phone',
        emailLabel: 'Email',
        addressLabel: 'Address',
        addressVal: 'Romania',
        schedule: 'Schedule',
        scheduleVal: 'Monday - Friday: 08:00 - 17:00',
        subjects: ['Quote request', 'Product info', 'Technical support', 'Partnership', 'Complaint', 'Other'],
    },
};

export const B2BContactPage: React.FC = () => {
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
                <h1 className="text-4xl font-bold text-white mb-3">{t.title}</h1>
                <p className="text-sm" style={{ color: '#888' }}>{t.subtitle}</p>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold text-white mb-6">{t.infoTitle}</h2>
                        {[
                            { icon: <Phone size={18} />, label: t.phoneLabel, val: '+40 XXX XXX XXX' },
                            { icon: <Mail size={18} />, label: t.emailLabel, val: 'b2b@ledux.ro' },
                            { icon: <MapPin size={18} />, label: t.addressLabel, val: t.addressVal },
                            { icon: <Clock size={18} />, label: t.schedule, val: t.scheduleVal },
                        ].map((item) => (
                            <div key={item.label} className="flex gap-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(218,165,32,0.1)', color: '#daa520' }}>
                                    {item.icon}
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#666' }}>{item.label}</div>
                                    <div className="text-sm font-medium text-white">{item.val}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Form */}
                    <div className="lg:col-span-2 rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {sent ? (
                            <div className="text-center py-12">
                                <CheckCircle size={48} style={{ color: '#10b981' }} className="mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">{t.successTitle}</h3>
                                <p className="text-sm" style={{ color: '#888' }}>{t.successMsg}</p>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-lg font-bold text-white mb-6">{t.formTitle}</h2>
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.name}</label>
                                            <input required type="text" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.email}</label>
                                            <input required type="email" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.phone}</label>
                                            <input type="tel" className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.subject}</label>
                                            <select required className="w-full px-4 py-2.5 rounded-lg text-sm text-white" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                <option value="">—</option>
                                                {t.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>{t.message}</label>
                                        <textarea required rows={5} className="w-full px-4 py-2.5 rounded-lg text-sm text-white resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                    </div>
                                    <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #daa520, #ffd700)' }}>
                                        <Send size={16} />
                                        {loading ? t.sending : t.send}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
