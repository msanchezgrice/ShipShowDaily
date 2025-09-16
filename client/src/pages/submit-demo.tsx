import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Navigation from "@/components/Navigation";
import { ObjectUploader } from "@/components/ObjectUploader";
import CloudflareUploader from "@/components/CloudflareUploader";
import { TagInput } from "@/components/TagInput";
import { useUploadQueue } from "@/components/UploadQueue";
import { AuthStatus } from "@/components/AuthStatus";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError, redirectToSignInClient } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Link as LinkIcon, Type, FileText, Video, Globe, Sparkles, Loader2 } from "lucide-react";
import type { UploadResult } from "@uppy/core";

// Feature flag - set to true to use Cloudflare Stream
const USE_CLOUDFLARE_STREAM = true;

const submitDemoSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().min(1, "Description is required").max(1000, "Description too long"),
  productUrl: z.string().url("Must be a valid URL"),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
});

type SubmitDemoForm = z.infer<typeof submitDemoSchema>;

type SubmissionMode = "upload" | "import";

type ScrapedVideoSource = {
  url: string;
  type: "file" | "hls" | "unknown";
  label?: string;
  mimeType?: string;
};

type ScrapeResponse = {
  originalUrl: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  tags: string[];
  videoSources: ScrapedVideoSource[];
  durationSeconds?: number;
};

type SubmitMutationInput = SubmitDemoForm & {
  mode: SubmissionMode;
  tags: string[];
  videoPath?: string;
  videoId?: string;
  importUrl?: string;
  selectedVideoUrl?: string;
  thumbnailUrl?: string;
};

