import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  User,
  Mail,
  Phone,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useGlobalLanguage } from '../../hooks/useLanguage';
import { translations, t } from '../../i18n/translations';
import { useEffect } from 'react';
import { XCircle } from 'lucide-react';

export const B2BRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const { language } = useGlobalLanguage();
  const T = translations.registration;

  useEffect(() => {
    checkRegistrationSettings();
  }, []);

  const checkRegistrationSettings = async () => {
    try {
      const response = await fetch('/api/v1/settings', {
        credentials: 'include',
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const settings = payload?.data ?? payload;

      if (settings?.b2b) {
        setAllowRegistration(settings.b2b.allowRegistration !== false);
      }
    } catch (err) {
      console.error('Failed to fetch registration settings:', err);
    } finally {
      setCheckingSettings(false);
    }
  };

  const [formData, setFormData] = useState({
    company_name: '',
    company_registration_number: '',
    reg_com_number: '',
    billing_address: '',
    shipping_address: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    bank_name: '',
    iban: '',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const searchCompanyByCUI = async () => {
    const cui = formData.company_registration_number.trim();
    if (!cui) {
      setError('Vă rugăm să introduceți CUI-ul');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Call our backend proxy endpoint
      const response = await fetch('/api/v1/b2b/verify-cui', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cui }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Eroare la căutarea datelor firmei');
      }

      if (data.success && data.data) {
        const companyData = data.data;

        // Populate form with company data
        setFormData((prev) => ({
          ...prev,
          company_name: companyData.denumire || prev.company_name,
          billing_address: companyData.adresa || prev.billing_address,
          reg_com_number: companyData.nrRegCom || prev.reg_com_number,
          company_registration_number: companyData.scpTVA
            ? `RO${cui.replace(/^RO/i, '').replace(/[^0-9]/g, '')}`
            : cui.replace(/^RO/i, '').replace(/[^0-9]/g, ''),
          contact_phone: companyData.telefon || prev.contact_phone,
        }));

        setError(null);
      } else {
        setError(data.message || 'Nu s-au găsit date pentru acest CUI');
      }
    } catch (err: any) {
      console.error('Error searching company:', err);
      setError(err.message || 'Eroare la căutarea datelor firmei. Vă rugăm să introduceți manual.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const cleanedCui = formData.company_registration_number
        .replace(/^RO/i, '')
        .replace(/[^0-9]/g, '');

      const response = await fetch('/api/v1/b2b/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          company_registration_number: cleanedCui,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      console.log('Form Submitted:', formData);
      setSuccess(true);

      setTimeout(() => {
        navigate('/b2b-store');
      }, 3000);
    } catch (err) {
      setError(t(T.errorGeneric, language));
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSettings) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={40} style={{ color: '#daa520' }} />
          <p className="text-gray-600">Se verifică disponibilitatea înregistrărilor...</p>
        </div>
      </div>
    );
  }

  if (!allowRegistration) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="p-8 text-center shadow-lg">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Înregistrări Temporar Închise
            </h2>
            <p className="text-slate-600 mb-8">
              Ne pare rău, dar înregistrările noi de clienți B2B sunt momentan suspendate. Vă rugăm
              contactați-ne direct pentru informații.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/b2b-store')} className="flex-1">
                Înapoi la Magazin
              </Button>
              <Button onClick={() => navigate('/b2b-store/contact')} className="flex-1">
                Contactează-ne
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="p-8 text-center shadow-lg">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {t(T.successTitle, language)}
            </h2>
            <p className="text-slate-600 mb-8">{t(T.successMessage, language)}</p>
            <Button onClick={() => navigate('/b2b-store')} className="w-full">
              {t(T.returnHome, language)}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            {t(T.title, language)}
          </h1>
          <p className="mt-4 text-lg text-slate-600">{t(T.subtitle, language)}</p>
        </div>

        <Card className="shadow-xl overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Building2 size={20} />
              {t(T.companyDetails, language)}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            {/* Company Info */}
            <div className="space-y-6">
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider border-b pb-2">
                {t(T.businessInfo, language)}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label
                    htmlFor="company_name"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.companyName, language)} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="company_name"
                    name="company_name"
                    required
                    value={formData.company_name}
                    onChange={handleChange}
                    placeholder={t(T.companyNamePlaceholder, language)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="company_registration_number"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.cui, language)} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="company_registration_number"
                      name="company_registration_number"
                      required
                      value={formData.company_registration_number}
                      onChange={handleChange}
                      placeholder={t(T.cuiPlaceholder, language)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={searchCompanyByCUI}
                      disabled={isSearching || !formData.company_registration_number.trim()}
                      className="flex items-center gap-2 whitespace-nowrap"
                      variant="outline"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Caut...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Caută
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Introduceți CUI-ul (cu sau fără RO) și apăsați "Caută" pentru completare
                    automată
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg_com_number"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.regCom, language)} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="reg_com_number"
                    name="reg_com_number"
                    required
                    value={formData.reg_com_number}
                    onChange={handleChange}
                    placeholder={t(T.regComPlaceholder, language)}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-6">
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <MapPin size={16} />
                {t(T.locations, language)}
              </h4>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="billing_address"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.billingAddress, language)} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="billing_address"
                    name="billing_address"
                    required
                    rows={3}
                    className="w-full rounded-md border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3"
                    value={formData.billing_address}
                    onChange={handleChange}
                    placeholder={t(T.billingPlaceholder, language)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="shipping_address"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.shippingAddress, language)}
                  </label>
                  <textarea
                    id="shipping_address"
                    name="shipping_address"
                    rows={3}
                    className="w-full rounded-md border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3"
                    value={formData.shipping_address}
                    onChange={handleChange}
                    placeholder={t(T.shippingPlaceholder, language)}
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <User size={16} />
                {t(T.contactPerson, language)}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label
                    htmlFor="contact_name"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.contactName, language)} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="contact_name"
                    name="contact_name"
                    required
                    value={formData.contact_name}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact_email"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.contactEmail, language)} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <Input
                      id="contact_email"
                      name="contact_email"
                      type="email"
                      required
                      className="pl-10"
                      value={formData.contact_email}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact_phone"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.contactPhone, language)} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <Input
                      id="contact_phone"
                      name="contact_phone"
                      type="tel"
                      required
                      className="pl-10"
                      value={formData.contact_phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Info */}
            <div className="space-y-6">
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <CreditCard size={16} />
                {t(T.financialInfo, language)}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="bank_name"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {t(T.bankName, language)}
                  </label>
                  <Input
                    id="bank_name"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="iban" className="block text-sm font-medium text-slate-700 mb-1">
                    {t(T.iban, language)}
                  </label>
                  <Input id="iban" name="iban" value={formData.iban} onChange={handleChange} />
                </div>

                <div className="col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                    {t(T.notes, language)}
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    className="w-full rounded-md border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder={t(T.notesPlaceholder, language)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-4">
              <Link to="/b2b-store">
                <Button variant="outline" type="button">
                  {t(T.cancel, language)}
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading} className="min-w-[150px]">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t(T.submitting, language)}
                  </>
                ) : (
                  t(T.submit, language)
                )}
              </Button>
            </div>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-500 mt-8">
          {t(T.agreementPrefix, language)}{' '}
          <Link to="#" className="underline">
            {t(T.termsLink, language)}
          </Link>{' '}
          {t(T.and, language)}{' '}
          <Link to="#" className="underline">
            {t(T.privacyLink, language)}
          </Link>
          .
        </p>
      </div>
    </div>
  );
};
