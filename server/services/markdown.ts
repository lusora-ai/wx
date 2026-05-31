function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(input: string): string {
  return escapeHtml(input)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function stripUnsafeHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

export function markdownToHtml(markdown: string): string {
  const lines = stripUnsafeHtml(markdown).split(/\r?\n/);
  const output: string[] = [];
  let listOpen = false;
  let quoteOpen = false;

  const closeList = () => {
    if (listOpen) {
      output.push('</ul>');
      listOpen = false;
    }
  };
  const closeQuote = () => {
    if (quoteOpen) {
      output.push('</blockquote>');
      quoteOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      closeQuote();
      continue;
    }

    if (line.startsWith('> ')) {
      closeList();
      if (!quoteOpen) {
        output.push('<blockquote>');
        quoteOpen = true;
      }
      output.push(`<p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#4b5563;">${renderInline(line.slice(2))}</p>`);
      continue;
    }

    closeQuote();

    if (line.startsWith('### ')) {
      closeList();
      output.push(`<h3 style="font-size:17px;font-weight:700;color:#1d1d1f;margin:28px 0 12px;padding:0;line-height:1.6;">${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      closeList();
      output.push(`<h2 style="font-size:20px;font-weight:700;color:#1d1d1f;margin:32px 0 14px;padding:0;line-height:1.5;">${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      closeList();
      output.push(`<h1 style="font-size:24px;font-weight:700;color:#111827;margin:36px 0 16px;padding:0;line-height:1.4;">${renderInline(line.slice(2))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!listOpen) {
        output.push('<ul>');
        listOpen = true;
      }
      output.push(`<li style="margin:4px 0;font-size:15px;line-height:1.8;color:#1d1d1f;">${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else {
      closeList();
      output.push(`<p style="margin:0 0 16px;font-size:16px;line-height:1.85;color:#1d1d1f;">${renderInline(line)}</p>`);
    }
  }

  closeList();
  closeQuote();

  return output.join('\n');
}
