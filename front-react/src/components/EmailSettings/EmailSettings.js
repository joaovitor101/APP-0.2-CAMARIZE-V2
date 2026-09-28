import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tokenCamarize');
}

export default function EmailSettings() {
  const [settings, setSettings] = useState({
    notificacoesAtivas: false,
    emailDestinatario: '',
    frequencia: 'diaria',
    horarioEnvio: '08:00',
    alertasCriticos: true,
    resumoDiario: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const token = getToken();
      const res = await axios.get(`${API_URL}/email/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error('Erro ao buscar configurações de email:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = getToken();
      await axios.put(`${API_URL}/email/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setMessage(null);
    try {
      const token = getToken();
      await axios.post(`${API_URL}/email/test`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({ type: 'success', text: 'Email de teste enviado!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao enviar email de teste.' });
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
        Carregando configurações...
      </div>
    );
  }

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '16px',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px',
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    background: '#fff url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e") no-repeat right 12px center / 16px',
    paddingRight: '36px',
  };

  const toggleStyle = (active) => ({
    width: '48px',
    height: '26px',
    borderRadius: '13px',
    background: active ? '#10b981' : '#d1d5db',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    flexShrink: 0,
  });

  const toggleDotStyle = (active) => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#fff',
    position: 'absolute',
    top: '3px',
    left: active ? '25px' : '3px',
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  return (
    <div>
      {/* Message Banner */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          fontSize: '14px',
        }}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {/* Notificações Ativas */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
              Notificações por Email
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              Ativar ou desativar todas as notificações por email
            </p>
          </div>
          <button
            onClick={() => handleChange('notificacoesAtivas', !settings.notificacoesAtivas)}
            style={toggleStyle(settings.notificacoesAtivas)}
            aria-label="Ativar notificações"
          >
            <div style={toggleDotStyle(settings.notificacoesAtivas)} />
          </button>
        </div>
      </div>

      {/* Email Destinatário */}
      <div style={cardStyle}>
        <label style={labelStyle}>Email para notificações</label>
        <input
          type="email"
          style={inputStyle}
          placeholder="seu@email.com"
          value={settings.emailDestinatario}
          onChange={(e) => handleChange('emailDestinatario', e.target.value)}
        />
      </div>

      {/* Frequência e Horário */}
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Frequência</label>
            <select
              style={selectStyle}
              value={settings.frequencia}
              onChange={(e) => handleChange('frequencia', e.target.value)}
            >
              <option value="imediata">Imediata</option>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Horário de envio</label>
            <input
              type="time"
              style={inputStyle}
              value={settings.horarioEnvio}
              onChange={(e) => handleChange('horarioEnvio', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tipos de Notificação */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
          Tipos de Notificação
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Alertas Críticos</span>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              Parâmetros fora dos limites ideais
            </p>
          </div>
          <button
            onClick={() => handleChange('alertasCriticos', !settings.alertasCriticos)}
            style={toggleStyle(settings.alertasCriticos)}
            aria-label="Ativar alertas críticos"
          >
            <div style={toggleDotStyle(settings.alertasCriticos)} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Resumo Diário</span>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              Receber resumo diário dos cativeiros
            </p>
          </div>
          <button
            onClick={() => handleChange('resumoDiario', !settings.resumoDiario)}
            style={toggleStyle(settings.resumoDiario)}
            aria-label="Ativar resumo diário"
          >
            <div style={toggleDotStyle(settings.resumoDiario)} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: saving ? '#93c5fd' : '#3b82f6',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
        <button
          onClick={handleTestEmail}
          style={{
            padding: '12px 20px',
            borderRadius: '10px',
            border: '1px solid #d1d5db',
            background: '#fff',
            color: '#374151',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          📧 Testar Email
        </button>
      </div>
    </div>
  );
}
