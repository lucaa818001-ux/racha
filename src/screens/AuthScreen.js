import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabase';

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
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title={loading ? 'Cargando...' : modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
        onPress={handleSubmit}
        disabled={loading}
      />
      <Text style={styles.toggle} onPress={() => setModoRegistro(!modoRegistro)}>
        {modoRegistro ? '¿Ya tenés cuenta? Iniciar sesión' : '¿No tenés cuenta? Crear una'}
      </Text>
      <View style={styles.separator} />
      <Button title="Continuar con Google" onPress={handleGoogleSignIn} disabled={loading} color="#DB4437" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, marginBottom: 24, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  toggle: { marginTop: 16, textAlign: 'center', color: '#2563eb' },
  separator: { height: 24 },
});
