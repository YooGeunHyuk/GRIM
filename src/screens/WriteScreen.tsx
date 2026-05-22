import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  SafeAreaView,
  StyleSheet,
  Platform,
} from 'react-native';
import type { DiaryEntry } from '../types';
import { generateImageUrl } from '../lib/imageGen';
import {
  upsertEntry,
  getEntryByDate,
  getTodayDate,
  generateId,
  formatDate,
} from '../lib/storage';

export default function WriteScreen() {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load today's existing entry on mount
  useEffect(() => {
    (async () => {
      const today = getTodayDate();
      const existing = await getEntryByDate(today);
      if (existing) {
        setContent(existing.content);
        setImageUrl(existing.imageUrl);
        setImagePrompt(existing.imagePrompt);
        setEntryId(existing.id);
        setExistingCreatedAt(existing.createdAt);
      }
      setLoaded(true);
    })();
  }, []);

  const handleGenerateImage = useCallback(() => {
    if (!content.trim()) {
      Alert.alert('알림', '먼저 오늘의 이야기를 적어주세요 ✍️');
      return;
    }

    setGenerating(true);
    setImageLoaded(false);
    setImageUrl(null);
    setImagePrompt(null);

    // generateImageUrl is synchronous — it builds the URL from content
    const url = generateImageUrl(content);
    if (!url) {
      Alert.alert('오류', '이미지를 생성할 수 없습니다. 내용을 확인해주세요.');
      setGenerating(false);
      return;
    }

    // Store the prompt used for regeneration
    setImagePrompt(content.slice(0, 100));
    setImageUrl(url);
  }, [content]);

  const handleImageLoadEnd = useCallback(() => {
    setGenerating(false);
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setGenerating(false);
    Alert.alert('오류', '이미지를 불러오지 못했습니다. 다시 시도해주세요.');
  }, []);

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      Alert.alert('알림', '오늘의 이야기를 적어주세요 ✍️');
      return;
    }

    setSaving(true);
    try {
      const today = getTodayDate();
      const now = new Date().toISOString();
      const id = entryId || generateId();

      const entry: DiaryEntry = {
        id,
        date: today,
        content: content.trim(),
        imageUrl,
        imagePrompt,
        createdAt: existingCreatedAt || now,
        updatedAt: now,
      };

      await upsertEntry(entry);
      setEntryId(id);
      Alert.alert('저장 완료', '오늘의 그림일기가 소중히 저장되었습니다 🌙');
    } catch {
      Alert.alert('오류', '저장 중 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [content, imageUrl, imagePrompt, entryId, existingCreatedAt]);

  const todayLabel = formatDate(getTodayDate());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: Date */}
        <View style={styles.header}>
          <Text style={styles.dateLabel}>{todayLabel}</Text>
          <Text style={styles.subtitle}>오늘의 그림일기</Text>
        </View>

        {/* Diary Text Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={content}
            onChangeText={setContent}
            placeholder="오늘은 어떤 하루였나요? 그림일기처럼 적어보세요... ✨"
            placeholderTextColor="#C4A98E"
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Image Generation Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.generateButton]}
          onPress={handleGenerateImage}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>🎨 그림 그리기!</Text>
        </TouchableOpacity>

        {/* Loading / Image Preview */}
        {generating && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D4A574" />
            <Text style={styles.loadingText}>
              그림일기를 그리고 있어요... 🖌️
            </Text>
          </View>
        )}

        {imageUrl && !generating && (
          <View style={styles.imagePreviewContainer}>
            {!imageLoaded && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="small" color="#D4A574" />
              </View>
            )}
            <Image
              source={{ uri: imageUrl }}
              style={styles.previewImage}
              resizeMode="contain"
              onLoadEnd={handleImageLoadEnd}
              onError={handleImageError}
            />
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              💾 오늘의 그림일기 저장하기
            </Text>
          )}
        </TouchableOpacity>

        {/* Bottom spacing for scroll */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 32,
    paddingBottom: 40,
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  dateLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5C4033',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#A0846B',
    marginTop: 4,
    fontWeight: '400',
  },

  /* Text Input – paper-like diary card */
  inputContainer: {
    backgroundColor: '#FFFDF7',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#C4A98E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
    borderWidth: 1,
    borderColor: '#F0E3D0',
  },
  textInput: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3D2B1F',
    minHeight: 220,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },

  /* Action Buttons */
  actionButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  generateButton: {
    backgroundColor: '#F5E6D3',
    borderWidth: 1.5,
    borderColor: '#E8D1B7',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5C4033',
  },
  saveButton: {
    backgroundColor: '#D4A574',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.7,
  },

  /* Loading State */
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#A0846B',
    fontWeight: '500',
  },

  /* Image Preview */
  imagePreviewContainer: {
    backgroundColor: '#FFFDF7',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#C4A98E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
    borderWidth: 1,
    borderColor: '#F0E3D0',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF7',
    zIndex: 1,
  },
  previewImage: {
    width: '100%',
    height: 320,
    borderRadius: 20,
  },

  bottomSpacer: {
    height: 32,
  },
});
