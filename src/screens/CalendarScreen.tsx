// V4 (2026-05-24): 달력 — 연속 heat-map 모자이크.
//
// - 첫 줄 = 첫 일기가 포함된 주 (없으면 현재월). 그 아래로 미래 60개월까지 끝없이 이어짐.
// - 7열 격자, 셀 사이 GAP=3px. 월 사이 gap 없음 (연속 모자이크).
// - 1일 셀에 "M/D" 라벨로 시각적 월 경계.
// - floating 헤더가 viewable 최상단 row 기준으로 월 라벨 갱신 — row가 포함한 가장 늦은
//   month를 사용하므로 "전달 마지막 주에 다음달 첫 셀이 들어오면" 즉시 다음달로 바뀜.
// - 오늘 셀 = accent 테두리로 강조.
// - 헤더 우측 [첫 일기] [오늘] 버튼 — 해당 row가 화면 윗줄로 오게 점프.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { loadEntries } from '../lib/storage';
import type { DiaryEntry } from '../types';
import { MOOD_COLORS } from '../types';
import { COLORS, FONT } from '../lib/theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const GAP = 3;
const H_PADDING = 16;
const SCREEN_W = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_W - H_PADDING * 2 - GAP * 6) / 7;
const ROW_HEIGHT = CELL_SIZE + GAP;
const FUTURE_MONTHS = 60; // 미래 5년치 미리 렌더

type DayCell = {
  year: number;
  month: number;
  day: number;
  dateStr: string;
  isToday: boolean;
  entry?: DiaryEntry;
} | null;

