/**
 * Google Docs access for importGoogleDoc.ts: sign-in across several accounts,
 * export, and image extraction.
 *
 * WHY TWO EXPORTS OF THE SAME DOC
 *   Google's Markdown export embeds images as base64 in reference definitions,
 *   and those copies are DOWNSCALED -- that is the quality loss you get when
 *   you export-and-import by hand. The HTML zip export (`application/zip`)
 *   carries the same images at the resolution Google actually stores. So we
 *   take the text from one and the image bytes from the other, and pair them up
 *   by position, since both walk the document in the same order.
 *
 *   Ceiling you cannot beat: Google downsamples anything over ~2000px on the
 *   long edge at INSERT time, inside the Doc. No export path recovers what was
 *   discarded then. Keep originals elsewhere if that matters.
 *
 * WHY SEVERAL ACCOUNTS
 *   Docs get shared with whichever address the author had to hand. Rather than
 *   making you remember which, every signed-in account is tried against the doc
 *   and the first one that can open it wins.
 */
import { google } from 'googleapis';
import AdmZip from 'adm-zip';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/userinfo.email'];

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

/**
 * Derived from googleapis rather than imported from google-auth-library:
 * that package is a transitive dependency pnpm does not hoist, and taking it as
 * a direct one risks resolving a different copy than google.drive() expects.
 */
export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

/**
 * Refresh tokens live outside the repo on purpose -- .gitignore only protects
 * you until someone runs `git add -f`.
 */
const CONFIG_DIR = path.join(os.homedir(), '.config', 'california-tech');
const STORE = path.join(CONFIG_DIR, 'google-accounts.json');

type Store = Record<string, { refresh_token: string }>;

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  /** mimeType -> download URL, used to dodge the export API's 10 MB cap. */
  exportLinks?: Record<string, string> | null;
};
export type DocImage = { name: string; data: Buffer; mime: string };

function readStore(): Store {
  if (!fs.existsSync(STORE)) return {};
  return JSON.parse(fs.readFileSync(STORE, 'utf8')) as Store;
}

function writeStore(store: Store): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function listAccounts(): string[] {
  return Object.keys(readStore());
}

export function forgetAccount(email: string): boolean {
  const store = readStore();
  if (!store[email]) return false;
  delete store[email];
  writeStore(store);
  return true;
}

function clientCredentials(): { id: string; secret: string } {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set (expected in .env).\n' +
        '  Google Cloud Console -> APIs & Services -> Credentials\n' +
        '  -> Create OAuth client ID -> Desktop app.\n' +
        '  Enable the Google Drive API on the same project.',
    );
  }
  return { id, secret };
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // The URL is printed too, so this is not fatal.
  }
}

/**
 * Interactive browser sign-in. Adds, or re-authorises, one account.
 *
 * Rolled by hand rather than with @google-cloud/local-auth: that package pins
 * google-auth-library@^9 while googleapis@178 wants ^11, so the OAuth2Client it
 * returns is not the same type google.drive() expects. This is the same
 * loopback flow, using googleapis' own client.
 */
export async function signIn(): Promise<string> {
  const { id, secret } = clientCredentials();

  // Port 0 lets the OS pick; Desktop OAuth clients accept any loopback port.
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const redirectUri = `http://127.0.0.1:${port}`;

  const client = new google.auth.OAuth2(id, secret, redirectUri);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    // Without this Google withholds refresh_token on every consent after the
    // first, which breaks the second and subsequent accounts.
    prompt: 'consent',
  });

  console.log('Opening your browser to sign in. If it does not open:\n');
  console.log(`  ${url}\n`);
  openBrowser(url);

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for the browser redirect (5 minutes).'));
    }, 5 * 60_000);

    server.on('request', (req, res) => {
      const returned = new URL(req.url ?? '/', redirectUri).searchParams;
      const authCode = returned.get('code');
      const error = returned.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><meta charset="utf-8"><title>california-tech</title>' +
          '<body style="font:16px/1.5 system-ui;padding:3rem;max-width:32rem">' +
          (authCode
            ? '<p>Signed in. Close this tab and go back to the terminal.</p>'
            : `<p>Sign-in failed: ${error ?? 'no authorization code returned'}.</p>`) +
          '</body>',
      );

      clearTimeout(timer);
      server.close();
      if (authCode) resolve(authCode);
      else reject(new Error(`Google returned: ${error ?? 'no authorization code'}`));
    });
  });

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const { data } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
  const email = data.email;
  if (!email) throw new Error('Google did not return an email address for this account.');

  if (!tokens.refresh_token) {
    throw new Error(
      `Google returned no refresh token for ${email}. Revoke this app at\n` +
        '  https://myaccount.google.com/permissions\n' +
        'and sign in again — Google only issues one on a fresh consent.',
    );
  }

  const store = readStore();
  store[email] = { refresh_token: tokens.refresh_token };
  writeStore(store);
  return email;
}

