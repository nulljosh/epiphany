// ponytail: self-contained -- its own <style>, no palette guessing. color-mix off
// currentColor means it reads correctly on a light or a dark page without props.
const CSS = `
#install-anywhere{padding:5rem 0;border-top:1px solid color-mix(in srgb, currentColor 14%, transparent);}
#install-anywhere .xp-wrap{max-width:960px;margin:0 auto;padding:0 1.5rem;}
#install-anywhere h2{font-size:clamp(1.6rem,3.4vw,2.4rem);margin:0 0 .6rem;letter-spacing:-.02em;}
#install-anywhere .xp-lead{max-width:46ch;margin:0 0 2.5rem;opacity:.7;line-height:1.55;}
#install-anywhere .xp-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));}
#install-anywhere .xp-card{background:color-mix(in srgb, currentColor 4%, transparent);border:1px solid color-mix(in srgb, currentColor 14%, transparent);border-radius:12px;padding:1.25rem;display:flex;flex-direction:column;gap:.5rem;}
#install-anywhere .xp-card h3{margin:0;font-size:1rem;letter-spacing:-.01em;}
#install-anywhere .xp-card p{margin:0;font-size:.9rem;line-height:1.5;opacity:.7;flex:1;}
#install-anywhere .xp-card a{margin-top:.5rem;font-size:.875rem;font-weight:500;color:var(--accent,currentColor);text-decoration:none;}
#install-anywhere .xp-card a:hover{text-decoration:underline;}
`;

function Card({ title, children, href, label }) {
  return (
    <div className="xp-card">
      <h3>{title}</h3>
      <p>{children}</p>
      {href && <a href={href}>{label} &rarr;</a>}
    </div>
  );
}

export default function InstallAnywhere({ name, appUrl, appStoreUrl }) {
  return (
    <section id="install-anywhere">
      <style>{CSS}</style>
      <div className="xp-wrap">
        <h2>Install it anywhere.</h2>
        <p className="xp-lead">
          {name} runs on every platform. On Windows, Linux and Android it installs straight from
          the browser — no store, no download, no runtime. It gets a real window, its own icon,
          and keeps working offline.
        </p>
        <div className="xp-grid">
          {appStoreUrl && (
            <Card title="iPhone & iPad" href={appStoreUrl} label="App Store">
              A native app, not a wrapped web page.
            </Card>
          )}
          {appStoreUrl && (
            <Card title="Mac" href={appStoreUrl} label="App Store">
              Native, universal binary. Runs on Apple silicon and Intel.
            </Card>
          )}
          <Card title="Windows" href={appUrl} label="Open & install">
            Open the web app in Edge or Chrome, then <strong>Install {name}</strong> from the
            address bar. It lands in the Start Menu like any other app.
          </Card>
          <Card title="Android" href={appUrl} label="Open & install">
            Open the web app in Chrome, then <strong>Add to Home screen</strong>. Full screen,
            no browser chrome, works offline.
          </Card>
          <Card title="Linux" href={appUrl} label="Open & install">
            Same as Windows — install the web app from Chrome or Chromium and it runs in its
            own window.
          </Card>
          <Card title="Web" href={appUrl} label="Open the web app">
            Nothing to install. The same app, in any modern browser.
          </Card>
        </div>
      </div>
    </section>
  );
}
