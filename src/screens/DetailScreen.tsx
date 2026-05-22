import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { getEntry, deleteEntry, formatDate } from '../lib/storage';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { RootStackParamList, DiaryEntry } from '../types';

type DetailRouteProp = RouteProp<RootStackParamList, 'Detail'>;

export default function DetailScreen() {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation();
  const { entryId } = route.params;

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getEntry(entryId);
        setEntry(data ?? null);
      } catch {
        setEntry(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [entryId]);

  const handleDelete = () => {
    Alert.alert(
      '일기 삭제',
      '정말로 이 일기를 삭제하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entryId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B7355" />
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorText}>일기를 찾을 수 없습니다.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {entry.imageUrl && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: entry.imageUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.contentCard}>
          <Text style={styles.date}>{formatDate(entry.date)}</Text>
          <Text style={styles.content}>{entry.content}</Text>
        </View>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>삭제</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    padding: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F5EDE0',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B7355',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  content: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3D2C1A',
  },
  deleteButton: {
    backgroundColor: '#E8D5C4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B4513',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#E8D5C4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B4513',
  },
  errorText: {
    fontSize: 16,
    color: '#8B7355',
    marginBottom: 8,
  },
});
