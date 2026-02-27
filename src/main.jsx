import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './features/App/App';
import { store } from './app/store';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
  </Provider>
);