function clientFor(email: string): OAuth2Client {
  const saved = readStore()[email];
  if (!saved) throw new Error(`Not signed in as ${email}.`);
  const { id, secret } = clientCredentials();
  const client = new google.auth.OAuth2(id, secret);
  // googleapis refreshes the access token on demand from this.
  client.setCredentials({ refresh_token: saved.refresh_token });
  return client;
}

/**
 * googleapis surfaces HTTP failures as "Request failed with status code 403",
 * which tells you nothing. The reason Google actually gave is buried in the
 * response body, so dig it out.
 */
function googleError(error: unknown): { message: string; reason: string } {
  const wrapped = error as {
    message?: string;
    response?: {
      data?: { error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> } };
    };
  };
  const body = wrapped?.response?.data?.error;
  const reason = body?.errors?.[0]?.reason ?? '';
  const message = body?.message ?? wrapped?.message ?? String(error);
  return { message: reason ? `${message} [${reason}]` : message, reason };
}

/** Find a signed-in account that can actually open this doc. */
export async function resolveAccount(
  fileId: string,
  preferred?: string,
): Promise<{ email: string; auth: OAuth2Client; file: DriveFile }> {
  const accounts = listAccounts();
  if (accounts.length === 0) {
    throw new Error('No Google accounts saved. Run: pnpm run gdoc:login');
  }

  const order = preferred ? [preferred, ...accounts.filter((e) => e !== preferred)] : accounts;
  const failures: string[] = [];

  for (const email of order) {
    if (!accounts.includes(email)) {
      failures.push(`${email}: not signed in`);
      continue;
    }
    try {
      const auth = clientFor(email);
      const { data } = await google.drive({ version: 'v3', auth }).files.get({
        fileId,
        // exportLinks lets us sidestep the export API's 10 MB cap; see exportDoc.
        fields: 'id,name,mimeType,exportLinks',
        supportsAllDrives: true,
      });
      if (data.mimeType !== GOOGLE_DOC_MIME) {
        throw new Error(`not a Google Doc (${data.mimeType})`);
      }
      return { email, auth, file: data as DriveFile };
    } catch (error) {
      failures.push(`${email}: ${googleError(error).message}`);
    }
  }

  throw new Error(`No signed-in account can open that doc.\n  ${failures.join('\n  ')}`);
}

/** image10 must sort after image9, which a plain string sort gets wrong. */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** The exported HTML, which is the only thing in the zip that knows the layout. */
function htmlFromZip(zip: AdmZip): string | null {
  const entry = zip.getEntries().find((e) => !e.isDirectory && /\.x?html?$/i.test(e.entryName));
  return entry ? entry.getData().toString('utf8') : null;
}

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

/**
 * Pull the image files out of an HTML-zip export, in document order.
 *
 * ORDER COMES FROM THE HTML, NOT THE FILENAMES.
 *   Google names the files `images/imageN.ext`, but N is not the position in
 *   the document and does not line up with the `[imageN]` labels in the
 *   Markdown export either — the two exports number independently. Sorting the
 *   filenames, or trusting the names to match across exports, both scramble the
 *   order the moment a doc has been edited.
 *
 *   The HTML in the same zip carries `<img src="images/imageN.ext">` inline at
 *   the real positions, so reading it off there is the only thing that survives
 *   however Google decides to number the files. Filename order is kept purely
 *   as a last resort for a zip with no usable HTML.
 */
