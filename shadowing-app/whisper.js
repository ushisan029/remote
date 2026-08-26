const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL = 'onnx-community/whisper-tiny.en';
let transcriberPromise = null;

async function getTransformers() {
  const lib = await import(CDN);
  lib.env.allowLocalModels = false;
  return lib;
}

export function whisperSupport() {
  return {
    webgpu: Boolean(navigator.gpu),
    model: MODEL,
    mode: navigator.gpu ? 'WebGPU' : 'WASM'
  };
}

export async function loadWhisper(onProgress = () => {}) {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline } = await getTransformers();
      const options = {
        progress_callback: (p) => onProgress(p)
      };
      if (navigator.gpu) options.device = 'webgpu';
      return pipeline('automatic-speech-recognition', MODEL, options);
    })().catch((error) => {
      transcriberPromise = null;
      throw error;
    });
  }
  return transcriberPromise;
}

export async function blobTo16kMono(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('AudioContext is not supported.');
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const frames = Math.ceil(decoded.duration * 16000);
    const offline = new OfflineAudioContext(1, Math.max(1, frames), 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function transcribeBlob(blob, onProgress = () => {}) {
  const audio = await blobTo16kMono(blob);
  const transcriber = await loadWhisper(onProgress);
  const output = await transcriber(audio, {
    language: 'en',
    task: 'transcribe',
    return_timestamps: false
  });
  return { text: (output?.text || '').trim(), audio, sampleRate: 16000 };
}
