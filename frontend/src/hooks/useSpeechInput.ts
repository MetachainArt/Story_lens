import { useState, useRef, useCallback, useEffect } from 'react';
import api from '@/services/api';

type SpeechInputState = 'idle' | 'listening' | 'processing';

const MAX_RECORDING_MS = 30_000;

function getRecorderMimeType(): string {
  // iOS Safari doesn't support audio/webm - use mp4 instead
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/aac')) return 'audio/aac';
  return ''; // let browser pick default
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('aac')) return 'aac';
  if (mimeType.includes('webm')) return 'webm';
  return 'wav';
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const ext = getFileExtension(audioBlob.type);
  const formData = new FormData();
  formData.append('file', audioBlob, `recording.${ext}`);
  const res = await api.post('/api/v1/stt', formData);
  return res.data?.text || '';
}

function collapseRepeatedSpeech(text: string): string {
  const tokens = text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const collapsed: string[] = [];

  for (const token of tokens) {
    if (collapsed[collapsed.length - 1] !== token) {
      collapsed.push(token);
    }
  }

  for (let size = 4; size >= 2; size -= 1) {
    let i = 0;
    while (i + size * 2 <= collapsed.length) {
      const left = collapsed.slice(i, i + size).join(' ');
      const right = collapsed.slice(i + size, i + size * 2).join(' ');
      if (left === right) {
        collapsed.splice(i + size, size);
        continue;
      }
      i += 1;
    }
  }

  return collapsed.join(' ');
}

export function useSpeechInput(onTranscript: (text: string) => void) {
  const [state, setState] = useState<SpeechInputState>('idle');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearTimeout(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startMediaRecorder = useCallback(async () => {
    try {
      setError('');
      setInterimText('듣고 있어요. 말이 끝나면 마이크를 한 번 더 눌러 주세요.');
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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (recordingTimerRef.current) {
          window.clearTimeout(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size < 100) {
          setInterimText('');
          setError('소리가 너무 짧았어요. 마이크를 누르고 한 문장만 천천히 말해 주세요.');
          setState('idle');
          return;
        }
        setState('processing');
        setInterimText('말한 내용을 글로 바꾸고 있어요.');
        try {
          const text = collapseRepeatedSpeech(await transcribeAudio(blob));
          if (text) onTranscript(text);
          else setError('말소리가 잘 들리지 않았어요. 조금 더 가까이에서 다시 말해 주세요.');
        } catch {
          setError('마이크 내용을 글로 바꾸지 못했어요. 주변 소음을 줄이고 다시 시도해 주세요.');
        } finally {
          setInterimText('');
          setState('idle');
        }
      };

      recorder.start();
      setState('listening');
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
  }, [onTranscript]);

  const toggle = useCallback(() => {
    // Currently listening -> stop
    if (state === 'listening') {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    // Currently idle -> start
    if (state === 'idle') {
      startMediaRecorder();
    }
  }, [state, startMediaRecorder]);

  return { state, interimText, error, toggle, supportsWebSpeech: false };
}