export function imagesFromZip(zip: Buffer): { images: DocImage[]; html: string | null; orderedByHtml: boolean } {
  const archive = new AdmZip(zip);

  const files = new Map<string, DocImage>();
  for (const entry of archive.getEntries()) {
    if (entry.isDirectory) continue;
    const mime = EXT_TO_MIME[path.extname(entry.entryName).toLowerCase()];
    if (!mime || !/(^|\/)images\//.test(entry.entryName)) continue;
    files.set(entry.entryName.replace(/^.*?(images\/)/, '$1'), {
      name: path.basename(entry.entryName),
      data: entry.getData(),
      mime,
    });
  }

  const html = htmlFromZip(archive);
  const images: DocImage[] = [];
  const claimed = new Set<string>();

  if (html) {
    for (const tag of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      const src = decodeURIComponent(tag[1].replace(/^\.\//, ''));
      const file = files.get(src);
      // The same image used twice is two blocks in the doc, so do not dedupe.
      if (file) {
        images.push(file);
        claimed.add(src);
      }
    }
  }

  const orderedByHtml = images.length > 0;

  // Anything the HTML never referenced (headers, footers, drawings) still goes
  // in, after the rest, so it is available rather than silently dropped.
  const leftovers = [...files.keys()].filter((key) => !claimed.has(key)).sort(naturalCompare);
  for (const key of leftovers) images.push(files.get(key)!);

  return { images, html, orderedByHtml };
}

/**
 * Export the doc twice and hand back the text and the good image bytes.
 *
 * `files.export` refuses anything over 10 MB with a 403 `exportSizeLimitExceeded`,
 * and the HTML zip of an image-heavy article goes past that easily. The
 * `exportLinks` on the file metadata point at the same endpoint the Docs UI
 * uses for "Download as", which has no such cap, so we prefer those and keep
 * the API call as the fallback.
 */
export async function exportDoc(
  auth: OAuth2Client,
  file: DriveFile,
): Promise<{ markdown: string; images: DocImage[]; html: string | null; orderedByHtml: boolean }> {
  const drive = google.drive({ version: 'v3', auth });

  const viaExportLink = async (mimeType: string): Promise<Buffer | null> => {
    const link = file.exportLinks?.[mimeType];
    if (!link) return null;
    const { token } = await auth.getAccessToken();
    if (!token) return null;
    const response = await fetch(link, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  };

  const viaApi = async (mimeType: string): Promise<Buffer> => {
    try {
      const response = await drive.files.export({ fileId: file.id, mimeType }, { responseType: 'arraybuffer' });
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      const { message, reason } = googleError(error);
      if (reason === 'exportSizeLimitExceeded') {
        throw new Error(
          `Google refuses to export "${file.name}" as ${mimeType}: it is over the 10 MB export limit, ` +
            'and the download link Google normally offers as a way round that was not available. ' +
            'Split the doc, or export it by hand from Docs and import the file.',
          { cause: error },
        );
      }
      throw new Error(`Exporting "${file.name}" as ${mimeType} failed: ${message}`, { cause: error });
    }
  };

  const grab = async (mimeType: string): Promise<Buffer> => (await viaExportLink(mimeType)) ?? viaApi(mimeType);

  const [markdown, zip] = await Promise.all([grab('text/markdown'), grab('application/zip')]);
  return { markdown: markdown.toString('utf8'), ...imagesFromZip(zip) };
}

/**
 * Accepts a bare file ID or any of the URL shapes Google hands out:
 *   docs.google.com/document/d/<id>/edit
 *   docs.google.com/document/u/0/d/<id>/edit
 *   drive.google.com/file/d/<id>/view
 *   docs.google.com/open?id=<id>          <- what "Get link" gives for old docs
 *   drive.google.com/uc?export=download&id=<id>
 */
export function parseDocId(input: string): string {
  const value = String(input ?? '').trim();

  const inPath = value.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (inPath) return inPath[1];

  const inQuery = value.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (inQuery) return inQuery[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) return value;

  throw new Error(`Could not find a Google Doc ID in: ${input}`);
}
