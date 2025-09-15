import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CloudflareUploaderProps {
  onUploadComplete?: (videoId: string) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
  maxDurationSeconds?: number;
  maxFileSizeMB?: number;
  className?: string;
}

interface UploadInitResponse {
  videoId: string;
  uploadUrl: string;
  uploadId: string;
  provider: string;
  maxDurationSeconds: number;
}

const CloudflareUploader = React.forwardRef<
  { startUpload: (title: string, description: string, productUrl: string, tags: string[]) => Promise<void> },
  CloudflareUploaderProps
>(({
  onUploadComplete,
  onUploadStart,
  onUploadError,
  maxDurationSeconds = 30,
  maxFileSizeMB = 200,
  className = "",
}, ref) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please select a video file (MP4, MOV, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${maxFileSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setUploadStatus('idle');
  };

  const uploadToCloudflare = async (file: File, uploadUrl: string) => {
    const controller = new AbortController();
    uploadControllerRef.current = controller;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: file,
        signal: controller.signal,
        headers: {
          'Upload-Length': file.size.toString(),
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return true;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Upload cancelled');
      }
      throw error;
    }
  };

  const startUpload = async (title: string, description: string, productUrl: string, tags: string[]) => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a video file to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage(null);
    
    if (onUploadStart) {
      onUploadStart();
    }

    try {
      // Step 1: Initialize upload with backend
      const initResponse = await apiRequest('/api/videos/cloudflare-init-simple', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          productUrl,
          tags,
          maxDurationSeconds,
        }),
      }) as UploadInitResponse;

      const { videoId, uploadUrl } = initResponse;

      // Simulate progress for demonstration
      // In production, you'd use XMLHttpRequest or fetch with progress events
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Step 2: Upload to Cloudflare
      await uploadToCloudflare(selectedFile, uploadUrl);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('processing');

      // The video is now processing on Cloudflare
      // Webhook will update the database when ready
      
      toast({
        title: "Upload complete!",
        description: "Your video is being processed and will be available shortly.",
      });

      setUploadStatus('complete');
      
      if (onUploadComplete) {
        onUploadComplete(videoId);
      }

      // Reset after a delay
      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus('idle');
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || 'Upload failed');
      
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload video. Please try again.",
        variant: "destructive",
      });
      
      if (onUploadError) {
        onUploadError(error.message);
      }
    } finally {
      setUploading(false);
      uploadControllerRef.current = null;
    }
  };

  const cancelUpload = () => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
      setUploading(false);
      setUploadStatus('idle');
      setUploadProgress(0);
      toast({
        title: "Upload cancelled",
        description: "Video upload has been cancelled",
      });
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Expose startUpload through ref
  React.useImperativeHandle(ref, () => ({
    startUpload,
  }));

  return (
    <div className={`space-y-4 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {!selectedFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        >
          <div className="space-y-4">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-medium mb-2">Click to upload video</p>
              <p className="text-sm text-muted-foreground">
                MP4, MOV, or WebM • Max {maxFileSizeMB}MB • Max {maxDurationSeconds}s
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {uploadStatus === 'complete' ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : uploadStatus === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              ) : uploading ? (
                <Loader2 className="h-5 w-5 text-primary mt-0.5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                {errorMessage && (
                  <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
                )}
              </div>
            </div>
            {!uploading && (
              <Button
                onClick={removeFile}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>
                  {uploadStatus === 'processing' ? 'Processing...' : `Uploading... ${uploadProgress}%`}
                </span>
                {uploadStatus === 'uploading' && (
                  <Button
                    onClick={cancelUpload}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          {uploadStatus === 'complete' && (
            <p className="text-sm text-green-500">Upload complete! Video is processing...</p>
          )}
        </div>
      )}

      {selectedFile && !uploading && uploadStatus !== 'complete' && (
        <p className="text-xs text-muted-foreground text-center">
          Video selected and ready to upload with your demo details
        </p>
      )}
    </div>
  );
});

CloudflareUploader.displayName = 'CloudflareUploader';

export default CloudflareUploader;
