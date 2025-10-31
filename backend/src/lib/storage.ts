import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

const {
  S3_ENDPOINT,
  S3_REGION = 'us-east-1',
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET,
  S3_FORCE_PATH_STYLE = 'true',
  S3_PUBLIC_BASE_URL,
} = process.env;

if (!S3_BUCKET) throw new Error('S3_BUCKET not set');

export const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT || undefined,
  forcePathStyle: S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: String(S3_ACCESS_KEY_ID),
    secretAccessKey: String(S3_SECRET_ACCESS_KEY),
  },
});

export async function putObject(opts: {
  key: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType?: string;
}): Promise<string> {
  const { key, body, contentType } = opts;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  // Se tiver CDN/base pública, retorna URL; senão, retorna a chave para usar via /api/files/:key
  if (S3_PUBLIC_BASE_URL) {
    return `${S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }
  return key;
}

export async function getObject(key: string) {
  const out = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET!,
      Key: key,
    }),
  );
  return {
    stream: out.Body as Readable,
    contentType: out.ContentType || 'application/octet-stream',
    contentLength: out.ContentLength,
  };
}
