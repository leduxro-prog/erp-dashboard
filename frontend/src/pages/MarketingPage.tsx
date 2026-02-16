import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  TrendingUp,
  Target,
  Mail,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Users,
  Edit2,
  Trash2,
  Play,
  Pause,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  Hash,
  Megaphone,
  MessageSquare,
  Smartphone,
  BarChart3,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import {
  marketingService,
  type Campaign,
  type CampaignStep,
  type AudienceSegment,
  type AudiencePreview,
  type ChannelDelivery,
  type DiscountCode,
  type EmailSequence,
} from '@/services/marketing.service';
import { toast } from 'react-hot-toast';

type ViewMode = 'campaigns' | 'campaign-editor' | 'steps-editor' | 'audiences' | 'discounts' | 'sequences' | 'deliveries';

export function MarketingPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('campaigns');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Marketing</h1>
          <p className="text-text-secondary mt-1">Campaigns, audiences, and automation</p>
        </div>
        <button
          onClick={() => {
            setSelectedCampaignId(null);
            setViewMode('campaign-editor');
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          New Campaign
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-tertiary">
        <span className="cursor-pointer hover:text-primary-600" onClick={() => setViewMode('campaigns')}>
          Campaigns
        </span>
        {selectedCampaignId && (
          <>
            <ChevronRight size={16} />
            <span className="text-text-primary font-medium">
              {selectedCampaignId ? 'Edit Campaign' : 'New Campaign'}
            </span>
          </>
        )}
        {viewMode === 'steps-editor' && (
          <>
            <ChevronRight size={16} />
            <span className="text-text-primary font-medium">Steps Editor</span>
          </>
        )}
        {viewMode === 'audiences' && (
          <>
            <ChevronRight size={16} />
            <span className="text-text-primary font-medium">Audiences</span>
          </>
        )}
        {viewMode === 'deliveries' && (
          <>
            <ChevronRight size={16} />
            <span className="text-text-primary font-medium">Schedule & Deliveries</span>
          </>
        )}
      </div>

      {/* View Content */}
      {viewMode === 'campaigns' && (
        <CampaignsView onSelectCampaign={(id) => {
          setSelectedCampaignId(id);
          setViewMode('campaign-editor');
        }} />
      )}

      {viewMode === 'campaign-editor' && (
        <CampaignEditor
          campaignId={selectedCampaignId}
          onSave={() => {
            setViewMode('campaigns');
            setSelectedCampaignId(null);
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
          }}
          onCancel={() => {
            setViewMode('campaigns');
            setSelectedCampaignId(null);
          }}
          onEditSteps={(id) => {
            setSelectedCampaignId(id);
            setViewMode('steps-editor');
          }}
          onManageAudiences={() => setViewMode('audiences')}
          onManageDeliveries={() => setViewMode('deliveries')}
        />
      )}

      {viewMode === 'steps-editor' && selectedCampaignId && (
        <StepsEditor
          campaignId={selectedCampaignId}
          onBack={() => {
            setSelectedCampaignId(selectedCampaignId);
            setViewMode('campaign-editor');
          }}
        />
      )}

      {viewMode === 'audiences' && (
        <AudiencesView
          onBack={() => {
            if (selectedCampaignId) {
              setViewMode('campaign-editor');
            } else {
              setViewMode('campaigns');
            }
          }}
        />
      )}

      {viewMode === 'discounts' && (
        <DiscountsView />
      )}

      {viewMode === 'sequences' && (
        <SequencesView />
      )}

      {viewMode === 'deliveries' && selectedCampaignId && (
        <DeliveriesView
          campaignId={selectedCampaignId}
          onBack={() => {
            setSelectedCampaignId(selectedCampaignId);
            setViewMode('campaign-editor');
          }}
        />
      )}
    </div>
  );
}

