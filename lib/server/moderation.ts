import OpenAI from "openai"

var MODERATION_CHAR_LIMIT = 1000

export async function getModerationResult(
  messages: any[],
  openaiApiKey: string,
  hackerRAGMinLength: number,
  isLargeModel: boolean
): Promise<{ shouldUncensorResponse: boolean }> {
  var openai = new OpenAI({ apiKey: openaiApiKey })

  // Find the last user message that exceeds the minimum length
  var targetMessage = findTargetMessage(messages, hackerRAGMinLength)

  if (!targetMessage) {
    return { shouldUncensorResponse: false }
  }

  var input = prepareInput(targetMessage)

  try {
    var moderation = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: input
    })

    var result = moderation.results[0]
    var moderationLevel = calculateModerationLevel(result.category_scores)
    var hazardCategories = Object.entries(result.categories)
      .filter(([, isFlagged]) => isFlagged)
      .map(([category]) => category)

    var shouldUncensorResponse = determineShouldUncensorResponse(
      moderationLevel,
      hazardCategories,
      isLargeModel
    )

    // console.log(
    //   JSON.stringify(moderation, null, 2),
    //   moderationLevel,
    //   hazardCategories,
    //   shouldUncensorResponse
    // )

    return { shouldUncensorResponse }
  } catch (error: any) {
    console.error("Error in getModerationResult:", error)
    return { shouldUncensorResponse: false }
  }
}

function findTargetMessage(messages: any[], minLength: number): any | null {
  let userMessagesChecked = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    var message = messages[i]
    if (message.role === "user") {
      userMessagesChecked++
      if (
        typeof message.content === "string" &&
        message.content.length > minLength
      ) {
        return message
      }
      if (userMessagesChecked >= 3) {
        break // Stop after checking three user messages
      }
    }
  }

  return null
}

function prepareInput(
  message: any
): string | OpenAI.Moderations.ModerationCreateParams["input"] {
  if (typeof message.content === "string") {
    return message.content.slice(0, MODERATION_CHAR_LIMIT)
  } else if (Array.isArray(message.content)) {
    return message.content.reduce((acc: any[], item: any) => {
      if (item.type === "text") {
        var truncatedText = item.text.slice(
          0,
          MODERATION_CHAR_LIMIT - acc.join("").length
        )
        if (truncatedText.length > 0) {
          acc.push({ ...item, text: truncatedText })
        }
      } else if (
        item.type === "image_url" &&
        !acc.some(i => i.type === "image_url")
      ) {
        acc.push(item)
      }
      return acc
    }, [])
  }
  return ""
}

function calculateModerationLevel(
  categoryScores: OpenAI.Moderations.Moderation.CategoryScores
): number {
  var maxScore = Math.max(...Object.values(categoryScores))
  return Math.min(Math.max(maxScore, 0), 1)
}

function determineShouldUncensorResponse(
  moderationLevel: number,
  hazardCategories: string[],
  isLargeModel: boolean
): boolean {
  var forbiddenCategories = [
    "sexual",
    "sexual/minors",
    "hate",
    "hate/threatening",
    "harassment",
    "harassment/threatening",
    "self-harm",
    "self-harm/intent",
    "self-harm/instruction",
    "violence",
    "violence/graphic"
  ]
  var hasForbiddenCategory = hazardCategories.some(category =>
    forbiddenCategories.includes(category)
  )

  var minModerationLevel = isLargeModel ? 0.4 : 0.4
  var maxModerationLevel = 1.0
  return (
    moderationLevel >= minModerationLevel &&
    moderationLevel <= maxModerationLevel &&
    !hasForbiddenCategory
  )
}
