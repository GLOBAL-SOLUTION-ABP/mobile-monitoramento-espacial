import React, { useState, useEffect, useRef, useMemo } from 'react';
import StarField from './components/StarField';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Platform, Animated, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitizeText } from './utils/security';
import { encryptData, decryptData } from './utils/crypto';
import { logger } from './utils/logger';
import { useTheme } from './context/ThemeContext';

const KEY = '@alertas_climaticos';
const TOAST_ICONS = { success: 'checkmark-circle', error: 'close-circle', warning: 'alert-circle' };

const SEV_COLORS = { 'Baixo': '#B478F0', 'Médio': '#FB923C', 'Alto': '#F97316', 'Crítico': '#F87171' };

const TIPOS_ALERTA = ['Enchente', 'Seca', 'Queimada', 'Tempestade', 'Múltiplos', 'Outros'];
const SEVERIDADES  = ['Baixo', 'Médio', 'Alto', 'Crítico'];

const SEV_ICONS = {
  'Baixo': 'information-circle-outline',
  'Médio': 'alert-outline',
  'Alto': 'warning-outline',
  'Crítico': 'nuclear-outline',
};

const parseDateBR = (str) => {
  const [d, m, y] = (str || '').split('/').map(Number);
  if (!d || !m || !y || y < 2024) return null;
  return new Date(y, m - 1, d);
};

