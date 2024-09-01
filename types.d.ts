export interface CopilotRequest {
  headers: CopilotRequestHeaders
  payload: CopilotRequestPayload
}

export interface CopilotRequestHeaders {
  "x-github-token": string
  "github-public-key-identifier": string
  "github-public-key-signature": string
}

export interface CopilotRequestPayload {
  copilot_thread_id: string
  messages: Message[]
  stop: any
  top_p: number
  temperature: number
  max_tokens: number
  presence_penalty: number
  frequency_penalty: number
  copilot_skills: any[]
  agent: string
}

export interface Message {
  role: string
  content: string
  copilot_references: CopilotReference[]
  copilot_confirmations?: CopilotConfirmation[]
  name?: string
}

export interface CopilotReference {
  type: string
  data: CopilotReferenceData
  id: string
  is_implicit: boolean
  metadata: CopilotReferenceMetadata
}

export interface CopilotReferenceData {
  type: string
  id: number
  name?: string
  ownerLogin?: string
  ownerType?: string
  readmePath?: string
  description?: string
  commitOID?: string
  ref?: string
  refInfo?: CopilotReferenceDataRefInfo
  visibility?: string
  languages?: CopilotReferenceDataLanguage[]
  login?: string
  avatarURL?: string
  url?: string
}

export interface CopilotReferenceDataRefInfo {
  name: string
  type: string
}

export interface CopilotReferenceDataLanguage {
  name: string
  percent: number
}

export interface CopilotReferenceMetadata {
  display_name: string
  display_icon: string
  display_url: string
}

export interface CopilotConfirmation {
  state: string
  confirmation: {
    id: string
    [key: string]: unknown
  }
}