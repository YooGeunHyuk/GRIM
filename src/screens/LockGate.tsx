// V4 (2026-05-25): 앱 잠금 게이트.
//
// - 앱 시작 시 Face ID / Touch ID / 디바이스 passcode로 인증
// - 인증 안 됨 = 콘텐츠 숨김. 자동 재시도 + 수동 "다시 시도" 버튼
// - 디바이스에 생체 인증·암호 설정 없으면 통과 (인증 수단 없음)

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS } from '../lib/theme';

type Props = {
  children: React.ReactNode;
};

export default function LockGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [tried, setTried] = useState(false);

  const tryAuth = useCallback(async () => {
    setTried(true);
    try {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hw || !enrolled) {
        setAvailable(false);
        setUnlocked(true);
        return;
      }
      setAvailable(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: '일기를 열어주세요',
        cancelLabel: '취소',
        fallbackLabel: '비밀번호 입력',
        disableDeviceFallback: false,
      });
      if (result.success) setUnlocked(true);
    } catch {
      // 인증 자체 실패 — 그냥 lock 화면 유지
    }
  }, []);

  // 앱 최초 mount 시 1회 인증 시도
  useEffect(() => {
    tryAuth();
  }, [tryAuth]);

  // background → active 복귀 시 다시 잠금
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (available) setUnlocked(false);
      }
      if (state === 'active' && available && !unlocked) {
        tryAuth();
      }
    });
    return () => sub.remove();
  }, [available, unlocked, tryAuth]);

  if (unlocked) return <>{children}</>;

  return (
    <View style={styles.lock}>
      <Text style={styles.brand}>그림</Text>
      <Text style={styles.subtitle}>오늘의 하루를 그림으로</Text>
      {tried ? (
        <TouchableOpacity style={styles.button} onPress={tryAuth} activeOpacity={0.7}>
          <Text style={styles.buttonText}>잠금 해제</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  brand: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 48,
    letterSpacing: 0.3,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
});
