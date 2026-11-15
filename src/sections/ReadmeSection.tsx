import type { ReactNode } from 'react';
import readmeRaw from '../../README.txt?raw';

function renderPlainText(text: string): ReactNode {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (
      i + 1 < lines.length &&
      /^[=\-]{3,}\s*$/.test(lines[i + 1]) &&
      line.trim() !== ''
    ) {
      const isH2 = line.trim() === line.trim().toUpperCase();
      const Tag = isH2 ? 'h2' : 'h3';
      out.push(
        <Tag
          key={key++}
          style={
            isH2
              ? { fontSize: '1.35rem', fontWeight: 700, color: '#E2F4FF', margin: '2.5rem 0 0.75rem', letterSpacing: '-0.01em' }
              : { fontSize: '1rem', fontWeight: 600, color: '#B8D8E6', margin: '1.75rem 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }
          }
        >
          {line.trim()}
        </Tag>,
      );
      i += 2;
      continue;
    }

    if (/^( {4,}|\t)/.test(line)) {
      const block: string[] = [];
      while (i < lines.length && (/^( {4,}|\t)/.test(lines[i]) || lines[i].trim() === '')) {
        if (lines[i].trim() === '' && (i + 1 >= lines.length || !/^( {4,}|\t)/.test(lines[i + 1]))) break;
        block.push(lines[i].replace(/^( {4}|\t)/, ''));
        i += 1;
      }
      out.push(
        <pre key={key++} style={{
          background: '#0B1A24',
          border: '1px solid #164E63',
          borderRadius: 8,
          padding: '0.9rem 1rem',
          overflowX: 'auto',
          fontSize: '0.82rem',
          lineHeight: 1.55,
          color: '#A6D9F0',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        }}>
          <code>{block.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^( {4,}|\t)/.test(lines[i]) &&
      !(i + 1 < lines.length && /^[=\-]{3,}\s*$/.test(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) {
      out.push(
        <p key={key++} style={{
          margin: '0 0 1rem',
          color: '#B8CFDC',
          fontSize: '0.95rem',
          lineHeight: 1.75,
        }}>
          {para.join(' ')}
        </p>,
      );
    }
  }

  return <>{out}</>;
}

export function ReadmeSection() {
  return (
    <section
      id="readme"
      style={{ maxWidth: 900, margin: '0 auto', padding: '6rem 1.5rem 4rem' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #1E3A4A',
          paddingBottom: '0.75rem',
        }}
      >
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#E2F4FF', margin: 0 }}>
          README
        </h2>
        <a
          href="https://github.com/swipswaps/foil-cfd-site/blob/main/README.txt"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#5BC0EB', fontSize: '0.85rem', textDecoration: 'underline' }}
        >
          View on GitHub ↗
        </a>
      </div>
      <div className="readme-body">{renderPlainText(readmeRaw)}</div>
    </section>
  );
}
