export interface DownloadedExportRef {
  data: Buffer;
  filename?: string;
  contentType?: string;
}

export async function downloadExportRef(baseUrl: string, urlOrPath: string): Promise<DownloadedExportRef> {
  const url = urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')
    ? urlOrPath
    : `${baseUrl}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Download failed (${response.status}): ${body || response.statusText}`);
  }
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const filenameMatch = /filename="([^"]+)"/i.exec(contentDisposition);
  const arrayBuffer = await response.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer),
    ...(filenameMatch?.[1] ? { filename: filenameMatch[1] } : {}),
    ...(response.headers.get('content-type') ? { contentType: response.headers.get('content-type')! } : {})
  };
}
