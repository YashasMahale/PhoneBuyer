import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage     from './pages/HomePage';
import FinderPage   from './pages/FinderPage';
import ComparePage  from './pages/ComparePage';
import RankingPage  from './pages/RankingPage';
import SearchPage   from './pages/SearchPage';
import ReleasesPage from './pages/ReleasesPage';
import './index.css';

export default function App() {
  useEffect(() => {
    const API = 'http://localhost:8000';
    try {
      const es = new EventSource(`${API}/api/stream`);
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          window.dispatchEvent(new CustomEvent('phones-updated', { detail: payload }));
        } catch (err) {
          console.warn('Malformed SSE message', err);
        }
      };
      return () => es.close();
    } catch (err) {
      console.warn('EventSource failed', err);
    }
  }, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<HomePage     />} />
        <Route path="/finder"   element={<FinderPage   />} />
        <Route path="/compare"  element={<ComparePage  />} />
        <Route path="/ranking"  element={<RankingPage  />} />
        <Route path="/search"   element={<SearchPage   />} />
        <Route path="/releases" element={<ReleasesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
