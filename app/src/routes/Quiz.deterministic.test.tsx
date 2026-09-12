import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { Quiz } from './Quiz';

function renderQuiz() {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={['/quiz/tourism']}>
        <Routes>
          <Route path="/quiz/:purpose" element={<Quiz />} />
          <Route path="/results" element={<div>RESULTS_PAGE</div>} />
          <Route path="/purpose" element={<div>PURPOSE_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('deterministic questionnaire product flow', () => {
  it('contains no natural-language or AI interview entry point', () => {
    const { container } = renderQuiz();
    expect(container.querySelector('.ai-interpret-card')).toBeNull();
    expect(screen.queryByText('أخبرنا عن رحلتك')).not.toBeInTheDocument();
  });

  it('advances immediately after choosing an option', async () => {
    const { container } = renderQuiz();
    const before = container.querySelector('.q-text')?.textContent;
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    expect(screen.getByText('جارٍ تجهيز السؤال التالي…')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('.q-text')?.textContent).not.toBe(before));
  });

  it('offers results or more questions after five answers', async () => {
    renderQuiz();
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getAllByRole('radio')[0]!);
      if (i < 4) await waitFor(() => expect(screen.queryByText('جارٍ تجهيز السؤال التالي…')).not.toBeInTheDocument());
    }
    expect(screen.getByRole('button', { name: 'عرض النتيجة الآن' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إكمال الأسئلة لتحسين النتيجة' })).toBeInTheDocument();
  });

  it('lets the traveler continue from the optional checkpoint', async () => {
    const { container } = renderQuiz();
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getAllByRole('radio')[0]!);
      if (i < 4) await waitFor(() => expect(screen.queryByText('جارٍ تجهيز السؤال التالي…')).not.toBeInTheDocument());
    }
    fireEvent.click(screen.getByRole('button', { name: 'إكمال الأسئلة لتحسين النتيجة' }));
    expect(container.querySelector('.q-text')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'عرض النتيجة الآن' })).not.toBeInTheDocument();
  });
});
