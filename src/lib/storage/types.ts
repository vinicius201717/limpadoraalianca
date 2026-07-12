export type UploadedFile = {
  url: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export interface StorageProvider {
  upload(file: File, path: string): Promise<UploadedFile>;
  remove(path: string): Promise<void>;
}
