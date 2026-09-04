export type Channel = {
  id: number;
  name: string;
  category: string;
  description: string;
  youtubeChannelId?: string;
  youtubeHandle?: string;
  officialEmbedUrl?: string;
  logoUrl?: string;
  logoLocal?: string;
  thumbnailUrl?: string;
  brandColor?: string;
  comingSoon?: boolean;

  accessType?: "free" | "paid";
  requiredPlanId?: string;
  requiredPlanName?: string;
};

export const channels: Channel[] = [
  {
    id: 1,
    name: "ARY News",
    category: "News",
    description: "Breaking news, headlines and current affairs from Pakistan.",
    youtubeChannelId: "UCMmpLL2ucRHAXbNHiCPyIyg",
    logoLocal: "/channels/ary-news.png",
  },
  {
    id: 2,
    name: "Geo News",
    category: "News",
    description: "Pakistan news, live updates and current affairs.",
    youtubeChannelId: "UC_vt34wimdCzdkrzVejwX9g",
    logoLocal: "/channels/geo-news.svg",
  },
  {
    id: 3,
    name: "SAMAA TV",
    category: "News",
    description: "Breaking updates, reports and live coverage from Pakistan.",
    youtubeChannelId: "UCJekW1Vj5fCVEGdye_mBN6Q",
    logoLocal: "/channels/samaa-tv.png",
  },
  {
    id: 4,
    name: "Dunya News",
    category: "News",
    description: "News, analysis and live coverage from Pakistan.",
    youtubeChannelId: "UCnMBV5Iw4WqKILKue1nP6Hg",
    logoLocal: "/channels/dunya-news.png",
  },
  {
    id: 5,
    name: "Express News",
    category: "News",
    description: "Fast-paced news and live reporting from the ground.",
    youtubeChannelId: "UCTur7oM6mLL0rM2k0znuZpQ",
  },
  {
    id: 6,
    name: "HUM News",
    category: "News",
    description: "Latest updates, current affairs and nationwide reporting.",
    youtubeHandle: "@humnewspakistan",
    logoLocal: "/channels/hum-news.png",
  },
  {
    id: 7,
    name: "PTV Sports",
    category: "Sports",
    description: "Sports coverage and live sporting events.",
    comingSoon: true,
  },
  {
    id: 10,
    name: "PTV News",
    category: "News",
    description: "Pakistan Television's official round-the-clock news service.",
    youtubeHandle: "@PTVNewsOfficial",
  },
  {
    id: 11,
    name: "Aaj News",
    category: "News",
    description: "Pakistan news, current affairs and live coverage.",
    youtubeChannelId: "UCgBAPAcLsh_MAPvJprIz89w",
  },
  {
    id: 8,
    name: "Madani Channel",
    category: "Islamic",
    description: "24/7 Islamic education, guidance and spiritual programming.",
    youtubeChannelId: "UCuUocUAnPTUkwGtC8GuNKow",
  },
  {
    id: 9,
    name: "Khyber News",
    category: "Regional",
    description: "Pashto news, current affairs and regional coverage from Pakistan and around the world.",
    youtubeChannelId: "UCCEMt2W7Y8qXkLSTkr082mw",
    officialEmbedUrl: "https://www.mjunoon.tv/embedplayer/khyber-news-live.html",
  },
];
