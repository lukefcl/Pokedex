import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'FINDEX — Aotearoa Fish Field Guide', short_name: 'FINDEX',
    description: 'Your pocket-sized New Zealand fish guide and private catch journal.',
    start_url: '/', scope: '/', display: 'standalone',
    background_color: '#c23e3f', theme_color: '#c23e3f',
    categories: ['lifestyle', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
