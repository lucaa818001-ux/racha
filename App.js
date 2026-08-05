import { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { supabase } from './src/lib/supabase';
import TabNavigator from './src/navigation/TabNavigator';
import AuthScreen from './src/screens/AuthScreen';
import { colors } from './src/theme/colors';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tiempoMinimoCumplido, setTiempoMinimoCumplido] = useState(false);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const temporizador = setTimeout(() => setTiempoMinimoCumplido(true), 1500);
    return () => clearTimeout(temporizador);
  }, []);

  if (loading || !fontsLoaded || !tiempoMinimoCumplido) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <Image source={require('./assets/icon.png')} style={styles.splashLogo} resizeMode="contain" />
        {fontsLoaded && <Text style={styles.splashTitulo}>KeepIt</Text>}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {session ? <TabNavigator /> : <AuthScreen />}
    </>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  splashLogo: { width: 96, height: 96, marginBottom: 16 },
  splashTitulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: colors.textPrimary },
});
