-- ---------- Assay: catalogue expansion ----------
-- Adds fragrances and their seeded street prices in one file, because a
-- fragrance without a price is worse than no fragrance at all: it appears in
-- search and then declines to quote, which reads as broken rather than honest.
--
-- No API is involved. A catalogue row is a description of a product, not
-- market data. Prices here are seeded estimates on the same terms as 007:
-- source='estimate', which forces Low confidence and a wide band until a real
-- observation replaces them.
--
-- To add more later, copy a line in either block and keep the slug identical
-- across the two. Safe to re-run.

-- ---------- New fragrances ----------
insert into public.assay_fragrances (slug, name, house, released, family, gender, regime, sizes, search_query)
values
	-- Men, discounted designer
	('dior-homme-parfum',  'Dior Homme Parfum', 'Dior', 2014, 'Iris leather', 'men', 'A', '{75,100}', 'Dior Homme Parfum'),
	('eros-flame',         'Eros Flame', 'Versace', 2018, 'Spicy citrus', 'men', 'A', '{50,100,200}', 'Versace Eros Flame'),
	('dylan-blue',         'Dylan Blue', 'Versace', 2016, 'Aquatic woody', 'men', 'A', '{50,100,200}', 'Versace Dylan Blue'),
	('phantom',            'Phantom', 'Paco Rabanne', 2021, 'Aromatic lavender', 'men', 'A', '{50,100,200}', 'Paco Rabanne Phantom'),
	('one-million-elixir', '1 Million Elixir', 'Paco Rabanne', 2022, 'Spicy amber', 'men', 'A', '{50,100}', 'Paco Rabanne 1 Million Elixir'),
	('acqua-di-gio-profondo','Acqua di Gio Profondo', 'Giorgio Armani', 2020, 'Aquatic mineral', 'men', 'A', '{40,75,125}', 'Armani Acqua di Gio Profondo'),
	('code-profumo',       'Armani Code Profumo', 'Giorgio Armani', 2016, 'Spicy amber', 'men', 'A', '{60,110}', 'Armani Code Profumo'),
	('ultra-male',         'Ultra Male', 'Jean Paul Gaultier', 2015, 'Sweet fougere', 'men', 'A', '{75,125,200}', 'Jean Paul Gaultier Ultra Male'),
	('ysl-myslf',          'MYSLF', 'Yves Saint Laurent', 2024, 'Woody floral', 'men', 'A', '{60,100}', 'YSL MYSLF Eau de Parfum'),
	('bleu-de-chanel-edt', 'Bleu de Chanel Eau de Toilette', 'Chanel', 2010, 'Woody aromatic', 'men', 'A', '{50,100,150}', 'Bleu de Chanel Eau de Toilette'),
	('spicebomb-extreme',  'Spicebomb Extreme', 'Viktor & Rolf', 2015, 'Spicy tobacco', 'men', 'A', '{50,90}', 'Viktor Rolf Spicebomb Extreme'),
	('boss-bottled',       'Boss Bottled', 'Hugo Boss', 1998, 'Woody spicy', 'men', 'A', '{50,100,200}', 'Hugo Boss Bottled'),
	('nautica-voyage',     'Voyage', 'Nautica', 2006, 'Aquatic green', 'men', 'A', '{100}', 'Nautica Voyage'),
	('club-de-nuit-intense','Club de Nuit Intense Man', 'Armaf', 2015, 'Fruity chypre', 'men', 'A', '{105}', 'Armaf Club de Nuit Intense Man'),
	('asad',               'Asad', 'Lattafa', 2022, 'Woody spicy', 'men', 'A', '{100}', 'Lattafa Asad'),

	-- Women, discounted designer
	('good-girl',          'Good Girl', 'Carolina Herrera', 2016, 'Gourmand floral', 'women', 'A', '{30,50,80}', 'Carolina Herrera Good Girl'),
	('very-good-girl',     'Very Good Girl', 'Carolina Herrera', 2020, 'Fruity floral', 'women', 'A', '{30,50,80}', 'Carolina Herrera Very Good Girl'),
	('miss-dior-blooming', 'Miss Dior Blooming Bouquet', 'Dior', 2014, 'Floral fruity', 'women', 'A', '{50,100}', 'Miss Dior Blooming Bouquet'),
	('jadore-infinissime', 'J''adore Infinissime', 'Dior', 2020, 'Floral', 'women', 'A', '{50,100}', 'Dior J adore Infinissime'),
	('mon-paris',          'Mon Paris', 'Yves Saint Laurent', 2016, 'Fruity chypre', 'women', 'A', '{30,50,90}', 'YSL Mon Paris'),
	('black-opium-extreme','Black Opium Extreme', 'Yves Saint Laurent', 2021, 'Coffee floral', 'women', 'A', '{30,50,90}', 'YSL Black Opium Extreme'),
	('la-vie-est-belle-iris','La Vie Est Belle Iris Absolu', 'Lancome', 2022, 'Iris gourmand', 'women', 'A', '{50,100}', 'Lancome La Vie Est Belle Iris Absolu'),
	('alien',              'Alien', 'Mugler', 2005, 'Woody amber', 'women', 'A', '{30,60,90}', 'Mugler Alien Eau de Parfum'),
	('angel-current',      'Angel', 'Mugler', 1992, 'Gourmand', 'women', 'A', '{25,50,100}', 'Mugler Angel Eau de Parfum'),
	('olympea',            'Olympea', 'Paco Rabanne', 2015, 'Salted vanilla', 'women', 'A', '{30,50,80}', 'Paco Rabanne Olympea'),
	('scandal',            'Scandal', 'Jean Paul Gaultier', 2017, 'Honey gourmand', 'women', 'A', '{30,50,80}', 'Jean Paul Gaultier Scandal'),
	('si-edp',             'Si', 'Giorgio Armani', 2013, 'Fruity chypre', 'women', 'A', '{30,50,100}', 'Armani Si Eau de Parfum'),
	('my-way',             'My Way', 'Giorgio Armani', 2020, 'Floral musk', 'women', 'A', '{30,50,90}', 'Armani My Way'),
	('bombshell',          'Bombshell', 'Victoria''s Secret', 2010, 'Fruity floral', 'women', 'A', '{50,100}', 'Victorias Secret Bombshell'),
	('yara',               'Yara', 'Lattafa', 2020, 'Fruity gourmand', 'women', 'A', '{100}', 'Lattafa Yara'),

	-- Niche and no-discount
	('silver-mountain-water','Silver Mountain Water', 'Creed', 1995, 'Fresh woody', 'unisex', 'B', '{50,100}', 'Creed Silver Mountain Water'),
	('viking',             'Viking', 'Creed', 2017, 'Spicy woody', 'men', 'B', '{50,100}', 'Creed Viking'),
	('aventus-for-her',    'Aventus for Her', 'Creed', 2016, 'Fruity chypre', 'women', 'B', '{30,75}', 'Creed Aventus for Her'),
	('lhomme-ideal-extreme','L''Homme Ideal Extreme', 'Guerlain', 2016, 'Almond woody', 'men', 'B', '{50,100}', 'Guerlain L Homme Ideal Extreme'),
	('amber-absolute',     'Amber Absolute', 'Tom Ford', 2007, 'Amber resinous', 'unisex', 'B', '{50,100}', 'Tom Ford Amber Absolute'),
	('lost-cherry',        'Lost Cherry', 'Tom Ford', 2018, 'Cherry gourmand', 'unisex', 'B', '{30,50,100}', 'Tom Ford Lost Cherry'),
	('bitter-peach',       'Bitter Peach', 'Tom Ford', 2020, 'Fruity gourmand', 'unisex', 'B', '{30,50,100}', 'Tom Ford Bitter Peach'),
	('fucking-fabulous',   'Fabulous', 'Tom Ford', 2017, 'Leather almond', 'unisex', 'B', '{50,100}', 'Tom Ford Fucking Fabulous'),
	('pegasus',            'Pegasus', 'Parfums de Marly', 2011, 'Almond vanilla', 'men', 'B', '{75,125}', 'Parfums de Marly Pegasus'),
	('althair',            'Althair', 'Parfums de Marly', 2020, 'Vanilla woody', 'men', 'B', '{75,125}', 'Parfums de Marly Althair'),
	('oajan',              'Oajan', 'Parfums de Marly', 2013, 'Oud vanilla', 'unisex', 'B', '{75,125}', 'Parfums de Marly Oajan'),
	('side-effect',        'Side Effect', 'Initio', 2017, 'Tobacco vanilla', 'unisex', 'B', '{90}', 'Initio Side Effect'),
	('psychedelic-love',   'Psychedelic Love', 'Initio', 2018, 'Floral musk', 'unisex', 'B', '{90}', 'Initio Psychedelic Love'),
	('erba-pura',          'Erba Pura', 'Xerjoff', 2014, 'Fruity musk', 'unisex', 'B', '{50,100}', 'Xerjoff Erba Pura'),
	('another-13',         'Another 13', 'Le Labo', 2010, 'Ambrette musk', 'unisex', 'B', '{50,100}', 'Le Labo Another 13'),
	('bal-dafrique',       'Bal d''Afrique', 'Byredo', 2009, 'Woody floral', 'unisex', 'B', '{50,100}', 'Byredo Bal d Afrique'),
	('mojave-ghost',       'Mojave Ghost', 'Byredo', 2014, 'Woody floral', 'unisex', 'B', '{50,100}', 'Byredo Mojave Ghost'),
	('interlude-man',      'Interlude Man', 'Amouage', 2012, 'Smoky incense', 'men', 'B', '{50,100}', 'Amouage Interlude Man'),
	('reflection-man',     'Reflection Man', 'Amouage', 2007, 'Floral woody', 'men', 'B', '{50,100}', 'Amouage Reflection Man'),
	('coco-noir',          'Coco Noir', 'Chanel', 2012, 'Oriental floral', 'women', 'B', '{35,50,100}', 'Chanel Coco Noir'),
	('chanel-no5-edp',     'No 5', 'Chanel', 1921, 'Aldehydic floral', 'women', 'B', '{35,50,100}', 'Chanel No 5 Eau de Parfum'),
	('gabrielle',          'Gabrielle', 'Chanel', 2017, 'White floral', 'women', 'B', '{35,50,100}', 'Chanel Gabrielle Eau de Parfum'),
	('allure-homme-sport', 'Allure Homme Sport', 'Chanel', 2004, 'Fresh woody', 'men', 'B', '{50,100,150}', 'Chanel Allure Homme Sport'),

	-- Discontinued or reformulated
	('creed-aventus-2010', 'Aventus (early batch, pre-2015)', 'Creed', 2010, 'Fruity chypre', 'men', 'C', '{120}', 'Creed Aventus early batch'),
	('polo-vintage',       'Polo (vintage green)', 'Ralph Lauren', 1978, 'Woody green', 'men', 'C', '{118}', 'Ralph Lauren Polo vintage green'),
	('dior-addict-vintage','Dior Addict (original 2002)', 'Dior', 2002, 'Oriental vanilla', 'women', 'C', '{50,100}', 'Dior Addict original 2002')
