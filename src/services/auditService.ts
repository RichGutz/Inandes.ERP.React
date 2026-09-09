// src/services/auditService.ts
import { supabase } from './supabaseClient';

export interface AuditLogItem {
  id: string | number;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPLOAD' | 'EXPORT' | 'LOGIN' | 'EVENT';
  user_email: string;
  user_name?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  diff_data?: Record<string, { old: any; new: any }> | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface AuthorizedDevice {
  id: string;
  user_email: string;
  device_fingerprint: string;
  device_name: string;
  ip_address: string;
  status: 'APPROVED' | 'PENDING' | 'REVOKED';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  last_access_at: string | null;
}

export const AuditService = {
  /**
   * Obtiene la bitácora de auditoría transaccional
   */
  getAuditLogs: async (params?: { limit?: number; userEmail?: string; action?: string }): Promise<AuditLogItem[]> => {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params?.limit || 300);

    if (params?.userEmail && params.userEmail !== 'ALL') {
      query = query.eq('user_email', params.userEmail);
    }

    if (params?.action && params.action !== 'ALL') {
      query = query.eq('action', params.action);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener audit_logs:', error);
      return [];
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      table_name: d.table_name || 'General',
      record_id: d.record_id || 'N/A',
      action: d.action || 'EVENT',
      user_email: d.user_email || 'sistema@inandes.pe',
      user_name: d.metadata?.user_name || d.user_email?.split('@')[0] || 'Usuario',
      user_role: d.metadata?.user_role || 'Operador',
      ip_address: d.ip_address || '127.0.0.1',
      old_data: d.old_data,
      new_data: d.new_data,
      diff_data: d.diff_data,
      metadata: d.metadata,
      created_at: d.created_at
    }));
  },

  /**
   * Registra un evento de auditoría en la base de datos
   */
  logEvent: async (payload: {
    table_name: string;
    record_id?: string;
    action: string;
    user_email: string;
    old_data?: Record<string, any>;
    new_data?: Record<string, any>;
    diff_data?: Record<string, { old: any; new: any }>;
    metadata?: Record<string, any>;
  }): Promise<void> => {
    try {
      await supabase.from('audit_logs').insert([{
        table_name: payload.table_name,
        record_id: payload.record_id || 'N/A',
        action: payload.action,
        user_email: payload.user_email,
        ip_address: '127.0.0.1',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
        old_data: payload.old_data || null,
        new_data: payload.new_data || null,
        diff_data: payload.diff_data || null,
        metadata: {
          ...payload.metadata,
          timestamp_client: new Date().toISOString()
        }
      }]);
    } catch (e) {
      console.error('Error registrando log de auditoría:', e);
    }
  },

  /**
   * Obtiene la lista de dispositivos registrados en Device Vault
   */
  getDevices: async (): Promise<AuthorizedDevice[]> => {
    const { data, error } = await supabase
      .from('user_authorized_devices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener user_authorized_devices:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Aprueba un dispositivo en Device Vault
   */
  approveDevice: async (deviceId: string, adminEmail: string): Promise<void> => {
    const { error } = await supabase
      .from('user_authorized_devices')
      .update({
        status: 'APPROVED',
        approved_by: adminEmail,
        approved_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (error) throw new Error(error.message);

    await AuditService.logEvent({
      table_name: 'user_authorized_devices',
      record_id: deviceId,
      action: 'UPDATE',
      user_email: adminEmail,
      metadata: { action_detail: 'Dispositivo aprobado en Device Vault', device_id: deviceId }
    });
  },

  /**
   * Revoca un dispositivo en Device Vault
   */
  revokeDevice: async (deviceId: string, adminEmail: string): Promise<void> => {
    const { error } = await supabase
      .from('user_authorized_devices')
      .update({
        status: 'REVOKED',
        approved_by: adminEmail,
        approved_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (error) throw new Error(error.message);

    await AuditService.logEvent({
      table_name: 'user_authorized_devices',
      record_id: deviceId,
      action: 'UPDATE',
      user_email: adminEmail,
      metadata: { action_detail: 'Dispositivo revocado en Device Vault', device_id: deviceId }
    });
  }
};
