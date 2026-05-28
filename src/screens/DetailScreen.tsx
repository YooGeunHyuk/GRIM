// V4 (2026-05-25): 일기 상세 + 3-entry track swipe + inline 편집.
//
// - prev / current / next 3개 entry를 한 row에 동시 렌더 (width = 3 * SCREEN_W)
// - 손가락 따라 묶음 translateX → 인접 entry가 실제로 따라옴
// - release threshold 넘으면 인접으로 animate + currentId 교체 + reset 0
// - current만 편집 가능 (EntryView editable). 인접은 read-only.

import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  PanResponder,
  PanResponderInstance,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  InputAccessoryView,
  Keyboard,
  Pressable,
  LayoutAnimation,
  UIManager,
  PlatformColor,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  loadEntries,
  upsertEntry,
  deleteEntry,
  formatDate,
  loadDraft,
  saveDraft,
  clearDraft,
} from '../lib/storage';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { RootStackParamList, DiaryEntry, Weather, Mood } from '../types';
import { WEATHERS, WEATHER_COLORS } from '../types';
import { MOOD_COLORS, MOODS } from '../types';
import { COLORS, FONT, SHADOW } from '../lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DetailRouteProp = RouteProp<RootStackParamList, 'Detail'>;

const BODY_FONT = 15;
const BODY_LINE_HEIGHT = 28;
const LINE_COLOR = COLORS.line;
const H_PADDING = 20;
const SWIPE_THRESHOLD = 80;
const SWIPE_VX = 0.3;
const SCREEN_W = Dimensions.get('window').width;
const ANIM_OUT = 200;
const SPRING_BACK = 220;

