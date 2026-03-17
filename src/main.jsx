import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './features/App/App';
import { store } from './app/store';
import { LocaleProvider } from './hooks/useLocale.jsx';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </Provider>
);