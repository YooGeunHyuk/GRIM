// V4 (2026-05-24): 일기 쓰기 — 모드 분리 + 정확한 노트 라인.
//
// - read 모드: Text 컴포넌트로 표시 (스크롤만, 키보드 안 뜸). 본문 어디든 탭 → edit 진입.
// - edit 모드: TextInput. 키보드 위 toolbar "완료"로 빠져나옴.
// - 라인 위치: read 모드는 Text.onTextLayout, edit 모드도 미러 Text(invisible)로 동일 측정.
//   둘 다 동일 폰트/패딩/라인하이트라 글자와 라인이 같이 움직임.
// - 날씨: 한글 텍스트 칩. 닫힌 상태 1개 + 탭 시 펼침.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
  LayoutAnimation,
  UIManager,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Animated,
  Easing,
  PlatformColor,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DiaryEntry, Weather, Mood } from '../types';
import { MOODS, MOOD_COLORS } from '../types';
import { generateImage } from '../lib/imageGen';
import { COLORS, FONT, SHADOW } from '../lib/theme';
import {
  upsertEntry,
  getEntryByDate,
  getTodayDate,
  generateId,
  formatDate,
} from '../lib/storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEATHERS: Weather[] = ['맑음', '구름조금', '흐림', '비', '소나기', '눈', '안개'];
const STYLE_LIST: Array<'watercolor' | 'cartoon' | 'pendrawing' | 'crayon'> = [
  'watercolor',
  'cartoon',
  'pendrawing',
  'crayon',
];
const STYLE_LABELS: Record<string, string> = {
  watercolor: '수채화',
  cartoon: '카툰',
  pendrawing: '펜드로잉',
  crayon: '크레용',
};

const BODY_FONT = 15;
const BODY_LINE_HEIGHT = 28;
const LINE_COLOR = COLORS.line;
const H_PADDING = 20;

/** 그림 인화 중 — 도화지에 물감이 번지듯이 워터컬러 wash 효과.
 *  SVG RadialGradient로 가장자리가 부드럽게 페이드되는 원 → 진짜 번짐 인상. */
