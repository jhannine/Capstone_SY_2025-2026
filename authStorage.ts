import AsyncStorage from '@react-native-async-storage/async-storage';

const FARM_ID_KEY = 'lato_farm_id';
const USER_KEY = 'user'; // dating 'lato_user' -- pinalitan para pareho sa key na ginagamit ng login.tsx / profile.tsx

// Tawagin ito pagkatapos ng successful login o register response
// (yung data.user galing mismo sa /login o /register).
export async function saveSession(user: { id: number; farm_id?: number | null; [key: string]: any }) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

  if (user.farm_id != null) {
    await AsyncStorage.setItem(FARM_ID_KEY, String(user.farm_id));
  }
}

// Tawagin ito sa monitor.tsx / alerts.tsx / history.tsx bago mag-fetch,
// para malaman kung anong farm_id ang gagamitin sa mga request.
// Fallback sa 1 kung walang session pa (hal. hindi pa naka-login).
export async function getFarmId(): Promise<number> {
  const stored = await AsyncStorage.getItem(FARM_ID_KEY);
  return stored ? Number(stored) : 1;
}

export async function getStoredUser(): Promise<any | null> {
  const stored = await AsyncStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

// Tawagin ito sa logout.
export async function clearSession() {
  await AsyncStorage.multiRemove([USER_KEY, FARM_ID_KEY]);
}
