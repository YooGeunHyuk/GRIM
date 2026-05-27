// V4 (2026-05-25): 일기 상세 + 3-entry track swipe + inline 편집.
//
// - prev / current / next 3개 entry를 한 row에 동시 렌더 (width = 3 * SCREEN_W)
// - 손가락 따라 묶음 translateX → 인접 entry가 실제로 따라옴
// - release threshold 넘으면 인접으로 animate + currentId 교체 + reset 0
// - current만 편집 가능 (EntryView editable). 인접은 read-only.

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Keyboard,
  Pressable,
  LayoutAnimation,
  UIManager,
  PlatformColor,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadEntries, upsertEntry, deleteEntry, formatDate } from '../lib/storage';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { RootStackParamList, DiaryEntry, Weather, Mood } from '../types';
import { MOOD_COLORS, MOODS } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DetailRouteProp = RouteProp<RootStackParamList, 'Detail'>;

const WEATHERS: Weather[] = ['맑음', '구름조금', '흐림', '비', '소나기', '눈', '안개'];
const BODY_FONT = 15;
const BODY_LINE_HEIGHT = 28;
const LINE_COLOR = '#ECE2D3';
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
        // setCurrentId 먼저 → React가 새 entries 렌더 commit한 다음 프레임에 pan 리셋.
        // 같은 frame에 둘 다 하면 옛 entries가 새 baseline에 잠깐 보여 깜빡임 발생.
        setCurrentId(newId);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            pan.setValue(0);
            animating.current = false;
          });
        });
      });
    },
    [pan]
  );

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

  // 키보드 완료 handler 등록
  useEffect(() => {
    if (!editable) return;
    registerDoneHandler?.(() => {
      Keyboard.dismiss();
      setEditing(false);
    });
  }, [editable, registerDoneHandler]);

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

  // 자동저장 (editable만)
  useEffect(() => {
    if (!editable || firstRender.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const updated: DiaryEntry = {
          ...entry,
          content: content.trim() || entry.content,
          weather,
          mood,
          updatedAt: new Date().toISOString(),
        };
        await upsertEntry(updated);
        onUpdate?.(updated);
        setSavedAt(Date.now());
      } catch {
        // 조용히
      }
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, weather, mood, editable, entry, onUpdate]);

  const handleEnterEdit = useCallback(() => {
    if (!editable) return;
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [editable]);

  const imageUri = entry.imageLocalPath || entry.imageUrl;
  const linesHeight = lineYs.length > 0 ? lineYs[lineYs.length - 1] : BODY_LINE_HEIGHT;

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.header}>
        <Text style={styles.dateLabel}>{formatDate(entry.date)}</Text>
        <View style={styles.metaRow}>
          {editable && (
            <TouchableOpacity
              onPress={() => {
                if (editing) {
                  Keyboard.dismiss();
                  setEditing(false);
                } else {
                  handleEnterEdit();
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
                if (!editable) return;
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMoodOpen(false);
                setWeatherOpen((v) => !v);
              }}
              activeOpacity={0.6}
              disabled={!editable}
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
                if (!editable) return;
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setWeatherOpen(false);
                setMoodOpen((v) => !v);
              }}
              activeOpacity={0.6}
              disabled={!editable}
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
            onBlur={() => setEditing(false)}
          />
        )}
      </View>

      {editable ? (
        <View style={styles.bottomRow}>
          {savedAt ? (
            <Text style={styles.savedLabel}>자동 저장됨</Text>
          ) : (
            <Text style={styles.savedLabelMuted}>수정하면 자동으로 저장돼요</Text>
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
    backgroundColor: '#FBF6EE',
  },
  safe: {
    flex: 1,
    backgroundColor: '#FBF6EE',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#3A2E25',
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
    borderColor: '#ECE2D3',
  },
  metaChipActive: {
    borderColor: '#C97B4A',
  },
  editChipActive: {
    backgroundColor: '#C97B4A',
    borderColor: '#C97B4A',
  },
  editChipActiveText: {
    color: '#FFFDF8',
    fontWeight: '700',
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9B8979',
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
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#ECE2D3',
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
    backgroundColor: '#FBF6EE',
  },
  metaDropdownText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9B8979',
  },
  metaDropdownTextActive: {
    color: '#C97B4A',
    fontWeight: '700',
  },
  metaDropdownClear: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECE2D3',
    marginTop: 4,
  },
  metaDropdownClearText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9B8979',
    fontStyle: 'italic',
  },

  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#FFFDF8',
    marginBottom: 20,
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
    fontSize: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    color: '#3A2E25',
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
    fontSize: 11,
    color: '#9B8979',
    letterSpacing: 0.3,
  },
  savedLabelMuted: {
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
    borderColor: '#ECE2D3',
  },
  deleteChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9B8979',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#C97B4A',
    letterSpacing: 0.3,
  },

  errorText: {
    fontSize: 15,
    color: '#9B8979',
    marginBottom: 12,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C97B4A',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C97B4A',
  },
});
