import { useQuery } from '@tanstack/react-query';
import { Briefcase, CheckCircle2, Clock3, Users } from 'lucide-react';
import { apiClient } from '../services/api';

type HealthState = {
  status: string;
};

async function fetchHrHealth(): Promise<HealthState> {
  try {
    return await apiClient.get<HealthState>('/hr/health');
  } catch {
    return await apiClient.post<HealthState>('/hr/health', {});
  }
}

export function HRPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr-health'],
    queryFn: fetchHrHealth,
    retry: 1,
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Human Resources</h1>
          <p className="mt-1 text-text-secondary">
            Employee lifecycle, attendance, leave, payroll, and performance workflows.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
          <Briefcase size={16} />
          HR Workspace
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-600">
            <Users size={16} /> Team Health
          </div>
          <p className="text-2xl font-semibold text-slate-900">Stable</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-600">
            <Clock3 size={16} /> Attendance Ops
          </div>
          <p className="text-2xl font-semibold text-slate-900">Online</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-600">
            <CheckCircle2 size={16} /> Module Health
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {isLoading && 'Checking...'}
            {isError && 'Unavailable'}
            {!isLoading && !isError && (data?.status || 'healthy')}
          </p>
        </div>
      </div>
    </div>
  );
}
