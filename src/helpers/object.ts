export function modifyObject(oldObj: any, newObj: any): any {
  const keys = Object.keys(newObj)
  for (const k of keys) {
    const value = newObj[k]
    if (!oldObj.hasOwnProperty(k)) continue
    const oldValue = oldObj[k]
    if (value !== undefined && value !== oldValue) oldObj[k] = value
  }
  return oldObj
}

export function listToMap<K, T>(list: T[], getKey: (data: T) => K): Map<K, T> {
  const retval = new Map<K, T>()
  for (const d of list) {
    const key = getKey(d)
    retval.set(key, d)
  }
  return retval
}

export function listEntityToIdMap<T extends { id: string }>(
  list: T[],
): Map<string, T> {
  return listToMap<string, T>(list, (d) => d.id)
}
