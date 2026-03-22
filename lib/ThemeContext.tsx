'use client'

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'

type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  theme: ThemeMode
  isDark: boolean
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'app_theme_mode'
const listeners = new Set<() => void>()

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function setTheme(nextTheme: ThemeMode) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
    }

    applyTheme(nextTheme)
    emitThemeChange()
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const value: ThemeContextValue = {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}

function subscribeToTheme(callback: () => void) {
  listeners.add(callback)

  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      callback()
    }
  }

  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

function emitThemeChange() {
  listeners.forEach((listener) => listener())
}

function getThemeSnapshot(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)
  return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'light'
}

function getServerThemeSnapshot(): ThemeMode {
  return 'light'
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('app-dark-mode', theme === 'dark')
}
