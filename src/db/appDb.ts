import Dexie, { type EntityTable } from 'dexie'
import type {
  AppPreferences,
  QuestionProgress,
  RecordedQuestion,
  StoredAsset,
  StoredLibrary,
} from '@/types/question'

class QuestionPlatformDatabase extends Dexie {
  progress!: EntityTable<QuestionProgress, 'key'>
  records!: EntityTable<RecordedQuestion, 'key'>
  libraries!: EntityTable<StoredLibrary, 'id'>
  assets!: EntityTable<StoredAsset, 'key'>
  preferences!: EntityTable<AppPreferences, 'id'>

  constructor() {
    super('electrician-question-platform')
    this.version(1).stores({
      progress: 'key, [libraryId+bankId], status, updatedAt',
      records: 'key, [libraryId+bankId], recordedAt',
      libraries: 'id, importedAt, sourceType',
      assets: 'key, libraryId, path',
      preferences: 'id',
    })
  }
}

export const appDb = new QuestionPlatformDatabase()
