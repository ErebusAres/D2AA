import { useEffect, useRef, useState } from 'react';
import { TAGS } from '../utils/constants';
import { tagIcon, tagTitle } from '../utils/formatters';

interface TagPickerProps {
  id: string;
  value?: string;
  onChange: (id: string, tag: string) => void;
  compact?: boolean;
}

export default function TagPicker({ id, value = '', onChange, compact = false }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <span className={`tag-picker ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`tag-chip tag-chip--emoji ${compact ? 'is-compact' : ''}`}
        title={`${tagTitle(value)} - click to change tag`}
        aria-label={`${tagTitle(value)} tag. Click to change.`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {tagIcon(value)}
      </button>
      {open ? (
        <span className="tag-menu" role="menu">
          {TAGS.map((tag) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={value === tag.value}
              key={tag.value || 'none'}
              className={`tag-menu-item ${value === tag.value ? 'is-active' : ''}`}
              title={tag.label}
              onClick={() => {
                onChange(id, tag.value);
                setOpen(false);
              }}
            >
              <span>{tag.emoji}</span>
              <b>{tag.label}</b>
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
