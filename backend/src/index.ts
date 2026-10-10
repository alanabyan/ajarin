import app from './app';

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Pelita Guru API berjalan di http://localhost:${port}`));
