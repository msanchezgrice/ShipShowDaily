import React, { createContext, useContext, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Minimize2,
  Maximize2,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface UploadItem {
  id: string;
  file: File;
  title: string;
  description: string;
  productUrl: string;
  tags: string[];
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error' | 'paused';
  progress: number;
  videoId?: string;
  error?: string;
  uploadController?: AbortController;
}

interface UploadQueueContextType {
  addUpload: (upload: Omit<UploadItem, 'id' | 'status' | 'progress'>) => void;
  uploads: UploadItem[];
  isMinimized: boolean;
  toggleMinimized: () => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
}

const UploadQueueContext = createContext<UploadQueueContextType | null>(null);

export function useUploadQueue() {
  const context = useContext(UploadQueueContext);
  if (!context) {
    throw new Error('useUploadQueue must be used within UploadQueueProvider');
  }
  return context;
}

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const processingRef = useRef(false);

  const addUpload = (upload: Omit<UploadItem, 'id' | 'status' | 'progress'>) => {
    const newUpload: UploadItem = {
      ...upload,
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0,
    };

    setUploads(prev => [...prev, newUpload]);
    processQueue();
  };

  const processQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    setUploads(prev => {
      const pendingUploads = prev.filter(u => u.status === 'pending');
      if (pendingUploads.length === 0) {
        processingRef.current = false;
        return prev;
      }

      // Start the first pending upload
      const nextUpload = pendingUploads[0];
      // Pass the upload object directly to avoid stale state
      processUpload(nextUpload);
      
      return prev.map(upload => 
        upload.id === nextUpload.id 
          ? { ...upload, status: 'uploading' as const }
          : upload
      );
    });
  };

  const processUpload = async (upload: UploadItem) => {
    if (!upload) return;
    
    console.log('Processing upload:', upload);

    try {
      // Step 1: Initialize upload with Cloudflare
      console.log('Initializing upload with Cloudflare...');
      const response = await apiRequest('POST', '/api/videos/cloudflare-init-simple', {
        title: upload.title,
        description: upload.description,
        productUrl: upload.productUrl,
        tags: upload.tags,
        maxDurationSeconds: 30,
      });
      
      const initResponse = await response.json();

      console.log('Init response:', initResponse);
      const { videoId, uploadUrl } = initResponse;

      // Update with video ID
      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, videoId } : u
      ));

      // Step 2: Upload file to Cloudflare
      console.log('Starting upload to:', uploadUrl);
      const controller = new AbortController();
      
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { ...u, uploadController: controller }
          : u
      ));

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', upload.file);
      
      // For progress tracking, we need to use XMLHttpRequest
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploads(prev => prev.map(u => 
            u.id === upload.id ? { ...u, progress } : u
          ));
        }
      });

      // Create a promise to handle the upload
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            console.log('Upload complete, video is processing...');
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed - network error'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });
      });

      // Start the upload
      xhr.open('POST', uploadUrl);
      xhr.send(formData);

      // Handle abort
      controller.signal.addEventListener('abort', () => {
        xhr.abort();
      });

      // Wait for upload to complete
      await uploadPromise;
      
      // Upload successful
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { ...u, status: 'processing', progress: 100 }
          : u
      ));
      
      toast({
        title: "Upload complete!",
        description: `${upload.file.name} is processing...`,
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { ...u, status: 'error', error: error.message }
          : u
      ));

      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      processingRef.current = false;
      // Process next item in queue
      setTimeout(processQueue, 1000);
    }
  };

  const pauseUpload = (id: string) => {
    setUploads(prev => prev.map(upload => {
      if (upload.id === id && upload.uploadController) {
        upload.uploadController.abort();
        return { ...upload, status: 'paused' };
      }
      return upload;
    }));
  };

  const resumeUpload = (id: string) => {
    setUploads(prev => prev.map(upload => 
      upload.id === id 
        ? { ...upload, status: 'pending' }
        : upload
    ));
    processQueue();
  };

  const retryUpload = (id: string) => {
    setUploads(prev => prev.map(upload => 
      upload.id === id 
        ? { ...upload, status: 'pending', progress: 0, error: undefined }
        : upload
    ));
    processQueue();
  };

  const cancelUpload = (id: string) => {
    setUploads(prev => {
      const upload = prev.find(u => u.id === id);
      if (upload?.uploadController) {
        upload.uploadController.abort();
      }
      return prev.filter(u => u.id !== id);
    });
  };

  const toggleMinimized = () => setIsMinimized(!isMinimized);

  const activeUploads = uploads.filter(u => 
    ['pending', 'uploading', 'processing'].includes(u.status)
  );

  const completedUploads = uploads.filter(u => 
    ['complete', 'error'].includes(u.status)
  );

  return (
    <UploadQueueContext.Provider 
      value={{
        addUpload,
        uploads,
        isMinimized,
        toggleMinimized,
        pauseUpload,
        resumeUpload,
        retryUpload,
        cancelUpload,
      }}
    >
      {children}
      
      {/* Upload Queue UI */}
      {uploads.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96 z-50">
          <Card className="bg-background border-border shadow-lg">
            <CardContent className="p-0">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span className="font-medium">
                    Uploads ({activeUploads.length} active)
                  </span>
                </div>
                <Button
                  onClick={toggleMinimized}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                >
                  {isMinimized ? (
                    <Maximize2 className="h-3 w-3" />
                  ) : (
                    <Minimize2 className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {/* Upload List */}
              {!isMinimized && (
                <div className="max-h-80 overflow-y-auto">
                  {uploads.map(upload => (
                    <UploadItem
                      key={upload.id}
                      upload={upload}
                      onPause={() => pauseUpload(upload.id)}
                      onResume={() => resumeUpload(upload.id)}
                      onRetry={() => retryUpload(upload.id)}
                      onCancel={() => cancelUpload(upload.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </UploadQueueContext.Provider>
  );
}

function UploadItem({ 
  upload, 
  onPause, 
  onResume, 
  onRetry, 
  onCancel 
}: {
  upload: UploadItem;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const getStatusIcon = () => {
    switch (upload.status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
      case 'processing':
        return <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <div className="h-4 w-4 bg-muted rounded-full" />;
    }
  };

  const getStatusText = () => {
    switch (upload.status) {
      case 'pending':
        return 'Waiting...';
      case 'uploading':
        return `Uploading ${upload.progress}%`;
      case 'processing':
        return 'Processing...';
      case 'complete':
        return 'Complete';
      case 'error':
        return upload.error || 'Failed';
      case 'paused':
        return 'Paused';
    }
  };

  return (
    <div className="p-4 border-b last:border-b-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{upload.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {upload.file.name} • {(upload.file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-2">
          {upload.status === 'uploading' && (
            <Button onClick={onPause} variant="ghost" size="icon" className="h-6 w-6">
              <Pause className="h-3 w-3" />
            </Button>
          )}
          
          {upload.status === 'paused' && (
            <Button onClick={onResume} variant="ghost" size="icon" className="h-6 w-6">
              <Play className="h-3 w-3" />
            </Button>
          )}
          
          {upload.status === 'error' && (
            <Button onClick={onRetry} variant="ghost" size="icon" className="h-6 w-6">
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          
          {!['complete'].includes(upload.status) && (
            <Button onClick={onCancel} variant="ghost" size="icon" className="h-6 w-6">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={`${
            upload.status === 'error' ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {getStatusText()}
          </span>
          <Badge variant={upload.status === 'complete' ? 'default' : 'secondary'} className="text-xs">
            {upload.status}
          </Badge>
        </div>
        
        {['uploading', 'processing'].includes(upload.status) && (
          <Progress value={upload.progress} className="h-1" />
        )}
      </div>
    </div>
  );
}
