/**
 * PUT raw file bytes to a presigned S3 URL.
 *
 * **Not** through `apiFetch`: this is an external S3 host and must carry no auth headers — the
 * signature is already in the URL, and adding an `Authorization` header makes S3 reject the request.
 * That is the whole reason this exists as its own helper rather than being folded into the API
 * client, and why it lives in `lib/` instead of one feature module: task attachments, leave
 * documents and anything presigned later all need the same rule, and a second copy is a second
 * chance for someone to "fix" it into `apiFetch`.
 *
 * Throws on any non-2xx.
 */
export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}
