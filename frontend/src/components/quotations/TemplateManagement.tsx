/**
 * Template Management Admin Panel
 * Manage email templates, WhatsApp templates, and A/B tests
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import {
  Mail,
  MessageSquare,
  Smartphone,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  Play,
  Pause,
  BarChart3,
  Save,
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  type: 'quote_sent' | 'quote_reminder' | 'quote_accepted' | 'quote_rejected';
  isActive: boolean;
  lastUsed?: Date;
  usageCount: number;
}

interface ABTest {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  variants: number;
  winner?: string;
  confidenceLevel?: number;
}

export const TemplateManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'sms' | 'ab-tests'>('email');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
    loadABTests();
  }, [activeTab]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const token = apiClient.getToken();
      const response = await fetch(`/api/v1/quotations/templates?type=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadABTests = async () => {
    try {
      const token = apiClient.getToken();
      const response = await fetch('/api/v1/quotations/ab-tests', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setABTests(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load A/B tests:', error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const token = apiClient.getToken();
      const method = selectedTemplate.id ? 'PUT' : 'POST';
      const url = selectedTemplate.id
        ? `/api/v1/quotations/templates/${selectedTemplate.id}`
        : '/api/v1/quotations/templates';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedTemplate),
      });

      if (response.ok) {
        await loadTemplates();
        setIsEditing(false);
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const token = apiClient.getToken();
      const response = await fetch(`/api/v1/quotations/templates/${templateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleDuplicateTemplate = async (template: EmailTemplate) => {
    const newTemplate = {
      ...template,
      id: '',
      name: `${template.name} (Copy)`,
    };
    setSelectedTemplate(newTemplate);
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">Template Management</h2>
        <button
          onClick={() => {
            setSelectedTemplate({
              id: '',
              name: '',
              subject: '',
              htmlContent: '',
              textContent: '',
              type: 'quote_sent',
              isActive: true,
              usageCount: 0,
            });
            setIsEditing(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          New Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {[
          { id: 'email', label: 'Email Templates', icon: Mail },
          { id: 'whatsapp', label: 'WhatsApp Templates', icon: MessageSquare },
          { id: 'sms', label: 'SMS Templates', icon: Smartphone },
          { id: 'ab-tests', label: 'A/B Tests', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'ab-tests' ? (
        <ABTestsList tests={abTests} onRefresh={loadABTests} />
      ) : (
        <TemplatesList
          templates={templates}
          onEdit={(template) => {
            setSelectedTemplate(template);
            setIsEditing(true);
          }}
          onDelete={handleDeleteTemplate}
          onDuplicate={handleDuplicateTemplate}
          loading={loading}
        />
      )}

      {/* Template Editor Modal */}
      {isEditing && selectedTemplate && (
        <TemplateEditor
          template={selectedTemplate}
          onChange={setSelectedTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setIsEditing(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};

// Templates List Component
const TemplatesList: React.FC<{
  templates: EmailTemplate[];
  onEdit: (template: EmailTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (template: EmailTemplate) => void;
  loading: boolean;
}> = ({ templates, onEdit, onDelete, onDuplicate, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Mail size={48} className="mx-auto mb-4 opacity-50" />
        <p>No templates found. Create your first template to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-100">{template.name}</h3>
              <p className="text-sm text-gray-400 mt-1">{template.type.replace('_', ' ')}</p>
            </div>
            <span
              className={`px-2 py-1 rounded text-xs ${
                template.isActive ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {template.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="text-sm text-gray-400 mb-4">
            <div className="truncate">
              <strong>Subject:</strong> {template.subject}
            </div>
            <div className="mt-2">
              <strong>Used:</strong> {template.usageCount} times
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onEdit(template)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            >
              <Edit size={14} />
              Edit
            </button>
            <button
              onClick={() => onDuplicate(template)}
              className="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              title="Duplicate"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => onDelete(template.id)}
              className="px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// A/B Tests List Component
const ABTestsList: React.FC<{
  tests: ABTest[];
  onRefresh: () => void;
}> = ({ tests, onRefresh }) => {
  if (tests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
        <p>No A/B tests found. Create your first test to optimize conversions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tests.map((test) => (
        <div key={test.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-100">{test.name}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {test.variants} variants • {test.status}
              </p>
            </div>
            <div className="flex gap-2">
              {test.status === 'running' && (
                <button className="px-3 py-1 bg-yellow-900/30 text-yellow-400 rounded text-sm">
                  <Pause size={14} className="inline mr-1" />
                  Pause
                </button>
              )}
              {test.status === 'completed' && test.winner && (
                <span className="px-3 py-1 bg-green-900/30 text-green-400 rounded text-sm">
                  Winner: {test.winner}
                </span>
              )}
              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
                View Results
              </button>
            </div>
          </div>

          {test.confidenceLevel && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Confidence Level</span>
                <span className="text-gray-200">{test.confidenceLevel}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${test.confidenceLevel}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Template Editor Component (Modal)
const TemplateEditor: React.FC<{
  template: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ template, onChange, onSave, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-100">
            {template.id ? 'Edit Template' : 'New Template'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-200">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Template Name</label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => onChange({ ...template, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Modern Quote Email"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email Subject</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => onChange({ ...template, subject: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Your Quote #{quoteNumber} - {companyName}"
            />
          </div>

          {/* HTML Content */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">HTML Content</label>
            <textarea
              value={template.htmlContent}
              onChange={(e) => onChange({ ...template, htmlContent: e.target.value })}
              className="w-full h-64 px-4 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
              placeholder="HTML email template..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Available variables: {'{quoteNumber}'}, {'{customerName}'}, {'{totalAmount}'},{' '}
              {'{items}'}, etc.
            </p>
          </div>

          {/* Text Content */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Plain Text Content
            </label>
            <textarea
              value={template.textContent}
              onChange={(e) => onChange({ ...template, textContent: e.target.value })}
              className="w-full h-32 px-4 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
              placeholder="Plain text version..."
            />
          </div>

          {/* Type & Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Template Type</label>
              <select
                value={template.type}
                onChange={(e) => onChange({ ...template, type: e.target.value as any })}
                className="w-full px-4 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="quote_sent">Quote Sent</option>
                <option value="quote_reminder">Quote Reminder</option>
                <option value="quote_accepted">Quote Accepted</option>
                <option value="quote_rejected">Quote Rejected</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={template.isActive}
                  onChange={(e) => onChange({ ...template, isActive: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-300">Active Template</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Save size={18} />
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
};
