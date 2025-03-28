import { toast } from "sonner"

type Subscriber = (
  isLoading: boolean,
  isPlaying: boolean,
  error?: string
) => void

class SingletonAudioPlayer {
  private static instance: SingletonAudioPlayer
  private audio: HTMLAudioElement | null = null
  private isLoading = false
  private isPlaying = false
  private subscribers: Subscriber[] = []
  private abortController: AbortController | null = null

  private constructor() {}

  public static getInstance(): SingletonAudioPlayer {
    if (!SingletonAudioPlayer.instance) {
      SingletonAudioPlayer.instance = new SingletonAudioPlayer()
    }
    return SingletonAudioPlayer.instance
  }

  private notifySubscribers(error?: string) {
    this.subscribers.forEach(subscriber =>
      subscriber(this.isLoading, this.isPlaying, error)
    )
  }

  private getPreferredAudioFormat(messageContent: string): string {
    const userAgent = navigator.userAgent.toLowerCase()
    if (messageContent.length > 2000) {
      return "wav"
    } else if (/iphone|ipad|ipod|android/.test(userAgent)) {
      return "aac"
    } else if (/chrome|firefox|safari/.test(userAgent)) {
      return "wav"
    } else {
      return "mp3"
    }
  }

  public subscribe(subscriber: Subscriber) {
    this.subscribers.push(subscriber)
    subscriber(this.isLoading, this.isPlaying)
  }

  public unsubscribe(subscriber: Subscriber) {
    this.subscribers = this.subscribers.filter(sub => sub !== subscriber)
  }

  public async playAudio(messageContent: string): Promise<void> {
    if (!messageContent.trim()) {
      const errorMessage = "Message content cannot be empty."
      console.error("Error generating speech:", errorMessage)
      toast.error(errorMessage)
      this.isLoading = false
      this.isPlaying = false
      this.notifySubscribers(errorMessage)
      return
    }

    const format = this.getPreferredAudioFormat(messageContent)

    this.stopAudio()

    this.abortController = new AbortController()

    this.isLoading = true
    this.isPlaying = false
    this.notifySubscribers()

    try {
      const response = await fetch("/api/chat/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: messageContent, format }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      this.audio = new Audio(audioUrl)

      this.audio.onended = () => this.handleAudioEnd()
      await this.audio.play()

      this.isLoading = false
      this.isPlaying = true
      this.notifySubscribers()
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Error generating speech:", error)
        toast.error(error.message)
      }
      this.isLoading = false
      this.isPlaying = false
      this.notifySubscribers(error.message)
    }
  }

  private handleAudioEnd() {
    this.isPlaying = false
    this.notifySubscribers()
  }

  public stopAudio() {
    this.audio?.pause()
    if (this.audio) {
      this.audio.currentTime = 0
      this.audio.onended = null
      this.audio = null
    }
    this.abortController?.abort()
    this.abortController = null
    this.isPlaying = false
    this.notifySubscribers()
  }
}

export default SingletonAudioPlayer.getInstance()
