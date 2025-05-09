import { PentestGPTContext } from "@/context/context"
import { createFileBasedOnExtension } from "@/db/files"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import mammoth from "mammoth"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"

interface FileProcessor {
  type: string
  process: (file: File) => Promise<ProcessedFile>
  simplifyType: (type: string) => string
}

interface ProcessedFile {
  content: string | ArrayBuffer | null
  type: string
}

// Constants
export const ACCEPTED_FILE_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "text/markdown",
  "application/pdf",
  "text/plain",
  "text/html"
].join(",")

const fileProcessors: Record<string, FileProcessor> = {
  image: {
    type: "image",
    async process(file: File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () =>
          resolve({ content: reader.result, type: "image" })
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
    simplifyType: () => "image"
  },
  docx: {
    type: "docx",
    async process(file: File) {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return { content: result.value, type: "docx" }
    },
    simplifyType: () => "docx"
  },
  pdf: {
    type: "pdf",
    async process(file: File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () =>
          resolve({ content: reader.result, type: "pdf" })
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })
    },
    simplifyType: () => "pdf"
  },
  text: {
    type: "text",
    async process(file: File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () =>
          resolve({ content: reader.result, type: "txt" })
        reader.onerror = reject
        reader.readAsText(file)
      })
    },
    simplifyType: (type: string) => {
      if (type.startsWith("text/")) return "txt"
      return type.split("/")[1] || "txt"
    }
  }
}

export const useSelectFileHandler = () => {
  const {
    profile,
    chatSettings,
    setNewMessageImages,
    setNewMessageFiles,
    setUseRetrieval
  } = useContext(PentestGPTContext)

  const [filesToAccept, setFilesToAccept] = useState(ACCEPTED_FILE_TYPES)

  useEffect(() => {
    handleFilesToAccept()
  }, [chatSettings?.model])

  const handleFilesToAccept = () => {
    const model = chatSettings?.model
    const FULL_MODEL = LLM_LIST.find(llm => llm.modelId === model)

    if (!FULL_MODEL) return

    setFilesToAccept(
      FULL_MODEL.imageInput
        ? `${ACCEPTED_FILE_TYPES},image/*`
        : ACCEPTED_FILE_TYPES
    )
  }

  const getFileProcessor = (file: File): FileProcessor => {
    if (file.type.includes("image")) return fileProcessors.image
    if (file.type.includes("docx") || file.type.includes("wordprocessingml"))
      return fileProcessors.docx
    if (file.type.includes("pdf")) return fileProcessors.pdf
    return fileProcessors.text
  }

  const validateFile = (file: File): boolean => {
    const sizeLimitMB = parseInt(
      process.env.NEXT_PUBLIC_USER_FILE_SIZE_LIMIT_MB || String(30)
    )
    const MB_TO_BYTES = (mb: number) => mb * 1024 * 1024
    const SIZE_LIMIT = MB_TO_BYTES(sizeLimitMB)

    if (file.size > SIZE_LIMIT) {
      toast.error(`File must be less than ${sizeLimitMB}MB`)
      return false
    }
    return true
  }

  const handleSelectDeviceFile = async (file: File) => {
    if (!profile || !chatSettings) return
    if (!validateFile(file)) return

    const loadingId = "loading-" + crypto.randomUUID()
    const processor = getFileProcessor(file)

    try {
      const { content, type } = await processor.process(file)
      const simplifiedType = processor.simplifyType(file.type)

      if (type === "image") {
        const imageUrl = URL.createObjectURL(file)
        setNewMessageImages(prev => [
          ...prev,
          {
            messageId: crypto.randomUUID(),
            path: "",
            base64: content as string,
            url: imageUrl,
            file
          }
        ])
        return
      }

      // Handle non-image files
      setNewMessageFiles(prev => [
        ...prev,
        {
          id: loadingId,
          name: file.name,
          type: simplifiedType,
          file,
          created_at: "",
          file_path: "",
          sharing: "",
          size: file.size,
          tokens: 0,
          updated_at: "",
          user_id: profile.user_id,
          message_id: null,
          chat_id: null
        }
      ])

      const fileData = {
        user_id: profile.user_id,
        file_path: "",
        name: file.name,
        size: file.size,
        tokens: 0,
        type: simplifiedType
      }

      const createdFile = await createFileBasedOnExtension(file, fileData)

      if (!createdFile) {
        toast.error(
          "File limit reached. Please delete some chats containing files."
        )
        setNewMessageFiles(prev => prev.filter(f => f.id !== loadingId))
        return
      }

      setNewMessageFiles(prev =>
        prev.map(item => (item.id === loadingId ? createdFile : item))
      )
      setUseRetrieval(true)
    } catch (error: any) {
      toast.error(`${error?.message}`, {
        duration: 10000
      })
      setNewMessageImages(prev => prev.filter(img => img.messageId !== "temp"))
      setNewMessageFiles(prev => prev.filter(f => f.id !== loadingId))
    }
  }

  return {
    handleSelectDeviceFile,
    filesToAccept
  }
}
