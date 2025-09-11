import { useState, KeyboardEvent } from "react";
import { X, Tag, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  label?: string;
  id?: string;
}

export function TagInput({ 
  tags, 
  onChange, 
  maxTags = 10, 
  placeholder = "Type a tag and press Enter", 
  label,
  id 
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = (tagName: string) => {
    const trimmed = tagName.trim().toLowerCase();
    
    // Validate tag
    if (!trimmed || trimmed.length > 50) return;
    if (tags.includes(trimmed)) return;
    if (tags.length >= maxTags) return;

    onChange([...tags, trimmed]);
    setInputValue("");
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag when backspacing on empty input
      removeTag(tags[tags.length - 1]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const pastedTags = pastedText
      .split(/[,\n\t]/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    for (const tag of pastedTags) {
      if (tags.length >= maxTags) break;
      addTag(tag);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="flex items-center">
          <Hash className="mr-2 h-4 w-4" />
          {label}
        </Label>
      )}
      
      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border border-border rounded-md bg-muted/20">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              data-testid={`tag-${tag}`}
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:bg-primary/30 rounded-full p-0.5 transition-colors"
                data-testid={`remove-tag-${tag}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={tags.length >= maxTags ? `Maximum ${maxTags} tags reached` : placeholder}
          disabled={tags.length >= maxTags}
          className="pr-8"
          data-testid="tag-input"
        />
        <Hash className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>

      {/* Helper Text */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Press Enter or comma to add tags. {tags.length}/{maxTags} tags used.
        </span>
      </div>
    </div>
  );
}