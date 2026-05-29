import React, { useState, useEffect, useRef } from 'react';
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

const KEY          = '@agendamentos';
const FATOR_MERCADO = 0.93;
const TOAST_ICONS  = { success: 'checkmark-circle', error: 'close-circle', warning: 'alert-circle' };

const getDesconto = (visitas) => Math.min(Math.floor(Number(visitas) || 0) * 5, 30);

const fmtR = (v = 0) =>
  v >= 1000 ? `R$${(v / 1000).toFixed(1).replace('.', ',')} mil` : `R$${v.toFixed(0)}`;

const parseDateBR = (str) => {
  const [d, m, y] = (str || '').split('/').map(Number);
  if (!d || !m || !y || y < 2024) return null;
  return new Date(y, m - 1, d);
};

const dateStatus = (str) => {
  const d = parseDateBR(str);
  if (!d) return { label: str, color: '#8FBAD8' };
  const diff = Math.ceil((d - new Date()) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d em atraso`, color: '#E05A5A' };
  if (diff <= 7) return { label: `em ${diff} dia${diff !== 1 ? 's' : ''}`, color: '#E0A85A' };
  return { label: str, color: '#4A9FE0' };
};

const TIER_LABELS = ['1ª volta\n(5%)', '2ª volta\n(10%)', '3ª volta\n(15%)', '4ª volta\n(20%)', '6ª+volta\n(30%)'];
const TIER_VISITS = [1, 2, 3, 4, 6];

export default function Fidelidade() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState('realizadas');

  const [cliente, setCliente] = useState('');
  const [veiculo, setVeiculo] = useState('');
  const [servico, setServico] = useState('');
  const [custo,   setCusto]   = useState('');
  const [data,    setData]    = useState('');
  const [visitas, setVisitas] = useState('0');

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
        try { setAgendamentos(JSON.parse(decryptData(raw))); }
        catch { try { setAgendamentos(JSON.parse(raw)); } catch { setAgendamentos([]); } }
      }
    } catch (_) {}
    setLoading(false);
  };

  const persist = async (list) => {
    await AsyncStorage.setItem(KEY, encryptData(JSON.stringify(list)));
    setAgendamentos(list);
  };

  const scheduleNotif = async (ag) => {
    if (Platform.OS === 'web') return null;
    const d = parseDateBR(ag.data);
    if (!d) return null;
    const trigger = new Date(d);
    trigger.setDate(trigger.getDate() - 2);
    if (trigger <= new Date()) return null;
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔧 Revisão Ford se aproxima!',
          body: `${ag.cliente} — ${ag.servico} em 2 dias. Desconto de ${getDesconto(ag.visitas)}%!`,
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
    setCliente(''); setVeiculo(''); setServico('');
    setCusto(''); setData(''); setVisitas('0');
  };

  const handleAdd = async () => {
    if (!cliente.trim())                           { showToast('Informe o nome do cliente', 'error');        return; }
    if (!veiculo.trim())                           { showToast('Informe o veículo', 'error');                return; }
    if (!servico.trim())                           { showToast('Informe o próximo serviço', 'error');        return; }
    const custoNum = parseFloat(custo.replace(',', '.'));
    if (!custo || isNaN(custoNum) || custoNum <= 0){ showToast('Informe o custo estimado (ex: 350)', 'error'); return; }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data))      { showToast('Data inválida — use DD/MM/AAAA', 'error');   return; }

    setSaving(true);
    const ag = {
      id: String(Date.now()),
      cliente:   sanitizeText(cliente.trim()),
      veiculo:   sanitizeText(veiculo.trim()),
      servico:   sanitizeText(servico.trim()),
      custoFord: custoNum,
      data,
      visitas:   parseInt(visitas, 10) || 0,
      criadoEm:  Date.now(),
      status:    'pendente',
    };
    const notifId = await scheduleNotif(ag);
    if (notifId) ag.notifId = notifId;

    await persist([ag, ...agendamentos]);
    logger.audit('RETORNO_AGENDADO', { servico: ag.servico, data: ag.data, visitas: ag.visitas });
    showToast(`Retorno de ${ag.cliente} agendado!`, 'success');
    resetForm();
    setModalVisible(false);
    setSaving(false);
  };

  const handleConcluir = async (id) => {
    const ag = agendamentos.find(a => a.id === id);
    if (ag?.notifId) {
      try { await Notifications.cancelScheduledNotificationAsync(ag.notifId); } catch (_) {}
    }
    await persist(agendamentos.map(a =>
      a.id === id ? { ...a, status: 'concluida', concluidoEm: Date.now() } : a
    ));
    logger.audit('VISITA_CONCLUIDA', { id, servico: ag?.servico, data: ag?.data });
    showToast('Visita concluída! Cliente fidelizado.', 'success');
  };

  const handleCancelar = async (id) => {
    const ag = agendamentos.find(a => a.id === id);
    if (ag?.notifId) {
      try { await Notifications.cancelScheduledNotificationAsync(ag.notifId); } catch (_) {}
    }
    await persist(agendamentos.map(a =>
      a.id === id ? { ...a, status: 'cancelada', canceladoEm: Date.now() } : a
    ));
    logger.audit('AGENDAMENTO_CANCELADO', { id, servico: ag?.servico, data: ag?.data });
    showToast('Agendamento cancelado', 'warning');
  };

  // ── Derived lists ──────────────────────────────────────────────────────────
  const pendentes  = agendamentos.filter(a => !a.status || a.status === 'pendente');
  const concluidas = agendamentos.filter(a => a.status === 'concluida');
  const canceladas = agendamentos.filter(a => a.status === 'cancelada');
  const temHistorico = concluidas.length > 0 || canceladas.length > 0;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const agendados = pendentes.filter(a => { const d = parseDateBR(a.data); return !d || d >= hoje; }).length;

  const totalEconomizado = concluidas.reduce((s, a) => s + a.custoFord * (getDesconto(a.visitas) / 100), 0);
  const receitaFord      = concluidas.reduce((s, a) => s + a.custoFord * (1 - getDesconto(a.visitas) / 100), 0);

  const historicoFiltrado = filtroHistorico === 'realizadas' ? concluidas : canceladas;

  // ── Form preview ───────────────────────────────────────────────────────────
  const previewCustoNum = parseFloat(custo.replace(',', '.'));
  const previewVisitas  = parseInt(visitas, 10) || 0;
  const previewDesconto = getDesconto(previewVisitas);
  const showPreview     = !isNaN(previewCustoNum) && previewCustoNum > 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A9FE0" />
        <Text style={styles.loadingText}>Carregando fidelidade...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { marginRight: 6 }]}>
            <Ionicons name="calendar-outline" size={20} color="#4A9FE0" />
            <Text style={styles.kpiValue}>{agendados}</Text>
            <Text style={styles.kpiLabel}>Agendados</Text>
          </View>
          <View style={[styles.kpiCard, { marginHorizontal: 6 }]}>
            <Ionicons name="trending-down-outline" size={20} color="#4AE07A" />
            <Text style={[styles.kpiValue, { color: '#4AE07A' }]}>{fmtR(totalEconomizado)}</Text>
            <Text style={styles.kpiLabel}>Economizado</Text>
          </View>
          <View style={[styles.kpiCard, { marginLeft: 6 }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#4A9FE0" />
            <Text style={styles.kpiValue}>{fmtR(receitaFord)}</Text>
            <Text style={styles.kpiLabel}>Receita Ford</Text>
          </View>
        </View>

        {/* ── Tier de descontos ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="ribbon-outline" size={17} color="#4A9FE0" />
            <Text style={styles.cardTitle}>Programa de Fidelidade</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiersRow}>
            {TIER_VISITS.map((v, i) => {
              const desc = getDesconto(v);
              const max  = desc === 30;
              return (
                <View key={i} style={[styles.tier, max && styles.tierMax]}>
                  <Text style={[styles.tierDiscount, max && styles.tierDiscountMax]}>{desc}%</Text>
                  <Text style={styles.tierLabel}>{TIER_LABELS[i]}</Text>
                </View>
              );
            })}
          </ScrollView>
          <Text style={styles.tierNote}>
            A cada visita concluída, o desconto cresce 5% — chegando a 30% na 6ª visita.
          </Text>
        </View>

        {/* ── Lista de pendentes ────────────────────────────────────────────── */}
        {pendentes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={44} color="#1A4A7A" />
            <Text style={styles.emptyTitle}>Nenhum retorno pendente</Text>
            <Text style={styles.emptySubtitle}>Agende o retorno de um cliente para ativar o programa de fidelidade</Text>
          </View>
        ) : pendentes.map(ag => {
          const desconto         = getDesconto(ag.visitas);
          const custoMercado     = ag.custoFord * FATOR_MERCADO;
          const custoDesconto    = ag.custoFord * (1 - desconto / 100);
          const economiaDesconto = ag.custoFord - custoDesconto;
          const melhorMercado    = custoDesconto < custoMercado;
          const economiaMercado  = custoMercado - custoDesconto;
          const status           = dateStatus(ag.data);

          return (
            <View key={ag.id} style={styles.card}>
              <View style={styles.agHeader}>
                <View style={styles.agIconBox}>
                  <Ionicons name="person-outline" size={18} color="#4A9FE0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agCliente}>{ag.cliente}</Text>
                  <Text style={styles.agVeiculo}>{ag.veiculo}</Text>
                </View>
                <View style={[styles.discBadge, desconto >= 25 && styles.discBadgeHigh]}>
                  <Text style={styles.discBadgeText}>-{desconto}%</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="build-outline" size={13} color="#8FBAD8" />
                <Text style={styles.infoText}>{ag.servico}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={13} color="#8FBAD8" />
                <Text style={[styles.infoText, { color: status.color }]}>{status.label}</Text>
                <Text style={styles.visitasText}> · {ag.visitas} visita{ag.visitas !== 1 ? 's' : ''} anteriores</Text>
              </View>

              <View style={styles.comparativo}>
                <Text style={styles.comparativoTitle}>Comparativo de Custo</Text>
                <View style={styles.compRow}>
                  <View style={styles.compLabelBox}>
                    <Ionicons name="storefront-outline" size={12} color="#8FBAD8" />
                    <Text style={styles.compLabel}>Mercado (est.)</Text>
                  </View>
                  <Text style={styles.compValor}>{fmtR(custoMercado)}</Text>
                </View>
                <View style={styles.compRow}>
                  <View style={styles.compLabelBox}>
                    <Ionicons name="business-outline" size={12} color="#8FBAD8" />
                    <Text style={styles.compLabel}>Ford (tabela)</Text>
                  </View>
                  <Text style={[styles.compValor, styles.compRiscado]}>{fmtR(ag.custoFord)}</Text>
                </View>
                <View style={[styles.compRow, styles.compDestaque]}>
                  <View style={styles.compLabelBox}>
                    <Ionicons name="pricetag-outline" size={12} color="#4A9FE0" />
                    <Text style={[styles.compLabel, { color: '#4A9FE0', fontWeight: '700' }]}>Ford + fidelidade</Text>
                  </View>
                  <Text style={styles.compValorDestaque}>{fmtR(custoDesconto)}</Text>
                </View>
                {melhorMercado ? (
                  <View style={styles.bannerVerde}>
                    <Ionicons name="trending-down-outline" size={14} color="#4AE07A" />
                    <Text style={styles.bannerVerdeText}>
                      Mais barato que o mercado! Você economiza {fmtR(economiaMercado)} vs. oficina independente.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.bannerAzul}>
                    <Ionicons name="pricetag-outline" size={14} color="#4A9FE0" />
                    <Text style={styles.bannerAzulText}>
                      Economia de {fmtR(economiaDesconto)} vs. preço cheio Ford.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.btnConcluir} onPress={() => handleConcluir(ag.id)} activeOpacity={0.8}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.btnConcluirText}>Concluído</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCancelar} onPress={() => handleCancelar(ag.id)} activeOpacity={0.8}>
                  <Ionicons name="close-circle-outline" size={16} color="#E05A5A" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* ── Histórico de Visitas ──────────────────────────────────────────── */}
        {temHistorico && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={17} color="#4A9FE0" />
              <Text style={styles.cardTitle}>Histórico de Visitas</Text>
            </View>

            {/* Filtro */}
            <View style={styles.filtroRow}>
              <TouchableOpacity
                style={[styles.filtroBtn, filtroHistorico === 'realizadas' && styles.filtroBtnRealizada]}
                onPress={() => setFiltroHistorico('realizadas')}
                activeOpacity={0.75}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color={filtroHistorico === 'realizadas' ? '#FFFFFF' : '#8FBAD8'} />
                <Text style={[styles.filtroBtnText, filtroHistorico === 'realizadas' && styles.filtroBtnTextAtivo]}>
                  Realizadas ({concluidas.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filtroBtn, filtroHistorico === 'canceladas' && styles.filtroBtnCancelada]}
                onPress={() => setFiltroHistorico('canceladas')}
                activeOpacity={0.75}
              >
                <Ionicons name="close-circle-outline" size={14} color={filtroHistorico === 'canceladas' ? '#FFFFFF' : '#8FBAD8'} />
                <Text style={[styles.filtroBtnText, filtroHistorico === 'canceladas' && styles.filtroBtnTextAtivo]}>
                  Canceladas ({canceladas.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Itens do histórico */}
            {historicoFiltrado.length === 0 ? (
              <Text style={styles.historicoVazio}>
                Nenhuma visita {filtroHistorico === 'realizadas' ? 'realizada' : 'cancelada'}
              </Text>
            ) : historicoFiltrado.map((ag, idx) => {
              const desconto   = getDesconto(ag.visitas);
              const valorFinal = ag.custoFord * (1 - desconto / 100);
              const economia   = ag.custoFord * (desconto / 100);
              const isConcluida = ag.status === 'concluida';

              return (
                <View key={ag.id} style={[styles.historicoItem, idx === 0 && { borderTopWidth: 0, paddingTop: 0, marginTop: 0 }]}>
                  <View style={styles.agHeader}>
                    <View style={[styles.agIconBox, isConcluida ? styles.agIconBoxConcluida : styles.agIconBoxCancelada]}>
                      <Ionicons
                        name={isConcluida ? 'checkmark-circle-outline' : 'close-circle-outline'}
                        size={18}
                        color={isConcluida ? '#4AE07A' : '#E05A5A'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.agCliente}>{ag.cliente}</Text>
                      <Text style={styles.agVeiculo}>{ag.veiculo}</Text>
                    </View>
                    <View style={[styles.discBadge, isConcluida && styles.discBadgeConcluida]}>
                      <Text style={[styles.discBadgeText, isConcluida && { color: '#4AE07A' }]}>-{desconto}%</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="build-outline" size={13} color="#8FBAD8" />
                    <Text style={styles.infoText}>{ag.servico}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={13} color="#8FBAD8" />
                    <Text style={styles.infoText}>{ag.data}</Text>
                  </View>

                  {isConcluida && (
                    <View style={[styles.compDestaque, { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                      <Text style={[styles.compLabel, { color: '#4A9FE0', fontWeight: '700' }]}>Ford + fidelidade</Text>
                      <Text style={styles.compValorDestaque}>{fmtR(valorFinal)}</Text>
                    </View>
                  )}
                  {isConcluida && economia > 0 && (
                    <View style={styles.infoRow}>
                      <Ionicons name="trending-down-outline" size={13} color="#4AE07A" />
                      <Text style={[styles.infoText, { color: '#4AE07A' }]}>Cliente economizou {fmtR(economia)}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Botões ───────────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.botaoPrimario} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.textoBotao}>Agendar Retorno</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botaoSecundario} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="arrow-back-outline" size={18} color="#4A9FE0" />
          <Text style={styles.textoBotaoSec}>Voltar</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Modal de agendamento ─────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom + 16, 20) }]}>

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agendar Retorno</Text>
                <TouchableOpacity onPress={() => { resetForm(); setModalVisible(false); }}>
                  <Ionicons name="close-circle-outline" size={26} color="#8FBAD8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {[
                  { label: 'CLIENTE',            value: cliente, setter: setCliente, placeholder: 'ex: João Silva',    keyboard: 'default',     cap: 'words',     max: 60  },
                  { label: 'VEÍCULO',             value: veiculo, setter: setVeiculo, placeholder: 'ex: Ford Ka 2018', keyboard: 'default',     cap: 'words',     max: 60  },
                  { label: 'PRÓXIMO SERVIÇO',     value: servico, setter: setServico, placeholder: 'ex: Troca de óleo',keyboard: 'default',     cap: 'sentences', max: 100 },
                  { label: 'CUSTO ESTIMADO (R$)', value: custo,   setter: setCusto,   placeholder: 'ex: 350',          keyboard: 'decimal-pad', cap: 'none',      max: 10  },
                ].map(({ label, value, setter, placeholder, keyboard, cap, max }) => (
                  <View key={label} style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{label}</Text>
                    <TextInput
                      style={styles.input}
                      value={value}
                      onChangeText={setter}
                      placeholder={placeholder}
                      placeholderTextColor="#2A4A6A"
                      keyboardType={keyboard}
                      autoCapitalize={cap}
                      maxLength={max}
                    />
                  </View>
                ))}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DATA (DD/MM/AAAA)</Text>
                  <TextInput
                    style={styles.input}
                    value={data}
                    onChangeText={handleDataChange}
                    placeholder="ex: 20/08/2026"
                    placeholderTextColor="#2A4A6A"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>VISITAS ANTERIORES</Text>
                  <TextInput
                    style={styles.input}
                    value={visitas}
                    onChangeText={setVisitas}
                    placeholder="0"
                    placeholderTextColor="#2A4A6A"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Preview do desconto</Text>
                  <View style={styles.previewDiscRow}>
                    <Ionicons name="ribbon-outline" size={22} color={previewDesconto >= 25 ? '#4AE07A' : '#4A9FE0'} />
                    <Text style={[styles.previewDisc, previewDesconto >= 25 && { color: '#4AE07A' }]}>
                      {previewDesconto}% de desconto
                    </Text>
                  </View>
                  {showPreview && (
                    <View style={{ marginTop: 10, gap: 6 }}>
                      <View style={styles.compRow}>
                        <Text style={styles.compLabel}>Mercado (est.)</Text>
                        <Text style={styles.compValor}>{fmtR(previewCustoNum * FATOR_MERCADO)}</Text>
                      </View>
                      <View style={styles.compRow}>
                        <Text style={styles.compLabel}>Ford (tabela)</Text>
                        <Text style={[styles.compValor, styles.compRiscado]}>{fmtR(previewCustoNum)}</Text>
                      </View>
                      <View style={[styles.compRow, styles.compDestaque]}>
                        <Text style={[styles.compLabel, { color: '#4A9FE0', fontWeight: '700' }]}>Ford + fidelidade</Text>
                        <Text style={styles.compValorDestaque}>
                          {fmtR(previewCustoNum * (1 - previewDesconto / 100))}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.botaoPrimario, saving && { opacity: 0.6 }]}
                  onPress={handleAdd}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.textoBotao}>{saving ? 'Salvando...' : 'Confirmar Agendamento'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Toast */}
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

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#001E3C', padding: 16 },
  centered:    { flex: 1, backgroundColor: '#001E3C', alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: '#8FBAD8', fontSize: 14 },

  kpiRow: { flexDirection: 'row', marginBottom: 14 },
  kpiCard: {
    flex: 1, backgroundColor: '#002B5C', borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#1A4A7A',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, gap: 4,
  },
  kpiValue: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  kpiLabel: { color: '#8FBAD8', fontSize: 10, textAlign: 'center', letterSpacing: 0.4 },

  card: {
    backgroundColor: '#002B5C', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#1A4A7A',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1A3A5C' },
  cardTitle:  { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  tiersRow:        { flexDirection: 'row', marginBottom: 12, gap: 6 },
  tier:            { width: 90, alignItems: 'center', backgroundColor: '#001A38', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, borderWidth: 1, borderColor: '#1A4A7A' },
  tierMax:         { borderColor: '#4AE07A', backgroundColor: '#00261A' },
  tierDiscount:    { color: '#4A9FE0', fontSize: 16, fontWeight: 'bold' },
  tierDiscountMax: { color: '#4AE07A' },
  tierLabel:       { color: '#8FBAD8', fontSize: 9, textAlign: 'center', marginTop: 4, lineHeight: 13 },
  tierNote:        { color: '#8FBAD8', fontSize: 12, lineHeight: 18, marginTop: 4 },

  emptyState:    { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle:    { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  emptySubtitle: { color: '#8FBAD8', fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  agHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  agIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0D3A6B', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  agIconBoxConcluida: { backgroundColor: '#002A14' },
  agIconBoxCancelada: { backgroundColor: '#2A0A0A' },
  agCliente: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  agVeiculo: { color: '#8FBAD8', fontSize: 12, marginTop: 2 },

  discBadge:          { backgroundColor: '#0D3A6B', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#1A4A7A' },
  discBadgeHigh:      { backgroundColor: '#00261A', borderColor: '#4AE07A' },
  discBadgeConcluida: { backgroundColor: '#00261A', borderColor: '#4AE07A' },
  discBadgeText:      { color: '#4A9FE0', fontSize: 13, fontWeight: 'bold' },

  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  infoText:   { color: '#8FBAD8', fontSize: 13 },
  visitasText:{ color: '#2A5A8A', fontSize: 12 },

  comparativo:      { backgroundColor: '#001A38', borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: '#1A3A5C' },
  comparativoTitle: { color: '#8FBAD8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },

  compRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  compDestaque:      { backgroundColor: '#0A2A4A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginTop: 2 },
  compLabelBox:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  compLabel:         { color: '#8FBAD8', fontSize: 13 },
  compValor:         { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  compRiscado:       { textDecorationLine: 'line-through', color: '#4A6A8A' },
  compValorDestaque: { color: '#4A9FE0', fontSize: 14, fontWeight: 'bold' },

  bannerVerde:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: '#002A14', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#1A5A2A' },
  bannerVerdeText: { color: '#4AE07A', fontSize: 12, flex: 1, lineHeight: 17 },
  bannerAzul:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: '#001A38', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#1A3A5C' },
  bannerAzulText:  { color: '#4A9FE0', fontSize: 12, flex: 1, lineHeight: 17 },

  cardActions: { flexDirection: 'row', gap: 10 },
  btnConcluir: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A5A2A', paddingVertical: 10, borderRadius: 10, gap: 6 },
  btnConcluirText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  btnCancelar: { width: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5A1A1A', borderRadius: 10, backgroundColor: '#2A0A0A' },

  // ── Histórico ──────────────────────────────────────────────────────────────
  filtroRow:          { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filtroBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9, backgroundColor: '#001A38', borderWidth: 1, borderColor: '#1A4A7A' },
  filtroBtnRealizada: { backgroundColor: '#002A14', borderColor: '#4AE07A' },
  filtroBtnCancelada: { backgroundColor: '#2A0808', borderColor: '#E05A5A' },
  filtroBtnText:      { color: '#8FBAD8', fontSize: 12, fontWeight: '600' },
  filtroBtnTextAtivo: { color: '#FFFFFF' },
  historicoVazio:     { color: '#2A4A6A', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  historicoItem:      { borderTopWidth: 1, borderTopColor: '#1A3A5C', paddingTop: 14, marginTop: 14 },

  botaoPrimario:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0061A8', paddingVertical: 15, borderRadius: 12,
    gap: 8, marginBottom: 12, elevation: 6,
    shadowColor: '#0061A8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8,
  },
  botaoSecundario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#1A4A7A',
    gap: 8, marginBottom: 32,
  },
  textoBotao:    { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  textoBotaoSec: { color: '#4A9FE0', fontWeight: 'bold', fontSize: 16 },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#002B5C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: '#1A4A7A' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1A3A5C' },
  modalTitle:     { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, color: '#8FBAD8', fontWeight: '700', letterSpacing: 1.2, marginBottom: 7 },
  input: { backgroundColor: '#001A38', color: '#FFFFFF', borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15, borderWidth: 1, borderColor: '#1A4A7A' },

  previewCard:    { backgroundColor: '#001A38', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1A3A5C' },
  previewTitle:   { color: '#8FBAD8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  previewDiscRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewDisc:    { color: '#4A9FE0', fontSize: 22, fontWeight: 'bold' },

  toast: {
    position: 'absolute', bottom: 28, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    maxWidth: '85%', elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  toastSuccess: { backgroundColor: '#1A6B3A' },
  toastError:   { backgroundColor: '#7A1A1A' },
  toastWarning: { backgroundColor: '#6B4A00' },
  toastText:    { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
});
