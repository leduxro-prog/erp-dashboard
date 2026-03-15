import { createModuleLogger } from '@shared/utils/logger';
import { Router } from 'express';
import { DataSource } from 'typeorm';

// Domain repositories (interfaces)
import { WhatsAppController } from '../api/controllers/WhatsAppController';
import { createWhatsAppRoutes } from '../api/routes/whatsapp.routes';
import {
  SendMessage,
  ListMessages,
  ListConversations,
  GetConversation,
  AssignConversation,
  ResolveConversation,
  ProcessWebhook,
  ListTemplates,
  CreateTemplate,
} from '../application/use-cases';
import {
  ReopenConversation,
  MarkConversationAsRead,
  UpdateTemplate,
  DeleteTemplate,
  GetAgents,
  SetAgentStatus,
  GetConnectionStatus,
  ConnectWhatsApp,
  DisconnectWhatsApp,
  ReconnectWhatsApp,
  GetTags,
  UpdateConversationTags,
  GetStatistics,
} from '../application/use-cases';
import { IConnectionPort } from '../domain/ports/IConnectionPort';
import { IWhatsAppBusinessApi } from '../domain/ports/IWhatsAppBusinessApi';
import {
  IMessageRepository,
  IConversationRepository,
  ITemplateRepository,
  IWebhookRepository,
  IAgentRepository,
  ITagRepository,
} from '../domain/repositories';

// Use-cases

// NEW USE CASES

// Infrastructure repositories (TypeORM implementations)
import { TypeOrmAgentRepository } from './repositories/TypeOrmAgentRepository';
import { TypeOrmConversationRepository } from './repositories/TypeOrmConversationRepository';
import { TypeOrmMessageRepository } from './repositories/TypeOrmMessageRepository';
import { TypeOrmTagRepository } from './repositories/TypeOrmTagRepository';
import { TypeOrmTemplateRepository } from './repositories/TypeOrmTemplateRepository';
import { TypeOrmWebhookRepository } from './repositories/TypeOrmWebhookRepository';

// NEW REPOSITORIES

// Domain ports

// Controller

// Routes

/**
 * Composition Root for WhatsApp Module
 * Orchestrates dependency injection and creates configured Express router
 */
export function createWhatsAppRouter(
  dataSource: DataSource,
  whatsappApi: IWhatsAppBusinessApi,
): Router {
  const logger = createModuleLogger('whatsapp');

  // Initialize repositories
  const messageRepository: IMessageRepository = new TypeOrmMessageRepository(dataSource);
  const conversationRepository: IConversationRepository = new TypeOrmConversationRepository(
    dataSource,
  );
  const templateRepository: ITemplateRepository = new TypeOrmTemplateRepository(dataSource);
  const webhookRepository: IWebhookRepository = new TypeOrmWebhookRepository(dataSource);

  // NEW REPOSITORIES
  const agentRepository: IAgentRepository = new TypeOrmAgentRepository(dataSource);
  const tagRepository: ITagRepository = new TypeOrmTagRepository(dataSource);

  // Initialize use-cases with dependency injection
  const sendMessage = new SendMessage(
    messageRepository,
    conversationRepository,
    whatsappApi,
    logger,
  );

  const listMessages = new ListMessages(messageRepository);

  const listConversations = new ListConversations(conversationRepository);

  const getConversation = new GetConversation(conversationRepository, messageRepository);

  const assignConversation = new AssignConversation(conversationRepository);

  const resolveConversation = new ResolveConversation(conversationRepository);

  const processWebhook = new ProcessWebhook(
    webhookRepository,
    messageRepository,
    conversationRepository,
  );

  const listTemplates = new ListTemplates(templateRepository);

  const createTemplate = new CreateTemplate(templateRepository);

  // Create IConnectionPort adapter wrapping the IWhatsAppBusinessApi methods
  const connectionPort: IConnectionPort = {
    getStatus: () => whatsappApi.getConnectionStatus(),
    generateQRCode: (force?: boolean) => whatsappApi.generateQRCode(force),
    disconnect: () => whatsappApi.disconnect(),
  };

  // NEW USE CASES
  const reopenConversation = new ReopenConversation(conversationRepository);
  const markConversationAsRead = new MarkConversationAsRead(conversationRepository);
  const updateTemplate = new UpdateTemplate(templateRepository);
  const deleteTemplate = new DeleteTemplate(templateRepository);
  const getAgents = new GetAgents(agentRepository);
  const setAgentStatus = new SetAgentStatus(agentRepository);
  const getConnectionStatus = new GetConnectionStatus(connectionPort);
  const connectWhatsApp = new ConnectWhatsApp(connectionPort);
  const disconnectWhatsApp = new DisconnectWhatsApp(connectionPort);
  const reconnectWhatsApp = new ReconnectWhatsApp(connectionPort);
  const getTags = new GetTags(tagRepository);
  const updateConversationTags = new UpdateConversationTags(conversationRepository);
  const getStatistics = new GetStatistics(conversationRepository, messageRepository);

  // Initialize controller
  const controller = new WhatsAppController(
    sendMessage,
    listMessages,
    listConversations,
    getConversation,
    assignConversation,
    resolveConversation,
    processWebhook,
    listTemplates,
    createTemplate,
    // NEW USE CASES
    reopenConversation,
    markConversationAsRead,
    updateTemplate,
    deleteTemplate,
    getAgents,
    setAgentStatus,
    getConnectionStatus,
    connectWhatsApp,
    disconnectWhatsApp,
    reconnectWhatsApp,
    getTags,
    updateConversationTags,
    getStatistics,
  );

  // Create and return configured Express router
  return createWhatsAppRoutes(controller);
}
