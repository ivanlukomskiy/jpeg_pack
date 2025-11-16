import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { createTheme, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import { HashRouter } from 'react-router-dom';

const theme = createTheme({
  /** Your theme override here */
});

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </HashRouter>,
);
