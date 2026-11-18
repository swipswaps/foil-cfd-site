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
      /^[=-]{3,}\s*$/.test(lines[i + 1]) &&
      line.trim() !== ''
    ) {
      const isH2 = line.trim() === line.trim().toUpperCase();
      if (isH2) {
        out.push(<h2 key={key++} className="readme-h2">{line.trim()}</h2>);
      } else {
        out.push(<h3 key={key++} className="readme-h3">{line.trim()}</h3>);
      }
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
        <pre key={key++} className="readme-pre">
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
      !(i + 1 < lines.length && /^[=-]{3,}\s*$/.test(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) {
      out.push(
        <p key={key++} className="readme-p">
          {para.join(' ')}
        </p>,
      );
    }
  }

  return <>{out}</>;
}

export function ReadmeSection() {
  return (
    <section id="readme" className="readme-section">
      <div className="readme-header">
        <h2 className="readme-title">README</h2>
        <a
          href="https://github.com/swipswaps/foil-cfd-site/blob/main/README.txt"
          target="_blank"
          rel="noreferrer"
          className="readme-link"
        >
          View on GitHub ↗
        </a>
      </div>
      <div className="readme-body">{renderPlainText(readmeRaw)}</div>
    </section>
  );
}
