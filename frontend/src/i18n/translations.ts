export const translations = {
    // ========== Layout ==========
    layout: {
        nav: {
            home: { ro: 'Acasă', en: 'Home' },
            catalog: { ro: 'Catalog', en: 'Catalog' },
            about: { ro: 'Despre Noi', en: 'About Us' },
            contact: { ro: 'Contact', en: 'Contact' },
        },
        announcement: {
            text: {
                ro: '🔥 Prețuri speciale B2B — Înregistrează-te acum și primești discount suplimentar la prima comandă.',
                en: '🔥 Special B2B Prices — Register now and get an extra discount on your first order.',
            },
            cta: { ro: 'Creează Cont →', en: 'Create Account →' },
        },
        auth: {
            login: { ro: 'Autentificare', en: 'Login' },
            businessAccount: { ro: 'Cont Business', en: 'Business Account' },
        },
        footer: {
            description: {
                ro: 'Portal wholesale de iluminat profesional. Prețuri competitive B2B, stoc în timp real și livrare rapidă în toată România.',
                en: 'Professional wholesale lighting portal. Competitive B2B pricing, real-time stock and fast delivery across Romania.',
            },
            categories: { ro: 'Categorii', en: 'Categories' },
            info: { ro: 'Informații', en: 'Information' },
            legal: { ro: 'Legal', en: 'Legal' },
            about: { ro: 'Despre Noi', en: 'About Us' },
            contact: { ro: 'Contact', en: 'Contact' },
            howToOrder: { ro: 'Cum Comanzi', en: 'How to Order' },
            shipping: { ro: 'Livrare & Retur', en: 'Shipping & Returns' },
            partner: { ro: 'Program Partener', en: 'Partner Program' },
            techGuide: { ro: 'Ghid Tehnic LED', en: 'LED Tech Guide' },
            requestQuote: { ro: 'Cerere Ofertă', en: 'Request Quote' },
            privacy: { ro: 'Politica de Confidențialitate', en: 'Privacy Policy' },
            terms: { ro: 'Termeni și Condiții', en: 'Terms & Conditions' },
            cookies: { ro: 'Politica Cookies', en: 'Cookie Policy' },
            copyright: { ro: 'Toate drepturile rezervate.', en: 'All rights reserved.' },
        },
    },

    // ========== Registration Page ==========
    registration: {
        // Success state
        successTitle: { ro: 'Înregistrare Trimisă!', en: 'Registration Submitted!' },
        successMessage: {
            ro: 'Vă mulțumim pentru înregistrare. Cererea dumneavoastră este în curs de verificare. Veți primi un email de confirmare în scurt timp.',
            en: 'Thank you for registering. Your application is under review. You will receive an email confirmation shortly.',
        },
        returnHome: { ro: 'Înapoi la Pagina Principală', en: 'Return to Home' },

        // Page header
        title: { ro: 'Înregistrează-ți Afacerea', en: 'Register Your Business' },
        subtitle: {
            ro: 'Alătură-te rețelei noastre B2B și obține acces la prețuri exclusive și comenzi en-gros.',
            en: 'Join our expert B2B network and get access to exclusive pricing and bulk ordering.',
        },

        // Section headers
        companyDetails: { ro: 'Detalii Companie', en: 'Company Details' },
        businessInfo: { ro: 'Informații Firmă', en: 'Business Information' },
        locations: { ro: 'Adrese', en: 'Locations' },
        contactPerson: { ro: 'Persoană de Contact', en: 'Contact Person' },
        financialInfo: { ro: 'Informații Bancare', en: 'Financial Information' },

        // Form labels
        companyName: { ro: 'Denumire Firmă', en: 'Company Name' },
        companyNamePlaceholder: { ro: 'ex. SC Exemplu SRL', en: 'e.g. Acme Industries Ltd.' },
        cui: { ro: 'CUI (Cod Unic de Înregistrare)', en: 'CUI (Tax ID)' },
        cuiPlaceholder: { ro: 'RO12345678', en: 'RO12345678' },
        regCom: { ro: 'Nr. Registrul Comerțului', en: 'Reg. Com. (Trade Registry)' },
        regComPlaceholder: { ro: 'J40/1234/2023', en: 'J40/1234/2023' },
        billingAddress: { ro: 'Adresa de Facturare', en: 'Billing Address' },
        billingPlaceholder: { ro: 'Strada, Număr, Oraș, Județ', en: 'Street, Number, City, County, Country' },
        shippingAddress: { ro: 'Adresa de Livrare (dacă diferă)', en: 'Shipping Address (if different)' },
        shippingPlaceholder: { ro: 'Lăsați gol dacă e aceeași cu facturarea', en: 'Leave empty if same as billing' },
        contactName: { ro: 'Nume Complet', en: 'Full Name' },
        contactEmail: { ro: 'Adresă Email', en: 'Email Address' },
        contactPhone: { ro: 'Număr Telefon', en: 'Phone Number' },
        bankName: { ro: 'Bancă', en: 'Bank Name' },
        iban: { ro: 'IBAN', en: 'IBAN' },
        notes: { ro: 'Observații', en: 'Additional Notes' },
        notesPlaceholder: { ro: 'Cereri speciale, termeni de plată, etc.', en: 'Special requests, payment terms, etc.' },

        // Actions
        cancel: { ro: 'Anulează', en: 'Cancel' },
        submit: { ro: 'Trimite Cererea', en: 'Submit Application' },
        submitting: { ro: 'Se trimite...', en: 'Submitting...' },

        // Footer
        agreementPrefix: { ro: 'Prin trimiterea acestui formular, sunteți de acord cu', en: 'By submitting this form, you agree to our' },
        termsLink: { ro: 'Termenii și Condițiile', en: 'Terms of Service' },
        and: { ro: 'și', en: 'and' },
        privacyLink: { ro: 'Politica de Confidențialitate', en: 'Privacy Policy' },

        // Errors
        errorGeneric: {
            ro: 'Înregistrarea a eșuat. Vă rugăm verificați datele și încercați din nou.',
            en: 'Registration failed. Please check your details and try again.',
        },
    },
} as const;

export type TranslationKey = keyof typeof translations;

// Helper to get a translated string
export const t = (obj: { ro: string; en: string }, lang: 'ro' | 'en'): string => {
    return obj[lang] || obj.ro;
};
