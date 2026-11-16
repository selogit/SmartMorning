/** Mock AsyncStorage w pamięci — na potrzeby testów integracyjnych. */
const store = new Map<string, string>();

export default {
  getItem: async (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: async (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  clear: async () => {
    store.clear();
  },
  /** pomocnicze w testach */
  __reset: () => store.clear(),
  __dump: () => Object.fromEntries(store),
};
