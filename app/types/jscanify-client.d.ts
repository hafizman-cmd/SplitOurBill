declare module 'jscanify/client' {
  type ImageSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
  type CornerPoint = { x: number; y: number };
  type CornerPoints = {
    topLeftCorner?: CornerPoint;
    topRightCorner?: CornerPoint;
    bottomLeftCorner?: CornerPoint;
    bottomRightCorner?: CornerPoint;
  };
  export default class Jscanify {
    findPaperContour(img: unknown): unknown;
    getCornerPoints(contour: unknown): CornerPoints;
    highlightPaper(
      image: ImageSource,
      options?: { color?: string; thickness?: number },
    ): HTMLCanvasElement;
    extractPaper(
      image: ImageSource,
      resultWidth: number,
      resultHeight: number,
      cornerPoints?: CornerPoints,
    ): HTMLCanvasElement | null;
  }
}
