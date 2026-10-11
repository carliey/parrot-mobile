# Parrot Hausa mobile

An Expo SDK 57 app with two tabs: Learn and Practice. The two topics are Greetings and Buying Things. Phrase content in `src/data/lessons.ts` has stable IDs and version `draft-1`; Hausa text and the plain-English pronunciation hints are **awaiting language review**. No audio examples are enabled until reviewed assets or a working Hausa TTS service exists.

## Start

```
npm install
npx expo start
```

Expo Go should support the installed SDK 57 `expo-audio`, `expo-file-system` modules. A development build is not expected for these features. Test microphone permission and recording cleanup on a physical iOS or Android device. Lesson completion is saved locally using a small local JSON file (browser localStorage on web). No account is needed.

Practice connects to the N-ATLAS backend. You can type a reply or record one; recorded audio is uploaded to the backend's official Hausa-ASR runtime, and its transcript is sent to the N-ATLAS tutor. The recorded file is deleted after the request. Spoken tutor playback is not configured.

The chat keeps its composer at the bottom of the screen. Hold the microphone to record and release to send. Short taps are discarded, recordings stop at 28 seconds, and leaving the app cancels recording. If you release while microphone permission or preparation is pending, recording will not start. Typed replies, hints, and failed-reply retries remain available.

To use the backend, create `.env` from `.env.example` and set `EXPO_PUBLIC_API_URL=http://YOUR_MAC_LAN_IP:8000`, then restart Expo. Put the Mac and phone on the same Wi-Fi. `localhost` on a phone refers to the phone. Start the backend with `--host 0.0.0.0`. Use only a trusted local network until TLS and authentication are added.

## API contract

`POST /sessions` with `{topic, consent}` returns `{session_id, access_token, provider_mode, initial_tutor_message}`. `POST /sessions/{id}/turns` accepts `{turn_id, text}` and returns `{turn_id, tutor_response, processing_ms, provider_mode}`. `POST /sessions/{id}/finish` returns structured `{feedback, provider_mode}`. Turn and finish calls need `Authorization: Bearer <access_token>`. The app uses a stable turn ID for retrying a failed request. The transcript is held in memory while the screen is open. Real backend transcripts are stored by the backend. Consent for inclusion in local validation export is optional and off by default; recording files are deleted locally.

Real voice practice requires the backend's optional speech dependencies, accepted access to `NCAIR1/Hausa-ASR`, and ffmpeg. The app sends the Expo recording directly to the authenticated session transcription endpoint using `expo/fetch`, then submits the returned transcript as a tutor turn. The text transcript can be included in a local validation export only if the participant opts in. Do not put provider secrets in `EXPO_PUBLIC_*` values.

Check with `npx tsc --noEmit`, `npx expo lint`, `npm test`, and `npx expo export --platform web`. A real device is still required to verify microphone permission and lifecycle. Real user validation export is handled by the backend CLI, which filters to consenting real sessions.
