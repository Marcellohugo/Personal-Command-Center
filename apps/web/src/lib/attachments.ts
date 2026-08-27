import type { OfflineWorkspace, WorkspaceAttachment } from "@/lib/offline-workspace";

declare global {
  interface Window {
    TextDetector?: new () => { detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>> };
  }
}

function readDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function imageData(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let quality = 0.76;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 170_000 && quality > 0.25) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  let extractedText = "";
  if (window.TextDetector) {
    try {
      extractedText = (await new window.TextDetector().detect(bitmap)).map((item) => item.rawValue ?? "").filter(Boolean).join("\n");
    } catch {
      // OCR browser bersifat opsional; lampiran tetap disimpan.
    }
  }
  bitmap.close();
  return { dataUrl, extractedText };
}

export async function fileToAttachment(file: File): Promise<WorkspaceAttachment> {
  if (file.size > 1_000_000) throw new Error("Lampiran maksimum 1 MB sebelum kompresi.");
  const image = file.type.startsWith("image/");
  const result = image ? await imageData(file) : { dataUrl: await readDataUrl(file), extractedText: file.type.startsWith("text/") ? (await file.text()).slice(0, 20_000) : "" };
  if (result.dataUrl.length > 180_000) throw new Error("Lampiran masih terlalu besar setelah diproses. Gunakan tautan eksternal.");
  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 180),
    mimeType: image ? "image/jpeg" : file.type || "application/octet-stream",
    size: Math.round(result.dataUrl.length * 0.75),
    createdAt: new Date().toISOString(),
    dataUrl: result.dataUrl,
    extractedText: result.extractedText || undefined
  };
}

export function linkedAttachment(name: string, url: string, extractedText = ""): WorkspaceAttachment {
  if (!/^https?:\/\//i.test(url)) throw new Error("Tautan lampiran harus memakai http atau https.");
  return { id: crypto.randomUUID(), name: name.trim() || "Lampiran", mimeType: "text/uri-list", size: 0, createdAt: new Date().toISOString(), url, extractedText: extractedText.trim() || undefined };
}

export function workspaceAttachmentBytes(workspace: OfflineWorkspace) {
  return [
    ...workspace.notes.flatMap((note) => note.attachments ?? []),
    ...workspace.transactions.flatMap((transaction) => transaction.receiptAttachments ?? [])
  ].reduce((sum, item) => sum + (item.dataUrl?.length ?? 0), 0);
}

export function ensureAttachmentBudget(workspace: OfflineWorkspace, attachment: WorkspaceAttachment) {
  if (workspaceAttachmentBytes(workspace) + (attachment.dataUrl?.length ?? 0) > 1_500_000) {
    throw new Error("Penyimpanan lampiran offline hampir penuh. Hapus lampiran lama atau gunakan tautan eksternal.");
  }
  return attachment;
}
