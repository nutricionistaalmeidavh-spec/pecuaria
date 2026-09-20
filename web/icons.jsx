import React from 'react';

const paths={
  'layout-dashboard':<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
  'layers-3':<><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
  tag:<><path d="M20 13 13 20a2 2 0 0 1-3 0l-7-7V4h9l8 8a2 2 0 0 1 0 1Z"/><circle cx="8.5" cy="8.5" r="1.5"/></>,
  scale:<><path d="M6 3h12l2 5H4l2-5Z"/><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M12 11v4"/><path d="m9.5 13 2.5-2 2.5 2"/></>,
  'shield-plus':<><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="M12 8v6M9 11h6"/></>,
  heart:<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>,
  'badge-dollar-sign':<><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-.8-2-1.3-3.5-1.3-2 0-3.5 1-3.5 2.5 0 3.8 7 1.8 7 5.4 0 1.6-1.5 2.7-3.8 2.7-1.5 0-2.8-.5-3.8-1.4M12 5.5v13"/></>,
  'wallet-cards':<><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 10h5v6h-5a3 3 0 0 1 0-6Z"/><path d="M7 6V4h10v2"/></>,
  'chart-no-axes-combined':<><path d="M3 3v18h18"/><path d="m7 16 4-4 3 3 5-7"/></>,
  'radio-tower':<><path d="M8.5 16.5 12 13l3.5 3.5"/><path d="M5 13a10 10 0 0 1 14 0"/><path d="M2 9.5a15 15 0 0 1 20 0"/><path d="M12 13v9"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  beef:<><path d="M5 9c0-3 2.8-5 7-5s7 2 7 5v5c0 4-3 7-7 7s-7-3-7-7V9Z"/><path d="M5 10 2 7M19 10l3-3M9 14h.01M15 14h.01M10 17h4"/></>,
  bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  alert:<><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
  sprout:<><path d="M12 22V12"/><path d="M7 7c3 0 5 2 5 5-3 0-5-2-5-5ZM17 5c-3 0-5 2-5 5 3 0 5-2 5-5Z"/></>,
  menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>
};

export function Icon({name,size=20,className='',title}){
  const body=paths[name]??paths['layout-dashboard'];
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title?undefined:true} role={title?'img':undefined}>{title&&<title>{title}</title>}{body}</svg>;
}
