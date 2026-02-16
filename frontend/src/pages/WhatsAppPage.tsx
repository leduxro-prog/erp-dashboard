import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Plus, Search, Send, Paperclip, MoreVertical,
  Clock, Check, CheckCheck,
  User, Users, RefreshCw, X,
  MessageSquare, File,
  Video, XCircle, Zap, Wifi, CheckCircle
} from 'lucide-react';

import { whatsappService } from '../services/whatsapp.service';
import {
  WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate
} from '../services/whatsapp.service';

import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

// ============================================================
// SUB-COMPONENTS
// ============================================================

const MessageBubble: React.FC<{
  message: WhatsAppMessage;
  isOwn: boolean;
  onRetry?: () => void;
}> = ({ message, isOwn, onRetry }) => {
  const [showError, setShowError] = useState(false);

  const getStatusIcon = () => {
    if (message.status === 'read') return <CheckCheck size={14} className="text-blue-500" />;
    if (message.status === 'delivered') return <Check size={14} className="text-gray-400" />;
    if (message.status === 'sent') return <Check size={14} className="text-gray-400" />;
    if (message.status === 'failed') return <XCircle size={14} className="text-red-500" />;
    return <Clock size={14} className="text-gray-400" />;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return formatTime(dateString);
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) + ' ' + formatTime(dateString);
  };

  return (
    <div className={`flex w-full mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isOwn
            ? 'bg-green-500 text-white rounded-br-sm'
            : 'bg-gray-200 text-gray-900 rounded-bl-sm'
        }`}
      >
        {/* Media */}
        {message.mediaUrl && (
          <div className="mb-2">
            {message.mediaType === 'image' && (
              <img
                src={message.mediaUrl}
                alt="Attachment"
                className="rounded-lg max-w-full"
              />
            )}
            {message.mediaType === 'video' && (
              <div className="relative">
                <video src={message.mediaUrl} className="rounded-lg max-w-full" />
                <Video size={24} className="absolute inset-0 m-auto text-white" />
              </div>
            )}
            {message.mediaType === 'document' && (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-white/10 rounded-lg"
              >
                <File size={24} />
                <span className="text-sm truncate max-w-[200px]">
                  {message.mediaUrl?.split('/').pop() || 'Document'}
                </span>
              </a>
            )}
          </div>
        )}

        {/* Text */}
        {message.message && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
        )}

        {/* Footer */}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-green-100' : 'text-gray-500'}`}>
          <span className="text-xs">{formatDate(message.createdAt)}</span>
          {isOwn && getStatusIcon()}
        </div>

        {/* Error Message */}
        {message.status === 'failed' && (message.error || showError) && (
          <div className="mt-2 p-2 bg-red-500/20 rounded-lg">
            <p className="text-xs">{message.error || 'Failed to send message'}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-1 text-xs flex items-center gap-1 hover:underline"
              >
                <RefreshCw size={12} /> Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ConversationItem: React.FC<{
  conversation: WhatsAppConversation;
  isSelected: boolean;
  onClick: () => void;
}> = ({ conversation, isSelected, onClick }) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'closed': return 'bg-gray-400';
      case 'archived': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 border-b cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {conversation.customerName || conversation.phoneNumber}
            </span>
            <div className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status)}`} />
          </div>
        </div>
        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
          {formatTime(conversation.lastMessageAt)}
        </span>
      </div>
      <p className="text-sm text-gray-600 truncate">
        {conversation.lastMessage}
      </p>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          {conversation.assignedToName && (
            <span className="text-xs text-gray-500">
              <User size={12} className="inline mr-1" />
              {conversation.assignedToName}
            </span>
          )}
          {conversation.tags && conversation.tags.length > 0 && (
            <div className="flex gap-1">
              {conversation.tags.slice(0, 2).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full"
                >
                  {tag}
                </span>
              ))}
              {conversation.tags.length > 2 && (
                <span className="text-xs text-gray-500">+{conversation.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
        {conversation.unreadCount > 0 && (
          <Badge status="error" className="text-xs px-2 py-0.5">
            {conversation.unreadCount}
          </Badge>
        )}
      </div>
    </div>
  );
};

// ============================================================
// VIEWS
// ============================================================

const ConversationsView: React.FC<{
  selectedId: string | null;
  onSelect: (id: string) => void;
}> = ({ selectedId, onSelect }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['whatsapp', 'conversations', page, search, status],
    queryFn: () => whatsappService.getConversations({ page, pageSize: 20, search, status: status as any }),
    select: (res) => ({
      items: res.data,
      totalPages: res.pagination.totalPages,
    }),
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (conversationId: string) => whatsappService.markConversationAsRead(conversationId),
  });

  const handleSelectConversation = (id: string) => {
    onSelect(id);
    const conv = conversations?.items.find(c => c.id === id);
    if (conv && conv.unreadCount > 0) {
      markAsReadMutation.mutate(id);
    }
  };

  const columns = [
    {
      key: 'customerName',
      label: 'Customer',
      render: (value: any, row: WhatsAppConversation) => (
        <div>
          <div className="font-medium">{row.customerName || row.phoneNumber}</div>
          <div className="text-xs text-gray-500">{row.phoneNumber}</div>
        </div>
      ),
    },
    {
      key: 'lastMessage',
      label: 'Last Message',
      render: (value: string) => (
        <div className="text-sm text-gray-600 truncate max-w-[200px]">{value}</div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const statusMap: Record<string, { status: 'success' | 'warning' | 'error' | 'info' | 'neutral'; label: string }> = {
          active: { status: 'success', label: 'Active' },
          closed: { status: 'neutral', label: 'Closed' },
          archived: { status: 'info', label: 'Archived' },
        };
        const config = statusMap[value] || statusMap.closed;
        return <Badge status={config.status}>{config.label}</Badge>;
      },
    },
    {
      key: 'unreadCount',
      label: 'Unread',
      render: (value: number) => value > 0 ? <Badge status="error">{value}</Badge> : <Badge status="success">0</Badge>,
    },
    {
      key: 'assignedToName',
      label: 'Assigned To',
      render: (value: string) => value || <span className="text-gray-400 text-sm">Unassigned</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Conversations List */}
      <DataTable
        columns={columns}
        data={conversations?.items || []}
        isLoading={isLoading}
        onRowClick={(row) => handleSelectConversation(row.id)}
      />

      {/* Pagination */}
      {conversations && conversations.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5">Page {page} of {conversations.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(conversations.totalPages, p + 1))}
            disabled={page === conversations.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

const ChatView: React.FC<{
  conversationId: string;
}> = ({ conversationId }) => {
  const [page, setPage] = useState(1);
  const [messageInput, setMessageInput] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation
  const { data: conversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['whatsapp', 'conversation', conversationId],
    queryFn: () => whatsappService.getConversation(conversationId),
    enabled: !!conversationId,
  });

  // Fetch messages
  const { data: messages, isLoading: isLoadingMessages, refetch } = useQuery({
    queryKey: ['whatsapp', 'messages', conversationId, page],
    queryFn: () => whatsappService.getMessages(conversationId, { page, pageSize: 50 }),
    select: (res) => ({
      items: res.data,
      totalPages: res.pagination.totalPages,
    }),
    enabled: !!conversationId,
  });

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ['whatsapp', 'agents'],
    queryFn: () => whatsappService.getAgents(),
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { message: string; mediaUrl?: string }) =>
      whatsappService.sendMessage(conversationId, data),
    onSuccess: () => {
      setMessageInput('');
      setSelectedMedia(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', conversationId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to send message'),
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: () => whatsappService.markConversationAsRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: () => whatsappService.resolveConversation(conversationId, resolutionNote),
    onSuccess: () => {
      setShowResolveModal(false);
      setResolutionNote('');
      toast.success('Conversation resolved');
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
    onError: () => toast.error('Failed to resolve conversation'),
  });

  // Reopen mutation
  const reopenMutation = useMutation({
    mutationFn: () => whatsappService.reopenConversation(conversationId),
    onSuccess: () => {
      toast.success('Conversation reopened');
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
    onError: () => toast.error('Failed to reopen conversation'),
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (agentId: string) => whatsappService.assignConversation({ conversationId, agentId }),
    onSuccess: () => {
      setShowAssignModal(false);
      toast.success('Conversation assigned');
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
    onError: () => toast.error('Failed to assign conversation'),
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.items]);

  // Mark as read on mount
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      markAsReadMutation.mutate();
    }
  }, [conversationId, conversation]);

  const handleSendMessage = () => {
    if (!messageInput.trim() && !selectedMedia) return;

    if (selectedMedia) {
      toast('Media upload not implemented yet');
    } else {
      sendMessageMutation.mutate({ message: messageInput.trim() });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isToday) return formatTime(dateString);
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = React.useMemo(() => {
    if (!messages?.items) return [];
    const groups: Array<{ date: string; messages: WhatsAppMessage[] }> = [];
    let currentDate = '';
    let currentGroup: WhatsAppMessage[] = [];

    messages.items.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: formatDate(currentDate), messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [];
      }
      currentGroup.push(msg);
    });

    if (currentGroup.length > 0) {
      groups.push({ date: formatDate(currentDate), messages: currentGroup });
    }

    return groups;
  }, [messages?.items]);

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={<MessageSquare size={48} />}
          title="Select a Conversation"
          description="Choose a conversation from the list to start messaging"
        />
      </div>
    );
  }

  if (isLoadingConversation) {
    return <div className="flex items-center justify-center h-full">
      <RefreshCw className="animate-spin" size={32} />
    </div>;
  }

  const isResolved = conversation?.status === 'closed';

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
            <User size={20} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{conversation?.customerName || conversation?.phoneNumber}</h3>
            <p className="text-sm text-gray-500">{conversation?.phoneNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowActionsModal(true)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin" size={32} />
          </div>
        ) : groupedMessages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={48} />}
            title="No Messages Yet"
            description="Start a conversation by sending a message"
          />
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group, groupIdx) => (
              <div key={groupIdx}>
                <div className="text-center">
                  <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                    {group.date}
                  </span>
                </div>
                {group.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.direction === 'outbound'}
                    onRetry={msg.status === 'failed' ? () => sendMessageMutation.mutate({ message: msg.message }) : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Input */}
      {!isResolved && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setSelectedMedia(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-100 rounded"
              title="Attach media"
            >
              <Paperclip size={20} className="text-gray-600" />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isResolved}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() && !selectedMedia || sendMessageMutation.isPending}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {sendMessageMutation.isPending ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          {selectedMedia && (
            <div className="mt-2 flex items-center justify-between bg-blue-50 p-2 rounded">
              <span className="text-sm text-blue-700">{selectedMedia.name}</span>
              <button
                onClick={() => setSelectedMedia(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resolved Banner */}
      {isResolved && (
        <div className="p-4 bg-gray-100 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-500" />
              <span className="text-gray-700">This conversation is resolved</span>
            </div>
            <button
              onClick={() => reopenMutation.mutate()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Reopen
            </button>
          </div>
        </div>
      )}

      {/* Actions Modal */}
      <Modal isOpen={showActionsModal} onClose={() => setShowActionsModal(false)}>
        <div className="p-4 space-y-2">
          <h3 className="font-bold mb-4">Conversation Actions</h3>
          <button
            onClick={() => {
              setShowActionsModal(false);
              setShowAssignModal(true);
            }}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded text-left"
          >
            <User size={18} /> Assign to Agent
          </button>
          <button
            onClick={() => {
              setShowActionsModal(false);
              setShowResolveModal(true);
            }}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded text-left"
          >
            <CheckCircle size={18} /> Resolve Conversation
          </button>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)}>
        <div className="p-4">
          <h3 className="font-bold mb-4">Assign Conversation</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {agents?.map((agent) => (
              <button
                key={agent.id}
                onClick={() => assignMutation.mutate(agent.id)}
                disabled={assignMutation.isPending}
                className={`w-full flex items-center justify-between p-3 rounded hover:bg-gray-50 ${
                  conversation?.assignedTo === agent.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    {agent.avatar ? (
                      <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full" />
                    ) : (
                      <User size={16} className="text-gray-600" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{agent.name}</div>
                    <div className={`text-xs ${
                      agent.status === 'online' ? 'text-green-600' :
                      agent.status === 'away' ? 'text-yellow-600' : 'text-gray-500'
                    }`}>
                      {agent.status} • {agent.activeConversations} active
                    </div>
                  </div>
                </div>
                {conversation?.assignedTo === agent.id && (
                  <Check size={16} className="text-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)}>
        <div className="p-4">
          <h3 className="font-bold mb-4">Resolve Conversation</h3>
          <textarea
            placeholder="Add a resolution note (optional)..."
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowResolveModal(false)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const TemplatesView: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['whatsapp', 'templates', page, search, selectedCategory],
    queryFn: () => whatsappService.getTemplates({ page, pageSize: 20, search, category: selectedCategory, status: 'approved' }),
    select: (res) => ({
      items: res.data,
      totalPages: res.pagination.totalPages,
    }),
  });

  // Helper functions for template actions
  const handleSaveUpdate = () => {
    const nameInput = document.getElementById('template-name') as HTMLInputElement;
    const categoryInput = document.getElementById('template-category') as HTMLSelectElement;
    const bodyInput = document.getElementById('template-body') as HTMLTextAreaElement;
    const footerInput = document.getElementById('template-footer') as HTMLInputElement;

    if (nameInput && categoryInput && bodyInput && footerInput && editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: {
          name: nameInput.value,
          category: categoryInput.value as 'marketing' | 'utility' | 'authentication' | 'service',
          body: bodyInput.value,
          footerText: footerInput.value
        }
      });
    }
  };

  const handleCreate = () => {
    const nameInput = document.getElementById('template-name') as HTMLInputElement;
    const categoryInput = document.getElementById('template-category') as HTMLSelectElement;
    const bodyInput = document.getElementById('template-body') as HTMLTextAreaElement;
    const footerInput = document.getElementById('template-footer') as HTMLInputElement;

    if (nameInput && categoryInput && bodyInput && footerInput) {
      createMutation.mutate({
        name: nameInput.value,
        category: categoryInput.value as 'marketing' | 'utility' | 'authentication' | 'service',
        body: bodyInput.value,
        footerText: footerInput.value
      });
    }
  };

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<WhatsAppTemplate>) => whatsappService.createTemplate(data),
    onSuccess: () => {
      toast.success('Template created');
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates'] });
    },
    onError: () => toast.error('Failed to create template'),
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WhatsAppTemplate> }) =>
      whatsappService.updateTemplate(id, data),
    onSuccess: () => {
      toast.success('Template updated');
      setEditingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates'] });
    },
    onError: () => toast.error('Failed to update template'),
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappService.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates'] });
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const columns = [
    {
      key: 'name',
      label: 'Template Name',
      render: (value: string, row: WhatsAppTemplate) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-gray-500 capitalize">{row.category}</div>
        </div>
      ),
    },
    {
      key: 'body',
      label: ' Preview',
      render: (value: string) => (
        <div className="text-sm text-gray-600 truncate max-w-[250px]" title={value}>
          {value}
          {value.includes('{{') && (
            <span className="text-blue-600">...</span>
          )}
        </div>
      ),
    },
    {
      key: 'variables',
      label: 'Variables',
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
              {v}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'language',
      label: 'Language',
      render: (value: string) => (
        <span className="text-sm uppercase">{value}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const statusMap: Record<string, { status: 'success' | 'warning' | 'error'; label: string }> = {
          approved: { status: 'success', label: 'Approved' },
          pending: { status: 'warning', label: 'Pending' },
          rejected: { status: 'error', label: 'Rejected' },
        };
        const config = statusMap[value] || statusMap.pending;
        return <Badge status={config.status}>{config.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Message Templates</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={18} /> New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Categories</option>
          <option value="marketing">Marketing</option>
          <option value="utility">Utility</option>
          <option value="authentication">Authentication</option>
          <option value="service">Service</option>
        </select>
      </div>

      {/* Templates Table */}
      <DataTable
        columns={columns}
        data={templates?.items || []}
        isLoading={isLoading}
        onRowClick={(row) => setEditingTemplate(row as WhatsAppTemplate)}
      />

      {/* Pagination */}
      {templates && templates.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5">Page {page} of {templates.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(templates.totalPages, p + 1))}
            disabled={page === templates.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {(showCreateModal || editingTemplate) && (
        <Modal isOpen={!!showCreateModal || !!editingTemplate} onClose={() => { setShowCreateModal(false); setEditingTemplate(null); }} size="lg">
          <div className="p-6">
            <h3 className="font-bold text-lg mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  defaultValue={editingTemplate?.name}
                  id="template-name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  defaultValue={editingTemplate?.category}
                  id="template-category"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utility</option>
                  <option value="authentication">Authentication</option>
                  <option value="service">Service</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Body</label>
                <textarea
                  defaultValue={editingTemplate?.body}
                  id="template-body"
                  rows={4}
                  placeholder="Hello {1}, your order {2} has been shipped!"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Use {1}, {2}, etc. for variables</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text (optional)</label>
                <input
                  type="text"
                  defaultValue={editingTemplate?.footerText}
                  id="template-footer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => { setShowCreateModal(false); setEditingTemplate(null); }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                {editingTemplate && (
                  <button
                    onClick={handleSaveUpdate}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                )}
                {!editingTemplate && (
                  <button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                )}
                {editingTemplate && (
                  <button
                    onClick={() => deleteMutation.mutate(editingTemplate.id)}
                    disabled={deleteMutation.isPending}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const AgentsView: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch agents
  const { data: agents, isLoading } = useQuery({
    queryKey: ['whatsapp', 'agents'],
    queryFn: () => whatsappService.getAgents(),
  });

  // Set status mutation
  const setStatusMutation = useMutation({
    mutationFn: (status: 'online' | 'away' | 'offline') => whatsappService.setAgentStatus(status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'agents'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Support Agents</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents?.map((agent) => (
          <div key={agent.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  {agent.avatar ? (
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full" />
                  ) : (
                    <User size={24} className="text-gray-600" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium">{agent.name}</div>
                  {agent.email && (
                    <div className="text-xs text-gray-500">{agent.email}</div>
                  )}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${
                agent.status === 'online' ? 'bg-green-500' :
                agent.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Active Chats</span>
                <span className="font-medium">{agent.activeConversations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Assigned</span>
                <span className="font-medium">{agent.assignedConversations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium capitalize ${
                  agent.status === 'online' ? 'text-green-600' :
                  agent.status === 'away' ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {agent.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MAIN PAGE
// ============================================================

const WhatsAppPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('conversations');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const queryClient = useQueryClient();

  const tabs = [
    { id: 'conversations', label: 'Conversations', icon: <MessageSquare size={18} /> },
    { id: 'templates', label: 'Templates', icon: <File size={18} /> },
    { id: 'agents', label: 'Agents', icon: <Users size={18} /> },
  ];

  // Fetch connection status
  const { data: connectionStatus } = useQuery({
    queryKey: ['whatsapp', 'connection-status'],
    queryFn: () => whatsappService.getConnectionStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: () => whatsappService.connectWhatsApp(),
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setShowConnectionModal(true);
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'connection-status'] });
    },
    onError: () => toast.error('Failed to connect WhatsApp'),
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => whatsappService.disconnectWhatsApp(),
    onSuccess: () => {
      toast.success('WhatsApp disconnected');
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'connection-status'] });
    },
    onError: () => toast.error('Failed to disconnect WhatsApp'),
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
          <p className="text-gray-600 mt-1">Manage conversations, templates, and agents</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-4 py-2">
            {connectionStatus?.connected ? (
              <>
                <Wifi size={18} className="text-green-500" />
                <div className="text-left">
                  <div className="text-sm font-medium">Connected</div>
                  <div className="text-xs text-gray-500">{connectionStatus.phoneNumber}</div>
                </div>
              </>
            ) : (
              <>
                <Wifi size={18} className="text-gray-400" />
                <div className="text-left">
                  <div className="text-sm font-medium text-orange-600">Disconnected</div>
                  <div className="text-xs text-gray-500">
                    {connectionStatus?.status === 'needs_authentication' ? 'Needs auth' : 'Not connected'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Connection Actions */}
          {connectionStatus?.connected ? (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
            >
              {disconnectMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <X size={18} />}
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              {connectMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
              Connect
            </button>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      <Modal isOpen={showConnectionModal} onClose={() => setShowConnectionModal(false)}>
        <div className="p-6 text-center">
          <h3 className="font-bold text-lg mb-4">Scan QR Code</h3>
          <p className="text-gray-600 mb-4">Open WhatsApp on your phone and scan this QR code to connect</p>
          {qrCode && (
            <div className="bg-white p-4 rounded-lg inline-block">
              <img src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" className="w-64 h-64" />
            </div>
          )}
          <p className="text-xs text-gray-500 mt-4">QR code expires in 5 minutes</p>
        </div>
      </Modal>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 min-h-[600px]">
        {activeTab === 'conversations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
            {/* Conversations List */}
            <div className="lg:col-span-1 border-r border-gray-200">
              <ConversationsView
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
              />
            </div>

            {/* Chat View */}
            <div className="lg:col-span-2 h-[600px]">
              <ChatView conversationId={selectedConversationId || ''} />
            </div>
          </div>
        )}
        {activeTab === 'templates' && (
          <div className="p-6">
            <TemplatesView />
          </div>
        )}
        {activeTab === 'agents' && (
          <div className="p-6">
            <AgentsView />
          </div>
        )}
      </div>
    </div>
  );
};

export { WhatsAppPage };
export default WhatsAppPage;
