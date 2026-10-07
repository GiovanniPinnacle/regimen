"use client";

// Web Speech API dictation for the Coach composer. Continuous, final
// results only — each finalized phrase is handed to `onText`.

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (e: {
    results: { [k: number]: { [k: number]: { transcript: string } } };
    resultIndex: number;
  }) => void;
  onend: () => void;
  onerror: (e: unknown) => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    SpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function getSR() {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function useVoiceInput(onText: (text: string) => void) {
  // Coach is client-only (ssr: false), so this is safe to read at init.
  const [supported] = useState(() => Boolean(getSR()));
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  // Stop listening if the composer unmounts mid-dictation.
  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggle = useCallback(() => {
    const SR = getSR();
    if (!SR) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const results = e.results as unknown as Array<
        [{ transcript: string }] & { isFinal?: boolean }
      >;
      let finalText = "";
      for (let i = e.resultIndex; i < results.length; i++) {
        const r = results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText) onTextRef.current(finalText);
    };
    const end = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recognition.onend = end;
    recognition.onerror = end;
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, []);

  return { supported, recording, toggle };
}
