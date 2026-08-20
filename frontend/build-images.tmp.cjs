/* Builds the catalog image set from the captured screenshots. */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SP = process.env.SP;
const OUT = process.env.OUT;
const SHOTS = path.join(SP, 'shots');
const STORE = path.join(SP, 'store');

const COVER_W = 1440;
const COVER_H = 900;

const ensure = (slug) => {
  const dir = path.join(OUT, slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** A slice that is nearly one flat colour is page background, not a section. */
const isFlat = async (buf) => {
  const { channels } = await sharp(buf).stats();
  return channels.every((c) => c.stdev < 6);
};

const webp = (pipeline, file) => pipeline.webp({ quality: 82, effort: 5 }).toFile(file);

/** Web project: hero becomes the cover, the tall capture is sliced for gallery. */
async function web(slug, { hero, tall, slices = [900, 1700, 2300] }) {
  const dir = ensure(slug);
  const made = { cover: null, gallery: [] };

  const heroFile = path.join(SHOTS, hero);
  if (fs.existsSync(heroFile)) {
    await webp(sharp(heroFile).resize(COVER_W, COVER_H, { fit: 'cover', position: 'top' }), path.join(dir, 'cover.webp'));
    made.cover = `/catalog/${slug}/cover.webp`;
  }

  const tallFile = tall && path.join(SHOTS, tall);
  if (tallFile && fs.existsSync(tallFile)) {
    const meta = await sharp(tallFile).metadata();
    let index = 1;
    for (const top of slices) {
      if (top + COVER_H > meta.height) continue;
      const buf = await sharp(tallFile).extract({ left: 0, top, width: meta.width, height: COVER_H }).toBuffer();
      if (await isFlat(buf)) continue;
      const name = `0${index}.webp`;
      await webp(sharp(buf).resize(COVER_W, COVER_H, { fit: 'cover' }), path.join(dir, name));
      made.gallery.push(`/catalog/${slug}/${name}`);
      index += 1;
    }
  }
  return made;
}

/** App: store screenshots become the gallery, three of them compose a cover. */
async function app(slug, prefix, { count = 3, bg } = {}) {
  const dir = ensure(slug);
  const files = fs.readdirSync(STORE)
    .filter((f) => f.startsWith(`${prefix}-`) && /-\d+\.png$/.test(f))
    .sort((a, b) => Number(a.match(/-(\d+)\.png$/)[1]) - Number(b.match(/-(\d+)\.png$/)[1]));

  const made = { cover: null, gallery: [] };

  for (const [index, file] of files.entries()) {
    const name = `0${index + 1}.webp`;
    await webp(sharp(path.join(STORE, file)).resize({ width: 720, withoutEnlargement: true }), path.join(dir, name));
    made.gallery.push(`/catalog/${slug}/${name}`);
  }

  // Cover: the first few screenshots stood on a brand-coloured ground. A single
  // portrait screenshot cannot fill a 16:10 card without cropping away the app.
  const picks = files.slice(0, count);
  if (!picks.length) return made;

  let ground = bg;
  if (!ground) {
    const { dominant } = await sharp(path.join(STORE, picks[0])).stats();
    const mix = (v) => Math.round(v * 0.55);
    ground = { r: mix(dominant.r), g: mix(dominant.g), b: mix(dominant.b) };
  }

  const PHONE_H = 740;
  const GAP = 34;
  const shots = [];
  for (const file of picks) {
    const meta = await sharp(path.join(STORE, file)).metadata();
    const w = Math.round((meta.width / meta.height) * PHONE_H);
    const mask = Buffer.from(
      `<svg width="${w}" height="${PHONE_H}"><rect width="${w}" height="${PHONE_H}" rx="26" ry="26" fill="#fff"/></svg>`,
    );
    const buf = await sharp(path.join(STORE, file))
      .resize(w, PHONE_H, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    shots.push({ buf, w });
  }

  const total = shots.reduce((sum, s) => sum + s.w, 0) + GAP * (shots.length - 1);
  let left = Math.round((COVER_W - total) / 2);
  const top = Math.round((COVER_H - PHONE_H) / 2);
  const composite = shots.map((s) => {
    const at = { input: s.buf, left, top };
    left += s.w + GAP;
    return at;
  });

  await webp(
    sharp({ create: { width: COVER_W, height: COVER_H, channels: 3, background: ground } }).composite(composite),
    path.join(dir, 'cover.webp'),
  );
  made.cover = `/catalog/${slug}/cover.webp`;
  return made;
}

const WEB = {
  'aura-properties': { hero: 'aura-properties-hero.png', tall: 'aura-properties-tall.png' },
  parineetha: { hero: 'parineetha-hero.png', tall: 'parineetha-tall.png' },
  collabuzz: { hero: 'collabuzz-hero.png', tall: 'collabuzz-tall.png' },
  'chirag-homes': { hero: 'chirag-homes-hero.png', tall: 'chirag-homes-tall.png' },
  'svm-dharwad-puc': { hero: 'svm-dharwad-puc-hero.png', tall: 'svm-dharwad-puc-tall.png' },
  'makemypropertyz-materials': { hero: 'makemypropertyz-in-hero.png', tall: 'makemypropertyz-in-tall.png' },
  'makemypropertyz-realty': { hero: 'makemypropertyz-com-hero.png', tall: 'makemypropertyz-com-tall.png' },
  'gastronaut-hospitality-erp': { hero: 'gastronaut-erp-hero.png', tall: 'gastronaut-erp-tall.png' },
  'agenthro-hrms': { hero: 'agenthro-hrms-hero.png' },
  'agenthro-project-management': { hero: 'agenthro-reminders-hero.png' },
  'mbfx-trade-copier': { hero: 'mbfx-trade-copier-hero.png', tall: 'mbfx-trade-copier-tall.png' },
};

const APPS = {
  'collabuzz-influencer-android': 'collabuzz-android',
  'collabuzz-influencer-ios': 'collabuzz-ios',
  'makemypropertyz-android': 'makemypropertyz-android',
  'arthomed-clinic-android': 'arthomed-android',
  'ojas-android': 'ojas-android',
};

(async () => {
  const manifest = {};
  for (const [slug, config] of Object.entries(WEB)) manifest[slug] = await web(slug, config);
  for (const [slug, prefix] of Object.entries(APPS)) manifest[slug] = await app(slug, prefix);
  fs.writeFileSync(path.join(SP, 'manifest.json'), JSON.stringify(manifest, null, 2));
  for (const [slug, made] of Object.entries(manifest)) {
    console.log(slug.padEnd(32), made.cover ? 'cover' : 'NO COVER', `gallery=${made.gallery.length}`);
  }
})();