const dateStatus = (str) => {
  const d = parseDateBR(str);
  if (!d) return { label: str, color: '#CCAAFF' };
  const diff = Math.ceil((d - new Date()) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d atrás`, color: '#CCAAFF' };
  if (diff === 0) return { label: 'Hoje', color: '#F87171' };
  if (diff <= 3) return { label: `em ${diff} dia${diff !== 1 ? 's' : ''}`, color: '#F97316' };
  return { label: str, color: '#B478F0' };
};

export default function Alertas() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const sevBg = useMemo(() => isDark
    ? { 'Baixo': '#0C0018', 'Médio': '#120C00', 'Alto': '#120800', 'Crítico': '#120012' }
    : { 'Baixo': '#F0EAFF', 'Médio': '#FFF7ED', 'Alto': '#FFF4ED', 'Crítico': '#FFF0F5' },
  [isDark]);

  const sevBorder = useMemo(() => isDark
    ? { 'Baixo': '#3A1A6A', 'Médio': '#3A2A00', 'Alto': '#4A1800', 'Crítico': '#5A0828' }
    : { 'Baixo': '#C9B8E8', 'Médio': '#FED7AA', 'Alto': '#FDBA74', 'Crítico': '#FECACA' },
  [isDark]);

  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving]    = useState(false);
  const [filtro, setFiltro]    = useState('resolvidos');

  const [regiao,     setRegiao]     = useState('');
  const [tipo,       setTipo]       = useState('');
  const [severidade, setSeveridade] = useState('');
  const [data,       setData]       = useState('');
  const [descricao,  setDescricao]  = useState('');
  const [fonte,      setFonte]      = useState('');

  const [toast, setToast] = useState({ message: '', type: 'success' });
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = (message, type = 'success') => {
    toastAnim.setValue(0);
    setToast({ message, type });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const toastX = toastAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        try { setAlertas(JSON.parse(decryptData(raw))); }
        catch { try { setAlertas(JSON.parse(raw)); } catch { setAlertas([]); } }
      }
    } catch (_) {}
    setLoading(false);
  };

  const persist = async (list) => {
    await AsyncStorage.setItem(KEY, encryptData(JSON.stringify(list)));
    setAlertas(list);
  };

  const scheduleNotif = async (alerta) => {
    if (Platform.OS === 'web') return null;
    if (alerta.severidade === 'Crítico') {
      try {
        return await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 Alerta Crítico — SatGuard',
            body: `${alerta.tipo} em ${alerta.regiao} — ação imediata necessária.`,
            ...(Platform.OS === 'android' && { channelId: 'default' }),
          },
          trigger: null,
        });
      } catch (_) { return null; }
    }
    const d = parseDateBR(alerta.data);
    if (!d) return null;
    const trigger = new Date(d);
    trigger.setDate(trigger.getDate() - 1);
    if (trigger <= new Date()) return null;
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚠️ Alerta ${alerta.severidade} — SatGuard`,
          body: `${alerta.tipo} em ${alerta.regiao} previsto amanhã.`,
          ...(Platform.OS === 'android' && { channelId: 'default' }),
        },
        trigger,
      });
    } catch (_) { return null; }
  };

  const handleDataChange = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 2) out = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) out = out.slice(0, 5) + '/' + out.slice(5);
    setData(out);
  };

  const resetForm = () => {
    setRegiao(''); setTipo(''); setSeveridade('');
    setData(''); setDescricao(''); setFonte('');
  };

  const handleAdd = async () => {
    if (!regiao.trim())                             { showToast('Informe a região afetada', 'error');     return; }
    if (!tipo)                                      { showToast('Selecione o tipo de alerta', 'error');   return; }
    if (!severidade)                                { showToast('Selecione a severidade', 'error');       return; }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data))       { showToast('Data inválida — use DD/MM/AAAA', 'error'); return; }
    if (!descricao.trim() || descricao.trim().length < 5) { showToast('Descreva o alerta (mín. 5 car.)', 'error'); return; }

    setSaving(true);
    const alerta = {
      id:         String(Date.now()),
      regiao:     sanitizeText(regiao.trim()),
      tipo,
      severidade,
      data,
      descricao:  sanitizeText(descricao.trim()),
      fonte:      sanitizeText(fonte.trim()) || 'Sentinel-2 / INPE',
      criadoEm:  Date.now(),
      status:     'ativo',
    };
    const notifId = await scheduleNotif(alerta);
    if (notifId) alerta.notifId = notifId;

    await persist([alerta, ...alertas]);
    logger.audit('ALERTA_CRIADO', { tipo: alerta.tipo, severidade: alerta.severidade, regiao: alerta.regiao });
    showToast(`Alerta ${alerta.severidade} criado para ${alerta.regiao}!`, 'success');
    resetForm();
    setModalVisible(false);
    setSaving(false);
  };

  const handleResolver = async (id) => {
    const al = alertas.find(a => a.id === id);
    if (al?.notifId) {
      try { await Notifications.cancelScheduledNotificationAsync(al.notifId); } catch (_) {}
    }
    await persist(alertas.map(a =>
      a.id === id ? { ...a, status: 'resolvido', resolvidoEm: Date.now() } : a
    ));
    logger.audit('ALERTA_RESOLVIDO', { id, tipo: al?.tipo, regiao: al?.regiao });
    showToast('Alerta marcado como resolvido.', 'success');
  };

  const handleDescartar = async (id) => {
    const al = alertas.find(a => a.id === id);
    if (al?.notifId) {
      try { await Notifications.cancelScheduledNotificationAsync(al.notifId); } catch (_) {}
    }
    await persist(alertas.map(a =>
      a.id === id ? { ...a, status: 'descartado', descartadoEm: Date.now() } : a
    ));
    logger.audit('ALERTA_DESCARTADO', { id, tipo: al?.tipo });
    showToast('Alerta descartado.', 'warning');
  };

  const ativos      = alertas.filter(a => !a.status || a.status === 'ativo');
  const resolvidos  = alertas.filter(a => a.status === 'resolvido');
  const descartados = alertas.filter(a => a.status === 'descartado');
  const temHistorico = resolvidos.length > 0 || descartados.length > 0;

  const criticos = ativos.filter(a => a.severidade === 'Crítico').length;
  const historicoFiltrado = filtro === 'resolvidos' ? resolvidos : descartados;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Carregando alertas...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StarField color={colors.starColor} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { marginRight: 6 }]}>
            <Ionicons name="warning-outline" size={20} color={colors.accent} />
            <Text style={styles.kpiValue}>{ativos.length}</Text>
            <Text style={styles.kpiLabel}>Ativos</Text>
          </View>
          <View style={[styles.kpiCard, { marginHorizontal: 6, borderColor: criticos > 0 ? colors.borderDanger : colors.border }]}>
            <Ionicons name="nuclear-outline" size={20} color="#F87171" />
            <Text style={[styles.kpiValue, { color: '#F87171' }]}>{criticos}</Text>
            <Text style={styles.kpiLabel}>Críticos</Text>
          </View>
          <View style={[styles.kpiCard, { marginLeft: 6 }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.textGreen} />
            <Text style={[styles.kpiValue, { color: colors.textGreen }]}>{resolvidos.length}</Text>
            <Text style={styles.kpiLabel}>Resolvidos</Text>
          </View>
        </View>

        {/* Escala de Severidade */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart-outline" size={17} color={colors.accent} />
            <Text style={styles.cardTitle}>Escala de Severidade</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sevRow}>
            {SEVERIDADES.map(sev => (
              <View key={sev} style={[styles.sevTile, { borderColor: SEV_COLORS[sev] }]}>
                <Ionicons name={SEV_ICONS[sev]} size={20} color={SEV_COLORS[sev]} />
                <Text style={[styles.sevLabel, { color: SEV_COLORS[sev] }]}>{sev}</Text>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.sevNote}>
            Alertas críticos disparam notificação imediata. Demais alertas notificam 1 dia antes da data prevista.
          </Text>
        </View>

        {/* Lista de alertas ativos */}
        {ativos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={44} color={colors.border} />
            <Text style={styles.emptyTitle}>Nenhum alerta ativo</Text>
            <Text style={styles.emptySubtitle}>Registre um novo alerta climático para acompanhar em tempo real</Text>
          </View>
        ) : ativos.map(al => {
          const sevColor = SEV_COLORS[al.severidade] || colors.accent;
          const currentSevBg = sevBg[al.severidade] || colors.bgDeep;
          const status = dateStatus(al.data);

          return (
            <View key={al.id} style={[styles.stripeCard, { borderLeftColor: sevColor }]}>
              <View style={styles.stripeHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.stripeRegiao} numberOfLines={1}>{al.regiao}</Text>
                  <Text style={styles.stripeTipo}>{al.tipo}</Text>
                </View>
                <View style={[styles.sevChip, { borderColor: sevColor, backgroundColor: currentSevBg }]}>
                  <Ionicons name={SEV_ICONS[al.severidade] || 'warning-outline'} size={11} color={sevColor} />
                  <Text style={[styles.sevChipText, { color: sevColor }]}>{al.severidade.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.stripeMeta}>
                <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
                <Text style={[styles.stripeDate, { color: status.color }]}>{status.label}</Text>
                <View style={styles.metaDot} />
                <Ionicons name="satellite-outline" size={11} color={colors.textMuted} />
                <Text style={styles.stripeSrc} numberOfLines={1}>{al.fonte}</Text>
              </View>

              <Text style={styles.stripeDesc} numberOfLines={2}>{al.descricao}</Text>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.btnResolver} onPress={() => handleResolver(al.id)} activeOpacity={0.8}>
                  <Ionicons name="checkmark-circle-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.btnResolverText}>Resolver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDescartar} onPress={() => handleDescartar(al.id)} activeOpacity={0.8}>
                  <Ionicons name="close-circle-outline" size={15} color="#F87171" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Histórico */}
        {temHistorico && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={17} color={colors.accent} />
              <Text style={styles.cardTitle}>Histórico de Alertas</Text>
            </View>

            <View style={styles.filtroRow}>
              <TouchableOpacity
                style={[styles.filtroBtn, filtro === 'resolvidos' && styles.filtroBtnResolvido]}
                onPress={() => setFiltro('resolvidos')}
                activeOpacity={0.75}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color={filtro === 'resolvidos' ? '#FFFFFF' : colors.textSecondary} />
                <Text style={[styles.filtroBtnText, filtro === 'resolvidos' && styles.filtroBtnTextAtivo]}>
                  Resolvidos ({resolvidos.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filtroBtn, filtro === 'descartados' && styles.filtroBtnDescartado]}
                onPress={() => setFiltro('descartados')}
                activeOpacity={0.75}
              >
                <Ionicons name="close-circle-outline" size={14} color={filtro === 'descartados' ? '#FFFFFF' : colors.textSecondary} />
                <Text style={[styles.filtroBtnText, filtro === 'descartados' && styles.filtroBtnTextAtivo]}>
                  Descartados ({descartados.length})
                </Text>
              </TouchableOpacity>
            </View>

            {historicoFiltrado.length === 0 ? (
              <Text style={styles.historicoVazio}>
                Nenhum alerta {filtro === 'resolvidos' ? 'resolvido' : 'descartado'}
              </Text>
            ) : historicoFiltrado.map((al, idx) => {
              const sevColor = SEV_COLORS[al.severidade] || colors.accent;
              const isResolvido = al.status === 'resolvido';
              return (
                <View key={al.id} style={[styles.historicoItem, idx === 0 && { borderTopWidth: 0, paddingTop: 0, marginTop: 0 }]}>
                  <View style={styles.alHeader}>
                    <View style={[styles.alIconBox, isResolvido ? styles.alIconBoxResolvido : styles.alIconBoxDescartado]}>
                      <Ionicons
                        name={isResolvido ? 'checkmark-circle-outline' : 'close-circle-outline'}
                        size={18}
                        color={isResolvido ? colors.textGreen : '#F87171'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alRegiao}>{al.regiao}</Text>
                      <Text style={styles.alTipo}>{al.tipo}</Text>
                    </View>
                    <View style={[styles.sevBadge, { borderColor: sevColor }]}>
                      <Text style={[styles.sevBadgeText, { color: sevColor }]}>{al.severidade}</Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.infoText}>{al.data}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="document-text-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.infoText} numberOfLines={2}>{al.descricao}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Botões */}
        <TouchableOpacity style={styles.botaoPrimario} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.textoBotao}>Registrar Alerta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botaoSecundario} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="arrow-back-outline" size={18} color={colors.accent} />
          <Text style={styles.textoBotaoSec}>Voltar</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modal novo alerta */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom + 16, 20) }]}>

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Alerta Climático</Text>
                <TouchableOpacity onPress={() => { resetForm(); setModalVisible(false); }}>
                  <Ionicons name="close-circle-outline" size={26} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>REGIÃO AFETADA</Text>
                  <TextInput
                    style={styles.input}
                    value={regiao}
                    onChangeText={setRegiao}
                    placeholder="ex: Vale do Paraíba — SP"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="words"
                    maxLength={80}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>TIPO DE EVENTO</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {TIPOS_ALERTA.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chipBtn, tipo === t && styles.chipBtnAtivo]}
                        onPress={() => setTipo(t)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.chipText, tipo === t && styles.chipTextAtivo]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>SEVERIDADE</Text>
                  <View style={styles.sevPickerRow}>
                    {SEVERIDADES.map(sev => (
                      <TouchableOpacity
                        key={sev}
                        style={[
                          styles.sevPickerBtn,
                          { borderColor: SEV_COLORS[sev] },
                          severidade === sev && { backgroundColor: sevBg[sev] },
                        ]}
                        onPress={() => setSeveridade(sev)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.sevPickerText, { color: SEV_COLORS[sev] }]}>{sev}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DATA PREVISTA (DD/MM/AAAA)</Text>
                  <TextInput
                    style={styles.input}
                    value={data}
                    onChangeText={handleDataChange}
                    placeholder="ex: 15/06/2026"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DESCRIÇÃO DO EVENTO</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={descricao}
                    onChangeText={setDescricao}
                    placeholder="Descreva o evento climático e seus impactos esperados..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    maxLength={200}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FONTE DOS DADOS</Text>
                  <TextInput
                    style={styles.input}
                    value={fonte}
                    onChangeText={setFonte}
                    placeholder="ex: Sentinel-2 / INPE (padrão)"
                    placeholderTextColor={colors.placeholder}
                    maxLength={80}
                  />
                </View>

                {severidade ? (
                  <View style={[styles.previewCard, { borderColor: sevBorder[severidade], backgroundColor: sevBg[severidade] }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={SEV_ICONS[severidade]} size={24} color={SEV_COLORS[severidade]} />
                      <View>
                        <Text style={[styles.previewSev, { color: SEV_COLORS[severidade] }]}>Alerta {severidade}</Text>
                        {severidade === 'Crítico' && (
                          <Text style={styles.previewNote}>Notificação imediata ao criar</Text>
                        )}
                        {severidade !== 'Crítico' && (
                          <Text style={styles.previewNote}>Notificação 1 dia antes da data</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.botaoPrimario, saving && { opacity: 0.6 }]}
                  onPress={handleAdd}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Ionicons name="warning-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.textoBotao}>{saving ? 'Salvando...' : 'Criar Alerta'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Animated.View
        style={[
          styles.toast,
          toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastWarning,
          { opacity: toastAnim, transform: [{ translateX: toastX }] },
        ]}
        pointerEvents="none"
      >
        <Ionicons name={TOAST_ICONS[toast.type]} size={18} color="#FFFFFF" />
        <Text style={styles.toastText}>{toast.message}</Text>
      </Animated.View>

    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.bg, padding: 16 },
  centered:    { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: c.textSecondary, fontSize: 14 },

  kpiRow: { flexDirection: 'row', marginBottom: 14 },
  kpiCard: {
    flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: c.border,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, gap: 4,
  },
  kpiValue: { color: c.textPrimary, fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  kpiLabel: { color: c.textSecondary, fontSize: 10, textAlign: 'center', letterSpacing: 0.4 },

  card: {
    backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: c.border,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.borderFaint,
  },
  cardTitle: { color: c.textPrimary, fontSize: 15, fontWeight: 'bold' },

  sevRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sevTile: {
    width: 72, alignItems: 'center', paddingVertical: 10,
    backgroundColor: c.bgDeep, borderRadius: 10, borderWidth: 1, gap: 6,
  },
  sevLabel: { fontSize: 11, fontWeight: '700' },
  sevNote:  { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },

  emptyState:    { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle:    { color: c.textPrimary, fontSize: 16, fontWeight: 'bold' },
  emptySubtitle: { color: c.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  alHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  alIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: c.bgDeep,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    borderWidth: 1, borderColor: c.border,
  },
  alIconBoxResolvido: { backgroundColor: '#05100A', borderColor: '#0D4020' },
  alIconBoxDescartado: { backgroundColor: c.bgDanger, borderColor: c.borderDanger },
  alRegiao: { color: c.textPrimary, fontSize: 15, fontWeight: 'bold' },
  alTipo:   { color: c.textSecondary, fontSize: 12, marginTop: 2 },

  stripeCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
    borderLeftWidth: 4,
  },
  stripeHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  stripeRegiao: { fontSize: 15, fontWeight: 'bold', color: c.textPrimary, marginBottom: 2 },
  stripeTipo:   { fontSize: 11, color: c.textSecondary },
  sevChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  sevChipText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  stripeMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  stripeDate: { fontSize: 11, fontWeight: '600' },
  metaDot:    { width: 3, height: 3, borderRadius: 2, backgroundColor: c.borderFaint },
  stripeSrc:  { fontSize: 10, color: c.textMuted, flex: 1 },
  stripeDesc: { fontSize: 12, color: c.textSecondary, lineHeight: 17, marginBottom: 12 },

  sevBadge:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: c.bgDeep },
  sevBadgeText: { fontSize: 11, fontWeight: 'bold' },

  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  infoText: { color: c.textSecondary, fontSize: 13, flex: 1 },

  cardActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnResolver: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D4020', paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  btnResolverText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  btnDescartar: {
    width: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.borderDanger, borderRadius: 10, backgroundColor: c.bgDanger,
  },

  filtroRow:          { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filtroBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9, backgroundColor: c.bgDeep, borderWidth: 1, borderColor: c.border },
  filtroBtnResolvido: { backgroundColor: '#05100A', borderColor: '#4ADE80' },
  filtroBtnDescartado:{ backgroundColor: c.bgDanger, borderColor: '#F87171' },
  filtroBtnText:      { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  filtroBtnTextAtivo: { color: '#FFFFFF' },
  historicoVazio:     { color: c.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  historicoItem:      { borderTopWidth: 1, borderTopColor: c.borderFaint, paddingTop: 14, marginTop: 14 },

  botaoPrimario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.accentBtn, paddingVertical: 15, borderRadius: 12,
    gap: 8, marginBottom: 12, elevation: 6,
    shadowColor: c.accentBtn, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8,
  },
  botaoSecundario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: c.border,
    gap: 8, marginBottom: 32,
  },
  textoBotao:    { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  textoBotaoSec: { color: c.accent, fontWeight: 'bold', fontSize: 16 },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '92%', borderWidth: 1, borderColor: c.border,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.borderFaint,
  },
  modalTitle: { color: c.textPrimary, fontSize: 17, fontWeight: 'bold' },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, color: c.textSecondary, fontWeight: '700', letterSpacing: 1.2, marginBottom: 7 },
  input: {
    backgroundColor: c.bgDeep, color: c.textPrimary, borderRadius: 10,
    paddingHorizontal: 14, height: 48, fontSize: 15,
    borderWidth: 1, borderColor: c.border,
  },

  chipBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9,
    backgroundColor: c.bgDeep, borderWidth: 1, borderColor: c.border,
  },
  chipBtnAtivo:  { backgroundColor: c.cardElevated, borderColor: c.accent },
  chipText:      { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextAtivo: { color: c.textPrimary },

  sevPickerRow: { flexDirection: 'row', gap: 8 },
  sevPickerBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9,
    borderWidth: 1, backgroundColor: c.bgDeep,
  },
  sevPickerText: { fontSize: 12, fontWeight: '700' },

  previewCard: {
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1,
  },
  previewSev:  { fontSize: 16, fontWeight: 'bold' },
  previewNote: { color: c.textSecondary, fontSize: 12, marginTop: 2 },

  toast: {
    position: 'absolute', bottom: 28, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    maxWidth: '85%', elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  toastSuccess: { backgroundColor: '#0D5020' },
  toastError:   { backgroundColor: '#5A0A1A' },
  toastWarning: { backgroundColor: '#5A1A00' },
  toastText:    { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
});
