import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { fetchAudioStream } from '../services/elevenlabs'

interface AudioContextType {
  playText: (text: string) => Promise<void>
  stopAudio: () => void
  isPlaying: boolean
  isLoading: boolean
}

const AudioContext = createContext<AudioContextType | null>(null)

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setIsPlaying(false)
    setIsLoading(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio()
    }
  }, [stopAudio])

  const playText = useCallback(async (text: string) => {
    stopAudio() // Stop any currently playing audio
    setIsLoading(true)

    // Browsers require Audio instantiation synchronously within the user gesture event.
    // Creating it *before* the network await unlocks the element to autoplay later.
    const audio = new Audio()
    audioRef.current = audio

    try {
      const audioBlob = await fetchAudioStream(text)
      
      if (!audioBlob || !audioRef.current) {
        setIsLoading(false)
        return
      }

      const audioUrl = URL.createObjectURL(audioBlob)
      audio.src = audioUrl

      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        console.error('Audio playback error')
        setIsPlaying(false)
        setIsLoading(false)
        URL.revokeObjectURL(audioUrl)
      }

      try {
        await audio.play()
        setIsPlaying(true)
      } catch (err) {
        console.error('Failed to play audio:', err)
      } finally {
        setIsLoading(false)
      }
    } catch (err: any) {
      console.error('TTS Pipeline Error:', err)
      alert(err.message || 'Failed to generate voice audio.')
      setIsLoading(false)
      setIsPlaying(false)
    }
  }, [stopAudio])

  return (
    <AudioContext.Provider value={{ playText, stopAudio, isPlaying, isLoading }}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}