export default function DetailScreen() {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<any>();
  const initialId = route.params.entryId;

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string>(initialId);
  const [kbVisible, setKbVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const pan = useRef(new Animated.Value(0)).current;
  const animating = useRef(false);
  const doneHandlerRef = useRef<() => void>(() => Keyboard.dismiss());

  useEffect(() => {
    (async () => {
      try {
        const all = await loadEntries();
        all.sort((a, b) => a.date.localeCompare(b.date));
        setEntries(all);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const { currentEntry, prevEntry, nextEntry } = useMemo(() => {
    const i = entries.findIndex((e) => e.id === currentId);
    if (i < 0) {
      return {
        currentEntry: null as DiaryEntry | null,
        prevEntry: null as DiaryEntry | null,
        nextEntry: null as DiaryEntry | null,
      };
    }
    return {
      currentEntry: entries[i],
      prevEntry: i > 0 ? entries[i - 1] : null,
      nextEntry: i < entries.length - 1 ? entries[i + 1] : null,
    };
  }, [entries, currentId]);

  const handleEntryUpdate = useCallback((updated: DiaryEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  const swipeTo = useCallback(
    (toValue: number, newId: string) => {
      animating.current = true;
      Animated.timing(pan, {
        toValue,
        duration: ANIM_OUT,
        useNativeDriver: true,
      }).start(() => {
        // currentId 변경만 트리거 — pan 리셋은 아래 useLayoutEffect 가 commit 직후 처리.
        // useLayoutEffect 는 react render commit 이후 paint 전에 동기 실행되므로,
        // 새 entries 가 paint 되는 그 첫 frame 에 pan=0 도 함께 적용 → 깜빡임 없음.
        setCurrentId(newId);
      });
    },
    [pan]
  );

  // currentId 가 바뀌면 pan 을 0 으로 동기 리셋. swipe 애니메이션 후 entries 가 한 칸씩
  // 밀려 들어가는 사이 잘못된 slot 이 잠깐 보이는 깜빡임을 잡는다.
  useLayoutEffect(() => {
    pan.setValue(0);
    animating.current = false;
  }, [currentId, pan]);

  const springBack = useCallback(() => {
    Animated.timing(pan, {
      toValue: 0,
      duration: SPRING_BACK,
      useNativeDriver: true,
    }).start();
  }, [pan]);

  const panResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !animating.current &&
          !editing &&
          !dropdownOpen &&
          Math.abs(g.dx) > 12 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => {
          if (animating.current) return;
          let dx = g.dx;
          if (dx < 0 && !nextEntry) dx = dx / 3;
          if (dx > 0 && !prevEntry) dx = dx / 3;
          pan.setValue(dx);
        },
        onPanResponderRelease: (_, g) => {
          if (animating.current) return;
          const left = g.dx < -SWIPE_THRESHOLD || g.vx < -SWIPE_VX;
          const right = g.dx > SWIPE_THRESHOLD || g.vx > SWIPE_VX;
          if (left && nextEntry) swipeTo(-SCREEN_W, nextEntry.id);
          else if (right && prevEntry) swipeTo(SCREEN_W, prevEntry.id);
          else springBack();
        },
        onPanResponderTerminate: () => springBack(),
      }),
    [prevEntry, nextEntry, pan, swipeTo, springBack, editing, dropdownOpen]
  );

  const handleDelete = useCallback(() => {
    if (!currentEntry) return;
    Alert.alert(
      '일기 삭제',
      '정말로 이 일기를 삭제하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(currentEntry.id);
            navigation.goBack();
          },
        },
      ]
    );
  }, [currentEntry, navigation]);

  const handleDone = useCallback(() => {
    doneHandlerRef.current();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#C97B4A" />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentEntry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>일기를 찾을 수 없습니다.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // pan + baseline -SCREEN_W → current 항상 중앙
  const trackTranslateX = Animated.add(pan, new Animated.Value(-SCREEN_W));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.gestureLayer} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.track,
              { transform: [{ translateX: trackTranslateX }] },
            ]}
          >
            <View style={styles.page}>
              {prevEntry ? <EntryView entry={prevEntry} /> : <View />}
            </View>
            <View style={styles.page}>
              <EntryView
                entry={currentEntry}
                editable
                onUpdate={handleEntryUpdate}
                onDelete={handleDelete}
                onEditingChange={setEditing}
                onDropdownChange={setDropdownOpen}
                registerDoneHandler={(fn) => {
                  doneHandlerRef.current = fn;
                }}
              />
            </View>
            <View style={styles.page}>
              {nextEntry ? <EntryView entry={nextEntry} /> : <View />}
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* iOS = InputAccessoryView 로 시스템 액세서리 바를 우리 거로 대체 (이중 바·구분선 제거).
          Android = 기존 floating bar 유지 (Android엔 InputAccessoryView 미지원). */}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID="grim-kb-done">
          <View style={styles.kbBar}>
            <TouchableOpacity onPress={handleDone} activeOpacity={0.6} hitSlop={10}>
              <Text style={styles.kbBarDone}>완료</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      ) : (
        kbVisible && (
          <View style={styles.kbBar}>
            <TouchableOpacity onPress={handleDone} activeOpacity={0.6} hitSlop={10}>
              <Text style={styles.kbBarDone}>완료</Text>
            </TouchableOpacity>
          </View>
        )
      )}
    </KeyboardAvoidingView>
  );
}

