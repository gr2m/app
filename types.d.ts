export type ResponseEventType = "ack" | "done" | "text" | "copilot_references" | "copilot_confirmation" | "copilot_errors"
export type ResponseEvent<T extends ResponseEventType = "text"> = T extends "text" | "ack" | "done" ? {
  data: T extends "ack" ? CopilotAckResponseEventData : T extends "done" ? CopilotDoneResponseEventData : T extends "text" ? CopilotTextResponseEventData : never
  toString: () => string
} : {
  event: T
  data: T extends "copilot_references" ? CopilotReferenceResponseEventData : T extends "copilot_confirmation" ? CopilotConfirmationResponseEventData : T extends "copilot_errors" ? CopilotErrorsResponseEventData : never
  toString: () => string
}

export type CopilotAckResponseEventData = {
  choices: [{
    delta: {
      content: "", role: "assistant"
    }
  }]
}
export type CopilotDoneResponseEventData = {
  choices: [{
    finish_reason: "stop"
    delta: {
      content: "", role: "assistant"
    }
  }]
}
export type CopilotTextResponseEventData = {
  choices: [{
    delta: {
      content: string, role: "assistant"
    }
  }]
}
export type CopilotConfirmationResponseEventData = {
  type: 'action'; // Currently, 'action' is the only supported type
  title: string;
  message: string;
  confirmation?: {
    id: string;
    [key: string]: any;
  };
}
export type CopilotErrorsResponseEventData = CopilotError[]
export type CopilotReferenceResponseEventData = CopilotReference[]
export type CreateConfirmationEventOptions = {
  id: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export type CopilotError = {
  type: "reference" | "function" | "agent";
  code: string;
  message: string;
  identifier: string;
}

export interface CopilotReference {
  type: string;
  id: string;
  data?: {
    [key: string]: unknown;
  };
  is_implicit?: boolean;
  metadata?: {
    display_name: string;
    display_icon?: string;
    display_url?: string;
  };
}