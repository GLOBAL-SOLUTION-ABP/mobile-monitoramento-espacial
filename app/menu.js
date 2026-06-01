import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger } from './utils/logger';
import { hasPermission } from './utils/rbac';
import { useAuth } from './context/AuthContext';
import StarField from './components/StarField';
import RoleBadge from './components/RoleBadge';

const MENU_ITEMS = [
  { key: 'cadastrar', icon: 'location-outline', title: 'Registrar Área',  subtitle: 'Adicionar nova região de monitoramento', route: '/cadastro' },
  { key: 'alertas',   icon: 'warning-outline',  title: 'Alertas',          subtitle: 'Gerenciar alertas climáticos ativos',    route: '/alertas' },
  { key: 'dashboard', icon: 'pulse-outline',     title: 'Monitoramento',   subtitle: 'Dashboard e análise de dados espaciais', route: '/registros', permission: 'view_dashboard' },
  { key: 'sair',      icon: 'power-outline',     title: 'Encerrar Sessão', subtitle: 'Sair do sistema com segurança',          danger: true },
];


export default function Menu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace('/');
  }, [session, loading]);

  const handleLogout = async () => {
    logger.audit('LOGOUT', { role: session?.role });
    await logout();
    router.replace('/');
  };

  const handlePress = (item) => {
    if (item.danger) { handleLogout(); return; }
    if (item.permission && !hasPermission(session?.role, item.permission)) return;
    router.push(item.route);
  };

  if (!session) return <View style={styles.container} />;

  const { nome, role } = session;
  const primeiroNome = nome ? nome.split(' ')[0] : 'Usuário';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <StarField count={90} />

      {/* Cabeçalho galáxia */}
      <View style={styles.galaxyHeader}>
        <View style={styles.galaxyIconWrap}>
          <Ionicons name="planet-outline" size={26} color="#B478F0" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.galaxyTitle}>SatGuard</Text>
          <Text style={styles.galaxySub}>Sistema de Monitoramento Climático</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Card do operador */}
      <View style={styles.userCard}>
        <View style={styles.userAvatarRing}>
          <View style={styles.userAvatar}>
            <Ionicons name="person-outline" size={22} color="#B478F0" />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.userLabel}>OPERADOR</Text>
          <Text style={styles.userName} numberOfLines={1}>{primeiroNome}</Text>
        </View>
        <RoleBadge role={role} />
      </View>

      <Text style={styles.sectionLabel}>PAINEL DE CONTROLE</Text>

      {/* Lista vertical de itens */}
      {MENU_ITEMS.map((item, idx) => {
        const locked = !!(item.permission && !hasPermission(role, item.permission));
        const iconColor = locked ? '#4A2070' : item.danger ? '#F87171' : '#B478F0';
        const isLast = idx === MENU_ITEMS.length - 1;
        return (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.menuCard,
              item.danger && styles.menuCardDanger,
              locked && styles.menuCardLocked,
              isLast && { marginBottom: 0 },
            ]}
            onPress={() => handlePress(item)}
            activeOpacity={locked ? 1 : 0.7}
            disabled={locked}
          >
            <View style={[
              styles.menuIconBox,
              item.danger && styles.menuIconBoxDanger,
              locked && styles.menuIconBoxLocked,
            ]}>
              <Ionicons
                name={locked ? 'lock-closed-outline' : item.icon}
                size={22}
                color={iconColor}
              />
            </View>

            <View style={styles.menuTextBlock}>
              <Text
                style={[
                  styles.menuTitle,
                  item.danger && styles.menuTitleDanger,
                  locked && styles.menuTitleLocked,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[styles.menuSubtitle, locked && styles.menuSubtitleLocked]}
                numberOfLines={1}
              >
                {locked ? 'Acesso restrito a Analistas' : item.subtitle}
              </Text>
            </View>

            {!item.danger && !locked && (
              <Ionicons name="chevron-forward-outline" size={16} color="#3A1A6A" style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Fonte de dados */}
      <View style={styles.sourceTile}>
        <Ionicons name="satellite-outline" size={12} color="#3A1A6A" />
        <Text style={styles.sourceText}>Sentinel-2 · INPE · NASA FIRMS</Text>
        <View style={styles.sourceDot} />
      </View>

      <Text style={styles.footer}>SatGuard © 2026 — Global Solution FIAP</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07000F' },
  content:   { paddingHorizontal: 20 },

  // Cabeçalho galáxia
  galaxyHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 18,
  },
  galaxyIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#1A003A', borderWidth: 1, borderColor: '#3A1A6A',
    alignItems: 'center', justifyContent: 'center',
  },
  galaxyTitle: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  galaxySub:   { fontSize: 10, color: '#4A2070', marginTop: 2, letterSpacing: 0.3 },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#05100A', borderWidth: 1, borderColor: '#0D4020',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  liveText: { fontSize: 9, fontWeight: '800', color: '#4ADE80', letterSpacing: 1.5 },

  // Card do operador
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#120028', borderRadius: 20, padding: 18,
    marginBottom: 24, borderWidth: 1, borderColor: '#3A1A6A',
    elevation: 10, shadowColor: '#B478F0',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  userAvatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: '#B478F0',
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1A003A', alignItems: 'center', justifyContent: 'center',
  },
  userLabel: { fontSize: 9, color: '#4A2070', fontWeight: '700', letterSpacing: 2 },
  userName:  { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginTop: 2 },
  sectionLabel: {
    fontSize: 9, color: '#4A2070', fontWeight: '700',
    letterSpacing: 3, marginBottom: 12,
  },

  // Cards verticais
  menuCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#120028', borderRadius: 18, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#3A1A6A',
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6,
  },
  menuCardDanger: { borderColor: '#3A0A2A', backgroundColor: '#0E000E' },
  menuCardLocked: { opacity: 0.4 },

  menuIconBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#1A003A', borderWidth: 1, borderColor: '#3A1A6A',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  menuIconBoxDanger: { backgroundColor: '#0A0010', borderColor: '#3A0A2A' },
  menuIconBoxLocked: { borderColor: '#27104A', backgroundColor: '#0A0018' },

  menuTextBlock: { flex: 1 },
  menuTitle:     { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 3 },
  menuTitleDanger: { color: '#F87171' },
  menuTitleLocked: { color: '#4A2070' },
  menuSubtitle:        { fontSize: 11, color: '#CCAAFF', lineHeight: 15 },
  menuSubtitleLocked:  { color: '#27104A' },

  // Rodapé
  sourceTile: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 20, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#0C0018', borderRadius: 10,
    borderWidth: 1, borderColor: '#1A003A',
  },
  sourceText: { flex: 1, color: '#3A1A6A', fontSize: 10, letterSpacing: 0.5 },
  sourceDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ADE80' },
  footer:     { textAlign: 'center', color: '#27104A', fontSize: 10, letterSpacing: 0.5 },
});
