"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteProductImage } from "@/lib/actions/products";
import type { ProductImage } from "@/lib/types";

/**
 * Handles uploading fragrance photos straight to Supabase Storage from the
 * browser (the admin is already logged in, so this is allowed by the
 * storage policies in 0003_storage.sql). The resulting public URLs are
 * placed into hidden form inputs so they submit along with the rest of the
 * product form — see createProduct/updateProduct in lib/actions/products.ts.
 */
export default function ImageUploader({
  existingImages = [],
  hiddenInputName,
}: {
  existingImages?: ProductImage[];
  hiddenInputName: "image_urls" | "new_image_urls";
}) {
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [images, setImages] = useState(existingImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) {
        setError(uploadError.message);
        continue;
      }

      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      newUrls.push(data.publicUrl);
    }

    setUploadedUrls((current) => [...current, ...newUrls]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDeleteExisting(imageId: string) {
    startTransition(async () => {
      await deleteProductImage(imageId);
      setImages((current) => current.filter((img) => img.id !== imageId));
    });
  }

  function handleRemoveUploaded(url: string) {
    setUploadedUrls((current) => current.filter((u) => u !== url));
  }

  return (
    <div>
      <label className="label-field">Photos</label>

      {(images.length > 0 || uploadedUrls.length > 0) && (
        <div className="mb-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((image) => (
            <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg bg-cream-dark">
              <Image src={image.url} alt="" fill sizes="120px" className="object-cover" />
              <button
                type="button"
                onClick={() => handleDeleteExisting(image.id)}
                disabled={isPending}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {uploadedUrls.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-cream-dark">
              <Image src={url} alt="" fill sizes="120px" className="object-cover" />
              <input type="hidden" name={hiddenInputName} value={url} />
              <button
                type="button"
                onClick={() => handleRemoveUploaded(url)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone-light px-4 py-2.5 text-sm text-stone hover:border-gold hover:text-gold-dark">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading..." : "Upload photos"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
