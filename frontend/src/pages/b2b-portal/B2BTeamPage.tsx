import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Users, UserPlus, Shield, Mail, Trash2, 
  CheckCircle2, XCircle, AlertTriangle, Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { b2bApi } from '../../services/b2b-api';

interface SubAccount {
  id: string;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  permissions: {
    can_view_invoices: boolean;
    can_place_orders: boolean;
    order_approval_required: boolean;
  };
  monthly_limit: string;
  current_month_spend: string;
  created_at: string;
}

export const B2BTeamPage: React.FC = () => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    permissions: {
      can_view_invoices: false,
      can_place_orders: true,
      order_approval_required: true
    },
    monthly_limit: 0
  });

  const { data: team, isLoading, refetch } = useQuery<SubAccount[]>({
    queryKey: ['b2b', 'team'],
    queryFn: () => b2bApi.getB2BTeam(),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => b2bApi.inviteTeamMember(data),
    onSuccess: () => {
      toast.success('Membru invitat cu succes!');
      setShowInviteModal(false);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Eroare la invitare');
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => b2bApi.removeTeamMember(id),
    onSuccess: () => {
      toast.success('Membru eliminat.');
      refetch();
    }
  });

  const formatCurrency = (val: string | number) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(Number(val));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Users className="text-blue-600" />
            Echipa Mea
          </h1>
          <p className="text-slate-500 mt-1">Gestionează accesul angajaților și limitele de cheltuieli.</p>
        </div>
        <button 
          onClick={() => setShowInviteModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
        >
          <UserPlus size={18} /> Invită Membru
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-4">Utilizator</th>
              <th className="px-8 py-4">Permisiuni</th>
              <th className="px-8 py-4 text-center">Limită Lunară</th>
              <th className="px-8 py-4 text-center">Consum Luna Aceasta</th>
              <th className="px-8 py-4 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {team?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">
                  Nu ai adăugat încă niciun membru în echipă.
                </td>
              </tr>
            ) : (
              team?.map((member) => {
                const spendPct = Number(member.monthly_limit) > 0 
                  ? (Number(member.current_month_spend) / Number(member.monthly_limit)) * 100 
                  : 0;
                
                return (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black">
                          {member.user.first_name[0]}{member.user.last_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{member.user.first_name} {member.user.last_name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1"><Mail size={10}/> {member.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-1.5">
                        {member.permissions.can_place_orders && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase">Comenzi</span>}
                        {member.permissions.can_view_invoices && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">Facturi</span>}
                        {member.permissions.order_approval_required && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-bold uppercase">Necesită Aprobare</span>}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="font-bold text-slate-700">
                        {Number(member.monthly_limit) > 0 ? formatCurrency(member.monthly_limit) : 'Fără limită'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="max-w-[120px] mx-auto space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className={spendPct > 90 ? 'text-red-600' : 'text-slate-500'}>{formatCurrency(member.current_month_spend)}</span>
                          <span className="text-slate-300">{spendPct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${spendPct > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                            style={{ width: `${Math.min(spendPct, 100)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => { if(confirm('Ești sigur?')) removeMutation.mutate(member.id); }}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl shadow-slate-900/20">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Invită Membru Nou</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email Utilizator</label>
                <input 
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                  placeholder="angajat@companie.ro"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Permisiuni</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={inviteData.permissions.can_place_orders}
                      onChange={(e) => setInviteData({...inviteData, permissions: {...inviteData.permissions, can_place_orders: e.target.checked}})}
                      className="w-5 h-5 rounded-lg border-2 border-slate-200 text-blue-600 focus:ring-0" 
                    />
                    <span className="text-sm font-bold text-slate-700">Poate plasa comenzi</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group ml-8 opacity-75">
                    <input 
                      type="checkbox" 
                      checked={inviteData.permissions.order_approval_required}
                      onChange={(e) => setInviteData({...inviteData, permissions: {...inviteData.permissions, order_approval_required: e.target.checked}})}
                      className="w-4 h-4 rounded border-2 border-slate-200 text-blue-600 focus:ring-0" 
                    />
                    <span className="text-xs font-bold text-slate-600 italic">Necesită aprobare Master</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={inviteData.permissions.can_view_invoices}
                      onChange={(e) => setInviteData({...inviteData, permissions: {...inviteData.permissions, can_view_invoices: e.target.checked}})}
                      className="w-5 h-5 rounded-lg border-2 border-slate-200 text-blue-600 focus:ring-0" 
                    />
                    <span className="text-sm font-bold text-slate-700">Poate vedea facturi și plăți</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Limită Cheltuieli Lunară (RON)</label>
                <input 
                  type="number"
                  value={inviteData.monthly_limit}
                  onChange={(e) => setInviteData({...inviteData, monthly_limit: Number(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                  placeholder="0 = Fără limită"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-4 text-sm font-black text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Anulează
                </button>
                <button 
                  onClick={() => inviteMutation.mutate(inviteData)}
                  disabled={inviteMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {inviteMutation.isPending ? <Loader2 className="animate-spin" size={18}/> : 'Trimite Invitația'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
