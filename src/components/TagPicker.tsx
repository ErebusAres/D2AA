import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const menuWidth = 210;
    const menuHeight = 260;
    const left = Math.min(rect.left, window.innerWidth - menuWidth - 10);
    const top = Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 10);
    setMenuStyle({
      left: Math.max(10, left),
      top: Math.max(10, top)
    });
  }, [open]);

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
        <span className="tag-menu" role="menu" style={menuStyle}>
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
