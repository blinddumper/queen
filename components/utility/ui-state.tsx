"use client"

import { UIContext } from "@/context/ui-context"
import { PluginID } from "@/types/plugins"
import { FC, useEffect, useState } from "react"
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state"
import { AgentStatusState } from "../messages/agent-status"

interface UIStateProps {
  children: React.ReactNode
}

export const UIState: FC<UIStateProps> = ({ children }) => {
  // ENHANCE MENU
  const [isEnhancedMenuOpen, setIsEnhancedMenuOpen] = useLocalStorageState(
    "isEnhancedMenuOpen",
    false
  )
  const [selectedPluginType, setSelectedPluginType] = useState("")
  const [selectedPlugin, setSelectedPlugin] = useState(PluginID.NONE)

  // CHAT INPUT COMMAND
  const [slashCommand, setSlashCommand] = useState("")

  // UI States
  const [isMobile, setIsMobile] = useState(false)
  const [isReadyToChat, setIsReadyToChat] = useState(true)
  const [showSidebar, setShowSidebar] = useLocalStorageState(
    "showSidebar",
    false
  )
  const [showTerminalOutput, setShowTerminalOutput] = useLocalStorageState(
    "showTerminalOutput",
    true
  )

  // Tools UI
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false)
  const [focusTool, setFocusTool] = useState(false)
  const [toolInUse, setToolInUse] = useState("none")

  // Agent states
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null)

  // Loading States
  const [isGenerating, setIsGenerating] = useState(false)
  const [firstTokenReceived, setFirstTokenReceived] = useState(false)

  // Handle window resize to update isMobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640)
    }

    // Set initial value
    setIsMobile(window.innerWidth <= 640)

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <UIContext.Provider
      value={{
        // ENHANCE MENU
        isEnhancedMenuOpen,
        setIsEnhancedMenuOpen,
        selectedPluginType,
        setSelectedPluginType,
        selectedPlugin,
        setSelectedPlugin,

        // CHAT INPUT COMMAND
        slashCommand,
        setSlashCommand,

        // UI States
        isMobile,
        isReadyToChat,
        setIsReadyToChat,
        showSidebar,
        setShowSidebar,
        showTerminalOutput,
        setShowTerminalOutput,

        // Tools UI
        isToolPickerOpen,
        setIsToolPickerOpen,
        focusTool,
        setFocusTool,
        toolInUse,
        setToolInUse,

        // Agent states
        agentStatus,
        setAgentStatus,

        // Loading States
        isGenerating,
        setIsGenerating,
        firstTokenReceived,
        setFirstTokenReceived
      }}
    >
      {children}
    </UIContext.Provider>
  )
}
