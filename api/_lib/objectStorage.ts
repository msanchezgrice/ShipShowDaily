import { Storage } from "@google-cloud/storage";
import type { VercelResponse } from '@vercel/node';
import { randomUUID } from "crypto";

// Initialize Google Cloud Storage client
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GCS_KEY_FILE, // Optional: for local development
});

const bucketName = process.env.GCS_BUCKET_NAME || '';

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface ObjectAclPolicy {
  permissions: ObjectPermission[];
}

export enum ObjectPermission {
  WRITE = "write",
  READ = "read",
}

// Simplified Object Storage Service for Vercel serverless functions
export class ObjectStorageService {
  private bucket = bucketName ? storage.bucket(bucketName) : null;

  constructor() {
    if (!this.bucket) {
      console.warn('GCS bucket not configured. Object storage operations will fail.');
    }
  }

  // Gets the public object search paths
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    return Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
  }

  // List objects with optional prefix
  async listObjects(prefix?: string, maxResults = 100): Promise<Array<{ name: string; size?: number; updated?: Date }>> {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const [files] = await this.bucket.getFiles({
      prefix,
      maxResults,
    });

    return files.map(file => ({
      name: file.name,
      size: file.metadata.size ? parseInt(file.metadata.size.toString()) : undefined,
      updated: file.metadata.updated ? new Date(file.metadata.updated) : undefined,
    }));
  }

  // Check if object exists
  async objectExists(path: string): Promise<boolean> {
    if (!this.bucket) {
      return false;
    }

    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    return exists;
  }

  // Get object metadata
  async getObjectMetadata(path: string): Promise<any> {
    if (!this.bucket) {
      throw new ObjectNotFoundError();
    }

    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    const [metadata] = await file.getMetadata();
    return metadata;
  }

  // Read object as buffer
  async readObject(path: string): Promise<Buffer> {
    if (!this.bucket) {
      throw new ObjectNotFoundError();
    }

    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    const [contents] = await file.download();
    return contents;
  }

  // Stream object to response
  async streamObject(path: string, res: VercelResponse): Promise<void> {
    if (!this.bucket) {
      throw new ObjectNotFoundError();
    }

    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    const stream = file.createReadStream();
    
    // Set appropriate headers
    const [metadata] = await file.getMetadata();
    if (metadata.contentType) {
      res.setHeader('Content-Type', metadata.contentType);
    }
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size.toString());
    }

    // Pipe the stream to the response
    stream.pipe(res as any);
  }

  // Write object
  async writeObject(path: string, data: Buffer | string, contentType?: string): Promise<void> {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const file = this.bucket.file(path);
    const stream = file.createWriteStream({
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
    });

    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(data);
    });
  }

  // Delete object
  async deleteObject(path: string): Promise<void> {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const file = this.bucket.file(path);
    await file.delete();
  }

  // Generate signed URL for upload
  async generateUploadUrl(path: string, contentType?: string, expiresIn = 3600): Promise<string> {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const file = this.bucket.file(path);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresIn * 1000,
      contentType: contentType || 'application/octet-stream',
    });

    return url;
  }

  // Generate signed URL for download
  async generateDownloadUrl(path: string, expiresIn = 3600): Promise<string> {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const file = this.bucket.file(path);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });

    return url;
  }
}

// Export a singleton instance
export const objectStorageService = new ObjectStorageService();
