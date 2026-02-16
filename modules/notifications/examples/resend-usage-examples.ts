/**
 * Resend Email Adapter Usage Examples
 *
 * These examples demonstrate how to use the ResendEmailAdapter
 * for sending emails in various scenarios.
 */

import { ResendEmailAdapter } from '../src/infrastructure/adapters/ResendEmailAdapter';

// Initialize the adapter
const resendApiKey = process.env.RESEND_API_KEY || 're_placeholder_key';
const adapter = new ResendEmailAdapter(resendApiKey, 'noreply@ledux.ro');

/**
 * Example 1: Send a simple email
 */
async function sendSimpleEmail() {
  const result = await adapter.sendEmail({
    to: 'customer@example.com',
    subject: 'Welcome to LEDUX!',
    html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
  });

  if (result.success) {
    console.log('Email sent successfully!', result.messageId);
  } else {
    console.error('Failed to send email:', result.error);
  }
}

/**
 * Example 2: Send email using a template
 */
async function sendTemplatedEmail() {
  const result = await adapter.sendEmail({
    to: 'customer@example.com',
    subject: 'Order Confirmation',
    template: 'order_confirmation',
    templateData: {
      customerName: 'John Doe',
      orderNumber: 'ORD-12345',
      totalAmount: '250.00',
      status: 'Processing',
    },
  });

  if (result.success) {
    console.log('Templated email sent!', result.messageId);
  } else {
    console.error('Failed to send templated email:', result.error);
  }
}

/**
 * Example 3: Send B2B registration confirmation
 */
async function sendB2BRegistrationEmail() {
  const result = await adapter.sendEmail({
    to: 'business@company.com',
    subject: 'B2B Registration Received',
    template: 'b2b_registration_submitted',
    templateData: {
      companyName: 'Acme Corp',
      registrationId: 'B2B-2026-001',
    },
  });

  if (result.success) {
    console.log('B2B registration email sent!', result.messageId);
  } else {
    console.error('Failed:', result.error);
  }
}

/**
 * Example 4: Send B2B auto-approval email
 */
async function sendB2BAutoApprovalEmail() {
  const result = await adapter.sendEmail({
    to: 'business@company.com',
    subject: 'B2B Account Approved!',
    template: 'b2b_auto_approved',
    templateData: {
      companyName: 'Acme Corp',
      creditLimit: '50000',
      email: 'business@company.com',
    },
  });

  if (result.success) {
    console.log('Auto-approval email sent!', result.messageId);
  } else {
    console.error('Failed:', result.error);
  }
}

/**
 * Example 5: Send bulk emails
 */
async function sendBulkEmails() {
  const messages = [
    {
      to: 'customer1@example.com',
      subject: 'Monthly Newsletter',
      template: 'order_confirmation',
      templateData: {
        customerName: 'Alice',
        orderNumber: 'ORD-001',
        totalAmount: '100.00',
        status: 'Shipped',
      },
    },
    {
      to: 'customer2@example.com',
      subject: 'Monthly Newsletter',
      template: 'order_confirmation',
      templateData: {
        customerName: 'Bob',
        orderNumber: 'ORD-002',
        totalAmount: '200.00',
        status: 'Processing',
      },
    },
  ];

  const result = await adapter.sendBulk(messages);

  console.log('Bulk send results:', result);
  result.results.forEach((res, index) => {
    if (res.success) {
      console.log(`Email ${index + 1} sent:`, res.messageId);
    } else {
      console.error(`Email ${index + 1} failed:`, res.error);
    }
  });
}

/**
 * Example 6: Register a custom template
 */
function registerCustomTemplate() {
  const templateHtml = `
    <h1>Payment Reminder</h1>
    <p>Hello {{customerName}},</p>
    <p>This is a friendly reminder that invoice <strong>{{invoiceNumber}}</strong> is due on {{dueDate}}.</p>
    <p>Amount: <strong>{{amount}} RON</strong></p>
    <p>Please make your payment at your earliest convenience.</p>
    <br/>
    <p>Best regards,<br/>LEDUX Team</p>
  `;

  adapter.registerTemplate('payment_reminder', templateHtml);
  console.log('Custom template registered successfully!');
}

/**
 * Example 7: Send email with custom template
 */
async function sendCustomTemplateEmail() {
  // First register the template
  registerCustomTemplate();

  // Then send email using it
  const result = await adapter.sendEmail({
    to: 'customer@example.com',
    subject: 'Payment Reminder - Invoice INV-2026-123',
    template: 'payment_reminder',
    templateData: {
      customerName: 'John Smith',
      invoiceNumber: 'INV-2026-123',
      dueDate: '2026-02-20',
      amount: '1,250.00',
    },
  });

  if (result.success) {
    console.log('Custom template email sent!', result.messageId);
  } else {
    console.error('Failed:', result.error);
  }
}

/**
 * Example 8: Send to multiple recipients
 */
async function sendToMultipleRecipients() {
  const result = await adapter.sendEmail({
    to: ['customer1@example.com', 'customer2@example.com', 'customer3@example.com'],
    subject: 'Important Announcement',
    html: '<h1>System Maintenance</h1><p>Our system will be down for maintenance on Sunday.</p>',
  });

  if (result.success) {
    console.log('Email sent to multiple recipients!', result.messageId);
  } else {
    console.error('Failed:', result.error);
  }
}

/**
 * Example 9: Handle errors gracefully
 */
async function handleEmailErrors() {
  try {
    const result = await adapter.sendEmail({
      to: 'invalid-email', // Invalid email format
      subject: 'Test',
      html: '<p>Test</p>',
    });

    if (!result.success) {
      console.error('Email validation failed:', result.error);
      // Log to monitoring system
      // Retry logic
      // Notify administrators
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

/**
 * Example 10: Production usage pattern
 */
async function productionExample() {
  // In production, wrap in try-catch and add logging
  try {
    console.log('Sending order confirmation email...');

    const result = await adapter.sendEmail({
      to: 'customer@example.com',
      from: 'orders@ledux.ro', // Custom from address
      subject: 'Your LEDUX Order #12345 is confirmed',
      template: 'order_confirmation',
      templateData: {
        customerName: 'Maria Popescu',
        orderNumber: '12345',
        totalAmount: '450.00',
        status: 'Confirmed',
      },
    });

    if (result.success) {
      console.log('✓ Email sent successfully', {
        messageId: result.messageId,
        to: 'customer@example.com',
        timestamp: new Date().toISOString(),
      });

      // Log to database or analytics
      // await logEmailSent(result.messageId, 'customer@example.com');
    } else {
      console.error('✗ Email failed', {
        error: result.error,
        to: 'customer@example.com',
        timestamp: new Date().toISOString(),
      });

      // Queue for retry
      // await queueEmailForRetry({...});
    }
  } catch (error) {
    console.error('Critical error sending email:', error);
    // Alert monitoring system
  }
}

// Export examples for use in tests or scripts
export {
  sendSimpleEmail,
  sendTemplatedEmail,
  sendB2BRegistrationEmail,
  sendB2BAutoApprovalEmail,
  sendBulkEmails,
  registerCustomTemplate,
  sendCustomTemplateEmail,
  sendToMultipleRecipients,
  handleEmailErrors,
  productionExample,
};
