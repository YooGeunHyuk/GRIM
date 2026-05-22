import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { loadEntries, formatDate } from '../lib/storage';
import type { DiaryEntry } from '../types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getYearMonth(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() };
}

function getMonthDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }
  return cells;
}

function dateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return (
    year === now.getFullYear() &&
    month === now.getMonth() &&
    day === now.getDate()
  );
}

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { year, month } = getYearMonth(currentDate);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const data = await loadEntries();
        setEntries(data);
      })();
    }, []),
  );

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const entriesByDate = new Map<string, DiaryEntry>();
  for (const entry of entries) {
    entriesByDate.set(entry.date, entry);
  }

  const days = getMonthDays(year, month);

  const handleDayPress = (day: number) => {
    const dateStr = dateString(year, month, day);
    const entry = entriesByDate.get(dateStr);
    if (entry) {
      navigation.navigate('Detail', { entryId: entry.id });
    }
  };

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const headerLabel = `${year}년 ${month + 1}월`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{headerLabel}</Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday Headers */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((day) => (
            <View key={day} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={styles.dayCell} />;
            }

            const dateStr = dateString(year, month, day);
            const hasEntry = entriesByDate.has(dateStr);
            const today = isToday(year, month, day);

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayCell,
                  today && styles.todayCell,
                ]}
                onPress={() => handleDayPress(day)}
                activeOpacity={hasEntry ? 0.6 : 1}
              >
                <Text
                  style={[
                    styles.dayText,
                    today && styles.todayText,
                    hasEntry && styles.dayTextWithEntry,
                  ]}
                >
                  {day}
                </Text>
                {hasEntry && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Entries List */}
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>최근 그림일기</Text>
          {sortedEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                아직 작성한 일기가 없어요.{'\n'}오늘의 하루를 기록해보세요 ✍️
              </Text>
            </View>
          ) : (
            sortedEntries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryCard}
                onPress={() =>
                  navigation.navigate('Detail', { entryId: entry.id })
                }
                activeOpacity={0.7}
              >
                {entry.imageUrl ? (
                  <Image
                    source={{ uri: entry.imageUrl }}
                    style={styles.entryThumbnail}
                  />
                ) : (
                  <View style={styles.entryThumbnailPlaceholder}>
                    <Text style={styles.placeholderEmoji}>📝</Text>
                  </View>
                )}
                <View style={styles.entryInfo}>
                  <Text style={styles.entryDate}>
                    {formatDate(entry.date)}
                  </Text>
                  <Text style={styles.entryPreview} numberOfLines={2}>
                    {entry.content}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  /* Month Navigation */
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5EDE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#5C4033',
  },
  monthLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5C4033',
    letterSpacing: 0.5,
  },

  /* Weekday Headers */
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A0846B',
  },

  /* Calendar Grid */
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: '#F0E3D0',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  todayCell: {
    backgroundColor: '#D4E4FA',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3D2B1F',
  },
  todayText: {
    fontWeight: '700',
    color: '#2B5EA7',
  },
  dayTextWithEntry: {
    fontWeight: '600',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#4A90D9',
    marginTop: 2,
  },

  /* Recent Entries Section */
  recentSection: {
    marginTop: 28,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5C4033',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  emptyContainer: {
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0E3D0',
  },
  emptyText: {
    fontSize: 15,
    color: '#A0846B',
    textAlign: 'center',
    lineHeight: 22,
  },

  /* Entry Card */
  entryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  entryThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5EDE0',
  },
  entryThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5EDE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 24,
  },
  entryInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  entryDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7355',
    marginBottom: 4,
  },
  entryPreview: {
    fontSize: 14,
    color: '#3D2C1A',
    lineHeight: 20,
  },
});
