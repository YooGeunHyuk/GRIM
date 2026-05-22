export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  imageUrl: string | null;
  imagePrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RootStackParamList = {
  Main: undefined;
  Detail: { entryId: string };
};
