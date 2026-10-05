/**
 * Client-side limits. Keep these in sync with the "MathDesk Guard" node in the n8n workflow,
 * which enforces the same rules on the server side (the browser can always be bypassed).
 */
export const MAX_PROMPT_CHARS = 4000;
export const MAX_IMAGES_PER_MESSAGE = 2;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // raw file chosen by the user
export const MAX_IMAGE_EDGE_PX = 1600; // images are downscaled to this before sending
export const MAX_ENCODED_IMAGE_BYTES = 1_200_000; // each image after re-encoding
export const MAX_TOTAL_IMAGE_BYTES = 2_000_000; // all images in one message
export const ALLOWED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const MAX_LESSON_TITLE_CHARS = 200;
export const MAX_LESSON_CHARS = 50_000;

export const MAX_SAVED_MESSAGES = 200; // messages kept per saved conversation
export const MAX_STORED_MESSAGE_CHARS = 20_000; // one stored message
