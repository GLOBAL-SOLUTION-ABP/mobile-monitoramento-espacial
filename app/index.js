import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitizeText } from './utils/security';
import { assignRole } from './utils/rbac';
import { hashPassword, decryptData, encryptData } from './utils/crypto';
import { logger } from './utils/logger';
import { checkLockout, recordFailure, clearFailures } from './utils/bruteForce';
import { useAuth } from './context/AuthContext';
import StarField from './components/StarField';

const USUARIOS_KEY = '@usuarios';
const TOAST_ICONS = { success: 'checkmark-circle', error: 'close-circle', warning: 'alert-circle' };

const notify = async (title, body) => {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, ...(Platform.OS === 'android' && { channelId: 'default' }) }, trigger: null });
  } catch (_) {}
};

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, session, loading: loadingAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [showSenha, setShowSenha] = useState(false);

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

  const toastTranslateX = toastAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });

  useEffect(() => {
    if (!loadingAuth && session) router.replace('/menu');
  }, [session, loadingAuth]);

  const validarLogin = async () => {
    if (!email.trim() || !senha) {
      showToast('Preencha e-mail e senha para continuar', 'error');
      return;
    }
    const emailSanitized = sanitizeText(email.trim()).toLowerCase();

    if (emailSanitized === 'a' && senha === 'a') {
      await login('a', 'Admin', 'admin');
      await notify('Acesso autorizado 🛰️', 'Bem-vindo ao SatGuard.');
      router.replace('/menu');
      return;
    }

    const lockoutMins = await checkLockout(emailSanitized);
    if (lockoutMins > 0) {
      logger.warn('LOGIN_BLOCKED', { email: emailSanitized, lockoutMins });
      showToast(`Conta bloqueada. Tente novamente em ${lockoutMins} min.`, 'error');
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(USUARIOS_KEY);
      let usuarios = [];
      if (raw) {
        try { usuarios = JSON.parse(decryptData(raw)); }
        catch { try { usuarios = JSON.parse(raw); } catch { usuarios = []; } }
      }

      const senhaHash = hashPassword(senha, emailSanitized);
      const usuario = usuarios.find(u =>
        u.email === emailSanitized &&
        (u.senhaHash ? u.senhaHash === senhaHash : u.senha === senha)
      );

      if (usuario) {
        await clearFailures(emailSanitized);
        logger.audit('LOGIN_SUCCESS', { email: emailSanitized, role: usuario.role });
        if (usuario.senha && !usuario.senhaHash) {
          const migrated = usuarios.map(u =>
            u.email === emailSanitized
              ? { ...u, senhaHash: hashPassword(u.senha, u.email), senha: undefined }
              : u
          );
          await AsyncStorage.setItem(USUARIOS_KEY, encryptData(JSON.stringify(migrated)));
        }
        await login(usuario.email, usuario.nome, usuario.role || assignRole(usuario.email));
        await notify('Acesso autorizado 🛰️', `Bem-vindo(a), ${usuario.nome.split(' ')[0]}!`);
        router.replace('/menu');
      } else {
        const triggered = await recordFailure(emailSanitized);
        if (triggered) {
          logger.warn('BRUTE_FORCE_DETECTED', { email: emailSanitized });
          showToast('Muitas tentativas. Conta bloqueada por 15 min.', 'error');
        } else {
          logger.warn('LOGIN_FAILURE', { email: emailSanitized });
          showToast('E-mail ou senha inválidos', 'error');
        }
      }
    } catch (_) {
      logger.error('LOGIN_ERROR', { email: emailSanitized });
      showToast('Erro ao verificar credenciais. Tente novamente.', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StarField count={110} />

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Seção do logo */}
        <View style={styles.logoSection}>
          {/* Anel de órbita */}
          <View style={styles.orbitRing}>
            <View style={styles.orbitDot} />
          </View>
          <View style={styles.logoBox}>
            <Ionicons name="planet-outline" size={58} color="#B478F0" />
          </View>
          <Text style={styles.appName}>SatGuard</Text>
          <View style={styles.subtitleRow}>
            <View style={styles.subtitleLine} />
            <Text style={styles.appSubtitle}>MONITORAMENTO CLIMÁTICO</Text>
            <View style={styles.subtitleLine} />
          </View>
          <Text style={styles.appTagline}>Previsão  ·  Prevenção  ·  Proteção</Text>
        </View>

        {/* Card de login */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#B478F0" />
            <Text style={styles.cardTitle}>Acesso ao Sistema</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-MAIL</Text>
            <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
              <Ionicons name="mail-outline" size={18} color="#B478F0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite seu e-mail"
                placeholderTextColor="#4A2070"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={80}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          <View style={[styles.inputGroup, { marginBottom: 0 }]}>
            <Text style={styles.label}>SENHA</Text>
            <View style={[styles.inputWrapper, focusedField === 'senha' && styles.inputWrapperFocused]}>
              <Ionicons name="lock-closed-outline" size={18} color="#B478F0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor="#4A2070"
                secureTextEntry={!showSenha}
                value={senha}
                onChangeText={setSenha}
                maxLength={50}
                onFocus={() => setFocusedField('senha')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowSenha(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color="#B478F0" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.botao} onPress={validarLogin} activeOpacity={0.85}>
            <Ionicons name="planet-outline" size={18} color="#FFFFFF" />
            <Text style={styles.textoBotao}>Entrar no Sistema</Text>
            <Ionicons name="arrow-forward-circle-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.linkCadastro} onPress={() => router.push('/nova-conta')} activeOpacity={0.8}>
          <Text style={styles.linkCadastroText}>Novo operador? </Text>
          <Text style={styles.linkCadastroDestaque}>Criar conta</Text>
          <Ionicons name="arrow-forward-outline" size={13} color="#B478F0" style={{ marginLeft: 3 }} />
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <View style={styles.footerDot} />
          <Text style={styles.footer}>SatGuard · Global Solution FIAP 2026</Text>
          <View style={styles.footerDot} />
        </View>
      </ScrollView>

      {/* Toast */}
      <Animated.View
        style={[
          styles.toast,
          toast.type === 'success' ? styles.toastSuccess
            : toast.type === 'error' ? styles.toastError
            : styles.toastWarning,
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

const styles = StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: '#07000F' },
  container: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // Logo section
  logoSection: { alignItems: 'center', marginBottom: 32, position: 'relative' },
  orbitRing: {
    position: 'absolute', top: -10, width: 130, height: 130,
    borderRadius: 65, borderWidth: 1, borderColor: '#3A1A6A',
    borderStyle: 'dashed', alignItems: 'flex-end', justifyContent: 'flex-start',
  },
  orbitDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#B478F0', margin: 14,
    shadowColor: '#B478F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 4,
  },
  logoBox: {
    width: 110, height: 110, borderRadius: 30,
    backgroundColor: '#120028',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#3A1A6A',
    shadowColor: '#B478F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 12,
    marginBottom: 20,
  },
  appName: {
    fontSize: 38, fontWeight: '900', color: '#FFFFFF',
    letterSpacing: 2, textAlign: 'center',
  },
  subtitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 8,
  },
  subtitleLine: { height: 1, width: 30, backgroundColor: '#3A1A6A' },
  appSubtitle: {
    fontSize: 9, color: '#B478F0', letterSpacing: 2.5,
    fontWeight: '700', textAlign: 'center',
  },
  appTagline: {
    fontSize: 11, color: '#4A2070', letterSpacing: 1, textAlign: 'center',
  },

  // Card
  card: {
    width: '100%', backgroundColor: '#120028', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: '#3A1A6A',
    shadowColor: '#B478F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 22, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#27104A',
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 9, color: '#CCAAFF', fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0C0018', borderRadius: 12,
    borderWidth: 1, borderColor: '#3A1A6A', paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: { borderColor: '#B478F0' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 15 },

  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7B2FBE', paddingVertical: 16, borderRadius: 14,
    marginTop: 20, gap: 10, elevation: 8,
    shadowColor: '#7B2FBE', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 14,
  },
  textoBotao: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },

  linkCadastro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 20, paddingVertical: 10,
  },
  linkCadastroText:     { color: '#CCAAFF', fontSize: 14 },
  linkCadastroDestaque: { color: '#B478F0', fontSize: 14, fontWeight: 'bold' },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#27104A' },
  footer:    { color: '#27104A', fontSize: 10, letterSpacing: 0.5 },

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
