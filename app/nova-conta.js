import React, { useState, useRef } from 'react';
import StarField from './components/StarField';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeText, validateEmail } from './utils/security';
import { hashPassword, encryptData, decryptData } from './utils/crypto';
import { logger } from './utils/logger';

const USUARIOS_KEY = '@usuarios';
const TOAST_ICONS = { success: 'checkmark-circle', error: 'close-circle', warning: 'alert-circle' };

export default function NovaConta() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [focused, setFocused] = useState(null);
  const [errors, setErrors] = useState({});
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipoConta, setTipoConta] = useState('user');
  const [codigoAdmin, setCodigoAdmin] = useState('');
  const [showCodigoAdmin, setShowCodigoAdmin] = useState(false);

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

  const clearError = (key) => {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: false }));
  };

  const handleCadastro = async () => {
    setErrors({});

    if (!nome.trim() || nome.trim().length < 2) {
      showToast('Informe seu nome completo (mín. 2 caracteres)', 'error');
      setErrors({ nome: true });
      return;
    }
    if (!email.trim() || !validateEmail(email.trim())) {
      showToast('Informe um e-mail válido', 'error');
      setErrors({ email: true });
      return;
    }
    if (!senha || senha.length < 6) {
      showToast('A senha deve ter pelo menos 6 caracteres', 'error');
      setErrors({ senha: true });
      return;
    }
    if (senha !== confirmar) {
      showToast('As senhas não coincidem', 'error');
      setErrors({ confirmar: true });
      return;
    }
    if (tipoConta === 'admin' && codigoAdmin.trim().toLowerCase() !== 'admin') {
      showToast('Código de administrador inválido', 'error');
      setErrors({ codigoAdmin: true });
      return;
    }

    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(USUARIOS_KEY);
      let usuarios = [];
      if (raw) {
        try { usuarios = JSON.parse(decryptData(raw)); }
        catch { try { usuarios = JSON.parse(raw); } catch { usuarios = []; } }
      }

      const emailNorm = email.trim().toLowerCase();
      if (usuarios.find(u => u.email === emailNorm)) {
        showToast('Este e-mail já está cadastrado', 'error');
        setErrors({ email: true });
        setLoading(false);
        return;
      }

      const novoUsuario = {
        nome:     sanitizeText(nome.trim()),
        email:    emailNorm,
        senhaHash: hashPassword(senha, emailNorm),
        role:     tipoConta,
        criadoEm: Date.now(),
      };

      await AsyncStorage.setItem(USUARIOS_KEY, encryptData(JSON.stringify([...usuarios, novoUsuario])));
      logger.audit('ACCOUNT_CREATED', { email: emailNorm, role: tipoConta });
      showToast(`Conta criada! Bem-vindo(a), ${nome.trim().split(' ')[0]}.`, 'success');
      setTimeout(() => router.back(), 2000);
    } catch (_) {
      showToast('Erro ao salvar conta. Tente novamente.', 'error');
    }
    setLoading(false);
  };

  const fieldStyle = (key, wrapper = false) => {
    const base = wrapper ? styles.inputWrapper : styles.input;
    const focusedStyle = wrapper ? styles.inputWrapperFocused : styles.inputFocused;
    const errorStyle = wrapper ? styles.inputWrapperError : styles.inputError;
    return [base, focused === key && focusedStyle, errors[key] && errorStyle];
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StarField />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Cabeçalho */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="person-add-outline" size={24} color="#B478F0" />
          </View>
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.sectionTitle}>Criar Conta</Text>
            <Text style={styles.sectionSubtitle}>Preencha seus dados de acesso</Text>
          </View>
        </View>

        {/* Card do formulário */}
        <View style={styles.card}>

          {/* Nome */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="person-outline" size={13} color={errors.nome ? '#F87171' : '#B478F0'} />
              <Text style={[styles.label, errors.nome && styles.labelError]}>NOME COMPLETO</Text>
            </View>
            <TextInput
              style={fieldStyle('nome')}
              placeholder="ex: João Silva"
              placeholderTextColor="#4A2070"
              value={nome}
              onChangeText={v => { setNome(v); clearError('nome'); }}
              autoCapitalize="words"
              maxLength={60}
              onFocus={() => setFocused('nome')}
              onBlur={() => setFocused(null)}
            />
          </View>

          {/* E-mail */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="mail-outline" size={13} color={errors.email ? '#F87171' : '#B478F0'} />
              <Text style={[styles.label, errors.email && styles.labelError]}>E-MAIL</Text>
            </View>
            <TextInput
              style={fieldStyle('email')}
              placeholder="ex: joao@teste.com"
              placeholderTextColor="#4A2070"
              value={email}
              onChangeText={v => { setEmail(v); clearError('email'); }}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={80}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
            />
          </View>

          {/* Senha */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="lock-closed-outline" size={13} color={errors.senha ? '#F87171' : '#B478F0'} />
              <Text style={[styles.label, errors.senha && styles.labelError]}>SENHA</Text>
            </View>
            <View style={fieldStyle('senha', true)}>
              <TextInput
                style={styles.inputInner}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#4A2070"
                value={senha}
                onChangeText={v => { setSenha(v); clearError('senha'); }}
                secureTextEntry={!showSenha}
                maxLength={50}
                onFocus={() => setFocused('senha')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity onPress={() => setShowSenha(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color="#B478F0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmar Senha */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="lock-closed-outline" size={13} color={errors.confirmar ? '#F87171' : '#B478F0'} />
              <Text style={[styles.label, errors.confirmar && styles.labelError]}>CONFIRMAR SENHA</Text>
            </View>
            <View style={fieldStyle('confirmar', true)}>
              <TextInput
                style={styles.inputInner}
                placeholder="Repita a senha"
                placeholderTextColor="#4A2070"
                value={confirmar}
                onChangeText={v => { setConfirmar(v); clearError('confirmar'); }}
                secureTextEntry={!showConfirmar}
                maxLength={50}
                onFocus={() => setFocused('confirmar')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity onPress={() => setShowConfirmar(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showConfirmar ? 'eye-off-outline' : 'eye-outline'} size={18} color="#B478F0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tipo de Conta */}
          <View style={[styles.inputGroup, { marginBottom: tipoConta === 'admin' ? 14 : 0 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="shield-outline" size={13} color="#B478F0" />
              <Text style={styles.label}>TIPO DE CONTA</Text>
            </View>
            <View style={styles.tipoContaRow}>
              <TouchableOpacity
                style={[styles.tipoBtn, tipoConta === 'user' && styles.tipoBtnAtivoUser]}
                onPress={() => { setTipoConta('user'); setCodigoAdmin(''); clearError('codigoAdmin'); }}
                activeOpacity={0.75}
              >
                <Ionicons name="person-outline" size={16} color={tipoConta === 'user' ? '#FFFFFF' : '#CCAAFF'} />
                <Text style={[styles.tipoBtnText, tipoConta === 'user' && styles.tipoBtnTextAtivo]}>Usuário</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipoBtn, tipoConta === 'admin' && styles.tipoBtnAtivoAdmin]}
                onPress={() => { setTipoConta('admin'); clearError('codigoAdmin'); }}
                activeOpacity={0.75}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={tipoConta === 'admin' ? '#FFFFFF' : '#CCAAFF'} />
                <Text style={[styles.tipoBtnText, tipoConta === 'admin' && styles.tipoBtnTextAtivo]}>Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Código de Admin — aparece apenas quando admin está selecionado */}
          {tipoConta === 'admin' && (
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <View style={styles.labelRow}>
                <Ionicons name="key-outline" size={13} color={errors.codigoAdmin ? '#F87171' : '#FB923C'} />
                <Text style={[styles.label, { color: errors.codigoAdmin ? '#F87171' : '#FB923C' }]}>
                  CÓDIGO DE ADMINISTRADOR
                </Text>
              </View>
              <View style={[fieldStyle('codigoAdmin', true), errors.codigoAdmin && styles.inputWrapperError]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="Digite o código de acesso"
                  placeholderTextColor="#4A2070"
                  value={codigoAdmin}
                  onChangeText={v => { setCodigoAdmin(v); clearError('codigoAdmin'); }}
                  secureTextEntry={!showCodigoAdmin}
                  maxLength={20}
                  onFocus={() => setFocused('codigoAdmin')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity onPress={() => setShowCodigoAdmin(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showCodigoAdmin ? 'eye-off-outline' : 'eye-outline'} size={18} color="#FB923C" />
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>

        {/* Botão criar conta */}
        <TouchableOpacity
          style={[styles.botaoPrimario, loading && styles.botaoDisabled]}
          onPress={handleCadastro}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
          <Text style={styles.textoBotao}>{loading ? 'Criando conta...' : 'Criar Conta'}</Text>
        </TouchableOpacity>

        {/* Voltar ao login */}
        <TouchableOpacity style={styles.botaoSecundario} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="arrow-back-outline" size={18} color="#B478F0" />
          <Text style={styles.textoBotaoSec}>Voltar ao Login</Text>
        </TouchableOpacity>

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
  container: { flexGrow: 1, backgroundColor: '#07000F', padding: 20, paddingBottom: 40 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 },
  sectionIconBox: {
    width: 50, height: 50, borderRadius: 14, backgroundColor: '#120028',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3A1A6A',
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  sectionSubtitle: { fontSize: 13, color: '#CCAAFF', marginTop: 2 },

  card: {
    backgroundColor: '#120028', borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: '#3A1A6A', marginBottom: 16,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8,
  },

  inputGroup: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  label: { fontSize: 11, color: '#CCAAFF', fontWeight: '700', letterSpacing: 1.2 },
  labelError: { color: '#F87171' },

  input: {
    backgroundColor: '#0C0018', color: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 14, height: 48, fontSize: 15,
    borderWidth: 1, borderColor: '#3A1A6A',
  },
  inputFocused: { borderColor: '#B478F0' },
  inputError: { borderColor: '#F87171' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0C0018', borderRadius: 10,
    paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: '#3A1A6A',
  },
  inputWrapperFocused: { borderColor: '#B478F0' },
  inputWrapperError: { borderColor: '#F87171' },
  inputInner: { flex: 1, color: '#FFFFFF', fontSize: 15 },

  tipoContaRow:      { flexDirection: 'row', gap: 10 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#0C0018', borderWidth: 1, borderColor: '#3A1A6A',
  },
  tipoBtnAtivoUser:  { backgroundColor: '#7B2FBE', borderColor: '#B478F0' },
  tipoBtnAtivoAdmin: { backgroundColor: '#2A0018', borderColor: '#F43F5E' },
  tipoBtnText:       { color: '#CCAAFF', fontSize: 14, fontWeight: '600' },
  tipoBtnTextAtivo:  { color: '#FFFFFF' },

  botaoPrimario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7B2FBE', paddingVertical: 15, borderRadius: 12,
    gap: 8, marginBottom: 12, elevation: 6,
    shadowColor: '#7B2FBE', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8,
  },
  botaoDisabled: { opacity: 0.6 },
  botaoSecundario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#3A1A6A', gap: 8,
  },
  textoBotao: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  textoBotaoSec: { color: '#B478F0', fontWeight: 'bold', fontSize: 16 },

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
