import type { Response } from 'express';

/** Sends a file; the UTF-8 name keeps accents and other characters of document titles. */
export function sendFile(res: Response, buffer: Buffer, filename: string, type: string, disposition: 'inline' | 'attachment') {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  res.set({
    'Content-Type': type,
    'Content-Disposition': `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
  res.end(buffer);
}
