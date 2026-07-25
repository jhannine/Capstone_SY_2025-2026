import { API_BASE_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const startLoginLoading = () => {
    setLoadingVisible(true);
    progressAnim.setValue(0);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      setLoadingVisible(false);
      setSubmitting(false);
      router.replace('/home');
    });
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Save the logged-in user's data so other screens (e.g. Profile)
        // can read it later without hitting the API again.
        await AsyncStorage.setItem('user', JSON.stringify(result.user));
        startLoginLoading();
      } else {
        setError(
          result.message || 'Invalid email or password. Please try again.'
        );
        setSubmitting(false);
      }
    } catch (err) {
      console.log('LOGIN ERROR:', err);
      setError(
        'Unable to connect to the server. Please check your connection.'
      );
      setSubmitting(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const GREEN = '#1E7B52';
  const RED = '#E53935';

  return (
  <KeyboardAvoidingView
    style={styles.safe}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    {/* Loading Modal */}
    <Modal visible={loadingVisible} transparent animationType="fade">
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingCard}>
          <Ionicons name="checkmark-circle" size={48} color={GREEN} />

          <Text style={styles.loadingTitle}>
            Logging in...
          </Text>

          <Text style={styles.loadingSubtitle}>
            Preparing your dashboard
          </Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth },
              ]}
            />
          </View>
        </View>
      </View>
    </Modal>

    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scroll}
    >

      {/* HEADER */}
      <ImageBackground
        source={require('../assets/images/lato_image.jpg')}
        style={styles.headerImage}
      >
        <View style={styles.overlay} />

        <View style={styles.logoCircle}>
          <Ionicons
            name="leaf"
            size={40}
            color="#fff"
          />
        </View>
      </ImageBackground>

      {/* FORM CARD */}
      <View style={styles.formCard}>

        <Text style={styles.title}>
          Welcome back
        </Text>

        <Text style={styles.subtitle}>
          Login to your account
        </Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        {/* EMAIL */}

        <Text style={styles.label}>
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

        {/* PASSWORD */}

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
            onPress={() =>
              setShowPassword(!showPassword)
            }
          >
            <Ionicons
              name={
                showPassword
                  ? 'eye-off-outline'
                  : 'eye-outline'
              }
              size={22}
              color="#888"
            />
          </TouchableOpacity>

        </View>

        {/* REMEMBER */}

        <View style={styles.optionRow}>

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() =>
              setRememberMe(!rememberMe)
            }
          >

            <Ionicons
              name={
                rememberMe
                  ? 'checkbox'
                  : 'square-outline'
              }
              size={18}
              color={GREEN}
            />

            <Text style={styles.optionText}>
              Remember Me
            </Text>

          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              router.push('/forgot_password')
            }
          >

            <Text style={styles.forgotText}>
              Forgot Password?
            </Text>

          </TouchableOpacity>

        </View>

        {/* LOGIN BUTTON */}

        <TouchableOpacity
          style={[
            styles.loginButton,
            submitting && styles.btnDisabled,
          ]}
          disabled={submitting}
          onPress={handleLogin}
        >

          {submitting ? (
            <ActivityIndicator
              color="#fff"
            />
          ) : (
            <Text style={styles.loginText}>
              LOGIN
            </Text>
          )}

        </TouchableOpacity>

        {/* SIGN UP */}

        <View style={styles.signupRow}>

          <Text style={styles.signupText}>
            Don't have an account?
          </Text>

          <TouchableOpacity
            onPress={() =>
              router.push('/create_account')
            }
          >

            <Text style={styles.signupLink}>
              Sign Up
            </Text>

          </TouchableOpacity>

        </View>

      </View>

    </ScrollView>

  </KeyboardAvoidingView>
);
}

const GREEN = '#3aaa6e';
const RED = '#e53935';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },

  scroll: {
    flexGrow: 1,
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

  formCard: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -35,
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
    fontSize: 15,
    color: '#777',
    marginBottom: 25,
  },

  errorBox: {
    backgroundColor: '#FDECEC',
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    color: '#E53935',
    fontSize: 13,
  },

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

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#222',
  },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },

    flexDirection: 'row',
  },

  optionText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#555',

    color: '#1E7B52',
  },

    height: 55,
    justifyContent: 'center',
      height: 4,
    },

    elevation: 5,

  btnDisabled: {
  },

  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  signupRow: {
    flexDirection: 'row',
    marginTop: 28,
  },

  signupText: {
    color: '#666',
  },

  signupLink: {
    marginLeft: 5,
    color: '#1E7B52',
    fontWeight: '700',
    fontSize: 14,
  },

  /* Loading */

  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  loadingCard: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  loadingTitle: {
    marginTop: 14,
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
  },

  loadingSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: '#777',
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',

  progressFill: {
    height: '100%',
    backgroundColor: '#1E7B52',
});  },
    borderRadius: 999,
    marginTop: 20,
  },
    backgroundColor: '#E8F4EC',
  },

  progressTrack: {
    fontSize: 14,
    justifyContent: 'center',
    opacity: 0.7,
  },
      width: 0,
    shadowOffset: {
    shadowRadius: 8,
    shadowOpacity: 0.15,
    shadowColor: '#000',

    alignItems: 'center',
    backgroundColor: '#1E7B52',
    borderRadius: 30,
  loginButton: {
    fontWeight: '600',
    fontSize: 13,
  forgotText: {
  },
    alignItems: 'center',
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  optionText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#555',
  },

  forgotText: {
    fontSize: 13,
    color: '#1E7B52',
    fontWeight: '600',
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

  btnDisabled: {
    opacity: 0.7,
  },

  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },

  signupText: {
    color: '#666',
    fontSize: 14,
  },

  signupLink: {
    marginLeft: 5,
    color: '#1E7B52',
    fontWeight: '700',
    fontSize: 14,
  },

  /* Loading */

  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  loadingCard: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  loadingTitle: {
    marginTop: 14,
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
  },

  loadingSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: '#777',
  },

  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#E8F4EC',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 20,
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#1E7B52',
    borderRadius: 999,
  },
});
