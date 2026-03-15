import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  FolderPlus, Folder, FileText, ChevronRight, 
  Trash2, Share2, ShoppingCart, Loader2, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { b2bApi } from '../../services/b2b-api';

export const B2BProjectsPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const { data: projects, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['b2b', 'projects'],
    queryFn: () => b2bApi.getB2BProjects(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => b2bApi.createB2BProject({ name }),
    onSuccess: () => {
      toast.success('Proiect creat!');
      setShowCreateModal(false);
      setNewProjectName('');
      refetch();
    }
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => b2bApi.convertProjectToCart(id),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Produse adăugate în coș!');
    }
  });

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
            <Folder className="text-blue-600" />
            Proiectele Mele
          </h1>
          <p className="text-slate-500 mt-1">Organizează produsele pe proiecte și colaborează cu echipa.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
        >
          <FolderPlus size={18} /> Proiect Nou
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200 text-slate-400">
            <Folder size={48} className="mx-auto mb-4 opacity-20" />
            <p className="italic text-lg">Nu ai creat încă niciun proiect.</p>
            <button onClick={() => setShowCreateModal(true)} className="text-blue-600 font-bold mt-2 hover:underline">Creează primul proiect</button>
          </div>
        ) : (
          projects?.map((project) => (
            <div key={project.id} className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 hover:border-blue-500/30 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText size={24} />
                </div>
                <div className="flex gap-2">
                  {project.is_shared && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Shared</span>}
                  <button className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-800 mb-2">{project.name}</h3>
              <p className="text-sm text-slate-400 mb-8 flex items-center gap-1.5">
                Creat de {project.creator?.first_name || 'Administrator'} • {new Date(project.created_at).toLocaleDateString()}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <button 
                  onClick={() => convertMutation.mutate(project.id)}
                  disabled={convertMutation.isPending}
                  className="flex items-center gap-2 text-blue-600 font-black text-sm hover:translate-x-1 transition-transform"
                >
                  <ShoppingCart size={16} /> Comandă Tot
                </button>
                <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all">
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Proiect Nou</h2>
            <p className="text-slate-400 text-sm mb-8">Numește proiectul pentru a identifica ușor produsele mai târziu.</p>
            
            <input 
              autoFocus
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all font-bold text-lg mb-8"
              placeholder="Ex: Hotel Astoria - Etaj 1"
            />

            <div className="flex gap-4">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-4 font-bold text-slate-400">Anulează</button>
              <button 
                onClick={() => createMutation.mutate(newProjectName)}
                disabled={!newProjectName || createMutation.isPending}
                className="flex-1 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 flex items-center justify-center"
              >
                {createMutation.isPending ? <Loader2 className="animate-spin" size={20}/> : 'Creează'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
