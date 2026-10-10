// NIS dibandingkan tanpa memperhitungkan spasi, tanda baca, dan huruf besar/kecil.
export const normNis = (s: string) => s.replace(/[^0-9a-z]/gi, '').toLowerCase();
