import React from 'react';
import { useGlobalLanguage } from '../../hooks/useLanguage';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';

export const B2BProfilePage: React.FC = () => {
  const { language } = useGlobalLanguage();
  const isRo = language === 'ro';
  const { customer } = useB2BAuthStore();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {isRo ? 'Profil companie' : 'Company profile'}
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {isRo ? 'Nume companie' : 'Company name'}
          </label>
          <p className="mt-1 text-lg text-gray-900">{customer?.company_name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="mt-1 text-lg text-gray-900">{customer?.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {isRo ? 'Nivel' : 'Tier'}
          </label>
          <p className="mt-1">
            <span className="inline-flex px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-full">
              {customer?.tier}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