/** 단일 entry 표시. editable이면 inline 편집 + 자동저장. */
function EntryView({
  entry,
  editable,
  onUpdate,
  onDelete,
  onEditingChange,
  onDropdownChange,
  registerDoneHandler,
}: {
  entry: DiaryEntry;
  editable?: boolean;
  onUpdate?: (updated: DiaryEntry) => void;
  onDelete?: () => void;
  onEditingChange?: (v: boolean) => void;
  onDropdownChange?: (v: boolean) => void;
  registerDoneHandler?: (fn: () => void) => void;
}) {
  const [content, setContent] = useState(entry.content);
  const [weather, setWeather] = useState<Weather | null>(entry.weather ?? null);
  const [mood, setMood] = useState<Mood | null>(entry.mood ?? null);
  const [editing, setEditing] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [lineYs, setLineYs] = useState<number[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  // editing change 알림
  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  // dropdown change 알림
  useEffect(() => {
    onDropdownChange?.(weatherOpen || moodOpen);
  }, [weatherOpen, moodOpen, onDropdownChange]);

  // entry 바뀌면 초기화 (editable이면 새 entry로 갈 일 거의 없음)
  useEffect(() => {
    setContent(entry.content);
    setWeather(entry.weather ?? null);
    setMood(entry.mood ?? null);
    setLineYs([]);
    setSavedAt(null);
    firstRender.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setTimeout(() => {
      firstRender.current = false;
    }, 0);
  }, [entry.id]);

  // 임시저장 — 수정 모드일 때만 드래프트에 기록. entry 본체는 안 건드림.
  // 완료 누르기 전엔 어디서 다시 봐도 옛 값 그대로. 사고 대비용 보존이 목적.
  useEffect(() => {
    if (!editable || !editing || firstRender.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveDraft(entry.id, { content, weather, mood });
        setSavedAt(Date.now());
      } catch {
        // 조용히
      }
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, weather, mood, editable, editing, entry.id]);

  const handleEnterEdit = useCallback(async () => {
    if (!editable) return;
    // 드래프트 있으면 복원 — 사용자가 이전에 임시저장한 변경부터 이어 편집
    try {
      const draft = await loadDraft(entry.id);
      if (draft) {
        if (draft.content !== undefined) setContent(draft.content);
        if (draft.weather !== undefined) setWeather(draft.weather);
        if (draft.mood !== undefined) setMood(draft.mood);
      }
    } catch {}
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [editable, entry.id]);

  // 완료 — entry 본체로 commit + 드래프트 정리 + 수정 종료
  const commitEdit = useCallback(async () => {
    Keyboard.dismiss();
    try {
      const updated: DiaryEntry = {
        ...entry,
        content: content.trim() || entry.content,
        weather,
        mood,
        updatedAt: new Date().toISOString(),
      };
      await upsertEntry(updated);
      await clearDraft(entry.id);
      onUpdate?.(updated);
    } catch {
      // 조용히
    }
    setEditing(false);
    setSavedAt(null);
  }, [entry, content, weather, mood, onUpdate]);

  // 키보드 바 완료 handler 등록 — chip 완료와 동일 동작 (commit).
  // commitEdit deps에 포함 — content/weather/mood 변경 시 새 commitEdit 다시 등록.
  useEffect(() => {
    if (!editable) return;
    registerDoneHandler?.(() => {
      void commitEdit();
    });
  }, [editable, registerDoneHandler, commitEdit]);

  const imageUri = entry.imageLocalPath || entry.imageUrl;
  const linesHeight = lineYs.length > 0 ? lineYs[lineYs.length - 1] : BODY_LINE_HEIGHT;

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      // 스크롤로 키보드 안 사라짐 — 긴 일기 편집 중 키보드 깜빡임 방지.
      // 빈 영역 탭은 keyboardShouldPersistTaps="handled" 가 dismiss 처리.
      keyboardDismissMode="none"
    >
      <View style={styles.header}>
        <Text style={styles.dateLabel}>{formatDate(entry.date)}</Text>
        <View style={styles.metaRow}>
          {editable && (
            <TouchableOpacity
              onPress={() => {
                if (editing) {
                  void commitEdit();
                } else {
                  void handleEnterEdit();
                }
              }}
              activeOpacity={0.6}
              style={[styles.metaChip, editing && styles.editChipActive]}
            >
              <Text
                style={[
                  styles.metaChipText,
                  editing && styles.editChipActiveText,
                ]}
              >
                {editing ? '완료' : '수정'}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.chipWrap}>
            <TouchableOpacity
              onPress={() => {
                // 수정 모드에서만 변경 가능 — 완성된 일기 보호
                if (!editable || !editing) return;
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMoodOpen(false);
                setWeatherOpen((v) => !v);
              }}
              activeOpacity={0.6}
              disabled={!editable || !editing}
              style={[
                styles.metaChip,
                weatherOpen && styles.metaChipActive,
                weather ? { borderColor: WEATHER_COLORS[weather] } : null,
              ]}
            >
              {weather ? (
                <View
                  style={[styles.moodDot, { backgroundColor: WEATHER_COLORS[weather] }]}
                />
              ) : null}
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
                    <View style={[styles.moodDot, { backgroundColor: WEATHER_COLORS[w] }]} />
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
                // 수정 모드에서만 변경 가능 — 완성된 일기 보호
                if (!editable || !editing) return;
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setWeatherOpen(false);
                setMoodOpen((v) => !v);
              }}
              activeOpacity={0.6}
              disabled={!editable || !editing}
              style={[
                styles.metaChip,
                moodOpen && styles.metaChipActive,
                mood ? { borderColor: MOOD_COLORS[mood] } : null,
              ]}
            >
              {mood ? (
                <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[mood] }]} />
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
                    <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[m] }]} />
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

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      )}

      <View style={[styles.bodyArea, { minHeight: linesHeight }]}>
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

        <Text
          style={[styles.content, editing && styles.contentHidden]}
          onTextLayout={(e) => {
            const ys = e.nativeEvent.lines.map((l) => l.y + l.height);
            setLineYs(ys);
          }}
        >
          {content || ' '}
        </Text>

        {editable && editing && (
          <TextInput
            ref={inputRef}
            style={[styles.content, styles.textInputOverlay]}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            autoCorrect
            spellCheck
            // iOS — 시스템 액세서리 바 대신 우리 InputAccessoryView 표시
            inputAccessoryViewID={Platform.OS === 'ios' ? 'grim-kb-done' : undefined}
            // 스크롤·다른 곳 터치로 키보드 내려가도 수정 모드는 유지 — 긴 일기 편집을 위해.
            // 종료는 chip "완료" 또는 키보드 바 "완료" 누를 때만.
          />
        )}
      </View>

      {editable ? (
        <View style={styles.bottomRow}>
          {editing ? (
            savedAt ? (
              <Text style={styles.savedLabel}>임시 저장됨 · 완료를 눌러야 저장돼요</Text>
            ) : (
              <Text style={styles.savedLabelMuted}>완료를 누르면 저장돼요</Text>
            )
          ) : (
            <Text style={styles.savedLabelMuted}>수정을 눌러 편집을 시작해요</Text>
          )}
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={10}
            activeOpacity={0.6}
            style={styles.deleteChip}
          >
            <Text style={styles.deleteChipText}>삭제</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
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
  gestureLayer: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    width: SCREEN_W * 3,
  },
  page: {
    width: SCREEN_W,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    paddingHorizontal: H_PADDING,
    paddingTop: 8,
    paddingBottom: 200,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateLabel: {
    fontFamily: FONT.title,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.3,
  },

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
  editChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  editChipActiveText: {
    color: COLORS.surface,
    fontWeight: '700',
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

  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.surface,
    marginBottom: 20,
    // 도화지 = 각진 모서리(border-radius 0 유지), 은은한 그림자 (DESIGN.md §그림 컨테이너)
    ...SHADOW.paper,
  },

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
  content: {
    fontFamily: FONT.body,
    fontSize: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    color: COLORS.text,
    padding: 0,
    margin: 0,
  },
  contentHidden: {
    opacity: 0,
  },
  textInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlignVertical: 'top',
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  savedLabel: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: COLORS.muted,
    letterSpacing: 0.3,
  },
  savedLabelMuted: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: '#C8BBAA',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  deleteChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  deleteChipText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    letterSpacing: 0.3,
  },

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

  errorText: {
    fontFamily: FONT.ui,
    fontSize: 15,
    color: COLORS.muted,
    marginBottom: 12,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  backButtonText: {
    fontFamily: FONT.ui,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
});
