-- Optional sample data so the site isn't empty on first run.
-- Safe to skip — everything here can also be added through /admin.

insert into products (
  slug, name, brand, price, quantity, size, concentration, condition, category,
  short_description, description, top_notes, middle_notes, base_notes,
  longevity, projection, season, occasion, is_active
) values
(
  'midnight-oud-100ml',
  'Midnight Oud',
  'Maison Noir',
  145.00,
  4,
  '100ml',
  'EDP',
  'new',
  'unisex',
  'A smoky, resinous oud with a warm amber heart.',
  'Midnight Oud opens with a bold burst of smoky oud and dark spice, settling into a warm amber and leather heart before drying down to a soft, woody base. Built for cold nights and confident entrances.',
  'Oud, Saffron, Black Pepper',
  'Amber, Leather, Rose',
  'Sandalwood, Musk, Vanilla',
  '8-10 hours',
  'Heavy',
  'fall, winter',
  'evening, date night',
  true
),
(
  'citrus-bloom-50ml',
  'Citrus Bloom',
  'Verde & Co.',
  62.00,
  0,
  '50ml',
  'EDT',
  'new',
  'women',
  'A bright, sparkling citrus with a soft floral finish.',
  'Citrus Bloom is a fresh, sunny fragrance built around Sicilian bergamot and sparkling grapefruit, softened with a delicate white floral heart and a clean musk base. Effortless daytime wear.',
  'Bergamot, Grapefruit, Mandarin',
  'Jasmine, Peony, Neroli',
  'White Musk, Cedar',
  '4-6 hours',
  'Moderate',
  'spring, summer',
  'daytime, casual',
  true
),
(
  'leather-and-tobacco-100ml',
  'Leather & Tobacco',
  'Ashford House',
  98.00,
  7,
  '100ml',
  'Parfum',
  'new',
  'men',
  'A rich, tobacco-forward scent with soft leather undertones.',
  'A study in warmth: sweet tobacco leaf and honeyed leather wrapped around a smooth vanilla-tonka base. Understated, confident, and built to last well into the evening.',
  'Tobacco Leaf, Cinnamon, Bergamot',
  'Leather, Honey, Clove',
  'Tonka Bean, Vanilla, Oakmoss',
  '10+ hours',
  'Heavy',
  'fall, winter',
  'evening, formal',
  true
)
on conflict (slug) do nothing;

insert into blog_posts (slug, title, excerpt, content, category, published, published_at)
values (
  'welcome-to-buzzs-scents',
  'Welcome to Buzz''s Scents',
  'Why I started collecting and reviewing fragrances, and what to expect from the blog.',
  'Welcome! This is where I''ll be posting fragrance reviews, top 10 lists, and buying guides alongside the shop. Stay tuned for more.',
  'general',
  true,
  now()
)
on conflict (slug) do nothing;
