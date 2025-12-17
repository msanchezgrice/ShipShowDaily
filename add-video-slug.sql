-- Add slug column to videos table for SEO-friendly URLs
ALTER TABLE videos ADD COLUMN IF NOT EXISTS slug VARCHAR(300);

-- Create unique index on slug (allow null for existing videos)
CREATE UNIQUE INDEX IF NOT EXISTS videos_slug_idx ON videos(slug) WHERE slug IS NOT NULL;

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION generate_slug(title TEXT) RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(title);
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 100); -- Limit length
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM videos WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Update existing videos with slugs based on their titles
UPDATE videos 
SET slug = generate_slug(title)
WHERE slug IS NULL AND title IS NOT NULL;
