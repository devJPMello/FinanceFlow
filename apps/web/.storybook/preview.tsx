import type { Preview } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import '../src/index.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Tema',
      defaultValue: 'light',
      toolbar: { title: 'Tema', icon: 'circlehollow', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  decorators: [
    (Story, ctx) => {
      const dark = ctx.globals.theme === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      return (
        <MemoryRouter>
          <div className={dark ? 'dark' : ''}>
            <div className="min-h-[8rem] bg-[#f4f6fb] p-6 text-slate-900 dark:bg-[#0b0f1a] dark:text-slate-100">
              <Story />
            </div>
          </div>
        </MemoryRouter>
      );
    },
  ],
  parameters: { layout: 'fullscreen', controls: { expanded: true } },
};

export default preview;
