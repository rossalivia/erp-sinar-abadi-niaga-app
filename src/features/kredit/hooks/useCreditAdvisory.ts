'use client';

import { useState, useEffect } from 'react';
import { ambilPeringatanEditorAction } from '../actions';
import type { PeringatanEditor } from '../types';

export function useCreditAdvisory(pelangganId: string | null | undefined, totalEstimasi: number) {
  const [warnings, setWarnings] = useState<PeringatanEditor[]>([]);

  useEffect(() => {
    if (!pelangganId || totalEstimasi <= 0) {
      return;
    }

    let isMounted = true;

    const handler = setTimeout(async () => {
      try {
        const res = await ambilPeringatanEditorAction(pelangganId, totalEstimasi);
        if (isMounted) {
          setWarnings(res.success && res.data ? res.data : []);
        }
      } catch {
        if (isMounted) setWarnings([]);
      }
    }, 500); // Debounce 500ms per keputusan C9

    return () => {
      isMounted = false;
      clearTimeout(handler);
    };
  }, [pelangganId, totalEstimasi]);

  const activeWarnings = !pelangganId || totalEstimasi <= 0 ? [] : warnings;

  return { warnings: activeWarnings };
}
