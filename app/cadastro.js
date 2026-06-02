import React, { useState, useEffect, useRef, useMemo } from 'react';
import StarField from './components/StarField';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
  Modal, FlatList, Animated, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitizeText, safeError, signPayload } from './utils/security';
import { checkRateLimit } from './utils/rateLimiter';
import { logger } from './utils/logger';
import { ROLE_LABELS, ROLE_COLORS, hasPermission } from './utils/rbac';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';

const notify = async (title, body) => {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, ...(Platform.OS === 'android' && { channelId: 'default' }) }, trigger: null });
  } catch (_) {}
};

const API_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://localhost:3000',
  web: 'http://localhost:3000',
});

const ESTADOS = [
  { codigo: 'AC', nome: 'Acre — AC' },
  { codigo: 'AL', nome: 'Alagoas — AL' },
  { codigo: 'AM', nome: 'Amazonas — AM' },
  { codigo: 'AP', nome: 'Amapá — AP' },
  { codigo: 'BA', nome: 'Bahia — BA' },
  { codigo: 'CE', nome: 'Ceará — CE' },
  { codigo: 'DF', nome: 'Distrito Federal — DF' },
  { codigo: 'ES', nome: 'Espírito Santo — ES' },
  { codigo: 'GO', nome: 'Goiás — GO' },
  { codigo: 'MA', nome: 'Maranhão — MA' },
  { codigo: 'MG', nome: 'Minas Gerais — MG' },
  { codigo: 'MS', nome: 'Mato Grosso do Sul — MS' },
  { codigo: 'MT', nome: 'Mato Grosso — MT' },
  { codigo: 'PA', nome: 'Pará — PA' },
  { codigo: 'PB', nome: 'Paraíba — PB' },
  { codigo: 'PE', nome: 'Pernambuco — PE' },
  { codigo: 'PI', nome: 'Piauí — PI' },
  { codigo: 'PR', nome: 'Paraná — PR' },
  { codigo: 'RJ', nome: 'Rio de Janeiro — RJ' },
  { codigo: 'RN', nome: 'Rio Grande do Norte — RN' },
  { codigo: 'RO', nome: 'Rondônia — RO' },
  { codigo: 'RR', nome: 'Roraima — RR' },
  { codigo: 'RS', nome: 'Rio Grande do Sul — RS' },
  { codigo: 'SC', nome: 'Santa Catarina — SC' },
  { codigo: 'SE', nome: 'Sergipe — SE' },
  { codigo: 'SP', nome: 'São Paulo — SP' },
  { codigo: 'TO', nome: 'Tocantins — TO' },
];

const TIPOS = [
  { codigo: 'Enchente', nome: 'Enchente / Alagamento', icon: 'rainy-outline' },
  { codigo: 'Seca', nome: 'Seca / Estiagem', icon: 'sunny-outline' },
  { codigo: 'Queimada', nome: 'Queimada / Incêndio Florestal', icon: 'flame-outline' },
  { codigo: 'Tempestade', nome: 'Tempestade / Vendaval', icon: 'thunderstorm-outline' },
  { codigo: 'Múltiplos', nome: 'Múltiplos Riscos', icon: 'warning-outline' },
];

const NIVEIS = [
  { codigo: 'Baixo', nome: 'Baixo', color: '#B478F0' },
  { codigo: 'Médio', nome: 'Médio', color: '#FB923C' },
  { codigo: 'Alto', nome: 'Alto', color: '#F97316' },
  { codigo: 'Crítico', nome: 'Crítico', color: '#F87171' },
];

const TOAST_ICONS = { success: 'checkmark-circle', error: 'close-circle', warning: 'alert-circle' };

