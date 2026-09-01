const DB_NAME = 'cropai-private-offline'
const STORE = 'pending-scans'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(mode, operation) {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    operation(store, resolve, reject)
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => database.close()
  })
}

export const saveOfflineScan = (record) => transaction('readwrite', (store, resolve, reject) => {
  const request = store.put({ ...record, id: crypto.randomUUID(), createdAt: Date.now(), expiresAt: Date.now() + MAX_AGE_MS })
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
})

export const listOfflineScans = () => transaction('readonly', (store, resolve, reject) => {
  const request = store.getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error)
})

export const deleteOfflineScan = (id) => transaction('readwrite', (store, resolve, reject) => {
  const request = store.delete(id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error)
})

export async function purgeExpiredOfflineScans() {
  for (const record of await listOfflineScans()) if (record.expiresAt <= Date.now()) await deleteOfflineScan(record.id)
}
