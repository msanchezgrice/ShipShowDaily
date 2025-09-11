import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Navigation from "@/components/Navigation";
import { ObjectUploader } from "@/components/ObjectUploader";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, Type, FileText, Video } from "lucide-react";
import type { UploadResult } from "@uppy/core";

const submitDemoSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().min(1, "Description is required").max(1000, "Description too long"),
  productUrl: z.string().url("Must be a valid URL"),
});

type SubmitDemoForm = z.infer<typeof submitDemoSchema>;

export default function SubmitDemo() {
  const [videoPath, setVideoPath] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SubmitDemoForm>({
    resolver: zodResolver(submitDemoSchema),
    defaultValues: {
      title: "",
      description: "",
      productUrl: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitDemoForm & { videoPath: string }) => {
      return await apiRequest("POST", "/api/videos", data);
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your demo has been submitted successfully.",
      });
      form.reset();
      setVideoPath("");
      queryClient.invalidateQueries({ queryKey: ["/api/videos/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/videos"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit demo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload", {});
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
      throw error;
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    setIsUploading(true);
    try {
      if (result.successful && result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        const videoURL = uploadedFile.uploadURL;
        
        // Set ACL policy for the uploaded video
        const response = await apiRequest("PUT", "/api/videos/video-file", { videoURL });
        const data = await response.json();
        
        setVideoPath(data.objectPath);
        toast({
          title: "Upload complete",
          description: "Your video has been uploaded successfully.",
        });
      }
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Upload failed",
        description: "Failed to process uploaded video.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = (data: SubmitDemoForm) => {
    if (!videoPath) {
      toast({
        title: "Video required",
        description: "Please upload a video before submitting.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate({
      ...data,
      videoPath,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Submit Your Demo</h1>
          <p className="text-muted-foreground">
            Share your product demo with the community and start earning views.
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Video className="mr-2 h-5 w-5" />
              Demo Submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Video Upload */}
              <div className="space-y-2">
                <Label htmlFor="video" className="flex items-center">
                  <Upload className="mr-2 h-4 w-4" />
                  Video Upload *
                </Label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  {videoPath ? (
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center mx-auto">
                        <Video className="h-8 w-8 text-accent" />
                      </div>
                      <p className="text-foreground font-medium">Video uploaded successfully!</p>
                      <p className="text-sm text-muted-foreground">Ready to submit your demo</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium mb-2">Upload your demo video</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          MP4 format, max 100MB. Keep it under 60 seconds for best engagement.
                        </p>
                        <ObjectUploader
                          maxNumberOfFiles={1}
                          maxFileSize={100 * 1024 * 1024} // 100MB
                          onGetUploadParameters={handleGetUploadParameters}
                          onComplete={handleUploadComplete}
                          buttonClassName="bg-primary text-primary-foreground"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Choose Video File
                        </ObjectUploader>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="flex items-center">
                  <Type className="mr-2 h-4 w-4" />
                  Demo Title *
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., ProjectFlow - Team Collaboration Tool"
                  {...form.register("title")}
                  data-testid="input-title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center">
                  <FileText className="mr-2 h-4 w-4" />
                  Description *
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your product and what makes it special. This will help viewers understand what they're watching."
                  rows={4}
                  {...form.register("description")}
                  data-testid="input-description"
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                )}
              </div>

              {/* Product URL */}
              <div className="space-y-2">
                <Label htmlFor="productUrl" className="flex items-center">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Product URL *
                </Label>
                <Input
                  id="productUrl"
                  type="url"
                  placeholder="https://your-product.com"
                  {...form.register("productUrl")}
                  data-testid="input-product-url"
                />
                {form.formState.errors.productUrl && (
                  <p className="text-sm text-destructive">{form.formState.errors.productUrl.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground"
                disabled={submitMutation.isPending || isUploading || !videoPath}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  "Submitting..."
                ) : isUploading ? (
                  "Processing Upload..."
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Demo
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-card border-border mt-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Tips for a Great Demo</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-accent rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Keep it short and focused - 30-60 seconds is ideal
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-accent rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Show your product's core value proposition clearly
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-accent rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Use high-quality video and clear audio
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-accent rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Start with a hook to grab attention immediately
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-accent rounded-full mt-2 mr-3 flex-shrink-0"></span>
                End with a clear call-to-action
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
