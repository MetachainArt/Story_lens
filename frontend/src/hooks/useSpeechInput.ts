import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/services/api';

type SpeechInputState = 'idle' | 'listening' | 'processing';

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  readonly error?: string;
};

type SpeechRecognitionLike = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
};

const MAX_RECORDING_MS = 12_000;
const MIN_AUDIO_BYTES = 100;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function supportsNativeSpeechRecognition(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /NAVER|KAKAOTALK|Instagram|FBAN|FBAV|Line\/|DaumApps/i.test(navigator.userAgent);
}

function shouldUseNativeSpeechRecognition(): boolean {
  return supportsNativeSpeechRecognition() && !isInAppBrowser();
}

function getRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/mpeg')) return 'audio/mpeg';
  return '';
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('webm')) return 'webm';
  return 'wav';
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const ext = getFileExtension(audioBlob.type);
  const formData = new FormData();
  formData.append('file', audioBlob, `recording.${ext}`);
  const res = await api.post('/api/v1/stt', formData);
  return typeof res.data?.text === 'string' ? res.data.text : '';
}

function collapseRepeatedSpeech(text: string): string {
  const tokens = text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const collapsed: string[] = [];

  for (const token of tokens) {
    if (collapsed[collapsed.length - 1] !== token) {
      collapsed.push(token);
    }
  }

  for (let size = 6; size >= 2; size -= 1) {
    let index = 0;
    while (index + size * 2 <= collapsed.length) {
      const left = collapsed.slice(index, index + size).join(' ');
      const right = collapsed.slice(index + size, index + size * 2).join(' ');
      if (left === right) {
        collapsed.splice(index + size, size);
        continue;
      }
      index += 1;
    }
  }

  return collapsed.join(' ');
}

function friendlySpeechError(error?: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return '마이크 권한을 허용한 뒤 다시 눌러 주세요.';
  }
  if (error === 'no-speech') {
    return '목소리가 잘 들리지 않았어요. 마이크 가까이에서 한 문장만 말해 주세요.';
  }
  if (error === 'audio-capture') {
    return '마이크를 찾지 못했어요. 휴대폰 권한 설정을 확인해 주세요.';
  }
  if (error === 'network') {
    return '음성 인식 연결이 잠시 불안정해요. 다시 한 번 말해 주세요.';
  }
  return '마이크 내용을 글로 바꾸지 못했어요. 주변 소음을 줄이고 다시 시도해 주세요.';
}

