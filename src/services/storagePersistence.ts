export type StoragePersistenceStatus = 'persisted' | 'best-effort' | 'unsupported'

let persistencePromise: Promise<StoragePersistenceStatus> | undefined

export const ensurePersistentStorage = (): Promise<StoragePersistenceStatus> => {
  if (persistencePromise) return persistencePromise

  persistencePromise = (async () => {
    const storage = navigator.storage
    if (!storage?.persisted || !storage.persist) return 'unsupported'
    if (await storage.persisted()) return 'persisted'
    return (await storage.persist()) ? 'persisted' : 'best-effort'
  })().catch((reason: unknown) => {
    console.warn('无法申请浏览器持久存储：', reason)
    return 'best-effort'
  })

  return persistencePromise
}
