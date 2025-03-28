import { supabase } from "@/lib/supabase/browser-client"
import { Tables, TablesInsert, TablesUpdate } from "@/supabase/types"

export const getMessageById = async (messageId: string) => {
  const { data: message } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single()

  if (!message) {
    throw new Error("Message not found")
  }

  return message
}

export const getMessagesByChatId = async (
  chatId: string,
  limit = 20,
  lastSequenceNumber?: number
) => {
  let query = supabase
    .from("messages")
    .select("*, feedback(*), file_items (*)")
    .eq("chat_id", chatId)
    .order("sequence_number", { ascending: false })
    .limit(limit)

  if (lastSequenceNumber !== undefined) {
    query = query.lt("sequence_number", lastSequenceNumber)
  }

  const { data: messages } = await query

  if (!messages) {
    throw new Error("Messages not found")
  }

  return messages.reverse()
}

export const createMessage = async (message: TablesInsert<"messages">) => {
  const { data: createdMessage, error } = await supabase
    .from("messages")
    .insert([message])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdMessage
}

export const createMessages = async (
  messages: TablesInsert<"messages">[],
  newChatFiles: { id: string }[],
  chatId: string | null,
  setChatFiles?: React.Dispatch<React.SetStateAction<Tables<"files">[]>>
) => {
  const { data: createdMessages, error } = await supabase
    .from("messages")
    .insert(messages)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  const fileIds = newChatFiles
    .map(file => file.id)
    .filter(id => id !== undefined)

  if (fileIds.length > 0) {
    const { error: filesError } = await supabase
      .from("files")
      .update({ message_id: createdMessages[0].id, chat_id: chatId })
      .in("id", fileIds)
      .is("message_id", null)
      .select("*")

    if (setChatFiles) {
      setChatFiles(prev =>
        prev.map(file =>
          fileIds.includes(file.id)
            ? { ...file, message_id: createdMessages[0].id }
            : file
        )
      )
    }

    if (filesError) {
      throw new Error(filesError.message)
    }
  }

  return createdMessages
}

export const updateMessage = async (
  messageId: string,
  message: TablesUpdate<"messages">
) => {
  const { data: updatedMessage, error } = await supabase
    .from("messages")
    .update(message)
    .eq("id", messageId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedMessage
}

export const deleteMessage = async (messageId: string) => {
  const { error } = await supabase.from("messages").delete().eq("id", messageId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export async function deleteMessagesIncludingAndAfter(
  userId: string,
  chatId: string,
  sequenceNumber: number,
  retrieveFiles: boolean = false
) {
  let files: Tables<"files">[] = []
  if (retrieveFiles) {
    // Here we check if the edited message has a file, if so we retrieve it
    // and return it in the response and remove the association from the file and
    // the message so it doesnt get cascade deleted

    // console.log(
    //   "Fetching messages for chat:",
    //   chatId,
    //   "sequence:",
    //   sequenceNumber
    // )
    const { data: messagesData, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .eq("sequence_number", sequenceNumber)

    if (messagesError) {
      console.error("Error fetching messages:", messagesError)
      throw new Error(messagesError.message)
    }
    // console.log("Found messages:", messagesData)

    // console.log(
    //   "Fetching files for messages:",
    //   messagesData.map(m => m.id)
    // )
    const { data: filesData, error: filesError } = await supabase
      .from("files")
      .select("*")
      .in(
        "message_id",
        messagesData.map(message => message.id)
      )

    if (filesError) {
      console.error("Error fetching files:", filesError)
      throw new Error(filesError.message)
    }
    // console.log("Found files:", filesData)

    // console.log(
    //   "Updating files to remove message_id:",
    //   filesData.map(f => f.id)
    // )
    const { error: updateError } = await supabase
      .from("files")
      .update({ message_id: null })
      .in(
        "id",
        filesData.map(file => file.id)
      )

    if (updateError) {
      console.error("Error updating files:", updateError)
      throw new Error(updateError.message)
    }
    // console.log("Successfully updated files")

    files = filesData
  }

  const { error } = await supabase.rpc("delete_messages_including_and_after", {
    p_user_id: userId,
    p_chat_id: chatId,
    p_sequence_number: sequenceNumber
  })

  if (error) {
    return {
      files: files,
      success: false,
      error: "Failed to delete messages."
    }
  }

  return {
    files: files,
    success: true,
    error: null
  }
}
