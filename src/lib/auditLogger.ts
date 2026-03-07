// src/lib/auditLogger.ts
import { prisma } from './prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntityType =
  | 'INVOICE'
  | 'INVOICE_ITEM'
  | 'CLIENT'
  | 'PRODUCT'
  | 'MANUFACTURER'
  | 'PAYMENT'
  | 'RETURN'
  | 'USER'
  | 'SETTINGS'
  | 'EXPENSE'
  | 'SYSTEM';

export interface AuditLogOptions {
  action:      string;
  entityType:  EntityType;
  entityId?:   string | null;
  userId?:     string | null;
  oldData?:    Record<string, any> | null;
  newData?:    Record<string, any> | null;
  changes?:    Record<string, any> | null;
  ipAddress?:  string | null;
  userAgent?:  string | null;
  description?: string | null;  // human-readable summary
}

// ─── AuditLogger ─────────────────────────────────────────────────────────────

export class AuditLogger {

  /**
   * Core log method — writes one record to auditLogs table.
   * Never throws — audit failure must never break main functionality.
   */
  static async log(opts: AuditLogOptions): Promise<boolean> {
    try {
      await (prisma as any).auditLog.create({
        data: {
          action:      opts.action,
          entityType:  opts.entityType,
          entityId:    opts.entityId   ?? null,
          userId:      opts.userId     ?? null,
          oldData:     opts.oldData    ? JSON.stringify(opts.oldData)  : null,
          newData:     opts.newData    ? JSON.stringify(opts.newData)  : null,
          changes:     opts.changes    ? JSON.stringify(opts.changes)  : null,
          description: opts.description ?? null,
          ipAddress:   opts.ipAddress  ?? null,
          userAgent:   opts.userAgent  ?? null,
          createdAt:   new Date(),
        },
      });
      console.log(`✅ Audit: ${opts.action} on ${opts.entityType} ${opts.entityId ?? ''}`);
      return true;
    } catch (err) {
      console.error('❌ AuditLogger failed:', err);
      return false;
    }
  }

  // ── Convenience helpers ───────────────────────────────────────────────────

