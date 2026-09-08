// The 8 purposes and their metadata, ported verbatim from PURPOSES in
// wejhaty.html.
import purposesJson from './generated/purposes.json';
import type { PurposeMeta } from './types';

export const PURPOSES: PurposeMeta[] = purposesJson as PurposeMeta[];
