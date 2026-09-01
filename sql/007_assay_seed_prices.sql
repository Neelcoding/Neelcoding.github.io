-- ---------- Assay: seeded street prices ----------
-- Starter anchors so the estimator can answer at all. These are NOT market
-- observations and must never be treated as such: every row carries
-- source='estimate', and the model widens its range and drops confidence to
-- Low whenever an estimate is the anchor.
--
-- Accuracy is regime-dependent, and the split is worth knowing:
--
--   Regime B  Creed, Chanel, MFK, Tom Ford Private Blend, Parfums de Marly,
--             Xerjoff, Le Labo, Byredo, Initio. These houses barely discount,
--             so street price sits close to MSRP and MSRP is a published,
--             stable figure. Spot-checked Aventus 100ml at $510 against a
--             seeded $510. Expect a few percent.
--
--   Regime A  Dior, Versace, YSL, Lancome, Paco Rabanne, Armani and friends.
--             Routinely discounted 30-60% below MSRP, and the ratio moves
--             weekly per retailer. Spot-checked Sauvage EDP 100ml at $134
--             against a first pass of $108, a 19% miss, which is why these
--             carry a wider assumed error. Expect +/-20%.
--
-- The estimator is honest about this rather than hiding it. An estimated
-- anchor produces "Model estimate, no sales back it" and a +/-35% band, so
-- the quoted range covers the error instead of asserting a false precision.
--
-- Every row here is replaced silently the moment a real observation for the
-- same fragrance and size lands, because the source layer prefers live rows.
-- Safe to re-run.

insert into public.assay_street_prices (fragrance_id, size_ml, price, currency, source, external_id)
select f.id, v.size_ml, v.price, 'USD', 'estimate', 'seed-v1-' || f.slug || '-' || v.size_ml
from (values
	-- ---------- Regime A: discounted designer ----------
	-- Street, not MSRP. Roughly what a discounter charges rather than what the
	-- boutique asks, since almost nobody pays the boutique price.
	('sauvage-edp',        60,  98.00), ('sauvage-edp',       100, 134.00), ('sauvage-edp',       200, 186.00),
	('sauvage-elixir',     60, 138.00), ('sauvage-elixir',    100, 196.00),
	('dior-homme-intense', 50, 104.00), ('dior-homme-intense',100, 142.00),
	('eros-edt',           30,  36.00), ('eros-edt',           50,  48.00), ('eros-edt',          100,  72.00), ('eros-edt', 200, 104.00),
	('one-million',        50,  62.00), ('one-million',       100,  88.00), ('one-million',       200, 122.00),
	('invictus',           50,  58.00), ('invictus',          100,  82.00), ('invictus',          200, 114.00),
	('acqua-di-gio',       50,  68.00), ('acqua-di-gio',      100,  92.00), ('acqua-di-gio',      200, 128.00),
	('stronger-with-you',  50,  64.00), ('stronger-with-you', 100,  88.00),
	('le-male',            75,  62.00), ('le-male',           125,  82.00), ('le-male',           200, 108.00),
	('la-nuit-de-lhomme',  60,  76.00), ('la-nuit-de-lhomme', 100, 104.00),
	('ysl-y-edp',          60,  82.00), ('ysl-y-edp',         100, 112.00),
	('the-most-wanted',    50,  68.00), ('the-most-wanted',   100,  94.00),
	('bad-boy',            50,  72.00), ('bad-boy',           100,  98.00),
	('prada-lhomme',       50,  74.00), ('prada-lhomme',      100, 102.00), ('prada-lhomme',      150, 128.00),
	('khamrah',           100,  42.00),
	('jadore-edp',         30,  82.00), ('jadore-edp',         50, 116.00), ('jadore-edp',        100, 162.00),
	('miss-dior-edp',      30,  84.00), ('miss-dior-edp',      50, 118.00), ('miss-dior-edp',     100, 164.00),
	('libre-edp',          30,  76.00), ('libre-edp',          50, 106.00), ('libre-edp',          90, 148.00),
	('black-opium',        30,  74.00), ('black-opium',        50, 102.00), ('black-opium',        90, 142.00),
	('la-vie-est-belle',   30,  68.00), ('la-vie-est-belle',   50,  94.00), ('la-vie-est-belle',  100, 132.00),
	('idole-edp',          25,  62.00), ('idole-edp',          50,  88.00), ('idole-edp',          75, 116.00),
	('flowerbomb',         30,  86.00), ('flowerbomb',         50, 118.00), ('flowerbomb',        100, 168.00),
	('daisy-edt',          50,  78.00), ('daisy-edt',         100, 108.00),
	('by-the-fireplace',   30,  84.00), ('by-the-fireplace',  100, 168.00),

	-- ---------- Regime B: little or no discounting ----------
	-- Street sits close to MSRP for these houses, so these are the accurate
	-- half of this file.
	('aventus',            50, 340.00), ('aventus',           100, 510.00), ('aventus',           120, 635.00),
	('green-irish-tweed',  50, 310.00), ('green-irish-tweed', 100, 465.00),
	('baccarat-540',       35, 235.00), ('baccarat-540',       70, 325.00), ('baccarat-540',      200, 555.00),
	('grand-soir',         70, 265.00), ('grand-soir',        200, 465.00),
	('oud-wood',           30, 190.00), ('oud-wood',           50, 295.00), ('oud-wood',          100, 445.00),
	('tobacco-vanille',    50, 295.00), ('tobacco-vanille',   100, 445.00),
	('layton',             75, 245.00), ('layton',            125, 355.00),
	('herod',              75, 245.00), ('herod',             125, 355.00),
	('delina',             30, 165.00), ('delina',             75, 315.00),
	('oud-for-greatness',  90, 385.00),
	('naxos',              50, 240.00), ('naxos',             100, 345.00),
	('santal-33',          50, 220.00), ('santal-33',         100, 320.00),
	('gypsy-water',        50, 210.00), ('gypsy-water',       100, 290.00),
	('bleu-de-chanel',     50, 132.00), ('bleu-de-chanel',    100, 180.00), ('bleu-de-chanel',    150, 220.00),
	('coco-mademoiselle',  35, 116.00), ('coco-mademoiselle',  50, 152.00), ('coco-mademoiselle', 100, 210.00),
	('chance-eau-tendre',  35, 112.00), ('chance-eau-tendre',  50, 146.00), ('chance-eau-tendre', 100, 200.00)

	-- Regime C is deliberately absent. Discontinued bottles have no street
	-- price by definition, and inventing one would push them onto the wrong
	-- branch of the model. They keep pricing off comparable sales alone.
) as v(slug, size_ml, price)
join public.assay_fragrances f on f.slug = v.slug
on conflict (source, external_id) do update set price = excluded.price, observed_at = now();
