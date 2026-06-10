import { useEffect, useState } from 'react';
import { readJson, writeJson } from '../utils/storage';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readJson<T>(key, initialValue));
  useEffect(() => {
    writeJson(key, value);
  }, [key, value]);
  return [
    value,
    (next) => {
      setValue((current) => typeof next === 'function' ? (next as (current: T) => T)(current) : next);
    }
  ];
}
