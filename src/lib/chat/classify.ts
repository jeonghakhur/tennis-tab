import { GoogleGenAI, type Content } from '@google/genai'
import type { IntentClassification, ChatMessage } from './types'
import { buildSystemPrompt } from './prompts'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

/** 최대 히스토리 턴 수 (user+assistant 쌍) */
const MAX_HISTORY_TURNS = 5

/** HELP fallback 결과 */
const HELP_FALLBACK: IntentClassification = {
  intent: 'HELP',
  entities: {},
  confidence: 0,
  requires_auth: false,
}

/** Gemini API 할당량 초과 에러 */
export class GeminiQuotaError extends Error {
  constructor() {
    super('Gemini API 할당량이 초과되었습니다.')
    this.name = 'GeminiQuotaError'
  }
}

/** 대화 히스토리를 Gemini multi-turn Content 배열로 변환 */
function buildContents(history: ChatMessage[], currentMessage: string): Content[] {
  // 최근 N턴만 사용 (토큰 절약)
  const recent = history.slice(-(MAX_HISTORY_TURNS * 2))

  const contents: Content[] = recent.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }))

  // 현재 메시지 추가
  contents.push({ role: 'user', parts: [{ text: currentMessage }] })

  return contents
}

/** Gemini 2.0 Flash로 Intent 분류 + Entity 추출 */
export async function classifyIntent(
  message: string,
  history: ChatMessage[] = [],
): Promise<IntentClassification> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.')
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  const contents = history.length > 0
    ? buildContents(history, message)
    : message  // 히스토리 없으면 단일 문자열 (기존 동작 유지)

  let response
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 300,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('quota')) {
      throw new GeminiQuotaError()
    }
    throw error
  }

  const text = response.text ?? ''

  let result: IntentClassification
  try {
    result = JSON.parse(text) as IntentClassification
  } catch {
    return HELP_FALLBACK
  }

  if (typeof result.confidence !== 'number' || result.confidence < 0.7) {
    return { ...result, intent: 'HELP' }
  }

  return result
}
