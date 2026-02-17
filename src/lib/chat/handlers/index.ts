import type { IntentHandler, Intent } from '../types'
import { handleSearchTournament } from './searchTournament'
import { handleViewBracket } from './viewBracket'
import { handleViewResults } from './viewResults'
import { handleViewRequirements } from './viewRequirements'
import { handleApplyTournament } from './applyTournament'
import { handleCancelEntry } from '../cancelFlow/handler'
import { handleHelp } from './help'

const handlers: Record<Intent, IntentHandler> = {
  SEARCH_TOURNAMENT: handleSearchTournament,
  VIEW_BRACKET: handleViewBracket,
  VIEW_RESULTS: handleViewResults,
  VIEW_REQUIREMENTS: handleViewRequirements,
  APPLY_TOURNAMENT: handleApplyTournament,
  CANCEL_ENTRY: handleCancelEntry,
  HELP: handleHelp,
}

/** Intent에 해당하는 핸들러 반환 (미매칭 시 HELP fallback) */
export function getHandler(intent: Intent): IntentHandler {
  return handlers[intent] ?? handleHelp
}
