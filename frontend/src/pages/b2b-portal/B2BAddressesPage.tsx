import React, { useEffect, useState } from 'react';
import { b2bApi } from '../../services/b2b-api';

interface Address {
  id: string;
  label: string;
  street: string;
  street_number: string;
  city: string;
  county: string;
  postal_code: string;
  country: string;
  phone: string;
  is_default_shipping: boolean;
  is_default_billing: boolean;
  created_at: string;
}

interface AddressFormData {
  label: string;
  street: string;
  street_number: string;
  city: string;
  county: string;
  postal_code: string;
  country: string;
  phone: string;
}

interface FormErrors {
  label?: string;
  street?: string;
  street_number?: string;
  city?: string;
  county?: string;
  postal_code?: string;
  phone?: string;
}

const emptyFormData: AddressFormData = {
  label: '',
  street: '',
  street_number: '',
  city: '',
  county: '',
  postal_code: '',
  country: 'România',
  phone: '',
};

const romanianCounties = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brăila',
  'Brașov', 'București', 'Buzău', 'Călărași', 'Caraș-Severin', 'Cluj', 'Constanța',
  'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara',
  'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt',
  'Prahova', 'Sălaj', 'Satu Mare', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea',
  'Vâlcea', 'Vaslui', 'Vrancea'
];

export const B2BAddressesPage: React.FC = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<AddressFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const data = await b2bApi.getAddresses();
      setAddresses(data.addresses || []);
    } catch (error) {
      console.error('Failed to load addresses:', error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.label.trim()) {
      errors.label = 'Numele adresei este obligatoriu';
    } else if (formData.label.length > 50) {
      errors.label = 'Numele adresei nu poate depăși 50 de caractere';
    }

    if (!formData.street.trim()) {
      errors.street = 'Strada este obligatorie';
    } else if (formData.street.length > 100) {
      errors.street = 'Strada nu poate depăși 100 de caractere';
    }

    if (!formData.street_number.trim()) {
      errors.street_number = 'Numărul este obligatoriu';
    } else if (formData.street_number.length > 20) {
      errors.street_number = 'Numărul nu poate depăși 20 de caractere';
    }

    if (!formData.city.trim()) {
      errors.city = 'Orașul este obligatoriu';
    } else if (formData.city.length > 50) {
      errors.city = 'Orașul nu poate depăși 50 de caractere';
    }

    if (!formData.county.trim()) {
      errors.county = 'Județul este obligatoriu';
    }

    if (!formData.postal_code.trim()) {
      errors.postal_code = 'Codul poștal este obligatoriu';
    } else if (!/^\d{6}$/.test(formData.postal_code.trim())) {
      errors.postal_code = 'Codul poștal trebuie să conțină 6 cifre';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Telefonul este obligatoriu';
    } else if (!/^(\+40|0040|0)[0-9]{9}$/.test(formData.phone.replace(/\s/g, ''))) {
      errors.phone = 'Număr de telefon invalid';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const openAddModal = () => {
    setEditingAddress(null);
    setFormData(emptyFormData);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      street: address.street,
      street_number: address.street_number,
      city: address.city,
      county: address.county,
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingAddress) {
        await b2bApi.updateAddress(editingAddress.id, formData);
      } else {
        await b2bApi.createAddress(formData);
      }
      setShowModal(false);
      await loadAddresses();
    } catch (error) {
      console.error('Failed to save address:', error);
      alert('Nu s-a putut salva adresa. Încercați din nou.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    setDeleting(true);
    try {
      await b2bApi.deleteAddress(addressId);
      setShowDeleteConfirm(null);
      await loadAddresses();
    } catch (error) {
      console.error('Failed to delete address:', error);
      alert('Nu s-a putut șterge adresa. Încercați din nou.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (addressId: string, type: 'shipping' | 'billing') => {
    try {
      await b2bApi.setDefaultAddress(addressId, type);
      await loadAddresses();
    } catch (error) {
      console.error('Failed to set default address:', error);
      alert('Nu s-a putut seta adresa implicită.');
    }
  };

  const renderAddressCard = (address: Address) => (
    <div
      key={address.id}
      className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-gray-900">{address.label}</h3>
          {address.is_default_shipping && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
              Livrare implicită
            </span>
          )}
          {address.is_default_billing && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
              Facturare implicită
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1 text-sm text-gray-600 mb-4">
        <p>{address.street} {address.street_number}</p>
        <p>{address.postal_code} {address.city}, {address.county}</p>
        <p>{address.country}</p>
        <p className="flex items-center gap-1 mt-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          {address.phone}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={() => openEditModal(address)}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editează
        </button>
        {!address.is_default_shipping && (
          <button
            onClick={() => handleSetDefault(address.id, 'shipping')}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Livrare
          </button>
        )}
        {!address.is_default_billing && (
          <button
            onClick={() => handleSetDefault(address.id, 'billing')}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Facturare
          </button>
        )}
        <button
          onClick={() => setShowDeleteConfirm(address.id)}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Șterge
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Adresele mele</h2>
            <p className="text-sm text-gray-500 mt-1">
              Gestionați adresele de livrare și facturare
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adaugă adresă
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-500">Se încarcă...</span>
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="mt-4 text-gray-500">Nu aveți adrese salvate</p>
              <p className="mt-2 text-sm text-gray-400">
                Adăugați o adresă pentru a simplifica procesul de comandă
              </p>
              <button
                onClick={openAddModal}
                className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adaugă prima adresă
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {addresses.map(renderAddressCard)}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              onClick={() => setShowModal(false)}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
              <div className="bg-white px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingAddress ? 'Editează adresa' : 'Adaugă adresă nouă'}
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nume adresă *
                  </label>
                  <input
                    type="text"
                    name="label"
                    value={formData.label}
                    onChange={handleInputChange}
                    placeholder="Ex: Sediu central, Depozit, etc."
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.label ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.label && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.label}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Strada *
                    </label>
                    <input
                      type="text"
                      name="street"
                      value={formData.street}
                      onChange={handleInputChange}
                      placeholder="Ex: Strada Exemplu"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.street ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.street && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.street}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nr. *
                    </label>
                    <input
                      type="text"
                      name="street_number"
                      value={formData.street_number}
                      onChange={handleInputChange}
                      placeholder="Ex: 123"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.street_number ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.street_number && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.street_number}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Oraș *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Ex: București"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.city ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.city && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.city}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Județ *
                    </label>
                    <select
                      name="county"
                      value={formData.county}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.county ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Selectați județul</option>
                      {romanianCounties.map(county => (
                        <option key={county} value={county}>{county}</option>
                      ))}
                    </select>
                    {formErrors.county && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.county}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cod poștal *
                    </label>
                    <input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleInputChange}
                      placeholder="Ex: 010101"
                      maxLength={6}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.postal_code ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.postal_code && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.postal_code}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Țara
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Ex: 0721234567"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Se salvează...
                    </>
                  ) : (
                    editingAddress ? 'Salvează modificările' : 'Adaugă adresă'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 py-4">
                <div className="flex items-center">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-4 text-left">
                    <h3 className="text-lg font-medium text-gray-900">
                      Ștergeți adresa?
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Această acțiune nu poate fi anulată.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Anulează
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deleting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Se șterge...
                    </>
                  ) : (
                    'Șterge adresa'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2BAddressesPage;
