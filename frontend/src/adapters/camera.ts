import type { Camera } from '../game/engine';

const CAPTURE_SIZE = 224;

export interface PreviewCamera extends Camera {
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
}

export class BrowserCamera implements PreviewCamera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  constructor(
    private readonly mediaDevices: Pick<MediaDevices, 'getUserMedia'> =
      navigator.mediaDevices,
    private readonly documentObject: Pick<Document, 'createElement'> = document,
  ) {}

  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();
    const stream = await this.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
  }

  async capture(): Promise<Blob> {
    if (this.video === null || this.stream === null) {
      throw new Error('カメラが起動していません');
    }

    const sourceWidth = this.video.videoWidth;
    const sourceHeight = this.video.videoHeight;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('カメラ映像を取得できません');
    }

    const canvas = this.documentObject.createElement('canvas');
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('画像キャプチャを初期化できません');
    }

    const cropSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = (sourceWidth - cropSize) / 2;
    const sourceY = (sourceHeight - cropSize) / 2;
    context.drawImage(
      this.video,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      CAPTURE_SIZE,
      CAPTURE_SIZE,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob === null) {
            reject(new Error('カメラ画像をJPEGに変換できません'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.8,
      );
    });
  }

  stop(): void {
    for (const track of this.stream?.getTracks() ?? []) {
      track.stop();
    }
    if (this.video !== null) {
      this.video.srcObject = null;
    }
    this.stream = null;
    this.video = null;
  }
}
