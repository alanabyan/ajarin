import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ModulAjarList from './pages/ModulAjarList';
import ModulAjarGenerator from './pages/ModulAjarGenerator';
import ModulAjarDetail from './pages/ModulAjarDetail';
import BankSoalList from './pages/BankSoalList';
import BankSoalGenerator from './pages/BankSoalGenerator';
import BankSoalDetail from './pages/BankSoalDetail';
import Kelas from './pages/Kelas';

export default function App() {
  return (
    <Routes>
      <Route path="/masuk" element={<Login />} />
      <Route path="/daftar" element={<Register />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/modul-ajar" element={<ModulAjarList />} />
        <Route path="/modul-ajar/baru" element={<ModulAjarGenerator />} />
        <Route path="/modul-ajar/:id" element={<ModulAjarDetail />} />
        <Route path="/bank-soal" element={<BankSoalList />} />
        <Route path="/bank-soal/baru" element={<BankSoalGenerator />} />
        <Route path="/bank-soal/:id" element={<BankSoalDetail />} />
        <Route path="/kelas" element={<Kelas />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
