import { defineConfig } from 'vitest/config';
import path from 'path';

// Mismo alias que Next.js (@/ → src/) para poder probar las rutas de la API.
export default defineConfig({ resolve: { alias: { '@': path.resolve(__dirname, 'src') } } });
