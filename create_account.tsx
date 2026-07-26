import { API_BASE_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
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

export default function CreateAccountScreen() {
  const router = useRouter();

  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleCreateAccount = async () => {
    const trimmedFullname = fullname.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFullname || !trimmedEmail || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agree) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: trimmedFullname,
          email: trimmedEmail,
          password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessVisible(true);
      } else {
        setError(result.message || 'Unable to create account. Please try again.');
      }
    } catch (err) {
      console.log('CREATE ACCOUNT ERROR:', err);
      setError('Unable to connect to the server. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    setSuccessVisible(false);
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Success Modal */}
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Account Created Successfully!</Text>
            <TouchableOpacity style={styles.btnGotoLogin} onPress={goToLogin}>
              <Text style={styles.btnGotoLoginText}>Go to Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <ImageBackground
            source={require('../assets/images/lato_image.jpg')}
            style={styles.headerImage}
          >
            <View style={styles.overlay} />

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push('/login')}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>

            <View style={styles.logoCircle}>
              <Ionicons
                name="leaf"
                size={40}
                color="#fff"
              />
            </View>
          </ImageBackground>

          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>Account Info</Text>

            <Text style={styles.title}>
              Create Account
            </Text>

            <Text style={styles.subtitle}>
              Create your LatoMonitorPH account
            </Text>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Full Name</Text>

              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#888"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                  value={fullname}
                  onChangeText={setFullname}
                  editable={!submitting}
                />
              </View>

            <Text style={[styles.label,{marginTop:18}]}>
              Email Address
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#888"
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!submitting}
              />
            </View>

            <Text style={[styles.label,{marginTop:18}]}>
              Password
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#888"
              />

              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
              />

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={22}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label,{marginTop:18}]}>
              Confirm Password
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#888"
              />

              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#999"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!submitting}
              />

              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
              >
                <Ionicons
                  name={
                    showConfirm
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={22}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.optionRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setAgree(!agree)}
              >
                <Ionicons
                  name={
                    agree
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={18}
                  color="#1E7B52"
                />

                <Text style={styles.optionText}>
                  I agree to the Terms & Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.loginButton,
                submitting && styles.btnDisabled
              ]}
              onPress={handleCreateAccount}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginText}>
                    CREATE ACCOUNT
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.signinRow}>
              <Text style={styles.signinText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.signinLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#3aaa6e';
const GREEN_DARK = '#2a8a55';
const RED = '#e53935';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#b0c4b8' },
  scroll: {
    flexGrow: 1,
  },

  card: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
  },

  headerImage: {
  height: 260,
  justifyContent: 'center',
  alignItems: 'center',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },

  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backButton: {
    position: 'absolute',
    top: 55,
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardBody: {
    marginTop: -35,
    backgroundColor: '#fff',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 25,
    fontSize: 15,
    color: '#777',
  },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#222', marginBottom: 18 },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 30,
    paddingHorizontal: 16,
    height: 55,
  },

  loginButton: {
    height: 55,
    borderRadius: 30,
    backgroundColor: '#1E7B52',
    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  optionRow: {
    marginTop: 18,
    marginBottom: 28,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  optionText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#555',
  },
  errorBox: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  errorText: { color: RED, fontSize: 13 },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#222',
    paddingVertical: 0,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 2,
    marginBottom: 20,
  },
  termsText: {
    flex: 1,
    fontSize: 12.5,
    color: '#666',
    lineHeight: 19,
  },
  termsLink: { color: GREEN, fontWeight: '600' },

  btnDisabled: { opacity: 0.75 },
  
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  signinText: { fontSize: 13, color: '#666' },
  signinLink: { fontSize: 13, color: GREEN, fontWeight: '700' },

  // Success modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 24,
    width: 280,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 18,
    textAlign: 'center',
  },
  btnGotoLogin: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGotoLoginText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
