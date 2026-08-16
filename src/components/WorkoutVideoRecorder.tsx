'use client';

import React, { useRef, useState } from 'react';
import { Camera, Square, UploadCloud, Video } from 'lucide-react';
import { WorkoutVideo } from '../types';
import { uploadWorkoutVideo } from '../utils/driveStorage';

interface WorkoutVideoRecorderProps {
  workoutId: string;
  accessToken: string | null;
  videos: WorkoutVideo[];
  onVideoUploaded: (video: WorkoutVideo) => void;
}

export const WorkoutVideoRecorder: React.FC<WorkoutVideoRecorderProps> = ({
  workoutId,
  accessToken,
  videos,
  onVideoUploaded,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [startedAt, setStartedAt] = useState<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const canRecord = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

  const startRecording = async () => {
    if (!accessToken) {
      setStatus('Connect Google Drive before recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')
        ? 'video/mp4;codecs=h264,aac'
        : 'video/webm;codecs=vp8,opus';

      chunksRef.current = [];
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void uploadRecording(mimeType);
      };

      recorder.start(1000);
      setStartedAt(Date.now());
      setIsRecording(true);
      setStatus('Recording...');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start camera.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
    setStatus('Preparing upload...');
  };

  const uploadRecording = async (mimeType: string) => {
    if (!accessToken) return;

    const blob = new Blob(chunksRef.current, { type: mimeType });
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

    try {
      setStatus('Uploading to Drive...');
      const video = await uploadWorkoutVideo({ accessToken, workoutId, blob, durationSeconds });
      onVideoUploaded(video);
      setStatus('Saved to Drive.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.');
    }
  };

  return (
    <div className="bg-[#181412]/90 border border-[#382f29] rounded-3xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[#e6a15c]" />
          <span className="text-xs font-serif italic font-bold text-[#f7f3ee]">Workout Videos</span>
        </div>
        <span className="text-[10px] text-[#8c7e72]">{videos.length} saved</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!canRecord}
          className={`flex-1 py-3 rounded-2xl text-xs font-syne font-bold flex items-center justify-center gap-2 ${
            isRecording
              ? 'bg-[#c86d51] text-[#0c0a09]'
              : 'bg-[#211b18] text-[#e6a15c] border border-[#382f29]'
          } disabled:opacity-50`}
        >
          {isRecording ? <Square className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        <div className="px-3 py-3 rounded-2xl bg-[#100d0b] border border-[#2b241f] text-[#8c7e72]">
          <UploadCloud className="w-4 h-4" />
        </div>
      </div>

      {status && <p className="text-[11px] text-[#a39588]">{status}</p>}

      {videos.length > 0 && (
        <div className="space-y-1.5">
          {videos.slice(0, 3).map((video) => (
            <a
              key={video.id}
              href={video.webViewLink || `https://drive.google.com/file/d/${video.driveFileId}/view`}
              target="_blank"
              rel="noreferrer"
              className="block bg-[#100d0b] border border-[#2b241f] rounded-2xl px-3 py-2 text-[11px] text-[#c8b8a8] truncate"
            >
              {video.name || `Video ${new Date(video.createdAt).toLocaleDateString()}`} · {video.durationSeconds}s
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
