const builtBasePath =
  typeof __APP_BASE_PATH__ === 'string' ? __APP_BASE_PATH__ : '';

declare const __APP_BASE_PATH__: string | undefined;

export function appPath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${builtBasePath}${normalized}`;
}

export async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json() as Promise<T>;

  const body = (await response.text()).trim();
  const detail = body && body.length <= 180 ? `: ${body}` : '';
  throw new Error(`El servidor ha respondido con un error (${response.status})${detail}`);
}
