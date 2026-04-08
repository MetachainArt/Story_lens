import { useState, useRef, useCallback, useEffect } from 'react';
import api from '@/services/api';

type SpeechInputState = 'idle' | 'listening' | 'processing';

// Web Speech API types (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

function getSpeechRecognition(): SpeechRecognition | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = false;
  recognition.interimResults = true;
  return recognition;
}

async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  const res = await api.post('/api/v1/stt', formData);
  return res.data?.text || '';
}

export function useSpeechInput(onTranscript: (text: string) => void) {
  const [state, setState] = useState<SpeechInputState>('idle');
  const [interimText, setInterimText] = useState('');
  const [supportsWebSpeech] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startWebSpeech = useCallback(() => {
    const recognition = getSpeechRecognition();
    if (!recognition) return false;

    recognitionRef.current = recognition;
    setState('listening');
    setInterimText('');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        onTranscript(final);
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = () => {
      setState('idle');
      setInterimText('');
    };

    recognition.onend = () => {
      setState('idle');
      setInterimText('');
      recognitionRef.current = null;
    };

    recognition.start();
    return true;
  }, [onTranscript]);

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) {
          setState('idle');
          return;
        }
        setState('processing');
        try {
          const text = await transcribeWithWhisper(blob);
          if (text.trim()) onTranscript(text.trim());
        } catch {
          // Whisper failed silently
        }
        setState('idle');
      };

      recorder.start();
      setState('listening');
    } catch {
      setState('idle');
    }
  }, [onTranscript]);

  const toggle = useCallback(() => {
    // Currently listening -> stop
    if (state === 'listening') {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    // Currently idle -> start
    if (state === 'idle') {
      if (supportsWebSpeech) {
        startWebSpeech();
      } else {
        startMediaRecorder();
      }
    }
  }, [state, supportsWebSpeech, startWebSpeech, startMediaRecorder]);

  return { state, interimText, toggle, supportsWebSpeech };
}