function InkCanvas() {
  const blobs = useRef(
    Array.from({ length: 6 }).map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops = blobs.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(v, {
            toValue: 1,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [blobs]);

  // 얼룩 정의: 위치(%) + 크기 + 색
  const config = [
    { top: '8%', left: '5%', size: 220, color: '#E8CBA5' },
    { top: '32%', left: '50%', size: 260, color: '#F0C26B' },
    { top: '55%', left: '0%', size: 200, color: '#F0A8B0' },
    { top: '10%', left: '55%', size: 180, color: COLORS.accent },
    { top: '48%', left: '30%', size: 230, color: '#B8A4C9' },
    { top: '62%', left: '55%', size: 200, color: '#A9C9C0' },
  ];

  return (
    <View style={inkStyles.canvas}>
      {blobs.map((v, i) => {
        const c = config[i];
        const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
        const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] });
        return (
          <Animated.View
            key={i}
            style={[
              inkStyles.blobWrap,
              {
                top: c.top as any,
                left: c.left as any,
                width: c.size,
                height: c.size,
                opacity,
                transform: [{ scale }],
              },
            ]}
          >
            <Svg width={c.size} height={c.size}>
              <Defs>
                <RadialGradient id={`g${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={c.color} stopOpacity="0.9" />
                  <Stop offset="60%" stopColor={c.color} stopOpacity="0.35" />
                  <Stop offset="100%" stopColor={c.color} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx={c.size / 2} cy={c.size / 2} r={c.size / 2} fill={`url(#g${i})`} />
            </Svg>
          </Animated.View>
        );
      })}
      <View style={inkStyles.label}>
        <Text style={inkStyles.labelText}>그림을 그리고 있어요</Text>
      </View>
    </View>
  );
}

const inkStyles = StyleSheet.create({
  canvas: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  blobWrap: {
    position: 'absolute',
  },
  label: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
});

export default function WriteScreen() {
  const [content, setContent] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [imageLocalPath, setImageLocalPath] = useState<string | null>(null);
  const [imageThumbPath, setImageThumbPath] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(null);
  const [regenerated, setRegenerated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedStyle, setSelectedStyle] =
    useState<'watercolor' | 'cartoon' | 'pendrawing' | 'crayon'>('watercolor');
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lineYs, setLineYs] = useState<number[]>([]);
  const [kbVisible, setKbVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setKbVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setKbVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const displayUri = imageLocalPath || imageUrl;
  const todayLabel = formatDate(getTodayDate());

  useEffect(() => {
    (async () => {
      const today = getTodayDate();
      const existing = await getEntryByDate(today);
      if (existing) {
        setContent(existing.content);
        setWeather(existing.weather ?? null);
        setMood(existing.mood ?? null);
        setImageLocalPath(existing.imageLocalPath ?? null);
        setImageThumbPath(existing.imageThumbPath ?? null);
        setImageUrl(existing.imageUrl ?? null);
        setImagePrompt(existing.imagePrompt ?? null);
        setEntryId(existing.id);
        setExistingCreatedAt(existing.createdAt);
        setRegenerated(!!existing.regenerated);
        if (existing.style) setSelectedStyle(existing.style as any);
      }
    })();
  }, []);

  const handleGenerateImage = useCallback(async () => {
    if (!content.trim()) {
      Alert.alert('알림', '먼저 오늘의 이야기를 적어주세요 ✍️');
      return;
    }
    // 재생성 1회 제한
    if (displayUri && regenerated) {
      Alert.alert(
        '안내',
        '오늘은 이미 다시 그렸어요. 한 그림을 곁에 둬보세요 🌙'
      );
      return;
    }
    Keyboard.dismiss();
    setEditing(false);
    // 화면 최상단으로 → 인화 캔버스가 보이게
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
    LayoutAnimation.configureNext(LayoutAnimation.create(900, 'easeInEaseOut', 'opacity'));
    setGenerating(true);
    setImageLocalPath(null);
    setImageThumbPath(null);
    setImageUrl(null);
    setImagePrompt(null);

    const wasFirst = !displayUri;
    try {
      const result = await generateImage(content, selectedStyle);
      if (result.error && !result.imageLocalPath && !result.imageUrl) {
        Alert.alert('생성 실패', result.error);
        setGenerating(false);
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.create(900, 'easeInEaseOut', 'opacity'));
      setImagePrompt(content.slice(0, 100));
      setImageLocalPath(result.imageLocalPath);
      setImageThumbPath(result.imageThumbPath);
      setImageUrl(result.imageUrl);
      // 두 번째 이상 = 재생성 사용 처리
      if (!wasFirst) setRegenerated(true);
      setGenerating(false);
      if (result.error) Alert.alert('알림', result.error);
    } catch {
      Alert.alert('오류', '그림을 못 받아왔어요. 잠시 후 다시 시도해주세요.');
      setGenerating(false);
    }
  }, [content, selectedStyle, displayUri, regenerated]);

  // 자동저장: 변경 시 1.2초 debounce → upsertEntry
  useEffect(() => {
    if (content.trim().length < 1) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const id = entryId || generateId();
        const now = new Date().toISOString();
        const entry: DiaryEntry = {
          id,
          date: getTodayDate(),
          content: content.trim(),
          weather,
          mood,
          imageLocalPath,
          imageThumbPath,
          imageUrl,
          imagePrompt,
          style: selectedStyle,
          regenerated,
          createdAt: existingCreatedAt || now,
          updatedAt: now,
        };
        await upsertEntry(entry);
        if (!entryId) setEntryId(id);
        setSavedAt(Date.now());
      } catch {
        // 자동저장 실패는 조용히 — 다음 변경에서 재시도
      }
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    content,
    weather,
    mood,
    imageLocalPath,
    imageThumbPath,
    imageUrl,
    imagePrompt,
    selectedStyle,
    regenerated,
    entryId,
    existingCreatedAt,
  ]);

  const handleEnterEdit = useCallback(() => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleDone = useCallback(() => {
    Keyboard.dismiss();
    setEditing(false);
  }, []);

  const linesHeight = lineYs.length > 0 ? lineYs[lineYs.length - 1] : BODY_LINE_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Header: 날짜 + 날씨 + 기분 (각각 인라인 드롭다운) */}
        <View style={styles.header}>
          <Text style={styles.dateLabel}>{todayLabel}</Text>
          <View style={styles.metaRow}>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setMoodOpen(false);
                  setWeatherOpen((v) => !v);
                }}
                activeOpacity={0.6}
                style={[styles.metaChip, weatherOpen && styles.metaChipActive]}
              >
                <Text style={styles.metaChipText}>{weather ?? '날씨'}</Text>
              </TouchableOpacity>
              {weatherOpen && (
                <View style={styles.metaDropdown}>
                  {WEATHERS.map((w) => (
                    <TouchableOpacity
                      key={w}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setWeather(w);
                        setWeatherOpen(false);
                      }}
                      activeOpacity={0.6}
                      style={[
                        styles.metaDropdownItem,
                        weather === w && styles.metaDropdownItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.metaDropdownText,
                          weather === w && styles.metaDropdownTextActive,
                        ]}
                      >
                        {w}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {weather && (
                    <TouchableOpacity
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setWeather(null);
                        setWeatherOpen(false);
                      }}
                      activeOpacity={0.6}
                      style={styles.metaDropdownClear}
                    >
                      <Text style={styles.metaDropdownClearText}>지움</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={styles.chipWrap}>
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setWeatherOpen(false);
                  setMoodOpen((v) => !v);
                }}
                activeOpacity={0.6}
                style={[
                  styles.metaChip,
                  moodOpen && styles.metaChipActive,
                  mood ? { borderColor: MOOD_COLORS[mood] } : null,
                ]}
              >
                {mood ? (
                  <View
                    style={[styles.moodDot, { backgroundColor: MOOD_COLORS[mood] }]}
                  />
                ) : null}
                <Text style={styles.metaChipText}>{mood ?? '기분'}</Text>
              </TouchableOpacity>
              {moodOpen && (
                <View style={styles.metaDropdown}>
                  {MOODS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setMood(m);
                        setMoodOpen(false);
                      }}
                      activeOpacity={0.6}
                      style={[
                        styles.metaDropdownItem,
                        mood === m && styles.metaDropdownItemActive,
                      ]}
                    >
                      <View
                        style={[styles.moodDot, { backgroundColor: MOOD_COLORS[m] }]}
                      />
                      <Text
                        style={[
                          styles.metaDropdownText,
                          mood === m && styles.metaDropdownTextActive,
                        ]}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {mood && (
                    <TouchableOpacity
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setMood(null);
                        setMoodOpen(false);
                      }}
                      activeOpacity={0.6}
                      style={styles.metaDropdownClear}
                    >
                      <Text style={styles.metaDropdownClearText}>지움</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 그림: 날짜와 본문 사이. 생성 중엔 울렁이는 그라데이션 캔버스. */}
        {(generating || displayUri) && (
          <View style={styles.imageBlock}>
            {generating && !displayUri ? (
              <InkCanvas />
            ) : displayUri ? (
              <Image source={{ uri: displayUri }} style={styles.imageCanvas} resizeMode="cover" />
            ) : null}
          </View>
        )}

        {/* 본문: read/edit 모드. 둘 다 동일 폰트/패딩 → 라인 같이 움직임. */}
        <View style={[styles.bodyArea, { minHeight: linesHeight }]}>
          {/* 라인 레이어 */}
          <View pointerEvents="none" style={[styles.linesLayer, { height: linesHeight }]}>
            {lineYs.map((y, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: y - 1,
                  height: 1,
                  backgroundColor: LINE_COLOR,
                }}
              />
            ))}
          </View>

          {/* read 모드의 표시 Text — 동시에 라인 측정용으로도 작동.
              edit 모드일 땐 invisible로 두고, content를 같은 메트릭으로 측정해 라인 계산. */}
          <Text
            style={[styles.bodyText, editing && styles.bodyTextHidden]}
            onTextLayout={(e) => {
              const ys = e.nativeEvent.lines.map((l) => l.y + l.height);
              setLineYs(ys);
            }}
          >
            {content || ' '}
          </Text>

          {!editing && (
            <Pressable
              onPress={handleEnterEdit}
              style={StyleSheet.absoluteFill}
              android_disableSound
            >
              {!content ? (
                <Text style={styles.placeholder}>오늘은 어떤 하루였나요?</Text>
              ) : null}
            </Pressable>
          )}

          {editing && (
            <TextInput
              ref={inputRef}
              style={[styles.bodyText, styles.textInputOverlay]}
              value={content}
              onChangeText={setContent}
              placeholder="오늘은 어떤 하루였나요?"
              placeholderTextColor="#C4A98E"
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              autoCorrect
              spellCheck
              onBlur={() => setEditing(false)}
            />
          )}
        </View>

        {/* 액션 */}
        <View style={styles.actionsBlock}>
          <View style={styles.styleAndGenerateRow}>
            <View style={styles.styleRow}>
              {STYLE_LIST.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.styleChip, selectedStyle === s && styles.styleChipActive]}
                  onPress={() => setSelectedStyle(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.styleChipLabel,
                      selectedStyle === s && styles.styleChipLabelActive,
                    ]}
                  >
                    {STYLE_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.generateButton,
                displayUri && regenerated && styles.generateButtonDisabled,
              ]}
              onPress={handleGenerateImage}
              activeOpacity={0.8}
              disabled={generating || (displayUri != null && regenerated)}
            >
              <Text
                style={[
                  styles.generateButtonText,
                  displayUri && regenerated && styles.generateButtonTextDisabled,
                ]}
              >
                {!displayUri
                  ? '✎ 그림 그리기'
                  : regenerated
                  ? '↻ 다시 그리기 (소진)'
                  : '↻ 다시 그리기 (1회)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 자동저장 상태 */}
          {savedAt ? (
            <Text style={styles.savedLabel}>자동 저장됨</Text>
          ) : (
            <Text style={styles.savedLabelMuted}>입력하면 자동으로 저장돼요</Text>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
      </SafeAreaView>

      {/* 키보드 toolbar: layout flow 안. KeyboardAvoidingView가 키보드만큼 padding 밀어줘서
          이 bar가 자연히 키보드 top에 붙음. */}
      {kbVisible && (
        <View style={styles.kbBar}>
          <TouchableOpacity onPress={handleDone} activeOpacity={0.6} hitSlop={10}>
            <Text style={styles.kbBarDone}>완료</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: H_PADDING,
    paddingTop: 8,
    paddingBottom: 200, // 키보드 위 여유 — 마지막 줄 안 가림
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateLabel: {
    fontFamily: FONT.title,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.3,
  },

  /* 날씨/기분 공용 chip */
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  chipWrap: {
    position: 'relative',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  metaChipActive: {
    borderColor: COLORS.accent,
  },
  metaChipText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    letterSpacing: 0.3,
  },
  moodDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  metaDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    paddingVertical: 6,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 100,
  },
  metaDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  metaDropdownItemActive: {
    backgroundColor: COLORS.background,
  },
  metaDropdownText: {
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.muted,
  },
  metaDropdownTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  metaDropdownClear: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    marginTop: 4,
  },
  metaDropdownClearText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    fontStyle: 'italic',
  },

  /* 키보드 toolbar — iOS 시스템 키보드와 동일 회색 (PlatformColor) */
  kbBar: {
    backgroundColor: Platform.OS === 'ios' ? (PlatformColor('systemGray6') as any) : '#F2F2F7',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 40,
  },
  kbBarDone: {
    fontFamily: FONT.uiBold,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 0.3,
  },


  /* 그림 영역 */
  imageBlock: {
    marginBottom: 20,
  },
  imageCanvas: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.surface,
    // 도화지 = 각진 모서리(border-radius 0 유지), 은은한 그림자 (DESIGN.md §그림 컨테이너)
    ...SHADOW.paper,
  },
  imageLoading: {
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  imageLoadingText: {
    marginTop: 12,
    fontFamily: FONT.ui,
    fontSize: 13,
    color: COLORS.muted,
  },

  /* 본문 */
  bodyArea: {
    marginBottom: 24,
    position: 'relative',
  },
  linesLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  bodyText: {
    fontFamily: FONT.body,
    fontSize: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    color: COLORS.text,
    padding: 0,
    margin: 0,
  },
  bodyTextHidden: {
    opacity: 0,
  },
  placeholder: {
    fontFamily: FONT.body,
    fontSize: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    color: '#C4A98E',
  },
  textInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlignVertical: 'top',
  },

  /* 키보드 toolbar */
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  accessoryDone: {
    fontFamily: FONT.uiBold,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 0.3,
  },

  /* 액션 */
  actionsBlock: {
    gap: 12,
  },
  styleAndGenerateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  styleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  styleChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: 'transparent',
  },
  styleChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surface,
  },
  styleChipLabel: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '500',
  },
  styleChipLabelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  generateButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  generateButtonDisabled: {
    borderColor: COLORS.line,
  },
  generateButtonText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    letterSpacing: 0.3,
  },
  generateButtonTextDisabled: {
    color: '#C8BBAA',
  },
  savedLabel: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'right',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  savedLabelMuted: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: '#C8BBAA',
    textAlign: 'right',
    marginTop: 4,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },

  bottomSpacer: {
    height: 32,
  },
});
