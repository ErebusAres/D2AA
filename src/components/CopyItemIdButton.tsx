import { useState } from 'react';

interface CopyItemIdButtonProps {
  id: string;
  label?: string;
}

export default function CopyItemIdButton({ id, label = 'Copy item instance ID' }: CopyItemIdButtonProps) {
  const [copied, setCopied] = useState(false);
  async function handleCopy(): Promise<void> {
    if (!id) return;
    await copyText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      type="button"
      className={`id-copy-chip ${copied ? 'is-copied' : ''}`}
      title={`${label}: ${id}`}
      aria-label={`${label} ${id}`}
      onClick={handleCopy}
    >
      {copied ? 'OK' : 'ID'}
    </button>
  );
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}
