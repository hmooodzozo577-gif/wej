import { describe, expect, it } from 'vitest';
import { I18N } from '.';

describe('public product language', () => {
  it('does not describe the live product as a prototype, demo, or experiment', () => {
    const copy = JSON.stringify(I18N);
    expect(copy).not.toMatch(/نموذج أولي|تجريبية|تجريبي|\bdemo\b|\bprototype\b|\bexperimental\b/i);
  });

  it('keeps the permanent official-source visa warning in both languages', () => {
    expect(I18N.ar.detail.visaGeneralNote).toContain('تحقق من متطلبات التأشيرة من المصدر الرسمي قبل السفر');
    expect(I18N.en.detail.visaGeneralNote).toContain('check visa requirements with the official source before travel');
  });
});