function startSilenceWatcher(stream: MediaStream, stop: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const speechWindow = window as SpeechWindow;
  const AudioContextConstructor = window.AudioContext ?? speechWindow.webkitAudioContext;
  if (!AudioContextConstructor) return () => undefined;

  let audioContext: AudioContext | null = null;
  let frameId = 0;
  let stopped = false;

  try {
    audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();
    let heardVoice = false;
    let lastVoiceAt = startedAt;

    const tick = () => {
      if (stopped) return;

      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const volume = Math.sqrt(sum / data.length);
      const now = Date.now();

      if (volume > 0.035) {
        heardVoice = true;
        lastVoiceAt = now;
      }

      if (
        (heardVoice && now - lastVoiceAt > 1300) ||
        (!heardVoice && now - startedAt > 5000)
      ) {
        stop();
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      source.disconnect();
      void audioContext?.close();
    };
  } catch {
    void audioContext?.close();
    return () => undefined;
  }
}

export function useSpeechInput(onTranscript: (text: string) => void) {
  const [state, setState] = useState<SpeechInputState>('idle');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const silenceCleanupRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalTranscriptRef = useRef('');
  const hadSpeechErrorRef = useRef(false);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopActiveInput = useCallback(() => {
    clearRecordingTimer();
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [clearRecordingTimer]);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      silenceCleanupRef.current?.();
      silenceCleanupRef.current = null;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [clearRecordingTimer]);

  const startNativeSpeechRecognition = useCallback((): boolean => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return false;

    try {
      const recognition = new Recognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
      finalTranscriptRef.current = '';
      hadSpeechErrorRef.current = false;

      recognition.onresult = (event) => {
        let interim = '';
        let finalText = finalTranscriptRef.current;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript?.trim() ?? '';
          if (!transcript) continue;
          if (result.isFinal) {
            finalText = `${finalText} ${transcript}`.trim();
          } else {
            interim = `${interim} ${transcript}`.trim();
          }
        }

        finalTranscriptRef.current = finalText;
        setInterimText(interim || finalText || '듣고 있어요. 말을 마치면 자동으로 글로 바꿀게요.');
      };

      recognition.onerror = (event) => {
        hadSpeechErrorRef.current = true;
        setError(friendlySpeechError(event.error));
      };

      recognition.onend = () => {
        clearRecordingTimer();
        recognitionRef.current = null;
        const text = collapseRepeatedSpeech(finalTranscriptRef.current);
        finalTranscriptRef.current = '';

        if (text) {
          onTranscript(text);
          setError('');
        } else if (!hadSpeechErrorRef.current) {
          setError('목소리가 글로 잡히지 않았어요. 마이크를 다시 누르고 천천히 말해 주세요.');
        }

        setInterimText('');
        setState('idle');
      };

      setError('');
      setInterimText('듣고 있어요. 말을 마치면 자동으로 글로 바꿀게요.');
      setState('listening');
      recognition.start();
      recordingTimerRef.current = window.setTimeout(() => {
        recognitionRef.current?.stop();
      }, MAX_RECORDING_MS);
      return true;
    } catch {
      recognitionRef.current = null;
      clearRecordingTimer();
      setState('idle');
      setInterimText('');
      return false;
    }
  }, [clearRecordingTimer, onTranscript]);

  const startMediaRecorder = useCallback(async () => {
    try {
      setError('');
      setInterimText('듣고 있어요. 말을 마치면 자동으로 글로 바꿀게요.');
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setInterimText('');
        setError('이 브라우저에서는 마이크 녹음을 지원하지 않아요. 크롬이나 사파리 최신 버전에서 다시 시도해 주세요.');
        setState('idle');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = getRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        clearRecordingTimer();
        silenceCleanupRef.current?.();
        silenceCleanupRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });

        if (blob.size < MIN_AUDIO_BYTES) {
          setInterimText('');
          setError('소리가 너무 짧았어요. 마이크를 누르고 한 문장만 천천히 말해 주세요.');
          setState('idle');
          return;
        }

        setState('processing');
        setInterimText('말한 내용을 글로 바꾸고 있어요.');
        try {
          const text = collapseRepeatedSpeech(await transcribeAudio(blob));
          if (text) {
            onTranscript(text);
            setError('');
          } else {
            setError('말소리가 잘 들리지 않았어요. 조금 더 가까이에서 다시 말해 주세요.');
          }
        } catch {
          setError('마이크 내용을 글로 바꾸지 못했어요. 주변 소음을 줄이고 다시 시도해 주세요.');
        } finally {
          setInterimText('');
          setState('idle');
        }
      };

      recorder.start();
      setState('listening');
      silenceCleanupRef.current = startSilenceWatcher(stream, () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      });
      recordingTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_MS);
    } catch {
      setInterimText('');
      setError('마이크 권한을 허용한 뒤 다시 눌러 주세요.');
      setState('idle');
    }
  }, [clearRecordingTimer, onTranscript]);

  const toggle = useCallback(() => {
    if (state === 'listening') {
      stopActiveInput();
      return;
    }

    if (state === 'idle') {
      if (!shouldUseNativeSpeechRecognition() || !startNativeSpeechRecognition()) {
        void startMediaRecorder();
      }
    }
  }, [startMediaRecorder, startNativeSpeechRecognition, state, stopActiveInput]);

  return {
    state,
    interimText,
    error,
    toggle,
    supportsWebSpeech: shouldUseNativeSpeechRecognition(),
  };
}
