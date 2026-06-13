import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Editor from './pages/Editor';

import { useAppStore } from './store/appStore';

function App() {
  const { undo, redo } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:id" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;