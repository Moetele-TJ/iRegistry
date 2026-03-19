// src/utils/imageCompression.js
export async function compressImage(file, maxWidth = 1600, quality = 0.75) {

  return new Promise((resolve, reject) => {

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    reader.onerror = reject;

    img.onload = () => {

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = height * (maxWidth / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      /* ---------- WATERMARK ---------- */

      const text = "iRegistry Verified";

      ctx.font = "bold 26px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2;

      const padding = 20;

      ctx.strokeText(text, padding, height - padding);
      ctx.fillText(text, padding, height - padding);

      /* ---------- COMPRESS ---------- */

      canvas.toBlob(
        (blob) => {

          if (!blob) return reject(new Error("Compression failed"));

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );

          resolve(compressedFile);

        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = reject;

    reader.readAsDataURL(file);
  });
}