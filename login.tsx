import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const [loadingVisible, setLoadingVisible] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const startLoginLoading = () => {
    setLoadingVisible(true);
    progressAnim.setValue(0);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1800,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      setLoadingVisible(false);
      router.replace('/home');
    });
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    // TEMP: bypass login — remove this when database is ready
    const loginSucceeded = true;

    if (loginSucceeded) {
      setError('');
      startLoginLoading();
    } else {
      setError('Invalid email or password. Please try again.');
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Modal visible={loadingVisible} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Ionicons name="checkmark-circle" size={42} color={GREEN} />
            <Text style={styles.loadingTitle}>Logging in...</Text>
            <Text style={styles.loadingSubtitle}>Preparing your dashboard</Text>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginCard}>
          <View style={[styles.cardHeader, { paddingTop: 60 }]}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person" size={40} color="rgba(255,255,255,0.85)" />
            </View>
            <Text style={styles.headerTitle}>LatoMonitorPH</Text>
            <Text style={styles.headerSubtitle}>IoT Lato Seaweed Farming</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.welcomeText}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>Sign in to your account</Text>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Email Address <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.passWrap}>
                <TextInput
                  style={[styles.input, styles.passInput]}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#aaa"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formExtras}>
              <TouchableOpacity
                style={styles.rememberLabel}
                onPress={() => setRememberMe((v) => !v)}
              >
                <Ionicons
                  name={rememberMe ? 'checkbox' : 'square-outline'}
                  size={16}
                  color={rememberMe ? GREEN : '#aaa'}
                />
                <Text style={styles.rememberText}>Remember Me</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/forgot_password')}>
                <Text style={styles.forgotLink}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btnLogin} onPress={handleLogin}>
              <Text style={styles.btnLoginText}>Login</Text>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/create_account')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#3aaa6e';
const RED = '#e53935';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#c8ddd0' },
  scroll: {
    flexGrow: 1,
  },

  loginCard: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
  },

  cardHeader: {
    backgroundColor: GREEN,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 21, fontWeight: '800' },
  headerSubtitle: { color: '#e3f3ea', fontSize: 12, marginTop: 4, fontWeight: '300' },

  cardBody: { padding: 24 },
  welcomeText: { marginBottom: 20 },
  welcomeTitle: { fontSize: 16, fontWeight: '800', color: '#222' },
  welcomeSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },

  errorBox: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  errorText: { color: RED, fontSize: 13 },

  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#222', marginBottom: 6 },
  required: { color: RED },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  passWrap: { position: 'relative', justifyContent: 'center' },
  passInput: { paddingRight: 42 },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },

  formExtras: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rememberLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rememberText: { fontSize: 13, color: '#222' },
  forgotLink: { fontSize: 13, color: GREEN, fontWeight: '600' },

  btnLogin: {
    width: '100%',
    paddingVertical: 13,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnLoginText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  signupText: { fontSize: 13, color: '#666' },
  signupLink: { fontSize: 13, color: GREEN, fontWeight: '700' },

  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  loadingTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  loadingSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#666',
  },
  progressTrack: {
    marginTop: 18,
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e6f3ec',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 999,
  },
});
