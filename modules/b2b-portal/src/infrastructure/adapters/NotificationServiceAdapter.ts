import { INotificationPort } from '../../application/ports';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { NotificationEntity } from '../../../../notifications/src/infrastructure/entities/NotificationEntity';

export class NotificationServiceAdapter implements INotificationPort {
    constructor(private readonly dataSource: DataSource) { }

    async sendNotification(data: {
        type: string;
        recipientId: string;
        email?: string;
        subject?: string;
        message?: string;
        data?: unknown;
    }): Promise<void> {
        const recipientId = data.recipientId || data.email || 'b2b-system';
        const repository = this.dataSource.getRepository(NotificationEntity);
        const templateData = {
            ...data,
            payload: data.data || {},
        } as Record<string, unknown>;
        const entity = repository.create({
            id: uuidv4(),
            type: 'EMAIL',
            channel: 'EMAIL',
            recipientId,
            recipientEmail: data.email || undefined,
            subject: data.subject || data.type || 'Notification',
            body: data.message || '',
            templateData,
            status: 'PENDING',
            priority: 'NORMAL',
            retryCount: 0,
            metadata: {
                source: 'b2b-portal',
                eventType: data.type,
            },
        });
        await repository.save(entity);
    }

    async sendBulkNotifications(data: {
        type: string;
        recipients: Array<{
            id: string;
            email: string;
        }>;
        subject?: string;
        template?: string;
        data?: unknown;
    }): Promise<void> {
        for (const recipient of data.recipients) {
            await this.sendNotification({
                type: data.type,
                recipientId: recipient.id,
                email: recipient.email,
                subject: data.subject,
                message: data.template || data.type,
                data: data.data,
            });
        }
    }
}
