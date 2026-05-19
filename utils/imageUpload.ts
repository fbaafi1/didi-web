import { supabase } from '@/services/supabase';

/**
 * Pick an image via file input and upload to Supabase Storage.
 * Web replacement for expo-image-picker.
 * Returns the public URL or null on cancel/error.
 */
export async function pickAndUploadImage(
  bucket: 'restaurant-images' | 'menu-images',
  folder: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${folder}/${Date.now()}.${ext}`;
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) { alert(`Upload Failed: ${error.message}`); return resolve(null); }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        resolve(data.publicUrl);
      } catch (err: any) {
        alert(`Upload Error: ${err.message ?? 'Something went wrong.'}`);
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Pick a single image (no crop) and upload to Supabase Storage.
 */
export async function pickAndUploadSinglePhoto(
  bucket: 'restaurant-images' | 'menu-images',
  folder: string,
): Promise<string | null> {
  return pickAndUploadImage(bucket, folder);
}

/**
 * Pick a photo and upload to the 'review-images' bucket.
 */
export async function pickAndUploadReviewPhoto(
  folder: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${folder}/${Date.now()}_review.${ext}`;
      try {
        const { error } = await supabase.storage
          .from('review-images')
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) { alert(`Upload Failed: ${error.message}`); return resolve(null); }
        const { data } = supabase.storage.from('review-images').getPublicUrl(path);
        resolve(data.publicUrl);
      } catch (err: any) {
        alert(`Upload Error: ${err.message ?? 'Something went wrong.'}`);
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Pick an image OR video and upload to the 'ads' bucket.
 * Returns { url, type } or null on cancel/error.
 */
export async function pickAndUploadMedia(
  folder: string,
): Promise<{ url: string; type: 'image' | 'video' } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const isVideo = file.type.startsWith('video/');
      const ext     = file.name.split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
      const path    = `${folder}/${Date.now()}.${ext}`;
      try {
        const { error } = await supabase.storage
          .from('ads')
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) { alert(`Upload Failed: ${error.message}`); return resolve(null); }
        const { data } = supabase.storage.from('ads').getPublicUrl(path);
        resolve({ url: data.publicUrl, type: isVideo ? 'video' : 'image' });
      } catch (err: any) {
        alert(`Upload Error: ${err.message ?? 'Something went wrong.'}`);
        resolve(null);
      }
    };
    input.click();
  });
}