  // INVOICES
  static invoice = {
    created:  (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'INVOICE_CREATED',  entityType: 'INVOICE', entityId: id, userId, newData: data, description: `Invoice ${data?.invoiceNumber ?? id} created` }),
    updated:  (id: string, old: any, next: any, userId?: string) =>
      AuditLogger.log({ action: 'INVOICE_UPDATED',  entityType: 'INVOICE', entityId: id, userId, oldData: old, newData: next, description: `Invoice ${id} updated` }),
    deleted:  (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'INVOICE_DELETED',  entityType: 'INVOICE', entityId: id, userId, oldData: data, description: `Invoice ${data?.invoiceNumber ?? id} deleted` }),
    historical:(id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'HISTORICAL_INVOICE_IMPORTED', entityType: 'INVOICE', entityId: id, userId, newData: data, description: `Historical invoice ${data?.invoiceNumber ?? id} imported` }),
    paid:     (id: string, amount: number, userId?: string) =>
      AuditLogger.log({ action: 'INVOICE_PAID',     entityType: 'INVOICE', entityId: id, userId, changes: { amount }, description: `Invoice ${id} marked as paid — K${amount}` }),
  };

  // CLIENTS
  static client = {
    created: (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'CLIENT_CREATED', entityType: 'CLIENT', entityId: id, userId, newData: data, description: `Client "${data?.name}" created` }),
    updated: (id: string, old: any, next: any, userId?: string) =>
      AuditLogger.log({ action: 'CLIENT_UPDATED', entityType: 'CLIENT', entityId: id, userId, oldData: old, newData: next, description: `Client "${next?.name ?? id}" updated` }),
    deleted: (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'CLIENT_DELETED', entityType: 'CLIENT', entityId: id, userId, oldData: data, description: `Client "${data?.name ?? id}" deleted` }),
  };

  // PRODUCTS / INVENTORY
  static product = {
    created:       (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'PRODUCT_CREATED',        entityType: 'PRODUCT', entityId: id, userId, newData: data, description: `Product "${data?.name}" added to inventory` }),
    updated:       (id: string, old: any, next: any, userId?: string) =>
      AuditLogger.log({ action: 'PRODUCT_UPDATED',        entityType: 'PRODUCT', entityId: id, userId, oldData: old, newData: next, description: `Product "${next?.name ?? id}" updated` }),
    deleted:       (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'PRODUCT_DELETED',        entityType: 'PRODUCT', entityId: id, userId, oldData: data, description: `Product "${data?.name ?? id}" removed` }),
    stockAdjusted: (id: string, from: number, to: number, reason: string, userId?: string) =>
      AuditLogger.log({ action: 'STOCK_ADJUSTED',         entityType: 'PRODUCT', entityId: id, userId, changes: { from, to, reason }, description: `Stock adjusted ${from} → ${to}: ${reason}` }),
    lowStock:      (id: string, name: string, stock: number) =>
      AuditLogger.log({ action: 'STOCK_LOW_ALERT',        entityType: 'PRODUCT', entityId: id, changes: { stock }, description: `Low stock alert: "${name}" has ${stock} units remaining` }),
    expiringSoon:  (id: string, name: string, expiryDate: string) =>
      AuditLogger.log({ action: 'PRODUCT_EXPIRING_SOON',  entityType: 'PRODUCT', entityId: id, changes: { expiryDate }, description: `Expiry alert: "${name}" expires ${expiryDate}` }),
  };

  // MANUFACTURERS
  static manufacturer = {
    created: (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'MANUFACTURER_CREATED', entityType: 'MANUFACTURER', entityId: id, userId, newData: data, description: `Manufacturer "${data?.name}" created` }),
    updated: (id: string, old: any, next: any, userId?: string) =>
      AuditLogger.log({ action: 'MANUFACTURER_UPDATED', entityType: 'MANUFACTURER', entityId: id, userId, oldData: old, newData: next }),
    deleted: (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'MANUFACTURER_DELETED', entityType: 'MANUFACTURER', entityId: id, userId, oldData: data }),
  };

  // RETURNS
  static return = {
    processed: (id: string, invoiceId: string, items: any[], userId?: string) =>
      AuditLogger.log({ action: 'RETURN_PROCESSED', entityType: 'RETURN', entityId: id, userId, changes: { invoiceId, items }, description: `Return processed for invoice ${invoiceId}` }),
  };

  // PAYMENTS
  static payment = {
    recorded: (id: string, invoiceId: string, amount: number, method: string, userId?: string) =>
      AuditLogger.log({ action: 'PAYMENT_RECORDED', entityType: 'PAYMENT', entityId: id, userId, changes: { invoiceId, amount, method }, description: `Payment K${amount} via ${method} recorded` }),
    deleted:  (id: string, userId?: string) =>
      AuditLogger.log({ action: 'PAYMENT_DELETED',  entityType: 'PAYMENT', entityId: id, userId, description: `Payment ${id} deleted` }),
  };

  // EXPENSES
  static expense = {
    created: (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: id, userId, newData: data, description: `Expense "${data?.description}" of K${data?.amount} recorded` }),
    deleted: (id: string, data: any, userId?: string) =>
      AuditLogger.log({ action: 'EXPENSE_DELETED', entityType: 'EXPENSE', entityId: id, userId, oldData: data }),
  };

  // USERS
  static user = {
    created:     (id: string, data: any, byUserId?: string) =>
      AuditLogger.log({ action: 'USER_CREATED',      entityType: 'USER', entityId: id, userId: byUserId, newData: { ...data, password: '[REDACTED]' }, description: `User "${data?.name}" created` }),
    updated:     (id: string, old: any, next: any, byUserId?: string) =>
      AuditLogger.log({ action: 'USER_UPDATED',      entityType: 'USER', entityId: id, userId: byUserId, oldData: { ...old, password: '[REDACTED]' }, newData: { ...next, password: '[REDACTED]' } }),
    deleted:     (id: string, data: any, byUserId?: string) =>
      AuditLogger.log({ action: 'USER_DEACTIVATED',  entityType: 'USER', entityId: id, userId: byUserId, description: `User "${data?.name}" deactivated` }),
    loggedIn:    (id: string, ipAddress?: string) =>
      AuditLogger.log({ action: 'AUTH_LOGIN',        entityType: 'USER', entityId: id, userId: id, ipAddress, description: 'User logged in' }),
    loggedOut:   (id: string) =>
      AuditLogger.log({ action: 'AUTH_LOGOUT',       entityType: 'USER', entityId: id, userId: id, description: 'User logged out' }),
    loginFailed: (email: string, ipAddress?: string) =>
      AuditLogger.log({ action: 'AUTH_LOGIN_FAILED', entityType: 'USER', entityId: null, ipAddress, changes: { email }, description: `Failed login attempt for ${email}` }),
    permissionsChanged: (id: string, changes: any, byUserId?: string) =>
      AuditLogger.log({ action: 'USER_PERMISSIONS_CHANGED', entityType: 'USER', entityId: id, userId: byUserId, changes, description: `Permissions updated for user ${id}` }),
  };

  // SETTINGS
  static settings = {
    updated: (key: string, oldVal: any, newVal: any, userId?: string) =>
      AuditLogger.log({ action: 'SETTINGS_UPDATED', entityType: 'SETTINGS', entityId: key, userId, oldData: { value: oldVal }, newData: { value: newVal }, description: `Setting "${key}" changed` }),
  };

  // SYSTEM
  static system = {
    event: (action: string, description: string, data?: any) =>
      AuditLogger.log({ action, entityType: 'SYSTEM', description, changes: data }),
  };
}
