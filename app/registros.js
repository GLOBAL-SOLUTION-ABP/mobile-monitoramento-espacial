import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet,
  TouchableOpacity, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { loadSession, clearSession } from './utils/auth';
import { checkRateLimit } from './utils/rateLimiter';
import { logger } from './utils/logger';
import { hasPermission, ROLE_LABELS, ROLE_COLORS } from './utils/rbac';
import { encryptData, decryptData } from './utils/crypto';
import { BarChart } from 'react-native-chart-kit';
import * as Notifications from 'expo-notifications';
import seedDb from '../db.json';

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

const RISK_ORDER = { 'Crítico': 4, 'Alto': 3, 'Médio': 2, 'Baixo': 1 };
const RISK_COLORS = { 'Crítico': '#F87171', 'Alto': '#F97316', 'Médio': '#FB923C', 'Baixo': '#B478F0' };
const TIPOS_ORDER = ['Enchente', 'Seca', 'Queimada', 'Tempestade', 'Múltiplos'];

const chartConfig = {
  backgroundColor: '#0C0018',
  backgroundGradientFrom: '#0C0018',
  backgroundGradientTo: '#120028',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(180, 120, 240, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(204, 170, 255, ${opacity})`,
  barPercentage: 0.6,
  propsForBackgroundLines: { stroke: '#27104A', strokeDasharray: '' },
};

export default function Registros() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [regioes, setRegioes] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => { fetchRegioes(); }, []);
  useEffect(() => {
    loadSession().then(s => {
      if (!s) { logger.warn('ACESSO_NAO_AUTORIZADO', { route: '/registros' }); router.replace('/'); return; }
      logger.info('DASHBOARD_ACCESS', { role: s.role });
      setRole(s.role || 'user');
    });
  }, []);

  const readCache = async () => {
    const cached = await AsyncStorage.getItem('regioesCache');
    if (!cached) return null;
    try { return JSON.parse(decryptData(cached)); }
    catch { try { return JSON.parse(cached); } catch { return null; } }
  };

  const fetchRegioes = async () => {
    setLoading(true);
    try {
      const networkState = await Network.getNetworkStateAsync();
      const connected = networkState.isConnected ?? true;
      setIsOnline(connected);

      // Tenta a API local primeiro
      if (connected && checkRateLimit('api_read')) {
        try {
          const response = await fetch(`${API_URL}/regioes`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              setRegioes(data);
              await AsyncStorage.setItem('regioesCache', encryptData(JSON.stringify(data)));
              await AsyncStorage.setItem('regioesCacheTimestamp', Date.now().toString());
              setLoading(false);
              return;
            }
          }
        } catch (_) {
          // servidor não disponível — segue para fallback
        }
      }

      // Fallback 1: cache local (AsyncStorage)
      const cached = await readCache();
      if (cached && cached.length > 0) {
        setRegioes(cached);
        setLoading(false);
        return;
      }

      // Fallback 2: db.json embutido no bundle — sempre disponível
      logger.info('DASHBOARD_FALLBACK', { source: 'db.json' });
      setRegioes(seedDb.regioes ?? []);
    } catch {
      setRegioes(seedDb.regioes ?? []);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await clearSession();
    router.replace('/');
  };

  // ── Analytics ────────────────────────────────────────────────────────────
  const totalRegioes = regioes.length;
  const criticos = regioes.filter(r => r.nivel_risco === 'Crítico').length;
  const estados = new Set(regioes.map(r => r.estado)).size;

  // Distribuição por tipo
  const tipoCount = TIPOS_ORDER.reduce((acc, t) => {
    acc[t] = regioes.filter(r => r.tipo === t).length;
    return acc;
  }, {});
  const tiposComDados = TIPOS_ORDER.filter(t => tipoCount[t] > 0);

  const chartData = {
    labels: tiposComDados.map(t => t.length > 9 ? t.slice(0, 9) + '…' : t),
    datasets: [{ data: tiposComDados.length > 0 ? tiposComDados.map(t => tipoCount[t]) : [0] }],
  };

  // Top 3 por risco
  const top3 = [...regioes]
    .sort((a, b) => (RISK_ORDER[b.nivel_risco] || 0) - (RISK_ORDER[a.nivel_risco] || 0))
    .slice(0, 3);

  // ── Tabela ──────────────────────────────────────────────────────────────
  const COLUMNS = [
    { key: 'estado',      header: 'UF',      width: 50 },
    { key: 'nome',        header: 'Região',   width: 150 },
    { key: 'tipo',        header: 'Tipo',     width: 100 },
    { key: 'nivel_risco', header: 'Risco',    width: 80 },
    { key: 'area_km2',    header: 'Área km²', width: 90 },
  ];

  const fmtArea = (v = 0) =>
    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;

  const renderRow = ({ item, index }) => (
    <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
      {COLUMNS.map(col => (
        <Text
          key={col.key}
          style={[
            styles.cell,
            col.key === 'nivel_risco' && { color: RISK_COLORS[item.nivel_risco] || '#FFFFFF', fontWeight: '700' },
            { width: col.width },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {col.key === 'area_km2' ? fmtArea(item.area_km2) : String(item[col.key] ?? '')}
        </Text>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B478F0" />
        <Text style={styles.loadingText}>Carregando dados de monitoramento...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>

      {/* Role badge */}
      {role && (
        <View style={[styles.roleBadge, { borderColor: ROLE_COLORS[role] }]}>
          <Ionicons name="shield-checkmark-outline" size={12} color={ROLE_COLORS[role]} />
          <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[role] }]}>{ROLE_LABELS[role]}</Text>
        </View>
      )}

      {/* Banner offline */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={15} color="#FFFFFF" />
          <Text style={styles.offlineText}>Sem conexão — exibindo dados em cache</Text>
        </View>
      )}

      {/* Fonte de dados */}
      <View style={styles.sourceBanner}>
        <Ionicons name="satellite-outline" size={13} color="#B478F0" />
        <Text style={styles.sourceText}>
          {isOnline ? 'API local (db.json) · Sentinel-2 · INPE · NASA FIRMS' : 'db.json local — sem servidor'}
        </Text>
        <View style={[styles.sourceDot, { backgroundColor: isOnline ? '#4ADE80' : '#FB923C' }]} />
      </View>

      {/* KPI hero — regiões monitoradas */}
      <View style={styles.heroKpi}>
        <View style={styles.heroKpiIcon}>
          <Ionicons name="planet-outline" size={28} color="#B478F0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroKpiValue}>{totalRegioes}</Text>
          <Text style={styles.heroKpiLabel}>REGIÕES MONITORADAS</Text>
        </View>
        <View style={styles.heroKpiRight}>
          <Ionicons name="satellite-outline" size={14} color="#3A1A6A" />
          <Text style={styles.heroKpiSrc}>db.json</Text>
        </View>
      </View>

      {/* KPIs secundários */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, styles.kpiCardCritico, { marginRight: 8 }]}>
          <Ionicons name="alert-circle-outline" size={22} color="#F87171" />
          <Text style={[styles.kpiValue, { color: '#F87171', fontSize: 28 }]}>{criticos}</Text>
          <Text style={styles.kpiLabel}>Críticas</Text>
        </View>
        <View style={[styles.kpiCard, { marginLeft: 8 }]}>
          <Ionicons name="map-outline" size={22} color="#B478F0" />
          <Text style={[styles.kpiValue, { fontSize: 28 }]}>{estados}</Text>
          <Text style={styles.kpiLabel}>Estados</Text>
        </View>
      </View>

      {/* Gráfico por tipo */}
      {tiposComDados.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart-outline" size={17} color="#B478F0" />
            <Text style={styles.cardTitle}>Distribuição por Tipo de Risco</Text>
          </View>

          {Platform.OS !== 'web' ? (
            <BarChart
              data={chartData}
              width={screenWidth - 64}
              height={185}
              fromZero
              chartConfig={chartConfig}
              style={{ borderRadius: 10, marginTop: 4 }}
              showValuesOnTopOfBars
            />
          ) : (
            <View style={styles.chartFallback}>
              {tiposComDados.map((tipo, i) => (
                <View key={i} style={styles.chartFallbackRow}>
                  <Text style={styles.chartFallbackLabel} numberOfLines={1}>{tipo}</Text>
                  <View style={[styles.chartFallbackBar, { flex: tipoCount[tipo] }]} />
                  <Text style={styles.chartFallbackQtd}>{tipoCount[tipo]}x</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Analytics — restrito a analyst e admin */}
      {hasPermission(role, 'view_analytics') ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="warning-outline" size={17} color="#F87171" />
            <Text style={styles.cardTitle}>Regiões de Maior Risco</Text>
          </View>

          <Text style={styles.analyticSection}>Top 3 regiões críticas monitoradas</Text>
          {top3.length > 0 ? top3.map((r, i) => (
            <View key={r.id || i} style={styles.analyticRow}>
              <View style={[
                styles.rankBadge,
                i === 0 && styles.rankCritico,
                i === 1 && styles.rankAlto,
                i === 2 && styles.rankMedio,
              ]}>
                <Text style={styles.rankText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.analyticName} numberOfLines={1}>{r.nome}</Text>
                <Text style={styles.analyticSub}>{r.estado} · {r.tipo} · {r.area_km2?.toLocaleString('pt-BR')} km²</Text>
              </View>
              <Text style={[styles.analyticQtd, { color: RISK_COLORS[r.nivel_risco] || '#B478F0' }]}>
                {r.nivel_risco}
              </Text>
            </View>
          )) : <Text style={styles.emptyText}>Nenhuma região encontrada</Text>}

          <View style={styles.divider} />

          <View style={styles.analyticRow}>
            <Ionicons name="flame-outline" size={15} color="#F97316" style={{ marginRight: 10 }} />
            <Text style={[styles.analyticName, { color: '#CCAAFF' }]}>Tipo mais monitorado</Text>
            <Text style={styles.analyticQtd}>
              {tiposComDados.length > 0
                ? `${tiposComDados.sort((a, b) => tipoCount[b] - tipoCount[a])[0]} (${tipoCount[tiposComDados[0]]}x)`
                : '—'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={17} color="#CCAAFF" />
            <Text style={styles.cardTitle}>Análise de Risco</Text>
          </View>
          <View style={styles.accessRestricted}>
            <Ionicons name="shield-outline" size={26} color="#FB923C" />
            <Text style={styles.accessRestrictedText}>Acesso restrito a Analistas e Administradores</Text>
          </View>
        </View>
      )}

      {/* Tabela */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="list-outline" size={17} color="#B478F0" />
          <Text style={styles.cardTitle}>Todas as Regiões</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[styles.row, styles.headerRow]}>
              {COLUMNS.map(col => (
                <Text key={col.key} style={[styles.cell, styles.headerCell, { width: col.width }]} numberOfLines={1}>
                  {col.header}
                </Text>
              ))}
            </View>
            <FlatList
              data={regioes}
              keyExtractor={item => item.id?.toString() ?? Math.random().toString()}
              renderItem={renderRow}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </View>

      {/* Botões de ação */}
      <TouchableOpacity
        style={[styles.botao, styles.botaoAlertas]}
        onPress={() => router.push('/alertas')}
        activeOpacity={0.85}
      >
        <Ionicons name="warning-outline" size={18} color="#FFFFFF" />
        <Text style={styles.textoBotao}>Alertas Climáticos</Text>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.botao, { flex: 1, marginRight: 8 }]}
          onPress={() => router.push('/cadastro')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.textoBotao}>Registrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botaoSair, { flex: 1, marginLeft: 8 }]}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.textoBotao}>Sair</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07000F', padding: 16 },
  loadingContainer: {
    flex: 1, backgroundColor: '#07000F',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadingText: { color: '#CCAAFF', fontSize: 14 },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#3A0028', padding: 10, borderRadius: 10,
    marginBottom: 10, gap: 8,
  },
  offlineText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  sourceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#0C0018', borderRadius: 10, padding: 10,
    marginBottom: 14, borderWidth: 1, borderColor: '#1A0A4A',
  },
  sourceText: { flex: 1, color: '#B478F0', fontSize: 11, fontWeight: '600' },
  sourceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },

  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#0C0018', marginBottom: 10,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  accessRestricted: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  accessRestrictedText: { color: '#CCAAFF', fontSize: 13, textAlign: 'center' },

  // KPI hero
  heroKpi: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#120028', borderRadius: 20, padding: 20, marginBottom: 10,
    borderWidth: 1, borderColor: '#3A1A6A',
    shadowColor: '#B478F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 18, elevation: 10,
  },
  heroKpiIcon: {
    width: 58, height: 58, borderRadius: 16,
    backgroundColor: '#1A003A', borderWidth: 1, borderColor: '#3A1A6A',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  heroKpiValue: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', lineHeight: 46 },
  heroKpiLabel: { fontSize: 9, color: '#CCAAFF', fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  heroKpiRight: { alignItems: 'flex-end', gap: 4 },
  heroKpiSrc:   { fontSize: 9, color: '#4A2070', letterSpacing: 0.5 },

  kpiRow: { flexDirection: 'row', marginBottom: 14 },
  kpiCardCritico: { borderColor: '#3A0A2A', backgroundColor: '#120012' },
  kpiCard: {
    flex: 1, backgroundColor: '#120028', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#3A1A6A',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  kpiIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A003A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  kpiValue: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  kpiLabel: { color: '#CCAAFF', fontSize: 10, marginTop: 3, textAlign: 'center', letterSpacing: 0.5 },

  card: {
    backgroundColor: '#120028', borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#3A1A6A',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#27104A',
  },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  chartFallback: { width: '100%', marginTop: 4 },
  chartFallbackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chartFallbackLabel: { color: '#CCAAFF', fontSize: 12, width: 100 },
  chartFallbackBar: { height: 14, backgroundColor: '#7B2FBE', borderRadius: 4, marginHorizontal: 8, minWidth: 10 },
  chartFallbackQtd: { color: '#B478F0', fontSize: 12, fontWeight: 'bold', width: 28, textAlign: 'right' },

  analyticSection: {
    color: '#CCAAFF', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase',
  },
  analyticRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rankBadge: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#3A1A6A',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rankCritico: { backgroundColor: '#300010' },
  rankAlto:    { backgroundColor: '#2A1000' },
  rankMedio:   { backgroundColor: '#1A1000' },
  rankText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  analyticName: { color: '#FFFFFF', fontSize: 14 },
  analyticSub:  { color: '#7A50A0', fontSize: 11, marginTop: 2 },
  analyticQtd: { color: '#B478F0', fontSize: 13, fontWeight: 'bold' },
  emptyText: { color: '#CCAAFF', fontSize: 14, textAlign: 'center', paddingVertical: 10 },
  divider: { height: 1, backgroundColor: '#27104A', marginVertical: 12 },

  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#27104A' },
  headerRow: { backgroundColor: '#0C0018' },
  rowEven: { backgroundColor: '#0A001A' },
  rowOdd: { backgroundColor: '#120028' },
  cell: {
    paddingVertical: 10, paddingHorizontal: 8, textAlign: 'center',
    color: '#FFFFFF', fontSize: 12, textAlignVertical: 'top',
  },
  headerCell: {
    color: '#CCAAFF', fontWeight: '700', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  botaoAlertas: { marginBottom: 10, backgroundColor: '#2A0028', borderWidth: 1, borderColor: '#7B1060', elevation: 4 },
  actionsRow: { flexDirection: 'row', marginBottom: 32 },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7B2FBE', paddingVertical: 14, borderRadius: 12, gap: 7,
    elevation: 4, shadowColor: '#7B2FBE', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6,
  },
  botaoSair: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3A0A2A', paddingVertical: 14, borderRadius: 12, gap: 7,
    borderWidth: 1, borderColor: '#5A0A3A',
  },
  textoBotao: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
});