type Row = {
  id: string;
  cells: DayCell[];
  labelYear: number;
  labelMonth: number;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateString(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function buildRows(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  entriesByDate: Map<string, DiaryEntry>,
  todayDs: string
): { rows: Row[]; firstEntryRowIndex: number; todayRowIndex: number } {
  const cells: DayCell[] = [];
  const firstWeekday = new Date(startYear, startMonth, 1).getDay();
  for (let i = 0; i < firstWeekday; i++) cells.push(null);

  const cursor = new Date(startYear, startMonth, 1);
  const end = new Date(endYear, endMonth + 1, 0);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const d = cursor.getDate();
    const ds = dateString(y, m, d);
    cells.push({
      year: y,
      month: m,
      day: d,
      dateStr: ds,
      isToday: ds === todayDs,
      entry: entriesByDate.get(ds),
    });
    cursor.setDate(d + 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: Row[] = [];
  let firstEntryRowIndex = -1;
  let todayRowIndex = -1;
  for (let i = 0; i < cells.length; i += 7) {
    const rowCells = cells.slice(i, i + 7);
    let labelY = startYear;
    let labelM = startMonth;
    for (const c of rowCells) {
      if (!c) continue;
      if (c.year > labelY || (c.year === labelY && c.month > labelM)) {
        labelY = c.year;
        labelM = c.month;
      }
    }
    const rowIdx = i / 7;
    if (firstEntryRowIndex === -1 && rowCells.some((c) => c?.entry)) {
      firstEntryRowIndex = rowIdx;
    }
    if (todayRowIndex === -1 && rowCells.some((c) => c?.isToday)) {
      todayRowIndex = rowIdx;
    }
    rows.push({
      id: `r${rowIdx}`,
      cells: rowCells,
      labelYear: labelY,
      labelMonth: labelM,
    });
  }
  return { rows, firstEntryRowIndex, todayRowIndex };
}

function getRange(firstEntryDate: Date | null): {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
} {
  const now = new Date();
  const startBase = firstEntryDate
    ? new Date(firstEntryDate.getFullYear(), firstEntryDate.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + FUTURE_MONTHS, 1);
  return {
    startYear: startBase.getFullYear(),
    startMonth: startBase.getMonth(),
    endYear: endDate.getFullYear(),
    endMonth: endDate.getMonth(),
  };
}

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [visibleLabel, setVisibleLabel] = useState<{ year: number; month: number } | null>(null);
  const [moodMode, setMoodMode] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);
  const didInitialScroll = useRef(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const data = await loadEntries();
        setEntries(data);
        setLoaded(true);
      })();
    }, [])
  );

  const { rows, firstEntryRowIndex, todayRowIndex } = useMemo(() => {
    const byDate = new Map<string, DiaryEntry>();
    let firstDate: Date | null = null;
    for (const e of entries) {
      byDate.set(e.date, e);
      const d = new Date(e.date + 'T00:00:00');
      if (!firstDate || d < firstDate) firstDate = d;
    }
    const { startYear, startMonth, endYear, endMonth } = getRange(firstDate);
    const now = new Date();
    const todayDs = dateString(now.getFullYear(), now.getMonth(), now.getDate());
    return buildRows(startYear, startMonth, endYear, endMonth, byDate, todayDs);
  }, [entries]);

  // 마운트 후 첫 진입 시 오늘 row가 윗줄로 오게 스크롤. 한 번만.
  useEffect(() => {
    if (!loaded || didInitialScroll.current || rows.length === 0 || todayRowIndex < 0) return;
    didInitialScroll.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: todayRowIndex,
        animated: false,
        viewPosition: 0,
      });
      const r = rows[todayRowIndex];
      setVisibleLabel({ year: r.labelYear, month: r.labelMonth });
    });
  }, [loaded, rows, todayRowIndex]);

  const jumpToRow = useCallback(
    (idx: number) => {
      if (idx < 0) return;
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
    },
    []
  );

  const handleDayPress = useCallback(
    (cell: DayCell) => {
      if (cell?.entry) navigation.navigate('Detail', { entryId: cell.entry.id });
    },
    [navigation]
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const top = viewableItems[0].item as Row;
      setVisibleLabel({ year: top.labelYear, month: top.labelMonth });
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 1 }).current;

  const renderRow = useCallback(
    ({ item }: { item: Row }) => (
      <View style={styles.row}>
        {item.cells.map((cell, i) => {
          if (!cell) return <View key={`pad-${i}`} style={styles.cellPad} />;
          const hasEntry = !!cell.entry;
          const isFirstOfMonth = cell.day === 1;
          const dateLabel = isFirstOfMonth ? `${cell.month + 1}/${cell.day}` : String(cell.day);

          // 기분 모드: 그림 대신 mood 색으로 셀 채움
          if (moodMode) {
            const moodColor = cell.entry?.mood ? MOOD_COLORS[cell.entry.mood] : null;
            return (
              <TouchableOpacity
                key={cell.dateStr}
                style={[
                  styles.cell,
                  moodColor ? { backgroundColor: moodColor } : null,
                  cell.isToday && styles.cellToday,
                ]}
                activeOpacity={hasEntry ? 0.7 : 1}
                onPress={() => handleDayPress(cell)}
                disabled={!hasEntry}
              >
                <Text
                  style={[
                    styles.cellDay,
                    isFirstOfMonth && styles.cellDayFirst,
                    cell.isToday && styles.cellDayToday,
                    moodColor && styles.cellDayOnImage,
                  ]}
                >
                  {dateLabel}
                </Text>
              </TouchableOpacity>
            );
          }

          // 기본 모드: 그림 썸네일
          const thumb =
            cell.entry?.imageThumbPath || cell.entry?.imageLocalPath || cell.entry?.imageUrl;
          return (
            <TouchableOpacity
              key={cell.dateStr}
              style={[styles.cell, cell.isToday && styles.cellToday]}
              activeOpacity={hasEntry ? 0.7 : 1}
              onPress={() => handleDayPress(cell)}
              disabled={!hasEntry}
            >
              {thumb ? (
                <>
                  <Image source={{ uri: thumb }} style={styles.cellImage} />
                  <View style={styles.cellOverlay} />
                  <Text style={[styles.cellDay, styles.cellDayOnImage]}>{dateLabel}</Text>
                </>
              ) : (
                <Text
                  style={[
                    styles.cellDay,
                    isFirstOfMonth && styles.cellDayFirst,
                    cell.isToday && styles.cellDayToday,
                  ]}
                >
                  {dateLabel}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    ),
    [handleDayPress, moodMode]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const headerLabel = visibleLabel ? `${visibleLabel.year}년 ${visibleLabel.month + 1}월` : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>달력</Text>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[
              styles.jumpButton,
              moodMode && styles.moodToggleActive,
            ]}
            onPress={() => setMoodMode((v) => !v)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.jumpButtonText,
                moodMode && styles.moodToggleActiveText,
              ]}
            >
              기분
            </Text>
          </TouchableOpacity>
          {firstEntryRowIndex >= 0 ? (
            <TouchableOpacity
              style={styles.jumpButton}
              onPress={() => jumpToRow(firstEntryRowIndex)}
              activeOpacity={0.7}
            >
              <Text style={styles.jumpButtonText}>첫 일기</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.jumpButtonPrimary}
            onPress={() => jumpToRow(todayRowIndex)}
            activeOpacity={0.7}
          >
            <Text style={styles.jumpButtonPrimaryText}>오늘</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.floatingHeader}>
        <Text style={styles.monthLabel}>{headerLabel}</Text>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={styles.weekdayText}>
              {d}
            </Text>
          ))}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0,
            });
          }, 200);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  topTitle: {
    fontFamily: FONT.title,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  jumpButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  jumpButtonText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
  },
  moodToggleActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  moodToggleActiveText: {
    color: COLORS.surface,
    fontWeight: '700',
  },
  jumpButtonPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  jumpButtonPrimaryText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    letterSpacing: 0.3,
  },

  floatingHeader: {
    backgroundColor: COLORS.background,
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  monthLabel: {
    fontFamily: FONT.uiHeavy,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT.ui,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.5,
  },

  listContent: {
    paddingTop: GAP,
    paddingBottom: 40,
  },

  row: {
    flexDirection: 'row',
    paddingHorizontal: H_PADDING,
    marginBottom: GAP,
    gap: GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  cellPad: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  cellImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  cellOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cellDay: {
    fontFamily: FONT.ui,
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '500',
    margin: 4,
  },
  cellDayFirst: {
    color: COLORS.text,
    fontWeight: '700',
  },
  cellDayToday: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  cellDayOnImage: {
    color: COLORS.surface,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
