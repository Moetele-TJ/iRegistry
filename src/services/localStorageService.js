// src/services/localStorageService.js
const STORAGE_KEY = "ireg_items_v1";

export const localStorageService = {
  loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load items from localStorage", e);
      return null;
    }
  },
  saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save items to localStorage", e);
    }
  },
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
};