on conflict (slug) do nothing;

-- ---------- Seeded street prices for the above ----------
-- Regime C is absent on purpose: a discontinued bottle has no street price,
-- and inventing one would push it onto the wrong branch of the model.
insert into public.assay_street_prices (fragrance_id, size_ml, price, currency, source, external_id)
select f.id, v.size_ml, v.price, 'USD', 'estimate', 'seed-v2-' || f.slug || '-' || v.size_ml
from (values
	('dior-homme-parfum', 75, 128.00), ('dior-homme-parfum', 100, 158.00),
	('eros-flame', 50, 58.00), ('eros-flame', 100, 84.00), ('eros-flame', 200, 118.00),
	('dylan-blue', 50, 52.00), ('dylan-blue', 100, 74.00), ('dylan-blue', 200, 102.00),
	('phantom', 50, 62.00), ('phantom', 100, 88.00), ('phantom', 200, 120.00),
	('one-million-elixir', 50, 78.00), ('one-million-elixir', 100, 108.00),
	('acqua-di-gio-profondo', 40, 72.00), ('acqua-di-gio-profondo', 75, 104.00), ('acqua-di-gio-profondo', 125, 138.00),
	('code-profumo', 60, 76.00), ('code-profumo', 110, 108.00),
	('ultra-male', 75, 68.00), ('ultra-male', 125, 92.00), ('ultra-male', 200, 118.00),
	('ysl-myslf', 60, 92.00), ('ysl-myslf', 100, 128.00),
	('bleu-de-chanel-edt', 50, 108.00), ('bleu-de-chanel-edt', 100, 148.00), ('bleu-de-chanel-edt', 150, 184.00),
	('spicebomb-extreme', 50, 76.00), ('spicebomb-extreme', 90, 108.00),
	('boss-bottled', 50, 48.00), ('boss-bottled', 100, 68.00), ('boss-bottled', 200, 92.00),
	('nautica-voyage', 100, 22.00),
	('club-de-nuit-intense', 105, 32.00),
	('asad', 100, 34.00),
	('good-girl', 30, 82.00), ('good-girl', 50, 112.00), ('good-girl', 80, 148.00),
	('very-good-girl', 30, 82.00), ('very-good-girl', 50, 112.00), ('very-good-girl', 80, 148.00),
	('miss-dior-blooming', 50, 112.00), ('miss-dior-blooming', 100, 158.00),
	('jadore-infinissime', 50, 124.00), ('jadore-infinissime', 100, 172.00),
	('mon-paris', 30, 74.00), ('mon-paris', 50, 102.00), ('mon-paris', 90, 142.00),
	('black-opium-extreme', 30, 78.00), ('black-opium-extreme', 50, 108.00), ('black-opium-extreme', 90, 148.00),
	('la-vie-est-belle-iris', 50, 102.00), ('la-vie-est-belle-iris', 100, 142.00),
	('alien', 30, 78.00), ('alien', 60, 112.00), ('alien', 90, 142.00),
	('angel-current', 25, 72.00), ('angel-current', 50, 104.00), ('angel-current', 100, 146.00),
	('olympea', 30, 66.00), ('olympea', 50, 92.00), ('olympea', 80, 122.00),
	('scandal', 30, 66.00), ('scandal', 50, 92.00), ('scandal', 80, 122.00),
	('si-edp', 30, 72.00), ('si-edp', 50, 100.00), ('si-edp', 100, 140.00),
	('my-way', 30, 70.00), ('my-way', 50, 98.00), ('my-way', 90, 136.00),
	('bombshell', 50, 48.00), ('bombshell', 100, 68.00),
	('yara', 100, 32.00),
	('silver-mountain-water', 50, 300.00), ('silver-mountain-water', 100, 450.00),
	('viking', 50, 300.00), ('viking', 100, 450.00),
	('aventus-for-her', 30, 235.00), ('aventus-for-her', 75, 425.00),
	('lhomme-ideal-extreme', 50, 108.00), ('lhomme-ideal-extreme', 100, 148.00),
	('amber-absolute', 50, 320.00), ('amber-absolute', 100, 470.00),
	('lost-cherry', 30, 195.00), ('lost-cherry', 50, 300.00), ('lost-cherry', 100, 450.00),
	('bitter-peach', 30, 195.00), ('bitter-peach', 50, 300.00), ('bitter-peach', 100, 450.00),
	('fucking-fabulous', 50, 320.00), ('fucking-fabulous', 100, 470.00),
	('pegasus', 75, 245.00), ('pegasus', 125, 355.00),
	('althair', 75, 245.00), ('althair', 125, 355.00),
	('oajan', 75, 265.00), ('oajan', 125, 375.00),
	('side-effect', 90, 355.00),
	('psychedelic-love', 90, 355.00),
	('erba-pura', 50, 245.00), ('erba-pura', 100, 355.00),
	('another-13', 50, 220.00), ('another-13', 100, 320.00),
	('bal-dafrique', 50, 210.00), ('bal-dafrique', 100, 290.00),
	('mojave-ghost', 50, 210.00), ('mojave-ghost', 100, 290.00),
	('interlude-man', 50, 260.00), ('interlude-man', 100, 360.00),
	('reflection-man', 50, 240.00), ('reflection-man', 100, 335.00),
	('coco-noir', 35, 116.00), ('coco-noir', 50, 152.00), ('coco-noir', 100, 210.00),
	('chanel-no5-edp', 35, 116.00), ('chanel-no5-edp', 50, 152.00), ('chanel-no5-edp', 100, 210.00),
	('gabrielle', 35, 120.00), ('gabrielle', 50, 158.00), ('gabrielle', 100, 218.00),
	('allure-homme-sport', 50, 105.00), ('allure-homme-sport', 100, 145.00), ('allure-homme-sport', 150, 178.00)
) as v(slug, size_ml, price)
join public.assay_fragrances f on f.slug = v.slug
-- The dedupe index in 006 is partial (where external_id is not null), and
-- Postgres will only infer a partial index if the same predicate appears here.
-- Without it: "no unique or exclusion constraint matching the ON CONFLICT
-- specification".
on conflict (source, external_id) where external_id is not null
do update set price = excluded.price, observed_at = now();
