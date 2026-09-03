insert into public.channels (
  key,
  name,
  category,
  description,
  youtube_channel_id,
  youtube_handle,
  official_embed_url,
  logo_local,
  coming_soon,
  is_active,
  sort_order
)
values
  ('ary-news', 'ARY News', 'News', 'Breaking news, headlines and current affairs from Pakistan.', 'UCMmpLL2ucRHAXbNHiCPyIyg', null, null, '/channels/ary-news.png', false, true, 1),
  ('geo-news', 'Geo News', 'News', 'Pakistan news, live updates and current affairs.', 'UC_vt34wimdCzdkrzVejwX9g', null, null, '/channels/geo-news.svg', false, true, 2),
  ('samaa-tv', 'SAMAA TV', 'News', 'Breaking updates, reports and live coverage from Pakistan.', 'UCJekW1Vj5fCVEGdye_mBN6Q', null, null, '/channels/samaa-tv.png', false, true, 3),
  ('dunya-news', 'Dunya News', 'News', 'News, analysis and live coverage from Pakistan.', 'UCnMBV5Iw4WqKILKue1nP6Hg', null, null, '/channels/dunya-news.png', false, true, 4),
  ('express-news', 'Express News', 'News', 'Fast-paced news and live reporting from the ground.', 'UCTur7oM6mLL0rM2k0znuZpQ', null, null, null, false, true, 5),
  ('hum-news', 'HUM News', 'News', 'Latest updates, current affairs and nationwide reporting.', null, '@humnewspakistan', null, '/channels/hum-news.png', false, true, 6),
  ('ptv-sports', 'PTV Sports', 'Sports', 'Sports coverage and live sporting events.', null, null, null, null, true, true, 7),
  ('ptv-news', 'PTV News', 'News', 'Pakistan Television''s official round-the-clock news service.', null, '@PTVNewsOfficial', null, null, false, true, 8),
  ('aaj-news', 'Aaj News', 'News', 'Pakistan news, current affairs and live coverage.', 'UCgBAPAcLsh_MAPvJprIz89w', null, null, null, false, true, 9),
  ('madani-channel', 'Madani Channel', 'Islamic', '24/7 Islamic education, guidance and spiritual programming.', 'UCuUocUAnPTUkwGtC8GuNKow', null, null, null, false, true, 10),
  ('khyber-news', 'Khyber News', 'Regional', 'Pashto news, current affairs and regional coverage from Pakistan and around the world.', 'UCCEMt2W7Y8qXkLSTkr082mw', null, 'https://www.mjunoon.tv/embedplayer/khyber-news-live.html', null, false, true, 11)
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  youtube_channel_id = excluded.youtube_channel_id,
  youtube_handle = excluded.youtube_handle,
  official_embed_url = excluded.official_embed_url,
  logo_local = excluded.logo_local,
  coming_soon = excluded.coming_soon,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
