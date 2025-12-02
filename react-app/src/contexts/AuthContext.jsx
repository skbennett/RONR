// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const session = data?.session ?? null
        if (!mounted) return
        setUser(session?.user ?? null)
        setIsAuthenticated(!!session?.user)
      } catch (err) {
        console.error('Error getting initial session from Supabase:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    initAuth()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsAuthenticated(!!session?.user)
    })

    return () => {
      mounted = false
      if (listener?.subscription) listener.subscription.unsubscribe()
    }
  }, [])

  // accept an optional username to save in the user's metadata on sign up
  const signUp = async (email, password, username) => {
    // pass username into the user metadata and display_name when creating the account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        displayName: username
      }
    })
    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error signing out:', error)
    setUser(null)
    setIsAuthenticated(false)
    return { error }
  }

  const value = {
    isAuthenticated,
    user,
    isLoading,
    signUp,
    signIn,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
