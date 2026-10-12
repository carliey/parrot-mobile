import type { TopicId } from "@/data/lessons";
export type Mode = "real";
export type LessonProgress = {
  completed_steps: number;
  total_steps: number;
  complete: boolean;
  instruction: string;
  hint: string;
  hint_english: string;
};
export class PracticeError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}
export type Feedback = {
  insufficient_evidence: boolean;
  tasks_completed: string[];
  expressions_used: string[];
  corrections: { original: string; suggested: string; explanation: string }[];
  phrases_to_review: string[];
  message: string;
};
export type Session = {
  session_id: string;
  access_token: string;
  provider_mode: Mode;
  initial_tutor_message: string;
  lesson_progress: LessonProgress;
};
export type Turn = {
  turn_id: string;
  tutor_response: string;
  processing_ms: number;
  provider_mode: Mode;
  lesson_progress: LessonProgress;
};
export interface TutorService {
  start(
    topic: TopicId,
    consent?: boolean,
    participantId?: string,
  ): Promise<Session>;
  turn(session: Session, turnId: string, text: string): Promise<Turn>;
  finish(session: Session): Promise<Feedback>;
}
export type AudioSubmission = {
  session_id: string;
  turn_id: string;
  local_audio_uri: string;
  mime_type: string;
};
export type TranscriptionResult = {
  turn_id: string;
  transcript: string;
  asr_model: string;
  processing_ms: number;
};
export interface SpeechService {
  synthesize(text: string): Promise<{ audio_uri: string }>;
}
const API = process.env.EXPO_PUBLIC_API_URL;
async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  if (!API) throw new Error("Set EXPO_PUBLIC_API_URL to the backend address.");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new PracticeError(
      error?.detail?.message ?? `Request failed (${response.status})`,
      error?.detail?.code,
    );
  }
  return response.json();
}
export class RealTutor implements TutorService {
  speech(session: Session, messageId: string) {
    return request<{ audio_base64: string; mime_type: string }>(
      `/sessions/${session.session_id}/speech/${encodeURIComponent(messageId)}`,
      "POST", undefined, session.access_token,
    );
  }
  start(topic: TopicId, consent = false, participantId = "") {
    return request<Session>("/sessions", "POST", {
      topic,
      consent,
      participant_id: participantId.trim() || null,
    });
  }
  turn(session: Session, turnId: string, text: string) {
    return request<Turn>(
      `/sessions/${session.session_id}/turns`,
      "POST",
      { turn_id: turnId, text },
      session.access_token,
    );
  }
  async transcribe(
    session: Session,
    turnId: string,
    uri: string,
  ): Promise<TranscriptionResult> {
    if (!API)
      throw new Error("Set EXPO_PUBLIC_API_URL to the backend address.");
    const [{ fetch: expoFetch }, { File }] = await Promise.all([
      import("expo/fetch"),
      import("expo-file-system"),
    ]);
    const file = new File(uri);
    if (__DEV__) console.info('[Voice upload] Preparing recording', {
      turnId, bytes: file.size, exists: file.exists,
    });
    if (!file.exists || file.size === 0)
      throw new Error('The recording file is empty. Hold the microphone and try again.');
    if (file.size > 5_000_000)
      throw new Error("Recording exceeds 5 MB. Try a shorter reply.");
    const response = await expoFetch(
      `${API}/sessions/${session.session_id}/transcriptions/${turnId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: file,
      },
    );
    if (__DEV__) console.info('[Voice upload] Backend responded', {
      turnId, status: response.status,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      if (__DEV__) console.info('[Voice upload] Transcription rejected', {
        turnId, code: error?.detail?.code,
      });
      throw new Error(
        error?.detail?.message ?? `Transcription failed (${response.status})`,
      );
    }
    const result: TranscriptionResult = await response.json();
    if (__DEV__) console.info('[Voice upload] Transcription received', {
      turnId, characters: result.transcript.length, processingMs: result.processing_ms,
    });
    return result;
  }
  async finish(session: Session) {
    const result = await request<{ feedback: Feedback }>(
      `/sessions/${session.session_id}/finish`,
      "POST",
      undefined,
      session.access_token,
    );
    return result.feedback;
  }
}
export const unavailableSpeech: SpeechService = {
  async synthesize() {
    throw new Error("Hausa speech playback is not configured yet.");
  },
};
