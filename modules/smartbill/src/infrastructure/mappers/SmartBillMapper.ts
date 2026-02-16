import {
  SmartBillInvoice,
  InvoiceStatus,
  SmartBillApiInvoiceStatus,
} from '../../domain/entities/SmartBillInvoice';
import {
  SmartBillProforma,
  ProformaStatus,
  SmartBillApiProformaStatus,
} from '../../domain/entities/SmartBillProforma';
import { SmartBillInvoiceEntity } from '../entities/SmartBillInvoiceEntity';
import { SmartBillProformaEntity } from '../entities/SmartBillProformaEntity';

export class SmartBillMapper {
  static toDomainInvoice(entity: SmartBillInvoiceEntity): SmartBillInvoice {
    const invoice = new SmartBillInvoice(
      entity.id,
      entity.orderId,
      entity.smartBillId || undefined,
      entity.invoiceNumber || undefined,
      entity.series,
      entity.customerName,
      entity.customerVat,
      entity.items,
      entity.totalWithoutVat,
      entity.vatAmount,
      entity.totalWithVat,
      entity.currency,
      entity.status as InvoiceStatus,
      entity.issueDate,
      entity.dueDate,
      entity.createdAt,
      entity.paidAmount || 0,
      entity.paymentDate || null,
      entity.smartBillStatus as SmartBillApiInvoiceStatus || null,
    );
    return invoice;
  }

  static toInvoiceEntity(invoice: SmartBillInvoice): SmartBillInvoiceEntity {
    const entity = new SmartBillInvoiceEntity();
    entity.id = invoice.id ?? 0;
    entity.orderId = invoice.orderId;
    entity.smartBillId = invoice.smartBillId || null;
    entity.invoiceNumber = invoice.invoiceNumber || null;
    entity.series = invoice.series;
    entity.customerName = invoice.customerName;
    entity.customerVat = invoice.customerVat;
    entity.items = invoice.items;
    entity.totalWithoutVat = invoice.totalWithoutVat;
    entity.vatAmount = invoice.vatAmount;
    entity.totalWithVat = invoice.totalWithVat;
    entity.currency = invoice.currency;
    entity.status = invoice.status;
    entity.smartBillStatus = invoice.smartBillStatus;
    entity.issueDate = invoice.issueDate;
    entity.dueDate = invoice.dueDate;
    entity.createdAt = invoice.createdAt;
    entity.paidAmount = invoice.paidAmount;
    entity.paymentDate = invoice.paymentDate;
    return entity;
  }

  static toDomainProforma(entity: SmartBillProformaEntity): SmartBillProforma {
    return new SmartBillProforma(
      entity.id,
      entity.orderId,
      entity.smartBillId || undefined,
      entity.proformaNumber || undefined,
      entity.series,
      entity.customerName,
      entity.customerVat,
      entity.items,
      entity.totalWithoutVat,
      entity.vatAmount,
      entity.totalWithVat,
      entity.currency,
      entity.status as ProformaStatus,
      entity.issueDate,
      entity.dueDate,
      entity.createdAt,
      entity.smartBillStatus as SmartBillApiProformaStatus || null,
    );
  }

  static toProformaEntity(proforma: SmartBillProforma): SmartBillProformaEntity {
    const entity = new SmartBillProformaEntity();
    entity.id = proforma.id ?? 0;
    entity.orderId = proforma.orderId;
    entity.smartBillId = proforma.smartBillId || null;
    entity.proformaNumber = proforma.proformaNumber || null;
    entity.series = proforma.series;
    entity.customerName = proforma.customerName;
    entity.customerVat = proforma.customerVat;
    entity.items = proforma.items;
    entity.totalWithoutVat = proforma.totalWithoutVat;
    entity.vatAmount = proforma.vatAmount;
    entity.totalWithVat = proforma.totalWithVat;
    entity.currency = proforma.currency;
    entity.status = proforma.status;
    entity.smartBillStatus = proforma.smartBillStatus;
    entity.issueDate = proforma.issueDate;
    entity.dueDate = proforma.dueDate;
    entity.createdAt = proforma.createdAt;
    return entity;
  }
}
