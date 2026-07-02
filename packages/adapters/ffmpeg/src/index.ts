/**
 * @multimarcdown/adapter-ffmpeg — ffmpeg implementation of the media-processing transcode port.
 *
 * Shells out to a local ffmpeg binary to transcode/upscale media into variants.
 * Never overwrites the original (media-processing invariant): every op writes a
 * new output path with provenance.
 */
export interface FfmpegConfig {
  binaryPath?: string;
}

export interface TranscodeRequest {
  inputPath: string;
  outputPath: string;
  args: string[];
}

export interface FfmpegAdapter {
  transcode(req: TranscodeRequest): Promise<{ outputPath: string; durationMs: number }>;
  probe(inputPath: string): Promise<Record<string, unknown>>;
}

export function createFfmpegAdapter(_config: FfmpegConfig = {}): FfmpegAdapter {
  throw new Error('adapter-ffmpeg: not implemented — spawn the ffmpeg/ffprobe binaries here');
}
