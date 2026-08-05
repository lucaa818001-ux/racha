import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RachaScreen from '../screens/RachaScreen';
import EjerciciosScreen from '../screens/EjerciciosScreen';
import FisicoScreen from '../screens/FisicoScreen';
import ObjetivoScreen from '../screens/ObjetivoScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Racha" component={RachaScreen} />
        <Tab.Screen name="Ejercicios" component={EjerciciosScreen} />
        <Tab.Screen name="Físico" component={FisicoScreen} />
        <Tab.Screen name="Objetivo" component={ObjetivoScreen} />
        <Tab.Screen name="Perfil" component={PerfilScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
