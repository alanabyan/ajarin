import { z, ZodIssueCode } from 'zod';

// Pesan validasi bawaan Zod dalam bahasa Indonesia. Pesan khusus yang ditulis di skema tetap diutamakan.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Wajib diisi.' };
      if (issue.expected === 'integer') return { message: 'Harus bilangan bulat.' };
      if (issue.expected === 'number') return { message: 'Harus berupa angka.' };
      return { message: 'Format isian tidak sesuai.' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: issue.minimum === 1 ? 'Wajib diisi.' : `Minimal ${issue.minimum} karakter.` };
      if (issue.type === 'number') return { message: `Minimal ${issue.minimum}.` };
      if (issue.type === 'array') return { message: `Minimal ${issue.minimum} item.` };
      break;
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Maksimal ${issue.maximum} karakter.` };
      if (issue.type === 'number') return { message: `Maksimal ${issue.maximum}.` };
      if (issue.type === 'array') return { message: `Maksimal ${issue.maximum} item.` };
      break;
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Format email tidak valid.' };
      if (issue.validation === 'uuid') return { message: 'Id tidak valid.' };
      return { message: 'Format isian tidak sesuai.' };
    case ZodIssueCode.invalid_enum_value:
      return { message: `Pilih salah satu: ${issue.options.join(', ')}.` };
  }
  return { message: ctx.defaultError };
});
