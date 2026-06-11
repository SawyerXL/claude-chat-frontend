import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface ProcessedAttachment {
  name: string;
  type: string;
  content: string;
}

const BINARY_EXTENSIONS = new Set([
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz', '.tbz2', '.txz', '.zst',
  '.exe', '.msi', '.cab', '.dll', '.so', '.dylib', '.lib', '.a', '.o', '.obj',
  '.dmg', '.iso', '.img', '.bin', '.deb', '.rpm', '.pkg', '.apk', '.ipa', '.app',
  '.jar', '.war', '.ear', '.class', '.pyc', '.pyo',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.mp3', '.mp4', '.m4a', '.m4v', '.aac', '.flac', '.ogg', '.oga', '.opus', '.wav',
  '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.ts', '.m2ts', '.vob',
  '.psd', '.ai', '.sketch', '.fig', '.blend', '.fbx', '.3ds', '.max', '.ma', '.mb',
  '.swf', '.fla', '.rom', '.nes', '.gba', '.nds', '.pdb', '.pch',
  '.keystore', '.jks', '.pfx', '.p12', '.cer', '.der',
]);

const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_TEXT_LENGTH = 200_000;
const BINARY_DETECTION_SAMPLE = 8192;

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function isLikelyBinary(content: string): boolean {
  if (content.length === 0) return false;
  if (content.includes('\0')) return true;
  const sample = content.slice(0, BINARY_DETECTION_SAMPLE);
  let controlCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      controlCount++;
    }
  }
  return controlCount / sample.length > 0.05;
}

function makeBinaryPlaceholder(file: File): string {
  return [
    `[Binary file: ${file.name}]`,
    `Type: ${file.type || 'unknown'}`,
    `Size: ${formatBytes(file.size)}`,
    '',
    "This file's contents cannot be displayed as text.",
    'If you need to work with it, please describe what you want to do with it, or convert it to a text-friendly format first (e.g. export a CSV from a spreadsheet, save a Word file as plain text, etc.).',
  ].join('\n');
}

function makeErrorPlaceholder(file: File, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `[Failed to read file: ${file.name}]\nSize: ${formatBytes(file.size)}\nError: ${message}`;
}

async function readPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .filter((s) => s.length > 0);
    pageTexts.push(strings.join(' '));
    if (pageTexts.join('').length > MAX_PDF_TEXT_LENGTH) break;
  }
  let text = pageTexts.join('\n\n').trim();
  if (text.length > MAX_PDF_TEXT_LENGTH) {
    text = text.slice(0, MAX_PDF_TEXT_LENGTH) + '\n\n[... PDF text truncated, total length exceeded limit ...]';
  }
  return text;
}

export async function processFile(file: File): Promise<ProcessedAttachment> {
  const ext = getExtension(file.name);
  const baseMeta = { name: file.name, type: file.type };

  try {
    if (ext === '.docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value?.trim() || '(empty .docx document)';
      return { ...baseMeta, content: text };
    }

    if (ext === '.pdf') {
      const text = await readPdfText(file);
      if (!text) {
        return {
          ...baseMeta,
          content: `[PDF file: ${file.name}]\nSize: ${formatBytes(file.size)}\nNo extractable text was found. The PDF may be image-based (scanned), encrypted, or contain only drawings.`,
        };
      }
      return { ...baseMeta, content: text };
    }

    if (BINARY_EXTENSIONS.has(ext)) {
      return { ...baseMeta, content: makeBinaryPlaceholder(file) };
    }

    if (file.size > MAX_TEXT_FILE_SIZE) {
      const slice = file.slice(0, MAX_TEXT_FILE_SIZE);
      const text = await slice.text();
      return {
        ...baseMeta,
        content: text + `\n\n[... File truncated at 5 MB, original size: ${formatBytes(file.size)} ...]`,
      };
    }

    const text = await file.text();
    if (isLikelyBinary(text)) {
      return { ...baseMeta, content: makeBinaryPlaceholder(file) };
    }

    if (text.length === 0) {
      return { ...baseMeta, content: `(empty file: ${file.name})` };
    }

    return { ...baseMeta, content: text };
  } catch (err) {
    console.error(`Failed to process ${file.name}:`, err);
    return { ...baseMeta, content: makeErrorPlaceholder(file, err) };
  }
}

export async function processFiles(files: File[]): Promise<ProcessedAttachment[]> {
  return Promise.all(files.map(processFile));
}