export default function SubmitDemo() {
  const [videoPath, setVideoPath] = useState<string>("");
  const [videoId, setVideoId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("upload");
  const [importUrl, setImportUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResponse | null>(null);
  const [scrapedVideos, setScrapedVideos] = useState<ScrapedVideoSource[]>([]);
  const [selectedScrapedVideo, setSelectedScrapedVideo] = useState<string>("");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addUpload } = useUploadQueue();

  const form = useForm<SubmitDemoForm>({
    resolver: zodResolver(submitDemoSchema),
    defaultValues: {
      title: "",
      description: "",
      productUrl: "",
      tags: [],
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitMutationInput) => {
      const {
        mode,
        tags: submittedTags,
        importUrl: importSource,
        selectedVideoUrl,
        thumbnailUrl,
        videoPath: submittedVideoPath,
        videoId: submittedVideoId,
        ...formValues
      } = data;

      if (mode === "import") {
        if (!importSource) {
          throw new Error("A source URL is required to import a demo.");
        }

        const response = await apiRequest("POST", "/api/videos/import-from-url", {
          sourceUrl: importSource,
          preferredVideoUrl: selectedVideoUrl,
          overrides: {
            title: formValues.title,
            description: formValues.description,
            productUrl: formValues.productUrl,
            thumbnailUrl,
          },
          tags: submittedTags,
        });

        return await response.json();
      }

      if (USE_CLOUDFLARE_STREAM) {
        return { success: true, videoId: submittedVideoId };
      }

      if (!submittedVideoPath) {
        throw new Error("Please upload a video before submitting your demo.");
      }

      const response = await apiRequest("POST", "/api/videos", {
        ...formValues,
        videoPath: submittedVideoPath,
        tags: submittedTags,
      });

      return await response.json();
    },
    onSuccess: (result, variables) => {
      if (variables.mode === "import") {
        const createdTitle = result?.video?.title ?? variables.title;
        toast({
          title: "Demo imported!",
          description: createdTitle
            ? `We created “${createdTitle}” from your link.`
            : "We created a new demo from your link.",
        });
      } else {
        toast({
          title: "Success!",
          description: "Your demo has been submitted successfully.",
        });
      }

      form.reset();
      setVideoPath("");
      setVideoId("");
      setSelectedFile(null);
      setTags([]);
      setScrapeResult(null);
      setScrapedVideos([]);
      setSelectedScrapedVideo("");
      setImportUrl("");
      setScrapeError(null);

      queryClient.invalidateQueries({ queryKey: ["/api/videos/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/videos"] });
    },
    onError: (error, variables) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => redirectToSignInClient(), 500);
        return;
      }

      const fallbackMessage =
        variables?.mode === "import"
          ? "Failed to import a demo from that URL. Please try again or choose a different page."
          : "Failed to submit demo. Please try again.";

      const message = error instanceof Error && error.message ? error.message : fallbackMessage;
      console.error("Error submitting demo:", error);

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (submissionMode === "upload") {
      setImportUrl("");
      setScrapeResult(null);
      setScrapedVideos([]);
      setSelectedScrapedVideo("");
      setScrapeError(null);
      setIsScraping(false);
    } else {
      setVideoPath("");
      setVideoId("");
      setSelectedFile(null);
    }
  }, [submissionMode]);

  const importSelectedVideoUrl = useMemo(() => {
    if (selectedScrapedVideo) {
      return selectedScrapedVideo;
    }
    return scrapedVideos[0]?.url;
  }, [selectedScrapedVideo, scrapedVideos]);

  const formattedScrapeDuration = useMemo(() => {
    if (!scrapeResult?.durationSeconds || scrapeResult.durationSeconds <= 0) {
      return null;
    }
    const minutes = Math.floor(scrapeResult.durationSeconds / 60);
    const seconds = scrapeResult.durationSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [scrapeResult?.durationSeconds]);

  const describeVideoSource = (video: ScrapedVideoSource, index: number) => {
    const baseLabel = video.label?.trim() || `Video ${index + 1}`;
    const typeLabel = video.type === "hls" ? "HLS" : "File";
    let host: string | undefined;
    try {
      host = new URL(video.url).hostname;
    } catch {
      host = undefined;
    }

    return host ? `${baseLabel} • ${typeLabel} • ${host}` : `${baseLabel} • ${typeLabel}`;
  };

  const isSubmitDisabled = submissionMode === "import"
    ? submitMutation.isPending || isScraping || !importUrl.trim()
    : submitMutation.isPending || isUploading || (USE_CLOUDFLARE_STREAM ? !selectedFile : !videoPath);

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
        setTimeout(() => redirectToSignInClient(), 500);
      }
      throw error;
    }
  };

  const handleScrapeUrl = async () => {
    const normalizedUrl = importUrl.trim();
    if (!normalizedUrl) {
      toast({
        title: "URL required",
        description: "Please enter a product or landing page URL to scan.",
        variant: "destructive",
      });
      return;
    }

    setIsScraping(true);
    setScrapeError(null);

    try {
      const response = await apiRequest("POST", "/api/videos/scrape-url", { url: normalizedUrl });
      const data: ScrapeResponse = await response.json();

      setImportUrl(normalizedUrl);
      setScrapeResult(data);
      setScrapedVideos(data.videoSources ?? []);
      setSelectedScrapedVideo(data.videoSources?.[0]?.url ?? "");

      if (data.title) {
        form.setValue("title", data.title, { shouldDirty: true, shouldValidate: true });
      }
      if (data.description) {
        form.setValue("description", data.description, { shouldDirty: true, shouldValidate: true });
      }
      const resolvedProductUrl = data.canonicalUrl ?? normalizedUrl;
      form.setValue("productUrl", resolvedProductUrl, { shouldDirty: true, shouldValidate: true });

      if (data.tags?.length) {
        setTags(prev => {
          const combined = new Set(prev);
          for (const tag of data.tags) {
            if (typeof tag === "string" && tag.trim()) {
              const trimmed = tag.trim();
              combined.add(trimmed.slice(0, 50));
            }
          }
          return Array.from(combined).slice(0, 10);
        });
      }

      if (!data.videoSources?.length) {
        const message = "We couldn't find any downloadable videos on that page. You can try submitting anyway or choose a different URL.";
        setScrapeError(message);
        toast({
          title: "No videos detected",
          description: message,
        });
      } else {
        setScrapeError(null);
        toast({
          title: "Page scanned!",
          description:
            data.videoSources.length === 1
              ? "Found 1 video and pre-filled your details."
              : `Found ${data.videoSources.length} videos. Choose the one you want to import.`,
        });
      }
    } catch (error) {
      console.error("Failed to scrape URL:", error);
      setScrapeResult(null);
      setScrapedVideos([]);
      setSelectedScrapedVideo("");

      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => redirectToSignInClient(), 500);
        return;
      }

      const message = error instanceof Error && error.message ? error.message : "Failed to scan the provided URL.";
      setScrapeError(message);
      toast({
        title: "Scrape failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsScraping(false);
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
        setTimeout(() => redirectToSignInClient(), 500);
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
    if (submissionMode === "import") {
      const normalizedUrl = importUrl.trim();
      if (!normalizedUrl) {
        toast({
          title: "URL required",
          description: "Please enter a URL to import.",
          variant: "destructive",
        });
        return;
      }

      submitMutation.mutate({
        ...data,
        mode: "import",
        tags,
        importUrl: normalizedUrl,
        selectedVideoUrl: importSelectedVideoUrl,
        thumbnailUrl: scrapeResult?.thumbnailUrl,
      });
      return;
    }

    if (USE_CLOUDFLARE_STREAM) {
      if (!selectedFile) {
        toast({
          title: "Video required",
          description: "Please select a video before submitting.",
          variant: "destructive",
        });
        return;
      }

      try {
        addUpload({
          file: selectedFile,
          title: data.title,
          description: data.description,
          productUrl: data.productUrl,
          tags,
        });

        toast({
          title: "Upload queued! 🚀",
          description: "Your video has been added to the upload queue. You can continue using the site while it uploads in the background.",
        });

        form.reset();
        setSelectedFile(null);
        setTags([]);
      } catch (error) {
        console.error('Error adding to upload queue:', error);
        toast({
          title: "Error",
          description: "Failed to queue upload. Please try again.",
          variant: "destructive",
        });
      }

      return;
    }

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
      mode: "upload",
      videoPath,
      tags,
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

        <AuthStatus />
        
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Video className="mr-2 h-5 w-5" />
              Demo Submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Video Source */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={submissionMode === "upload" ? "default" : "outline"}
                    onClick={() => setSubmissionMode("upload")}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload a video
                  </Button>
                  <Button
                    type="button"
                    variant={submissionMode === "import" ? "default" : "outline"}
                    onClick={() => setSubmissionMode("import")}
                    className="flex items-center gap-2"
                  >
                    <Globe className="h-4 w-4" />
                    Import from URL
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor={submissionMode === "import" ? "import-url" : "video-upload"}
                    className="flex items-center"
                  >
                    {submissionMode === "import" ? (
                      <Globe className="mr-2 h-4 w-4" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {submissionMode === "import" ? "Import from URL *" : "Video Upload *"}
                  </Label>
                  <div className={`border-2 border-dashed border-border rounded-lg p-8 ${submissionMode === "import" ? "text-left" : "text-center"}`}>
                    {submissionMode === "import" ? (
                      <div className="space-y-5">
                        <div className="space-y-1 text-center sm:text-left">
                          <p className="flex items-center justify-center gap-2 text-base font-medium text-foreground sm:justify-start">
                            <Sparkles className="h-4 w-4 text-accent" />
                            Pull demo details from a web page
                          </p>
                          <p className="text-sm text-muted-foreground">
                            We'll scan the page for descriptions, metadata, and downloadable demo videos.
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Input
                            id="import-url"
                            type="url"
                            placeholder="https://your-product.com/demo"
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                          />
                          <Button
                            type="button"
                            onClick={handleScrapeUrl}
                            disabled={isScraping}
                            className="w-full sm:w-auto"
                          >
                            {isScraping ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Scanning...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Scan page
                              </>
                            )}
                          </Button>
                        </div>
                        {scrapeError && (
                          <p className="text-sm text-destructive">{scrapeError}</p>
                        )}
                        {scrapeResult && (
                          <div className="space-y-4">
                            {(scrapeResult.thumbnailUrl || scrapeResult.title || scrapeResult.description) && (
                              <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/40 p-4 sm:flex-row sm:items-center">
                                {scrapeResult.thumbnailUrl && (
                                  <img
                                    src={scrapeResult.thumbnailUrl}
                                    alt="Detected thumbnail"
                                    className="h-16 w-16 rounded-md object-cover border border-border/70"
                                  />
                                )}
                                <div className="space-y-1 text-sm">
                                  {scrapeResult.title && (
                                    <p className="font-medium text-foreground">{scrapeResult.title}</p>
                                  )}
                                  {formattedScrapeDuration && (
                                    <p className="text-muted-foreground">Estimated duration: {formattedScrapeDuration}</p>
                                  )}
                                  {scrapeResult.description && (
                                    <p className="text-muted-foreground line-clamp-2">{scrapeResult.description}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-foreground">Detected videos</Label>
                              {scrapedVideos.length > 0 ? (
                                <Select
                                  value={importSelectedVideoUrl ?? ""}
                                  onValueChange={(value) => setSelectedScrapedVideo(value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a video to import" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {scrapedVideos.map((videoSource, index) => (
                                      <SelectItem key={videoSource.url} value={videoSource.url}>
                                        {describeVideoSource(videoSource, index)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {isScraping ? "Scanning for videos..." : "No downloadable videos detected yet. Try scanning a different page."}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {!scrapeResult && !scrapeError && (
                          <p className="text-sm text-muted-foreground">
                            Paste a product or landing page URL and we'll pre-fill your demo details automatically.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 text-center">
                        {(USE_CLOUDFLARE_STREAM ? selectedFile : videoPath) ? (
                          <div className="space-y-2">
                            <div className="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center mx-auto">
                              <Video className="h-8 w-8 text-accent" />
                            </div>
                            <p className="text-foreground font-medium">Video ready to submit!</p>
                            <p className="text-sm text-muted-foreground">You're all set—review your details below.</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto">
                              <Upload className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-foreground font-medium mb-2">Upload your demo video</p>
                              <p className="text-sm text-muted-foreground mb-4">
                                MP4 format, max 100MB. Keep it under 60 seconds for best engagement.
                              </p>
                              {USE_CLOUDFLARE_STREAM ? (
                                <div className="space-y-3">
                                  <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 100 * 1024 * 1024) {
                                          toast({
                                            title: "File too large",
                                            description: "Maximum file size is 100MB",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        setSelectedFile(file);
                                      }
                                    }}
                                    className="hidden"
                                    id="video-upload"
                                  />
                                  <label
                                    htmlFor="video-upload"
                                    className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer transition-colors"
                                  >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {selectedFile ? "Change Video File" : "Choose Video File"}
                                  </label>
                                  {selectedFile && (
                                    <div className="text-sm text-muted-foreground">
                                      Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <ObjectUploader
                                  maxNumberOfFiles={1}
                                  maxFileSize={100 * 1024 * 1024}
                                  onGetUploadParameters={handleGetUploadParameters}
                                  onComplete={handleUploadComplete}
                                  buttonClassName="bg-primary text-primary-foreground"
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Choose Video File
                                </ObjectUploader>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
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

              {/* Tags */}
              <div className="space-y-2">
                <TagInput
                  tags={tags}
                  onChange={setTags}
                  maxTags={10}
                  label="Tags (Optional)"
                  placeholder="Add tags to help users discover your demo (e.g., saas, productivity, ai)"
                  id="tags"
                />
                <p className="text-xs text-muted-foreground">
                  Tags help users discover your demo. Use relevant keywords like your industry, product type, or key features.
                </p>
                {form.formState.errors.tags && (
                  <p className="text-sm text-destructive">{form.formState.errors.tags.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground"
                disabled={isSubmitDisabled}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  submissionMode === "import" ? "Importing..." : "Submitting..."
                ) : isUploading && submissionMode === "upload" ? (
                  "Processing Upload..."
                ) : (
                  <>
                    {submissionMode === "import" ? (
                      <Sparkles className="mr-2 h-4 w-4" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {submissionMode === "import" ? "Import Demo" : "Submit Demo"}
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
