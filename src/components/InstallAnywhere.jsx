// ponytail: self-contained -- its own <style>, no palette guessing. color-mix off
// currentColor means it reads correctly on a light or a dark page without props.
const CSS = `
#install-anywhere{padding:5rem 0;border-top:1px solid color-mix(in srgb, currentColor 14%, transparent);text-align:center;}
#install-anywhere .xp-wrap{max-width:640px;margin:0 auto;padding:0 1.5rem;}
#install-anywhere h2{font-size:clamp(1.6rem,3.4vw,2.4rem);margin:0 0 .6rem;letter-spacing:-.02em;}
#install-anywhere .xp-lead{margin:0 auto 2rem;opacity:.7;line-height:1.55;max-width:42ch;}
#install-anywhere .xp-cta{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 28px;border-radius:999px;background:var(--accent,#1462e0);color:#fff;font-weight:600;font-size:1rem;text-decoration:none;}
#install-anywhere .xp-cta:hover{filter:brightness(1.08);}
#install-anywhere .xp-also{margin:1.25rem 0 0;font-size:.875rem;opacity:.55;}
#install-anywhere .xp-also a{color:inherit;}
`;

// Phones and tablets get nothing here: iOS Safari shows Apple's smart banner up top
// (the apple-itunes-app meta in index.html) and Android Chrome offers its own install prompt.
export function detectPlatform(nav = typeof navigator === 'undefined' ? {} : navigator) {
  const ua = nav.userAgent || '';
  // iPadOS reports a Mac user agent; touch points give it away.
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'mobile';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'desktop'; // Linux, ChromeOS, anything else with a real browser
}

export default function InstallAnywhere({ name, appUrl, appStoreUrl, platform = detectPlatform() }) {
  if (platform === 'mobile') return null;

  const mac = platform === 'mac' && appStoreUrl;
  return (
    <section id="install-anywhere">
      <style>{CSS}</style>
      <div className="xp-wrap">
        <h2>{mac ? `${name} for Mac.` : `Install ${name}.`}</h2>
        <p className="xp-lead">
          {mac
            ? 'A native app from the App Store. Your portfolio in the menu bar, synced with your phone.'
            : `Open it in ${platform === 'windows' ? 'Edge or Chrome' : 'Chrome'}, then choose Install in the address bar. It gets its own window and icon, and keeps working offline.`}
        </p>
        <a className="xp-cta" href={mac ? appStoreUrl : appUrl}>{mac ? 'Get it on the App Store' : `Open ${name}`}</a>
        {appStoreUrl && (
          <p className="xp-also">
            Also on <a href={appStoreUrl}>{mac ? 'iPhone and iPad' : 'iPhone, iPad and Mac'}</a>.
          </p>
        )}
      </div>
    </section>
  );
}
