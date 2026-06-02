import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger } from './utils/logger';
import { hasPermission } from './utils/rbac';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
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
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
      <StarField count={90} color={colors.starColor} />

      {/* Cabeçalho */}
      <View style={styles.galaxyHeader}>
        <View style={styles.galaxyIconWrap}>
          <Ionicons name="planet-outline" size={26} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.galaxyTitle}>SatGuard</Text>
          <Text style={styles.galaxySub}>Sistema de Monitoramento Climático</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle} activeOpacity={0.7}>
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Card do operador */}
      <View style={styles.userCard}>
        <View style={styles.userAvatarRing}>
          <View style={styles.userAvatar}>
            <Ionicons name="person-outline" size={22} color={colors.accent} />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.userLabel}>OPERADOR</Text>
          <Text style={styles.userName} numberOfLines={1}>{primeiroNome}</Text>
        </View>
        <RoleBadge role={role} />
      </View>

      <Text style={styles.sectionLabel}>PAINEL DE CONTROLE</Text>

      {MENU_ITEMS.map((item, idx) => {
        const locked = !!(item.permission && !hasPermission(role, item.permission));
        const iconColor = locked ? colors.textMuted : item.danger ? colors.textDanger : colors.accent;
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
              <Ionicons name="chevron-forward-outline" size={16} color={colors.border} style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.sourceTile}>
        <Ionicons name="satellite-outline" size={12} color={colors.textMuted} />
        <Text style={styles.sourceText}>Sentinel-2 · INPE · NASA FIRMS</Text>
        <View style={styles.sourceDot} />
      </View>

      <Text style={styles.footer}>SatGuard © 2026 — Global Solution FIAP</Text>
    </ScrollView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content:   { paddingHorizontal: 20 },

  galaxyHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 18,
  },
  galaxyIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: c.cardElevated, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  galaxyTitle: { fontSize: 19, fontWeight: '800', color: c.textPrimary, letterSpacing: 0.5 },
  galaxySub:   { fontSize: 10, color: c.textMuted, marginTop: 2, letterSpacing: 0.3 },
  themeToggle: {
    width: 34, height: 34, borderRadius: 17, marginRight: 8,
    backgroundColor: c.cardElevated, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: c.bgDeep, borderWidth: 1, borderColor: c.borderFaint,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  liveText: { fontSize: 9, fontWeight: '800', color: '#4ADE80', letterSpacing: 1.5 },

  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.card, borderRadius: 20, padding: 18,
    marginBottom: 24, borderWidth: 1, borderColor: c.border,
    elevation: 10, shadowColor: c.accent,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  userAvatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: c.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: c.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  userLabel: { fontSize: 9, color: c.textMuted, fontWeight: '700', letterSpacing: 2 },
  userName:  { fontSize: 18, fontWeight: 'bold', color: c.textPrimary, marginTop: 2 },
  sectionLabel: {
    fontSize: 9, color: c.textMuted, fontWeight: '700',
    letterSpacing: 3, marginBottom: 12,
  },

  menuCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.card, borderRadius: 18, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6,
  },
  menuCardDanger: { borderColor: c.borderDanger, backgroundColor: c.bgDanger },
  menuCardLocked: { opacity: 0.4 },

  menuIconBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: c.cardElevated, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  menuIconBoxDanger: { backgroundColor: c.bgDanger, borderColor: c.borderDanger },
  menuIconBoxLocked: { borderColor: c.borderFaint, backgroundColor: c.bgDeep },

  menuTextBlock: { flex: 1 },
  menuTitle:     { fontSize: 15, fontWeight: 'bold', color: c.textPrimary, marginBottom: 3 },
  menuTitleDanger: { color: c.textDanger },
  menuTitleLocked: { color: c.textMuted },
  menuSubtitle:        { fontSize: 11, color: c.textSecondary, lineHeight: 15 },
  menuSubtitleLocked:  { color: c.borderFaint },

  sourceTile: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 20, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: c.bgDeep, borderRadius: 10,
    borderWidth: 1, borderColor: c.cardElevated,
  },
  sourceText: { flex: 1, color: c.textMuted, fontSize: 10, letterSpacing: 0.5 },
  sourceDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ADE80' },
  footer:     { textAlign: 'center', color: c.textFaint, fontSize: 10, letterSpacing: 0.5 },
});
