import { Navigate, Route, Routes } from 'react-router-dom';
import Layout, { Gerbang } from './components/Layout';
import Beranda from './pages/Beranda';
import Dampak from './pages/Dampak';
import Dashboard from './pages/Dashboard';
import { Daftar, Masuk } from './pages/Akun';
import KelasDetail from './pages/KelasDetail';
import KelasList from './pages/KelasList';
import RaporSiswa from './pages/RaporSiswa';
import ModulBaru from './pages/ModulBaru';
import ModulDetail from './pages/ModulDetail';
import ModulList from './pages/ModulList';
import Privasi from './pages/Privasi';
import SoalBaru from './pages/SoalBaru';
import SoalDetail from './pages/SoalDetail';
import SoalList from './pages/SoalList';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Beranda />} />
      <Route path="/masuk" element={<Masuk />} />
      <Route path="/daftar" element={<Daftar />} />
      <Route path="/privasi" element={<Privasi />} />

      <Route
        element={
          <Gerbang>
            <Layout />
          </Gerbang>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dampak" element={<Dampak />} />
        <Route path="/modul" element={<ModulList />} />
        <Route path="/modul/baru" element={<ModulBaru />} />
        <Route path="/modul/:id" element={<ModulDetail />} />
        <Route path="/soal" element={<SoalList />} />
        <Route path="/soal/baru" element={<SoalBaru />} />
        <Route path="/soal/:id" element={<SoalDetail />} />
        <Route path="/kelas" element={<KelasList />} />
        <Route path="/kelas/:id" element={<KelasDetail />} />
        <Route path="/kelas/:id/siswa/:siswaId" element={<RaporSiswa />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
