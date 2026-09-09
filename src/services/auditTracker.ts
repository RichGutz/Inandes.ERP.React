// src/services/auditTracker.ts
/**
 * Módulo de Trazabilidad y Auditoría de Acciones de Usuario en Frontend
 * Sistema: INANDES ERP & FACTORING
 */

import { AuditService } from './auditService';

export interface AuditEventPayload {
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPLOAD' | 'EXPORT' | 'LOGIN' | 'EVENT';
  tableName: string;
  recordId?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  diffData?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
}

export const AuditTracker = {
  /**
   * Registra un evento de auditoría asíncrono sin bloquear la UI del usuario.
   */
  track: async (payload: AuditEventPayload, userEmail?: string): Promise<void> => {
    try {
      const email = userEmail || 'operador@inandes.pe';
      await AuditService.logEvent({
        table_name: payload.tableName,
        record_id: payload.recordId || 'N/A',
        action: payload.action,
        user_email: email,
        old_data: payload.oldData,
        new_data: payload.newData,
        diff_data: payload.diffData,
        metadata: {
          ...payload.metadata,
          url: typeof window !== 'undefined' ? window.location.hash || window.location.pathname : '',
          timestamp_client: new Date().toISOString()
        }
      });
    } catch (e) {
      console.debug('[AuditTracker] Error registrando auditoría:', e);
    }
  }
};
