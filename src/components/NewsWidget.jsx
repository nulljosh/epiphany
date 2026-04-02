import { relativeTime } from '../utils/formatting';

export default function NewsWidget({ articles = [], dark, t }) {
  if (articles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ color: t.textTertiary, fontSize: 12 }}>No news articles available</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {articles.slice(0, 10).map((article, i) => (
        <a
          key={i}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'block',
            background: t.glass,
            backdropFilter: 'blur(40px)',
            border: `0.5px solid ${t.border}`,
            borderRadius: 12,
            padding: 12,
            cursor: 'pointer',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            {article.image && (
              <img
                src={article.image}
                alt=""
                style={{
                  width: 60, height: 60, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
                  background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {article.title}
              </div>
              <div style={{ fontSize: 10, color: t.textTertiary }}>
                {article.source}{article.publishedAt ? ` -- ${relativeTime(article.publishedAt)}` : ''}
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
