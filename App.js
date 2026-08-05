import { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
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
  const [mostrarSplash, setMostrarSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
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
    if (loading || !fontsLoaded) return;
    const temporizador = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => setMostrarSplash(false));
    }, 1000);
    return () => clearTimeout(temporizador);
  }, [loading, fontsLoaded]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {!loading && fontsLoaded && (session ? <TabNavigator /> : <AuthScreen />)}
      {mostrarSplash && (
        <Animated.View style={[styles.splash, { opacity: splashOpacity }]} pointerEvents="none">
          <Image
            source={require('./assets/lockup-horizontal-dark.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  splashLogo: { width: '42%', aspectRatio: 1080 / 660 },
});
