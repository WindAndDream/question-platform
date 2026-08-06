export type QuestionType = 'single' | 'multiple' | 'judgement'
export type AnswerStatus = 'unanswered' | 'correct' | 'incorrect'
export type StudyMode = 'memorize' | 'practice'

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ImageBlock {
  type: 'image'
  src: string
  alt: string
  caption?: string
  maxWidth?: string
}

export interface NoteBlock {
  type: 'note'
  title?: string
  text: string
}

export type ContentBlock = TextBlock | ImageBlock | NoteBlock
export type RichContent = string | ContentBlock[]

export interface QuestionOption {
  id: string
  content: RichContent
}

export interface ExportedQuestionState {
  selectedOptionIds: string[]
  status: AnswerStatus
  answeredAt?: string
}

export interface Question {
  id: string
  type: QuestionType
  stem: RichContent
  options?: QuestionOption[]
  answer: string[]
  explanation?: RichContent
  tags?: string[]
  difficulty?: 1 | 2 | 3 | 4 | 5
  source?: string
  state?: ExportedQuestionState
}

export interface QuestionBank {
  schemaVersion: 1
  id: string
  name: string
  description?: string
  version: string
  category?: string
  assetsBase?: string
  questions: Question[]
}

export interface BankManifestItem {
  id: string
  name: string
  file: string
  description?: string
}

export interface QuestionLibraryManifest {
  schemaVersion: 1
  libraryId: string
  name: string
  description?: string
  banks: BankManifestItem[]
}

export interface LoadedBank {
  libraryId: string
  libraryName: string
  manifestItem: BankManifestItem
  bank: QuestionBank
  configPath: string
}

export interface LoadedLibrary {
  id: string
  name: string
  description?: string
  sourceType: 'builtin' | 'folder' | 'zip' | 'json' | 'indexeddb'
  banks: LoadedBank[]
  assetPaths: string[]
}

export interface QuestionProgress {
  key: string
  libraryId: string
  bankId: string
  questionId: string
  selectedOptionIds: string[]
  status: AnswerStatus
  answeredAt?: string
  updatedAt: string
}

export interface RecordedQuestion {
  key: string
  libraryId: string
  libraryName: string
  bankId: string
  bankName: string
  questionId: string
  configPath: string
  assetsBase?: string
  question: Question
  progress?: QuestionProgress
  recordedAt: string
}

export interface StoredLibrary {
  id: string
  name: string
  description?: string
  sourceType: Exclude<LoadedLibrary['sourceType'], 'builtin' | 'indexeddb'>
  manifest: QuestionLibraryManifest
  banks: Array<{ path: string; bank: QuestionBank }>
  importedAt: string
}

export interface StoredAsset {
  key: string
  libraryId: string
  path: string
  blob: Blob
}

export interface AppPreferences {
  id: 'preferences'
  recordMode: boolean
  defaultStudyMode: StudyMode
  autoNext: boolean
  updatedAt: string
}
