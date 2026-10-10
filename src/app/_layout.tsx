import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync();
export default function Layout(){return <Stack screenOptions={{headerStyle:{backgroundColor:'#F6F3EA'},headerTintColor:'#173B32',contentStyle:{backgroundColor:'#F6F3EA'}}}><Stack.Screen name="(tabs)" options={{headerShown:false}}/><Stack.Screen name="lesson/[topic]" options={{title:'Lesson'}}/><Stack.Screen name="session/[topic]" options={{title:'Practice'}}/></Stack>}
