declare module 'ytdl-core' {
  interface VideoInfo {
    videoDetails: {
      title: string;
      lengthSeconds: string;
      chapters?: Array<{
        title: string;
        start_time: number;
        end_time?: number;
      }>;
    };
    formats: any[];
  }

  interface VideoFormat {
    url: string;
    quality: string;
    mimeType?: string;
    audioBitrate?: number;
    bitrate?: number;
    container?: string;
    hasAudio?: boolean;
    hasVideo?: boolean;
  }

  function validateURL(url: string): boolean;
  function getInfo(url: string): Promise<VideoInfo>;
  function chooseFormat(formats: any[], options: any): VideoFormat;
  function downloadFromInfo(
    info: VideoInfo,
    options?: any
  ): NodeJS.ReadableStream;

  // Export a callable function as default export
  function ytdl(url: string, options?: any): NodeJS.ReadableStream;

  namespace ytdl {
    export { validateURL, getInfo, chooseFormat, downloadFromInfo };
  }

  export = ytdl;
}
