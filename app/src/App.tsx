import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './state/AppStateContext';
import { RootLayout } from './components/layout/RootLayout';
import { Home } from './routes/Home';
import { PurposeSelect } from './routes/PurposeSelect';
import { Quiz } from './routes/Quiz';
import { Results } from './routes/Results';
import { Destination } from './routes/Destination';
import { Explore } from './routes/Explore';

function App() {
  return (
    <AppStateProvider>
      <BrowserRouter basename="/wej">
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/purpose" element={<PurposeSelect />} />
            <Route path="/quiz/:purpose" element={<Quiz />} />
            <Route path="/results" element={<Results />} />
            <Route path="/destination/:id" element={<Destination />} />
            <Route path="/explore" element={<Explore />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  );
}

export default App;
