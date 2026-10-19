import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { colors, fonts } from '@/components/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');

  const sendCode = useMutation({ mutationFn: () => api.sendCode(email.trim()), onSuccess: () => setStep('code') });
  const verify = useMutation({
    mutationFn: () => api.verifyCode(email.trim(), code),
    onSuccess: (data) => {
      signIn(data);
      // Only same-app paths, so a crafted link can't send people elsewhere.
      // The shop's own team lands in the admin; customers on their orders.
      const home = data.user.role === 'customer' ? '/orders' : '/admin';
      router.replace(next?.startsWith('/') ? (next as never) : home);
    },
  });

  const error = (step === 'email' ? sendCode.error : verify.error)?.message;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <>
            <Text style={styles.title}>Log in with your email</Text>
            <Text style={styles.body}>We’ll email you a 6-digit code. No password needed.</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              onSubmitEditing={() => EMAIL_RE.test(email.trim()) && sendCode.mutate()}
              style={styles.input}
              accessibilityLabel="Email address"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title="Send code"
              disabled={!EMAIL_RE.test(email.trim())}
              loading={sendCode.isPending}
              onPress={() => sendCode.mutate()}
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.body}>
              Sent to {email.trim()}. It expires in 10 minutes. Check your spam folder if it hasn’t arrived.
            </Text>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoFocus
              onSubmitEditing={() => code.length === 6 && verify.mutate()}
              style={[styles.input, styles.codeInput]}
              accessibilityLabel="Login code"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Log in" disabled={code.length !== 6} loading={verify.isPending} onPress={() => verify.mutate()} />
            <Button
              title="Use a different email"
              variant="secondary"
              onPress={() => {
                setCode('');
                verify.reset();
                setStep('email');
              }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 14, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
  body: { fontFamily: fonts.text, fontSize: 16, color: colors.text, lineHeight: 23 },
  input: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.text, fontSize: 17,
    color: colors.text,
  },
  codeInput: { fontFamily: fonts.text, fontSize: 26, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  error: { color: colors.danger, fontFamily: fonts.textSemi },
});
