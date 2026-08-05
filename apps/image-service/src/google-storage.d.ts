declare module "@google-cloud/storage" {
  export class Storage {
    constructor(options?: { projectId?: string });
    bucket(name: string): {
      file(name: string): {
        download(): Promise<[Buffer]>;
        getSignedUrl(options: {
          version: "v4";
          action: "read";
          expires: number;
        }): Promise<[string]>;
        save(
          contents: Buffer,
          options: {
            contentType: string;
            resumable: boolean;
            metadata?: Record<string, unknown>;
          },
        ): Promise<void>;
      };
    };
  }
}
