import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, // ADDED: para sa spinner sa loading modal
  ImageBackground,
  KeyboardAvoidingView,
  Modal, // ADDED: para sa loading overlay
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false); // ADDED: loading state

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendLink = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setSubmitting(true); // ADDED: i-on ang loading bago mag-"send"

    // TODO: Trigger password reset email here
    // ADDED: simulated delay lang para makita yung loading modal.
    // Palitan mo na lang itong setTimeout ng actual request mo pagdating ng panahon.
    setTimeout(() => {
      setSubmitting(false); // ADDED: i-off ang loading pagkatapos
      setSent(true);
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ADDED: Loading Modal — lalabas sa gitna ng screen habang nagse-send */}
      <Modal visible={submitting} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingTitle}>Sending reset link...</Text>
            <Text style={styles.loadingSubtitle}>
              Please wait a moment
            </Text>
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

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/login')}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.logoCircle}>
            <Ionicons name="key-outline" size={40} color="#fff" />
          </View>
        </ImageBackground>

        {/* FORM CARD */}
        <View style={styles.formCard}>
          {!sent ? (
            <>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter the email address linked to your account and we'll send
                you a link to reset your password.
              </Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* EMAIL */}
              <Text style={styles.label}>Email Address</Text>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#888" />

                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!submitting} // ADDED: hindi na pwede mag-type habang loading
                />
              </View>

              {/* SEND BUTTON */}
              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.btnDisabled]} // ADDED: dimmed style habang loading
                onPress={handleSendLink}
                disabled={submitting} // ADDED: i-disable habang loading
              >
                {submitting ? ( // ADDED: palitan ng spinner kapag loading
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              {/* SIGN IN */}
              <View style={styles.signinRow}>
                <Text style={styles.signinText}>
                  Remembered your password?
                </Text>
                <TouchableOpacity onPress={() => router.push('/login')}>
                  <Text style={styles.signinLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.successState}>
              <View style={styles.successIcon}>
                <Ionicons name="mail-outline" size={34} color="#1E7B52" />
              </View>

              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successSubtitle}>
                We've sent a password reset link to{' '}
                <Text style={styles.successEmail}>{email.trim()}</Text>.
                Follow the instructions in the email to reset your password.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/login')}
              >
                <Text style={styles.primaryButtonText}>Back to Login</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendLink}
                onPress={() => setSent(false)}
              >
                <Text style={styles.resendLinkText}>
                  Didn't get it? Try again
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#1E7B52';
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

  backButton: {
    position: 'absolute',
    top: 55,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
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
    lineHeight: 21,
  },

  errorBox: {
    backgroundColor: '#FDECEC',
    borderLeftWidth: 4,
    borderLeftColor: RED,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    color: RED,
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

  primaryButton: {
    width: '100%',
    height: 55,
    borderRadius: 30,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,

    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
    gap: 5,
  },

  signinText: {
    color: '#666',
    fontSize: 14,
  },

  signinLink: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 14,
  },

  /* Success state */

  successState: {
    alignItems: 'center',
    paddingTop: 10,
  },

  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },

  successSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },

  successEmail: {
    fontWeight: '700',
    color: '#222',
  },

  resendLink: {
    marginTop: 16,
  },

  resendLinkText: {
    fontSize: 13,
    color: GREEN,
    fontWeight: '600',
  },

  btnDisabled: {
    // ADDED: para may visual cue na naka-disable ang button
    opacity: 0.7,
  },

  /* ADDED: Loading modal styles */

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
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },

  loadingSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: '#777',
  },
});
