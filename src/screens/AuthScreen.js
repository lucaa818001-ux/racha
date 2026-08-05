import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = AuthSession.makeRedirectUri();

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [modoRegistro, setModoRegistro] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const { error } = modoRegistro
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      setLoading(false);
      Alert.alert('Error', error.message);
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    setLoading(false);
    if (result.type === 'success' && result.url) {
      const params = new URL(result.url.replace('#', '?')).searchParams;
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? 'Cargando...' : modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
        </Text>
      </Pressable>
      <Text style={styles.toggle} onPress={() => setModoRegistro(!modoRegistro)}>
        {modoRegistro ? '¿Ya tenés cuenta? Iniciar sesión' : '¿No tenés cuenta? Crear una'}
      </Text>
      <View style={styles.separator} />
      <Pressable style={styles.button} onPress={handleGoogleSignIn} disabled={loading}>
        <Text style={styles.secondaryButtonText}>Continuar con Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.background },
  title: {
    fontSize: 28,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  button: {
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  primaryButton: { backgroundColor: colors.cobalto, borderWidth: 0 },
  primaryButtonText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 15 },
  toggle: {
    marginTop: 16,
    textAlign: 'center',
    color: colors.cobalto,
    fontFamily: 'Inter_500Medium',
  },
  separator: { height: 20 },
});