export default function Cadastro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { session, loading: loadingAuth } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const role = session?.role || null;

  const [nome, setNome] = useState('');
  const [estado, setEstado] = useState(null);
  const [cidade, setCidade] = useState('');
  const [tipo, setTipo] = useState(null);
  const [area, setArea] = useState('');
  const [nivel, setNivel] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [focused, setFocused] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [modal, setModal] = useState({ visible: false, target: null, title: '', items: [] });
  const [searchQuery, setSearchQuery] = useState('');

  const [toast, setToast] = useState({ message: '', type: 'success' });
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastAnim.setValue(0);
    setToast({ message, type });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const toastTranslateX = toastAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });

  useEffect(() => {
    if (!loadingAuth && !session) {
      logger.warn('ACESSO_NAO_AUTORIZADO', { route: '/cadastro' });
      router.replace('/');
    }
  }, [session, loadingAuth]);

  const openModal = (target) => {
    const configs = {
      estado: { title: 'Selecionar Estado', items: ESTADOS },
      tipo:   { title: 'Tipo de Monitoramento', items: TIPOS },
      nivel:  { title: 'Nível de Risco', items: NIVEIS },
    };
    setSearchQuery('');
    setModal({ visible: true, target, ...configs[target] });
  };

  const handleModalSelect = (item) => {
    if (modal.target === 'estado') setEstado(item);
    else if (modal.target === 'tipo') setTipo(item);
    else if (modal.target === 'nivel') setNivel(item);
    setErrors(p => ({ ...p, [modal.target]: false }));
    setModal(p => ({ ...p, visible: false }));
  };

  const validate = () => {
    if (!nome.trim() || nome.trim().length < 3) {
      showToast('Informe o nome da região (mín. 3 caracteres)', 'error');
      setErrors(p => ({ ...p, nome: true })); return false;
    }
    if (!estado) {
      showToast('Selecione o estado', 'error');
      setErrors(p => ({ ...p, estado: true })); return false;
    }
    if (!cidade.trim() || cidade.trim().length < 2) {
      showToast('Informe a cidade de referência', 'error');
      setErrors(p => ({ ...p, cidade: true })); return false;
    }
    if (!tipo) {
      showToast('Selecione o tipo de monitoramento', 'error');
      setErrors(p => ({ ...p, tipo: true })); return false;
    }
    if (!area.trim()) {
      showToast('Informe a área aproximada em km²', 'error');
      setErrors(p => ({ ...p, area: true })); return false;
    }
    const areaNum = parseFloat(area.replace(',', '.'));
    if (isNaN(areaNum) || areaNum <= 0) {
      showToast('Área inválida — informe um valor positivo', 'error');
      setErrors(p => ({ ...p, area: true })); return false;
    }
    if (!nivel) {
      showToast('Selecione o nível de risco', 'error');
      setErrors(p => ({ ...p, nivel: true })); return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setErrors({});
    if (!validate()) return;

    try {
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected) {
        showToast('Sem conexão. Verifique e tente novamente.', 'error');
        return;
      }
    } catch (_) {}

    if (!checkRateLimit('api_write')) {
      showToast('Muitas requisições. Aguarde um momento.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const payload = {
        nome:         sanitizeText(nome.trim()),
        estado:       estado.codigo,
        cidade:       sanitizeText(cidade.trim()),
        tipo:         tipo.codigo,
        area_km2:     parseFloat(area.replace(',', '.')),
        nivel_risco:  nivel.codigo,
        descricao:    sanitizeText(descricao.trim()),
        data_cadastro: hoje,
      };
      const bodyStr = JSON.stringify(payload);
      const { signature, timestamp } = signPayload(bodyStr);

      const response = await fetch(`${API_URL}/regioes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payload-Signature': signature,
          'X-Request-Timestamp': timestamp,
        },
        body: bodyStr,
      });

      if (response.ok) {
        logger.audit('REGIAO_CADASTRADA', { nome: payload.nome, estado: payload.estado, nivel_risco: payload.nivel_risco, role });
        await notify('Região cadastrada! 🛰️', `${payload.nome} — ${payload.estado} adicionada ao monitoramento.`);
        showToast(`${payload.nome} cadastrada com sucesso!`, 'success');
        setNome(''); setEstado(null); setCidade(''); setTipo(null);
        setArea(''); setNivel(null); setDescricao('');
      } else {
        showToast(safeError('save'), 'error');
      }
    } catch {
      showToast(safeError('network'), 'error');
    }
    setSubmitting(false);
  };

  const filteredItems = (modal.items || []).filter(item =>
    item.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StarField color={colors.starColor} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLeft}>
            <View style={styles.pageIconBig}>
              <Ionicons name="location-outline" size={28} color={colors.accent} />
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.pageTitle}>Nova Região</Text>
              <Text style={styles.pageSubtitle}>Registrar área para monitoramento</Text>
            </View>
          </View>
          {role && (
            <View style={[styles.roleBadge, { borderColor: ROLE_COLORS[role], backgroundColor: ROLE_COLORS[role] + '20' }]}>
              <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[role] }]} />
              <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[role] }]}>{ROLE_LABELS[role]}</Text>
            </View>
          )}
        </View>

        <View style={styles.stepsRow}>
          <View style={[styles.stepItem, styles.stepActive]}>
            <Text style={styles.stepNum}>1</Text>
            <Text style={styles.stepLabel}>Localização</Text>
          </View>
          <View style={styles.stepConnector} />
          <View style={[styles.stepItem, styles.stepActive]}>
            <Text style={styles.stepNum}>2</Text>
            <Text style={styles.stepLabel}>Parâmetros</Text>
          </View>
        </View>

        {/* Card localização */}
        <View style={styles.card}>
          <View style={styles.satTag}>
            <Ionicons name="planet-outline" size={12} color={colors.accent} />
            <Text style={styles.satTagText}>ETAPA 1 — IDENTIFICAÇÃO</Text>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="text-outline" size={13} color={errors.nome ? colors.textDanger : colors.accent} />
              <Text style={[styles.label, errors.nome && styles.labelError]}>NOME DA REGIÃO</Text>
            </View>
            <TextInput
              style={[styles.input, focused === 'nome' && styles.inputFocused, errors.nome && styles.inputError]}
              placeholder="ex: Vale do Paraíba"
              placeholderTextColor={colors.placeholder}
              value={nome}
              onChangeText={v => { setNome(v); if (errors.nome) setErrors(p => ({ ...p, nome: false })); }}
              maxLength={80}
              onFocus={() => setFocused('nome')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="map-outline" size={13} color={errors.estado ? colors.textDanger : colors.accent} />
              <Text style={[styles.label, errors.estado && styles.labelError]}>ESTADO</Text>
            </View>
            <TouchableOpacity
              style={[styles.selectorBtn, estado && styles.selectorBtnFilled, errors.estado && styles.selectorBtnError]}
              onPress={() => openModal('estado')}
              activeOpacity={0.8}
            >
              <Text style={estado ? styles.selectorText : styles.selectorPlaceholder} numberOfLines={1}>
                {estado ? estado.nome : 'Toque para selecionar o estado'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="business-outline" size={13} color={errors.cidade ? colors.textDanger : colors.accent} />
              <Text style={[styles.label, errors.cidade && styles.labelError]}>CIDADE DE REFERÊNCIA</Text>
            </View>
            <TextInput
              style={[styles.input, focused === 'cidade' && styles.inputFocused, errors.cidade && styles.inputError]}
              placeholder="ex: São José dos Campos"
              placeholderTextColor={colors.placeholder}
              value={cidade}
              onChangeText={v => { setCidade(v); if (errors.cidade) setErrors(p => ({ ...p, cidade: false })); }}
              maxLength={60}
              onFocus={() => setFocused('cidade')}
              onBlur={() => setFocused(null)}
            />
          </View>
        </View>

        {/* Card parâmetros */}
        <View style={styles.card}>
          <View style={styles.satTag}>
            <Ionicons name="analytics-outline" size={12} color={colors.accent} />
            <Text style={styles.satTagText}>ETAPA 2 — PARÂMETROS</Text>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="warning-outline" size={13} color={errors.tipo ? colors.textDanger : colors.accent} />
              <Text style={[styles.label, errors.tipo && styles.labelError]}>TIPO DE RISCO</Text>
            </View>
            <TouchableOpacity
              style={[styles.selectorBtn, tipo && styles.selectorBtnFilled, errors.tipo && styles.selectorBtnError]}
              onPress={() => openModal('tipo')}
              activeOpacity={0.8}
            >
              <Text style={tipo ? styles.selectorText : styles.selectorPlaceholder} numberOfLines={1}>
                {tipo ? tipo.nome : 'Toque para selecionar o tipo'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="resize-outline" size={13} color={errors.area ? colors.textDanger : colors.accent} />
              <Text style={[styles.label, errors.area && styles.labelError]}>ÁREA APROXIMADA (KM²)</Text>
            </View>
            <TextInput
              style={[styles.input, focused === 'area' && styles.inputFocused, errors.area && styles.inputError]}
              placeholder="ex: 2890"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              value={area}
              onChangeText={v => { setArea(v); if (errors.area) setErrors(p => ({ ...p, area: false })); }}
              maxLength={10}
              onFocus={() => setFocused('area')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="alert-circle-outline" size={13} color={errors.nivel ? colors.textDanger : colors.accent} />
              <Text style={[styles.label, errors.nivel && styles.labelError]}>NÍVEL DE RISCO</Text>
            </View>
            <TouchableOpacity
              style={[styles.selectorBtn, nivel && styles.selectorBtnFilled, errors.nivel && styles.selectorBtnError]}
              onPress={() => openModal('nivel')}
              activeOpacity={0.8}
            >
              {nivel ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <View style={[styles.nivelDot, { backgroundColor: nivel.color }]} />
                  <Text style={styles.selectorText}>{nivel.nome}</Text>
                </View>
              ) : (
                <Text style={styles.selectorPlaceholder}>Toque para selecionar o nível</Text>
              )}
              <Ionicons name="chevron-down-outline" size={16} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="document-text-outline" size={13} color={colors.accent} />
              <Text style={styles.label}>DESCRIÇÃO (OPCIONAL)</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline, focused === 'descricao' && styles.inputFocused]}
              placeholder="Contexto adicional sobre a região e os riscos..."
              placeholderTextColor={colors.placeholder}
              value={descricao}
              onChangeText={setDescricao}
              maxLength={200}
              multiline
              numberOfLines={3}
              onFocus={() => setFocused('descricao')}
              onBlur={() => setFocused(null)}
            />
          </View>
        </View>

        <View style={styles.fonteBanner}>
          <Ionicons name="satellite-outline" size={14} color={colors.textMuted} />
          <Text style={styles.fonteText}>Dados validados via Sentinel-2 · INPE · NASA FIRMS</Text>
        </View>

        <TouchableOpacity
          style={[styles.botaoPrimario, submitting && styles.botaoDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.textoBotao}>{submitting ? 'Cadastrando...' : 'Cadastrar Região'}</Text>
        </TouchableOpacity>

        {hasPermission(role, 'view_dashboard') ? (
          <TouchableOpacity style={styles.botaoSecundario} onPress={() => router.push('/registros')} activeOpacity={0.85}>
            <Ionicons name="bar-chart-outline" size={20} color={colors.accent} />
            <Text style={styles.textoBotaoSec}>Ver Monitoramento</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.botaoSecundario, styles.botaoRestrito]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
            <Text style={styles.textoBotaoRestrito}>Monitoramento (restrito a Analistas)</Text>
          </View>
        )}

      </ScrollView>

      {/* Modal seleção */}
      <Modal
        visible={modal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setModal(p => ({ ...p, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom + 16, 20) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modal.title}</Text>
              <TouchableOpacity onPress={() => { setSearchQuery(''); setModal(p => ({ ...p, visible: false })); }}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {modal.target === 'estado' && (
              <View style={styles.searchWrapper}>
                <Ionicons name="search-outline" size={16} color={colors.accent} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar estado..."
                  placeholderTextColor={colors.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  maxLength={40}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <FlatList
              style={[styles.modalList, { maxHeight: windowHeight * 0.55 }]}
              data={filteredItems}
              keyExtractor={item => item.codigo}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleModalSelect(item)} activeOpacity={0.7}>
                  {item.color && <View style={[styles.nivelDot, { backgroundColor: item.color, marginRight: 12 }]} />}
                  {item.icon && <Ionicons name={item.icon} size={16} color={colors.accent} style={{ marginRight: 12 }} />}
                  <Text style={styles.modalItemText} numberOfLines={1}>{item.nome}</Text>
                  <Ionicons name="chevron-forward-outline" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
              ListEmptyComponent={() => (
                <View style={styles.emptySearch}>
                  <Ionicons name="search-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.emptySearchText}>Nenhum resultado</Text>
                </View>
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>

      <Animated.View
        style={[
          styles.toast,
          toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastWarning,
          { opacity: toastAnim, transform: [{ translateX: toastTranslateX }] },
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
  keyboardView: { flex: 1, backgroundColor: c.bg },
  container: { flexGrow: 1, backgroundColor: c.bg, padding: 20, paddingBottom: 40 },

  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, marginTop: 4 },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pageIconBig: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: c.cardElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border,
    shadowColor: c.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  pageTitle:    { fontSize: 20, fontWeight: 'bold', color: c.textPrimary },
  pageSubtitle: { fontSize: 12, color: c.textSecondary, marginTop: 3 },

  stepsRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 18,
    backgroundColor: c.bgDeep, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: c.borderFaint,
  },
  stepItem:      { flex: 1, alignItems: 'center', gap: 4 },
  stepActive:    {},
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: c.accentBtn, alignItems: 'center', justifyContent: 'center',
    color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 26,
  },
  stepLabel:     { fontSize: 9, color: c.textSecondary, fontWeight: '600', letterSpacing: 1 },
  stepConnector: { width: 40, height: 1, backgroundColor: c.border },

  card: {
    backgroundColor: c.card, borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: c.border, marginBottom: 16,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8,
  },
  satTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16,
    alignSelf: 'flex-start', backgroundColor: c.bgDeep, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: c.border,
  },
  satTagText: { color: c.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  inputGroup: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  label: { fontSize: 11, color: c.textSecondary, fontWeight: '700', letterSpacing: 1.2 },
  labelError: { color: c.textDanger },

  input: {
    backgroundColor: c.bgDeep, color: c.textPrimary, borderRadius: 10,
    paddingHorizontal: 14, height: 48, fontSize: 15,
    borderWidth: 1, borderColor: c.border,
  },
  inputMultiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  inputFocused: { borderColor: c.borderFocus },
  inputError: { borderColor: c.textDanger },

  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.bgDeep, borderRadius: 10, paddingHorizontal: 14,
    height: 48, borderWidth: 1, borderColor: c.border,
  },
  selectorBtnFilled: { borderColor: c.borderFocus },
  selectorBtnError: { borderColor: c.textDanger },
  selectorText: { color: c.textPrimary, fontSize: 14, flex: 1, marginRight: 8 },
  selectorPlaceholder: { color: c.placeholder, fontSize: 14, flex: 1, marginRight: 8 },

  nivelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },

  fonteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 16, paddingHorizontal: 4,
  },
  fonteText: { color: c.textMuted, fontSize: 11, flex: 1 },

  botaoPrimario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.accentBtn, paddingVertical: 15, borderRadius: 12,
    gap: 8, marginBottom: 12, elevation: 6,
    shadowColor: c.accentBtn, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8,
  },
  botaoDisabled: { opacity: 0.5 },
  botaoSecundario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, gap: 8,
  },
  textoBotao: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  textoBotaoSec: { color: c.accent, fontWeight: 'bold', fontSize: 16 },
  botaoRestrito: { opacity: 0.45 },
  textoBotaoRestrito: { color: c.textMuted, fontWeight: '600', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20,
    borderWidth: 1, borderColor: c.border, width: '100%', overflow: 'hidden',
  },
  modalList: { minHeight: 0 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.borderFaint,
  },
  modalTitle: { color: c.textPrimary, fontSize: 17, fontWeight: 'bold' },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.bgDeep, borderRadius: 10,
    borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, color: c.textPrimary, fontSize: 14, height: 44 },
  emptySearch: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptySearchText: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
  },
  modalItemText: { color: c.textPrimary, fontSize: 14, flex: 1 },
  modalSeparator: { height: 1, backgroundColor: c.borderFaint },

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
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
});
