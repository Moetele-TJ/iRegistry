// src/lib/putSignedUpload.js

/**
 * PUT a file to a Supabase storage signed upload URL with upload progress.
 * @param {string} signedUrl
 * @param {File|Blob} file
 * @param {{ onProgress?: (loadedDelta: number) => void, xhrPool?: XMLHttpRequest[] }} opts
 */
export function putSignedUpload(signedUrl, file, opts = {}) {
  const { onProgress, xhrPool } = opts;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (xhrPool) xhrPool.push(xhr);
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const previous = xhr._lastLoaded || 0;
        onProgress(event.loaded - previous);
        xhr._lastLoaded = event.loaded;
      }
    };
    xhr.onload = () => {
      if (xhrPool) {
        const i = xhrPool.indexOf(xhr);
        if (i >= 0) xhrPool.splice(i, 1);
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Upload failed."));
    };
    xhr.onerror = () => {
      if (xhrPool) {
        const i = xhrPool.indexOf(xhr);
        if (i >= 0) xhrPool.splice(i, 1);
      }
      reject(new Error("Upload failed."));
    };
    xhr.onabort = () => {
      if (xhrPool) {
        const i = xhrPool.indexOf(xhr);
        if (i >= 0) xhrPool.splice(i, 1);
      }
      reject(new Error("Upload aborted."));
    };
    xhr.send(file);
  });
}
