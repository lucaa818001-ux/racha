import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RachaScreen from '../screens/RachaScreen';
import EjerciciosScreen from '../screens/EjerciciosScreen';
import FisicoScreen from '../screens/FisicoScreen';
import ObjetivoScreen from '../screens/ObjetivoScreen';
import PerfilScreen from '../screens/PerfilScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.cobalto,
    text: colors.textPrimary,
  },
};

export default function TabNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.cobalto,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 12 },
        }}
      >
        <Tab.Screen name="Racha" component={RachaScreen} />
        <Tab.Screen name="Ejercicios" component={EjerciciosScreen} />
        <Tab.Screen name="Físico" component={FisicoScreen} />
        <Tab.Screen name="Objetivo" component={ObjetivoScreen} />
        <Tab.Screen name="Perfil" component={PerfilScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
