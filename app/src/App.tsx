import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './state/AppStateContext';
import { PersonalizationProvider } from './personalization/PersonalizationProvider';
import { RootLayout } from './components/layout/RootLayout';
import { Home } from './routes/Home';
import { PurposeSelect } from './routes/PurposeSelect';
import { Quiz } from './routes/Quiz';
import { Results } from './routes/Results';
import { Destination } from './routes/Destination';
import { Explore } from './routes/Explore';
import { NotFound } from './routes/NotFound';
import { Favorites } from './routes/Favorites';
import { Compare } from './routes/Compare';
import { FavoritesProvider } from './favorites/FavoritesProvider';
import { ROUTER_BASENAME } from './site/site';

function App() {
  return (
    <AppStateProvider>
      <PersonalizationProvider>
        <FavoritesProvider>
          <BrowserRouter basename={ROUTER_BASENAME}>
            <Routes>
              <Route element={<RootLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/purpose" element={<PurposeSelect />} />
                <Route path="/quiz/:purpose" element={<Quiz />} />
                <Route path="/results" element={<Results />} />
                <Route path="/destination/:id" element={<Destination />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </FavoritesProvider>
      </PersonalizationProvider>
    </AppStateProvider>
  );
}

export default App;