// Campaigns List View
function CampaignsView({ onSelectCampaign }: { onSelectCampaign: (id: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Fetch campaigns with react-query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['campaigns', { status: statusFilter, type: typeFilter, search: searchTerm }],
    queryFn: () => marketingService.getCampaigns({
      page: 1,
      pageSize: 50,
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
      search: searchTerm || undefined,
    }),
  });

  const filteredCampaigns = data?.data?.filter((c: Campaign) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const { mutate: activateMutation } = useMutation({
    mutationFn: (id: string) => marketingService.activateCampaign(id),
    onSuccess: () => {
      toast.success('Campaign activated successfully');
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to activate campaign');
    },
  });

  const { mutate: pauseMutation } = useMutation({
    mutationFn: (id: string) => marketingService.pauseCampaign(id),
    onSuccess: () => {
      toast.success('Campaign paused successfully');
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to pause campaign');
    },
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', color: 'gray' };
      case 'scheduled':
        return { label: 'Scheduled', color: 'blue' };
      case 'active':
        return { label: 'Active', color: 'green' };
      case 'paused':
        return { label: 'Paused', color: 'yellow' };
      case 'completed':
        return { label: 'Completed', color: 'purple' };
      default:
        return { label: status, color: 'gray' };
    }
  };

  const columns: Column<Campaign>[] = [
    {
      key: 'name',
      label: 'Campaign',
      render: (value, row) => (
        <div>
          <p className="font-medium text-text-primary">{value}</p>
          {row.description && (
            <p className="text-xs text-text-tertiary">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (value) => (
        <div className="flex items-center gap-2">
          {value === 'email' && <Mail size={16} className="text-blue-500" />}
          {value === 'sms' && <Smartphone size={16} className="text-green-500" />}
          {value === 'push' && <Megaphone size={16} className="text-purple-500" />}
          {value === 'social' && <BarChart3 size={16} className="text-orange-500" />}
          {value === 'display' && <BarChart3 size={16} className="text-pink-500" />}
          {value === 'whatsapp' && <MessageSquare size={16} className="text-emerald-500" />}
          <span className="capitalize text-sm">{value}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const config = getStatusConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (value) => new Date(value).toLocaleDateString('ro-RO'),
    },
    {
      key: 'targetSegments',
      label: 'Audience',
      render: (value) => (
        <div className="flex items-center gap-1">
          <Users size={16} className="text-text-tertiary" />
          <span className="text-sm">{value?.length || 0} segments</span>
        </div>
      ),
    },
    {
      key: 'metrics',
      label: 'Performance',
      render: (value) => (
        <div className="flex gap-2 text-xs">
          <span className="bg-surface-secondary px-2 py-1 rounded">
            {value.sent} sent
          </span>
          <span className="bg-green-500/10 text-green-700 px-2 py-1 rounded">
            {value.conversions} conv
          </span>
        </div>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-1">
          <button
            onClick={() => onSelectCampaign(row.id)}
            className="p-2 hover:bg-surface-secondary rounded-lg text-primary-600"
            title="Edit Campaign"
          >
            <Edit2 size={16} />
          </button>
          {row.status === 'active' ? (
            <button
              onClick={() => pauseMutation(row.id)}
              className="p-2 hover:bg-yellow-500/10 text-yellow-600 rounded-lg"
              title="Pause Campaign"
            >
              <Pause size={16} />
            </button>
          ) : (
            <button
              onClick={() => activateMutation(row.id)}
              className="p-2 hover:bg-green-500/10 text-green-600 rounded-lg"
              title="Activate Campaign"
            >
              <Play size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">All Types</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="social">Social</option>
            <option value="display">Display</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredCampaigns?.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={48} className="text-text-tertiary" />}
          title="No Campaigns Found"
          description={searchTerm ? 'Try adjusting your search.' : 'Create your first marketing campaign.'}
          actionLabel="Create Campaign"
          onAction={() => onSelectCampaign('new')}
        />
      ) : (
        <DataTable columns={columns} data={filteredCampaigns || []} />
      )}
    </div>
  );
}

// Campaign Editor Component
function CampaignEditor({
  campaignId,
  onSave,
  onCancel,
  onEditSteps,
  onManageAudiences,
  onManageDeliveries,
}: {
  campaignId: string | null;
  onSave: () => void;
  onCancel: () => void;
  onEditSteps: (id: string) => void;
  onManageAudiences: () => void;
  onManageDeliveries: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'email' as Campaign['type'],
    startDate: '',
    endDate: '',
    targetSegments: [] as string[],
  });

  // Fetch campaign details if editing
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignId && campaignId !== 'new' ? marketingService.getCampaign(campaignId) : Promise.resolve(null),
    enabled: !!campaignId,
  });

  // Populate form when campaign data loads
  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        type: campaign.type || 'email',
        startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
        endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
        targetSegments: campaign.targetSegments || [],
      });
    }
  }, [campaign]);

  const { mutate: saveMutation, isPending } = useMutation({
    mutationFn: (data: Partial<Campaign>) =>
      campaignId && campaignId !== 'new'
        ? marketingService.updateCampaign(campaignId, data)
        : marketingService.createCampaign(data),
    onSuccess: () => {
      toast.success(`Campaign ${campaignId && campaignId !== 'new' ? 'updated' : 'created'} successfully`);
      onSave();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save campaign');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation with guardrails
    if (!formData.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }

    if (!formData.startDate) {
      toast.error('Start date is required');
      return;
    }

    // UTM naming suggestion
    const utmName = formData.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 20);

    saveMutation({
      ...formData,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          {campaignId && campaignId !== 'new' ? 'Edit Campaign' : 'New Campaign'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                placeholder="e.g., Summer Sale 2024"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Campaign Type *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Campaign['type'] })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push Notification</option>
                <option value="social">Social Media</option>
                <option value="display">Display Ads</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              rows={3}
              placeholder="Brief description of the campaign..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              />
            </div>
          </div>

          {/* Guardrails: Frequency cap hint */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-blue-600 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-400">
                <p className="font-medium mb-1">Frequency Guidelines</p>
                <p>Ensure sufficient time between communications to the same audience. Recommended minimum: 7 days for email campaigns.</p>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Campaign Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Target Audience */}
        <button
          onClick={onManageAudiences}
          className="bg-surface-primary border border-border-primary rounded-xl p-4 text-left hover:border-primary-500 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center">
              <Users size={20} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-text-primary">Target Audience</h3>
          </div>
          <p className="text-sm text-text-secondary">
            {formData.targetSegments?.length || 0} segment(s) selected
          </p>
        </button>

        {/* Campaign Steps */}
        {campaignId && campaignId !== 'new' && (
          <button
            onClick={() => onEditSteps(campaignId)}
            className="bg-surface-primary border border-border-primary rounded-xl p-4 text-left hover:border-primary-500 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-text-primary">Campaign Steps</h3>
            </div>
            <p className="text-sm text-text-secondary">
              Configure sequence and timing
            </p>
          </button>
        )}

        {/* Schedule & Deliveries */}
        {campaignId && campaignId !== 'new' && (
          <button
            onClick={onManageDeliveries}
            className="bg-surface-primary border border-border-primary rounded-xl p-4 text-left hover:border-primary-500 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 flex items-center justify-center">
                <Calendar size={20} className="text-green-600" />
              </div>
              <h3 className="font-semibold text-text-primary">Schedule & Send</h3>
            </div>
            <p className="text-sm text-text-secondary">
              Set delivery channels and schedule
            </p>
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? 'Saving...' : 'Save Campaign'}
        </button>
      </div>
    </div>
  );
}

// Steps Editor Component
function StepsEditor({ campaignId, onBack }: { campaignId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [showAddStepModal, setShowAddStepModal] = useState(false);

  const { data: steps, isLoading, refetch } = useQuery({
    queryKey: ['campaign-steps', campaignId],
    queryFn: () => marketingService.getCampaignSteps(campaignId),
  });

  const { mutate: deleteStep } = useMutation({
    mutationFn: (stepId: string) => marketingService.deleteCampaignStep(campaignId, stepId),
    onSuccess: () => {
      toast.success('Step deleted successfully');
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete step');
    },
  });

  const getStepIcon = (type: CampaignStep['type']) => {
    switch (type) {
      case 'email':
        return <Mail size={16} className="text-blue-500" />;
      case 'sms':
        return <Smartphone size={16} className="text-green-500" />;
      case 'push':
        return <Megaphone size={16} className="text-purple-500" />;
      case 'whatsapp':
        return <MessageSquare size={16} className="text-emerald-500" />;
      default:
        return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: 'gray' };
      case 'sent':
        return { label: 'Sent', color: 'blue' };
      case 'delivered':
        return { label: 'Delivered', color: 'green' };
      case 'failed':
        return { label: 'Failed', color: 'red' };
      default:
        return { label: status, color: 'gray' };
    }
  };

  const columns: Column<CampaignStep>[] = [
    {
      key: 'order',
      label: '#',
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (value) => getStepIcon(value),
    },
    {
      key: 'content',
      label: 'Content',
      render: (value) => (
        <div>
          <p className="font-medium text-text-primary text-sm">{value.subject || value.body.substring(0, 50)}</p>
          {value.delayMinutes && (
            <p className="text-xs text-text-tertiary">Delay: {value.delayMinutes}min</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const config = getStatusConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'metrics',
      label: 'Metrics',
      render: (value) => value ? (
        <div className="flex gap-2 text-xs">
          <span className="bg-blue-500/10 text-blue-700 px-2 py-1 rounded">
            {value.sent} sent
          </span>
          <span className="bg-green-500/10 text-green-700 px-2 py-1 rounded">
            {value.opened} opened
          </span>
        </div>
      ) : '-',
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-1">
          <button
            onClick={() => {/* TODO: edit step */}}
            className="p-2 hover:bg-surface-secondary rounded-lg text-primary-600"
            title="Edit Step"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => deleteStep(row.id)}
            className="p-2 hover:bg-red-500/10 text-red-600 rounded-lg"
            title="Delete Step"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-sm text-primary-600 hover:text-primary-700 mb-2">
            ← Back to Campaign
          </button>
          <h2 className="text-xl font-semibold text-text-primary">Campaign Steps</h2>
          <p className="text-text-secondary">Configure the sequence and timing of campaign communications</p>
        </div>
        <button
          onClick={() => setShowAddStepModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Step
        </button>
      </div>

      {/* Steps Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : !steps || steps.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={48} className="text-text-tertiary" />}
          title="No Steps Yet"
          description="Add your first campaign step to define the communication sequence."
        />
      ) : (
        <DataTable columns={columns} data={steps} />
      )}

      {/* Add Step Modal */}
      {showAddStepModal && (
        <AddStepModal
          campaignId={campaignId}
          onClose={() => setShowAddStepModal(false)}
          onSave={() => {
            setShowAddStepModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// Add Step Modal Component
function AddStepModal({
  campaignId,
  onClose,
  onSave,
}: {
  campaignId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    order: 1,
    type: 'email' as CampaignStep['type'],
    delayMinutes: 0,
    scheduledAt: '',
    content: {
      subject: '',
      body: '',
    },
  });

  const { mutate: saveStep, isPending } = useMutation({
    mutationFn: (step: Partial<CampaignStep>) => marketingService.saveCampaignStep(campaignId, step),
    onSuccess: () => {
      toast.success('Step added successfully');
      onSave();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add step');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStep(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-primary rounded-xl max-w-lg w-full">
        <div className="p-6 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Add Campaign Step</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-secondary rounded-lg">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Order</label>
              <input
                type="number"
                min="1"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as CampaignStep['type'] })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Delay (minutes)</label>
              <input
                type="number"
                min="0"
                value={formData.delayMinutes}
                onChange={(e) => setFormData({ ...formData, delayMinutes: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Scheduled At</label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              />
            </div>
          </div>
          {formData.type === 'email' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Subject</label>
              <input
                type="text"
                value={formData.content.subject}
                onChange={(e) => setFormData({ ...formData, content: { ...formData.content, subject: e.target.value } })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                placeholder="Email subject line..."
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Content</label>
            <textarea
              value={formData.content.body}
              onChange={(e) => setFormData({ ...formData, content: { ...formData.content, body: e.target.value } })}
              className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              rows={4}
              placeholder="Message content..."
              required
            />
          </div>
        </form>
        <div className="p-6 border-t border-border-primary flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" onClick={handleSubmit} disabled={isPending} className="btn-primary flex-1">
            {isPending ? 'Adding...' : 'Add Step'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Audiences View Component
function AudiencesView({ onBack }: { onBack: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewData, setPreviewData] = useState<AudiencePreview | null>(null);

  const { data: segments, isLoading, refetch } = useQuery({
    queryKey: ['audience-segments'],
    queryFn: () => marketingService.getAudienceSegments(),
  });

  const { mutate: createSegment } = useMutation({
    mutationFn: (data: Partial<AudienceSegment>) => marketingService.createAudienceSegment(data),
    onSuccess: () => {
      toast.success('Audience segment created successfully');
      setShowCreateModal(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create audience segment');
    },
  });

  const { mutate: previewAudience, isPending: isPreviewing } = useMutation({
    mutationFn: (data: any) => marketingService.getAudiencePreview(data),
    onSuccess: (result: AudiencePreview) => {
      setPreviewData(result);
    },
  });

  const filteredSegments = segments?.data?.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const columns: Column<AudienceSegment>[] = [
    {
      key: 'name',
      label: 'Segment Name',
      render: (value, row) => (
        <div>
          <p className="font-medium text-text-primary">{value}</p>
          {row.type && (
            <StatusBadge status={row.type === 'dynamic' ? 'blue' : 'gray'} label={row.type} />
          )}
        </div>
      ),
    },
    {
      key: 'customerCount',
      label: 'Customers',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Users size={16} className="text-text-tertiary" />
          <span className="font-medium">{value?.toLocaleString('ro-RO')}</span>
        </div>
      ),
    },
    {
      key: 'criteria',
      label: 'Criteria',
      render: (value) => {
        const criteria = value as AudienceSegment['criteria'];
        const criteriaList = [];
        if (criteria.ageRange) criteriaList.push(`Age: ${criteria.ageRange[0]}-${criteria.ageRange[1]}`);
        if (criteria.loyaltyTier?.length) criteriaList.push(`Tier: ${criteria.loyaltyTier.join(', ')}`);
        if (criteria.tags?.length) criteriaList.push(`Tags: ${criteria.tags.join(', ')}`);
        return <p className="text-sm text-text-secondary">{criteriaList.join(' • ') || '-'}</p>;
      },
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => (
        <StatusBadge status={value ? 'green' : 'gray'} label={value ? 'Active' : 'Inactive'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-sm text-primary-600 hover:text-primary-700 mb-2">
            ← Back to Campaigns
          </button>
          <h2 className="text-xl font-semibold text-text-primary">Audience Segments</h2>
          <p className="text-text-secondary">Define target audiences for your campaigns</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Create Segment
          </button>
        </div>
      </div>

      {/* Preview Banner */}
      {previewData && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-blue-600" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-400">Audience Preview</p>
                <p className="text-sm text-blue-700 dark:text-blue-500">
                  Total: {previewData.totalCount?.toLocaleString('ro-RO')} customers
                </p>
              </div>
            </div>
            <button onClick={() => setPreviewData(null)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg">
              <X size={16} className="text-blue-600" />
            </button>
          </div>
          {previewData.segments.map((seg) => (
            <div key={seg.segmentId} className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-500">
              <span>{seg.segmentName}: </span>
              <span className="font-medium">{seg.count?.toLocaleString('ro-RO')}</span>
            </div>
          ))}
          {previewData.excludedReasons && previewData.excludedReasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Exclusions:</p>
              {previewData.excludedReasons.map((reason, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={12} />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search audience segments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          />
        </div>
      </div>

      {/* Segments Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredSegments?.length === 0 ? (
        <EmptyState
          icon={<Users size={48} className="text-text-tertiary" />}
          title="No Audience Segments"
          description="Create audience segments to target specific customer groups."
          actionLabel="Create Segment"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <DataTable columns={columns} data={filteredSegments || []} />
      )}

      {/* Create Segment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Create Audience Segment</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-surface-secondary rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createSegment({ name: 'New Segment', type: 'static', isActive: true }); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Segment Name *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  placeholder="e.g., VIP Customers"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Segment Type</label>
                <select className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg">
                  <option value="static">Static - Manual Criteria</option>
                  <option value="dynamic">Dynamic - Auto-updating</option>
                </select>
              </div>
              <div className="p-4 bg-surface-secondary rounded-lg">
                <p className="text-sm text-text-tertiary mb-2">Criteria Builder</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="age" className="rounded" />
                    <label htmlFor="age" className="text-sm text-text-primary">Age Range</label>
                    <input type="number" placeholder="From" className="w-20 px-2 py-1 bg-surface-primary border border-border-primary rounded" />
                    <span className="text-text-tertiary">-</span>
                    <input type="number" placeholder="To" className="w-20 px-2 py-1 bg-surface-primary border border-border-primary rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="loyalty" className="rounded" />
                    <label htmlFor="loyalty" className="text-sm text-text-primary">Loyalty Tier</label>
                    <select className="w-40 px-2 py-1 bg-surface-primary border border-border-primary rounded">
                      <option value="">Select tier...</option>
                      <option value="silver">Silver</option>
                      <option value="gold">Gold</option>
                      <option value="platinum">Platinum</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="tags" className="rounded" />
                    <label htmlFor="tags" className="text-sm text-text-primary">Tags</label>
                    <select className="w-40 px-2 py-1 bg-surface-primary border border-border-primary rounded">
                      <option value="">Select tag...</option>
                      <option value="new_customer">New Customer</option>
                      <option value="active">Active Buyer</option>
                      <option value="churned">Churned</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create & Preview
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Deliveries View Component
function DeliveriesView({ campaignId, onBack }: { campaignId: string; onBack: () => void }) {
  const { data: deliveries, isLoading, refetch } = useQuery({
    queryKey: ['campaign-deliveries', campaignId],
    queryFn: () => marketingService.getCampaignDeliveries(campaignId),
  });

  const { mutate: scheduleCampaign } = useMutation({
    mutationFn: (data: any) => marketingService.scheduleCampaign(campaignId, data),
    onSuccess: (result) => {
      toast.success(`Campaign scheduled. Job ID: ${result.jobId}`);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to schedule campaign');
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail size={20} className="text-blue-500" />;
      case 'sms':
        return <Smartphone size={20} className="text-green-500" />;
      case 'push':
        return <Megaphone size={20} className="text-purple-500" />;
      case 'whatsapp':
        return <MessageSquare size={20} className="text-emerald-500" />;
      default:
        return <Target size={20} className="text-gray-500" />;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: 'gray' };
      case 'sending':
        return { label: 'Sending', color: 'blue' };
      case 'sent':
        return { label: 'Sent', color: 'green' };
      case 'failed':
        return { label: 'Failed', color: 'red' };
      default:
        return { label: status, color: 'gray' };
    }
  };

  const columns: Column<ChannelDelivery>[] = [
    {
      key: 'channel',
      label: 'Channel',
      render: (value) => (
        <div className="flex items-center gap-2">
          {getChannelIcon(value)}
          <span className="capitalize">{value}</span>
        </div>
      ),
    },
    {
      key: 'scheduledFor',
      label: 'Scheduled For',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-text-tertiary" />
          <span>{new Date(value).toLocaleString('ro-RO')}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const config = getStatusConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'totalCount',
      label: 'Recipients',
      render: (value) => value?.toLocaleString('ro-RO') || '-',
    },
    {
      key: 'successCount',
      label: 'Delivered',
      render: (value, row) => (
        <span className={row.failureCount > 0 ? 'text-orange-600' : 'text-green-600'}>
          {value?.toLocaleString('ro-RO') || '0'}
        </span>
      ),
    },
    {
      key: 'failureCount',
      label: 'Failed',
      render: (value) => (
        <span className={value > 0 ? 'text-red-600' : 'text-text-tertiary'}>
          {value?.toLocaleString('ro-RO') || '0'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-sm text-primary-600 hover:text-primary-700 mb-2">
            ← Back to Campaign
          </button>
          <h2 className="text-xl font-semibold text-text-primary">Schedule & Deliveries</h2>
          <p className="text-text-secondary">Configure delivery channels and schedule</p>
        </div>
        <button
          onClick={() => scheduleCampaign({
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            channels: ['email', 'sms', 'push', 'whatsapp'],
          })}
          className="btn-primary flex items-center gap-2"
        >
          <Calendar size={18} />
          Schedule Now
        </button>
      </div>

      {/* Deliveries Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : !deliveries || deliveries.length === 0 ? (
        <EmptyState
          icon={<Calendar size={48} className="text-text-tertiary" />}
          title="No Deliveries Yet"
          description="Schedule this campaign to set up deliveries across channels."
          actionLabel="Schedule Campaign"
          onAction={() => scheduleCampaign({
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            channels: ['email', 'sms', 'push', 'whatsapp'],
          })}
        />
      ) : (
        <DataTable columns={columns} data={deliveries} />
      )}
    </div>
  );
}

// Discount Codes View Component
function DiscountsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: codes, isLoading, refetch } = useQuery({
    queryKey: ['discount-codes', { status: statusFilter, search: searchTerm }],
    queryFn: () => marketingService.getDiscountCodes({
      page: 1,
      pageSize: 50,
      active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      search: searchTerm || undefined,
    }),
  });

  const { mutate: deactivateCode } = useMutation({
    mutationFn: (id: string) => marketingService.deactivateDiscountCode(id),
    onSuccess: () => {
      toast.success('Discount code deactivated successfully');
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to deactivate code');
    },
  });

  const filteredCodes = codes?.data?.filter((c: DiscountCode) =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'percentage':
        return { label: '%', color: 'blue' };
      case 'fixed_amount':
        return { label: 'RON', color: 'green' };
      case 'bogo':
        return { label: 'BOGO', color: 'purple' };
      case 'free_shipping':
        return { label: 'Free Ship', color: 'orange' };
      default:
        return { label: type, color: 'gray' };
    }
  };

  const columns: Column<DiscountCode>[] = [
    {
      key: 'code',
      label: 'Code',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-primary-600" />
          <span className="font-mono font-semibold">{value}</span>
          <StatusBadge status={getTypeConfig(row.type).color} label={getTypeConfig(row.type).label} />
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (value, row) => {
        if (row.type === 'percentage') return `${value}%`;
        if (row.type === 'fixed_amount') return `${value} RON`;
        return '-';
      },
    },
    {
      key: 'validFrom',
      label: 'Validity',
      render: (_, row) => (
        <span className="text-sm">
          {new Date(row.validFrom).toLocaleDateString('ro-RO')} - {new Date(row.validUntil).toLocaleDateString('ro-RO')}
        </span>
      ),
    },
    {
      key: 'currentUses',
      label: 'Usage',
      render: (value, row) => (
        <span className={value >= (row.maxUses || 999) ? 'text-red-600' : 'text-green-600'}>
          {value?.toLocaleString('ro-RO')} / {row.maxUses?.toLocaleString('ro-RO') || 'Unlimited'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => (
        <StatusBadge status={value ? 'green' : 'gray'} label={value ? 'Active' : 'Inactive'} />
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => row.isActive && (
        <button
          onClick={() => deactivateCode(row.id)}
          className="p-2 hover:bg-red-500/10 text-red-600 rounded-lg"
          title="Deactivate"
        >
          <X size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Discount Codes</h2>
          <p className="text-text-secondary">Manage promotional codes and offers</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Create Code
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Discount Codes Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredCodes?.length === 0 ? (
        <EmptyState
          icon={<Hash size={48} className="text-text-tertiary" />}
          title="No Discount Codes"
          description="Create discount codes to drive sales and promotions."
          actionLabel="Create Code"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <DataTable columns={columns} data={filteredCodes || []} />
      )}

      {/* Create Code Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Create Discount Code</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-surface-secondary rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              toast.success('Discount code created (mock)');
              setShowCreateModal(false);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Code *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg font-mono uppercase"
                  placeholder="e.g., SUMMER2024"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Type *</label>
                  <select className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg">
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                    <option value="bogo">Buy One Get One</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Value *</label>
                  <input
                    type="number"
                    required
                    className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Max Uses</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Valid Until</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Email Sequences View Component
function SequencesView() {
  const { data: sequences, isLoading } = useQuery({
    queryKey: ['email-sequences'],
    queryFn: () => marketingService.getEmailSequences(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Email Sequences</h2>
          <p className="text-text-secondary">Automated email flows for customer journeys</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          New Sequence
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : !sequences || sequences.data?.length === 0 ? (
        <EmptyState
          icon={<Mail size={48} className="text-text-tertiary" />}
          title="No Email Sequences"
          description="Create automated sequences for welcome emails, cart abandonment, and more."
          actionLabel="Create Sequence"
          onAction={() => toast.info('Create sequence feature coming soon')}
        />
      ) : (
        <div className="space-y-4">
          {sequences.data.map((seq) => (
            <div key={seq.id} className="bg-surface-primary border border-border-primary rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{seq.name}</h3>
                  {seq.description && (
                    <p className="text-sm text-text-tertiary">{seq.description}</p>
                  )}
                </div>
                <StatusBadge status={seq.status === 'active' ? 'green' : 'gray'} label={seq.status === 'active' ? 'Active' : 'Inactive'} />
              </div>
              <div className="flex items-center gap-6 text-sm text-text-secondary">
                <span>{seq.emails.length} emails</span>
                <span>•</span>
                <span>{seq.totalSent.toLocaleString('ro-RO')} sent</span>
                <span>•</span>
                <span>{seq.avgOpenRate.toFixed(1)}% open rate</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>Trigger: </span>
                <span className="font-medium text-text-primary capitalize">{seq.trigger.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
